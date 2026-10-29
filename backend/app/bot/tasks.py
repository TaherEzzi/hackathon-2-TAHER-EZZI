"""Post generation + delivery pipeline (shared by TWO callers):

* Telegram `/generate` command (on-demand demo generation)
* The APScheduler slots (stored `post` rows with slot_date/slot_index)

Sync generation uses requests + supabase-py; delivery is async because it
sends through python-telegram-bot's httpx-based Bot. Callers on the event
loop wrap the sync half in `asyncio.to_thread`. `post_payload` returns
everything needed for delivery, so the scheduler never parses urllib hours.
"""
from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

import requests

from .. import db
from ..config import config
from ..services import images, storage, text

log = logging.getLogger(__name__)


class SlotNotViable(Exception):
    """No pickable preset/product for this profile — scheduler marks the
    slot failed with a log instead of crashing the tick."""


class NoAlternativeProduct(SlotNotViable):
    """A different product was requested but the locker has only the one
    already on the draft; callers say "add another product" instead of the
    generic missing-assets message."""


@dataclass
class PostPayload:
    post_id: str
    chat_text: str          # caption + hashtag block for the Telegram message
    image_url: str
    revision_count: int
    slot_date: Optional[date]
    slot_index: Optional[int]


def pick_preset(profile: Dict[str, Any], explicit_preset_id: Optional[int]) -> Optional[Dict[str, Any]]:
    """Random preset from the profile's theme_selection, falling back to any
    preset in the profile's category. Explicit preset# from /generate wins."""
    if explicit_preset_id is not None:
        rows = db.select("theme_preset", {"id": explicit_preset_id})
        if rows:
            return rows[0]
        return None  # unknown preset id → caller treats as not viable

    sel = db.client().table("theme_selection").select("preset_id").eq("profile_id", profile["id"]).execute()
    preset_ids = [r["preset_id"] for r in (sel.data or [])]
    love = db.select_in("theme_preset", "id", preset_ids) if preset_ids else []
    cat = (profile.get("category") or "").strip().lower()
    if cat:
        # Saved selections outlive a category switch; drop the old category so
        # a product is never staged in another category's scene.
        love = [p for p in love if (p.get("category") or "").strip().lower() == cat]
    if love:
        return random.choice(love)
    # Fall back to category presets so first-run profiles still demo.
    if cat:
        fallbacks = db.theme_presets_for_categories(cat)
        if fallbacks:
            return random.choice(fallbacks)
    return None


def pick_product(
    profile: Dict[str, Any], exclude_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Random product from the locker, optionally skipping one id.

    `exclude_id` powers /new: the caller wants a *different* product than the
    one already rendered in the current draft.
    """
    rows = db.select("products", {"profile_id": profile["id"]}, limit=100)
    if exclude_id:
        rows = [r for r in rows if str(r.get("id")) != str(exclude_id)]
    return random.choice(rows) if rows else None


def _fetch_product_image(product: Dict[str, Any]) -> Optional[bytes]:
    """Download the product photo Klein needs as the image input.

    Returns None only when the row has no photo path. A failed download
    raises GenerationError with the HTTP status or the request error.
    """
    path = product.get("image_path")
    if not isinstance(path, str) or not path.strip():
        return None
    try:
        resp = requests.get(storage.object_url(path.strip()), timeout=30)
    except Exception as exc:  # noqa: BLE001 — boundary keeps the cause
        log.warning("product photo fetch failed: %s", exc)
        raise images.GenerationError("flux-2-klein: product photo download failed") from exc
    if resp.ok and resp.content:
        return bytes(resp.content)
    log.warning(
        "product photo fetch failed status=%s bytes=%d",
        resp.status_code,
        len(resp.content or b""),
    )
    raise images.GenerationError(
        f"flux-2-klein: product photo download failed (status={resp.status_code})"
    )


def generate_post(
    profile: Dict[str, Any],
    preset_id: Optional[int] = None,
    revision_feedback: Optional[str] = None,
    base_post: Optional[Dict[str, Any]] = None,
    slot_date: Optional[date] = None,
    slot_index: Optional[int] = None,
    exclude_product_id: Optional[str] = None,
) -> PostPayload:
    """Full pipeline in one sync call:

    pick theme preset + product → compose prompt (provider ladder image
    + text) → upload to `generated-posts` → write/update the `post` row.

    For revisions (`base_post` set + `revision_feedback`), rows are UPDATEd
    and a `revision` history row is appended; for fresh generation we INSERT
    status='awaiting_review'.
    """
    preset = pick_preset(profile, preset_id or (base_post or {}).get("preset_id"))
    # A revision must keep the product it was generated from; re-picking would
    # swap the photo under the user's feedback (observed: can → bottle).
    if base_post is not None and base_post.get("product_id"):
        rows = db.select("products", {"id": base_post["product_id"]}, limit=1)
        product = rows[0] if rows else pick_product(profile)
    else:
        product = pick_product(profile, exclude_id=exclude_product_id)
    if product is None and exclude_product_id and revision_feedback is None:
        # Distinguish "another product requested but the locker has only the
        # current one" from "locker is empty".
        if db.select("products", {"profile_id": profile["id"]}, limit=1):
            raise NoAlternativeProduct(
                f"profile {profile['id']}: only the product on the draft exists"
            )
    if revision_feedback is None and (preset is None or product is None):
        # Fresh slot without inputs is unrecoverable; revisions must have a base.
        raise SlotNotViable(
            f"profile {profile['id']}: preset={'ok' if preset else 'none'}, "
            f"product={'ok' if product else 'none'}"
        )

    is_revision = base_post is not None

    # 1. Image via flux-2-klein: the stored product photo plus the prompt.
    #    Klein is the only image model for a post; if Cloudflare's filter
    #    rejects the photo on every attempt (trademarked packaging trips it
    #    consistently), a text-only render keeps the slot deliverable.
    prompt = images.build_image_prompt(preset, product, profile, revision_feedback)
    product_image = _fetch_product_image(product) if product else None
    fallback_notice = ""
    try:
        image = images.generate_image_edit(product_image, prompt)
    except images.PolicyFlagged as exc:
        log.warning("product-anchored render blocked, using text-only fallback: %s", exc)
        image = images.generate_image(
            images.build_image_prompt(preset, product, profile, revision_feedback, text_only=True)
        )
        fallback_notice = (
            "\n\n⚠️ Cloudflare's safety filter blocked this product photo "
            "(trademarked packaging), so this is a text-only interpretation — "
            "not a retouched version of your image."
        )

    # 2. Caption via text ladder.
    caption, hashtags = text.generate_caption(preset, profile=profile, product=product, revision_feedback=revision_feedback)

    # 3. Upload → public URL (Telegram + Instagram both GET it).
    path = storage.upload_generated_post(profile["id"], image.jpeg_bytes)
    image_url = storage.public_url(config.bucket_generated_posts, path)

    now = datetime.now(timezone.utc)
    chat_text = f"{caption}\n\n{' '.join(hashtags)}".strip() if hashtags else caption
    chat_text += fallback_notice

    if is_revision and base_post is not None:
        seq = int(base_post.get("revision_count") or 0) + 1
        db.insert("revision", {
            "post_id": base_post["id"],
            "seq": seq,
            "feedback": revision_feedback,
            "image_path": path,
            "caption": caption,
        })
        db.update("post", {"id": base_post["id"]}, {
            "image_path": path,
            "caption": caption,
            "hashtags": hashtags,
            "revision_count": seq,
            "status": "awaiting_review",
        })
        log.info("Post %s revised (seq=%d, provider=%s)", base_post["id"], seq, image.provider)
        return PostPayload(
            post_id=str(base_post["id"]),
            chat_text=chat_text,
            image_url=image_url,
            revision_count=seq,
            slot_date=slot_date,
            slot_index=slot_index,
        )

    # On-demand posts have no scheduler slot. `post.slot_index` is NOT NULL,
    # so store 0; slot_date stays NULL, which keeps the scheduler's
    # (profile_id, slot_date, slot_index) uniqueness intact.
    stored_slot_index = slot_index if slot_index is not None else 0
    row = db.insert("post", {
        "profile_id": profile["id"],
        "status": "awaiting_review",
        "preset_id": preset["id"] if preset else None,
        "product_id": product["id"] if product else None,
        "image_path": path,
        "caption": caption,
        "hashtags": hashtags,
        "scheduled_for": now.isoformat(),  # = generated now for on-demand posts
        "slot_date": slot_date.isoformat() if slot_date else None,
        "slot_index": stored_slot_index,
        "revision_count": 0,
    })
    log.info("Post %s generated (provider=%s, %d bytes)", row.get("id"), image.provider, len(image.jpeg_bytes))
    return PostPayload(
        post_id=str(row.get("id", "")),
        chat_text=chat_text,
        image_url=image_url,
        revision_count=0,
        slot_date=slot_date,
        slot_index=stored_slot_index,
    )
