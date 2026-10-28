"""Image generation via the provider ladder (failover top-to-bottom):

1. PRIMARY  — Cloudflare Workers AI `@cf/black-forest-labs/flux-1-schnell`
              (verified: ~3.6s per 512px square, base64 JPEG result).
2. FALLBACK — OpenRouter `google/gemini-2.5-flash-image` (chat completions
              with modalities ["image","text"]). Gracefully unavailable when
              the account has no credits.

All functions are synchronous (requests) on purpose: FastAPI handlers and
PTB handlers run them inside a worker thread (`asyncio.to_thread`) so a
slow provider call never blocks the event loop.
"""
from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from typing import Dict, Optional

import requests

from ..config import config

log = logging.getLogger(__name__)

CLOUDFLARE_FLUX_MODEL = "@cf/black-forest-labs/flux-1-schnell"
CLOUDFLARE_KLEIN_MODEL = "@cf/black-forest-labs/flux-2-klein-4b"
DEFAULT_TIMEOUT_SECS = 90
# klein-4b render took ~20s in the verified test; give it generous headroom.
KLEIN_TIMEOUT_SECS = 240
# Identity guardrail: klein-4b is a full re-renderer — without this it invents
# a similar-but-different product (verified in the one test fire). The phrase
# leads every edit prompt so the label artwork/typefaces survive.
IDENTITY_GUARDRAIL = (
    "Preserve the source product EXACTLY: same shape, same colors, same "
    "materials, and the same label text and artwork. Do not redesign or "
    "replace the product. Only transform the setting, lighting and camera "
    "framing around it."
)


class GenerationError(RuntimeError):
    """Raised when every provider in the ladder fails — callers mark the
    slot/post failed rather than retrying forever."""


@dataclass
class ImageResult:
    jpeg_bytes: bytes
    provider: str


def _cloudflare_flux(prompt: str, width: int) -> ImageResult:
    url = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{config.cloudflare_account_id}/ai/run/{CLOUDFLARE_FLUX_MODEL}"
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
                "Authorization": f"Bearer {config.cloudflare_api_token}",
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


def _openrouter_gemini_image(prompt: str, width: int) -> ImageResult:
    """Quality fallback. The account may simply have no credits — that is
    surfaced as a normal exception, never a crash."""
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {config.openrouter_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": config.openrouter_image_model,
            "modalities": ["image", "text"],
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=DEFAULT_TIMEOUT_SECS,
    )
    resp.raise_for_status()
    body = resp.json()
    choices = body.get("choices") or []
    message = (choices[0] or {}).get("message") or {}
    images = message.get("images") or []
    url = (((images[0] or {}).get("image_url") or {}).get("url")) if images else None
    if not url or ";base64," not in url:
        raise RuntimeError("OpenRouter image response had no inline image")
    b64 = url.split(";base64,", 1)[1]
    return ImageResult(base64.b64decode(b64), provider="openrouter-gemini-image")


def _cloudflare_klein_edit(image_bytes: bytes, prompt: str) -> ImageResult:
    """Image-to-image via flux-2-klein-4b (multipart: image file + prompt).

    Billing: ~125 neurons per 1024² render (~80/day inside the free
    10,000-neuron daily allocation) — no paid credits required.
    """
    url = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{config.cloudflare_account_id}/ai/run/{CLOUDFLARE_KLEIN_MODEL}"
    )
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {config.cloudflare_api_token}"},
        files={"image": ("product.jpg", image_bytes, "image/jpeg")},
        data={"prompt": f"{IDENTITY_GUARDRAIL} {prompt}"},
        timeout=KLEIN_TIMEOUT_SECS,
    )
    resp.raise_for_status()
    body = resp.json()
    if not body.get("success"):
        raise RuntimeError(f"Cloudflare klein error: {body.get('errors')}")
    image_b64 = (body.get("result") or {}).get("image")
    if not image_b64:
        raise RuntimeError("Cloudflare klein response had no image")
    return ImageResult(base64.b64decode(image_b64), provider="cloudflare-flux-2-klein-4b")


def generate_image_edit(
    image_bytes: Optional[bytes], prompt: str, size: int = 512
) -> ImageResult:
    """Product-anchored ladder: klein img2img when we have the product photo,
    otherwise (or on failure) drop to the text-only ladder so the flow never
    dies — a styled render beats no render at all.
    """
    attempts = []
    if image_bytes:
        try:
            return _cloudflare_klein_edit(image_bytes, prompt)
        except Exception as exc:  # noqa: BLE001 — record every provider failure
            log.warning("Cloudflare klein img2img failed: %s", exc)
            attempts.append(f"klein-img2img: {exc}")
    else:
        attempts.append("klein-img2img: no product photo (falling to text-only)")
    try:
        return generate_image(prompt, size=size)
    except Exception as exc:  # noqa: BLE001 — record every provider failure
        attempts.append(f"text-only: {exc}")
    raise GenerationError("; ".join(attempts))


def generate_image(prompt: str, size: int = 512) -> ImageResult:
    """Run the ladder. size in px per side (512 fast default, 1024 hero).

    Ladder semantics: try in order; on any failure log and continue to the
    next provider. Only exhausted ladder raises GenerationError.
    """
    attempts = []
    if config.is_image_primary_configured:
        try:
            return _cloudflare_flux(prompt, width=min(size, 1024))
        except Exception as exc:  # noqa: BLE001 — picture-in-picture of every provider failure matters
            log.warning("Cloudflare flux failed: %s", exc)
            attempts.append(f"cloudflare: {exc}")
    else:
        attempts.append("cloudflare: not configured")

    if config.openrouter_api_key:
        try:
            return _openrouter_gemini_image(prompt, width=size)
        except Exception as exc:  # noqa: BLE001
            log.warning("OpenRouter image fallback failed (credits?): %s", exc)
            attempts.append(f"openrouter-image: {exc}")
    else:
        attempts.append("openrouter-image: not configured")

    raise GenerationError("; ".join(attempts))


# ── Prompt composition ────────────────────────────────────────────────────

# Guardrail appended to EVERY image prompt. Why: flux has no text control,
# and baked-in gibberish text is the #1 reason a generated ad image is
# unusable for publishing.
_IMAGE_GUARDRAIL = (
    "Square 1:1 composition, single hero product, ultra-realistic, "
    "high-end commercial photography, no text anywhere in the image, "
    "no watermark, no logos."
)


def build_image_prompt(
    preset: Optional[Dict], product: Optional[Dict], profile: Optional[Dict],
    revision_feedback: Optional[str] = None,
) -> str:
    """Compose the final image prompt.

    Per THEME_PRESETS runtime pattern: style words come from the preset's
    `prompt_template`, the product comes from the Asset Locker row,
    and palette/tone DNA from `profiles.design_dna_md`. `revision_feedback`
    (from a Telegram ✏️ request) is appended so the regeneration actually
    changes *this* post rather than a fresh random one.
    """
    parts: list[str] = []
    style_words = (preset or {}).get("prompt_template") or "modern clean product photography"
    parts.append(style_words.strip())

    if product:
        bits = [p for p in (product.get("title"), product.get("highlight")) if p]
        parts.append(f"Product: {' — '.join(str(b) for b in bits)}")

    dna = (profile or {}).get("design_dna_md")
    if dna:
        # Trim long DNA documents to keep payloads inside provider limits.
        parts.append(f"Brand identity: {str(dna).strip()[:800]}")

    if revision_feedback:
        parts.append(f"Apply this revision feedback: {str(revision_feedback).strip()[:400]}")

    parts.append(_IMAGE_GUARDRAIL)
    return "\n".join(parts)
