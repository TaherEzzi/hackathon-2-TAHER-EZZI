#!/usr/bin/env python
"""BreezePost backend self-test — pings each live service and prints PASS/FAIL.

Run from the backend directory:
    python scripts/selftest.py

Safe to run without TELEGRAM_BOT_TOKEN or OPENROUTER_API_KEY: those report
as SKIP (missing config), not FAIL. No secrets are ever printed — only
service names and status.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Allow `python scripts/selftest.py` from backend/ (the app package lives there).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import config          # noqa: E402  (env loaded on import)
import requests                        # noqa: E402

RESULTS: list[tuple[str, str, str]] = []  # (service, status, detail)


def record(service: str, ok: bool | None, detail: str = "") -> None:
    status = {True: "PASS", False: "FAIL", None: "SKIP"}[ok]
    RESULTS.append((service, status, detail))
    print(f"[{status:4}] {service:20} {detail}")


def main() -> int:
    print("BreezePost backend self-test\n" + "-" * 60)

    # 1. Supabase (REST + Storage)
    if config.is_supabase_configured:
        try:
            from supabase import create_client
            sb = create_client(config.supabase_url, config.supabase_secret_key)
            sb.table("profiles").select("id", count="exact").limit(1).execute()
            buckets = {b.name for b in sb.storage.list_buckets() or []}
            needing = {config.bucket_product_images, config.bucket_generated_posts}
            missing = needing - buckets
            record("supabase db", True, "auth ok")
            record(
                "supabase storage",
                not missing,
                f"buckets present: {sorted(needing - missing)}" + (f" missing: {sorted(missing)}" if missing else ""),
            )
        except Exception as exc:  # noqa: BLE001
            record("supabase", False, str(exc)[:160])
    else:
        record("supabase", None, "SUPABASE_URL / SUPABASE_SECRET_KEY not configured")

    # 2. Cloudflare Workers AI FLUX.1-schnell (account id from env)
    if config.is_image_primary_configured:
        try:
            resp = requests.post(
                "https://api.cloudflare.com/client/v4/accounts/"
                f"{config.cloudflare_account_id}/ai/run/@cf/black-forest-labs/flux-1-schnell",
                headers={"Authorization": f"Bearer {config.cloudflare_api_token}",
                         "Content-Type": "application/json"},
                # Cheap probe: 4 steps at the model's default size. The prompt
                # is one we verified renders cleanly; FLUX's NSFW guard
                # false-positives on some innocuous prompts (e.g. "coffee"),
                # so keep the probe prompt conservative.
                json={"prompt": "luxury wristwatch on black slate, macro hero shot, "
                                "single hard beam of light, dark moody background, ultra realistic, "
                                "no text, no watermark",
                      "steps": 4},
                timeout=60,
            )
            resp.raise_for_status()
            body = resp.json()
            has_img = bool((body.get("result") or {}).get("image"))
            record("cloudflare flux", body.get("success") is True and has_img,
                   f"status={resp.status_code}, image={'yes' if has_img else 'no'} base64")
        except Exception as exc:  # noqa: BLE001
            record("cloudflare flux", False, str(exc)[:160])
    else:
        record("cloudflare flux", None, "CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not configured")

    # 3. OpenRouter text captions
    if config.openrouter_api_key:
        try:
            resp = requests.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {config.openrouter_api_key}"},
                timeout=30,
            )
            resp.raise_for_status()
            record("openrouter", True, "models list reachable (auth ok)")
        except Exception as exc:  # noqa: BLE001
            record("openrouter", False, str(exc)[:160])
    else:
        record("openrouter", None, "OPENROUTER_API_KEY not set (captions will 503 until added)")

    # 4. Telegram bot
    if config.telegram_bot_token:
        try:
            resp = requests.get(
                f"{config.telegram_files_base_url}/bot{config.telegram_bot_token}/getMe",
                timeout=20,
            )
            resp.raise_for_status()
            bot_name = resp.json().get("result", {}).get("username", "?")
            record("telegram", True, f"@{bot_name} reachable")
        except Exception as exc:  # noqa: BLE001
            record("telegram", False, str(exc)[:160])
    else:
        record("telegram", None, "TELEGRAM_BOT_TOKEN pending from @BotFather (bot starts/fails gracefully)")

    # 5. Instagram publishing credentials
    if config.publish_mode == "mock":
        record("instagram", None, "PUBLISH_MODE=mock (no network call; fake media id)")
    elif config.ig_access_token and config.ig_user_id:
        try:
            resp = requests.get(
                f"https://graph.instagram.com/{config.ig_api_version}/{config.ig_user_id}",
                params={"fields": "id,username", "access_token": config.ig_access_token},
                timeout=20,
            )
            resp.raise_for_status()
            who = resp.json().get("username", "?")
            record("instagram", True, f"token valid for @{who}")
        except Exception as exc:  # noqa: BLE001
            record("instagram", False, str(exc)[:160])
    else:
        record("instagram", False, "PUBLISH_MODE=real but IG_ACCESS_TOKEN/IG_USER_ID missing")

    print("-" * 60)
    fails = sum(1 for _, s, _ in RESULTS if s == "FAIL")
    print(f"{len(RESULTS) - fails}/{len(RESULTS)} services usable ({fails} failed, "
          f"{sum(1 for _, s, _ in RESULTS if s == 'SKIP')} skipped)")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
