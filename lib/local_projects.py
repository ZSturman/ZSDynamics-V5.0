"""Keep explicitly authored portfolio entries through cached and Notion builds."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def merge_local_projects(projects: list[dict], destination: Path,
                         content_root: Path = ROOT / "content" / "projects") -> list[dict]:
    merged = list(projects)
    for source in sorted(content_root.glob("*/project.json")):
        project = json.loads(source.read_text(encoding="utf-8"))
        folder = project["folderName"]
        if not folder or Path(folder).name != folder or folder in (".", ".."):
            raise ValueError(f"Invalid local project folder: {folder}")
        readme = source.parent / "README.md"
        project["readme"] = {
            "content": readme.read_text(encoding="utf-8"),
            "sourceUrl": f"/projects/{folder}/README.md",
        }
        target = destination / folder
        target.mkdir(parents=True, exist_ok=True)
        shutil.copy2(readme, target / "README.md")
        if (source.parent / "images").is_dir():
            shutil.copytree(source.parent / "images", target / "images", dirs_exist_ok=True)
        # Display GLBs accompany locally curated collections. Keep editable
        # Blender sources and printable release files outside public media.
        models = source.parent / "models"
        if models.is_dir():
            shutil.copytree(models, target / "models", dirs_exist_ok=True)
        # Same identity from a later Notion export must not create a second card.
        merged = [p for p in merged if p.get("id") != project["id"]
                  and p.get("slug") != project["slug"]]
        merged.append(project)
    # Small reviewed updates can augment Notion-owned projects without copying
    # their entire record (and freezing later imported media or work history).
    updates_path = content_root.parent / "project-updates.json"
    updates = json.loads(updates_path.read_text()) if updates_path.exists() else {}
    for index, project in enumerate(merged):
        update = updates.get(project.get("slug"))
        if not update:
            continue
        additions = update.get("workLogs", [])
        log_ids = {log["id"] for log in additions}
        merged[index] = {
            **project,
            **{key: value for key, value in update.items() if key != "workLogs"},
            "workLogs": additions + [log for log in project.get("workLogs", [])
                                     if log.get("id") not in log_ids],
        }
    return merged


def main() -> None:
    from build_postprocess import _envelope, _slim_project

    public = ROOT / "public"
    manifest = public / "projects" / "projects.json"
    projects = merge_local_projects(json.loads(manifest.read_text()), manifest.parent)
    manifest.write_text(json.dumps(projects, ensure_ascii=False, indent=2) + "\n")
    # Refresh only project endpoints; preserve current articles and hosted media.
    api = public / "api"
    api.mkdir(exist_ok=True)
    hosted_path = public / "media-urls.json"
    hosted = json.loads(hosted_path.read_text()).get("urls", {}) if hosted_path.exists() else {}
    (api / "projects.json").write_text(json.dumps(
        _envelope([_slim_project(p, hosted) for p in projects], "projects.list", len(projects)),
        ensure_ascii=False, indent=2) + "\n")
    site_path = api / "site.json"
    if site_path.exists():
        site = json.loads(site_path.read_text())
        site["data"]["counts"]["projects"] = len(projects)
        site_path.write_text(json.dumps(site, ensure_ascii=False, indent=2) + "\n")
    for project in projects:
        slug = project["slug"]
        endpoint = api / "projects" / f"{slug}.json"
        endpoint.parent.mkdir(exist_ok=True)
        if endpoint.exists() and json.loads(endpoint.read_text()).get("data") == project:
            continue
        endpoint.write_text(json.dumps(_envelope(project, "projects.detail"),
                                       ensure_ascii=False, indent=2) + "\n")
    print(f"Local portfolio entries merged; {len(projects)} projects available.")


if __name__ == "__main__":
    main()
