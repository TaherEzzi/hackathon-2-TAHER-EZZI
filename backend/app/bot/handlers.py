"""Telegram bot command handlers (python-telegram-bot v21+).

Command surface:
  /start [code]      — start chat; `code` from the ?start=<pairing_code> deep link pairs the chat
  /link <code>       — explicit pairing (same flow as /start <code>)
  /generate [preset#]— on-demand demo generation for a random/specific preset
  /change <feedback> — regenerate the latest post with natural-language feedback
  /post              — publish the latest generated/edited image to Instagram
  /status            — tier, schedule, last 5 posts
  /skip              — skip today's remaining slot
Inline callbacks per post message:
  approve:{post_id} | skip:{post_id} | edit:{post_id}

TELEGRAM_BOT_TOKEN is pending at scaffold time — `start_polling` raises a
clean ConfigurationError that app.main catches and logs without crashing
the REST API.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from telegram import Bot, BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application, ApplicationBuilder, CallbackQueryHandler, CommandHandler,
    ContextTypes, MessageHandler, filters,
)

from .. import db
from ..config import config
from ..services import instagram, quotas, storage
from . import tasks
from .tasks import SlotNotViable

log = logging.getLogger(__name__)


def keyboard_for(post_id: str) -> InlineKeyboardMarkup:
    pid = str(post_id)
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Approve & Post", callback_data=f"approve:{pid}"),
        InlineKeyboardButton("✏️ Request Edit", callback_data=f"edit:{pid}"),
        InlineKeyboardButton("⏭️ Skip Today", callback_data=f"skip:{pid}"),
    ]])


# ── Profile resolution ───────────────────────────────────────────────────

def _linked_profile(chat_id: int) -> Optional[Dict[str, Any]]:
    """chat → tg_link → profile, or None if the chat is not yet linked."""
    links = db.select("tg_link", {"chat_id": chat_id})
    if not links:
        return None
    return db.get_profile(links[0]["profile_id"])


# ── Delivery helper ──────────────────────────────────────────────────────

async def send_post(bot: Bot, chat_id: int, payload: tasks.PostPayload) -> None:
    """Photo + caption + the 1-tap action keyboard. Image is fetched from
    the public `generated-posts` URL, so no local file handling needed."""
    await bot.send_photo(
        chat_id=chat_id,
        photo=payload.image_url,
        caption=(payload.chat_text or "")[:1024],  # Telegram caption limit
        reply_markup=keyboard_for(payload.post_id),
    )


def _latest_actionable_post(profile_id: str) -> Optional[Dict[str, Any]]:
    """Newest post that /change and /post can act on: still awaiting review
    and carrying a rendered image."""
    for post in db.recent_posts(profile_id, limit=10):
        if post.get("status") == "awaiting_review" and post.get("image_path"):
            return post
    return None


def _publish_post_row(post: Dict[str, Any]) -> Tuple[str, str]:
    """Publish one stored post → (ig_media_id, mode)."""
    image_url = storage.public_url(config.bucket_generated_posts, post["image_path"])
    return instagram.publish(image_url, post.get("caption") or "", post.get("hashtags"))


def _mark_published(post_id: str, media_id: str) -> None:
    db.update("post", {"id": post_id}, {
        "status": "published",
        "ig_media_id": media_id,
        "published_at": datetime.now(timezone.utc).isoformat(),
    })


async def _revise_post(
    update: Update, context: ContextTypes.DEFAULT_TYPE,
    post: Dict[str, Any], feedback: str,
) -> None:
    """Regenerate image + caption for `post` from natural-language feedback,
    enforcing the tier's per-post alteration budget."""
    profile = db.get_profile(post["profile_id"])
    if not profile:
        await update.effective_message.reply_text("⚠️ That post no longer exists.")
        return

    budget = quotas.alteration_budget(profile.get("tier"))
    used = int(post.get("revision_count") or 0)
    if used >= budget:
        await update.effective_message.reply_text("⚠️ Alteration budget exhausted for this post.")
        return

    await update.effective_message.reply_text(f"✏️ Reworking… (edit {used + 1}/{budget})")
    try:
        payload = await asyncio.to_thread(
            tasks.generate_post, profile, post.get("preset_id"), feedback, post,
        )
    except Exception as exc:  # noqa: BLE001 — revision failure surfaces in-chat
        log.exception("revision failed")
        await update.effective_message.reply_text(f"💥 Revision failed: {exc}")
        return
    kb = keyboard_for(payload.post_id)
    if used + 1 >= budget:  # last free edit: keep Approval/Skip only
        kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("✅ Approve & Post", callback_data=f"approve:{post['id']}"),
            InlineKeyboardButton("⏭️ Skip Today", callback_data=f"skip:{post['id']}"),
        ]])
    await context.bot.send_photo(
        chat_id=update.effective_chat.id, photo=payload.image_url,
        caption=f"✏️ Revised (edit {used + 1}/{budget}):\n\n{payload.chat_text}"[:1024],
        reply_markup=kb,
    )


# ── Commands ─────────────────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/start — deep link carries ?start=<pairing_code>, so args[0] pairs."""
    chat_id = update.effective_chat.id
    if not update.effective_user:
        return
    if context.args:
        await _pair(update, str(context.args[0]))
        return
    profile = _linked_profile(chat_id)
    if profile:
        await update.effective_message.reply_text(
            f"⚡️ BreezePost ready for *{profile.get('brand_name') or 'your brand'}*.\n"
            f"Try /generate — or just wait for your scheduled post.",
            parse_mode=ParseMode.MARKDOWN,
        )
    else:
        await update.effective_message.reply_text(
            "👋 Welcome! Ask the web app for a pairing code, then send:\n"
            "/link <code>"
        )


async def cmd_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.effective_message.reply_text("Usage: /link <pairing_code>")
        return
    await _pair(update, context.args[0].strip())


async def _pair(update: Update, code: str) -> None:
    """/link matching: the web app inserted (profile_id, pairing_code) into
    tg_link; we stamp chat_id + telegram_user_id + linked_at on match."""
    chat = update.effective_chat
    user = update.effective_user
    rows = db.client().table("tg_link").select("*").eq("pairing_code", code).limit(1).execute().data or []
    if not rows:
        await update.effective_message.reply_text("❌ Unknown pairing code — generate a new one in the web app.")
        return
    link = rows[0]
    if link.get("telegram_user_id") and link.get("telegram_user_id") != user.id:
        await update.effective_message.reply_text("⚠️ This code is already linked to another Telegram user.")
        return
    profile = db.get_profile(link["profile_id"])
    db.update("tg_link", {"profile_id": link["profile_id"]}, {
        "chat_id": chat.id,               # unique column — collision raises; better to surface than silently overwrite
        "telegram_user_id": user.id,
        "linked_at": datetime.now(timezone.utc).isoformat(),
    })
    await update.effective_message.reply_text(
        f"✅ Linked! BreezePost will send {profile.get('brand_name') or 'your'} posts here. /generate to try one now."
    )


async def cmd_generate(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/generate [preset#] — manual on-demand post for demos."""
    chat_id = update.effective_chat.id
    profile = _linked_profile(chat_id)
    if not profile:
        await update.effective_message.reply_text("Link your brand first: /link <pairing_code>")
        return
    preset_id: Optional[int] = None
    if context.args:
        try:
            preset_id = int(context.args[0].lstrip("#"))
        except ValueError:
            preset_id = None
    await update.effective_message.reply_text("🎨 Brewing your post…")
    try:
        payload = await asyncio.to_thread(tasks.generate_post, profile, preset_id)
    except SlotNotViable:
        await update.effective_message.reply_text("⚠️ Add at least one product and one theme preset in the web app first.")
        return
    except Exception as exc:  # noqa: BLE001 — providers flake; user needs a short readable reason
        log.exception("generate failed")
        await update.effective_message.reply_text(f"💥 Something broke while generating: {exc}")
        return
    await send_post(context.bot, chat_id, payload)


async def cmd_change(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/change <feedback> — apply a natural-language edit to the latest post."""
    profile = _linked_profile(update.effective_chat.id)
    if not profile:
        await update.effective_message.reply_text("Link your brand first: /link <pairing_code>")
        return
    feedback = " ".join(context.args or []).strip()
    if not feedback:
        await update.effective_message.reply_text(
            "Usage: /change <what to change>\n"
            "e.g. /change brighter background, tighter crop, shorter caption"
        )
        return
    post = _latest_actionable_post(profile["id"])
    if not post:
        await update.effective_message.reply_text("Nothing to change yet — send /generate first.")
        return
    await _revise_post(update, context, post, feedback)


async def cmd_post(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/post — publish the latest generated (or revised) image to Instagram."""
    profile = _linked_profile(update.effective_chat.id)
    if not profile:
        await update.effective_message.reply_text("Link your brand first: /link <pairing_code>")
        return
    post = _latest_actionable_post(profile["id"])
    if not post:
        await update.effective_message.reply_text(
            "Nothing to post — send /generate (or /change) first, then /post."
        )
        return
    await update.effective_message.reply_text("🚀 Publishing to Instagram…")
    try:
        media_id, mode = await asyncio.to_thread(_publish_post_row, post)
    except Exception as exc:  # noqa: BLE001 — keep the post retryable
        log.exception("manual publish failed")
        await update.effective_message.reply_text(
            f"💥 Publish failed: {exc}\nThe post is still here — send /post again once it's fixed."
        )
        return
    _mark_published(post["id"], media_id)
    if mode == "mock":
        await update.effective_message.reply_text(
            "✅ Marked as published (mock mode — nothing was actually sent to Instagram)."
        )
    else:
        await update.effective_message.reply_text("✅ Posted to Instagram!")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    profile = _linked_profile(update.effective_chat.id)
    if not profile:
        await update.effective_message.reply_text("Not linked yet. /link <pairing_code>")
        return
    schedule = db.get_schedule(profile["id"])
    posts = db.recent_posts(profile["id"], limit=5)
    lines = [
        f"*{profile.get('brand_name') or 'Brand'}*",
        f"Tier: `{profile.get('tier')}` · Category: `{profile.get('category') or '—'}`",
        f"Schedule: `{(schedule or {}).get('frequency') or 'not set'}{' · ' + str((schedule or {}).get('delivery_times')) if schedule else ''}`",
        "",
        "Last posts:",
    ]
    for p in posts:
        state = {"awaiting_review": "🕓 awaiting", "approved": "👍 approved", "published": "🚀 published",
                 "skipped": "⏭️ skipped", "failed": "💥 failed"}.get(p.get("status"), p.get("status"))
        created = str((p.get("created_at") or "")[:16])
        lines.append(f"• {state} — {created}")
    if not posts:
        lines.append("• (none yet — /generate to make one)")
    await update.effective_message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


async def cmd_skip(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/skip — skip all *remaining* slots today for this profile."""
    profile = _linked_profile(update.effective_chat.id)
    if not profile or not update.effective_message:
        return
    # Slot dates are stored in the PROFILE's local day, not UTC (the
    # scheduler computes them the same way).
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(str(profile.get("timezone") or "Asia/Kolkata"))
    except Exception:  # noqa: BLE001
        tz = None
    now_local = datetime.now(tz) if tz else datetime.now()
    today = now_local.date().isoformat()
    db.client().table("post").update({"status": "skipped"}).eq(
        "profile_id", profile["id"]
    ).eq("slot_date", today).eq("status", "awaiting_review").execute()
    # Why not-yet-generated slots stay skipped: db.latest_action_is_skip()
    # (read by the scheduler) sees the skip as the profile's newest event
    # for today and refuses to create further slot rows until tomorrow.
    await update.effective_message.reply_text("⏭️ Skipped today's remaining slots.")


# ── Inline callbacks ─────────────────────────────────────────────────────

def _post_lookup(post_id: str) -> Optional[Dict[str, Any]]:
    rows = db.client().table("post").select("*").eq("id", post_id).limit(1).execute().data or []
    return rows[0] if rows else None


async def _cb_approve(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    post_id = query.data.split(":", 1)[1]
    post = _post_lookup(post_id)
    if not post:
        await query.answer("Post not found.", show_alert=True)
        return
    if post.get("status") == "published":
        await query.answer("Already published ✔")
        return
    image_url = storage.public_url(config.bucket_generated_posts, post["image_path"]) if post.get("image_path") else None
    if not image_url:
        await query.answer("No image to publish — regenerate the post.", show_alert=True)
        return
    await query.answer("Publishing…")
    try:
        media_id, mode = await asyncio.to_thread(_publish_post_row, post)
        _mark_published(post["id"], media_id)
        tail = " (mock mode — nothing sent to Instagram)" if mode == "mock" else ""
        await query.edit_message_caption(caption=f"✅ Published!{tail}\n\n{post.get('caption', '')}")
    except Exception as exc:  # noqa: BLE001 — publishing failures must not leave ambiguous UX
        log.exception("publish failed")
        # Keep the row in awaiting_review so the user can tap Approve again.
        await query.edit_message_caption(
            caption=f"💥 Publish failed: {exc}\n\nThe draft is still here — tap ✅ Approve to retry."
        )


async def _cb_skip(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    post_id = query.data.split(":", 1)[1]
    db.update("post", {"id": post_id}, {"status": "skipped"})
    await query.answer("Skipped today ✔")
    await query.edit_message_caption(caption="⏭️ Skipped — I'll prepare tomorrow's post.")


async def _cb_edit(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/edit flow — the NEXT plain text message in this chat becomes the
    revision feedback. Stored per-chat so it survives until the reply arrives."""
    query = update.callback_query
    post_id = query.data.split(":", 1)[1]
    context.application.bot_data[f"pending_edit:{update.effective_chat.id}"] = post_id
    await query.answer()
    await query.message.reply_text("✏️ What changes? (e.g. 'brighter, shorter caption, emphasize the citrus scent')")


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Revision feedback handler — only fires when a pending edit exists."""
    chat_id = update.effective_chat.id
    post_id = context.application.bot_data.get(f"pending_edit:{chat_id}") if update.effective_message else None
    if not post_id or not update.effective_message.text or update.effective_message.text.startswith("/"):
        return  # non-bot chatter: ignore
    context.application.bot_data.pop(f"pending_edit:{chat_id}", None)
    feedback = update.effective_message.text.strip()
    post = _post_lookup(post_id)
    if not post:
        await update.effective_message.reply_text("⚠️ That post no longer exists.")
        return
    await _revise_post(update, context, post, feedback)


def register(application: Application) -> None:
    """Attach handlers. Order matters: callback handlers first (their
    CallbackQuery data always wins over text), then commands, then the
    fallback text handler."""
    application.add_handler(CallbackQueryHandler(_cb_approve, pattern=r"^approve:"))
    application.add_handler(CallbackQueryHandler(_cb_skip, pattern=r"^skip:"))
    application.add_handler(CallbackQueryHandler(_cb_edit, pattern=r"^edit:"))
    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CommandHandler("link", cmd_link))
    application.add_handler(CommandHandler("generate", cmd_generate))
    application.add_handler(CommandHandler("change", cmd_change))
    application.add_handler(CommandHandler("post", cmd_post))
    application.add_handler(CommandHandler("status", cmd_status))
    application.add_handler(CommandHandler("skip", cmd_skip))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))


# ── Lifecycle (polling mode) ─────────────────────────────────────────────

def make_application(token: str) -> Application:
    """Build the PTB Application with all handlers attached."""
    app = ApplicationBuilder().token(token).build()
    register(app)
    return app


async def start_polling(application: Application) -> None:
    """Embedded polling (no PTB run_polling event-loop takeover).

    uvicorn owns the loop; PTB is initialized in-place per its docs so the
    bot and the FastAPI app share one asyncio loop.
    """
    await application.initialize()
    await application.start()
    try:
        await application.bot.set_my_commands([
            BotCommand("generate", "Generate a post now"),
            BotCommand("change", "Revise the latest draft (say what to change)"),
            BotCommand("post", "Publish the latest draft to Instagram"),
            BotCommand("status", "Show your schedule and latest posts"),
            BotCommand("skip", "Skip today's post"),
            BotCommand("link", "Link this chat with a pairing code"),
        ])
    except Exception:  # noqa: BLE001 — the command menu is cosmetic; never block polling
        log.warning("could not set bot command menu", exc_info=True)
    if application.updater:
        await application.updater.start_polling(drop_pending_updates=True)
    log.info("Telegram polling started")


async def stop_polling(application: Application) -> None:
    try:
        if application.updater:
            await application.updater.stop()
        await application.stop()
        await application.shutdown()
    except Exception:  # noqa: BLE001 — shutdown must never mask the real error
        log.exception("error while stopping telegram polling")
