"""Image generation on Cloudflare Workers AI.

Posts use a flux-2-klein model (`CLOUDFLARE_EDIT_MODEL`, default 4b): the
product photo (sent as the multipart `input_image_0` part, ≤512px) plus the
prompt. `generate_image` is the text-only Flux Schnell path, used only when
Cloudflare's output filter refuses every product-anchored attempt.

All functions are synchronous (requests) on purpose: FastAPI handlers and
PTB handlers run them inside a worker thread (`asyncio.to_thread`) so a
slow provider call never blocks the event loop.
"""
from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from io import BytesIO
from typing import Dict, List, Optional

import requests
from PIL import Image, ImageOps

from ..config import config

log = logging.getLogger(__name__)

CLOUDFLARE_FLUX_MODEL = "@cf/black-forest-labs/flux-1-schnell"
DEFAULT_TIMEOUT_SECS = 90
# klein-4b render took ~20s in the verified test; give it generous headroom.
KLEIN_TIMEOUT_SECS = 240
# Workers AI requires reference images to be *smaller* than 512x512, so the
# long edge is capped just under that (504 divides evenly and re-encodes clean).
MAX_INPUT_EDGE = 504

# Cloudflare's output safety filter false-positives on innocuous product
# shots (observed: code 3030 "Your output has been flagged" on a cold-brew
# can). Retries reword the prompt with explicit family-friendly language
# instead of failing the post.
FLAGGED_ATTEMPTS = 3
_SAFETY_SUFFIX = (
    "Clean, family-friendly commercial product photography; "
    "no people, no faces, no violence."
)


def _is_flagged(exc: Exception) -> bool:
    text = str(exc).lower()
    return "3030" in text or "flagged" in text


def _prompt_variants(prompt: str) -> List[str]:
    # The identity lock stays first in every variant; only the tail changes.
    return [
        prompt,
        f"{prompt}\n{_SAFETY_SUFFIX}",
        f"{prompt}\nBright, cheerful e-commerce catalog photograph with clean "
        f"studio styling.\n{_SAFETY_SUFFIX}",
    ]
# Identity guardrail: klein is a full re-renderer. Without an explicit lock it
# follows the *words* of the scene prompt instead of the photo — verified
# 2026-10-29: a Coca-Cola can was rendered as a generic glass bottle labelled
# "Coco cola" because the preset said "a fruity drink bottle" and the asset
# title was fed in as text. The lock leads AND trails every edit prompt, and
# the scene text is framed as background-only.
IDENTITY_GUARDRAIL = (
    "IMAGE 1 IS THE PRODUCT. Reproduce that exact item: same container type "
    "(a can stays a can, a bottle stays a bottle), same silhouette and "
    "proportions, same liquid colour and fill level, same cap, same label "
    "artwork and lettering, same brand marks. Do not substitute another "
    "product. Do not redraw, restyle, correct or rewrite the label. Do not "
    "add any text that is not on the original label. Do not tint the product "
    "with the scene's colour grade — keep its original hues."
)
SCENE_PREFIX = (
    "Art direction for the background, props and lighting only — never for "
    "the product itself: "
)
IDENTITY_TRAILER = (
    "The product must stay identical to IMAGE 1 in shape, colour, label and "
    "lettering; if any instruction above conflicts with that, keep the "
    "product unchanged."
)


class GenerationError(RuntimeError):
    """Cloudflare refused the render, or the product photo was missing."""


class PolicyFlagged(GenerationError):
    """Every Klein attempt was rejected by Cloudflare's output filter (3030).

    Heavily trademarked product photos (observed: a Coca-Cola can) trip it on
    every attempt regardless of prompt, so callers may fall back to a
    text-only render instead of failing the post.
    """


@dataclass
class ImageResult:
    jpeg_bytes: bytes
    provider: str


def _cloudflare_flux(prompt: str, account_id: str, token: str) -> ImageResult:
    url = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{account_id}/ai/run/{CLOUDFLARE_FLUX_MODEL}"
    )
    # steps=4 is the schnell sweet spot per verified PoC. NOTE: the live
    # flux-1-schnell schema REJECTS width/height ("Additional or unevaluated
    # properties") and outputs a fixed square, so we do not send size params.
    payload: Dict[str, object] = {"prompt": prompt, "steps": 4}
    # FLUX's NSFW guard false-positives on innocuous prompts (observed: code
    # 8007 on "coffee bean"). Retry with two prompt variants before surfacing.
    prompts = [prompt, f"premium commercial photograph of {prompt}", f"elegant still life, catalog presentation: {prompt}"]
    resp = None
    for attempt, p in enumerate(prompts):
        payload["prompt"] = p
        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=DEFAULT_TIMEOUT_SECS,
        )
        if resp.ok:
            break
        # Only retry on policy false-positives; propagate other errors as-is.
        if "8007" not in resp.text and "NSFW" not in resp.text:
            break
    if resp is None:
        raise RuntimeError("Cloudflare flux made no request")
    resp.raise_for_status()
    body = resp.json()
    if not body.get("success"):
        # Workers AI returns success=false with an errors array on quota/policy issues
        raise RuntimeError(f"Cloudflare flux error: {body.get('errors')}")
    result = body.get("result") or {}
    image_b64 = result.get("image")
    if not image_b64:
        raise RuntimeError("Cloudflare flux returned no image payload")
    return ImageResult(base64.b64decode(image_b64), provider="cloudflare-flux-schnell")


def _cloudflare_error(resp: requests.Response) -> str:
    """Prefer Cloudflare's JSON `errors` text over a bare status code.

    Why: `raise_for_status()` alone reports "400 Client Error" and hides the
    actual cause (bad field name, oversized reference image, policy flag).
    """
    detail = ""
    try:
        body = resp.json()
    except ValueError:
        body = None
    if isinstance(body, dict):
        parts = []
        for err in body.get("errors") or []:
            if isinstance(err, dict):
                code = err.get("code")
                message = str(err.get("message") or "")
                parts.append(f"{code}: {message}" if code else message)
            else:
                parts.append(str(err))
        detail = "; ".join(p for p in parts if p)
    if not detail:
        detail = (resp.text or "").strip()[:300]
    return f"HTTP {resp.status_code}" + (f" — {detail}" if detail else "")


def _prepare_input_image(image_bytes: bytes, max_edge: int = MAX_INPUT_EDGE) -> bytes:
    """Normalise the product photo to what flux-2-klein accepts.

    Why: Workers AI returns 400 for reference images at/above 512px on the
    long edge, and Asset Locker uploads arrive as 1024px+ JPEG/WebP. EXIF
    rotation is applied and everything is re-encoded as RGB JPEG so the
    declared multipart mime type always matches the bytes.
    """
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((max_edge, max_edge), Image.LANCZOS)
            out = BytesIO()
            img.save(out, format="JPEG", quality=92)
    except Exception as exc:  # noqa: BLE001 — boundary: surface unreadable uploads
        raise GenerationError(f"flux-2-klein: product photo unreadable ({exc})") from exc
    return out.getvalue()


def _cloudflare_klein_edit(
    image_bytes: bytes, prompt: str, account_id: str, token: str, size: int,
    model: str,
) -> ImageResult:
    """Image-to-image via flux-2-klein-4b (multipart: prompt + input_image_0).

    The reference image field MUST be named `input_image_0` (not `image`) —
    Cloudflare's schema only accepts ordered `input_image_N` parts, and any
    other name yields a 400 Bad Request.

    Billing: ~125 neurons per 1024² render (~80/day inside the free
    10,000-neuron daily allocation) — no paid credits required.
    """
    url = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{account_id}/ai/run/{model}"
    )
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}"},
        files={"input_image_0": ("product.jpg", image_bytes, "image/jpeg")},
        data={
            "prompt": prompt,
            "width": str(size),
            "height": str(size),
        },
        timeout=KLEIN_TIMEOUT_SECS,
    )
    if not resp.ok:
        raise RuntimeError(_cloudflare_error(resp))
    body = resp.json()
    if not body.get("success"):
        raise RuntimeError(f"Cloudflare klein error: {body.get('errors')}")
    image_b64 = (body.get("result") or {}).get("image")
    if not image_b64:
        raise RuntimeError("Cloudflare klein response had no image")
    return ImageResult(
        base64.b64decode(image_b64),
        provider=f"cloudflare-{model.rsplit('/', 1)[-1]}",
    )


def generate_image_edit(
    image_bytes: Optional[bytes], prompt: str, size: Optional[int] = None,
) -> ImageResult:
    """Render with a flux-2-klein model: product photo plus prompt.

    Raises GenerationError when the photo is missing, Cloudflare is not
    configured, or the Klein request fails. Non-policy failures (retired
    model, rejected field) retry once on `CLOUDFLARE_EDIT_MODEL_FALLBACK`;
    policy refusals do not, because the same photo trips both models.
    """
    token = config.cloudflare_api_token
    account_id = config.cloudflare_account_id
    if not image_bytes:
        raise GenerationError("flux-2-klein: product photo is required")
    if not token or not account_id:
        raise GenerationError(
            "flux-2-klein: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not configured"
        )
    size = size or config.post_image_size
    model = config.cloudflare_edit_model
    locked_prompt = f"{IDENTITY_GUARDRAIL}\n{prompt}\n{IDENTITY_TRAILER}"
    failures: List[str] = []
    flagged_only = True
    prepared = _prepare_input_image(image_bytes)
    for attempt, variant in enumerate(_prompt_variants(locked_prompt), start=1):
        # Retries also change the reference encoding: Cloudflare's advice for
        # a 3030 flag is "another prompt / input image combination".
        prepared = _prepare_input_image(image_bytes, MAX_INPUT_EDGE - 32 * (attempt - 1))
        try:
            return _cloudflare_klein_edit(prepared, variant, account_id, token, size, model)
        except Exception as exc:  # noqa: BLE001 — retry only policy false-positives
            failures.append(f"{model}: {exc}")
            flagged_only = flagged_only and _is_flagged(exc)
            log.warning(
                "Cloudflare %s attempt %d/%d failed (input_bytes=%d): %s",
                model,
                attempt,
                FLAGGED_ATTEMPTS,
                len(prepared),
                exc,
            )
            if not _is_flagged(exc) or attempt == FLAGGED_ATTEMPTS:
                break

    fallback = config.cloudflare_edit_model_fallback
    if not flagged_only and fallback and fallback != model:
        log.warning("%s failed; retrying on %s", model, fallback)
        try:
            return _cloudflare_klein_edit(
                prepared, locked_prompt, account_id, token, size, fallback,
            )
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{fallback}: {exc}")
            flagged_only = _is_flagged(exc)

    detail = failures[-1]
    if len(failures) > 1:
        detail = f"{detail} (after {len(failures)} attempts)"
    if flagged_only:
        raise PolicyFlagged(f"flux-2-klein: {detail}")
    raise GenerationError(f"flux-2-klein: {detail}")


def generate_image(prompt: str) -> ImageResult:
    """Text-only Flux Schnell. Posts do not use this; they use Klein.

    Raises GenerationError when Cloudflare is not configured or the request fails.
    Schnell ignores width and height, so this function takes no size.
    """
    token = config.cloudflare_api_token
    account_id = config.cloudflare_account_id
    if not token or not account_id:
        raise GenerationError(
            "cloudflare: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not configured"
        )
    try:
        return _cloudflare_flux(prompt, account_id, token)
    except Exception as exc:  # noqa: BLE001
        log.warning("Cloudflare flux failed: %s", exc)
        raise GenerationError(f"cloudflare: {exc}") from exc


# ── Prompt composition ────────────────────────────────────────────────────

# Guardrail appended to EVERY image prompt. Why: flux has no text control,
# and baked-in gibberish text is the #1 reason a generated ad image is
# unusable for publishing. Packaging labels are the exception — the identity
# guardrail above requires them to survive verbatim, so this only forbids
# *added* text (never the product's own logo).
_IMAGE_GUARDRAIL = (
    "Square 1:1 composition, single hero product, ultra-realistic, high-end "
    "commercial photography. No text, typography, captions or watermarks "
    "added to the scene; keep only the product's own label exactly as "
    "photographed."
)


def build_image_prompt(
    preset: Optional[Dict], product: Optional[Dict], profile: Optional[Dict],
    revision_feedback: Optional[str] = None, *, text_only: bool = False,
) -> str:
    """Compose the final image prompt.

    Per THEME_PRESETS runtime pattern: style words come from the preset's
    `prompt_template`, the product comes from the Asset Locker row,
    and palette/tone DNA from `profiles.design_dna_md`. `revision_feedback`
    (from a Telegram ✏️ request) is appended so the regeneration actually
    changes *this* post rather than a fresh random one.

    `text_only=True` builds the Flux-Schnell fallback prompt: with no
    reference image there is nothing to anchor to, so the product's title
    and highlight are spelled out instead.
    """
    if text_only:
        parts: list[str] = []
        style_words = (preset or {}).get("prompt_template") or "modern clean product photography"
        parts.append(style_words.strip())
        if product:
            bits = [p for p in (product.get("title"), product.get("highlight")) if p]
            parts.append(f"Product: {' — '.join(str(b) for b in bits)}")
        dna = (profile or {}).get("design_dna_md")
        if dna:
            parts.append(f"Brand identity: {str(dna).strip()[:800]}")
        if revision_feedback:
            parts.append(f"Apply this revision feedback: {str(revision_feedback).strip()[:400]}")
        parts.append(_IMAGE_GUARDRAIL)
        return "\n".join(parts)

    # Edit prompt: the reference photo defines the product. Preset text is
    # explicitly scoped to the background because templates name a generic
    # subject ("a fruity drink bottle") that the model otherwise obeys.
    style_words = (preset or {}).get("prompt_template") or "modern clean product photography"
    parts = [f"{SCENE_PREFIX}{style_words.strip()}"]

    dna = (profile or {}).get("design_dna_md")
    if dna:
        parts.append(
            f"Palette and mood for the setting only (never render as text): "
            f"{str(dna).strip()[:400]}"
        )

    if revision_feedback:
        parts.append(
            "Requested change (setting, lighting and framing only; the "
            f"product itself must not change): {str(revision_feedback).strip()[:400]}"
        )

    parts.append(_IMAGE_GUARDRAIL)
    return "\n".join(parts)
