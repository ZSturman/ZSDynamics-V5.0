"""Portfolio imports public releases while private working folders stay unreachable."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "lib"))

from sync_articles import _discover_article_sources


def article(root, path, title):
    folder = root / path
    folder.mkdir(parents=True)
    (folder / "index.md").write_text("---\ntitle: " + title + "\npublishedAt: 2026-10-12\nsummary: S\n---\nBody")
    return folder


def test_published_layout_preserves_slugs_and_excludes_private_content(tmp_path):
    article(tmp_path, "drafts/private", "Private draft")
    article(tmp_path, "archive/old", "Archived")
    public = article(tmp_path, "published/public-story", "Public story")
    found = _discover_article_sources(tmp_path)
    assert len(found) == 1 and found[0]["slug"] == "public-story"
    assert found[0]["index_path"] == public / "index.md"


def test_published_snapshot_has_priority_over_legacy_copy(tmp_path):
    article(tmp_path, "same-slug", "Legacy")
    public = article(tmp_path, "published/same-slug", "Release")
    found = _discover_article_sources(tmp_path)
    assert len(found) == 1 and found[0]["index_path"] == public / "index.md"
