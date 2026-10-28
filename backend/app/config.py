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


class Config:
    """Plain (non-pydantic) settings holder; only app code touches it."""

    # ── Supabase ──────────────────────────────────────────────────────────
    supabase_url: Optional[str] = _get("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    # Canonical name per spec; `.env`'s lowercase key is a fallback.
    supabase_secret_key: Optional[str] = _get(
        "SUPABASE_SECRET_KEY", "supabase_secret_key", "SUPABASE_SERVICE_ROLE_KEY",
    )

    # ── Cloudflare Workers AI (primary image provider, FLUX.1-schnell) ───
    cloudflare_api_token: Optional[str] = _get("CLOUDFLARE_API_TOKEN")
    cloudflare_account_id: Optional[str] = _get("CLOUDFLARE_ACCOUNT_ID")

    # ── OpenRouter (text captions + quality image fallback) ──────────────
    openrouter_api_key: Optional[str] = _get("OPENROUTER_API_KEY")
    openrouter_text_model: str = _get("OPENROUTER_TEXT_MODEL", default="nvidia/nemotron-3.5-super-vl:free") or ""
    # Comma-separated ladder of extra free models tried when the primary is
    # rate-limited (upstream :free pools are shared and frequently 429).
    openrouter_fallback_models: str = _get(
        "OPENROUTER_FALLBACK_MODELS",
        default="nvidia/nemotron-3.5-lightning:free,dots-studio/dots-3-note-preview:free,poolside/laguna-s-2.1:free,google/gemma-4-31b-it:free",
    ) or ""
    openrouter_image_model: str = _get("OPENROUTER_IMAGE_MODEL", default="google/gemini-2.5-flash-image") or ""

    # ── Optional xAI fallback for captions (key already in .env) ────────
    grok_api_key: Optional[str] = _get("GROK_API_KEY", "grok_api_key")
    grok_model: str = _get("GROK_MODEL", default="grok-3-mini") or ""

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
        return bool(self.openrouter_api_key or self.grok_api_key)

    def require(self, *attrs: str) -> None:
        missing = [a for a in attrs if not getattr(self, a, None)]
        if missing:
            raise RuntimeError(f"Missing required configuration: {', '.join(missing)}")


config = Config()
