#!/usr/bin/env python3
"""JSON-driven projects pipeline.

This module reads the n8n-exported `new_projects.json`, validates required fields,
normalizes data to the UI contract, copies referenced assets into a pre-build
`public/projects` directory, and returns JSON-serializable project objects.
"""

from __future__ import annotations

import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
from urllib.parse import unquote, urlparse

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff"}
IMAGE_EXTS_FULL = IMAGE_EXTS | {".svg", ".heic", ".avif"}
VIDEO_EXTS = {".mov", ".mp4", ".webm", ".mkv", ".avi", ".flv", ".ogv", ".wmv", ".mpg", ".mpeg"}
AUDIO_EXTS = {".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac", ".opus"}
MODEL_EXTS = {".glb", ".gltf", ".obj", ".fbx", ".stl", ".dae", ".3ds", ".ply"}
GAME_EXTS = {".html", ".htm", ".unityweb", ".wasm"}
TEXT_EXTS = {".md", ".markdown", ".txt", ".tex", ".csv", ".json", ".pdf"}

INTERNAL_LINK_TYPES = {"folio", "local-link"}
INTERNAL_LINK_PREFIX = "local-link:"
DOWNLOAD_RESOURCE_TYPES = {"local-download"}
DOWNLOAD_RESOURCE_CATEGORIES = {"download"}
PREVIEW_IMAGE_ROLES = {"thumbnail", "banner", "hero", "poster", "posterPortrait", "posterLandscape", "icon"}

UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")
BARE_DOMAIN_RE = re.compile(
    r"^(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63}(?::\d+)?(?:/[^\s]*)?$"
)

_FILENAME_SEARCH_CACHE: Dict[Tuple[str, str], Optional[Path]] = {}


def determine_collection_item_type(raw_type: Optional[str], path_val: Optional[str]) -> str:
    """Return a canonical collection item type."""
    if raw_type and isinstance(raw_type, str):
        t = raw_type.strip().lower()

        if t == "url":
            return "url-link"
        if t == "folio":
            return "folio"

        if t in {"image", "video", "3d-model", "3d", "game", "text", "audio", "url-link"}:
            return "3d-model" if t == "3d" else t

        if t != "file":
            if t.startswith("."):
                t = t[1:]

            if t in {ext.lstrip(".") for ext in IMAGE_EXTS_FULL}:
                return "image"
            if t in {ext.lstrip(".") for ext in VIDEO_EXTS}:
                return "video"
            if t in {ext.lstrip(".") for ext in AUDIO_EXTS}:
                return "audio"
            if t in {ext.lstrip(".") for ext in MODEL_EXTS}:
                return "3d-model"
            if t in {ext.lstrip(".") for ext in GAME_EXTS}:
                return "game"
            if t in {ext.lstrip(".") for ext in TEXT_EXTS}:
                return "text"

    if path_val and isinstance(path_val, str):
        if path_val.strip().startswith(("http://", "https://", "ftp://")):
            return "url-link"
        try:
            p = Path(unquote(path_val))
            ext = p.suffix.lower()
            if ext in IMAGE_EXTS_FULL:
                return "image"
            if ext in VIDEO_EXTS:
                return "video"
            if ext in AUDIO_EXTS:
                return "audio"
            if ext in MODEL_EXTS:
                return "3d-model"
            if ext in GAME_EXTS:
                return "game"
            if ext in TEXT_EXTS:
                return "text"
        except Exception:
            pass

    if path_val and isinstance(path_val, str):
        lower = path_val.lower()
        for extset, canonical in (
            (IMAGE_EXTS_FULL, "image"),
            (VIDEO_EXTS, "video"),
            (AUDIO_EXTS, "audio"),
            (MODEL_EXTS, "3d-model"),
            (GAME_EXTS, "game"),
            (TEXT_EXTS, "text"),
        ):
            for ext in extset:
                if ext in lower or ext.lstrip(".") in lower:
                    return canonical

    return "image"


def slugify(name: str) -> str:
    s = (name or "").strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s-]+", "_", s).strip("_")
    return s or "untitled"


def make_project_folder_name(title: str, project_id: str) -> str:
    return f"{slugify(title)}_{project_id}"


def extract_external_image_hostnames(projects: List[Dict[str, Any]]) -> Set[str]:
    hostnames: Set[str] = set()

    def maybe_add(url_val: Any) -> None:
        if not isinstance(url_val, str):
            return
        value = url_val.strip()
        if not value or value.startswith("/") or "://" not in value:
            return
        try:
            parsed = urlparse(value)
        except Exception:
            return
        if parsed.hostname:
            hostnames.add(parsed.hostname)

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            for v in value.values():
                walk(v)
            return
        if isinstance(value, list):
            for v in value:
                walk(v)
            return
        maybe_add(value)

    for project in projects:
        walk(project)

    return hostnames


def _as_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        s = value.strip()
        return s or None
    return str(value)


def _first_non_empty(*vals: Any) -> Optional[str]:
    for val in vals:
        s = _as_str(val)
        if s:
            return s
    return None


def _normalize_text_list(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        out: List[str] = []
        for entry in value:
            s = _as_str(entry)
            if s:
                out.append(s)
        return out
    s = _as_str(value)
    return [s] if s else []


def _normalize_category(value: Any) -> Optional[str]:
    if isinstance(value, list):
        return _first_non_empty(*value)
    return _as_str(value)


def _normalize_url(raw_url: Any) -> Optional[str]:
    s = _as_str(raw_url)
    if not s:
        return None
    if s.startswith("/"):
        return s
    if SCHEME_RE.match(s):
        return s
    if BARE_DOMAIN_RE.match(s):
        return f"https://{s}"
    return s


def _get_nested(raw_obj: Dict[str, Any], key: str) -> Any:
    vals = raw_obj.get(key)
    if isinstance(vals, list):
        if not vals:
            return None
        first = vals[0]
        if isinstance(first, dict) and "start" in first:
            return first.get("start")
        return first
    return vals


def _extract_uuid(value: str) -> Optional[str]:
    if not value:
        return None
    match = UUID_RE.search(value)
    if not match:
        return None
    return match.group(0)


def _decode_file_uri(uri: str) -> Optional[Path]:
    try:
        parsed = urlparse(uri)
        return Path(unquote(parsed.path))
    except Exception:
        return None


def _extract_path_candidate(value: Any) -> Optional[str]:
    if isinstance(value, str):
        return value
    if not isinstance(value, dict):
        return None

    for key in ("relativePath", "path", "filePath", "filename", "url"):
        candidate = _as_str(value.get(key))
        if candidate:
            return candidate
    return None


def _extract_filename_candidate(value: Any) -> Optional[str]:
    if isinstance(value, str):
        p = Path(unquote(value))
        return p.name if p.name else None

    if not isinstance(value, dict):
        return None

    for key in ("filename", "fileName", "name"):
        candidate = _as_str(value.get(key))
        if candidate:
            p = Path(unquote(candidate))
            return p.name if p.name else None

    path_candidate = _extract_path_candidate(value)
    if path_candidate:
        p = Path(unquote(path_candidate))
        return p.name if p.name else None
    return None


def _build_source_candidates(path_value: Any, root_path: Path) -> List[Path]:
    candidate = _extract_path_candidate(path_value)
    if not candidate:
        return []

    if isinstance(candidate, str) and candidate.startswith("file://"):
        decoded = _decode_file_uri(candidate)
        return [decoded] if decoded else []

    decoded_value = unquote(str(candidate))
    if decoded_value.startswith(("http://", "https://", "ftp://")):
        return []

    filename = _extract_filename_candidate(path_value)
    candidates: List[Path] = []
    candidate_values = [decoded_value]
    if " // " in decoded_value:
        candidate_values.append(decoded_value.replace(" // ", " :: "))

    def add_path(p: Path) -> None:
        if p not in candidates:
            candidates.append(p)

    for candidate_value in candidate_values:
        base_path = Path(candidate_value)
        if base_path.is_absolute():
            add_path(base_path)
            if filename and base_path.name != filename:
                add_path(base_path / filename)
            continue

        add_path(root_path / base_path)
        add_path(base_path)

        if filename and base_path.name != filename:
            add_path(root_path / base_path / filename)
            add_path(base_path / filename)

    return candidates


def _find_unique_file_by_name(root_path: Path, filename: str) -> Optional[Path]:
    if not filename:
        return None

    try:
        root_key = root_path.expanduser().resolve(strict=False).as_posix()
    except Exception:
        root_key = root_path.as_posix()

    cache_key = (root_key, filename)
    if cache_key in _FILENAME_SEARCH_CACHE:
        return _FILENAME_SEARCH_CACHE[cache_key]

    matches: List[Path] = []
    try:
        for match in root_path.rglob(filename):
            if not match.is_file():
                continue
            matches.append(match)
            if len(matches) > 1:
                break
    except Exception:
        _FILENAME_SEARCH_CACHE[cache_key] = None
        return None

    resolved = matches[0] if len(matches) == 1 else None
    _FILENAME_SEARCH_CACHE[cache_key] = resolved
    return resolved


def _resolve_source_path_fallback(path_value: Any, root_path: Path) -> Optional[Path]:
    raw_candidate = _extract_path_candidate(path_value)
    if not raw_candidate:
        return None

    decoded_value = unquote(str(raw_candidate))
    if decoded_value.startswith(("http://", "https://", "ftp://", "file://")):
        return None

    parsed_path = Path(decoded_value)
    filename = _extract_filename_candidate(path_value)
    if not filename:
        return None

    # If we only got a bare filename (no folder), recover by unique filename lookup under root_path.
    if len(parsed_path.parts) <= 1:
        return _find_unique_file_by_name(root_path, filename)

    return None


def resolve_source_path(path_value: Any, root_path: Path) -> Optional[Path]:
    candidates = _build_source_candidates(path_value, root_path)
    if not candidates:
        return None

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate

    fallback = _resolve_source_path_fallback(path_value, root_path)
    if fallback and fallback.exists() and fallback.is_file():
        return fallback

    print(f"⚠️ Missing source file. Tried: {', '.join(str(c) for c in candidates)}")
    return candidates[0]


def _copy_file_if_exists(src: Optional[Path], dest_dir: Path, copied: List[str], warnings: List[str], context: str) -> Optional[str]:
    if src is None:
        return None
    if not src.exists() or not src.is_file():
        warnings.append(f"Missing file for {context}: {src}")
        return None

    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    shutil.copy2(src, dest)
    copied.append(str(dest))
    return dest.name


def _normalize_path_fingerprint(path: Path) -> str:
    try:
        normalized = path.expanduser().resolve(strict=False)
    except Exception:
        normalized = path
    return f"path:{normalized.as_posix()}"


def _asset_reference_fingerprint(value: Any, root_path: Path) -> Optional[str]:
    candidate = _extract_path_candidate(value)
    if not candidate:
        return None

    raw_candidate = str(candidate).strip()
    if not raw_candidate:
        return None

    if raw_candidate.startswith("file://"):
        decoded = _decode_file_uri(raw_candidate)
        if decoded:
            return _normalize_path_fingerprint(decoded)
        return None

    normalized_url = _normalize_url(raw_candidate)
    if normalized_url and normalized_url.startswith(("http://", "https://", "ftp://")):
        return f"url:{normalized_url}"

    candidates = _build_source_candidates(value, root_path)
    if not candidates:
        return None

    return _normalize_path_fingerprint(candidates[0])


def _add_asset_reference_fingerprint(fingerprints: Set[str], value: Any, root_path: Path) -> None:
    fingerprint = _asset_reference_fingerprint(value, root_path)
    if fingerprint:
        fingerprints.add(fingerprint)


def _resolve_internal_target(value: Any, alias_to_project_id: Dict[str, str]) -> Optional[str]:
    raw = _as_str(value)
    if not raw:
        return None

    candidate = raw
    if candidate.startswith("/projects/"):
        project_candidate = candidate.rsplit("/", 1)[-1]
        return alias_to_project_id.get(project_candidate)

    direct = alias_to_project_id.get(candidate)
    if direct:
        return direct

    from_uuid = _extract_uuid(candidate)
    if from_uuid:
        resolved = alias_to_project_id.get(from_uuid)
        if resolved:
            return resolved

    return None


def _resource_looks_like_download(resource: Dict[str, Any]) -> bool:
    category = (_as_str(resource.get("category")) or "").lower()
    resource_type = (_as_str(resource.get("type")) or "").lower()
    if category in DOWNLOAD_RESOURCE_CATEGORIES:
        return True
    if resource_type in DOWNLOAD_RESOURCE_TYPES:
        return True
    return False


def _normalize_resource(
    resource: Dict[str, Any],
    *,
    root_path: Path,
    project_folder_name: str,
    project_dest_dir: Path,
    alias_to_project_id: Dict[str, str],
    copied: List[str],
    warnings: List[str],
    context: str,
) -> Optional[Dict[str, Any]]:
    raw_type = _as_str(resource.get("type"))
    raw_icon = _as_str(resource.get("icon"))
    raw_category = _as_str(resource.get("category"))
    label = _first_non_empty(resource.get("label"), resource.get("name"), "Resource") or "Resource"

    normalized_type = (raw_icon or raw_type or "website").strip()
    normalized_category = raw_category

    lowered_type = (raw_type or "").lower()
    lowered_category = (raw_category or "").lower()

    internal_link = lowered_type in INTERNAL_LINK_TYPES or lowered_category in INTERNAL_LINK_TYPES or lowered_type.startswith(INTERNAL_LINK_PREFIX)
    if internal_link:
        internal_raw = _as_str(resource.get("url"))
        if lowered_type.startswith(INTERNAL_LINK_PREFIX):
            internal_raw = raw_type.split(":", 1)[1] if raw_type and ":" in raw_type else internal_raw

        target_id = _resolve_internal_target(internal_raw, alias_to_project_id)
        if not target_id:
            warnings.append(f"Dropped unresolved internal resource in {context}: {internal_raw}")
            return None

        return {
            "type": "local-link",
            "label": label,
            "url": f"/projects/{target_id}",
            **({"category": normalized_category} if normalized_category else {}),
        }

    if _resource_looks_like_download(resource):
        source_path = resolve_source_path(resource, root_path)
        filename = _copy_file_if_exists(
            source_path,
            project_dest_dir,
            copied,
            warnings,
            f"download resource ({context})",
        )
        if not filename:
            return None

        return {
            "type": normalized_type,
            "label": label,
            "url": f"/projects/{project_folder_name}/{filename}",
            "category": normalized_category or "download",
        }

    normalized_url = _normalize_url(resource.get("url"))
    if not normalized_url:
        warnings.append(f"Dropped resource missing URL in {context}: {label}")
        return None

    out = {
        "type": normalized_type,
        "label": label,
        "url": normalized_url,
    }
    if normalized_category:
        out["category"] = normalized_category

    return out


def _infer_project_image_roles(asset_like: Dict[str, Any]) -> List[str]:
    candidates = " ".join(
        filter(
            None,
            [
                _as_str(asset_like.get("type")),
                _as_str(asset_like.get("label")),
                _as_str(asset_like.get("name")),
                _as_str(asset_like.get("filename")),
                _as_str(asset_like.get("relativePath")),
                _as_str(asset_like.get("filePath")),
                _as_str(asset_like.get("path")),
                _as_str(asset_like.get("url")),
            ],
        )
    ).lower()

    if not candidates:
        return []

    roles: List[str] = []
    if "thumbnail" in candidates or "thumb" in candidates:
        roles.append("thumbnail")
    if "banner" in candidates:
        roles.append("banner")
    if "hero" in candidates:
        roles.append("hero")
    if "poster" in candidates:
        if "portrait" in candidates or "vertical" in candidates:
            roles.append("posterPortrait")
        elif "landscape" in candidates or "horizontal" in candidates:
            roles.append("posterLandscape")
        else:
            roles.append("poster")
    if "icon" in candidates or "logo" in candidates:
        roles.append("icon")

    return roles


def _normalize_item_type(item: Dict[str, Any]) -> str:
    raw_type = _as_str(item.get("type"))
    path_val = _first_non_empty(
        item.get("relativePath"),
        item.get("filePath"),
        item.get("path"),
        item.get("filename"),
        item.get("url"),
    )
    return determine_collection_item_type(raw_type, path_val)


def _normalize_relation_ids(value: Any) -> List[str]:
    if isinstance(value, list):
        out: List[str] = []
        for entry in value:
            s = _as_str(entry)
            if s:
                out.append(s)
        return out
    s = _as_str(value)
    return [s] if s else []


def _extract_work_log_timestamp(value: Any) -> Optional[str]:
    if isinstance(value, dict):
        return _first_non_empty(value.get("start"), value.get("date"), value.get("value"))
    return _as_str(value)


def _extract_started_last_update_dates(value: Any) -> Tuple[Optional[str], Optional[str]]:
    if isinstance(value, list):
        first = value[0] if value else None
        return _extract_started_last_update_dates(first)

    if isinstance(value, dict):
        return (
            _first_non_empty(value.get("start"), value.get("date"), value.get("value")),
            _first_non_empty(value.get("end")),
        )

    if isinstance(value, str):
        normalized = _as_str(value)
        return normalized, None

    return None, None


def _to_timestamp(value: Optional[str]) -> float:
    s = _as_str(value)
    if not s:
        return 0.0

    normalized = s
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"

    try:
        return datetime.fromisoformat(normalized).timestamp()
    except Exception:
        pass

    try:
        return datetime.fromisoformat(normalized.split("T", 1)[0]).timestamp()
    except Exception:
        return 0.0


def _normalize_work_log(work_log: Dict[str, Any], fallback_timestamp: Optional[str], order_index: int) -> Dict[str, Any]:
    work_log_id = _first_non_empty(work_log.get("id"), work_log.get("name"), f"work-log-{order_index}") or f"work-log-{order_index}"
    title = _first_non_empty(work_log.get("entry"), work_log.get("name"), work_log_id) or work_log_id

    date_raw = work_log.get("dateRaw")
    start_time = _first_non_empty(
        _extract_work_log_timestamp(work_log.get("sessionStart")),
        _extract_work_log_timestamp(work_log.get("date")),
        _extract_work_log_timestamp(date_raw),
        fallback_timestamp,
    )
    end_time = _first_non_empty(
        _extract_work_log_timestamp(work_log.get("sessionEnd")),
        _extract_work_log_timestamp(date_raw.get("end")) if isinstance(date_raw, dict) else None,
        start_time,
    )

    out: Dict[str, Any] = {
        "id": work_log_id,
        "title": title,
        "entry": _as_str(work_log.get("entry")) or title,
        "url": _normalize_url(work_log.get("url")),
        "startTime": start_time,
        "endTime": end_time,
        "date": _as_str(work_log.get("date")) or start_time,
        "sessionType": _normalize_text_list(work_log.get("sessionType")),
        "whatHappened": _as_str(work_log.get("whatHappened")),
        "problems": _as_str(work_log.get("problems")),
        "nextStep": _as_str(work_log.get("nextStep")),
    }

    feel = work_log.get("feelGoodAboutWork")
    accomplished = work_log.get("accomplishedWhatYouWanted")
    if isinstance(feel, (int, float)):
        out["feelGoodAboutWork"] = float(feel)
    if isinstance(accomplished, (int, float)):
        out["accomplishedWhatYouWanted"] = float(accomplished)

    start_ts = _to_timestamp(start_time)
    end_ts = _to_timestamp(end_time)
    if start_ts and end_ts and end_ts >= start_ts:
        out["durationMinutes"] = int(round((end_ts - start_ts) / 60.0))

    return out


def _dedupe_resources(resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: Set[Tuple[str, str, str, str]] = set()
    out: List[Dict[str, Any]] = []
    for resource in resources:
        if not isinstance(resource, dict):
            continue
        key = (
            (_as_str(resource.get("type")) or "").lower(),
            _as_str(resource.get("label")) or "",
            _as_str(resource.get("url")) or "",
            (_as_str(resource.get("category")) or "").lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(resource)
    return out


def _pick_source_project_thumbnail_asset(source_project: Dict[str, Any]) -> Any:
    explicit_thumbnail = source_project.get("thumbnail")
    if explicit_thumbnail:
        return explicit_thumbnail

    assets = source_project.get("assets")
    if not isinstance(assets, list):
        return None

    for asset in assets:
        if not isinstance(asset, dict):
            continue
        if "thumbnail" in _infer_project_image_roles(asset):
            return asset

    return None


def _resolve_collection_item_target_project_id(
    item: Dict[str, Any],
    *,
    item_url: Optional[str],
    alias_to_project_id: Dict[str, str],
    current_project_id: Optional[str],
) -> Optional[str]:
    raw_item = item.get("raw") if isinstance(item.get("raw"), dict) else {}

    explicit_candidates: List[Any] = [
        item_url,
        item.get("url"),
        item.get("projectReferenceId"),
        item.get("projectId"),
        item.get("projectSlug"),
        raw_item.get("property_url"),
        raw_item.get("property_project_page"),
        raw_item.get("property_project_page_id"),
    ]

    for candidate in explicit_candidates:
        resolved = _resolve_internal_target(candidate, alias_to_project_id)
        if resolved and resolved != current_project_id:
            return resolved

    has_explicit_reference = any(_as_str(candidate) for candidate in explicit_candidates)
    if has_explicit_reference:
        return None

    relation_candidates: List[str] = []
    relation_candidates.extend(_normalize_relation_ids(item.get("projectIds")))
    relation_candidates.extend(_normalize_relation_ids(raw_item.get("property_projects")))
    relation_candidates.extend(_normalize_relation_ids(raw_item.get("property_project")))
    relation_candidates.extend(_normalize_relation_ids(raw_item.get("property_project_id")))

    for candidate in relation_candidates:
        resolved = _resolve_internal_target(candidate, alias_to_project_id)
        if resolved and resolved != current_project_id:
            return resolved

    return None


def _normalize_source_project_resources(
    source_project: Dict[str, Any],
    *,
    root_path: Path,
    public_projects_root: Path,
    alias_to_project_id: Dict[str, str],
    copied: List[str],
    warnings: List[str],
    context: str,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    source_resources = source_project.get("resources")
    if not isinstance(source_resources, list):
        return out

    source_project_id = _as_str(source_project.get("id")) or "unknown-project"
    source_project_title = _first_non_empty(source_project.get("title"), source_project.get("name"), source_project_id) or source_project_id
    source_project_folder_name = make_project_folder_name(source_project_title, source_project_id)
    source_project_dest_dir = public_projects_root / source_project_folder_name

    for resource in source_resources:
        if not isinstance(resource, dict):
            continue
        normalized = _normalize_resource(
            resource,
            root_path=root_path,
            project_folder_name=source_project_folder_name,
            project_dest_dir=source_project_dest_dir,
            alias_to_project_id=alias_to_project_id,
            copied=copied,
            warnings=warnings,
            context=context,
        )
        if normalized:
            out.append(normalized)

    return _dedupe_resources(out)


def _extract_source_collection_ids(source: Dict[str, Any]) -> List[str]:
    explicit = _normalize_relation_ids(source.get("collectionIds"))
    if explicit:
        return explicit

    raw_obj = source.get("raw") if isinstance(source.get("raw"), dict) else {}
    return _normalize_relation_ids(raw_obj.get("property_collections"))


def _collection_fallback_label(source: Dict[str, Any], collection_id: str, index: int) -> str:
    if (collection_name := _first_non_empty(source.get("title"), source.get("name"))):
        return collection_name if index == 0 else f"{collection_name} {index + 1}"
    return f"Collection {index + 1} ({collection_id})"


def _normalize_collection_item(
    item: Dict[str, Any],
    *,
    root_path: Path,
    current_project_id: str,
    project_folder_name: str,
    project_dest_dir: Path,
    collection_name: str,
    alias_to_project_id: Dict[str, str],
    source_projects_by_id: Dict[str, Dict[str, Any]],
    copied: List[str],
    warnings: List[str],
    order_index: int,
) -> Dict[str, Any]:
    item_id = _first_non_empty(item.get("id"), item.get("name"), item.get("label"))
    if item_id:
        normalized_item_id = item_id
    else:
        normalized_item_id = slugify(f"item-{order_index}")

    label = _first_non_empty(item.get("label"), item.get("name"), normalized_item_id) or normalized_item_id
    order_value = item.get("order")
    if isinstance(order_value, (int, float)):
        order = int(order_value)
    else:
        order = order_index

    item_type = _normalize_item_type(item)

    item_dir = project_dest_dir / collection_name / normalized_item_id

    file_source = resolve_source_path(item, root_path)
    copied_file_name = _copy_file_if_exists(
        file_source,
        item_dir,
        copied,
        warnings,
        f"collection item file ({collection_name}/{normalized_item_id})",
    )

    thumbnail_source = resolve_source_path(item.get("thumbnail"), root_path)
    copied_thumbnail = _copy_file_if_exists(
        thumbnail_source,
        item_dir,
        copied,
        warnings,
        f"collection item thumbnail ({collection_name}/{normalized_item_id})",
    )

    normalized_resources: List[Dict[str, Any]] = []
    for r in item.get("resources") or []:
        if not isinstance(r, dict):
            continue
        normalized = _normalize_resource(
            r,
            root_path=root_path,
            project_folder_name=project_folder_name,
            project_dest_dir=project_dest_dir,
            alias_to_project_id=alias_to_project_id,
            copied=copied,
            warnings=warnings,
            context=f"collection item {collection_name}/{normalized_item_id}",
        )
        if normalized:
            normalized_resources.append(normalized)

    singular_resource = None
    if isinstance(item.get("resource"), dict):
        singular_resource = _normalize_resource(
            item["resource"],
            root_path=root_path,
            project_folder_name=project_folder_name,
            project_dest_dir=project_dest_dir,
            alias_to_project_id=alias_to_project_id,
            copied=copied,
            warnings=warnings,
            context=f"collection item {collection_name}/{normalized_item_id}",
        )
    if singular_resource:
        normalized_resources.insert(0, singular_resource)

    out: Dict[str, Any] = {
        "id": normalized_item_id,
        "label": label,
        "order": order,
        "type": item_type,
    }

    summary = _as_str(item.get("summary"))
    if summary:
        out["summary"] = summary

    if copied_file_name:
        out["filePath"] = copied_file_name

    if copied_thumbnail:
        out["thumbnail"] = copied_thumbnail

    raw_item = item.get("raw") if isinstance(item.get("raw"), dict) else {}
    item_url = _normalize_url(_first_non_empty(item.get("url"), raw_item.get("property_url")))
    target_id = None
    if item_type in {"url-link", "folio"}:
        target_id = _resolve_collection_item_target_project_id(
            item,
            item_url=item_url,
            alias_to_project_id=alias_to_project_id,
            current_project_id=current_project_id,
        )
        if target_id:
            out["url"] = f"/projects/{target_id}"
            out["type"] = "url-link"
        elif item_url:
            out["url"] = item_url

    source_target_project = source_projects_by_id.get(target_id) if target_id else None

    if source_target_project and not copied_thumbnail:
        source_thumbnail = _pick_source_project_thumbnail_asset(source_target_project)
        fallback_thumbnail = _copy_file_if_exists(
            resolve_source_path(source_thumbnail, root_path),
            item_dir,
            copied,
            warnings,
            f"collection item thumbnail ({collection_name}/{normalized_item_id}) from project {target_id}",
        )
        if fallback_thumbnail:
            out["thumbnail"] = fallback_thumbnail

    if source_target_project:
        inherited_resources = _normalize_source_project_resources(
            source_target_project,
            root_path=root_path,
            public_projects_root=project_dest_dir.parent,
            alias_to_project_id=alias_to_project_id,
            copied=copied,
            warnings=warnings,
            context=f"collection item {collection_name}/{normalized_item_id} via project {target_id}",
        )
        if inherited_resources:
            normalized_resources = _dedupe_resources(inherited_resources + normalized_resources)

        if "summary" not in out:
            inherited_summary = _as_str(source_target_project.get("summary"))
            if inherited_summary:
                out["summary"] = inherited_summary

    if normalized_resources:
        deduped_resources = _dedupe_resources(normalized_resources)
        out["resources"] = deduped_resources
        out["resource"] = deduped_resources[0]

    return out


def _normalize_collection(
    collection: Dict[str, Any],
    *,
    root_path: Path,
    current_project_id: str,
    project_folder_name: str,
    project_dest_dir: Path,
    alias_to_project_id: Dict[str, str],
    source_projects_by_id: Dict[str, Dict[str, Any]],
    copied: List[str],
    warnings: List[str],
) -> Tuple[str, Dict[str, Any]]:
    collection_name = _first_non_empty(collection.get("name"), collection.get("label"), "Collection") or "Collection"
    label = _first_non_empty(collection.get("label"), collection_name) or collection_name
    collection_dest_dir = project_dest_dir / collection_name

    out: Dict[str, Any] = {
        "label": label,
        "summary": _first_non_empty(collection.get("summary"), collection.get("oneLiner")) or "",
        "images": {},
        "items": [],
    }

    description = _as_str(collection.get("description"))
    if description:
        out["description"] = description

    collection_thumbnail_source = resolve_source_path(collection.get("thumbnail"), root_path)
    collection_thumbnail = _copy_file_if_exists(
        collection_thumbnail_source,
        collection_dest_dir,
        copied,
        warnings,
        f"collection thumbnail ({collection_name})",
    )
    if collection_thumbnail:
        out["images"]["thumbnail"] = collection_thumbnail

    items_raw = collection.get("items")
    assets_raw = collection.get("assets")

    if isinstance(items_raw, list) and items_raw:
        collection_items = items_raw
    elif isinstance(assets_raw, list):
        collection_items = assets_raw
    else:
        collection_items = []

    if isinstance(collection_items, list):
        for idx, item in enumerate(collection_items):
            if not isinstance(item, dict):
                continue
            normalized_item = _normalize_collection_item(
                item,
                root_path=root_path,
                current_project_id=current_project_id,
                project_folder_name=project_folder_name,
                project_dest_dir=project_dest_dir,
                collection_name=collection_name,
                alias_to_project_id=alias_to_project_id,
                source_projects_by_id=source_projects_by_id,
                copied=copied,
                warnings=warnings,
                order_index=idx,
            )
            out["items"].append(normalized_item)

    return collection_name, out


def _collect_used_asset_fingerprints(
    source: Dict[str, Any],
    *,
    root_path: Path,
    image_candidates: Dict[str, Any],
) -> Set[str]:
    used_asset_fingerprints: Set[str] = set()

    for role in PREVIEW_IMAGE_ROLES:
        _add_asset_reference_fingerprint(used_asset_fingerprints, source.get(role), root_path)

    for role, asset_like in image_candidates.items():
        if role in PREVIEW_IMAGE_ROLES:
            _add_asset_reference_fingerprint(used_asset_fingerprints, asset_like, root_path)

    for resource in source.get("resources") or []:
        if isinstance(resource, dict) and _resource_looks_like_download(resource):
            _add_asset_reference_fingerprint(used_asset_fingerprints, resource, root_path)

    collections = source.get("collections") if isinstance(source.get("collections"), list) else []
    for collection in collections:
        if not isinstance(collection, dict):
            continue

        _add_asset_reference_fingerprint(used_asset_fingerprints, collection.get("thumbnail"), root_path)

        collection_items = collection.get("items")
        if not isinstance(collection_items, list) or not collection_items:
            collection_items = collection.get("assets")

        if not isinstance(collection_items, list):
            continue

        for item in collection_items:
            if not isinstance(item, dict):
                continue

            # Item main media path is carried directly on the item object.
            _add_asset_reference_fingerprint(used_asset_fingerprints, item, root_path)
            _add_asset_reference_fingerprint(used_asset_fingerprints, item.get("thumbnail"), root_path)

            for resource in item.get("resources") or []:
                if isinstance(resource, dict) and _resource_looks_like_download(resource):
                    _add_asset_reference_fingerprint(used_asset_fingerprints, resource, root_path)

            singular_resource = item.get("resource")
            if isinstance(singular_resource, dict) and _resource_looks_like_download(singular_resource):
                _add_asset_reference_fingerprint(used_asset_fingerprints, singular_resource, root_path)

    return used_asset_fingerprints


def _normalize_project(
    source: Dict[str, Any],
    *,
    root_path: Path,
    public_projects_root: Path,
    alias_to_project_id: Dict[str, str],
    source_projects_by_id: Dict[str, Dict[str, Any]],
    collection_member_projects_by_id: Dict[str, List[Dict[str, Any]]],
    source_work_logs: List[Dict[str, Any]],
    copied: List[str],
    warnings: List[str],
    missing_thumbnail_projects: List[str],
    missing_summary_projects: List[str],
) -> Dict[str, Any]:
    project_id = _as_str(source.get("id")) or ""
    title = _first_non_empty(source.get("title"), source.get("name"), project_id) or project_id

    folder_name = make_project_folder_name(title, project_id)
    project_dest_dir = public_projects_root / folder_name
    project_dest_dir.mkdir(parents=True, exist_ok=True)

    raw_obj = source.get("raw") if isinstance(source.get("raw"), dict) else {}
    project_date_range_raw = source.get("projectDateRangeRaw")
    raw_started_last_updated = raw_obj.get("property_started_at_last_update_at")
    raw_started_at, _ = _extract_started_last_update_dates(raw_obj.get("property_started_at"))
    raw_last_update_at, _ = _extract_started_last_update_dates(raw_obj.get("property_last_update_at"))

    created_at = _first_non_empty(source.get("startedAt"), raw_started_at)
    updated_at = _first_non_empty(source.get("lastUpdateAt"), raw_last_update_at)

    range_start, range_end = _extract_started_last_update_dates(source.get("startedAtLastUpdateAt"))
    if not range_start and not range_end:
        range_start, range_end = _extract_started_last_update_dates(project_date_range_raw)
    if not range_start and not range_end:
        range_start, range_end = _extract_started_last_update_dates(raw_started_last_updated)

    if not created_at:
        created_at = range_start
    if not updated_at:
        updated_at = range_end

    project_out: Dict[str, Any] = {
        "id": project_id,
        "title": title,
        "name": title,
        "subtitle": _as_str(source.get("subtitle")) or "",
        "summary": _as_str(source.get("summary")) or "",
        "domain": _as_str(source.get("domain")) or "Unknown Domain",
        "category": _normalize_category(source.get("category")) or "Other",
        "status": _as_str(source.get("status")) or "unknown",
        "phase": _as_str(source.get("phase")) or "",
        "featured": bool(source.get("featured")),
        "featuredOrder": source.get("featuredOrder"),
        "createdAt": created_at,
        "updatedAt": updated_at,
        "isPublic": bool(source.get("isPublic", True)),
        "tags": _normalize_text_list(source.get("tags")),
        "mediums": _normalize_text_list(source.get("mediums")),
        "genres": _normalize_text_list(source.get("genres")),
        "topics": _normalize_text_list(source.get("topics")),
        "subjects": _normalize_text_list(source.get("subjects")),
        "description": _as_str(source.get("description")) or "",
        "story": _as_str(source.get("story")) or "",
        "images": {},
        "resources": [],
        "collection": {},
        "workLogs": [],
        "folderName": folder_name,
    }

    if not project_out["summary"]:
        missing_summary_projects.append(project_id)

    image_candidates: Dict[str, Any] = {}

    # Always honor explicit project-level preview fields when present.
    for role in PREVIEW_IMAGE_ROLES:
        if source.get(role):
            image_candidates[role] = source.get(role)

    assets = source.get("assets") if isinstance(source.get("assets"), list) else []
    for asset in assets:
        if not isinstance(asset, dict):
            continue
        roles = _infer_project_image_roles(asset)
        for role in roles:
            if role not in image_candidates:
                image_candidates[role] = asset

    for role, asset_like in image_candidates.items():
        src = resolve_source_path(asset_like, root_path)
        copied_name = _copy_file_if_exists(
            src,
            project_dest_dir,
            copied,
            warnings,
            f"project image ({project_id}:{role})",
        )
        if copied_name:
            project_out["images"][role] = copied_name

    if not project_out["images"].get("thumbnail"):
        missing_thumbnail_projects.append(project_id)

    used_asset_fingerprints = _collect_used_asset_fingerprints(
        source,
        root_path=root_path,
        image_candidates=image_candidates,
    )

    for r in source.get("resources") or []:
        if not isinstance(r, dict):
            continue
        normalized = _normalize_resource(
            r,
            root_path=root_path,
            project_folder_name=folder_name,
            project_dest_dir=project_dest_dir,
            alias_to_project_id=alias_to_project_id,
            copied=copied,
            warnings=warnings,
            context=f"project {project_id}",
        )
        if normalized:
            project_out["resources"].append(normalized)

    collected_item_ids: Set[str] = set()
    collections = source.get("collections") if isinstance(source.get("collections"), list) else []
    for collection in collections:
        if not isinstance(collection, dict):
            continue
        collection_name, normalized_collection = _normalize_collection(
            collection,
            root_path=root_path,
            current_project_id=project_id,
            project_folder_name=folder_name,
            project_dest_dir=project_dest_dir,
            alias_to_project_id=alias_to_project_id,
            source_projects_by_id=source_projects_by_id,
            copied=copied,
            warnings=warnings,
        )
        project_out["collection"][collection_name] = normalized_collection
        for collection_item in normalized_collection.get("items", []):
            if isinstance(collection_item, dict):
                collection_item_id = _as_str(collection_item.get("id"))
                if collection_item_id:
                    collected_item_ids.add(collection_item_id)

    source_collection_ids = _extract_source_collection_ids(source)
    for idx, collection_id in enumerate(source_collection_ids):
        related_sources = collection_member_projects_by_id.get(collection_id, [])
        if not related_sources:
            continue

        fallback_collection_key = _collection_fallback_label(source, collection_id, idx)
        if fallback_collection_key in project_out["collection"]:
            continue

        fallback_items: List[Dict[str, Any]] = []
        for member_source in related_sources:
            member_project_id = _as_str(member_source.get("id"))
            if not member_project_id or member_project_id == project_id:
                continue

            target_reference = _first_non_empty(member_source.get("projectPageId"), member_project_id)
            item_source = {
                "id": member_project_id,
                "label": _first_non_empty(member_source.get("title"), member_source.get("name"), member_project_id),
                "summary": _as_str(member_source.get("summary")),
                "type": "URL",
                "projectId": target_reference,
            }
            normalized_fallback_item = _normalize_collection_item(
                item_source,
                root_path=root_path,
                current_project_id=project_id,
                project_folder_name=folder_name,
                project_dest_dir=project_dest_dir,
                collection_name=fallback_collection_key,
                alias_to_project_id=alias_to_project_id,
                source_projects_by_id=source_projects_by_id,
                copied=copied,
                warnings=warnings,
                order_index=len(fallback_items),
            )

            has_visible_content = bool(
                normalized_fallback_item.get("filePath")
                or normalized_fallback_item.get("url")
                or normalized_fallback_item.get("thumbnail")
                or normalized_fallback_item.get("resource")
                or normalized_fallback_item.get("resources")
            )
            if has_visible_content:
                fallback_items.append(normalized_fallback_item)

        if fallback_items:
            project_out["collection"][fallback_collection_key] = {
                "label": fallback_collection_key,
                "summary": _as_str(source.get("oneLiner")) or "",
                "images": {},
                "items": fallback_items,
            }

    assets_collection_items: List[Dict[str, Any]] = []
    for idx, asset in enumerate(assets):
        if not isinstance(asset, dict):
            continue

        inferred_roles = set(_infer_project_image_roles(asset))
        if inferred_roles & PREVIEW_IMAGE_ROLES:
            continue

        asset_id = _as_str(asset.get("id"))
        if asset_id and asset_id in collected_item_ids:
            continue

        asset_fingerprint = _asset_reference_fingerprint(asset, root_path)
        if asset_fingerprint and asset_fingerprint in used_asset_fingerprints:
            continue

        normalized_asset_item = _normalize_collection_item(
            asset,
            root_path=root_path,
            current_project_id=project_id,
            project_folder_name=folder_name,
            project_dest_dir=project_dest_dir,
            collection_name="assets",
            alias_to_project_id=alias_to_project_id,
            source_projects_by_id=source_projects_by_id,
            copied=copied,
            warnings=warnings,
            order_index=idx,
        )

        has_visible_content = bool(
            normalized_asset_item.get("filePath")
            or normalized_asset_item.get("url")
            or normalized_asset_item.get("thumbnail")
            or normalized_asset_item.get("resource")
            or normalized_asset_item.get("resources")
        )
        if has_visible_content:
            assets_collection_items.append(normalized_asset_item)

    if assets_collection_items:
        assets_collection_key = "assets"
        suffix = 2
        while assets_collection_key in project_out["collection"]:
            assets_collection_key = f"assets-{suffix}"
            suffix += 1

        project_out["collection"][assets_collection_key] = {
            "label": "Assets",
            "summary": "Ungrouped project assets",
            "images": {},
            "items": assets_collection_items,
        }

    fallback_work_log_time = created_at or updated_at
    normalized_work_logs: List[Dict[str, Any]] = []
    for idx, work_log in enumerate(source_work_logs):
        if not isinstance(work_log, dict):
            continue
        normalized_work_logs.append(
            _normalize_work_log(work_log, fallback_timestamp=fallback_work_log_time, order_index=idx)
        )

    deduped_work_logs: List[Dict[str, Any]] = []
    seen_work_log_keys: Set[str] = set()
    for work_log in sorted(normalized_work_logs, key=lambda wl: _to_timestamp(_as_str(wl.get("startTime"))), reverse=True):
        key = _first_non_empty(
            work_log.get("id"),
            f"{_as_str(work_log.get('title'))}:{_as_str(work_log.get('startTime'))}",
            f"work-log-{len(deduped_work_logs)}",
        ) or f"work-log-{len(deduped_work_logs)}"
        if key in seen_work_log_keys:
            continue
        seen_work_log_keys.add(key)
        deduped_work_logs.append(work_log)

    project_out["workLogs"] = deduped_work_logs

    return _prune_project_output(project_out)


def _prune_project_output(project: Dict[str, Any]) -> Dict[str, Any]:
    whitelist = {
        "id",
        "title",
        "name",
        "subtitle",
        "summary",
        "domain",
        "category",
        "status",
        "phase",
        "featured",
        "featuredOrder",
        "createdAt",
        "updatedAt",
        "isPublic",
        "tags",
        "mediums",
        "genres",
        "topics",
        "subjects",
        "description",
        "story",
        "images",
        "resources",
        "collection",
        "workLogs",
        "folderName",
    }

    out = {k: v for k, v in project.items() if k in whitelist}
    if out.get("featuredOrder") in (None, ""):
        out.pop("featuredOrder", None)
    return out


def _load_and_validate_input(
    input_json_path: Path, root_path_override: Optional[Path]
) -> Tuple[Path, List[Dict[str, Any]], List[Dict[str, Any]]]:
    try:
        payload = json.loads(input_json_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"Failed to parse input JSON at {input_json_path}: {exc}") from exc

    if not isinstance(payload, dict):
        raise ValueError("Input JSON must be an object with 'config' and 'projects'.")

    config = payload.get("config")
    if not isinstance(config, dict):
        raise ValueError("Input JSON missing required object: config")

    projects = payload.get("projects")
    if not isinstance(projects, list):
        raise ValueError("Input JSON missing required array: projects")

    work_logs = payload.get("workLogs")
    if not isinstance(work_logs, list):
        work_logs = []

    if root_path_override:
        root_path = root_path_override
    else:
        raw_root = _as_str(config.get("root_path"))
        if not raw_root:
            raise ValueError("Missing required config.root_path")
        root_path = Path(raw_root)

    if not root_path.exists() or not root_path.is_dir():
        raise ValueError(f"Resolved root path is not a readable directory: {root_path}")

    seen_ids: Set[str] = set()
    for idx, project in enumerate(projects):
        if not isinstance(project, dict):
            raise ValueError(f"projects[{idx}] must be an object")
        project_id = _as_str(project.get("id"))
        if not project_id:
            raise ValueError(f"projects[{idx}] missing required field: id")
        if project_id in seen_ids:
            raise ValueError(f"Duplicate project id found: {project_id}")
        seen_ids.add(project_id)

        if not _first_non_empty(project.get("title"), project.get("name")):
            raise ValueError(f"projects[{idx}] missing required field: title/name")

    normalized_work_logs: List[Dict[str, Any]] = []
    for work_log in work_logs:
        if isinstance(work_log, dict):
            normalized_work_logs.append(work_log)

    return root_path, projects, normalized_work_logs


def _build_alias_map(projects: Iterable[Dict[str, Any]]) -> Dict[str, str]:
    alias_to_project_id: Dict[str, str] = {}
    for project in projects:
        project_id = _as_str(project.get("id"))
        if not project_id:
            continue

        alias_to_project_id[project_id] = project_id

        for alias_key in ("projectPageId", "filePath"):
            alias_val = _as_str(project.get(alias_key))
            if alias_val:
                alias_to_project_id[alias_val] = project_id

            if alias_val:
                alias_uuid = _extract_uuid(alias_val)
                if alias_uuid:
                    alias_to_project_id[alias_uuid] = project_id

    return alias_to_project_id


def build_projects_from_json(
    *,
    input_json_path: Path,
    temp_public_projects_root: Path,
    root_path_override: Optional[Path] = None,
) -> Dict[str, Any]:
    """Build normalized project data and copy assets into temp_public_projects_root."""
    root_path, source_projects, global_work_logs = _load_and_validate_input(input_json_path, root_path_override)

    alias_to_project_id = _build_alias_map(source_projects)
    source_projects_by_id: Dict[str, Dict[str, Any]] = {}
    collection_member_projects_by_id: Dict[str, List[Dict[str, Any]]] = {}
    for source_project in source_projects:
        if not isinstance(source_project, dict):
            continue
        source_project_id = _as_str(source_project.get("id"))
        if source_project_id:
            source_projects_by_id[source_project_id] = source_project

        raw_obj = source_project.get("raw") if isinstance(source_project.get("raw"), dict) else {}
        in_collection_ids = _normalize_relation_ids(raw_obj.get("property_as_an_item_in_collection"))
        for collection_id in in_collection_ids:
            members = collection_member_projects_by_id.setdefault(collection_id, [])
            members.append(source_project)

    global_work_logs_by_project: Dict[str, List[Dict[str, Any]]] = {}
    for work_log in global_work_logs:
        project_ids = _normalize_relation_ids(work_log.get("projectIds")) or _normalize_relation_ids(work_log.get("projectId"))
        for raw_project_id in project_ids:
            resolved_project_id = alias_to_project_id.get(raw_project_id, raw_project_id)
            global_work_logs_by_project.setdefault(resolved_project_id, []).append(work_log)

    copied: List[str] = []
    warnings: List[str] = []
    missing_thumbnail_projects: List[str] = []
    missing_summary_projects: List[str] = []

    normalized_projects: List[Dict[str, Any]] = []
    for source in source_projects:
        if not isinstance(source, dict):
            continue
        source_project_id = _as_str(source.get("id")) or ""
        source_specific_work_logs = source.get("workLogs") if isinstance(source.get("workLogs"), list) else []
        project_work_logs = [wl for wl in source_specific_work_logs if isinstance(wl, dict)]
        project_work_logs.extend(global_work_logs_by_project.get(source_project_id, []))
        project_out = _normalize_project(
            source,
            root_path=root_path,
            public_projects_root=temp_public_projects_root,
            alias_to_project_id=alias_to_project_id,
            source_projects_by_id=source_projects_by_id,
            collection_member_projects_by_id=collection_member_projects_by_id,
            source_work_logs=project_work_logs,
            copied=copied,
            warnings=warnings,
            missing_thumbnail_projects=missing_thumbnail_projects,
            missing_summary_projects=missing_summary_projects,
        )
        normalized_projects.append(project_out)

    external_hostnames = extract_external_image_hostnames(normalized_projects)

    return {
        "projects": normalized_projects,
        "copied": copied,
        "warnings": warnings,
        "missing_thumbnail_projects": sorted(set(missing_thumbnail_projects)),
        "missing_summary_projects": sorted(set(missing_summary_projects)),
        "external_hostnames": sorted(external_hostnames),
    }
