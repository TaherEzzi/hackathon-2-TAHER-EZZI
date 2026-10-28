"""Supabase Postgres access layer (service-role client, bypasses RLS).

The schema is provisioned and managed elsewhere (web app / SQL console);
this backend only reads and writes rows.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from .config import config

log = logging.getLogger(__name__)

_client: Optional[Client] = None


def client() -> Client:
    """Lazily build the singleton Supabase service-role client.

    Using the SECRET (service-role) key is intentional: the backend is a
    trusted worker and RLS would otherwise block cross-table joins that
    the web app (user JWT) cannot perform.
    """
    global _client
    if _client is None:
        config.require("supabase_url", "supabase_secret_key")
        _client = create_client(config.supabase_url or "", config.supabase_secret_key or "")
    return _client


# ── Row helpers (thin wrappers keep call sites terse and typed) ──────────

def select(table: str, filters: Dict[str, Any], limit: int = 1) -> List[Dict[str, Any]]:
    """NOT-error-tolerant select. Raises for transport/permission errors so
    callers can decide between retry and fail-slot semantics."""
    q = client().table(table).select("*")
    for col, val in filters.items():
        q = q.eq(col, val)
    q = q.limit(limit)
    resp = q.execute()
    return list(resp.data or [])


def select_in(table: str, column: str, values: List[Any]) -> List[Dict[str, Any]]:
    resp = (
        client().table(table).select("*").in_(column, values).execute()
    )
    return list(resp.data or [])


def insert(table: str, row: Dict[str, Any]) -> Dict[str, Any]:
    resp = client().table(table).insert(row).execute()
    return dict(resp.data[0]) if resp.data else {}


def update(table: str, filters: Dict[str, Any], patch: Dict[str, Any]) -> None:
    q = client().table(table).update(patch)
    for col, val in filters.items():
        q = q.eq(col, val)
    q.execute()


def upsert(table: str, row: Dict[str, Any], on_conflict: str) -> None:
    client().table(table).upsert(row, on_conflict=on_conflict).execute()


def get_profile(profile_id: str) -> Optional[Dict[str, Any]]:
    rows = select("profiles", {"id": profile_id})
    return rows[0] if rows else None


def get_schedule(profile_id: str) -> Optional[Dict[str, Any]]:
    rows = select("schedule", {"profile_id": profile_id})
    return rows[0] if rows else None


def active_schedules() -> List[Dict[str, Any]]:
    """All enabled schedules + their profiles for the scheduler tick.

    Two flat queries instead of a SQL join because supabase-py
    convenience queries don't express cross-table joins here.
    """
    schedules = select("schedule", {"active": True}, limit=1000)
    if not schedules:
        return []
    profile_ids = [s["profile_id"] for s in schedules]
    profiles = select_in("profiles", "id", profile_ids)
    by_id = {p["id"]: p for p in profiles}
    out: List[Dict[str, Any]] = []
    for s in schedules:
        profile = by_id.get(s["profile_id"])
        if profile:  # skip orphan schedule rows defensively
            out.append({"schedule": s, "profile": profile})
    return out


def theme_presets_for_categories(category: str) -> List[Dict[str, Any]]:
    return select("theme_preset", {"category": category}, limit=100)


def count_posts_today(profile_id: str, slot_date: str) -> int:
    """Successful/usable posts attempted today — used by tier caps. Failed
    rows are excluded on purpose: a provider flake must not permanently
    burn the tier's daily posting allowance."""
    resp = (
        client()
        .table("post")
        .select("id", count="exact")
        .eq("profile_id", profile_id)
        .eq("slot_date", slot_date)
        .neq("status", "failed")
        .execute()
    )
    return resp.count or 0


def post_exists_for_slot(profile_id: str, slot_date: str, slot_index: int) -> bool:
    """Idempotency: don't create a duplicate row for the same daily slot."""
    resp = (
        client()
        .table("post")
        .select("id", count="exact")
        .eq("profile_id", profile_id)
        .eq("slot_date", slot_date)
        .eq("slot_index", slot_index)
        .execute()
    )
    return (resp.count or 0) > 0


def latest_event_is_skip(profile_id: str, slot_date: str) -> bool:
    """True when the profile's newest post event *today* is a 'skipped' row.

    Why: /skip must also suppress slots that have not been generated yet
    (there is no row to flip). A skip row being the latest event = the user
    paused for the day, so remaining slots do nothing until tomorrow.
    """
    resp = (
        client()
        .table("post")
        .select("status,created_at")
        .eq("profile_id", profile_id)
        .eq("slot_date", slot_date)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = list(resp.data or [])
    return bool(rows) and rows[0].get("status") == "skipped"


def recent_posts(profile_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    resp = (
        client()
        .table("post")
        .select("*")
        .eq("profile_id", profile_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return list(resp.data or [])


def insert_failed_slot(
    profile_id: str, preset_id: Optional[int], product_id: Optional[str],
    slot_date: Optional[str], slot_index: Optional[int],
) -> None:
    """Record an unusable slot (missing product / theme pick) as a failed
    post row instead of crashing the scheduler tick."""
    insert("post", {
        "profile_id": profile_id,
        "status": "failed",
        "preset_id": preset_id,
        "product_id": product_id,
        "slot_date": slot_date,
        "slot_index": slot_index,
        "scheduled_for": None,
        "caption": None,
        "image_path": None,
    })
