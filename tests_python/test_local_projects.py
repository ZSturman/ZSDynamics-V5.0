import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from local_projects import merge_local_projects


def test_local_entry_survives_clean_rebuild_and_deduplicates(tmp_path):
    content = tmp_path / "content" / "example"
    (content / "images").mkdir(parents=True)
    (content / "project.json").write_text(json.dumps({
        "id": "local-id", "slug": "example", "folderName": "example_local-id",
        "title": "Locally maintained title",
    }))
    (content / "README.md").write_text("# Example\nPublic setup instructions.")
    (content / "images" / "screen.png").write_bytes(b"fixture")
    (content / "models").mkdir()
    (content / "models" / "display.glb").write_bytes(b"display fixture")
    generated = [{"id": "remote-id", "slug": "other"},
                 {"id": "notion-id", "slug": "example", "title": "Exported title"}]
    destination = tmp_path / "public"
    merged = merge_local_projects(generated, destination, tmp_path / "content")
    assert len(merged) == 2
    assert merged[0] == generated[0]
    assert len(generated) == 2  # No mutation of the caller's records.
    assert merged[1]["readme"]["content"].startswith("# Example")
    assert (destination / "example_local-id/images/screen.png").read_bytes() == b"fixture"
    assert (destination / "example_local-id/models/display.glb").read_bytes() == b"display fixture"
    assert merge_local_projects(merged, destination, tmp_path / "content") == merged


def test_rejects_folder_outside_project_destination(tmp_path):
    import pytest
    source = tmp_path / "content" / "invalid"
    source.mkdir(parents=True)
    (source / "project.json").write_text('{"folderName":"../outside"}')
    with pytest.raises(ValueError):
        merge_local_projects([], tmp_path / "public", tmp_path / "content")
    assert not (tmp_path / "outside").exists()


def test_reviewed_updates_preserve_imported_history_and_are_idempotent(tmp_path):
    content = tmp_path / "content" / "projects"
    content.mkdir(parents=True)
    (content.parent / "project-updates.json").write_text(json.dumps({
        "example": {"summary": "Mobile and web", "resources": [{"url": "/demo"}],
                    "workLogs": [{"id": "release", "title": "Published"}]},
    }))
    original = [{"id": "p", "slug": "example", "summary": "Old", "images": {"hero": "new.png"},
                 "workLogs": [{"id": "imported"}, {"id": "release", "title": "Old duplicate"}]}]
    result = merge_local_projects(original, tmp_path / "public", content)
    assert result[0]["images"] == {"hero": "new.png"}
    assert result[0]["summary"] == "Mobile and web"
    assert [log["id"] for log in result[0]["workLogs"]] == ["release", "imported"]
    assert original[0]["summary"] == "Old"
    assert merge_local_projects(result, tmp_path / "public", content) == result


def test_presentation_overrides_keep_notion_history_and_unrelated_projects(tmp_path):
    content = tmp_path / "content"
    (content / "projects").mkdir(parents=True)
    (content / "project-updates.json").write_text(json.dumps({"device": {
        "featured": True, "featuredOrder": 6, "disciplines": ["hardware"],
        "caseStudy": {"problem": "Reviewed text.", "validation": ["Compiles."]},
    }}))
    imported_logs = [{"id": "log-1", "title": "Imported session"}]
    generated = [{"id": "n1", "slug": "device", "featured": False, "workLogs": imported_logs},
                 {"id": "n2", "slug": "untouched", "workLogs": [{"id": "log-2"}]}]
    merged = merge_local_projects(generated, tmp_path / "public", content / "projects")
    device = next(p for p in merged if p["slug"] == "device")
    assert device["featured"] is True and device["featuredOrder"] == 6
    assert device["caseStudy"]["validation"] == ["Compiles."]
    assert device["workLogs"] == imported_logs  # automated history is never replaced
    assert next(p for p in merged if p["slug"] == "untouched") == generated[1]
    assert len(merged) == 2
