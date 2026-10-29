"""Instagram publishing (Instagram API with Instagram Login, Creator account).

Verified real credentials live in env as IG_ACCESS_TOKEN / IG_USER_ID.
Publish flow against graph.instagram.com/{version}:

  1) POST /{ig-user-id}/media          { image_url=public URL, caption }
     -> {"id": creation_id}
  2) POST /{ig-user-id}/media_publish  { creation_id }
     -> {"id": ig_media_id}

PUBLISH_MODE=mock (default) skips both calls and returns a fake media id so
the Telegram demo flow always succeeds end-to-end.
"""
from __future__ import annotations

import logging
import secrets
import time
from typing import Tuple

import requests

from ..config import config

log = logging.getLogger(__name__)

TIMEOUT_SECS = 60
MAX_IG_CAPTION_CHARS = 2200
# Instagram processes a container asynchronously; publishing before it is
# FINISHED returns "Media ID is not available". Poll briefly instead.
CONTAINER_POLL_SECS = 45
CONTAINER_POLL_INTERVAL = 3


class PublishError(RuntimeError):
    """Raised on real-mode failure; the bot keeps the post in
    awaiting_review so the user can retry."""


def _graph_post(path: str, data: dict) -> dict:
    url = f"https://graph.instagram.com/{config.ig_api_version}/{path}"
    resp = requests.post(
        url,
        data=data,
        headers={"Authorization": f"Bearer {config.ig_access_token}"},
        timeout=TIMEOUT_SECS,
    )
    resp.raise_for_status()
    return resp.json()


def _wait_for_container(container_id: str) -> None:
    url = f"https://graph.instagram.com/{config.ig_api_version}/{container_id}"
    deadline = time.monotonic() + CONTAINER_POLL_SECS
    while time.monotonic() < deadline:
        resp = requests.get(
            url,
            params={"fields": "status_code"},
            headers={"Authorization": f"Bearer {config.ig_access_token}"},
            timeout=TIMEOUT_SECS,
        )
        resp.raise_for_status()
        status = str(resp.json().get("status_code") or "").upper()
        if status == "FINISHED":
            return
        if status in ("ERROR", "EXPIRED"):
            raise PublishError(f"Instagram rejected the media container ({status})")
        time.sleep(CONTAINER_POLL_INTERVAL)
    raise PublishError(
        f"Instagram media container {container_id} was not ready after "
        f"{CONTAINER_POLL_SECS}s"
    )


def publish(image_url: str, caption: str, hashtags: list[str] | None = None) -> Tuple[str, str]:
    """Publish and return (ig_media_id, mode). `image_url` must be a
    reachable public URL — the generated image lives in the `generated-posts`
    bucket which is public-read, so we pass the Storage link directly.
    """
    full_caption = caption
    if hashtags:
        joined = " ".join(h for h in hashtags if h)  # IG has no hashtag column; append to caption
        full_caption = f"{caption}\n\n{joined}".strip()
    full_caption = full_caption[:MAX_IG_CAPTION_CHARS]

    if config.publish_mode == "mock":
        # Why fake-but-formatted: keeps the ig_media_id column shape real
        # so frontend/QA code doesn't special-case anything.
        fake_id = f"mock_{secrets.token_hex(8)}"
        log.info("MOCK publish: image_url=%s caption=%d chars -> id=%s", image_url, len(full_caption), fake_id)
        return fake_id, "mock"

    if not (config.ig_access_token and config.ig_user_id):
        raise PublishError("PUBLISH_MODE=real but IG_ACCESS_TOKEN/IG_USER_ID missing")

    creation = _graph_post(f"{config.ig_user_id}/media", {"image_url": image_url, "caption": full_caption})
    creation_id = creation.get("id")
    if not creation_id:
        raise PublishError(f"media container creation returned no id: {creation}")

    _wait_for_container(str(creation_id))
    published = _graph_post(f"{config.ig_user_id}/media_publish", {"creation_id": creation_id})
    media_id = published.get("id")
    if not media_id:
        raise PublishError(f"media_publish returned no id: {published}")
    return str(media_id), "real"
