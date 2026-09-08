"""Tests for lib/folio-prebuild.py's --dry-run mode.

These characterize the one hard requirement of a dry run: it must exercise
the exact same normalization + media-resolution pipeline a real build would
run, while never writing, deleting, or renaming anything under public/.

All tests are fully offline and operate on synthetic fixtures only — none of
them touch the real repository's public/projects directory.
"""

from __future__ import annotations

import importlib.util
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

# folio-prebuild.py does `from projects_pipeline import build_projects_from_json`,
# an absolute import that assumes lib/ is already on sys.path.
_LIB_DIR = Path(__file__).resolve().parent.parent / "lib"
sys.path.insert(0, str(_LIB_DIR))


def _import_folio_prebuild():
    """Import a fresh lib/folio-prebuild.py module instance.

    Hyphenated filenames aren't importable as `import folio-prebuild`, so this
    mirrors the same importlib.util pattern used for lib/media-optimizer.py
    in tests_python/test_projects_pipeline.py.
    """
    spec = importlib.util.spec_from_file_location("folio_prebuild", str(_LIB_DIR / "folio-prebuild.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _write_fixture(temp_root: Path, *, include_thumbnail: bool = True) -> Path:
    """Write a minimal new_projects.json plus one real local image file."""
    if include_thumbnail:
        media_dir = temp_root / "Assets"
        media_dir.mkdir(parents=True, exist_ok=True)
        (media_dir / "hero.png").write_bytes(b"fake-png-bytes")

    payload = {
        "config": {"root_path": str(temp_root)},
        "projects": [
            {
                "id": "project-dry-run",
                "title": "Dry Run Fixture",
                "summary": "A project used only to exercise --dry-run.",
                "thumbnail": (
                    {"filename": "hero.png", "relativePath": "Assets/hero.png"} if include_thumbnail else None
                ),
            }
        ],
    }
    input_json = temp_root / "new_projects.json"
    input_json.write_text(json.dumps(payload), encoding="utf-8")
    return input_json


class TestFolioPrebuildDryRun(unittest.TestCase):
    def test_dry_run_never_deletes_or_replaces_the_real_public_projects_dir(self) -> None:
        """The single most important guarantee: --dry-run must never call the
        destructive rmtree/rename sequence a real build uses to replace
        public/projects, regardless of input.

        run_dry_run()'s own throwaway temp directory (created with prefix
        "folio-dry-run-") is expected to be rmtree'd on cleanup — that is the
        one and only path this is allowed to appear on.
        """
        mod = _import_folio_prebuild()

        with tempfile.TemporaryDirectory() as temp_root_str:
            temp_root = Path(temp_root_str)
            input_json = _write_fixture(temp_root)

            with patch.object(mod.shutil, "rmtree", wraps=mod.shutil.rmtree) as spy_rmtree:
                mod.run_dry_run(input_json, root_override=None)

            for call_args in spy_rmtree.call_args_list:
                deleted_path = Path(call_args.args[0])
                self.assertTrue(
                    deleted_path.name.startswith("folio-dry-run-"),
                    f"rmtree was called on an unexpected path: {deleted_path}",
                )

    def test_dry_run_reports_project_and_media_counts_as_json(self) -> None:
        mod = _import_folio_prebuild()

        with tempfile.TemporaryDirectory() as temp_root_str:
            temp_root = Path(temp_root_str)
            input_json = _write_fixture(temp_root)

            stdout = io.StringIO()
            with redirect_stdout(stdout):
                mod.run_dry_run(input_json, root_override=None, as_json=True)

            report = json.loads(stdout.getvalue())
            self.assertTrue(report["ok"])
            self.assertTrue(report["dryRun"])
            self.assertFalse(report["wroteToPublicProjects"])
            self.assertEqual(report["projectCount"], 1)
            self.assertGreaterEqual(report["generatedFileCount"], 1)
            self.assertEqual(report["projects"][0]["id"], "project-dry-run")
            self.assertIn("thumbnail", report["projects"][0]["images"])

    def test_dry_run_human_readable_output_states_nothing_was_written(self) -> None:
        mod = _import_folio_prebuild()

        with tempfile.TemporaryDirectory() as temp_root_str:
            temp_root = Path(temp_root_str)
            input_json = _write_fixture(temp_root)

            stdout = io.StringIO()
            with redirect_stdout(stdout):
                mod.run_dry_run(input_json, root_override=None, as_json=False)

            output = stdout.getvalue()
            self.assertIn("DRY RUN", output)
            self.assertIn("no files were written", output.lower())

    def test_dry_run_reports_missing_thumbnail_without_touching_disk(self) -> None:
        mod = _import_folio_prebuild()

        with tempfile.TemporaryDirectory() as temp_root_str:
            temp_root = Path(temp_root_str)
            input_json = _write_fixture(temp_root, include_thumbnail=False)

            stdout = io.StringIO()
            with redirect_stdout(stdout):
                mod.run_dry_run(input_json, root_override=None, as_json=True)

            report = json.loads(stdout.getvalue())
            self.assertIn("project-dry-run", report["missingThumbnailProjects"])

    def test_dry_run_fails_loudly_without_a_traceback_on_malformed_input(self) -> None:
        mod = _import_folio_prebuild()

        with tempfile.TemporaryDirectory() as temp_root_str:
            temp_root = Path(temp_root_str)
            input_json = temp_root / "new_projects.json"
            input_json.write_text("{not valid json", encoding="utf-8")

            with patch.object(mod.shutil, "rmtree", wraps=mod.shutil.rmtree) as spy_rmtree:
                with self.assertRaises(SystemExit) as ctx:
                    mod.run_dry_run(input_json, root_override=None)

            self.assertNotEqual(ctx.exception.code, 0)
            for call_args in spy_rmtree.call_args_list:
                deleted_path = Path(call_args.args[0])
                self.assertTrue(
                    deleted_path.name.startswith("folio-dry-run-"),
                    f"rmtree was called on an unexpected path: {deleted_path}",
                )

    def test_temp_build_directory_is_cleaned_up_after_dry_run(self) -> None:
        """run_dry_run must leave no trace on disk once it returns — its temp
        output directory is a context manager, not a leaked scratch dir."""
        mod = _import_folio_prebuild()
        captured_temp_dirs: list[Path] = []

        original_build = mod.build_projects_from_json

        def _spy_build(*, temp_public_projects_root: Path, **kwargs):
            captured_temp_dirs.append(temp_public_projects_root)
            return original_build(temp_public_projects_root=temp_public_projects_root, **kwargs)

        with tempfile.TemporaryDirectory() as temp_root_str:
            temp_root = Path(temp_root_str)
            input_json = _write_fixture(temp_root)

            with patch.object(mod, "build_projects_from_json", side_effect=_spy_build):
                mod.run_dry_run(input_json, root_override=None)

        self.assertEqual(len(captured_temp_dirs), 1)
        self.assertFalse(captured_temp_dirs[0].exists())

    def test_main_dry_run_flag_never_constructs_buildpaths_or_takes_a_lock(self) -> None:
        """--dry-run through the real CLI entrypoint must short-circuit
        before BuildPaths()/acquire_lock() — i.e. before anything that
        resolves or touches the real public/ directory."""
        mod = _import_folio_prebuild()

        with tempfile.TemporaryDirectory() as temp_root_str:
            temp_root = Path(temp_root_str)
            input_json = _write_fixture(temp_root)

            argv = ["folio-prebuild.py", "--input-json", str(input_json), "--dry-run", "--json"]
            stdout = io.StringIO()
            with patch.object(sys, "argv", argv), patch.object(mod, "BuildPaths") as spy_build_paths, patch.object(
                mod, "acquire_lock"
            ) as spy_acquire_lock, redirect_stdout(stdout):
                mod.main()

            spy_build_paths.assert_not_called()
            spy_acquire_lock.assert_not_called()
            report = json.loads(stdout.getvalue())
            self.assertTrue(report["ok"])


if __name__ == "__main__":
    unittest.main()
