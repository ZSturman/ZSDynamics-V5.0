#!/usr/bin/env python3
"""Live integration tests for notion_projects_export.py.

These tests make REAL network calls to the Notion API.
They are intentionally separate from the offline unit tests in
test_notion_projects_export.py so you can run the unit suite offline.

Run with:
    .venv/bin/python -m pytest tests_python/test_notion_integration.py -v

Requirements:
    - All NOTION_* vars must be set in .env.local
    - Internet access to api.notion.com must be available
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Bootstrap: load .env.local before any test collects so that the env vars
# are available to all test cases.
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_LOCAL = _PROJECT_ROOT / ".env.local"

if _ENV_LOCAL.exists():
    load_dotenv(_ENV_LOCAL, override=True)

_REQUIRED_VARS = [
    "NOTION_API_KEY",
    "NOTION_PROJECTS_DB_ID",
    "NOTION_COLLECTIONS_DB_ID",
    "NOTION_ASSETS_DB_ID",
    "NOTION_RESOURCES_DB_ID",
    "NOTION_CONFIG_DB_ID",
    "NOTION_WORK_LOGS_DB_ID",
]

_SCRIPT = _PROJECT_ROOT / "lib" / "notion_projects_export.py"
_OUTPUT = _PROJECT_ROOT / "tmp" / "new_projects.json"
_PYTHON = sys.executable


# ===========================================================================
# Helpers
# ===========================================================================

def _client():
    """Return an authenticated Notion client pinned to API version 2022-06-28.

    Must match the version used by notion_projects_export.py — that version
    exposes the databases/{id}/query endpoint which the script depends on.
    """
    from notion_client import Client
    return Client(auth=os.environ["NOTION_API_KEY"], notion_version="2022-06-28")


# ===========================================================================
# 1. Environment / credential checks
# ===========================================================================

class TestEnvironment:
    """Verify that .env.local is fully populated before touching the API."""

    def test_env_local_exists(self):
        assert _ENV_LOCAL.exists(), (
            f".env.local not found at {_ENV_LOCAL}. "
            "Copy .env.example to .env.local and fill in the Notion values."
        )

    @pytest.mark.parametrize("var", _REQUIRED_VARS)
    def test_required_var_is_set(self, var):
        value = os.environ.get(var, "")
        assert value, (
            f"Environment variable '{var}' is missing or empty in .env.local."
        )

    def test_api_key_looks_valid(self):
        key = os.environ.get("NOTION_API_KEY", "")
        # Notion tokens use various prefixes depending on the integration type:
        #   secret_  — internal integration (legacy)
        #   ntn_     — public OAuth integration
        #   sntn_    — newer internal integration format
        # Accept anything that contains an underscore and is sufficiently long.
        has_prefix = "_" in key and len(key) > 20
        assert has_prefix, (
            f"NOTION_API_KEY doesn't look like a valid Notion integration token "
            f"(expected a token with an underscore prefix such as 'secret_...', 'ntn_...', or 'sntn_...'). "
            f"Got: {key[:12]}..."
        )

    @pytest.mark.parametrize("var", [v for v in _REQUIRED_VARS if v.endswith("_DB_ID")])
    def test_db_id_looks_like_uuid(self, var):
        import re
        val = os.environ.get(var, "")
        uuid_re = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            re.IGNORECASE,
        )
        assert uuid_re.match(val), (
            f"{var} doesn't look like a UUID (got: {val!r}). "
            "Check your .env.local."
        )


# ===========================================================================
# 2. Notion API connectivity
# ===========================================================================

class TestNotionConnectivity:
    """Verify the integration token is authorized and the API is reachable."""

    def test_auth_token_is_valid(self):
        """notion.users.me() returns a user object — proves the token works."""
        client = _client()
        me = client.users.me()
        assert me.get("object") == "user", (
            f"Expected a user object from Notion, got: {me}"
        )

    def test_can_retrieve_projects_database_metadata(self):
        client = _client()
        db = client.databases.retrieve(os.environ["NOTION_PROJECTS_DB_ID"])
        assert db.get("object") == "database"

    def test_can_retrieve_collections_database_metadata(self):
        client = _client()
        db = client.databases.retrieve(os.environ["NOTION_COLLECTIONS_DB_ID"])
        assert db.get("object") == "database"

    def test_can_retrieve_assets_database_metadata(self):
        client = _client()
        db = client.databases.retrieve(os.environ["NOTION_ASSETS_DB_ID"])
        assert db.get("object") == "database"

    def test_can_retrieve_resources_database_metadata(self):
        client = _client()
        db = client.databases.retrieve(os.environ["NOTION_RESOURCES_DB_ID"])
        assert db.get("object") == "database"

    def test_can_retrieve_config_database_metadata(self):
        client = _client()
        db = client.databases.retrieve(os.environ["NOTION_CONFIG_DB_ID"])
        assert db.get("object") == "database"

    def test_can_retrieve_work_logs_database_metadata(self):
        client = _client()
        db = client.databases.retrieve(os.environ["NOTION_WORK_LOGS_DB_ID"])
        assert db.get("object") == "database"


# ===========================================================================
# 3. Live database query checks (one page per DB, with production filters)
# ===========================================================================

class TestNotionDatabaseQueries:
    """Query each DB exactly as the script does and sanity-check the results."""

    def _query_one(self, db_id: str, filter_conditions=None) -> list:
        """Return up to 1 page from a database using the script's own helper."""
        # Import the real function from the script.
        sys.path.insert(0, str(_PROJECT_ROOT / "lib"))
        from notion_projects_export import query_database  # type: ignore
        client = _client()
        return query_database(client, db_id, filter_conditions)

    def test_projects_db_returns_results(self):
        """Projects filtered by in showcase=true AND public=true must be non-empty."""
        rows = self._query_one(
            os.environ["NOTION_PROJECTS_DB_ID"],
            filter_conditions=[
                {"property": "in showcase", "checkbox": {"equals": True}},
                {"property": "public", "checkbox": {"equals": True}},
            ],
        )
        assert len(rows) > 0, (
            "No projects found with 'in showcase'=true AND 'public'=true. "
            "Make sure at least one Notion project row meets both conditions."
        )
        first = rows[0]
        assert "id" in first, f"Project row missing 'id': {first.keys()}"

    def test_collections_db_returns_results(self):
        rows = self._query_one(
            os.environ["NOTION_COLLECTIONS_DB_ID"],
            filter_conditions=[{"property": "public", "checkbox": {"equals": True}}],
        )
        assert isinstance(rows, list), "Expected a list from collections query"

    def test_assets_db_returns_results(self):
        rows = self._query_one(
            os.environ["NOTION_ASSETS_DB_ID"],
            filter_conditions=[{"property": "public", "checkbox": {"equals": True}}],
        )
        assert isinstance(rows, list), "Expected a list from assets query"

    def test_resources_db_returns_results(self):
        rows = self._query_one(
            os.environ["NOTION_RESOURCES_DB_ID"],
            filter_conditions=[{"property": "public", "checkbox": {"equals": True}}],
        )
        assert isinstance(rows, list), "Expected a list from resources query"

    def test_config_db_returns_at_least_one_row(self):
        rows = self._query_one(os.environ["NOTION_CONFIG_DB_ID"])
        assert len(rows) > 0, (
            "Config database returned no rows. "
            "The config DB must have at least one row."
        )

    def test_work_logs_db_is_queryable(self):
        rows = self._query_one(
            os.environ["NOTION_WORK_LOGS_DB_ID"],
            filter_conditions=[{"property": "public", "checkbox": {"equals": True}}],
        )
        assert isinstance(rows, list), "Expected a list from work logs query"


# ===========================================================================
# 4. Dry-run: full assembly without writing any file
# ===========================================================================

class TestDryRun:
    """Run the script with --dry-run to validate assembly end-to-end."""

    def test_dry_run_exits_zero(self):
        result = subprocess.run(
            [_PYTHON, str(_SCRIPT), "--dry-run"],
            capture_output=True,
            text=True,
            cwd=str(_PROJECT_ROOT),
        )
        assert result.returncode == 0, (
            f"--dry-run exited with code {result.returncode}\n"
            f"STDOUT:\n{result.stdout}\n"
            f"STDERR:\n{result.stderr}"
        )

    def test_dry_run_does_not_create_output_file(self):
        # Remove the file if it exists from a previous run.
        if _OUTPUT.exists():
            _OUTPUT.unlink()

        subprocess.run(
            [_PYTHON, str(_SCRIPT), "--dry-run"],
            capture_output=True,
            text=True,
            cwd=str(_PROJECT_ROOT),
        )
        assert not _OUTPUT.exists(), (
            "--dry-run should NOT write tmp/new_projects.json"
        )

    def test_dry_run_prints_summary(self):
        result = subprocess.run(
            [_PYTHON, str(_SCRIPT), "--dry-run"],
            capture_output=True,
            text=True,
            cwd=str(_PROJECT_ROOT),
        )
        combined = result.stdout + result.stderr
        # The script should mention projects/config counts in dry-run output.
        assert "project" in combined.lower() or "config" in combined.lower(), (
            f"Dry-run output didn't mention any counts:\n{combined}"
        )


# ===========================================================================
# 5. Full run: writes tmp/new_projects.json and validates the schema
# ===========================================================================

class TestFullRun:
    """Run the script for real and verify tmp/new_projects.json matches the
    shape expected by folio-prebuild.py / projects_pipeline.py."""

    @pytest.fixture(autouse=True)
    def run_script(self):
        """Run the script once; all tests in this class share the output."""
        result = subprocess.run(
            [_PYTHON, str(_SCRIPT), "--output", str(_OUTPUT)],
            capture_output=True,
            text=True,
            cwd=str(_PROJECT_ROOT),
        )
        self._result = result
        yield
        # Do NOT clean up — leave the file so folio-prebuild.py can consume it.

    # --- subprocess exit ------------------------------------------------

    def test_script_exits_zero(self):
        assert self._result.returncode == 0, (
            f"Script exited with code {self._result.returncode}\n"
            f"STDOUT:\n{self._result.stdout}\n"
            f"STDERR:\n{self._result.stderr}"
        )

    # --- file creation --------------------------------------------------

    def test_output_file_is_created(self):
        assert _OUTPUT.exists(), (
            f"tmp/new_projects.json was not created at {_OUTPUT}"
        )

    def test_output_file_is_non_empty(self):
        assert _OUTPUT.stat().st_size > 0, "tmp/new_projects.json is empty"

    # --- JSON validity --------------------------------------------------

    def test_output_is_valid_json(self):
        with open(_OUTPUT) as f:
            data = json.load(f)
        assert isinstance(data, dict), "Output JSON must be a top-level object"

    # --- top-level schema -----------------------------------------------

    def test_output_has_config_key(self):
        with open(_OUTPUT) as f:
            data = json.load(f)
        assert "config" in data, f"Missing 'config' key. Keys: {list(data)}"

    def test_output_has_projects_key(self):
        with open(_OUTPUT) as f:
            data = json.load(f)
        assert "projects" in data, f"Missing 'projects' key. Keys: {list(data)}"

    def test_output_has_work_logs_key(self):
        with open(_OUTPUT) as f:
            data = json.load(f)
        assert "workLogs" in data, f"Missing 'workLogs' key. Keys: {list(data)}"

    # --- config schema --------------------------------------------------

    def test_config_is_a_dict(self):
        with open(_OUTPUT) as f:
            data = json.load(f)
        assert isinstance(data["config"], dict), (
            f"'config' must be a dict, got: {type(data['config'])}"
        )

    # --- projects schema ------------------------------------------------

    def test_projects_is_a_non_empty_list(self):
        with open(_OUTPUT) as f:
            data = json.load(f)
        projects = data["projects"]
        assert isinstance(projects, list) and len(projects) > 0, (
            "'projects' must be a non-empty list (check 'in showcase' + 'public' filters)"
        )

    def test_each_project_has_id(self):
        with open(_OUTPUT) as f:
            data = json.load(f)
        for p in data["projects"]:
            assert "id" in p, f"Project missing 'id': {list(p.keys())}"

    def test_each_project_has_name_or_title(self):
        with open(_OUTPUT) as f:
            data = json.load(f)
        for p in data["projects"]:
            has_name = bool(p.get("name")) or bool(p.get("title"))
            assert has_name, (
                f"Project {p.get('id')} has neither 'name' nor 'title'"
            )

    def test_projects_have_collections_list(self):
        """Every project dict must carry a 'collections' array (may be empty)."""
        with open(_OUTPUT) as f:
            data = json.load(f)
        for p in data["projects"]:
            assert "collections" in p, (
                f"Project {p.get('id')} missing 'collections' key"
            )
            assert isinstance(p["collections"], list), (
                f"Project {p.get('id')} 'collections' is not a list"
            )

    def test_projects_have_resources_list(self):
        """Every project dict must carry a 'resources' array (may be empty)."""
        with open(_OUTPUT) as f:
            data = json.load(f)
        for p in data["projects"]:
            assert "resources" in p, (
                f"Project {p.get('id')} missing 'resources' key"
            )

    # --- work logs schema -----------------------------------------------

    def test_work_logs_is_a_list(self):
        with open(_OUTPUT) as f:
            data = json.load(f)
        assert isinstance(data["workLogs"], list), (
            f"'workLogs' must be a list, got: {type(data['workLogs'])}"
        )

    # --- output path sanity ---------------------------------------------

    def test_output_path_matches_expected_location(self):
        assert _OUTPUT == _PROJECT_ROOT / "tmp" / "new_projects.json", (
            "Output path has drifted from tmp/new_projects.json — "
            "update package.json generate-projects script accordingly."
        )
