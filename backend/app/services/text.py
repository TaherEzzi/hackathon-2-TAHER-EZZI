"""Text generation (captions + hashtags + tone) via OpenRouter free models.

Provider ladder:
1. OpenRouter `:free` chat model (default llama-3.3-70b-instruct:free,
   ~50 free requests/day per account).
2. Fallback: xAI Grok (key already present in `.env`) so a demo never dies
   when the free OpenRouter quota is drained.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Dict, List, Optional, Tuple

import requests

from ..config import config

log = logging.getLogger(__name__)

TIMEOUT_SECS = 60


class TextGenerationError(RuntimeError):
    """All text providers failed (or none configured)."""


def _chat(base_url: str, key: str, model: str, system: str, user: str) -> str:
    resp = requests.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            # Why this value: balanced variety without chaos; a couple of
            # free models ignore temperature, which is acceptable.
            "temperature": 0.7,
        },
        timeout=TIMEOUT_SECS,
    )
    resp.raise_for_status()
    body = resp.json()
    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError(f"{model} returned no choices")
    return str(((choices[0] or {}).get("message") or {}).get("content") or "")


_CAPTION_SYSTEM = (
    "You are a short-form social media copywriter for small D2C Instagram brands. "
    "Always respond with STRICT JSON only, no markdown fences, shaped as: "
    '{"caption": "<1-3 punchy sentences, <=300 chars, marketing tone but natural>", '
    '"hashtags": ["#...", "..."]} '
    "Rules: 8-15 hashtags, no spaces inside a hashtag, include the product category "
    "tag and 3 niche tags, never mention that AI generated anything, no emojis beyond 3."
)


def _parse_content(content: str) -> Tuple[str, List[str]]:
    """Extract caption + hashtags, tolerating ```json fences and stray prose.

    Why tolerant: small free models love padding JSON with chatter and
    strict parsing would waste an already-spent quota call.
    """
    text = content.strip()
    fence = re.search(r"\{.*\}", text, re.DOTALL)
    if fence:
        text = fence.group(0)
    data: Dict = json.loads(text)
    caption = str(data.get("caption") or "").strip()
    tags = data.get("hashtags") or []
    cleaned: List[str] = []
    for t in tags:
        tag = re.sub(r"[^#\w]", "", str(t))
        if not tag.startswith("#") and tag:
            tag = f"#{tag}"
        if tag and tag not in cleaned:
            cleaned.append(tag)
    if not caption:
        raise ValueError("model returned empty caption")
    return caption, cleaned[:15]


def generate_caption(
    preset: Optional[Dict], product: Optional[Dict], profile: Optional[Dict],
    revision_feedback: Optional[str] = None,
) -> Tuple[str, List[str]]:
    """Return (caption, hashtags). Same inputs as build_image_prompt so a
    post's image and copy stay tone-consistent."""
    preset_name = (preset or {}).get("name") or "clean modern"
    preset_desc = (preset or {}).get("description") or (preset or {}).get("prompt_template") or ""
    product_bits = ", ".join(str(x) for x in [
        (product or {}).get("title"), (product or {}).get("highlight"), (product or {}).get("price"),
    ] if x)
    brand = (profile or {}).get("brand_name") or "the brand"
    dna = (profile or {}).get("design_dna_md") or ""
    dna_snip = str(dna).strip()[:600]

    user = (
        f"Brand: {brand}\nStyle template: {preset_name} — {str(preset_desc)[:600]}\n"
        f"Product: {product_bits or 'hero product'}\nBrand DNA: {dna_snip}\n"
        + (f"STRICT revision to apply to the caption/image story: {revision_feedback}\n" if revision_feedback else "")
        + "Write the Instagram post copy now as strict JSON."
    )

    errors: List[str] = []
    if config.openrouter_api_key:
        try:
            content = _chat(
                "https://openrouter.ai/api/v1", config.openrouter_api_key,
                config.openrouter_text_model, _CAPTION_SYSTEM, user,
            )
            return _parse_content(content)
        except Exception as exc:  # noqa: BLE001 — ladder semantics, log and fall through
            log.warning("OpenRouter caption failed: %s", exc)
            errors.append(f"openrouter: {exc}")
    else:
        errors.append("openrouter: not configured")

    if config.grok_api_key:
        try:
            content = _chat(
                "https://api.x.ai/v1", config.grok_api_key,
                config.grok_model, _CAPTION_SYSTEM, user,
            )
            return _parse_content(content)
        except Exception as exc:  # noqa: BLE001
            log.warning("Grok caption fallback failed: %s", exc)
            errors.append(f"grok: {exc}")
    else:
        errors.append("grok: not configured")

    raise TextGenerationError("; ".join(errors))
