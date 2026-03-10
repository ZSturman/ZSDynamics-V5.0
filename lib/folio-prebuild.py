#!/usr/bin/env python3
"""Build public/projects from n8n-exported new_projects.json.

This entrypoint preserves lockfile + atomic replace behavior while delegating
JSON parsing/normalization/copy behavior to `projects_pipeline.py`.
"""

from __future__ import annotations

import argparse
import errno
import json
import logging
import os
import shutil
import tempfile
import time
from datetime import datetime
from pathlib import Path

from projects_pipeline import build_projects_from_json

DEFAULT_INPUT_JSON = Path("/Users/zacharysturman/n8n-files/exports/new_projects.json")


# Logging setup
log_dir = Path(__file__).parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"folio-prebuild_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)


class BuildPaths:
    def __init__(self) -> None:
        self.public_root = Path(__file__).parent.parent / "public"
        self.public_root.mkdir(parents=True, exist_ok=True)
        self.target_public_projects = self.public_root / "projects"
        self.lockfile = self.public_root / "projects_build.lock"
        self.legacy_log_file = self.public_root / "pre-build.log"


def append_log(log_file_path: Path, line: str) -> None:
    try:
        with open(str(log_file_path), "a", encoding="utf-8") as fh:
            fh.write(f"{int(time.time())}: {line}\n")
    except Exception:
        pass


def acquire_lock(lockfile: Path) -> int:
    try:
        lock_fd = os.open(str(lockfile), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(lock_fd, f"pid={os.getpid()} time={int(time.time())}\n".encode("utf-8"))
        return lock_fd
    except OSError as exc:
        if exc.errno == errno.EEXIST:
            raise SystemExit(
                f"Another pre-build appears to be running (lockfile exists at {lockfile}). Exiting to avoid race conditions."
            )
        raise


def release_lock(lockfile: Path, lock_fd: int | None) -> None:
    try:
        if lock_fd is not None:
            os.close(lock_fd)
        if lockfile.exists():
            lockfile.unlink()
    except Exception:
        pass


def repair_projects_dir(public_root: Path) -> None:
    """Restore canonical public/projects from projects N siblings when missing."""
    canonical = public_root / "projects"
    if canonical.exists():
        print(f"Canonical folder exists at {canonical}; nothing to repair.")
        return

    candidates = []
    for p in public_root.iterdir():
        if not p.is_dir():
            continue
        name = p.name
        if name == "projects" or (name.startswith("projects ") and name[len("projects ") :].strip().isdigit()):
            candidates.append(p)

    if not candidates:
        print("No 'projects' or 'projects N' folders found to repair.")
        return

    chosen = max(candidates, key=lambda p: p.stat().st_mtime)
    chosen.rename(canonical)
    print(f"Renamed {chosen} -> {canonical}")

    for p in candidates:
        if p != chosen and p.exists():
            try:
                shutil.rmtree(p)
                print(f"Removed old sibling folder {p}")
            except Exception:
                print(f"Warning: failed to remove old sibling folder {p}")


def delete_old_backups(public_root: Path, legacy_log_file: Path) -> None:
    try:
        for p in public_root.iterdir():
            if not p.is_dir():
                continue
            name = p.name
            if name.startswith("projects_backup") or name.startswith("projects_backup_before_repair_"):
                if name == "projects":
                    continue
                try:
                    shutil.rmtree(p)
                    append_log(legacy_log_file, f"CLEANUP: removed old backup {p}")
                    print(f"Removed old backup {p}")
                except Exception as exc:
                    append_log(legacy_log_file, f"WARNING: failed to remove old backup {p}: {exc}")
                    print(f"Warning: failed to remove old backup {p}: {exc}")
    except Exception:
        pass


def remove_projects_siblings(public_root: Path, legacy_log_file: Path) -> None:
    try:
        for p in public_root.iterdir():
            if not p.is_dir():
                continue
            if p.name == "projects":
                continue
            if p.name.startswith("projects"):
                try:
                    shutil.rmtree(p)
                    append_log(legacy_log_file, f"CLEANUP: removed stray projects sibling {p}")
                    print(f"Removed stray projects sibling {p}")
                except Exception as exc:
                    append_log(legacy_log_file, f"WARNING: failed to remove stray projects sibling {p}: {exc}")
                    print(f"Warning: failed to remove stray projects sibling {p}: {exc}")
    except Exception:
        pass


def verify_and_repair_post_build(public_root: Path) -> bool:
    canonical = public_root / "projects"
    if canonical.exists():
        return True

    candidates = []
    for p in public_root.iterdir():
        if p.is_dir() and p.name.startswith("projects") and p.name != "projects":
            candidates.append(p)

    if not candidates:
        print("⚠️  WARNING: No 'projects' folder found after build!")
        return False

    chosen = max(candidates, key=lambda p: p.stat().st_mtime)
    try:
        print(f"⚠️  Detected cloud sync renamed folder: {chosen.name} → projects")
        chosen.rename(canonical)
        print("✓ Repaired: restored canonical 'projects' folder")
        for p in candidates:
            if p != chosen and p.exists():
                try:
                    shutil.rmtree(p)
                    print(f"✓ Removed duplicate: {p.name}")
                except Exception:
                    pass
        return True
    except Exception as exc:
        print(f"⚠️  Failed to repair projects folder: {exc}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Build projects JSON/assets from new_projects.json")
    parser.add_argument("legacy_root", nargs="?", default=None, help="Deprecated legacy folio root (ignored).")
    parser.add_argument("--input-json", default=str(DEFAULT_INPUT_JSON), help="Path to new_projects.json")
    parser.add_argument("--root-path", default=None, help="Override config.root_path from input JSON")
    parser.add_argument(
        "--repair",
        action="store_true",
        help="Attempt to repair stray 'projects 2'/'projects 3' folders and exit.",
    )
    args = parser.parse_args()

    if args.legacy_root:
        logger.warning("Legacy positional root argument is deprecated and ignored: %s", args.legacy_root)
        print(f"⚠️  Ignoring deprecated legacy root argument: {args.legacy_root}")

    input_json = Path(args.input_json)
    if not input_json.exists() or not input_json.is_file():
        raise SystemExit(f"Input JSON not found: {input_json}")

    root_override = Path(args.root_path) if args.root_path else None

    paths = BuildPaths()

    if args.repair:
        repair_projects_dir(paths.public_root)
        return

    try:
        if not paths.target_public_projects.exists():
            repair_projects_dir(paths.public_root)
    except Exception:
        pass

    lock_fd: int | None = None
    backup_path: Path | None = None
    temp_public_projects_root: Path | None = None

    try:
        lock_fd = acquire_lock(paths.lockfile)

        if paths.target_public_projects.exists():
            try:
                shutil.rmtree(paths.target_public_projects)
                print(f"Removed existing {paths.target_public_projects} before building new projects")
            except Exception as remove_exc:
                backup_path = paths.public_root / f"projects_backup_{int(time.time())}_{os.getpid()}"
                try:
                    paths.target_public_projects.rename(backup_path)
                    print(f"Renamed existing {paths.target_public_projects} -> {backup_path} before build")
                except Exception as rename_exc:
                    raise SystemExit(
                        f"Failed to prepare existing projects folder for rebuild: remove_error={remove_exc} rename_error={rename_exc}"
                    )

        temp_public_projects_root = Path(tempfile.mkdtemp(prefix="projects_tmp_", dir=str(paths.public_root)))

        result = build_projects_from_json(
            input_json_path=input_json,
            temp_public_projects_root=temp_public_projects_root,
            root_path_override=root_override,
        )

        output_path = temp_public_projects_root / "projects.json"
        projects = result["projects"]
        output_path.write_text(json.dumps(projects, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"📄 Wrote {len(projects)} projects to projects.json")
        logger.info("Wrote %s projects to %s", len(projects), output_path)

        hostnames_config_path = paths.public_root / "image-hostnames.json"
        hostnames = result.get("external_hostnames", [])
        hostnames_config_path.write_text(
            json.dumps({"hostnames": sorted(hostnames)}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        try:
            if paths.target_public_projects.exists():
                shutil.rmtree(paths.target_public_projects)
        except Exception as remove_exc:
            backup_path = paths.public_root / f"projects_backup_{int(time.time())}"
            try:
                paths.target_public_projects.rename(backup_path)
                logger.info("Renamed existing %s to backup %s", paths.target_public_projects, backup_path)
            except Exception as rename_exc:
                raise RuntimeError(
                    f"Failed to remove or rename existing projects dir: remove_error={remove_exc}, rename_error={rename_exc}"
                ) from rename_exc

        try:
            temp_public_projects_root.rename(paths.target_public_projects)
        except Exception:
            os.replace(str(temp_public_projects_root), str(paths.target_public_projects))

        print(f"✅ Build complete - {len(projects)} projects published")
        append_log(paths.legacy_log_file, f"SUCCESS: replaced projects with new build; wrote {len(projects)} projects")

        if backup_path and backup_path.exists():
            try:
                shutil.rmtree(backup_path)
                logger.info("Removed backup at %s", backup_path)
            except Exception:
                append_log(paths.legacy_log_file, f"WARNING: failed to remove backup at {backup_path}; left in place")

        delete_old_backups(paths.public_root, paths.legacy_log_file)

        for _ in range(3):
            time.sleep(0.5)
            remove_projects_siblings(paths.public_root, paths.legacy_log_file)

        time.sleep(2)
        if not verify_and_repair_post_build(paths.public_root):
            append_log(paths.legacy_log_file, "WARNING: projects folder verification failed")

        for warning in result.get("warnings", []):
            logger.warning(warning)

        missing_thumbs = result.get("missing_thumbnail_projects", [])
        missing_summaries = result.get("missing_summary_projects", [])

        if missing_thumbs:
            print("\n⚠️  Projects missing thumbnails:")
            for project_id in missing_thumbs:
                print(f" - {project_id}")

        if missing_summaries:
            print("\n⚠️  Projects missing summaries:")
            for project_id in missing_summaries:
                print(f" - {project_id}")

    except Exception as exc:
        append_log(paths.legacy_log_file, f"ERROR: build failed: {exc}")
        logger.exception("Build failed: %s", exc)
        print(f"❌ Build failed: {exc}")

        try:
            if backup_path and backup_path.exists() and not paths.target_public_projects.exists():
                backup_path.rename(paths.target_public_projects)
                append_log(paths.legacy_log_file, f"RESTORE: restored original projects folder from {backup_path}")
        except Exception as restore_exc:
            logger.error("Failed to restore backup after error: %s", restore_exc)

        try:
            if temp_public_projects_root and temp_public_projects_root.exists():
                shutil.rmtree(temp_public_projects_root)
        except Exception:
            pass

        raise
    finally:
        release_lock(paths.lockfile, lock_fd)

    print(f"\n📋 Full build log: {log_file}")


if __name__ == "__main__":
    print("🚀 Running folio pre-build script")
    logger.info("Starting folio pre-build script")
    main()
