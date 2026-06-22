#!/usr/bin/env python3
"""Fetch and assemble project data from Notion → tmp/new_projects.json.

Replaces the n8n workflow that previously exported new_projects.json.
Queries the same six Notion databases, applies the same normalization and
nesting logic (translated from the n8n "Assemble Nested JSON" JS node), and
writes a JSON file that is consumed by folio-prebuild.py / projects_pipeline.py.

Usage
-----
    python3 lib/notion_projects_export.py [--output PATH] [--dry-run] [--verbose]

Environment (loaded from .env.local, then .env, then the shell)
---------------------------------------------------------------
    NOTION_API_KEY          Required. Notion integration token.
    NOTION_PROJECTS_DB_ID   Required. "projects" database ID.
    NOTION_COLLECTIONS_DB_ID Required. "collections" database ID.
    NOTION_ASSETS_DB_ID     Required. "assets" database ID.
    NOTION_RESOURCES_DB_ID  Required. "resources" database ID.
    NOTION_CONFIG_DB_ID     Required. "config" database ID.
    NOTION_WORK_LOGS_DB_ID  Required. "work log" database ID.

Filters applied (matching the original n8n nodes)
--------------------------------------------------
    Projects    : in showcase == true  AND  public == true
    Collections : public == true
    Assets      : public == true
    Resources   : public == true
    Work Logs   : public == true
    Config      : (no filter — all rows)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Optional dependencies — fail clearly if missing.
# ---------------------------------------------------------------------------
try:
    from notion_client import Client as NotionClient
    from notion_client.errors import APIResponseError
except ImportError as exc:  # pragma: no cover
    sys.exit(
        "notion-client is not installed. Run: pip install notion-client>=2.2.1\n"
        f"Original error: {exc}"
    )

try:
    from dotenv import load_dotenv
except ImportError as exc:  # pragma: no cover
    sys.exit(
        "python-dotenv is not installed. Run: pip install python-dotenv>=1.0.0\n"
        f"Original error: {exc}"
    )

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_OUTPUT = _PROJECT_ROOT / "tmp" / "new_projects.json"

_REQUIRED_ENV_VARS = [
    "NOTION_API_KEY",
    "NOTION_PROJECTS_DB_ID",
    "NOTION_COLLECTIONS_DB_ID",
    "NOTION_ASSETS_DB_ID",
    "NOTION_RESOURCES_DB_ID",
    "NOTION_CONFIG_DB_ID",
    "NOTION_WORK_LOGS_DB_ID",
]

# Properties that should never be treated as single-asset-relation keys for projects.
_PROJECT_SINGLE_ASSET_RELATION_EXCLUDE: frozenset[str] = frozenset(
    {"property_assets", "property_collections", "property_resources", "property_title"}
)
_PROJECT_MEDIA_HINT_RE = re.compile(
    r"(thumbnail|banner|icon|poster|hero|image|cover|logo|artwork|media|preview|screenshot)",
    re.IGNORECASE,
)

logger = logging.getLogger(__name__)


# ===========================================================================
# Section 1 — Environment loading
# ===========================================================================


def load_env() -> Dict[str, str]:
    """Load env vars from .env.local (Next.js convention) then .env, then shell.

    Returns a dict of all required env vars.
    Raises SystemExit with a clear message if any required var is missing.
    """
    env_local = _PROJECT_ROOT / ".env.local"
    env_file = _PROJECT_ROOT / ".env"

    # Load in priority order; later calls don't override already-set values,
    # but we want .env.local to win, so we load it with override=True first.
    if env_local.exists():
        load_dotenv(env_local, override=True)
        logger.debug("Loaded environment from %s", env_local)
    if env_file.exists():
        load_dotenv(env_file, override=False)
        logger.debug("Loaded additional environment from %s", env_file)

    missing = [k for k in _REQUIRED_ENV_VARS if not os.environ.get(k)]
    if missing:
        sys.exit(
            "Missing required environment variables:\n"
            + "\n".join(f"  {k}" for k in missing)
            + "\n\nAdd them to .env.local (see .env.example for the full list)."
        )

    return {k: os.environ[k] for k in _REQUIRED_ENV_VARS}


# ===========================================================================
# Section 2 — Notion property extraction
# ===========================================================================


def _prop_name_to_key(prop_name: str) -> str:
    """Convert a Notion property display name to a property_* key.

    Examples
    --------
        "Name"         → "property_name"
        "in showcase"  → "property_in_showcase"
        "One-Liner"    → "property_one_liner"
    """
    normalized = re.sub(r"[^a-z0-9]+", "_", prop_name.lower()).strip("_")
    return f"property_{normalized}"


def extract_property_value(prop_data: Dict[str, Any]) -> Any:  # noqa: C901 (complexity)
    """Extract a Python-native value from a raw Notion property object.

    Mirrors the implicit mapping performed by n8n's Notion node (v2):
    - title / rich_text  → joined plain_text string
    - number             → int or float
    - select / status    → option name string
    - multi_select       → list of option name strings
    - checkbox           → bool
    - url / email / phone_number → string
    - date               → {"start": str, "end": str|None, "time_zone": str|None}
    - relation           → list of page-ID strings
    - formula            → typed scalar value
    - files              → list of {"name": str, "url": str}
    - people             → list of {"id": str, "name": str}
    - created_time / last_edited_time → ISO-8601 string
    - unique_id          → "<prefix>-<number>" or str(number)
    - Unknown types      → None
    """
    t = prop_data.get("type")

    if t in ("title", "rich_text"):
        segments = prop_data.get(t, [])
        return "".join(s.get("plain_text", "") for s in segments)

    if t == "number":
        return prop_data.get("number")

    if t == "select":
        sel = prop_data.get("select")
        return sel.get("name") if sel else None

    if t == "multi_select":
        return [o["name"] for o in prop_data.get("multi_select", []) if o.get("name")]

    if t == "status":
        st = prop_data.get("status")
        return st.get("name") if st else None

    if t == "checkbox":
        return bool(prop_data.get("checkbox", False))

    if t in ("url", "email", "phone_number"):
        return prop_data.get(t)

    if t == "date":
        d = prop_data.get("date")
        if not d:
            return None
        return {"start": d.get("start"), "end": d.get("end"), "time_zone": d.get("time_zone")}

    if t == "relation":
        return [r["id"] for r in prop_data.get("relation", []) if r.get("id")]

    if t == "formula":
        f = prop_data.get("formula", {})
        ft = f.get("type")
        return f.get(ft) if ft in ("string", "number", "boolean", "date") else None

    if t == "rollup":
        r = prop_data.get("rollup", {})
        rt = r.get("type")
        if rt == "number":
            return r.get("number")
        if rt == "date":
            return r.get("date")
        if rt == "array":
            return [extract_property_value(item) for item in r.get("array", [])]
        return None

    if t == "files":
        result = []
        for f in prop_data.get("files", []):
            name = f.get("name", "")
            if f.get("type") == "external":
                url = (f.get("external") or {}).get("url", "")
            elif f.get("type") == "file":
                url = (f.get("file") or {}).get("url", "")
            else:
                url = ""
            result.append({"name": name, "url": url})
        return result

    if t == "people":
        return [{"id": p.get("id"), "name": p.get("name")} for p in prop_data.get("people", [])]

    if t in ("created_time", "last_edited_time"):
        return prop_data.get(t)

    if t in ("created_by", "last_edited_by"):
        person = prop_data.get(t) or {}
        return {"id": person.get("id"), "name": person.get("name")}

    if t == "unique_id":
        uid = prop_data.get("unique_id") or {}
        prefix = uid.get("prefix", "")
        num = uid.get("number")
        return f"{prefix}-{num}" if prefix else str(num)

    return None


def map_page(page: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a raw Notion API page to a flat property_* dict.

    The resulting dict always has:
        "id"   : Notion page ID (with dashes, e.g. "304aec94-4d3c-...")
        "url"  : Notion page URL
        "name" : Joined plain_text of the title-type property (or "")

    Plus one "property_<key>" entry for every property on the page.
    """
    row: Dict[str, Any] = {
        "id": page.get("id", ""),
        "url": page.get("url", ""),
        "name": "",
    }

    for prop_name, prop_data in page.get("properties", {}).items():
        key = _prop_name_to_key(prop_name)
        value = extract_property_value(prop_data)
        row[key] = value

        # Propagate the title as the top-level "name" field (matches n8n behaviour).
        if prop_data.get("type") == "title":
            row["name"] = value or ""

    return row


# ===========================================================================
# Section 3 — Notion database querying (with pagination)
# ===========================================================================


def _build_checkbox_filter(property_name: str, value: bool = True) -> Dict[str, Any]:
    """Return a single Notion API checkbox filter object."""
    return {"property": property_name, "checkbox": {"equals": value}}


def query_database(
    client: NotionClient,
    db_id: str,
    filter_conditions: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Query a Notion database and return all pages as mapped flat dicts.

    Handles cursor-based pagination automatically so callers always receive
    the complete result set.

    Parameters
    ----------
    client:
        Authenticated notion_client.Client instance.
    db_id:
        Notion database ID (with or without dashes).
    filter_conditions:
        Optional list of Notion filter objects.  When multiple conditions are
        provided they are AND-ed together using the ``{"and": [...]}`` form.
    """
    query_filter: Optional[Dict[str, Any]] = None
    if filter_conditions:
        query_filter = {"and": filter_conditions} if len(filter_conditions) > 1 else filter_conditions[0]

    pages: List[Dict[str, Any]] = []
    cursor: Optional[str] = None

    while True:
        body: Dict[str, Any] = {"page_size": 100}
        if query_filter:
            body["filter"] = query_filter
        if cursor:
            body["start_cursor"] = cursor

        try:
            # notion-client v3 removed databases.query() as a method, but
            # the REST endpoint POST databases/{id}/query still exists in
            # API version 2022-06-28, so we call it directly via request().
            response = client.request(
                path=f"databases/{db_id}/query",
                method="POST",
                body=body,
            )
        except APIResponseError as exc:
            logger.error("Notion API error querying database %s: %s", db_id, exc)
            raise

        for page in response.get("results", []):
            pages.append(map_page(page))

        if not response.get("has_more"):
            break
        cursor = response.get("next_cursor")

    logger.info("Queried database %s → %d pages", db_id, len(pages))
    return pages


# ===========================================================================
# Section 4 — Assembly helpers (translated from the n8n "Assemble Nested JSON" JS)
# ===========================================================================
# All helpers are prefixed with _ to signal they are internal to the assembly
# pipeline.  They map 1-to-1 with their JavaScript counterparts.


def _uniq(arr: Any) -> List[Any]:
    """Return deduplicated list preserving first-occurrence order, ignoring None."""
    seen: Dict[Any, None] = {}
    for x in (arr or []):
        if x is not None:
            seen[x] = None
    return list(seen)


def _safe_array(v: Any) -> List[Any]:
    """Wrap scalars in a list; return empty list for None."""
    if isinstance(v, list):
        return v
    return [] if v is None else [v]


def _pick_first(v: Any) -> Any:
    """Return the first element of a list (or the value itself if scalar)."""
    arr = _safe_array(v)
    return arr[0] if arr else None


def _dedup_by_id(arr: Optional[List[Any]]) -> List[Any]:
    """Remove duplicate dicts from a list using each item's "id" field."""
    seen: set = set()
    out: List[Any] = []
    for x in arr or []:
        xid = x.get("id") if isinstance(x, dict) else id(x)
        if xid not in seen:
            seen.add(xid)
            out.append(x)
    return out


def _parse_date_value(v: Any) -> Optional[str]:
    """Extract an ISO-8601 date string from a raw Notion date value."""
    if not v:
        return None
    if isinstance(v, str):
        return v
    if isinstance(v, dict) and "start" in v:
        return v["start"]
    return None


def _parse_started_last_update_range(v: Any) -> Dict[str, Any]:
    """Parse a date-range property that encodes both startedAt and lastUpdateAt."""
    value = _pick_first(v) if isinstance(v, list) else v
    if not value:
        return {"raw": None, "startedAt": None, "lastUpdateAt": None}
    if isinstance(value, str):
        return {"raw": value, "startedAt": value, "lastUpdateAt": None}
    if isinstance(value, dict):
        return {
            "raw": value,
            "startedAt": _parse_date_value(value.get("start") or value),
            "lastUpdateAt": _parse_date_value(value.get("end")),
        }
    return {"raw": None, "startedAt": None, "lastUpdateAt": None}


def _normalize_articles_field(v: Any) -> List[str]:
    """Extract a list of article URL strings from the raw articles field.

    The field may be a URL string, a rich_text array, a comma- or newline-
    delimited string, or any combination thereof.
    """
    raw_entries: List[str] = []
    for entry in _safe_array(v):
        if entry is None:
            continue
        if isinstance(entry, str):
            raw_entries.append(entry)
        elif isinstance(entry, dict):
            for key in ("url", "href", "plain_text", "text"):
                val = entry.get(key)
                if isinstance(val, str):
                    raw_entries.append(val)
                    break
            else:
                raw_entries.append(str(entry))

    flat: List[str] = []
    for entry in raw_entries:
        for part in re.split(r"\r?\n|,", str(entry)):
            part = part.strip()
            if part:
                flat.append(part)

    return _uniq(flat)


def _sort_by_date_desc(arr: List[Any], get_date: Any) -> List[Any]:
    """Sort a list of dicts in descending order by a date field."""

    def sort_key(x: Any) -> float:
        d = get_date(x)
        if not d:
            return 0.0
        try:
            return -datetime.fromisoformat(d.replace("Z", "+00:00")).timestamp()
        except (ValueError, AttributeError):
            return 0.0

    return sorted(arr or [], key=sort_key)


def _strip_property_prefix(key: str) -> str:
    """Remove the leading 'property_' from a key string."""
    return re.sub(r"^property_", "", str(key or ""))


def _get_first_relation_id(v: Any) -> Optional[str]:
    """Extract the first page-ID string from a relation field value."""
    first = _pick_first(v)
    if not first:
        return None
    if isinstance(first, str):
        return first
    if isinstance(first, dict):
        return first.get("id")
    return None


def _resolve_single_asset_relation(
    row: Dict[str, Any], property_key: str, asset_by_id: Dict[str, Any]
) -> Dict[str, Any]:
    """Resolve a single-asset relation property to a normalized thumbnail."""
    relation_id = _get_first_relation_id(row.get(property_key))
    if not relation_id:
        return {"relationId": None, "asset": None}
    raw_asset = asset_by_id.get(relation_id)
    return {
        "relationId": relation_id,
        "asset": _normalize_thumbnail(raw_asset) if raw_asset else None,
    }


def _detect_project_single_asset_relation_keys(
    project_rows: List[Dict[str, Any]],
    asset_by_id: Dict[str, Any],
) -> List[str]:
    """Detect which property_* keys on projects are single-asset relations.

    Mirrors the JS ``detectProjectSingleAssetRelationKeys`` function.
    """
    keys: set = {"property_thumbnail"}

    for row in project_rows or []:
        for key, value in (row or {}).items():
            if not key.startswith("property_"):
                continue
            if key in _PROJECT_SINGLE_ASSET_RELATION_EXCLUDE:
                continue

            values = _safe_array(value)
            if len(values) > 1:
                continue

            if len(values) == 0:
                if _PROJECT_MEDIA_HINT_RE.search(key):
                    keys.add(key)
                continue

            relation_id = _get_first_relation_id(values)
            if relation_id and asset_by_id.get(relation_id):
                keys.add(key)
                continue

            if _PROJECT_MEDIA_HINT_RE.search(key):
                keys.add(key)

    return list(keys)


# ===========================================================================
# Section 5 — Row normalization (mirrors the n8n JS normalize* functions)
# ===========================================================================


def _normalize_resource(r: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a raw resource row into the canonical resource shape."""
    return {
        "id": r.get("id"),
        "name": r.get("name"),
        "label": r.get("property_label"),
        "type": r.get("property_type"),
        "url": r.get("property_url"),
        "icon": r.get("property_icon"),
        "projectIds": _uniq(r.get("property_projects")),
        "collectionIds": _uniq(r.get("property_collections")),
        "assetIds": _uniq(r.get("property_assets")),
        "raw": r,
    }


def _normalize_thumbnail(a: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a raw asset row into the lightweight thumbnail shape.

    The thumbnail shape omits the ``thumbnail`` self-reference and assets/items
    arrays to avoid deep nesting.
    """
    return {
        "id": a.get("id"),
        "name": a.get("name"),
        "label": a.get("property_label"),
        "type": a.get("property_type"),
        "filename": a.get("property_filename"),
        "relativePath": a.get("property_relative_path"),
        "projectIds": _uniq(a.get("property_projects")),
        "collectionIds": _uniq(a.get("property_collections")),
        "resources": [],  # populated later if resources reference this asset
        "raw": a,
    }


def _normalize_asset(a: Dict[str, Any], asset_by_id: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a raw asset row into the full asset shape."""
    thumb_id = _get_first_relation_id(a.get("property_thumbnail"))
    thumb = _normalize_thumbnail(asset_by_id[thumb_id]) if (thumb_id and asset_by_id.get(thumb_id)) else None

    return {
        "id": a.get("id"),
        "name": a.get("name"),
        "label": a.get("property_label"),
        "type": a.get("property_type"),
        "filename": a.get("property_filename"),
        "relativePath": a.get("property_relative_path"),
        "projectIds": _uniq(a.get("property_projects")),
        "collectionIds": _uniq(a.get("property_collections")),
        "thumbnail": thumb,
        "resources": [],  # populated in the attachment pass
        "raw": a,
    }


def _normalize_collection(c: Dict[str, Any], asset_by_id: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a raw collection row into the full collection shape."""
    thumb_id = _get_first_relation_id(c.get("property_thumbnail"))
    thumb = _normalize_thumbnail(asset_by_id[thumb_id]) if (thumb_id and asset_by_id.get(thumb_id)) else None

    return {
        "id": c.get("id"),
        "name": c.get("name"),
        "label": c.get("property_label"),
        "oneLiner": _pick_first(c.get("property_one_liner")),
        "summary": _pick_first(c.get("property_summary")),
        "projectIds": _uniq(c.get("property_projects")),
        "collectionItemIds": _uniq(c.get("property_collection_items")),
        "thumbnail": thumb,
        "assets": [],   # populated in the attachment pass
        "resources": [], # populated in the attachment pass
        "items": [],    # populated from collectionItemIds in the attachment pass
        "raw": c,
    }


def _normalize_work_log(w: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a raw work-log row into the canonical work-log shape."""
    date_val = _parse_date_value(w.get("property_date"))
    problems = w.get("property_problems")
    next_step = w.get("property_next_step")

    return {
        "id": w.get("id"),
        "name": w.get("name"),
        "url": w.get("url"),
        "entry": w.get("property_entry") or w.get("name"),
        "date": date_val,
        "dateRaw": w.get("property_date"),
        "sessionStart": _parse_date_value(w.get("property_session_start")),
        "sessionEnd": _parse_date_value(w.get("property_session_end")),
        "public": bool(w.get("property_public")),
        "projectIds": _uniq(w.get("property_project")),
        "whatHappened": w.get("property_what_happened"),
        "problems": None if (isinstance(problems, str) and not problems.strip()) else problems,
        "nextStep": None if (isinstance(next_step, str) and not next_step.strip()) else next_step,
        "sessionType": _safe_array(w.get("property_session_type")),
        "milestoneIds": _uniq(w.get("property_milestone")),
        "relatedTaskIds": _uniq(w.get("property_related_tasks")),
        "sessionIds": _uniq(w.get("property_sessions")),
        "assetsUrl": w.get("property_assets_url"),
        "assetsFilesMedia": _safe_array(w.get("property_assets_files_media")),
        "automationLogs": _safe_array(w.get("property_automation_logs")),
        "allowAutomation": bool(w.get("property_allow_automation")),
        "feelGoodAboutWork": w.get("property_feel_good_about_work"),
        "accomplishedWhatYouWanted": w.get("property_accomplished_what_you_wanted"),
        "raw": w,
    }


def _normalize_project(
    p: Dict[str, Any],
    asset_by_id: Dict[str, Any],
    project_single_asset_relation_keys: List[str],
) -> Dict[str, Any]:
    """Normalize a raw project row into the full project shape.

    Single-asset-relation properties (e.g. thumbnail, banner, hero) are
    resolved to normalized thumbnail objects and stored both in the typed
    ``singleAssetMedia`` map and as top-level keys for convenience.
    """
    # The title property value doubles as the projectPageId (matches JS logic).
    project_page_id = _pick_first(p.get("property_title")) or p.get("projectPageId") or p.get("id")

    single_asset_relation_ids: Dict[str, Any] = {}
    single_asset_media: Dict[str, Any] = {}
    for property_key in project_single_asset_relation_keys:
        output_key = _strip_property_prefix(property_key)
        resolved = _resolve_single_asset_relation(p, property_key, asset_by_id)
        single_asset_relation_ids[output_key] = resolved["relationId"]
        single_asset_media[output_key] = resolved["asset"]

    thumb = single_asset_media.get("thumbnail")
    started_range = _parse_started_last_update_range(p.get("property_started_at_last_update_at"))
    started_at = _parse_date_value(p.get("property_started_at")) or started_range["startedAt"]
    last_update_at = _parse_date_value(p.get("property_last_update_at")) or started_range["lastUpdateAt"]
    started_at_last_update_at = (
        {"start": started_at, "end": last_update_at, "time_zone": None}
        if (started_at or last_update_at)
        else None
    )

    project: Dict[str, Any] = {
        "id": p.get("id"),
        "projectPageId": project_page_id,
        "title": p.get("property_name") or p.get("name"),
        "name": p.get("property_name") or p.get("name"),
        "subtitle": _pick_first(p.get("property_subtitle")),
        "oneLiner": _pick_first(p.get("property_one_liner")),
        "summary": _pick_first(p.get("property_summary")),
        "domain": _pick_first(p.get("property_domain")),
        "featured": bool(_pick_first(p.get("property_featured"))),
        "featuredOrder": p.get("property_featured_order"),
        "tags": _safe_array(p.get("property_tags")),
        "category": _safe_array(p.get("property_category")),
        "status": _pick_first(p.get("property_status")),
        "phase": _pick_first(p.get("property_phase")),
        "articles": _normalize_articles_field(p.get("property_articles")),
        "startedAt": started_at,
        "lastUpdateAt": last_update_at,
        "startDate": started_at,
        "lastUpdateDate": last_update_at,
        "startedAtLastUpdateAt": started_at_last_update_at,
        "projectDateRangeRaw": started_at_last_update_at,
        "thumbnail": thumb,
        "singleAssetMedia": single_asset_media,
        "singleAssetRelationIds": single_asset_relation_ids,
        # Lists populated during the attachment pass below.
        "collections": [],
        "assets": [],
        "resources": [],
        "workLogs": [],
        # Keep raw relation-ID lists for compatibility with projects_pipeline.py.
        "collectionIds": _uniq(p.get("property_collections")),
        "assetIds": _uniq(p.get("property_assets")),
        "resourceIds": _uniq(p.get("property_resources")),
        "raw": p,
    }

    # Promote non-thumbnail single-asset media fields to top-level keys so that
    # projects_pipeline.py can address them by name (e.g. project["banner"]).
    for key, asset in single_asset_media.items():
        if key != "thumbnail" and key not in project:
            project[key] = asset

    return project


# ===========================================================================
# Section 6 — Assembly orchestration (mirrors the n8n JS main body)
# ===========================================================================


def _build_config(config_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Select the most-recent config row and strip property_ prefixes.

    Mirrors the JS config-building block at the bottom of "Assemble Nested JSON":
    rows named with an ISO date (YYYY-MM-DD) are candidates; the lexicographically
    latest one is chosen, or the first row is used as a fallback.
    """
    _date_like = re.compile(r"^\d{4}-\d{2}-\d{2}$")

    config_row = config_rows[0] if config_rows else {}
    dated_rows = [r for r in config_rows if _date_like.match(r.get("name") or "")]
    if dated_rows:
        config_row = sorted(dated_rows, key=lambda r: r.get("name", ""))[-1]

    def _normalize_config_value(v: Any) -> Any:
        """Flatten single-element lists; convert whitespace-only strings to None."""
        if isinstance(v, list):
            if len(v) == 0:
                return None
            if len(v) == 1:
                return _normalize_config_value(v[0])
            return [_normalize_config_value(x) for x in v]
        if isinstance(v, str):
            t = v.strip()
            return t if t else None
        return v

    return {
        re.sub(r"^property_", "", k): _normalize_config_value(v)
        for k, v in config_row.items()
        if k.startswith("property_")
        if _normalize_config_value(v) is not None
    }


def assemble(
    config_rows: List[Dict[str, Any]],
    projects_rows: List[Dict[str, Any]],
    collections_rows: List[Dict[str, Any]],
    assets_rows: List[Dict[str, Any]],
    resources_rows: List[Dict[str, Any]],
    work_logs_rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Assemble all raw Notion rows into the nested JSON expected by folio-prebuild.py.

    This is a direct Python translation of the "Assemble Nested JSON" n8n code
    node.  The returned dict has the shape ``{config, projects, workLogs}``.

    Parameters
    ----------
    config_rows:
        All rows from the config database (no pre-filtering required).
    projects_rows:
        Showcase projects (already filtered: in_showcase=True AND public=True).
    collections_rows:
        All public collections.
    assets_rows:
        All public assets.
    resources_rows:
        All public resources.
    work_logs_rows:
        All public work-log entries.
    """
    # ------------------------------------------------------------------
    # Index raw assets by ID first (needed for thumbnail resolution).
    # ------------------------------------------------------------------
    asset_by_id: Dict[str, Any] = {a["id"]: a for a in assets_rows}
    project_single_asset_relation_keys = _detect_project_single_asset_relation_keys(
        projects_rows, asset_by_id
    )

    # ------------------------------------------------------------------
    # Normalize all rows into their canonical shapes.
    # ------------------------------------------------------------------
    resources = [_normalize_resource(r) for r in resources_rows]
    work_logs = [_normalize_work_log(w) for w in work_logs_rows]

    normalized_assets = [_normalize_asset(a, asset_by_id) for a in assets_rows]
    asset_norm_by_id: Dict[str, Any] = {a["id"]: a for a in normalized_assets}

    normalized_collections = [_normalize_collection(c, asset_by_id) for c in collections_rows]
    collection_norm_by_id: Dict[str, Any] = {c["id"]: c for c in normalized_collections}

    normalized_projects = [
        _normalize_project(p, asset_by_id, project_single_asset_relation_keys)
        for p in projects_rows
    ]
    # Build a lookup by projectPageId OR id so both can find their record.
    project_norm_by_id: Dict[str, Any] = {}
    for proj in normalized_projects:
        if proj.get("projectPageId"):
            project_norm_by_id[proj["projectPageId"]] = proj
        if proj.get("id"):
            project_norm_by_id[proj["id"]] = proj

    def _find_project(pid: str) -> Optional[Dict[str, Any]]:
        return project_norm_by_id.get(pid) or next(
            (x for x in normalized_projects if x.get("id") == pid or x.get("projectPageId") == pid),
            None,
        )

    # ------------------------------------------------------------------
    # Attachment pass 1: resources → projects / collections / assets
    # ------------------------------------------------------------------
    for r in resources:
        for pid in r["projectIds"]:
            p = _find_project(pid)
            if p:
                p["resources"].append(r)
        for cid in r["collectionIds"]:
            c = collection_norm_by_id.get(cid)
            if c:
                c["resources"].append(r)
        for aid in r["assetIds"]:
            a = asset_norm_by_id.get(aid)
            if a:
                a["resources"].append(r)

    # ------------------------------------------------------------------
    # Attachment pass 2: assets → collections / projects
    # (via asset.property_collections and asset.property_projects)
    # ------------------------------------------------------------------
    for a in normalized_assets:
        for cid in a["collectionIds"]:
            c = collection_norm_by_id.get(cid)
            if c:
                c["assets"].append(a)
        for pid in a["projectIds"]:
            p = _find_project(pid)
            if p:
                p["assets"].append(a)

    # ------------------------------------------------------------------
    # Attachment pass 3: collection items (via collection.collectionItemIds)
    # ------------------------------------------------------------------
    for c in normalized_collections:
        c["items"] = [
            asset_norm_by_id[aid]
            for aid in _uniq(c["collectionItemIds"])
            if aid in asset_norm_by_id
        ]

    # ------------------------------------------------------------------
    # Attachment pass 4: collections → projects
    # Prefer explicit relation lists from the project row; fall back to
    # inferring from each collection's projectIds.
    # ------------------------------------------------------------------
    for p in normalized_projects:
        explicit = _uniq(p["collectionIds"])
        if explicit:
            for cid in explicit:
                c = collection_norm_by_id.get(cid)
                if c:
                    p["collections"].append(c)
        else:
            for c in normalized_collections:
                project_ids_in_collection = c.get("projectIds") or []
                if p.get("projectPageId") in project_ids_in_collection or p.get("id") in project_ids_in_collection:
                    p["collections"].append(c)

    # ------------------------------------------------------------------
    # Attachment pass 5: work logs → projects
    # (via workLog.projectIds)
    # ------------------------------------------------------------------
    for wl in work_logs:
        for pid in wl["projectIds"]:
            p = _find_project(pid)
            if p:
                p["workLogs"].append(wl)

    # ------------------------------------------------------------------
    # Dedup + sort all lists.
    # ------------------------------------------------------------------
    for p in normalized_projects:
        for key in ("resources", "assets", "collections", "workLogs"):
            p[key] = _dedup_by_id(p[key])
        p["workLogs"] = _sort_by_date_desc(p["workLogs"], lambda wl: wl.get("date"))

    for c in normalized_collections:
        for key in ("resources", "assets", "items"):
            c[key] = _dedup_by_id(c[key])

    for a in normalized_assets:
        a["resources"] = _dedup_by_id(a["resources"])

    # ------------------------------------------------------------------
    # Config + top-level work-log export.
    # ------------------------------------------------------------------
    config = _build_config(config_rows)
    work_logs_sorted = _sort_by_date_desc(_dedup_by_id(work_logs), lambda wl: wl.get("date"))

    return {
        "config": config,
        "projects": normalized_projects,
        "workLogs": work_logs_sorted,
    }


# ===========================================================================
# Section 7 — CLI entrypoint
# ===========================================================================


def main(argv: Optional[List[str]] = None) -> None:
    """Query Notion databases, assemble, and write new_projects.json."""
    parser = argparse.ArgumentParser(
        description="Fetch Notion project data and write new_projects.json for folio-prebuild.py.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=_DEFAULT_OUTPUT,
        help=f"Path to write the assembled JSON (default: {_DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print a summary and the first project title without writing to disk.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable DEBUG-level logging.",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
        stream=sys.stderr,
    )

    # 1. Load environment variables.
    env = load_env()
    logger.info("Environment loaded — querying Notion...")

    # 2. Create authenticated Notion client.
    # Pin to API version 2022-06-28 — the same version used by the n8n
    # Notion node v2 that this script replaces.  The 2025-09-03 SDK default
    # moved database queries to a "data_sources" namespace that requires
    # separate sharing permissions; 2022-06-28 uses the stable
    # databases/{id}/query endpoint.
    client = NotionClient(auth=env["NOTION_API_KEY"], notion_version="2022-06-28")

    # 3. Query all six databases in sequence.
    #    (Sequential is sufficient; the SDK handles retries + rate limiting.)
    public_filter = [_build_checkbox_filter("public")]
    showcase_filter = [
        _build_checkbox_filter("in showcase"),
        _build_checkbox_filter("public"),
    ]

    logger.info("Querying Config database...")
    config_rows = query_database(client, env["NOTION_CONFIG_DB_ID"])

    logger.info("Querying Projects (showcase) database...")
    projects_rows = query_database(client, env["NOTION_PROJECTS_DB_ID"], showcase_filter)

    logger.info("Querying Collections database...")
    collections_rows = query_database(client, env["NOTION_COLLECTIONS_DB_ID"], public_filter)

    logger.info("Querying Assets database...")
    assets_rows = query_database(client, env["NOTION_ASSETS_DB_ID"], public_filter)

    logger.info("Querying Resources database...")
    resources_rows = query_database(client, env["NOTION_RESOURCES_DB_ID"], public_filter)

    logger.info("Querying Work Logs database...")
    work_logs_rows = query_database(client, env["NOTION_WORK_LOGS_DB_ID"], public_filter)

    # 4. Assemble the nested payload.
    logger.info(
        "Assembling: %d projects, %d collections, %d assets, %d resources, %d work logs",
        len(projects_rows),
        len(collections_rows),
        len(assets_rows),
        len(resources_rows),
        len(work_logs_rows),
    )
    payload = assemble(config_rows, projects_rows, collections_rows, assets_rows, resources_rows, work_logs_rows)

    project_count = len(payload.get("projects", []))
    work_log_count = len(payload.get("workLogs", []))
    logger.info("Assembly complete — %d projects, %d work logs", project_count, work_log_count)

    # 5. Write output (or dry-run summary).
    if args.dry_run:
        first_title = (payload["projects"][0].get("title") if payload["projects"] else "(none)")
        print(
            f"[dry-run] Would write {project_count} projects and {work_log_count} work logs "
            f"to {args.output}\nFirst project title: {first_title}"
        )
        return

    output_path: Path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("Wrote %s (%d bytes)", output_path, output_path.stat().st_size)


if __name__ == "__main__":
    main()
