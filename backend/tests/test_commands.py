"""Telegram commands: /change regenerates the latest post, /post publishes it."""
from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.bot import handlers, tasks

PROFILE = {"id": "u1", "tier": "boost", "brand_name": "Velvet Ember"}
POST = {
    "id": "p1",
    "profile_id": "u1",
    "status": "awaiting_review",
    "preset_id": 63,
    "image_path": "u1/x.jpg",
    "caption": "cap",
    "hashtags": ["#a"],
    "revision_count": 0,
}


def _update():
    update = MagicMock()
    update.effective_chat.id = 42
    update.effective_message.reply_text = AsyncMock()
    return update


class PostCommandTests(unittest.IsolatedAsyncioTestCase):
    async def test_post_publishes_latest_generated_image(self) -> None:
        update, context = _update(), MagicMock()
        with patch.object(handlers, "_linked_profile", return_value=PROFILE), \
                patch.object(handlers, "_latest_actionable_post", return_value=POST), \
                patch.object(handlers, "_publish_post_row", return_value=("mock_123", "mock")), \
                patch.object(handlers, "_mark_published") as mark:
            await handlers.cmd_post(update, context)

        mark.assert_called_once_with("p1", "mock_123")
        texts = [call.args[0] for call in update.effective_message.reply_text.call_args_list]
        self.assertIn("mock mode", texts[-1])
        self.assertIn("nothing was actually sent", texts[-1])

    async def test_post_reports_failure_and_leaves_post_retryable(self) -> None:
        update, context = _update(), MagicMock()
        with patch.object(handlers, "_linked_profile", return_value=PROFILE), \
                patch.object(handlers, "_latest_actionable_post", return_value=POST), \
                patch.object(handlers, "_publish_post_row", side_effect=RuntimeError("ig down")), \
                patch.object(handlers, "_mark_published") as mark:
            await handlers.cmd_post(update, context)

        mark.assert_not_called()
        texts = [call.args[0] for call in update.effective_message.reply_text.call_args_list]
        self.assertIn("Publish failed", texts[-1])
        self.assertIn("/post again", texts[-1])


class NewCommandTests(unittest.IsolatedAsyncioTestCase):
    async def test_new_generates_from_a_different_product_and_retires_the_draft(self) -> None:
        update, context = _update(), MagicMock()
        context.bot.send_photo = AsyncMock()
        current = {**POST, "product_id": "prod-1"}
        payload = tasks.PostPayload(
            post_id="p2", chat_text="cap", image_url="https://cdn/y.jpg",
            revision_count=0, slot_date=None, slot_index=0,
        )
        with patch.object(handlers, "_linked_profile", return_value=PROFILE), \
                patch.object(handlers, "_latest_post", return_value=current), \
                patch.object(handlers.tasks, "generate_post", return_value=payload) as generate, \
                patch.object(handlers.db, "update") as update_row:
            await handlers.cmd_new(update, context)

        generate.assert_called_once_with(
            PROFILE, preset_id=current["preset_id"], exclude_product_id="prod-1",
        )
        update_row.assert_called_once_with("post", {"id": "p1"}, {"status": "skipped"})
        context.bot.send_photo.assert_awaited_once()

    async def test_new_explains_when_the_locker_has_only_one_product(self) -> None:
        update, context = _update(), MagicMock()
        context.bot.send_photo = AsyncMock()
        with patch.object(handlers, "_linked_profile", return_value=PROFILE), \
                patch.object(handlers, "_latest_post", return_value={**POST, "product_id": "prod-1"}), \
                patch.object(handlers.tasks, "generate_post", side_effect=tasks.NoAlternativeProduct("only")), \
                patch.object(handlers.db, "update") as update_row:
            await handlers.cmd_new(update, context)

        update_row.assert_not_called()
        context.bot.send_photo.assert_not_awaited()
        self.assertIn("Add another photo", update.effective_message.reply_text.call_args.args[0])


class ChangeCommandTests(unittest.IsolatedAsyncioTestCase):
    async def test_change_regenerates_latest_post_with_natural_language_feedback(self) -> None:
        update, context = _update(), MagicMock()
        context.args = ["make", "the", "background", "brighter"]
        context.bot.send_photo = AsyncMock()
        payload = tasks.PostPayload(
            post_id="p1", chat_text="cap", image_url="https://cdn/x.jpg",
            revision_count=1, slot_date=None, slot_index=0,
        )
        with patch.object(handlers, "_linked_profile", return_value=PROFILE), \
                patch.object(handlers, "_latest_actionable_post", return_value=POST), \
                patch.object(handlers.db, "get_profile", return_value=PROFILE), \
                patch.object(handlers.tasks, "generate_post", return_value=payload) as generate:
            await handlers.cmd_change(update, context)

        generate.assert_called_once_with(
            PROFILE, POST["preset_id"], "make the background brighter", POST,
        )
        context.bot.send_photo.assert_awaited_once()

    async def test_change_requires_feedback(self) -> None:
        update, context = _update(), MagicMock()
        context.args = []
        with patch.object(handlers, "_linked_profile", return_value=PROFILE), \
                patch.object(handlers, "_latest_actionable_post", return_value=POST), \
                patch.object(handlers.tasks, "generate_post") as generate:
            await handlers.cmd_change(update, context)

        generate.assert_not_called()
        self.assertIn("Usage", update.effective_message.reply_text.call_args.args[0])

    async def test_change_respects_alteration_budget(self) -> None:
        update, context = _update(), MagicMock()
        context.args = ["brighter"]
        exhausted = {**POST, "revision_count": 4}
        with patch.object(handlers, "_linked_profile", return_value=PROFILE), \
                patch.object(handlers, "_latest_actionable_post", return_value=exhausted), \
                patch.object(handlers.db, "get_profile", return_value=PROFILE), \
                patch.object(handlers.tasks, "generate_post") as generate:
            await handlers.cmd_change(update, context)

        generate.assert_not_called()
        self.assertIn("budget exhausted", update.effective_message.reply_text.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
