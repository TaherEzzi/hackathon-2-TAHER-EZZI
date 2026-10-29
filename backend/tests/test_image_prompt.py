"""Edit prompt composition: the photo is the product, not the preset text."""
from __future__ import annotations

import io
import unittest
from unittest.mock import MagicMock, patch

from PIL import Image

from app.config import config
from app.services import images

PRESET = {
    "id": 39,
    "prompt_template": (
        "A fruity drink bottle against banana leaves and glass of ice cubes "
        "at golden-hour backlight, saturated orange and teal grade."
    ),
}
PRODUCT = {"id": "p1", "title": "Coco cola", "highlight": "ice cold", "image_path": "x/a.jpg"}
PROFILE = {"id": "u1", "design_dna_md": "Old-world quiet luxury, chiaroscuro lighting"}


def _jpeg() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (400, 400), "tan").save(out, format="JPEG")
    return out.getvalue()


class ImagePromptTests(unittest.TestCase):
    def test_edit_prompt_scopes_preset_text_to_the_background(self) -> None:
        prompt = images.build_image_prompt(PRESET, PRODUCT, PROFILE)

        self.assertIn(images.SCENE_PREFIX, prompt)
        self.assertIn("banana leaves", prompt)
        # The asset title used to be injected as copy and overwrote the label.
        self.assertNotIn("Coco cola", prompt)
        self.assertNotIn("Product:", prompt)
        self.assertIn("Palette and mood", prompt)

    def test_text_only_prompt_still_names_the_product(self) -> None:
        prompt = images.build_image_prompt(PRESET, PRODUCT, PROFILE, text_only=True)

        self.assertIn("Coco cola", prompt)
        self.assertNotIn(images.SCENE_PREFIX, prompt)

    def test_provider_prompt_leads_and_trails_with_the_identity_lock(self) -> None:
        ok = MagicMock()
        ok.ok = True
        ok.status_code = 200
        ok.json.return_value = {"success": True, "result": {"image": "aGVsbG8="}}
        with patch("app.services.images.requests.post", return_value=ok) as post, \
                patch.object(config, "cloudflare_account_id", "acct-1"), \
                patch.object(config, "cloudflare_api_token", "cf-token"), \
                patch.object(config, "post_image_size", 512), \
                patch.object(config, "cloudflare_edit_model", "@cf/black-forest-labs/flux-2-klein-4b"), \
                patch.object(config, "cloudflare_edit_model_fallback", ""):
            images.generate_image_edit(_jpeg(), images.build_image_prompt(PRESET, PRODUCT, PROFILE))

        sent = post.call_args.kwargs["data"]["prompt"]
        self.assertTrue(sent.startswith(images.IDENTITY_GUARDRAIL))
        self.assertIn(images.IDENTITY_TRAILER, sent)
        self.assertNotIn("Coco cola", sent)


if __name__ == "__main__":
    unittest.main()
