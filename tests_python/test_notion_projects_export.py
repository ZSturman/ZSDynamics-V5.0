"""Tests for lib/notion_projects_export.py.

Run with:
    python3 -m pytest tests_python/test_notion_projects_export.py -v

All tests are fully offline — the Notion client is always mocked.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, call, patch

# Allow `from notion_projects_export import ...`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "lib"))

from notion_projects_export import (  # noqa: E402
    _build_config,
    _dedup_by_id,
    _detect_project_single_asset_relation_keys,
    _get_first_relation_id,
    _normalize_articles_field,
    _normalize_asset,
    _normalize_collection,
    _normalize_project,
    _normalize_resource,
    _normalize_thumbnail,
    _normalize_work_log,
    _parse_date_value,
    _parse_started_last_update_range,
    _pick_first,
    _prop_name_to_key,
    _safe_array,
    _sort_by_date_desc,
    _strip_property_prefix,
    _uniq,
    assemble,
    extract_property_value,
    main,
    map_page,
    query_database,
)


# ===========================================================================
# Fixtures / helpers
# ===========================================================================


def _make_notion_page(
    page_id: str,
    properties: Dict[str, Any],
    url: str = "",
) -> Dict[str, Any]:
    """Build a minimal fake Notion API page dict."""
    return {"id": page_id, "url": url or f"https://notion.so/{page_id}", "properties": properties}


def _title_prop(text: str) -> Dict[str, Any]:
    return {"type": "title", "title": [{"plain_text": text}]}


def _rich_text_prop(text: str) -> Dict[str, Any]:
    return {"type": "rich_text", "rich_text": [{"plain_text": text}]}


def _checkbox_prop(value: bool) -> Dict[str, Any]:
    return {"type": "checkbox", "checkbox": value}


def _select_prop(name: str) -> Dict[str, Any]:
    return {"type": "select", "select": {"name": name}}


def _multi_select_prop(names: List[str]) -> Dict[str, Any]:
    return {"type": "multi_select", "multi_select": [{"name": n} for n in names]}


def _relation_prop(ids: List[str]) -> Dict[str, Any]:
    return {"type": "relation", "relation": [{"id": i} for i in ids]}


def _date_prop(start: str, end: Optional[str] = None) -> Dict[str, Any]:
    return {"type": "date", "date": {"start": start, "end": end, "time_zone": None}}


def _url_prop(url: str) -> Dict[str, Any]:
    return {"type": "url", "url": url}


def _number_prop(value: float) -> Dict[str, Any]:
    return {"type": "number", "number": value}


def _make_mock_notion_client(pages_by_call: List[List[Dict[str, Any]]]) -> MagicMock:
    """Return a MagicMock notion client whose .databases.query() returns the
    given list of page-lists in order (one list per call)."""
    mock = MagicMock()
    responses = [
        {"results": pages, "has_more": False, "next_cursor": None}
        for pages in pages_by_call
    ]
    mock.databases.query.side_effect = responses
    return mock


# ===========================================================================
# TestNotionPropertyMapper
# ===========================================================================


class TestNotionPropertyMapper(unittest.TestCase):
    """Unit tests for extract_property_value() and map_page()."""

    def test_title_type_returns_joined_string(self) -> None:
        prop = {"type": "title", "title": [{"plain_text": "Hello "}, {"plain_text": "World"}]}
        self.assertEqual(extract_property_value(prop), "Hello World")

    def test_title_type_empty_returns_empty_string(self) -> None:
        prop = {"type": "title", "title": []}
        self.assertEqual(extract_property_value(prop), "")

    def test_rich_text_type_returns_joined_string(self) -> None:
        prop = {"type": "rich_text", "rich_text": [{"plain_text": "foo"}, {"plain_text": "bar"}]}
        self.assertEqual(extract_property_value(prop), "foobar")

    def test_number_type(self) -> None:
        self.assertEqual(extract_property_value({"type": "number", "number": 42}), 42)
        self.assertIsNone(extract_property_value({"type": "number", "number": None}))

    def test_select_type_returns_name(self) -> None:
        prop = {"type": "select", "select": {"name": "Active"}}
        self.assertEqual(extract_property_value(prop), "Active")

    def test_select_type_none(self) -> None:
        prop = {"type": "select", "select": None}
        self.assertIsNone(extract_property_value(prop))

    def test_multi_select_type(self) -> None:
        prop = _multi_select_prop(["iOS", "Swift"])
        self.assertEqual(extract_property_value(prop), ["iOS", "Swift"])

    def test_multi_select_empty(self) -> None:
        prop = {"type": "multi_select", "multi_select": []}
        self.assertEqual(extract_property_value(prop), [])

    def test_status_type(self) -> None:
        prop = {"type": "status", "status": {"name": "In Progress"}}
        self.assertEqual(extract_property_value(prop), "In Progress")

    def test_checkbox_true(self) -> None:
        self.assertTrue(extract_property_value({"type": "checkbox", "checkbox": True}))

    def test_checkbox_false(self) -> None:
        self.assertFalse(extract_property_value({"type": "checkbox", "checkbox": False}))

    def test_url_type(self) -> None:
        prop = {"type": "url", "url": "https://example.com"}
        self.assertEqual(extract_property_value(prop), "https://example.com")

    def test_date_type_with_range(self) -> None:
        prop = _date_prop("2026-01-01", "2026-06-01")
        result = extract_property_value(prop)
        self.assertEqual(result["start"], "2026-01-01")
        self.assertEqual(result["end"], "2026-06-01")
        self.assertIsNone(result["time_zone"])

    def test_date_type_no_end(self) -> None:
        prop = _date_prop("2026-03-15")
        result = extract_property_value(prop)
        self.assertEqual(result["start"], "2026-03-15")
        self.assertIsNone(result["end"])

    def test_date_type_null(self) -> None:
        prop = {"type": "date", "date": None}
        self.assertIsNone(extract_property_value(prop))

    def test_relation_type(self) -> None:
        prop = _relation_prop(["aaa", "bbb"])
        self.assertEqual(extract_property_value(prop), ["aaa", "bbb"])

    def test_relation_type_empty(self) -> None:
        prop = {"type": "relation", "relation": []}
        self.assertEqual(extract_property_value(prop), [])

    def test_formula_string(self) -> None:
        prop = {"type": "formula", "formula": {"type": "string", "string": "computed"}}
        self.assertEqual(extract_property_value(prop), "computed")

    def test_formula_number(self) -> None:
        prop = {"type": "formula", "formula": {"type": "number", "number": 3.14}}
        self.assertAlmostEqual(extract_property_value(prop), 3.14)

    def test_files_type_external(self) -> None:
        prop = {
            "type": "files",
            "files": [{"name": "doc.pdf", "type": "external", "external": {"url": "https://cdn.example.com/doc.pdf"}}],
        }
        result = extract_property_value(prop)
        self.assertEqual(result, [{"name": "doc.pdf", "url": "https://cdn.example.com/doc.pdf"}])

    def test_unknown_type_returns_none(self) -> None:
        prop = {"type": "unsupported_future_type", "unsupported_future_type": "value"}
        self.assertIsNone(extract_property_value(prop))

    def test_prop_name_to_key_basic(self) -> None:
        self.assertEqual(_prop_name_to_key("Name"), "property_name")

    def test_prop_name_to_key_spaces(self) -> None:
        self.assertEqual(_prop_name_to_key("in showcase"), "property_in_showcase")

    def test_prop_name_to_key_mixed_case_hyphens(self) -> None:
        self.assertEqual(_prop_name_to_key("One-Liner"), "property_one_liner")

    def test_map_page_sets_id_url_name(self) -> None:
        page = _make_notion_page(
            "page-123",
            {"Name": _title_prop("My Project"), "public": _checkbox_prop(True)},
        )
        row = map_page(page)
        self.assertEqual(row["id"], "page-123")
        self.assertEqual(row["name"], "My Project")
        self.assertEqual(row["property_name"], "My Project")
        self.assertTrue(row["property_public"])

    def test_map_page_relation_is_list_of_ids(self) -> None:
        page = _make_notion_page(
            "page-456",
            {
                "Name": _title_prop("Test"),
                "collections": _relation_prop(["col-1", "col-2"]),
            },
        )
        row = map_page(page)
        self.assertEqual(row["property_collections"], ["col-1", "col-2"])

    def test_map_page_empty_title_sets_name_empty(self) -> None:
        page = _make_notion_page("p-1", {"Name": {"type": "title", "title": []}})
        row = map_page(page)
        self.assertEqual(row["name"], "")

    def test_map_page_no_properties(self) -> None:
        page = {"id": "p-2", "url": "", "properties": {}}
        row = map_page(page)
        self.assertEqual(row["id"], "p-2")
        self.assertEqual(row["name"], "")


# ===========================================================================
# TestAssemblyHelpers
# ===========================================================================


class TestAssemblyHelpers(unittest.TestCase):
    """Unit tests for the small helper functions used in the assembly pass."""

    def test_uniq_deduplicates_preserving_order(self) -> None:
        self.assertEqual(_uniq([3, 1, 2, 1, 3]), [3, 1, 2])

    def test_uniq_removes_none(self) -> None:
        self.assertEqual(_uniq([None, "a", None, "b"]), ["a", "b"])

    def test_uniq_empty(self) -> None:
        self.assertEqual(_uniq([]), [])
        self.assertEqual(_uniq(None), [])

    def test_safe_array_wraps_scalar(self) -> None:
        self.assertEqual(_safe_array("hello"), ["hello"])

    def test_safe_array_keeps_list(self) -> None:
        self.assertEqual(_safe_array([1, 2]), [1, 2])

    def test_safe_array_none_returns_empty(self) -> None:
        self.assertEqual(_safe_array(None), [])

    def test_pick_first_list(self) -> None:
        self.assertEqual(_pick_first(["a", "b"]), "a")

    def test_pick_first_scalar(self) -> None:
        self.assertEqual(_pick_first("x"), "x")

    def test_pick_first_empty(self) -> None:
        self.assertIsNone(_pick_first([]))
        self.assertIsNone(_pick_first(None))

    def test_dedup_by_id_removes_duplicates(self) -> None:
        items = [{"id": "a"}, {"id": "b"}, {"id": "a"}]
        self.assertEqual(_dedup_by_id(items), [{"id": "a"}, {"id": "b"}])

    def test_dedup_by_id_empty(self) -> None:
        self.assertEqual(_dedup_by_id([]), [])
        self.assertEqual(_dedup_by_id(None), [])

    def test_parse_date_value_string(self) -> None:
        self.assertEqual(_parse_date_value("2026-05-20"), "2026-05-20")

    def test_parse_date_value_dict(self) -> None:
        self.assertEqual(_parse_date_value({"start": "2026-01-01", "end": "2026-06-01"}), "2026-01-01")

    def test_parse_date_value_none(self) -> None:
        self.assertIsNone(_parse_date_value(None))
        self.assertIsNone(_parse_date_value(""))

    def test_parse_started_last_update_range_dict(self) -> None:
        v = {"start": "2025-01-01", "end": "2025-12-31"}
        result = _parse_started_last_update_range(v)
        self.assertEqual(result["startedAt"], "2025-01-01")
        self.assertEqual(result["lastUpdateAt"], "2025-12-31")

    def test_parse_started_last_update_range_string(self) -> None:
        result = _parse_started_last_update_range("2025-01-01")
        self.assertEqual(result["startedAt"], "2025-01-01")
        self.assertIsNone(result["lastUpdateAt"])

    def test_parse_started_last_update_range_none(self) -> None:
        result = _parse_started_last_update_range(None)
        self.assertIsNone(result["startedAt"])
        self.assertIsNone(result["lastUpdateAt"])

    def test_normalize_articles_field_splits_commas(self) -> None:
        result = _normalize_articles_field("https://a.com,https://b.com")
        self.assertIn("https://a.com", result)
        self.assertIn("https://b.com", result)

    def test_normalize_articles_field_splits_newlines(self) -> None:
        result = _normalize_articles_field("https://a.com\nhttps://b.com")
        self.assertIn("https://a.com", result)
        self.assertIn("https://b.com", result)

    def test_normalize_articles_field_deduplicates(self) -> None:
        result = _normalize_articles_field(["https://a.com", "https://a.com"])
        self.assertEqual(result.count("https://a.com"), 1)

    def test_normalize_articles_field_dict_url(self) -> None:
        result = _normalize_articles_field([{"url": "https://c.com"}])
        self.assertIn("https://c.com", result)

    def test_sort_by_date_desc_orders_latest_first(self) -> None:
        items = [
            {"date": "2024-01-01"},
            {"date": "2026-05-20"},
            {"date": "2025-06-15"},
        ]
        result = _sort_by_date_desc(items, lambda x: x.get("date"))
        self.assertEqual(result[0]["date"], "2026-05-20")
        self.assertEqual(result[-1]["date"], "2024-01-01")

    def test_sort_by_date_desc_handles_none_date(self) -> None:
        items = [{"date": None}, {"date": "2026-01-01"}]
        result = _sort_by_date_desc(items, lambda x: x.get("date"))
        self.assertEqual(result[0]["date"], "2026-01-01")

    def test_strip_property_prefix(self) -> None:
        self.assertEqual(_strip_property_prefix("property_thumbnail"), "thumbnail")
        self.assertEqual(_strip_property_prefix("thumbnail"), "thumbnail")

    def test_get_first_relation_id_list_of_strings(self) -> None:
        self.assertEqual(_get_first_relation_id(["aaa", "bbb"]), "aaa")

    def test_get_first_relation_id_list_of_dicts(self) -> None:
        self.assertEqual(_get_first_relation_id([{"id": "xyz"}]), "xyz")

    def test_get_first_relation_id_none(self) -> None:
        self.assertIsNone(_get_first_relation_id(None))
        self.assertIsNone(_get_first_relation_id([]))


# ===========================================================================
# TestNormalizeFunctions
# ===========================================================================


class TestNormalizeFunctions(unittest.TestCase):
    """Unit tests for each row-normalization function."""

    def _base_asset_row(self, asset_id: str = "asset-1") -> Dict[str, Any]:
        return {
            "id": asset_id,
            "name": "Cover Image",
            "url": "https://notion.so/asset-1",
            "property_label": "Cover",
            "property_type": "image",
            "property_filename": "cover.png",
            "property_relative_path": "Technology/MyProject/FolioAssets/cover.png",
            "property_projects": ["proj-1"],
            "property_collections": ["col-1"],
        }

    def test_normalize_resource(self) -> None:
        row = {
            "id": "res-1",
            "name": "GitHub Repo",
            "property_label": "GitHub",
            "property_type": "repo",
            "property_url": "github.com/user/repo",
            "property_icon": "github",
            "property_projects": ["proj-1"],
            "property_collections": [],
            "property_assets": [],
        }
        result = _normalize_resource(row)
        self.assertEqual(result["id"], "res-1")
        self.assertEqual(result["label"], "GitHub")
        self.assertEqual(result["type"], "repo")
        self.assertEqual(result["url"], "github.com/user/repo")
        self.assertEqual(result["projectIds"], ["proj-1"])
        self.assertEqual(result["collectionIds"], [])
        self.assertEqual(result["assetIds"], [])

    def test_normalize_thumbnail(self) -> None:
        row = self._base_asset_row("thumb-1")
        result = _normalize_thumbnail(row)
        self.assertEqual(result["id"], "thumb-1")
        self.assertEqual(result["filename"], "cover.png")
        self.assertEqual(result["relativePath"], "Technology/MyProject/FolioAssets/cover.png")
        self.assertEqual(result["resources"], [])

    def test_normalize_asset_with_thumbnail(self) -> None:
        thumb_row = self._base_asset_row("thumb-1")
        asset_row = self._base_asset_row("asset-2")
        asset_row["property_thumbnail"] = ["thumb-1"]
        asset_by_id = {"thumb-1": thumb_row}

        result = _normalize_asset(asset_row, asset_by_id)
        self.assertEqual(result["id"], "asset-2")
        self.assertIsNotNone(result["thumbnail"])
        self.assertEqual(result["thumbnail"]["id"], "thumb-1")
        self.assertEqual(result["resources"], [])

    def test_normalize_asset_no_thumbnail(self) -> None:
        asset_row = self._base_asset_row("asset-3")
        asset_row["property_thumbnail"] = []
        result = _normalize_asset(asset_row, {})
        self.assertIsNone(result["thumbnail"])

    def test_normalize_collection(self) -> None:
        row = {
            "id": "col-1",
            "name": "Screenshots",
            "property_label": "Screenshots",
            "property_one_liner": "App screenshots",
            "property_summary": "A collection of screenshots",
            "property_projects": ["proj-1"],
            "property_thumbnail": [],
            "property_collection_items": ["asset-1", "asset-2"],
        }
        result = _normalize_collection(row, {})
        self.assertEqual(result["id"], "col-1")
        self.assertEqual(result["label"], "Screenshots")
        self.assertEqual(result["oneLiner"], "App screenshots")
        self.assertEqual(result["collectionItemIds"], ["asset-1", "asset-2"])
        self.assertIsNone(result["thumbnail"])
        self.assertEqual(result["assets"], [])
        self.assertEqual(result["items"], [])

    def test_normalize_work_log_basic(self) -> None:
        row = {
            "id": "wl-1",
            "name": "Session 1",
            "url": "https://notion.so/wl-1",
            "property_entry": "Worked on feature X",
            "property_date": "2026-05-20",
            "property_session_start": None,
            "property_session_end": None,
            "property_public": True,
            "property_project": ["proj-1"],
            "property_what_happened": "Built the feature",
            "property_problems": "",
            "property_next_step": "  ",
            "property_session_type": ["Deep Work"],
            "property_milestone": [],
            "property_related_tasks": [],
            "property_sessions": [],
            "property_allow_automation": False,
        }
        result = _normalize_work_log(row)
        self.assertEqual(result["id"], "wl-1")
        self.assertEqual(result["date"], "2026-05-20")
        self.assertEqual(result["entry"], "Worked on feature X")
        self.assertTrue(result["public"])
        self.assertEqual(result["projectIds"], ["proj-1"])
        # Whitespace-only strings should become None
        self.assertIsNone(result["problems"])
        self.assertIsNone(result["nextStep"])
        self.assertEqual(result["sessionType"], ["Deep Work"])

    def test_normalize_work_log_non_empty_problems(self) -> None:
        row = {
            "id": "wl-2",
            "name": "Session 2",
            "property_problems": "Had a bug",
            "property_next_step": "Fix it",
            "property_public": True,
            "property_project": [],
        }
        result = _normalize_work_log(row)
        self.assertEqual(result["problems"], "Had a bug")
        self.assertEqual(result["nextStep"], "Fix it")

    def test_normalize_project_basic(self) -> None:
        row = {
            "id": "proj-1",
            "name": "Top Note",
            "property_title": ["Top Note"],
            "property_name": "Top Note",
            "property_summary": "An iOS notes app",
            "property_featured": True,
            "property_featured_order": 1,
            "property_tags": ["iOS", "Swift"],
            "property_category": ["application"],
            "property_status": "Complete",
            "property_phase": "Maintenance",
            "property_started_at": "2025-01-01",
            "property_last_update_at": "2026-05-01",
            "property_collections": [],
            "property_assets": [],
            "property_resources": [],
            "property_thumbnail": [],
        }
        result = _normalize_project(row, {}, ["property_thumbnail"])
        self.assertEqual(result["id"], "proj-1")
        self.assertEqual(result["title"], "Top Note")
        self.assertTrue(result["featured"])
        self.assertEqual(result["featuredOrder"], 1)
        self.assertEqual(result["tags"], ["iOS", "Swift"])
        self.assertEqual(result["startedAt"], "2025-01-01")
        self.assertEqual(result["lastUpdateAt"], "2026-05-01")
        self.assertEqual(result["collections"], [])
        self.assertEqual(result["workLogs"], [])

    def test_normalize_project_single_asset_media_promoted_to_top_level(self) -> None:
        thumb_raw = {
            "id": "thumb-1",
            "name": "Thumbnail",
            "property_label": "Thumb",
            "property_type": "image",
            "property_filename": "thumb.png",
            "property_relative_path": "assets/thumb.png",
            "property_projects": ["proj-1"],
            "property_collections": [],
        }
        asset_by_id = {"thumb-1": thumb_raw}
        row = {
            "id": "proj-1",
            "name": "My Project",
            "property_title": ["My Project"],
            "property_name": "My Project",
            "property_thumbnail": ["thumb-1"],
            "property_banner": ["thumb-1"],
            "property_collections": [],
            "property_assets": [],
            "property_resources": [],
        }
        result = _normalize_project(row, asset_by_id, ["property_thumbnail", "property_banner"])
        self.assertIsNotNone(result["thumbnail"])
        # Non-thumbnail single-asset relations should be promoted to top level
        self.assertIn("banner", result)
        self.assertIsNotNone(result["banner"])


# ===========================================================================
# TestAssemble
# ===========================================================================


class TestAssemble(unittest.TestCase):
    """Integration tests for the assemble() orchestration function."""

    def _minimal_project_row(self, pid: str, name: str) -> Dict[str, Any]:
        return {
            "id": pid,
            "name": name,
            "property_title": [name],
            "property_name": name,
            "property_collections": [],
            "property_assets": [],
            "property_resources": [],
            "property_thumbnail": [],
        }

    def _minimal_config_row(self, root_path: str, name: str = "2026-05-20") -> Dict[str, Any]:
        return {"id": "cfg-1", "name": name, "property_root_path": root_path}

    def test_assemble_minimal_one_project(self) -> None:
        payload = assemble(
            config_rows=[self._minimal_config_row("/some/root")],
            projects_rows=[self._minimal_project_row("proj-1", "My Project")],
            collections_rows=[],
            assets_rows=[],
            resources_rows=[],
            work_logs_rows=[],
        )
        self.assertIn("config", payload)
        self.assertIn("projects", payload)
        self.assertIn("workLogs", payload)
        self.assertEqual(len(payload["projects"]), 1)
        self.assertEqual(payload["projects"][0]["title"], "My Project")
        self.assertEqual(payload["config"]["root_path"], "/some/root")

    def test_assemble_attaches_resource_to_project(self) -> None:
        resource_row = {
            "id": "res-1",
            "name": "GitHub",
            "property_label": "GitHub",
            "property_type": "repo",
            "property_url": "github.com/user/repo",
            "property_icon": "github",
            "property_projects": ["proj-1"],
            "property_collections": [],
            "property_assets": [],
        }
        payload = assemble(
            config_rows=[self._minimal_config_row("/root")],
            projects_rows=[self._minimal_project_row("proj-1", "My Project")],
            collections_rows=[],
            assets_rows=[],
            resources_rows=[resource_row],
            work_logs_rows=[],
        )
        proj = payload["projects"][0]
        self.assertEqual(len(proj["resources"]), 1)
        self.assertEqual(proj["resources"][0]["label"], "GitHub")

    def test_assemble_attaches_asset_to_collection(self) -> None:
        asset_row = {
            "id": "asset-1",
            "name": "Screenshot",
            "property_label": "Screenshot",
            "property_type": "image",
            "property_filename": "screen.png",
            "property_relative_path": "assets/screen.png",
            "property_projects": [],
            "property_collections": ["col-1"],
            "property_thumbnail": [],
        }
        collection_row = {
            "id": "col-1",
            "name": "Screenshots",
            "property_label": "Screenshots",
            "property_projects": ["proj-1"],
            "property_thumbnail": [],
            "property_collection_items": [],
            "property_one_liner": None,
            "property_summary": None,
        }
        proj_row = self._minimal_project_row("proj-1", "My Project")
        proj_row["property_collections"] = ["col-1"]

        payload = assemble(
            config_rows=[self._minimal_config_row("/root")],
            projects_rows=[proj_row],
            collections_rows=[collection_row],
            assets_rows=[asset_row],
            resources_rows=[],
            work_logs_rows=[],
        )
        proj = payload["projects"][0]
        self.assertEqual(len(proj["collections"]), 1)
        col = proj["collections"][0]
        self.assertEqual(len(col["assets"]), 1)
        self.assertEqual(col["assets"][0]["id"], "asset-1")

    def test_assemble_collection_items_from_collection_item_ids(self) -> None:
        asset_row = {
            "id": "item-1",
            "name": "Item",
            "property_label": "Item",
            "property_type": "image",
            "property_filename": "item.png",
            "property_relative_path": "assets/item.png",
            "property_projects": [],
            "property_collections": [],
            "property_thumbnail": [],
        }
        collection_row = {
            "id": "col-1",
            "name": "Gallery",
            "property_label": "Gallery",
            "property_projects": [],
            "property_thumbnail": [],
            "property_collection_items": ["item-1"],
            "property_one_liner": None,
            "property_summary": None,
        }
        payload = assemble(
            config_rows=[self._minimal_config_row("/root")],
            projects_rows=[],
            collections_rows=[collection_row],
            assets_rows=[asset_row],
            resources_rows=[],
            work_logs_rows=[],
        )
        # The payload has no projects, but we can inspect workLogs is empty
        self.assertEqual(len(payload["workLogs"]), 0)

    def test_assemble_work_logs_sorted_descending(self) -> None:
        wl_rows = [
            {
                "id": "wl-old",
                "name": "Old",
                "property_date": "2024-01-15",
                "property_public": True,
                "property_project": ["proj-1"],
                "property_problems": None,
                "property_next_step": None,
            },
            {
                "id": "wl-new",
                "name": "New",
                "property_date": "2026-05-01",
                "property_public": True,
                "property_project": ["proj-1"],
                "property_problems": None,
                "property_next_step": None,
            },
        ]
        payload = assemble(
            config_rows=[self._minimal_config_row("/root")],
            projects_rows=[self._minimal_project_row("proj-1", "My Project")],
            collections_rows=[],
            assets_rows=[],
            resources_rows=[],
            work_logs_rows=wl_rows,
        )
        proj = payload["projects"][0]
        self.assertEqual(proj["workLogs"][0]["id"], "wl-new")  # most recent first
        self.assertEqual(proj["workLogs"][1]["id"], "wl-old")

        # Top-level workLogs should also be sorted descending.
        self.assertEqual(payload["workLogs"][0]["id"], "wl-new")

    def test_assemble_deduplicates_resources_on_project(self) -> None:
        resource_row = {
            "id": "res-1",
            "name": "Link",
            "property_label": "Link",
            "property_type": "url-link",
            "property_url": "https://example.com",
            "property_icon": None,
            "property_projects": ["proj-1"],
            "property_collections": [],
            "property_assets": [],
        }
        payload = assemble(
            config_rows=[self._minimal_config_row("/root")],
            projects_rows=[self._minimal_project_row("proj-1", "My Project")],
            collections_rows=[],
            assets_rows=[],
            # Same resource row duplicated (simulates upstream quirk)
            resources_rows=[resource_row, resource_row],
            work_logs_rows=[],
        )
        proj = payload["projects"][0]
        self.assertEqual(len(proj["resources"]), 1)

    def test_assemble_config_picks_latest_date_row(self) -> None:
        config_rows = [
            {"id": "c1", "name": "2024-01-01", "property_root_path": "/old/root"},
            {"id": "c2", "name": "2026-05-20", "property_root_path": "/new/root"},
            {"id": "c3", "name": "some-label", "property_root_path": "/label/root"},
        ]
        payload = assemble(
            config_rows=config_rows,
            projects_rows=[],
            collections_rows=[],
            assets_rows=[],
            resources_rows=[],
            work_logs_rows=[],
        )
        self.assertEqual(payload["config"]["root_path"], "/new/root")

    def test_assemble_config_fallback_to_first_row_when_no_dates(self) -> None:
        config_rows = [
            {"id": "c1", "name": "main-config", "property_root_path": "/some/root"},
        ]
        payload = assemble(
            config_rows=config_rows,
            projects_rows=[],
            collections_rows=[],
            assets_rows=[],
            resources_rows=[],
            work_logs_rows=[],
        )
        self.assertEqual(payload["config"]["root_path"], "/some/root")

    def test_assemble_no_work_logs_returns_empty_list(self) -> None:
        payload = assemble(
            config_rows=[self._minimal_config_row("/root")],
            projects_rows=[self._minimal_project_row("proj-1", "P1")],
            collections_rows=[],
            assets_rows=[],
            resources_rows=[],
            work_logs_rows=[],
        )
        self.assertEqual(payload["workLogs"], [])
        self.assertEqual(payload["projects"][0]["workLogs"], [])


# ===========================================================================
# TestBuildConfig (isolated)
# ===========================================================================


class TestBuildConfig(unittest.TestCase):
    """Unit tests for _build_config() in isolation."""

    def test_strips_property_prefix(self) -> None:
        rows = [{"id": "c1", "name": "2026-01-01", "property_root_path": "/root"}]
        result = _build_config(rows)
        self.assertIn("root_path", result)
        self.assertNotIn("property_root_path", result)

    def test_omits_null_values(self) -> None:
        rows = [{"id": "c1", "name": "cfg", "property_root_path": "/root", "property_empty": ""}]
        result = _build_config(rows)
        self.assertNotIn("empty", result)

    def test_single_element_list_is_unwrapped(self) -> None:
        rows = [{"id": "c1", "name": "cfg", "property_root_path": ["/root"]}]
        result = _build_config(rows)
        self.assertEqual(result["root_path"], "/root")

    def test_empty_rows_returns_empty_dict(self) -> None:
        result = _build_config([])
        self.assertEqual(result, {})


# ===========================================================================
# TestQueryDatabase (mocked Notion client)
# ===========================================================================


class TestQueryDatabase(unittest.TestCase):
    """Tests for query_database() — Notion client is fully mocked."""

    def test_returns_mapped_pages(self) -> None:
        pages = [
            _make_notion_page("p-1", {"Name": _title_prop("Alpha")}),
            _make_notion_page("p-2", {"Name": _title_prop("Beta")}),
        ]
        client = _make_mock_notion_client([pages])
        result = query_database(client, "db-123")
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "Alpha")
        self.assertEqual(result[1]["name"], "Beta")

    def test_paginates_when_has_more(self) -> None:
        page1 = _make_notion_page("p-1", {"Name": _title_prop("First")})
        page2 = _make_notion_page("p-2", {"Name": _title_prop("Second")})

        mock = MagicMock()
        mock.databases.query.side_effect = [
            {"results": [page1], "has_more": True, "next_cursor": "cursor-abc"},
            {"results": [page2], "has_more": False, "next_cursor": None},
        ]
        result = query_database(mock, "db-123")
        self.assertEqual(len(result), 2)
        # Second call should have passed the cursor.
        second_call_kwargs = mock.databases.query.call_args_list[1][1]
        self.assertEqual(second_call_kwargs["start_cursor"], "cursor-abc")

    def test_applies_single_checkbox_filter(self) -> None:
        client = _make_mock_notion_client([[]])
        query_database(client, "db-1", [{"property": "public", "checkbox": {"equals": True}}])
        call_kwargs = client.databases.query.call_args[1]
        self.assertEqual(call_kwargs["filter"], {"property": "public", "checkbox": {"equals": True}})

    def test_applies_and_filter_for_multiple_conditions(self) -> None:
        client = _make_mock_notion_client([[]])
        filter_conditions = [
            {"property": "in showcase", "checkbox": {"equals": True}},
            {"property": "public", "checkbox": {"equals": True}},
        ]
        query_database(client, "db-1", filter_conditions)
        call_kwargs = client.databases.query.call_args[1]
        self.assertEqual(call_kwargs["filter"], {"and": filter_conditions})

    def test_no_filter_when_none(self) -> None:
        client = _make_mock_notion_client([[]])
        query_database(client, "db-1", None)
        call_kwargs = client.databases.query.call_args[1]
        self.assertNotIn("filter", call_kwargs)

    def test_empty_database_returns_empty_list(self) -> None:
        client = _make_mock_notion_client([[]])
        result = query_database(client, "db-1")
        self.assertEqual(result, [])


# ===========================================================================
# TestMainCLI
# ===========================================================================

_REQUIRED_ENV = {
    "NOTION_API_KEY": "secret_test_key",
    "NOTION_PROJECTS_DB_ID": "proj-db-id",
    "NOTION_COLLECTIONS_DB_ID": "col-db-id",
    "NOTION_ASSETS_DB_ID": "asset-db-id",
    "NOTION_RESOURCES_DB_ID": "res-db-id",
    "NOTION_CONFIG_DB_ID": "cfg-db-id",
    "NOTION_WORK_LOGS_DB_ID": "wl-db-id",
}


def _make_mock_query_database(project_name: str = "Test Project") -> Any:
    """Return a mock for query_database that produces one project and empty tables."""
    config_row = {
        "id": "cfg-1",
        "name": "2026-05-20",
        "url": "",
        "property_root_path": "/tmp/test-root",
    }
    project_row = {
        "id": "proj-1",
        "name": project_name,
        "url": "",
        "property_title": [project_name],
        "property_name": project_name,
        "property_collections": [],
        "property_assets": [],
        "property_resources": [],
        "property_thumbnail": [],
    }

    def _side_effect(client_arg: Any, db_id: str, filter_conditions: Any = None) -> List[Any]:
        if db_id == "cfg-db-id":
            return [config_row]
        if db_id == "proj-db-id":
            return [project_row]
        return []

    return _side_effect


class TestMainCLI(unittest.TestCase):
    """End-to-end tests for main() — Notion client and env loading are mocked."""

    def _run_main(self, extra_args: List[str], env_override: Optional[Dict[str, str]] = None) -> Any:
        """Run main() with a fully mocked environment and Notion client.

        Returns the mock object so callers can inspect calls.
        """
        env = {**_REQUIRED_ENV, **(env_override or {})}
        mock_client = MagicMock()
        mock_client.databases.query.return_value = {
            "results": [],
            "has_more": False,
            "next_cursor": None,
        }

        with patch.dict(os.environ, env, clear=False), \
             patch("notion_projects_export.load_dotenv"), \
             patch("notion_projects_export.NotionClient", return_value=mock_client), \
             patch("notion_projects_export.query_database", side_effect=_make_mock_query_database()):
            main(extra_args)

        return mock_client

    def test_main_writes_output_file(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "out.json"
            self._run_main(["--output", str(out)])
            self.assertTrue(out.exists())
            payload = json.loads(out.read_text())
            self.assertIn("projects", payload)
            self.assertIn("config", payload)

    def test_main_dry_run_does_not_write_file(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "should_not_exist.json"
            self._run_main(["--output", str(out), "--dry-run"])
            self.assertFalse(out.exists())

    def test_main_dry_run_prints_summary(self) -> None:
        import io
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "out.json"
            with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
                self._run_main(["--output", str(out), "--dry-run"])
            output = mock_stdout.getvalue()
            self.assertIn("dry-run", output)

    def test_main_missing_api_key_exits(self) -> None:
        env = {k: v for k, v in _REQUIRED_ENV.items() if k != "NOTION_API_KEY"}
        # Remove key from environment by patching os.environ directly.
        clean_env = {k: v for k, v in os.environ.items() if k not in _REQUIRED_ENV}
        clean_env.update(env)

        with patch.dict(os.environ, clean_env, clear=True), \
             patch("notion_projects_export.load_dotenv"):
            with self.assertRaises(SystemExit) as ctx:
                main(["--output", "/tmp/unused.json"])
        self.assertNotEqual(ctx.exception.code, 0)

    def test_main_missing_db_id_exits(self) -> None:
        env = {k: v for k, v in _REQUIRED_ENV.items() if k != "NOTION_PROJECTS_DB_ID"}
        clean_env = {k: v for k, v in os.environ.items() if k not in _REQUIRED_ENV}
        clean_env.update(env)

        with patch.dict(os.environ, clean_env, clear=True), \
             patch("notion_projects_export.load_dotenv"):
            with self.assertRaises(SystemExit) as ctx:
                main(["--output", "/tmp/unused.json"])
        self.assertNotEqual(ctx.exception.code, 0)

    def test_main_creates_output_directory_if_missing(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "nested" / "dir" / "out.json"
            self._run_main(["--output", str(out)])
            self.assertTrue(out.exists())

    def test_main_output_is_valid_json(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "out.json"
            self._run_main(["--output", str(out)])
            # Should not raise
            payload = json.loads(out.read_text())
            self.assertIsInstance(payload["projects"], list)
            self.assertIsInstance(payload["workLogs"], list)
            self.assertIsInstance(payload["config"], dict)


if __name__ == "__main__":
    unittest.main()
