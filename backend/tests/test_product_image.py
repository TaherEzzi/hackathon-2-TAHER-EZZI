"""Product photos are stored as full public URLs. Fetch must use that URL."""
from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from app.bot.tasks import _fetch_product_image
from app.config import config
from app.services.images import GenerationError
from app.services.storage import object_url


class ProductImageUrlTests(unittest.TestCase):
    def test_public_url_is_used_as_stored(self) -> None:
        stored = "https://example.supabase.co/storage/v1/object/public/product-images/p/a.jpg"
        self.assertEqual(object_url(stored), stored)

    def test_relative_path_is_prefixed_once(self) -> None:
        with patch.object(config, "supabase_url", "https://example.supabase.co"):
            self.assertEqual(
                object_url("product-images/p/a.jpg"),
                "https://example.supabase.co/storage/v1/object/public/product-images/p/a.jpg",
            )

    def test_fetch_downloads_the_stored_url(self) -> None:
        stored = "https://example.supabase.co/storage/v1/object/public/product-images/p/a.jpg"
        resp = MagicMock()
        resp.ok = True
        resp.content = b"jpeg-bytes"
        resp.status_code = 200
        with patch("app.bot.tasks.requests.get", return_value=resp) as get:
            body = _fetch_product_image({"image_path": stored})
        self.assertEqual(body, b"jpeg-bytes")
        self.assertEqual(get.call_args.args[0], stored)

    def test_fetch_raises_when_download_fails(self) -> None:
        stored = "https://example.supabase.co/storage/v1/object/public/product-images/p/a.jpg"
        resp = MagicMock()
        resp.ok = False
        resp.content = b""
        resp.status_code = 400
        with patch("app.bot.tasks.requests.get", return_value=resp):
            with self.assertRaises(GenerationError) as caught:
                _fetch_product_image({"image_path": stored})
        self.assertIn("status=400", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
