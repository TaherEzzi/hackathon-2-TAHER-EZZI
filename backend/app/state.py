"""Process-wide shared runtime context.

The FastAPI app, the Telegram bot, and the APScheduler all run in one
process for the hackathon. They share a single `Runtime` instance
(config + supabase client + a reference to the PTB `Bot`).
"""
from __future__ import annotations

from typing import Optional

from supabase import Client

from .config import Config, config


class Runtime:
    def __init__(self, cfg: Config, supabase: Client) -> None:
        self.cfg = cfg
        self.sb = supabase
        self.bot = None  # set by app.main lifespan once PTB is initialized


runtime = Runtime(config, None)  # type: ignore[arg-type]
