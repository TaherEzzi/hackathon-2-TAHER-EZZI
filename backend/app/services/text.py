"""Captions and hashtags via Cloudflare Workers AI, with a Groq fallback.

Flux Klein draws the post image. It does not return text, so the caption
uses a chat model on the same Cloudflare account. Workers AI retires models
without notice (`llama-3.1-8b-instruct` 410'd in May 2026), so a second
Cloudflare model and then Groq (free tier, `gsk_…` key) are tried in order.
OpenRouter and xAI are not called: those endpoints 404/400.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Callable, Dict, List, Optional, Tuple

import requests

from ..config import config

log = logging.getLogger(__name__)

TIMEOUT_SECS = 60


class TextGenerationError(RuntimeError):
    """Cloudflare caption request failed, or the account is not configured."""


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
    if not resp.ok:
        # Surface Cloudflare's own message: a retired model answers 410 with
        # "Model has been deprecated", which raise_for_status() hides.
        detail = ""
        try:
            body = resp.json()
        except ValueError:
            body = None
        if isinstance(body, dict):
            detail = "; ".join(
                f"{e.get('code')}: {e.get('message')}" if isinstance(e, dict) else str(e)
                for e in (body.get("errors") or [])
            )
        raise RuntimeError(
            f"HTTP {resp.status_code} — {detail or (resp.text or '').strip()[:300]}"
        )
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
    """Return (caption, hashtags). Raises TextGenerationError when Cloudflare
    is not configured or the caption request fails."""
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

    token = config.cloudflare_api_token
    account_id = config.cloudflare_account_id
    cloudflare_models = [config.cloudflare_text_model] + [
        m.strip() for m in config.cloudflare_text_fallbacks.split(",") if m.strip()
    ]
    providers: List[Tuple[str, Callable[[], str]]] = []
    if token and account_id:
        base_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1"
        for model in dict.fromkeys(m for m in cloudflare_models if m):
            providers.append((
                f"cloudflare[{model}]",
                lambda m=model, b=base_url: _chat(b, token, m, _CAPTION_SYSTEM, user),
            ))
    if config.groq_api_key and config.groq_model:
        providers.append((
            f"groq[{config.groq_model}]",
            lambda: _chat(
                config.groq_base_url, config.groq_api_key or "",
                config.groq_model, _CAPTION_SYSTEM, user,
            ),
        ))
    if not providers:
        raise TextGenerationError(
            "captions: configure CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID or GROQ_API_KEY"
        )

    failures: List[str] = []
    for label, attempt in providers:
        try:
            return _parse_content(attempt())
        except Exception as exc:  # noqa: BLE001 — try the next provider before failing
            log.warning("Caption provider failed (%s): %s", label, exc)
            failures.append(f"{label}: {exc}")
    raise TextGenerationError("caption providers failed: " + " | ".join(failures))
