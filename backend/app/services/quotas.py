"""Tier quotas — single source of truth for budgets and caps.

M mirrored to plan_tier values in the DB ('streak','boost','surge').
"""
from __future__ import annotations

from typing import Dict

# Per-post alteration budget: how many ✏️ edits are free per post.
# Force alternations beyond budget are refused in the bot.
TIER_ALTERATION_BUDGET: Dict[str, int] = {
    "streak": 2,
    "boost": 4,
    "surge": 6,
}

# Daily generation cap per tier (upper bound regardless of schedule
# frequency): streak 1/day, boost 1/day, surge 5/day.
TIER_DAILY_CAP: Dict[str, int] = {
    "streak": 1,
    "boost": 1,
    "surge": 5,
}

DEFAULT_TIER = "streak"


def alteration_budget(tier: str | None) -> int:
    return TIER_ALTERATION_BUDGET.get((tier or DEFAULT_TIER).lower(), TIER_ALTERATION_BUDGET[DEFAULT_TIER])


def daily_cap(tier: str | None) -> int:
    return TIER_DAILY_CAP.get((tier or DEFAULT_TIER).lower(), TIER_DAILY_CAP[DEFAULT_TIER])
