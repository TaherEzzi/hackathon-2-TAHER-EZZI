"""BreezePost FastAPI application.

Exposes the minimal REST surface the Next.js web app consumes:
  GET  /health
  POST /onboarding          (update profile fields)
  POST /onboarding/schedule (upsert posting cadence)
  GET  /me                  (profile + schedule + presets + telegram link)
  GET  /posts               (recent posts for the pipeline dashboard)
  POST /pairing/telegram    (create a tg_link pairing code)

Auth model: the web app sends its user's Supabase JWT as
`Authorization: Bearer <token>`; we verify with Supabase auth and map the
auth uid → profiles.id (schema: profiles.id == auth.uid()).

On startup the same process also runs the Telegram bot (polling) and the
APScheduler cadence worker, per the single-box hackathon topology.
"""
from __future__ import annotations

import logging
import secrets
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import db, scheduler
from .bot import handlers as bot_handlers
from .config import config
from .state import runtime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)

# ── Request/response models ──────────────────────────────────────────────

class OnboardingPayload(BaseModel):
    brand_name: Optional[str] = None
    category: Optional[str] = None  # user_category enum value
    design_dna_md: Optional[str] = None
    timezone: Optional[str] = None
    # Why optional onboarding_step: lets the web app advance the wizard
    # through the exact same endpoint instead of a dedicated one.
    onboarding_step: Optional[int] = None

class SchedulePayload(BaseModel):
    frequency: str  # post_frequency enum value
    delivery_times: Optional[List[str]] = None  # ["09:00","18:00"]
    active: bool = True

class MeResponse(BaseModel):
    profile: Dict[str, Any]
    schedule: Optional[Dict[str, Any]] = None
    telegram_link: Optional[Dict[str, Any]] = None

class HealthResponse(BaseModel):
    status: str
    supabase: bool
    telegram_bot: bool
    scheduler: bool


# ── Auth helper ──────────────────────────────────────────────────────────

def _profile_from_auth(authorization: str | None) -> Dict[str, Any]:
    """Bearer Supabase JWT → verified user → profile row.

    Why verify instead of trusting a client-sent profile_id: profiles.id ==
    auth.uid() and the REST surface can then assume tenant safety.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Authorization: Bearer <supabase JWT> required")
    token = authorization.split(" ", 1)[1].strip()
    try:
        user = db.client().auth.get_user(token).user
    except Exception as exc:  # noqa: BLE001 — auth failures are 401, not 500
        raise HTTPException(401, f"Invalid token: {exc}") from exc
    if user is None:
        raise HTTPException(401, "Invalid token")
    profile = db.get_profile(str(user.id))
    if not profile:
        # First login: the web app (or trigger) may not have created the
        # row yet — create it so the onboarding write below has a target.
        profile = db.insert("profiles", {
            "id": user.id,
            "email": user.email or "",
            "brand_name": user.email.split("@")[0] if user.email else "",
        })
        if not profile:  # racing insert: refetch
            profile = db.get_profile(str(user.id))
    return profile


# ── Lifespan: bot + scheduler share the uvicorn loop ─────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    runtime.sb = db.client()
    telegram_app = None
    if config.telegram_bot_token:
        telegram_app = bot_handlers.make_application(config.telegram_bot_token)
        await bot_handlers.start_polling(telegram_app)
        log.info("Telegram bot started (polling=%s)", config.telegram_polling)
    else:
        # Deliberate, loud, non-fatal: bot pending @BotFather token.
        log.warning(
            "TELEGRAM_BOT_TOKEN missing — REST API + scheduler running, "
            "bot generation/delivery disabled until a token is provided."
        )
    runtime.bot = telegram_app.bot if telegram_app else None
    scheduler.start()
    try:
        yield
    finally:
        scheduler.stop()
        if telegram_app:
            await bot_handlers.stop_polling(telegram_app)


# ── App ──────────────────────────────────────────────────────────────────

app = FastAPI(title="BreezePost Backend", version="0.1.0", lifespan=lifespan)

# Permissive CORS: Expo-class dev deployments hit this from localhost + LAN.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ───────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness probe: process is up; dependency status is best-effort.
    Never throw even if Supabase is down (PowerTraders demo discipline)."""
    supabase_ok = False
    try:
        db.client().table("profiles").select("id", count="exact").limit(1).execute()
        supabase_ok = True
    except Exception as exc:  # noqa: BLE001
        log.warning("health: supabase ping failed: %s", exc)
    return HealthResponse(
        status="ok" if supabase_ok else "degraded",
        supabase=supabase_ok,
        telegram_bot=config.telegram_bot_token is not None and runtime.bot is not None,
        scheduler=scheduler.scheduler.running,
    )


@app.post("/onboarding", response_model=MeResponse)
async def onboarding(
    payload: OnboardingPayload,
    authorization: str | None = Header(default=None),
) -> MeResponse:
    """Update profile fields (step 2 form) and derive onboarding_step."""
    profile = _profile_from_auth(authorization)
    patch: Dict[str, Any] = {
        k: v for k, v in payload.model_dump(exclude_none=True).items()
    }
    patch.setdefault("onboarding_step", max(int(profile.get("onboarding_step") or 0), 2))
    db.update("profiles", {"id": profile["id"]}, patch)
    return await me(authorization)  # type: ignore[arg-type]


@app.post("/onboarding/schedule", response_model=MeResponse)
async def onboarding_schedule(
    payload: SchedulePayload,
    authorization: str | None = Header(default=None),
) -> MeResponse:
    profile = _profile_from_auth(authorization)
    row: Dict[str, Any] = {
        "profile_id": profile["id"],
        "frequency": payload.frequency,
        "delivery_times": payload.delivery_times or ["09:00", "18:00"],
        "active": payload.active,
    }
    # Current times must be a valid `time[]` literal upstream; hackathon
    # inputs from the picker are always plain HH:MM strings.
    db.upsert("schedule", row, on_conflict="profile_id")
    return await me(authorization)  # type: ignore[arg-type]


@app.get("/me", response_model=MeResponse)
async def me(authorization: str | None = Header(default=None)) -> MeResponse:
    profile = _profile_from_auth(authorization)
    tg = db.select("tg_link", {"profile_id": profile["id"]})
    return MeResponse(
        profile=profile,
        schedule=db.get_schedule(profile["id"]),
        telegram_link=tg[0] if tg else None,
    )


@app.get("/posts")
async def posts(
    limit: int = 20,
    authorization: str | None = Header(default=None),
) -> Dict[str, Any]:
    """Pipeline dashboard rows (newest first), with public image URLs."""
    profile = _profile_from_auth(authorization)
    rows = (
        db.client()
        .table("post")
        .select("*")
        .eq("profile_id", profile["id"])
        .order("created_at", desc=True)
        .limit(min(limit, 100))
        .execute()
    ).data or []
    from .services import storage as storage_svc
    for row in rows:
        row["image_url"] = (
            storage_svc.public_url(config.bucket_generated_posts, row["image_path"])
            if row.get("image_path") else None
        )
    return {"posts": rows}


@app.post("/pairing/telegram")
async def pairing_telegram(authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    """Create (or reuse) a pairing code row so the Telegram bot can link.

    /generate a fresh 8-char code every call; the bot matches on it and
    stamps chat_id once, so a stale code simply never links.
    """
    profile = _profile_from_auth(authorization)
    code = secrets.token_hex(4).upper()  # 8 chars, human-typable
    if db.select("tg_link", {"profile_id": profile["id"]}):
        # Row exists: rotate the code only, so an already-linked chat keeps
        # its chat_id/telegram_user_id (a bare upsert would null those).
        db.update("tg_link", {"profile_id": profile["id"]}, {"pairing_code": code})
    else:
        db.insert("tg_link", {"profile_id": profile["id"], "pairing_code": code})
    return {
        "pairing_code": code,
        "bot_username": config.tg_bot_username,
        "deep_link": f"https://t.me/{config.tg_bot_username}?start={code}",
    }
