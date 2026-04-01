#!/usr/bin/env python3
"""Sync Markdown articles from a GitHub repo into public/articles."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import tarfile
import tempfile
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.error import URLError
from urllib.parse import quote, unquote, urlparse
from urllib.request import urlopen

DEFAULT_REPO = "ZSturman/Articles"
DEFAULT_REF = "main"
PUBLIC_ROOT = Path(__file__).parent.parent / "public"
TARGET_ARTICLES_DIR = PUBLIC_ROOT / "articles"
PROJECTS_MANIFEST = PUBLIC_ROOT / "projects" / "projects.json"
MARKDOWN_INDEX_NAMES = {"index.md", "index.markdown"}
MARKDOWN_FILE_EXTS = {".md", ".markdown"}
FRONTMATTER_BOUNDARY = "---"
SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")
MARKDOWN_LINK_RE = re.compile(r"(?P<prefix>!?\[[^\]]*\]\()(?P<target>[^)\n]+)(?P<suffix>\))")
HTML_ATTR_RE = re.compile(r'(?P<attr>\b(?:src|href)=)(?P<quote>["\'])(?P<target>[^"\']+)(?P=quote)')
UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
COMPACT_UUID_RE = re.compile(r"\b[0-9a-fA-F]{32}\b")
PROJECT_REFERENCE_WITH_URL_RE = re.compile(
    r"^(?P<label>.+?)\s*\((?P<target>(?:[a-zA-Z][a-zA-Z0-9+.-]*://|/)[^()]+)\)\s*$"
)
MARKDOWN_REFERENCE_RE = re.compile(r"^\[(?P<label>[^\]]+)\]\((?P<target>[^)\n]+)\)$")


class ArticleSyncError(RuntimeError):
    """Raised when article sync fails validation or fetches."""


def normalize_article_slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.strip().lower().replace("_", "-")
    lowered = lowered.replace("/", "-")
    lowered = re.sub(r"[^a-z0-9\s-]", "", lowered)
    lowered = re.sub(r"[\s-]+", "-", lowered).strip("-")
    return lowered or "article"


def normalize_project_slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.strip().lower().replace("&", " and ")
    lowered = re.sub(r"[^a-z0-9\s-]", "", lowered)
    lowered = re.sub(r"[\s-]+", "-", lowered).strip("-")
    return lowered or "project"


def _as_str(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _coerce_string_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [entry.strip() for entry in value if isinstance(entry, str) and entry.strip()]

    single = _as_str(value)
    return [single] if single else []


def _extract_uuid(value: str) -> Optional[str]:
    match = UUID_RE.search(value)
    if match:
        return match.group(0).lower()

    compact_match = COMPACT_UUID_RE.search(value)
    if not compact_match:
        return None

    compact = compact_match.group(0).lower()
    return f"{compact[:8]}-{compact[8:12]}-{compact[12:16]}-{compact[16:20]}-{compact[20:]}"


def _register_project_alias(
    alias_to_project_id: Dict[str, str],
    alias: Any,
    project_id: str,
    *,
    normalize_slug_alias: bool = False,
) -> None:
    raw_alias = _as_str(alias)
    if not raw_alias:
        return

    candidates = {raw_alias, raw_alias.lower()}

    if raw_alias.startswith("/projects/"):
        project_slug = raw_alias[len("/projects/") :].split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
        if project_slug:
            candidates.add(project_slug)
            candidates.add(project_slug.lower())

    extracted_uuid = _extract_uuid(raw_alias)
    if extracted_uuid:
        candidates.add(extracted_uuid)
        candidates.add(extracted_uuid.replace("-", ""))

    if normalize_slug_alias:
        candidates.add(normalize_project_slug(raw_alias))

    for candidate in candidates:
        alias_to_project_id[candidate] = project_id


def _load_project_alias_map(projects_manifest_path: Optional[Path] = None) -> Dict[str, str]:
    manifest_path = projects_manifest_path or PROJECTS_MANIFEST
    if not manifest_path.exists() or not manifest_path.is_file():
        return {}

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return {}

    if not isinstance(payload, list):
        return {}

    alias_to_project_id: Dict[str, str] = {}
    for project in payload:
        if not isinstance(project, dict):
            continue

        project_id = _as_str(project.get("id"))
        if not project_id:
            continue

        _register_project_alias(alias_to_project_id, project_id, project_id)

        for alias_key in ("slug", "href", "folderName", "filePath", "projectPageId"):
            _register_project_alias(alias_to_project_id, project.get(alias_key), project_id)

        for title_key in ("title", "name"):
            _register_project_alias(alias_to_project_id, project.get(title_key), project_id, normalize_slug_alias=True)

    return alias_to_project_id


def _append_unique_string(values: List[str], seen: set[str], candidate: Optional[str]) -> None:
    normalized = _as_str(candidate)
    if not normalized or normalized in seen:
        return

    seen.add(normalized)
    values.append(normalized)


def _extract_project_reference_candidates(raw_reference: str) -> List[str]:
    stripped = raw_reference.strip()
    candidates: List[str] = []
    seen: set[str] = set()

    def add(candidate: Optional[str], *, normalize_slug_alias: bool = False) -> None:
        normalized = _as_str(candidate)
        if not normalized:
            return
        if normalized not in seen:
            seen.add(normalized)
            candidates.append(normalized)
        if normalize_slug_alias:
            slug_candidate = normalize_project_slug(normalized)
            if slug_candidate not in seen:
                seen.add(slug_candidate)
                candidates.append(slug_candidate)

    add(stripped)

    markdown_reference = MARKDOWN_REFERENCE_RE.match(stripped)
    if markdown_reference:
        add(getMarkdownImageTarget(markdown_reference.group("target")))
        add(markdown_reference.group("label"), normalize_slug_alias=True)

    labeled_reference = PROJECT_REFERENCE_WITH_URL_RE.match(stripped)
    if labeled_reference:
        add(labeled_reference.group("target"))
        add(labeled_reference.group("label"), normalize_slug_alias=True)

    if stripped.startswith("/projects/"):
        project_slug = stripped[len("/projects/") :].split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
        add(project_slug)

    return candidates


def _resolve_project_reference(raw_reference: str, project_alias_map: Dict[str, str]) -> Optional[str]:
    for candidate in _extract_project_reference_candidates(raw_reference):
        direct = project_alias_map.get(candidate) or project_alias_map.get(candidate.lower())
        if direct:
            return direct

        extracted_uuid = _extract_uuid(candidate)
        if extracted_uuid:
            return project_alias_map.get(extracted_uuid) or extracted_uuid

        normalized_slug = normalize_project_slug(candidate)
        resolved_by_slug = project_alias_map.get(normalized_slug)
        if resolved_by_slug:
            return resolved_by_slug

    return None


def _normalize_article_project_ids(
    raw_project_ids: Any,
    raw_projects: Any,
    *,
    project_alias_map: Dict[str, str],
) -> List[str]:
    normalized_project_ids: List[str] = []
    seen_project_ids: set[str] = set()

    for project_id in _coerce_string_list(raw_project_ids):
        resolved_project_id = _resolve_project_reference(project_id, project_alias_map)
        _append_unique_string(normalized_project_ids, seen_project_ids, resolved_project_id or project_id)

    for project_reference in _coerce_string_list(raw_projects):
        resolved_project_id = _resolve_project_reference(project_reference, project_alias_map)
        _append_unique_string(normalized_project_ids, seen_project_ids, resolved_project_id)

    return normalized_project_ids


def _is_markdown_path(path: Path) -> bool:
    return path.suffix.lower() in MARKDOWN_FILE_EXTS


def _choose_markdown_index(article_dir: Path) -> Optional[Path]:
    for candidate in MARKDOWN_INDEX_NAMES:
        candidate_path = article_dir / candidate
        if candidate_path.exists():
            return candidate_path
    return None


def _has_frontmatter(path: Path) -> bool:
    try:
        with path.open("r", encoding="utf-8") as file_handle:
            first_chunk = file_handle.read(16)
    except Exception:
        return False
    normalized = first_chunk.lstrip("\ufeff")
    return normalized.startswith(FRONTMATTER_BOUNDARY)


def _article_source_priority(article_source: Dict[str, Any]) -> Tuple[int, int]:
    layout_score = 1 if article_source["layout"] == "directory" else 0
    assets_score = 1 if article_source.get("asset_root") else 0
    return (layout_score, assets_score)


def _discover_article_sources(source_repo_root: Path) -> List[Dict[str, Any]]:
    article_sources_by_slug: Dict[str, Dict[str, Any]] = {}
    search_roots: List[Path] = []
    articles_root = source_repo_root / "articles"
    if articles_root.exists() and articles_root.is_dir():
        search_roots.append(articles_root)
    search_roots.append(source_repo_root)

    for search_root in search_roots:
        for entry in sorted(search_root.iterdir(), key=lambda path: path.name.lower()):
            if entry.name.startswith("."):
                continue

            article_source: Optional[Dict[str, Any]] = None
            if entry.is_dir():
                index_path = _choose_markdown_index(entry)
                if index_path is None:
                    continue
                article_source = {
                    "slug": normalize_article_slug(entry.name),
                    "layout": "directory",
                    "index_path": index_path,
                    "asset_root": entry,
                }
            elif entry.is_file() and _is_markdown_path(entry):
                if not _has_frontmatter(entry):
                    continue
                article_source = {
                    "slug": normalize_article_slug(entry.stem),
                    "layout": "file",
                    "index_path": entry,
                    "asset_root": search_root,
                }

            if article_source is None:
                continue

            slug = article_source["slug"]
            existing = article_sources_by_slug.get(slug)
            if existing and _article_source_priority(existing) >= _article_source_priority(article_source):
                continue
            article_sources_by_slug[slug] = article_source

    return [article_sources_by_slug[slug] for slug in sorted(article_sources_by_slug)]


def _strip_quotes(value: str) -> str:
    trimmed = value.strip()
    if len(trimmed) >= 2 and trimmed[0] == trimmed[-1] and trimmed[0] in {"'", '"'}:
        return trimmed[1:-1]
    return trimmed


def _parse_inline_list(value: str) -> List[str]:
    inner = value.strip()[1:-1].strip()
    if not inner:
        return []

    items: List[str] = []
    current: List[str] = []
    quote_char: Optional[str] = None
    for char in inner:
        if quote_char:
            if char == quote_char:
                quote_char = None
            else:
                current.append(char)
            continue

        if char in {"'", '"'}:
            quote_char = char
            continue
        if char == ",":
            items.append(_strip_quotes("".join(current)))
            current = []
            continue
        current.append(char)

    items.append(_strip_quotes("".join(current)))
    return [item for item in (entry.strip() for entry in items) if item]


def parse_frontmatter_block(block: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    current_key: Optional[str] = None

    for raw_line in block.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        if stripped.startswith("- "):
            if current_key is None:
                raise ArticleSyncError(f"List item is missing a parent key: {raw_line}")
            existing = result.setdefault(current_key, [])
            if not isinstance(existing, list):
                raise ArticleSyncError(f"Key '{current_key}' mixes scalar and list values")
            existing.append(_strip_quotes(stripped[2:].strip()))
            continue

        if ":" not in line:
            raise ArticleSyncError(f"Could not parse frontmatter line: {raw_line}")

        key, raw_value = line.split(":", 1)
        key = key.strip()
        value = raw_value.strip()
        if not key:
            raise ArticleSyncError(f"Frontmatter line is missing a key: {raw_line}")

        if not value:
            result[key] = []
            current_key = key
            continue

        if value.startswith("[") and value.endswith("]"):
            result[key] = _parse_inline_list(value)
        else:
            result[key] = _strip_quotes(value)
        current_key = None

    return result


def split_frontmatter(text: str) -> Tuple[Dict[str, Any], str]:
    if not text.startswith(FRONTMATTER_BOUNDARY):
        raise ArticleSyncError("Article is missing YAML frontmatter")

    normalized = text.replace("\r\n", "\n")
    lines = normalized.split("\n")
    if not lines or lines[0].strip() != FRONTMATTER_BOUNDARY:
        raise ArticleSyncError("Article frontmatter must begin with ---")

    try:
        closing_index = next(
            idx for idx, line in enumerate(lines[1:], start=1) if line.strip() == FRONTMATTER_BOUNDARY
        )
    except StopIteration as exc:
        raise ArticleSyncError("Article frontmatter is missing a closing ---") from exc

    frontmatter = "\n".join(lines[1:closing_index])
    body = "\n".join(lines[closing_index + 1 :]).lstrip("\n")
    return parse_frontmatter_block(frontmatter), body


def _extract_fragment(target: str) -> Tuple[str, str]:
    if "#" not in target:
        return target, ""
    path_part, fragment = target.split("#", 1)
    return path_part, f"#{fragment}"


def _is_relative_target(target: str) -> bool:
    stripped = target.strip()
    if not stripped:
        return False
    if stripped.startswith(("/", "#", "mailto:", "tel:", "data:")):
        return False
    return not SCHEME_RE.match(stripped)


def _find_asset_by_name(filename: str, search_root: Path) -> Optional[Path]:
    """Search recursively for an asset file by name within search_root.

    Mirrors how project images are resolved: assets are looked up by filename
    within a known folder rather than relying on a path that may be stale or
    incorrect in the source markdown.
    """
    lower_name = filename.lower()
    # Walk sorted so results are deterministic; prefer shallower paths.
    candidates: List[Path] = []
    for path in sorted(search_root.rglob("*")):
        if path.is_file() and path.name.lower() == lower_name:
            candidates.append(path)
    if not candidates:
        return None
    # Prefer the shallowest match (fewest path components relative to root).
    return min(candidates, key=lambda p: len(p.relative_to(search_root).parts))


def _resolve_public_article_target(
    raw_target: str,
    *,
    current_markdown_path: Path,
    current_article_slug: str,
    current_asset_root: Path,
    article_paths_to_slug: Dict[Path, str],
) -> Optional[str]:
    target, fragment = _extract_fragment(raw_target.strip())
    if not _is_relative_target(target):
        return None

    resolved = (current_markdown_path.parent / unquote(target)).resolve()

    if resolved.is_dir():
        index_path = _choose_markdown_index(resolved)
        if index_path is not None:
            resolved = index_path.resolve()

    article_slug = article_paths_to_slug.get(resolved)
    if article_slug:
        return f"/articles/{article_slug}{fragment}"

    try:
        relative = resolved.relative_to(current_asset_root.resolve())
    except ValueError:
        return None

    relative_path = relative.as_posix()
    if not relative_path or relative_path == ".":
        return f"/articles/{current_article_slug}{fragment}"

    if resolved.suffix.lower() in MARKDOWN_FILE_EXTS:
        stem = resolved.stem
        if stem.lower() == "index":
            return f"/articles/{current_article_slug}{fragment}"
        return f"/articles/{current_article_slug}/{stem}{fragment}"

    # If the path does not exist as an actual file, fall back to a filename
    # search within the asset root — the same strategy used for project images,
    # where assets are located by name inside a known folder.
    if not resolved.is_file():
        filename = resolved.name
        if filename:
            found = _find_asset_by_name(filename, current_asset_root.resolve())
            if found:
                try:
                    fallback_relative = found.relative_to(current_asset_root.resolve())
                    encoded_path = "/".join(quote(part, safe="") for part in fallback_relative.parts)
                    return f"/articles/{current_article_slug}/{encoded_path}{fragment}"
                except ValueError:
                    pass
        return None

    encoded_path = "/".join(quote(part, safe="") for part in relative.parts)
    return f"/articles/{current_article_slug}/{encoded_path}{fragment}"


def rewrite_article_markdown(
    markdown: str,
    *,
    slug: str,
    current_markdown_path: Path,
    current_asset_root: Path,
    article_paths_to_slug: Dict[Path, str],
) -> str:

    def replace_markdown_link(match: re.Match[str]) -> str:
        replacement = _resolve_public_article_target(
            match.group("target"),
            current_markdown_path=current_markdown_path,
            current_article_slug=slug,
            current_asset_root=current_asset_root,
            article_paths_to_slug=article_paths_to_slug,
        )
        if not replacement:
            return match.group(0)
        return f"{match.group('prefix')}{replacement}{match.group('suffix')}"

    def replace_html_attr(match: re.Match[str]) -> str:
        replacement = _resolve_public_article_target(
            match.group("target"),
            current_markdown_path=current_markdown_path,
            current_article_slug=slug,
            current_asset_root=current_asset_root,
            article_paths_to_slug=article_paths_to_slug,
        )
        if not replacement:
            return match.group(0)
        return f"{match.group('attr')}{match.group('quote')}{replacement}{match.group('quote')}"

    rewritten = MARKDOWN_LINK_RE.sub(replace_markdown_link, markdown)
    rewritten = HTML_ATTR_RE.sub(replace_html_attr, rewritten)
    return rewritten


def _article_source_url(repo: str, ref: str, slug: str) -> str:
    return f"https://github.com/{repo}/blob/{ref}/articles/{slug}/index.md"


def _download_repo_archive(repo: str, ref: str, temp_dir: Path) -> Path:
    archive_url = f"https://codeload.github.com/{repo}/tar.gz/{ref}"
    archive_path = temp_dir / "articles_repo.tar.gz"
    try:
        with urlopen(archive_url, timeout=60) as response, archive_path.open("wb") as output_file:
            shutil.copyfileobj(response, output_file)
    except URLError as exc:
        raise ArticleSyncError(f"Failed to download articles repo from {archive_url}: {exc}") from exc

    extract_root = temp_dir / "repo"
    extract_root.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive_path, "r:gz") as tar:
        try:
            tar.extractall(extract_root, filter="data")
        except TypeError:
            tar.extractall(extract_root)

    candidates = [entry for entry in extract_root.iterdir() if entry.is_dir()]
    if not candidates:
        raise ArticleSyncError("Downloaded repo archive did not contain a root directory")
    return candidates[0]


def _copy_article_assets(source_dir: Path, dest_dir: Path) -> None:
    for path in source_dir.rglob("*"):
        if path.is_dir():
            continue
        if path.name.lower() in MARKDOWN_INDEX_NAMES:
            continue
        relative = path.relative_to(source_dir)
        destination = dest_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)


def _collect_relative_asset_targets(markdown: str) -> List[str]:
    targets: List[str] = []

    def maybe_add(raw_target: str) -> None:
        target, _fragment = _extract_fragment(raw_target.strip())
        if not _is_relative_target(target):
            return
        if target.lower().endswith((".md", ".markdown")):
            return
        targets.append(target)

    for match in MARKDOWN_LINK_RE.finditer(markdown):
        maybe_add(match.group("target"))
    for match in HTML_ATTR_RE.finditer(markdown):
        maybe_add(match.group("target"))

    deduped: List[str] = []
    seen: set[str] = set()
    for target in targets:
        if target in seen:
            continue
        seen.add(target)
        deduped.append(target)
    return deduped


def _copy_referenced_relative_assets(markdown: str, *, current_markdown_path: Path, asset_root: Path, dest_dir: Path) -> None:
    for relative_target in _collect_relative_asset_targets(markdown):
        resolved = (current_markdown_path.parent / unquote(relative_target)).resolve()
        if resolved.is_dir():
            continue
        if not resolved.exists() or not resolved.is_file():
            continue
        try:
            relative = resolved.relative_to(asset_root.resolve())
        except ValueError:
            continue

        destination = dest_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(resolved, destination)


def _copy_relative_asset_target(*, raw_target: str, current_markdown_path: Path, asset_root: Path, dest_dir: Path) -> None:
    target, _fragment = _extract_fragment(raw_target.strip())
    if not _is_relative_target(target):
        return
    if target.lower().endswith((".md", ".markdown")):
        return

    resolved = (current_markdown_path.parent / unquote(target)).resolve()
    if resolved.is_dir() or not resolved.exists() or not resolved.is_file():
        return

    try:
        relative = resolved.relative_to(asset_root.resolve())
    except ValueError:
        return

    destination = dest_dir / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(resolved, destination)


def _normalize_cover_image(
    raw_value: Any,
    *,
    slug: str,
    current_markdown_path: Path,
    current_asset_root: Path,
    article_paths_to_slug: Dict[Path, str],
) -> Optional[str]:
    if not isinstance(raw_value, str) or not raw_value.strip():
        return None

    value = raw_value.strip()
    resolved_relative = _resolve_public_article_target(
        value,
        current_markdown_path=current_markdown_path,
        current_article_slug=slug,
        current_asset_root=current_asset_root,
        article_paths_to_slug=article_paths_to_slug,
    )
    if resolved_relative:
        return resolved_relative

    return value


def _normalize_article_metadata(
    metadata: Dict[str, Any],
    *,
    slug: str,
    repo: str,
    ref: str,
    current_markdown_path: Path,
    current_asset_root: Path,
    article_paths_to_slug: Dict[Path, str],
    project_alias_map: Dict[str, str],
) -> Dict[str, Any]:
    title = metadata.get("title")
    summary = metadata.get("summary")
    published_at = metadata.get("publishedAt")
    updated_at = metadata.get("updatedAt")
    series = metadata.get("series")
    if not isinstance(title, str) or not title.strip():
        raise ArticleSyncError(f"Article '{slug}' is missing required frontmatter field: title")
    if not isinstance(summary, str) or not summary.strip():
        raise ArticleSyncError(f"Article '{slug}' is missing required frontmatter field: summary")
    if not isinstance(updated_at, str) or not updated_at.strip():
        raise ArticleSyncError(f"Article '{slug}' is missing required frontmatter field: updatedAt")

    raw_tags = metadata.get("tags")
    raw_project_ids = metadata.get("projectIds")
    raw_projects = metadata.get("projects")
    tags: List[Any] = raw_tags if isinstance(raw_tags, list) else []
    project_ids = _normalize_article_project_ids(
        raw_project_ids,
        raw_projects,
        project_alias_map=project_alias_map,
    )
    cover_image = _normalize_cover_image(
        metadata.get("coverImage"),
        slug=slug,
        current_markdown_path=current_markdown_path,
        current_asset_root=current_asset_root,
        article_paths_to_slug=article_paths_to_slug,
    )

    return {
        "slug": slug,
        "title": title.strip(),
        "summary": summary.strip(),
        "publishedAt": published_at.strip() if isinstance(published_at, str) and published_at.strip() else None,
        "updatedAt": updated_at.strip(),
        "series": series.strip() if isinstance(series, str) and series.strip() else None,
        "tags": [str(tag).strip() for tag in tags if str(tag).strip()],
        "projectIds": project_ids,
        "sourceUrl": _article_source_url(repo, ref, slug),
        "href": f"/articles/{slug}",
        "coverImage": cover_image,
    }


def build_articles_from_directory(
    *,
    source_repo_root: Path,
    output_dir: Path,
    repo: str,
    ref: str,
    projects_manifest_path: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    output_dir.mkdir(parents=True, exist_ok=True)

    article_sources = _discover_article_sources(source_repo_root)
    project_alias_map = _load_project_alias_map(projects_manifest_path)
    article_paths_to_slug: Dict[Path, str] = {}
    for article_source in article_sources:
        index_path = Path(article_source["index_path"]).resolve()
        article_paths_to_slug[index_path] = article_source["slug"]
        if article_source["layout"] == "directory":
            article_paths_to_slug[index_path.parent.resolve()] = article_source["slug"]

    manifest: List[Dict[str, Any]] = []
    for article_source in article_sources:
        slug = article_source["slug"]
        source_index_path = Path(article_source["index_path"])
        asset_root = Path(article_source["asset_root"])

        raw_text = source_index_path.read_text(encoding="utf-8")
        metadata, body = split_frontmatter(raw_text)
        normalized_metadata = _normalize_article_metadata(
            metadata,
            slug=slug,
            repo=repo,
            ref=ref,
            current_markdown_path=source_index_path,
            current_asset_root=asset_root,
            article_paths_to_slug=article_paths_to_slug,
            project_alias_map=project_alias_map,
        )
        rewritten_body = rewrite_article_markdown(
            body,
            slug=slug,
            current_markdown_path=source_index_path,
            current_asset_root=asset_root,
            article_paths_to_slug=article_paths_to_slug,
        )

        article_output_dir = output_dir / slug
        article_output_dir.mkdir(parents=True, exist_ok=True)
        (article_output_dir / "index.md").write_text(rewritten_body.rstrip() + "\n", encoding="utf-8")
        if article_source["layout"] == "directory":
            _copy_article_assets(asset_root, article_output_dir)
        else:
            _copy_referenced_relative_assets(
                body,
                current_markdown_path=source_index_path,
                asset_root=asset_root,
                dest_dir=article_output_dir,
            )
        raw_cover_image = metadata.get("coverImage")
        if isinstance(raw_cover_image, str) and raw_cover_image.strip():
            _copy_relative_asset_target(
                raw_target=raw_cover_image,
                current_markdown_path=source_index_path,
                asset_root=asset_root,
                dest_dir=article_output_dir,
            )
        manifest.append(normalized_metadata)

    manifest.sort(
        key=lambda article: (
            article.get("updatedAt") or article["publishedAt"],
            article["title"].lower(),
        ),
        reverse=True,
    )
    (output_dir / "articles.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def sync_articles(
    *,
    repo: str,
    ref: str,
    target_dir: Path = TARGET_ARTICLES_DIR,
    local_repo_path: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp(prefix="articles_sync_", dir=str(PUBLIC_ROOT)))
    temp_output_dir = temp_dir / "articles"

    try:
        if local_repo_path is not None:
            source_repo_root = local_repo_path
        else:
            source_repo_root = _download_repo_archive(repo, ref, temp_dir)

        manifest = build_articles_from_directory(
            source_repo_root=source_repo_root,
            output_dir=temp_output_dir,
            repo=repo,
            ref=ref,
        )

        if target_dir.exists():
            shutil.rmtree(target_dir)
        temp_output_dir.rename(target_dir)
        return manifest
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Markdown articles into public/articles")
    parser.add_argument("--repo", default=os.environ.get("ARTICLES_REPO", DEFAULT_REPO), help="GitHub repo in owner/name format")
    parser.add_argument("--ref", default=os.environ.get("ARTICLES_REF", DEFAULT_REF), help="Git ref to sync")
    parser.add_argument(
        "--local-repo-path",
        default=os.environ.get("ARTICLES_LOCAL_REPO_PATH"),
        help="Use a local Articles repo checkout instead of downloading from GitHub",
    )
    args = parser.parse_args()

    local_repo_path = Path(args.local_repo_path).expanduser().resolve() if args.local_repo_path else None
    manifest = sync_articles(repo=args.repo, ref=args.ref, local_repo_path=local_repo_path)
    print(f"Synced {len(manifest)} article(s) into {TARGET_ARTICLES_DIR}")


if __name__ == "__main__":
    main()
