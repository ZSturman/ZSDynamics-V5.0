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
