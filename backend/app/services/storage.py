"""Supabase Storage uploads + public URL helpers.

Buckets `product-images` and `generated-posts` are public-read, so any
URL we return here can be fetched by Telegram sendPhoto and by Instagram's
media-container creation step without signing.
"""
from __future__ import annotations

import logging
import uuid

from ..config import config
from ..db import client  # reuse the singleton service-role client

log = logging.getLogger(__name__)


def object_url(stored: str) -> str:
    """Resolve `products.image_path` to one fetchable URL.

    The web app stores the full public URL. Older rows store
    `<bucket>/<object>`. Prefix only the relative form.

    Raises RuntimeError when a relative path has no SUPABASE_URL.
    """
    if stored.startswith("http://") or stored.startswith("https://"):
        return stored
    if not config.supabase_url:
        raise RuntimeError("SUPABASE_URL not configured; cannot build public URL")
    return f"{config.supabase_url.rstrip('/')}/storage/v1/object/public/{stored.lstrip('/')}"


def public_url(bucket: str, path: str) -> str:
    """Canonical public object URL.

    Matches {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}.
    """
    if not config.supabase_url:
        raise RuntimeError("SUPABASE_URL not configured; cannot build public URL")
    return f"{config.supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{path.lstrip('/')}"


def upload_jpeg(bucket: str, path_prefix: str, jpeg: bytes, *, content_type: str = "image/jpeg") -> str:
    """Upload bytes and return the object path (bucket excluded).

    Path convention for generated posts: {profile_id}/{uuid}.jpg — unique per
    attempt so revisions keep every historical image (needed by the
    revision history the web dashboard may browse).
    """
    if not path_prefix:
        path_prefix = "misc"
    path = f"{path_prefix.strip('/')}/{uuid.uuid4()}.jpg"
    client().storage.from_(bucket).upload(
        path,
        jpeg,
        # Why explicit content_type: Storage defaults to octet-stream and
        # Instagram's container creation is stricter about mime types.
        {"content-type": content_type, "upsert": "true"},
    )
    # supabase-py raises on error codes; reaching here means 200/201.
    log.info("Uploaded %s bytes to %s/%s", len(jpeg), bucket, path)
    return path


def upload_generated_post(profile_id: str, jpeg: bytes) -> str:
    return upload_jpeg(config.bucket_generated_posts, profile_id, jpeg)
