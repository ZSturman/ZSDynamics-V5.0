#!/usr/bin/env python3
"""Cloudflare R2 uploader with a content-hash manifest.

Designed for the portfolio build pipeline. Behaviour:

- Maintains a manifest at ``lib/media-manifest.lock.json`` (committed to git).
  Each entry is keyed by the source path relative to ``public/`` and stores:
    { "sha256": "...", "size": 123, "r2_key": "...", "r2_url": "https://...",
      "uploaded_at": "ISO8601", "content_type": "image/webp" }
- Before uploading a file, computes sha256(local_path).
- If the manifest already has a matching sha256 + size for that path, the
  upload is skipped and the cached r2_url is returned.
- When uploading, the R2 object key is content-hash suffixed so changed files
  always get a brand-new URL — no CDN purge needed and old URLs can stay
  alive while clients pick up the new ones.

Required env vars (or kwargs to ``R2Client``):
    R2_ACCOUNT_ID
    R2_ACCESS_KEY_ID
    R2_SECRET_ACCESS_KEY
    R2_BUCKET
    R2_PUBLIC_BASE_URL   (e.g. https://media.zacharysturman.com)

This module never raises on missing env vars; it returns ``None`` from
``maybe_create_r2_client`` so callers can degrade gracefully.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import mimetypes
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST_PATH = REPO_ROOT / "lib" / "media-manifest.lock.json"

CACHE_CONTROL = "public, max-age=31536000, immutable"
SHORT_HASH_LEN = 12


# ---------------------------------------------------------------------------
# Manifest


@dataclasses.dataclass
class ManifestEntry:
    sha256: str
    size: int
    r2_key: str
    r2_url: str
    uploaded_at: str
    content_type: str

    def to_json(self) -> dict[str, Any]:
        return dataclasses.asdict(self)

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "ManifestEntry":
        return cls(
            sha256=str(data.get("sha256", "")),
            size=int(data.get("size", 0)),
            r2_key=str(data.get("r2_key", "")),
            r2_url=str(data.get("r2_url", "")),
            uploaded_at=str(data.get("uploaded_at", "")),
            content_type=str(data.get("content_type", "application/octet-stream")),
        )


class MediaManifest:
    def __init__(self, manifest_path: Path = DEFAULT_MANIFEST_PATH) -> None:
        self.manifest_path = manifest_path
        self._entries: dict[str, ManifestEntry] = {}
        self._load()

    def _load(self) -> None:
        if not self.manifest_path.exists():
            return
        try:
            data = json.loads(self.manifest_path.read_text("utf-8"))
        except Exception as exc:
            logger.warning("Could not parse manifest %s: %s", self.manifest_path, exc)
            return
        entries = data.get("entries", {})
        if not isinstance(entries, dict):
            return
        for key, raw in entries.items():
            if isinstance(raw, dict):
                try:
                    self._entries[key] = ManifestEntry.from_json(raw)
                except Exception:
                    continue

    def get(self, source_key: str) -> Optional[ManifestEntry]:
        return self._entries.get(source_key)

    def set(self, source_key: str, entry: ManifestEntry) -> None:
        self._entries[source_key] = entry

    def all(self) -> dict[str, ManifestEntry]:
        return dict(self._entries)

    def save(self) -> None:
        payload = {
            "schema_version": 1,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "entries": {k: v.to_json() for k, v in sorted(self._entries.items())},
        }
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.manifest_path.with_suffix(self.manifest_path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(self.manifest_path)


# ---------------------------------------------------------------------------
# Hashing


def file_sha256(path: Path, chunk: int = 1024 * 1024) -> str:
    sha = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            sha.update(block)
    return sha.hexdigest()


def short_hash(sha256: str) -> str:
    return sha256[:SHORT_HASH_LEN]


# ---------------------------------------------------------------------------
# R2 client


class R2Client:
    def __init__(
        self,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket: str,
        public_base_url: str,
        dry_run: bool = False,
    ) -> None:
        self.account_id = account_id
        self.bucket = bucket
        self.public_base_url = public_base_url.rstrip("/")
        self.dry_run = dry_run
        self._client = None
        if not dry_run:
            try:
                import boto3  # type: ignore
                from botocore.config import Config  # type: ignore
            except ImportError as exc:
                raise RuntimeError(
                    "boto3 is required for R2 uploads. Install with `pip install boto3`."
                ) from exc

            endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
            self._client = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=access_key_id,
                aws_secret_access_key=secret_access_key,
                region_name="auto",
                config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
            )

    def public_url(self, key: str) -> str:
        return f"{self.public_base_url}/{key.lstrip('/')}"

    def upload(self, local_path: Path, key: str, content_type: str) -> str:
        if self.dry_run or self._client is None:
            logger.info("[dry-run] would upload %s -> r2://%s/%s", local_path, self.bucket, key)
            return self.public_url(key)

        with open(local_path, "rb") as fh:
            self._client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=fh,
                ContentType=content_type,
                CacheControl=CACHE_CONTROL,
            )
        return self.public_url(key)


def maybe_create_r2_client(dry_run: bool = False) -> Optional[R2Client]:
    """Build an R2 client from env vars. Returns None if any required var is missing."""
    required = {
        "R2_ACCOUNT_ID": os.environ.get("R2_ACCOUNT_ID"),
        "R2_ACCESS_KEY_ID": os.environ.get("R2_ACCESS_KEY_ID"),
        "R2_SECRET_ACCESS_KEY": os.environ.get("R2_SECRET_ACCESS_KEY"),
        "R2_BUCKET": os.environ.get("R2_BUCKET"),
        "R2_PUBLIC_BASE_URL": os.environ.get("R2_PUBLIC_BASE_URL"),
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        if not dry_run:
            logger.info("R2 disabled (missing env vars: %s)", ", ".join(missing))
        return None
    return R2Client(
        account_id=required["R2_ACCOUNT_ID"],  # type: ignore[arg-type]
        access_key_id=required["R2_ACCESS_KEY_ID"],  # type: ignore[arg-type]
        secret_access_key=required["R2_SECRET_ACCESS_KEY"],  # type: ignore[arg-type]
        bucket=required["R2_BUCKET"],  # type: ignore[arg-type]
        public_base_url=required["R2_PUBLIC_BASE_URL"],  # type: ignore[arg-type]
        dry_run=dry_run,
    )


# ---------------------------------------------------------------------------
# High-level upload


def guess_content_type(path: Path) -> str:
    name = path.name.lower()
    if name.endswith(".webp"):
        return "image/webp"
    if name.endswith(".glb"):
        return "model/gltf-binary"
    if name.endswith(".gltf"):
        return "model/gltf+json"
    ctype, _ = mimetypes.guess_type(str(path))
    return ctype or "application/octet-stream"


def derive_r2_key(source_rel: str, sha256: str) -> str:
    """Insert a content-hash before the extension so changed files get new URLs."""
    p = Path(source_rel)
    stem = p.stem
    ext = p.suffix
    parent = str(p.parent).strip(".") or ""
    hashed = f"{stem}.{short_hash(sha256)}{ext}"
    if parent:
        return f"{parent}/{hashed}".replace("\\", "/")
    return hashed


def upload_if_changed(
    local_path: Path,
    source_rel: str,
    manifest: MediaManifest,
    client: R2Client,
) -> tuple[str, bool]:
    """Upload local_path to R2 if its sha256+size differs from the manifest.

    ``source_rel`` is the stable identity used as the manifest key (e.g. the
    path relative to ``public/``). Returns (hosted_url, uploaded?).
    """
    if not local_path.is_file():
        raise FileNotFoundError(local_path)

    size = local_path.stat().st_size
    sha = file_sha256(local_path)

    cached = manifest.get(source_rel)
    if cached and cached.sha256 == sha and cached.size == size and cached.r2_url:
        return cached.r2_url, False

    key = derive_r2_key(source_rel, sha)
    content_type = guess_content_type(local_path)
    started = time.time()
    url = client.upload(local_path, key, content_type)
    elapsed = time.time() - started

    entry = ManifestEntry(
        sha256=sha,
        size=size,
        r2_key=key,
        r2_url=url,
        uploaded_at=datetime.now(timezone.utc).isoformat(),
        content_type=content_type,
    )
    manifest.set(source_rel, entry)
    logger.info("uploaded %s (%.1f KB) in %.2fs", source_rel, size / 1024, elapsed)
    return url, True
