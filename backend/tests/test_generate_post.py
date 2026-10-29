"""Text-only fallback when Cloudflare's filter blocks the product photo."""
from __future__ import annotations

import unittest
from unittest.mock import patch

from app.bot import tasks
from app.services.images import GenerationError, ImageResult, PolicyFlagged

PRESET = {"id": 40, "name": "Levitation Can", "prompt_template": "floating can"}
PRODUCT = {"id": "p1", "title": "Coco cola", "image_path": "product-images/x/a.jpg"}
PROFILE = {"id": "u1", "brand_name": "Atelier"}


def _patches(**overrides):
    defaults = dict(
        pick_preset=patch.object(tasks, "pick_preset", return_value=PRESET),
        pick_product=patch.object(tasks, "pick_product", return_value=PRODUCT),
        fetch_image=patch.object(tasks, "_fetch_product_image", return_value=b"jpeg"),
        caption=patch.object(tasks.text, "generate_caption", return_value=("cap", ["#tag"])),
        upload=patch.object(tasks.storage, "upload_generated_post", return_value="u1/x.jpg"),
        public=patch.object(tasks.storage, "public_url", return_value="https://cdn/x.jpg"),
        insert=patch.object(tasks.db, "insert", return_value={"id": "post-1"}),
    )
    defaults.update(overrides)
    return defaults


class GeneratePostFallbackTests(unittest.TestCase):
    def test_falls_back_to_text_only_when_photo_is_policy_flagged(self) -> None:
        patches = _patches()
        with patches["pick_preset"], patches["pick_product"], patches["fetch_image"], \
                patches["caption"], patches["upload"], patches["public"], patches["insert"], \
                patch.object(
                    tasks.images, "generate_image_edit",
                    side_effect=PolicyFlagged("flux-2-klein: 3030 flagged"),
                ), \
                patch.object(
                    tasks.images, "generate_image",
                    return_value=ImageResult(b"img", "cloudflare-flux-schnell"),
                ) as text_only:
            payload = tasks.generate_post(PROFILE)

        self.assertEqual(payload.post_id, "post-1")
        self.assertEqual(payload.image_url, "https://cdn/x.jpg")
        text_only.assert_called_once()
        # With no reference image the fallback must spell the product out.
        self.assertIn("Coco cola", text_only.call_args.args[0])
        self.assertIn("text-only interpretation", payload.chat_text)

    def test_on_demand_insert_stores_zero_slot_index(self) -> None:
        """`post.slot_index` is NOT NULL; on-demand posts have no slot."""
        patches = _patches()
        with patches["pick_preset"], patches["pick_product"], patches["fetch_image"], \
                patches["caption"], patches["upload"], patches["public"], \
                patch.object(
                    tasks.images, "generate_image_edit",
                    return_value=ImageResult(b"img", "cloudflare-flux-2-klein-4b"),
                ), \
                patch.object(tasks.db, "insert", return_value={"id": "post-1"}) as insert:
            tasks.generate_post(PROFILE)

        row = insert.call_args.args[1]
        self.assertEqual(row["slot_index"], 0)
        self.assertIsNone(row["slot_date"])

    def test_does_not_mask_non_policy_image_errors(self) -> None:
        patches = _patches()
        with patches["pick_preset"], patches["pick_product"], patches["fetch_image"], \
                patches["caption"], patches["upload"], patches["public"], patches["insert"], \
                patch.object(
                    tasks.images, "generate_image_edit",
                    side_effect=GenerationError("flux-2-klein: HTTP 500"),
                ), \
                patch.object(tasks.images, "generate_image") as text_only:
            with self.assertRaises(GenerationError):
                tasks.generate_post(PROFILE)

        text_only.assert_not_called()

    def test_revision_keeps_the_product_of_the_base_post(self) -> None:
        """Re-picking a product on /change swaps the photo under the feedback."""
        base_post = {
            "id": "post-0", "profile_id": "u1", "product_id": "p1",
            "preset_id": 40, "revision_count": 0,
        }
        patches = _patches()
        with patches["pick_preset"], patches["caption"], patches["upload"], patches["public"], \
                patches["fetch_image"], \
                patch.object(tasks, "pick_product") as pick_product, \
                patch.object(tasks.db, "select", return_value=[PRODUCT]) as select, \
                patch.object(tasks.db, "insert", return_value={"id": "rev-1"}), \
                patch.object(tasks.db, "update"), \
                patch.object(
                    tasks.images, "generate_image_edit",
                    return_value=ImageResult(b"img", "cloudflare-flux-2-klein-9b"),
                ):
            tasks.generate_post(PROFILE, revision_feedback="brighter", base_post=base_post)

        pick_product.assert_not_called()
        select.assert_called_once_with("products", {"id": "p1"}, limit=1)


if __name__ == "__main__":
    unittest.main()
