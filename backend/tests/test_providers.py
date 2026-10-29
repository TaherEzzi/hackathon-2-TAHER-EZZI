"""Providers for a generated post.

Images must use Cloudflare flux-2-klein, which takes the product photo plus
the prompt. Captions stay on the same Cloudflare account. Neither path may
call OpenRouter or xAI.
"""
from __future__ import annotations

import io
import json
import unittest
from unittest.mock import MagicMock, patch

from PIL import Image

from app.config import config
from app.services.images import GenerationError, PolicyFlagged, generate_image_edit
from app.services.text import generate_caption


def _response(payload: dict) -> MagicMock:
    resp = MagicMock()
    resp.ok = True
    resp.status_code = 200
    resp.text = json.dumps(payload)
    resp.json.return_value = payload
    resp.raise_for_status.return_value = None
    return resp


def _jpeg(width: int, height: int) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (width, height), "tan").save(out, format="JPEG")
    return out.getvalue()


class ImageProviderTests(unittest.TestCase):
    def test_edit_sends_product_photo_and_prompt_to_flux_klein(self) -> None:
        payload = {"success": True, "result": {"image": "aGVsbG8="}}
        with patch("app.services.images.requests.post", return_value=_response(payload)) as post, \
                patch.object(config, "cloudflare_account_id", "acct-1"), \
                patch.object(config, "cloudflare_api_token", "cf-token"), \
                patch.object(config, "post_image_size", 512), \
                patch.object(config, "openrouter_api_key", "should-not-be-used"):
            result = generate_image_edit(_jpeg(400, 400), "linen table, morning light")

        self.assertEqual(result.provider, "cloudflare-flux-2-klein-4b")
        self.assertEqual(result.jpeg_bytes, b"hello")
        self.assertEqual(post.call_count, 1)
        url = post.call_args.args[0]
        self.assertEqual(
            url,
            "https://api.cloudflare.com/client/v4/accounts/acct-1/ai/run/"
            "@cf/black-forest-labs/flux-2-klein-4b",
        )
        # Cloudflare only accepts ordered `input_image_N` parts; `image` 400s.
        self.assertIn("input_image_0", post.call_args.kwargs["files"])
        self.assertNotIn("image", post.call_args.kwargs["files"])
        self.assertEqual(
            post.call_args.kwargs["files"]["input_image_0"][2],
            "image/jpeg",
        )
        data = post.call_args.kwargs["data"]
        self.assertIn("linen table, morning light", data["prompt"])
        self.assertEqual((data["width"], data["height"]), ("512", "512"))
        self.assertNotIn("openrouter.ai", url)
        self.assertNotIn("api.x.ai", url)
        self.assertNotIn("flux-1-schnell", url)

    def test_edit_downscales_oversized_product_photo(self) -> None:
        payload = {"success": True, "result": {"image": "aGVsbG8="}}
        with patch("app.services.images.requests.post", return_value=_response(payload)) as post, \
                patch.object(config, "cloudflare_account_id", "acct-1"), \
                patch.object(config, "cloudflare_api_token", "cf-token"), \
                patch.object(config, "post_image_size", 512):
            generate_image_edit(_jpeg(1024, 1024), "studio backdrop")

        sent = post.call_args.kwargs["files"]["input_image_0"][1]
        with Image.open(io.BytesIO(sent)) as img:
            self.assertEqual(img.format, "JPEG")
            self.assertLessEqual(max(img.size), 512)

    def test_edit_raises_policy_flagged_with_cloudflare_detail(self) -> None:
        payload = {
            "success": False,
            "errors": [{"code": 3030, "message": "output was flagged"}],
        }
        resp = _response(payload)
        resp.ok = False
        resp.status_code = 400
        with patch("app.services.images.requests.post", return_value=resp), \
                patch.object(config, "cloudflare_account_id", "acct-1"), \
                patch.object(config, "cloudflare_api_token", "cf-token"):
            with self.assertRaises(PolicyFlagged) as caught:
                generate_image_edit(_jpeg(400, 400), "linen table")

        message = str(caught.exception)
        self.assertIn("HTTP 400", message)
        self.assertIn("3030", message)
        self.assertIn("output was flagged", message)

    def test_edit_retries_with_safer_prompt_when_output_is_flagged(self) -> None:
        flagged = _response({
            "success": False,
            "errors": [{"code": 3030, "message": "AiError: Your output has been flagged"}],
        })
        flagged.ok = False
        flagged.status_code = 400
        ok = _response({"success": True, "result": {"image": "aGVsbG8="}})
        with patch(
            "app.services.images.requests.post",
            side_effect=[flagged, ok],
        ) as post, \
                patch.object(config, "cloudflare_account_id", "acct-1"), \
                patch.object(config, "cloudflare_api_token", "cf-token"), \
                patch.object(config, "post_image_size", 512):
            result = generate_image_edit(_jpeg(1024, 1024), "a cold brew can on ice")

        self.assertEqual(result.jpeg_bytes, b"hello")
        self.assertEqual(post.call_count, 2)
        retry_prompt = post.call_args.kwargs["data"]["prompt"]
        self.assertIn("family-friendly", retry_prompt)
        self.assertIn("a cold brew can on ice", retry_prompt)
        first_input = post.call_args_list[0].kwargs["files"]["input_image_0"][1]
        second_input = post.call_args_list[1].kwargs["files"]["input_image_0"][1]
        self.assertNotEqual(first_input, second_input)

    def test_edit_does_not_fall_back_to_chat_models_when_klein_fails(self) -> None:
        with patch("app.services.images.requests.post", side_effect=RuntimeError("klein down")) as post, \
                patch.object(config, "cloudflare_account_id", "acct-1"), \
                patch.object(config, "cloudflare_api_token", "cf-token"), \
                patch.object(config, "cloudflare_edit_model", "@cf/black-forest-labs/flux-2-klein-4b"), \
                patch.object(config, "cloudflare_edit_model_fallback", ""), \
                patch.object(config, "openrouter_api_key", "should-not-be-used"):
            with self.assertRaises(GenerationError):
                generate_image_edit(_jpeg(400, 400), "linen table")

        urls = [call.args[0] for call in post.call_args_list]
        self.assertEqual(len(urls), 1)
        self.assertIn("flux-2-klein-4b", urls[0])
        self.assertTrue(all("openrouter.ai" not in url and "api.x.ai" not in url for url in urls))

    def test_edit_retries_on_the_fallback_model_after_a_non_policy_failure(self) -> None:
        ok = _response({"success": True, "result": {"image": "aGVsbG8="}})
        with patch("app.services.images.requests.post", side_effect=[RuntimeError("klein down"), ok]) as post, \
                patch.object(config, "cloudflare_account_id", "acct-1"), \
                patch.object(config, "cloudflare_api_token", "cf-token"), \
                patch.object(config, "cloudflare_edit_model", "@cf/black-forest-labs/flux-2-klein-9b"), \
                patch.object(config, "cloudflare_edit_model_fallback", "@cf/black-forest-labs/flux-2-klein-4b"):
            result = generate_image_edit(_jpeg(400, 400), "linen table")

        self.assertEqual(result.provider, "cloudflare-flux-2-klein-4b")
        urls = [call.args[0] for call in post.call_args_list]
        self.assertEqual(len(urls), 2)
        self.assertIn("flux-2-klein-9b", urls[0])
        self.assertIn("flux-2-klein-4b", urls[1])


class CaptionProviderTests(unittest.TestCase):
    def test_caption_uses_cloudflare_chat_not_openrouter_or_grok(self) -> None:
        payload = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "caption": "Velvet Ember, poured slow.",
                        "hashtags": ["#coffee", "#velvetember"],
                    }),
                },
            }],
        }
        with patch("app.services.text.requests.post", return_value=_response(payload)) as post, \
                patch.object(config, "cloudflare_account_id", "acct-1"), \
                patch.object(config, "cloudflare_api_token", "cf-token"), \
                patch.object(config, "cloudflare_text_model", "@cf/meta/llama-3.1-8b-instruct-fp8"):
            caption, tags = generate_caption(
                {"name": "Velvet", "description": "warm"},
                {"title": "Ember"},
                {"brand_name": "Velvet Ember"},
            )

        self.assertEqual(caption, "Velvet Ember, poured slow.")
        self.assertEqual(tags, ["#coffee", "#velvetember"])
        self.assertEqual(post.call_count, 1)
        url = post.call_args.args[0]
        self.assertEqual(
            url,
            "https://api.cloudflare.com/client/v4/accounts/acct-1/ai/v1/chat/completions",
        )
        self.assertEqual(post.call_args.kwargs["json"]["model"], "@cf/meta/llama-3.1-8b-instruct-fp8")
        self.assertNotIn("openrouter.ai", url)
        self.assertNotIn("api.x.ai", url)

    def test_caption_falls_back_when_primary_model_is_retired(self) -> None:
        payload = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "caption": "Midnight Roast, poured slow.",
                        "hashtags": ["#coffee", "#velvetember"],
                    }),
                },
            }],
        }
        retired = _response({
            "errors": [{"code": 5028, "message": "Model has been deprecated"}],
        })
        retired.ok = False
        retired.status_code = 410
        with patch(
            "app.services.text.requests.post",
            side_effect=[retired, _response(payload)],
        ) as post, \
                patch.object(config, "cloudflare_account_id", "acct-1"), \
                patch.object(config, "cloudflare_api_token", "cf-token"), \
                patch.object(config, "cloudflare_text_model", "@cf/meta/llama-3.1-8b-instruct-fp8"), \
                patch.object(config, "cloudflare_text_fallbacks", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"):
            caption, _tags = generate_caption(
                {"name": "Velvet", "description": "warm"},
                {"title": "Ember"},
                {"brand_name": "Velvet Ember"},
            )

        self.assertEqual(caption, "Midnight Roast, poured slow.")
        self.assertEqual(post.call_count, 2)
        self.assertEqual(
            post.call_args_list[0].kwargs["json"]["model"],
            "@cf/meta/llama-3.1-8b-instruct-fp8",
        )
        self.assertEqual(
            post.call_args_list[1].kwargs["json"]["model"],
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        )

    def test_caption_falls_back_to_groq_when_cloudflare_is_down(self) -> None:
        payload = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "caption": "Midnight Roast, poured slow.",
                        "hashtags": ["#coffee", "#velvetember"],
                    }),
                },
            }],
        }
        down = _response({"errors": [{"code": 5000, "message": "upstream unavailable"}]})
        down.ok = False
        down.status_code = 503
        with patch(
            "app.services.text.requests.post",
            side_effect=[down, down, _response(payload)],
        ) as post, \
                patch.object(config, "cloudflare_account_id", "acct-1"), \
                patch.object(config, "cloudflare_api_token", "cf-token"), \
                patch.object(config, "cloudflare_text_model", "@cf/meta/llama-3.1-8b-instruct-fp8"), \
                patch.object(config, "cloudflare_text_fallbacks", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"), \
                patch.object(config, "groq_api_key", "gsk_test"), \
                patch.object(config, "groq_base_url", "https://api.groq.com/openai/v1"), \
                patch.object(config, "groq_model", "openai/gpt-oss-120b"):
            caption, _tags = generate_caption(
                {"name": "Velvet", "description": "warm"},
                {"title": "Ember"},
                {"brand_name": "Velvet Ember"},
            )

        self.assertEqual(caption, "Midnight Roast, poured slow.")
        self.assertEqual(post.call_count, 3)
        self.assertEqual(
            post.call_args_list[2].args[0],
            "https://api.groq.com/openai/v1/chat/completions",
        )
        self.assertEqual(
            post.call_args_list[2].kwargs["json"]["model"],
            "openai/gpt-oss-120b",
        )


if __name__ == "__main__":
    unittest.main()
