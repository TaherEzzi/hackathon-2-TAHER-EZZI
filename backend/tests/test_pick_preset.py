"""Preset picking must respect the profile's current category."""
from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from app.bot import tasks

PROFILE = {"id": "u1", "category": "watches"}


def _selection_client(preset_ids):
    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[{"preset_id": pid} for pid in preset_ids])
    )
    return client


class PickPresetTests(unittest.TestCase):
    def test_saved_selections_from_the_old_category_are_ignored(self) -> None:
        saved = [
            {"id": 33, "category": "beauty"},
            {"id": 61, "category": "watches"},
        ]
        with patch.object(tasks.db, "client", return_value=_selection_client([33, 61])), \
                patch.object(tasks.db, "select_in", return_value=saved):
            preset = tasks.pick_preset(PROFILE, None)

        self.assertEqual(preset["id"], 61)

    def test_falls_back_to_category_presets_when_nothing_matches(self) -> None:
        saved = [{"id": 33, "category": "beauty"}]
        with patch.object(tasks.db, "client", return_value=_selection_client([33])), \
                patch.object(tasks.db, "select_in", return_value=saved), \
                patch.object(tasks.db, "theme_presets_for_categories", return_value=[{"id": 62, "category": "watches"}]):
            preset = tasks.pick_preset(PROFILE, None)

        self.assertEqual(preset["id"], 62)


if __name__ == "__main__":
    unittest.main()
