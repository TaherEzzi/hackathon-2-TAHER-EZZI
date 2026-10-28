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

from .. import db
from ..config import config
from ..services import images, storage, text

log = logging.getLogger(__name__)


class SlotNotViable(Exception):
    """No pickable preset/product for this profile — scheduler marks the
    slot failed with a log instead of crashing the tick."""


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
    if love:
        return random.choice(love)
    # Fall back to category presets so first-run profiles still demo.
    cat = profile.get("category")
    if cat:
        fallbacks = db.theme_presets_for_categories(cat)
        if fallbacks:
            return random.choice(fallbacks)
    return None


def pick_product(profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    rows = db.select("products", {"profile_id": profile["id"]}, limit=100)
    return random.choice(rows) if rows else None


def _fetch_product_image(product: Dict[str, Any]) -> Optional[bytes]:
    """Download the product's stored photo for img2img anchoring.

    `products.image_path` is `<bucket>/<profile>/<file>` — the public object
    URL is therefore base + /storage/v1/object/public/<path>. Any failure
    returns None, which degrades the ladder to text-only instead of dying.
    """
    path = product.get("image_path")
    if not path:
        return None
    try:
        import requests  # local import: only needed on this path

        resp = requests.get(
            f"{config.supabase_url}/storage/v1/object/public/{path}",
            timeout=30,
        )
        if resp.ok and resp.content:
            return resp.content
    except Exception as exc:  # noqa: BLE001 — degrade, never crash the slot
        log.warning("product photo fetch failed (%s): %s", path, exc)
    return None


def generate_post(
    profile: Dict[str, Any],
    preset_id: Optional[int] = None,
    revision_feedback: Optional[str] = None,
    base_post: Optional[Dict[str, Any]] = None,
    slot_date: Optional[date] = None,
    slot_index: Optional[int] = None,
) -> PostPayload:
    """Full pipeline in one sync call:

    pick theme preset + product → compose prompt (provider ladder image
    + text) → upload to `generated-posts` → write/update the `post` row.

    For revisions (`base_post` set + `revision_feedback`), rows are UPDATEd
    and a `revision` history row is appended; for fresh generation we INSERT
    status='awaiting_review'.
    """
    preset = pick_preset(profile, preset_id)
    product = pick_product(profile)
    if revision_feedback is None and (preset is None or product is None):
        # Fresh slot without inputs is unrecoverable; revisions must have a base.
        raise SlotNotViable(
            f"profile {profile['id']}: preset={'ok' if preset else 'none'}, "
            f"product={'ok' if product else 'none'}"
        )

    is_revision = base_post is not None

    # 1. Image via provider ladder. When the product has a stored photo we
    #    anchor the render to it (img2img, preserving the real product); the
    #    prompt's own guardrail text still demands the same.
    prompt = images.build_image_prompt(preset, product, profile, revision_feedback)
    product_image = _fetch_product_image(product)
    # 512 dev-mode (user call, 2026-10-28): quadruples free-render volume while
    # developing. Restore to 1024 for demo-day quality once dev wraps.
    image = images.generate_image_edit(product_image, prompt, size=512)

    # 2. Caption via text ladder.
    caption, hashtags = text.generate_caption(preset, profile=profile, product=product, revision_feedback=revision_feedback)

    # 3. Upload → public URL (Telegram + Instagram both GET it).
    path = storage.upload_generated_post(profile["id"], image.jpeg_bytes)
    image_url = storage.public_url(config.bucket_generated_posts, path)

    now = datetime.now(timezone.utc)
    chat_text = f"{caption}\n\n{' '.join(hashtags)}".strip() if hashtags else caption

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
        "slot_index": slot_index,
        "revision_count": 0,
    })
    log.info("Post %s generated (provider=%s, %d bytes)", row.get("id"), image.provider, len(image.jpeg_bytes))
    return PostPayload(
        post_id=str(row.get("id", "")),
        chat_text=chat_text,
        image_url=image_url,
        revision_count=0,
        slot_date=slot_date,
        slot_index=slot_index,
    )
