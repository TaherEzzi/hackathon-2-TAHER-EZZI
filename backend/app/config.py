"""Central configuration.

Values are read from environment variables, loaded from the repo-root `.env`
(and a local `backend/.env` if present) via python-dotenv.

SECURITY: secrets are only ever referenced by name here. They are never
logged, echoed, or written into files.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


def load_env() -> None:
    """Load .env files.

    Why both: the repo-root `.env` is shared with the Next.js frontend,
    while a `backend/.env` allows backend-only overrides during the
    hackathon. Backend-local values win because it is loaded last.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    repo_root = backend_dir.parent
    load_dotenv(repo_root / ".env", override=False)
    load_dotenv(backend_dir / ".env", override=True)


# Load eagerly at import time so every module sees a populated environ.
load_env()


def _get(*names: str, default: Optional[str] = None) -> Optional[str]:
    """First-set env var wins.

    Why fallbacks: `.env` already uses legacy/other-stack names such as
    `supabase_secret_key` and `NEXT_PUBLIC_SUPABASE_URL`; canonical names
    are preferred when present.
    """
    for name in names:
        value = os.getenv(name)
        if value is not None and value != "":
            return value
    return default


def _int_env(name: str, default: int) -> int:
    raw = _get(name)
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


class Config:
    """Plain (non-pydantic) settings holder; only app code touches it."""

    # ── Supabase ──────────────────────────────────────────────────────────
    supabase_url: Optional[str] = _get("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    # Canonical name per spec; `.env`'s lowercase key is a fallback.
    supabase_secret_key: Optional[str] = _get(
        "SUPABASE_SECRET_KEY", "supabase_secret_key", "SUPABASE_SERVICE_ROLE_KEY",
    )

    # ── Cloudflare Workers AI (flux-2-klein for posts, chat model for captions) ──
    cloudflare_api_token: Optional[str] = _get("CLOUDFLARE_API_TOKEN")
    cloudflare_account_id: Optional[str] = _get("CLOUDFLARE_ACCOUNT_ID")

    # Image-edit model. klein-9b follows the reference photo (and renders
    # label lettering) much more faithfully than the 4b distill at the same
    # prompt; 4b stays one request away via CLOUDFLARE_EDIT_MODEL_FALLBACK.
    cloudflare_edit_model: str = _get(
        "CLOUDFLARE_EDIT_MODEL", default="@cf/black-forest-labs/flux-2-klein-4b",
    ) or ""
    cloudflare_edit_model_fallback: str = _get(
        "CLOUDFLARE_EDIT_MODEL_FALLBACK", default="@cf/black-forest-labs/flux-2-klein-4b",
    ) or ""

    # Captions use a Workers AI chat model on the same account as Flux.
    # Flux Klein only returns an image, so it cannot write the caption.
    cloudflare_text_model: str = _get(
        "CLOUDFLARE_TEXT_MODEL", default="@cf/meta/llama-3.1-8b-instruct-fp8",
    ) or ""
    # Tried in order when the primary model is retired or rate-limited.
    # Why: Workers AI replaces models without notice (llama-3.1-8b-instruct
    # was deprecated 2026-05-30 and started returning 410 Gone).
    cloudflare_text_fallbacks: str = _get(
        "CLOUDFLARE_TEXT_FALLBACKS",
        default="@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    ) or ""

    # Rendered post edge in px (square). 512 keeps the free-neuron budget for
    # dev runs; set POST_IMAGE_SIZE=1024 for demo-day quality (TRUTH §8.6).
    post_image_size: int = _int_env("POST_IMAGE_SIZE", 512)

    # ── OpenRouter (unused by generation; kept so an old .env still loads) ─
    openrouter_api_key: Optional[str] = _get("OPENROUTER_API_KEY")
    openrouter_text_model: str = _get("OPENROUTER_TEXT_MODEL", default="nvidia/nemotron-3.5-super-vl:free") or ""
    # Comma-separated ladder of extra free models tried when the primary is
    # rate-limited (upstream :free pools are shared and frequently 429).
    openrouter_fallback_models: str = _get(
        "OPENROUTER_FALLBACK_MODELS",
        default="nvidia/nemotron-3.5-lightning:free,dots-studio/dots-3-note-preview:free,poolside/laguna-s-2.1:free,google/gemma-4-31b-it:free",
    ) or ""
    openrouter_image_model: str = _get("OPENROUTER_IMAGE_MODEL", default="google/gemini-2.5-flash-image") or ""

    # ── Optional Groq fallback for captions (free tier; keys start with gsk_) ─
    # The `.env` stores it as `grok_api_key` — same key, legacy name.
    groq_api_key: Optional[str] = _get("GROQ_API_KEY", "GROK_API_KEY", "grok_api_key")
    groq_base_url: str = _get("GROQ_BASE_URL", default="https://api.groq.com/openai/v1") or ""
    groq_model: str = _get("GROQ_MODEL", default="openai/gpt-oss-120b") or ""

    # ── Telegram ─────────────────────────────────────────────────────────
    # NOT yet provisioned — code must start/fail gracefully without it.
    telegram_bot_token: Optional[str] = _get("TELEGRAM_BOT_TOKEN")
    telegram_polling: bool = (_get("TELEGRAM_POLLING", default="true") or "true").lower() in ("1", "true", "yes")
    tg_bot_username: str = _get("TG_BOT_USERNAME", default="BreezePostBot") or ""

    telegram_files_base_url: str = "https://api.telegram.org"

    # ── Instagram publishing ─────────────────────────────────────────────
    # mock (default): log + fake media id so demos never break.
    # real: two-step Instagram API with Instagram Login publish.
    publish_mode: str = (_get("PUBLISH_MODE", default="mock") or "mock").lower()
    ig_access_token: Optional[str] = _get("IG_ACCESS_TOKEN")
    ig_user_id: Optional[str] = _get("IG_USER_ID")
    ig_api_version: str = _get("IG_API_VERSION", default="v24.0") or ""

    # ── Storage buckets (pre-provisioned in Supabase, public read) ──────
    bucket_product_images: str = "product-images"
    bucket_generated_posts: str = "generated-posts"

    # ── Misc ────────────────────────────────────────────────────────────
    # Fallback timezone when a profile row has none (schema default).
    default_timezone: str = _get("DEFAULT_TIMEZONE", default="Asia/Kolkata") or ""

    @property
    def is_supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_secret_key)

    @property
    def is_image_primary_configured(self) -> bool:
        return bool(self.cloudflare_api_token and self.cloudflare_account_id)

    @property
    def is_text_configured(self) -> bool:
        cloudflare = bool(
            self.cloudflare_api_token and self.cloudflare_account_id and self.cloudflare_text_model
        )
        return cloudflare or bool(self.groq_api_key and self.groq_model)

    def require(self, *attrs: str) -> None:
        missing = [a for a in attrs if not getattr(self, a, None)]
        if missing:
            raise RuntimeError(f"Missing required configuration: {', '.join(missing)}")


config = Config()
