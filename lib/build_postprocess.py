#!/usr/bin/env python3
"""Build post-process: hosted media + static API endpoints.

Runs after ``generate-projects``, ``generate-articles`` and ``optimize``.

Responsibilities:

1. Optionally upload media referenced by ``public/projects/**`` to Cloudflare
   R2 using a content-hash manifest, so unchanged files are never re-uploaded.
   The mapping ``localPath -> hostedUrl`` is written to
   ``public/media-urls.json`` so the frontend can prefer hosted URLs at render
   time while falling back to the local path when no hosted URL is available.

2. Emit a stable, versioned set of static JSON endpoints under
   ``public/api/`` for programmatic consumers:
       /api/index.json
       /api/site.json
       /api/projects.json
       /api/projects/{slug}.json
       /api/articles.json
       /api/articles/{slug}.json

R2 upload is opt-in: set ``--enable-r2`` AND the R2_* env vars. Without those
the script only writes ``media-urls.json`` (empty map) and the static API.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

# Allow running as both ``python lib/build_postprocess.py`` and as a module.
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from r2_uploader import (  # noqa: E402
    MediaManifest,
    R2Client,
    maybe_create_r2_client,
    upload_if_changed,
)

logger = logging.getLogger("build_postprocess")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

REPO_ROOT = SCRIPT_DIR.parent
PUBLIC_DIR = REPO_ROOT / "public"
PROJECTS_JSON = PUBLIC_DIR / "projects" / "projects.json"
ARTICLES_JSON = PUBLIC_DIR / "articles" / "articles.json"
MEDIA_URL_MAP_PATH = PUBLIC_DIR / "media-urls.json"
API_DIR = PUBLIC_DIR / "api"

API_SCHEMA_VERSION = 1

# ---------------------------------------------------------------------------
# Media reference walking


MEDIA_EXTENSIONS = {
    # images
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".bmp", ".tiff", ".heic",
    # video
    ".mp4", ".mov", ".webm", ".mkv", ".avi", ".ogv", ".wmv",
    # audio
    ".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac",
    # 3d
    ".glb", ".gltf", ".obj", ".fbx", ".stl",
    # docs
    ".pdf",
}


def _looks_like_media(value: str) -> bool:
    if not value or not isinstance(value, str):
        return False
    if value.startswith(("http://", "https://", "mailto:", "tel:", "data:")):
        return False
    lower = value.lower()
    return any(lower.endswith(ext) for ext in MEDIA_EXTENSIONS)


def _resolve_local_public_path(value: str, project_folder: str) -> str | None:
    """Return a path under ``public/`` (rooted with ``/projects/...``) or None."""
    if not value:
        return None
    if value.startswith(("http://", "https://")):
        return None
    cleaned = value.lstrip("./").lstrip("/")
    if cleaned.startswith("projects/"):
        return "/" + cleaned
    if not project_folder:
        return None
    return f"/projects/{project_folder}/{cleaned}"


def _walk_strings(node: Any) -> Iterable[str]:
    """Yield every string value reachable inside a JSON-like structure."""
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for v in node.values():
            yield from _walk_strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from _walk_strings(v)


def collect_project_media_refs(projects: list[dict[str, Any]]) -> set[str]:
    """Collect every public-relative path (``/projects/...``) referenced by the manifest."""
    refs: set[str] = set()
    for project in projects:
        folder = project.get("folderName") or project.get("id") or ""
        for value in _walk_strings(project):
            if not _looks_like_media(value):
                continue
            local = _resolve_local_public_path(value, folder)
            if local:
                refs.add(local)
    return refs


def expand_to_optimized_variants(local_path: str) -> list[str]:
    """For a non-optimized media path, return the optimized siblings that
    actually exist on disk so we upload what the site renders."""
    p = PUBLIC_DIR / local_path.lstrip("/")
    candidates: list[Path] = []
    if p.exists():
        candidates.append(p)

    stem = p.stem
    ext = p.suffix.lower()
    parent = p.parent

    if ext in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".heic", ".avif"}:
        for suffix, new_ext in [("-optimized", ".webp"), ("-thumb", ".webp"), ("-placeholder", ".jpg")]:
            cand = parent / f"{stem}{suffix}{new_ext}"
            if cand.exists() and cand not in candidates:
                candidates.append(cand)
    elif ext == ".svg":
        # SVGs stay as-is.
        pass
    elif ext in {".mov", ".mp4", ".webm", ".mkv", ".avi", ".ogv", ".wmv"}:
        cand = parent / f"{stem}-optimized.mp4"
        if cand.exists() and cand not in candidates:
            candidates.append(cand)
        thumb = parent / f"{stem}-thumb.jpg"
        if thumb.exists() and thumb not in candidates:
            candidates.append(thumb)
    elif ext in {".obj", ".gltf"}:
        cand = parent / f"{stem}.glb"
        if cand.exists() and cand not in candidates:
            candidates.append(cand)

    return [str("/" + c.relative_to(PUBLIC_DIR).as_posix()) for c in candidates]


# ---------------------------------------------------------------------------
# Upload + map


def build_media_url_map(
    projects: list[dict[str, Any]],
    client: R2Client | None,
    manifest: MediaManifest | None,
) -> tuple[dict[str, str], dict[str, int]]:
    """Return mapping of public-relative path -> hosted URL and a stats dict."""
    stats = {"considered": 0, "uploaded": 0, "skipped_existing": 0, "missing_local": 0}
    mapping: dict[str, str] = {}

    if client is None or manifest is None:
        return mapping, stats

    # Walk every referenced media path and expand to its optimized siblings.
    raw_refs = collect_project_media_refs(projects)
    expanded: set[str] = set()
    for ref in raw_refs:
        for variant in expand_to_optimized_variants(ref):
            expanded.add(variant)

    for local_rel in sorted(expanded):
        stats["considered"] += 1
        local_path = PUBLIC_DIR / local_rel.lstrip("/")
        if not local_path.is_file():
            stats["missing_local"] += 1
            continue
        # Manifest key is the public-relative path (stable across builds).
        try:
            url, uploaded = upload_if_changed(
                local_path=local_path,
                source_rel=local_rel.lstrip("/"),
                manifest=manifest,
                client=client,
            )
        except Exception as exc:
            logger.warning("upload failed for %s: %s", local_rel, exc)
            continue
        mapping[local_rel] = url
        if uploaded:
            stats["uploaded"] += 1
        else:
            stats["skipped_existing"] += 1

    return mapping, stats


def write_media_url_map(mapping: dict[str, str]) -> None:
    payload = {
        "schema_version": API_SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "urls": mapping,
    }
    MEDIA_URL_MAP_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


# ---------------------------------------------------------------------------
# Static API generation


def _slim_project(project: dict[str, Any], hosted: dict[str, str]) -> dict[str, Any]:
    folder = project.get("folderName") or project.get("id") or ""
    images = project.get("images") or {}
    primary = None
    for key in ("thumbnail", "hero", "banner", "icon"):
        v = images.get(key)
        if isinstance(v, str) and v:
            local_guess = f"/projects/{folder}/{v}"
            primary = hosted.get(local_guess) or local_guess
            break
    return {
        "id": project.get("id"),
        "slug": project.get("slug"),
        "title": project.get("title"),
        "summary": project.get("summary"),
        "oneLiner": project.get("oneLiner"),
        "tags": project.get("tags", []),
        "status": project.get("status"),
        "featured": bool(project.get("featured", False)),
        "domain": project.get("domain"),
        "category": project.get("category"),
        "href": project.get("href"),
        "primaryImageUrl": primary,
        "updatedAt": project.get("updatedAt"),
    }


def _slim_article(article: dict[str, Any]) -> dict[str, Any]:
    return {
        "slug": article.get("slug"),
        "title": article.get("title"),
        "summary": article.get("summary"),
        "oneLiner": article.get("oneLiner"),
        "tags": article.get("tags", []),
        "series": article.get("series"),
        "publishedAt": article.get("publishedAt"),
        "updatedAt": article.get("updatedAt"),
        "href": article.get("href"),
        "sourceUrl": article.get("sourceUrl"),
        "coverImage": article.get("coverImage"),
        "projectIds": article.get("projectIds", []),
    }


def _envelope(payload: Any, kind: str, count: int | None = None) -> dict[str, Any]:
    env = {
        "schema_version": API_SCHEMA_VERSION,
        "kind": kind,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    }
    if count is not None:
        env["count"] = count
    return env


def _write_api(rel_path: str, payload: dict[str, Any]) -> None:
    out = API_DIR / rel_path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_static_api(
    projects: list[dict[str, Any]],
    articles: list[dict[str, Any]],
    hosted: dict[str, str],
) -> None:
    if API_DIR.exists():
        # Clean stale per-slug files; safe because everything under /api is generated.
        for child in API_DIR.rglob("*"):
            if child.is_file():
                try:
                    child.unlink()
                except Exception:
                    pass

    # Projects
    slim_projects = [_slim_project(p, hosted) for p in projects]
    _write_api(
        "projects.json",
        _envelope(slim_projects, "projects.list", count=len(slim_projects)),
    )
    for project in projects:
        slug = project.get("slug")
        if not isinstance(slug, str) or not slug:
            continue
        _write_api(f"projects/{slug}.json", _envelope(project, "projects.detail"))

    # Articles
    slim_articles = [_slim_article(a) for a in articles]
    _write_api(
        "articles.json",
        _envelope(slim_articles, "articles.list", count=len(slim_articles)),
    )
    for article in articles:
        slug = article.get("slug")
        if not isinstance(slug, str) or not slug:
            continue
        _write_api(f"articles/{slug}.json", _envelope(article, "articles.detail"))

    # Site
    site_payload = {
        "name": "Zachary Sturman",
        "url": "https://zacharysturman.com",
        "counts": {
            "projects": len(projects),
            "articles": len(articles),
        },
    }
    _write_api("site.json", _envelope(site_payload, "site"))

    # Index / discovery doc
    index_payload = {
        "endpoints": [
            {"path": "/api/site.json", "kind": "site"},
            {"path": "/api/projects.json", "kind": "projects.list"},
            {"path": "/api/projects/{slug}.json", "kind": "projects.detail"},
            {"path": "/api/articles.json", "kind": "articles.list"},
            {"path": "/api/articles/{slug}.json", "kind": "articles.detail"},
        ],
        "schema_versioning": (
            "Each endpoint envelope includes 'schema_version'. Breaking changes "
            "bump the integer; additive fields do not."
        ),
    }
    _write_api("index.json", _envelope(index_payload, "index"))


# ---------------------------------------------------------------------------
# Entry point


def _read_json(path: Path) -> Any:
    if not path.exists():
        return None
    return json.loads(path.read_text("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Build post-process: media + static API")
    parser.add_argument("--enable-r2", action="store_true", help="Upload media to R2 (env vars required)")
    parser.add_argument("--dry-run", action="store_true", help="Plan uploads without sending")
    parser.add_argument("--media-only", action="store_true", help="Skip writing /api/** endpoints")
    args = parser.parse_args()

    projects = _read_json(PROJECTS_JSON) or []
    if not isinstance(projects, list):
        logger.warning("projects.json is not a list; treating as empty")
        projects = []
    articles_raw = _read_json(ARTICLES_JSON) or []
    if not isinstance(articles_raw, list):
        articles = []
    else:
        articles = articles_raw

    hosted: dict[str, str] = {}
    stats = {"considered": 0, "uploaded": 0, "skipped_existing": 0, "missing_local": 0}

    if args.enable_r2:
        client = maybe_create_r2_client(dry_run=args.dry_run)
        if client is None:
            logger.warning("--enable-r2 set but R2 env vars are missing; skipping uploads")
        else:
            manifest = MediaManifest()
            hosted, stats = build_media_url_map(projects, client, manifest)
            if not args.dry_run:
                manifest.save()
            logger.info(
                "media: considered=%s uploaded=%s cached=%s missing=%s",
                stats["considered"], stats["uploaded"], stats["skipped_existing"], stats["missing_local"],
            )

    write_media_url_map(hosted)

    if not args.media_only:
        write_static_api(projects, articles, hosted)
        logger.info("wrote static API to %s", API_DIR)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
