"""APScheduler cadence worker.

Runs as an AsyncIOScheduler job (executes on the uvicorn event loop, so it
can send Telegram messages directly). Every minute it:

1. For each ACTIVE schedule + its profile, computes TODAY's due slots from
   `schedule.delivery_times` (time[]) interpreted in the profile's timezone.
2. Slot eligibility depends on `schedule.frequency`:
       weekly        → Mondays only, in the profile's local week
       thrice_weekly → Mon / Wed / Fri, first delivery time
       daily         → all delivery times
       twice_daily   → first two delivery times
       five_daily    → first five delivery times
3. Tier cap guard: posts created today (excluding failed) < TIER_DAILY_CAP.
4. Idempotency: skip when a `post` row already exists for
   (profile_id, slot_date, slot_index).
5. Missing product / no theme pick → INSERT a `status='failed'` row and
   log — a bad profile never crashes the tick or wedges other profiles.

Kept deliberately simple and well-commented: user-config realism is the
hackathon priority, not catch-up heuristics.
"""
from __future__ import annotations

import logging
import asyncio
from datetime import date, datetime
from typing import Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from . import db
from .bot import handlers as bot_handlers
from .bot import tasks as bot_tasks
from .services import quotas

log = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")

# Which backend weekday indexes are eligible per frequency (Mon=0).
_WEEKDAYS: Dict[str, List[int]] = {
    "weekly": [0],
    "thrice_weekly": [0, 2, 4],
    "daily": [0, 1, 2, 3, 4, 5, 6],
    "twice_daily": [0, 1, 2, 3, 4, 5, 6],
    "five_daily": [0, 1, 2, 3, 4, 5, 6],
}

# How many of the day's delivery_times to use per frequency.
_TIMES_PER_DAY: Dict[str, Optional[int]] = {
    "weekly": 1,
    "thrice_weekly": 1,
    "daily": None,        # all
    "twice_daily": 2,
    "five_daily": 5,
}


def _today_slots(profile: Dict, schedule: Dict, today_local: date) -> List[Tuple[str, int]]:
    """(hh:mm, slot_index) pairs that conceptually exist today."""
    freq = schedule.get("frequency") or "daily"
    if isinstance(schedule.get("delivery_times"), list):
        raw = sorted(str(t)[:5] for t in schedule["delivery_times"])
    else:
        raw = ["09:00"]  # schema default {09:00,18:00}; belt-and-braces fallback
    if not raw:
        return []
    n = _TIMES_PER_DAY.get(freq, 1)
    times = raw if n is None else raw[: n or 1]
    if freq in _WEEKDAYS and today_local.weekday() not in _WEEKDAYS[freq]:
        return []
    return [(t, times.index(t)) for t in times]


def _tz_now(profile: Dict) -> datetime:
    tzname = profile.get("timezone") or "Asia/Kolkata"
    try:
        return datetime.now(ZoneInfo(str(tzname)))
    except Exception:  # noqa: BLE001 — bad tz string must not kill the tick
        log.warning("bad timezone %r for profile %s; using UTC", tzname, profile.get("id"))
        return datetime.now().astimezone()


def _get_bot():
    """The PTB Bot handle registered by app.main's lifespan. Raises when
    TELEGRAM_BOT_TOKEN is absent so the tick logs and moves on (REST API
    stays healthy)."""
    from .state import runtime
    if runtime.bot is None:
        raise RuntimeError("telegram bot not started (no TELEGRAM_BOT_TOKEN)")
    return runtime.bot


async def run_due_check() -> None:
    """One scheduler tick. Never raises — the timer must survive individual
    profile failures through the whole hackathon."""
    try:
        rows = db.active_schedules()
    except Exception:  # noqa: BLE001
        log.exception("scheduler tick: could not read schedules")
        return
    for row in rows:
        schedule, profile = row["schedule"], row["profile"]
        try:
            await _process_profile(schedule, profile)
        except Exception:  # noqa: BLE001
            log.exception("scheduler tick failed for profile %s", profile.get("id"))


async def _process_profile(schedule: Dict, profile: Dict) -> None:
    profile_id = profile["id"]
    now_local = _tz_now(profile)
    today = now_local.date()

    for hhmm, slot_idx in _today_slots(profile, schedule, today):
        hour, minute = int(hhmm[:2]), int(hhmm[3:5])
        if (now_local.hour, now_local.minute) < (hour, minute):
            continue  # not due yet today

        if db.post_exists_for_slot(profile_id, today.isoformat(), slot_idx):
            continue  # row already created earlier today (success OR failed)

        # Tier cap: don't burst past the plan's daily ceiling.
        if db.count_posts_today(profile_id, today.isoformat()) >= quotas.daily_cap(profile.get("tier")):
            log.info("tier cap reached for profile %s today; skipping slot %s", profile_id, hhmm)
            continue

        # Honor /skip: newest event today being a skipped row pauses the
        # rest of the day (also covers slots that were never generated).
        if db.latest_event_is_skip(profile_id, today.isoformat()):
            continue

        # Viability pre-check (product + preset) so a bad profile gets a
        # `failed` row instead of burning image-provider quota. Idempotency
        # comes from post_exists_for_slot above + the INSERT inside
        # generate_post; the failed row below is the marker of an attempted slot.
        linking = db.select("tg_link", {"profile_id": profile_id})
        try:
            preset = bot_tasks.pick_preset(profile, None)
            product = bot_tasks.pick_product(profile)
            if preset is None or product is None:
                raise bot_tasks.SlotNotViable(
                    f"profile {profile_id}: preset={'ok' if preset else 'none'}, product={'ok' if product else 'none'}"
                )
        except bot_tasks.SlotNotViable as exc:
            log.warning("slot %s not viable → marked failed: %s", hhmm, exc)
            db.insert_failed_slot(
                profile_id,
                preset["id"] if preset else None,
                product["id"] if product else None,
                today.isoformat(),
                slot_idx,
            )
            continue

        # 2. Generate (sync provider ladder) off the event loop.
        try:
            payload = await asyncio.to_thread(
                bot_tasks.generate_post, profile, None, None, None, today, slot_idx,
            )
        except Exception as exc:  # noqa: BLE001 — provider ladder exhausted
            log.exception("generation failed for profile %s slot %s", profile_id, hhmm)
            db.insert_failed_slot(profile_id, preset["id"], product["id"], today.isoformat(), slot_idx)
            continue

        # 3. Deliver to the linked Telegram chat (if any).
        if linking and linking[0].get("chat_id"):
            try:
                bot = _get_bot()
                await bot_handlers.send_post(bot, linking[0]["chat_id"], payload)
            except Exception:  # noqa: BLE001 — delivery failure ≠ generation failure
                log.exception("telegram delivery failed for post %s", payload.post_id)
        else:
            log.info("post %s generated but profile %s has no linked telegram chat",
                     payload.post_id, profile_id)


def start() -> None:
    """Schedule the per-minute due-slot check; idempotent start."""
    if scheduler.get_jobs():
        return
    scheduler.add_job(
        run_due_check,
        CronTrigger(minute="*"),  # every minute: delivery_times are minute-granular
        id="due_slots_scan",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=30,
    )
    scheduler.start()
    log.info("APScheduler started (due-slot scan every minute)")


def stop() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("APScheduler stopped")
