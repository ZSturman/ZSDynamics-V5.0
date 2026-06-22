import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str((Path(__file__).resolve().parent.parent / "lib")))

from sync_articles import ArticleSyncError, build_articles_from_directory  # noqa: E402


class FakeUrlopenResponse:
    def __init__(self, body: bytes, *, url: str, content_type: str = "text/html; charset=utf-8") -> None:
        self._body = body
        self.url = url
        self.headers = {"Content-Type": content_type}

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "FakeUrlopenResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None


class TestSyncArticles(unittest.TestCase):
    def test_missing_articles_directory_yields_empty_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
            )

            self.assertEqual(manifest, [])
            self.assertEqual(
                json.loads((output_root / "articles.json").read_text(encoding="utf-8")),
                [],
            )

    def test_build_articles_manifest_and_rewrite_relative_assets(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            first_dir = repo_root / "articles" / "first-article"
            second_dir = repo_root / "articles" / "second-article"
            first_dir.mkdir(parents=True)
            second_dir.mkdir(parents=True)

            (first_dir / "diagram.png").write_bytes(b"diagram")
            (first_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: First Article",
                        "summary: A summary for the first article.",
                        "publishedAt: 2026-03-10",
                        "updatedAt: 2026-03-11",
                        "tags:",
                        "  - ai",
                        "  - portfolio",
                        "projectIds: [proj-a, proj-b]",
                        "---",
                        "",
                        "# First Article",
                        "",
                        "![Diagram](./diagram.png)",
                        "",
                        "[Second Article](../second-article/index.md)",
                    ]
                ),
                encoding="utf-8",
            )
            (second_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Second Article",
                        "summary: Another summary.",
                        "updatedAt: 2026-03-09",
                        "---",
                        "",
                        "Body copy.",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
            )

            self.assertEqual(len(manifest), 2)
            first = next(article for article in manifest if article["slug"] == "first-article")
            self.assertEqual(first["title"], "First Article")
            self.assertEqual(first["href"], "/articles/first-article")
            self.assertEqual(first["sourceUrl"], "https://github.com/ZSturman/Articles/blob/main/articles/first-article/index.md")
            self.assertEqual(first["tags"], ["ai", "portfolio"])
            self.assertEqual(first["projectIds"], ["proj-a", "proj-b"])

            rewritten_markdown = (output_root / "first-article" / "index.md").read_text(encoding="utf-8")
            self.assertIn("![Diagram](/articles/first-article/diagram.png)", rewritten_markdown)
            self.assertIn("[Second Article](/articles/second-article)", rewritten_markdown)
            self.assertTrue((output_root / "first-article" / "diagram.png").exists())

            manifest_path = output_root / "articles.json"
            stored_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(len(stored_manifest), 2)

    def test_build_articles_supports_mixed_repo_layouts_and_flat_markdown_assets(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            nested_dir = repo_root / "designing-a-sync-engine"
            nested_dir.mkdir(parents=True)
            (nested_dir / "diagram.png").write_bytes(b"diagram")
            (nested_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Designing a Sync Engine",
                        "summary: Directory article.",
                        "publishedAt: 2026-03-16",
                        "updatedAt: 2026-03-16",
                        "---",
                        "",
                        "![Diagram](./diagram.png)",
                    ]
                ),
                encoding="utf-8",
            )

            articles_dir = repo_root / "articles"
            articles_dir.mkdir(parents=True)
            (articles_dir / "Loose Image.png").write_bytes(b"loose-image")
            (articles_dir / "Standalone Article.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Standalone Article",
                        "summary: Flat article.",
                        "publishedAt: 2026-03-15",
                        "updatedAt: 2026-03-15",
                        "---",
                        "",
                        "![Loose](./Loose%20Image.png)",
                        "",
                        "[Nested](../designing-a-sync-engine/index.md)",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
            )

            manifest_by_slug = {article["slug"]: article for article in manifest}
            self.assertEqual(set(manifest_by_slug), {"designing-a-sync-engine", "standalone-article"})

            nested_markdown = (output_root / "designing-a-sync-engine" / "index.md").read_text(encoding="utf-8")
            self.assertIn("![Diagram](/articles/designing-a-sync-engine/diagram.png)", nested_markdown)
            self.assertTrue((output_root / "designing-a-sync-engine" / "diagram.png").exists())

            flat_markdown = (output_root / "standalone-article" / "index.md").read_text(encoding="utf-8")
            self.assertIn("![Loose](/articles/standalone-article/Loose%20Image.png)", flat_markdown)
            self.assertIn("[Nested](/articles/designing-a-sync-engine)", flat_markdown)
            self.assertTrue((output_root / "standalone-article" / "Loose Image.png").exists())

    def test_cover_image_frontmatter_is_preserved_and_copied(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            article_dir = repo_root / "articles" / "cover-article"
            article_dir.mkdir(parents=True)
            (article_dir / "cover.png").write_bytes(b"cover-image")
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Cover Article",
                        "summary: Article with explicit cover image.",
                        "updatedAt: 2026-03-25",
                        "coverImage: ./cover.png",
                        "---",
                        "",
                        "Body copy without an inline hero image.",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
            )

            self.assertEqual(len(manifest), 1)
            self.assertEqual(manifest[0]["coverImage"], "/articles/cover-article/cover.png")
            self.assertTrue((output_root / "cover-article" / "cover.png").exists())

            stored_manifest = json.loads((output_root / "articles.json").read_text(encoding="utf-8"))
            self.assertEqual(stored_manifest[0]["coverImage"], "/articles/cover-article/cover.png")

    def test_optional_series_frontmatter_is_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            article_dir = repo_root / "articles" / "series-article"
            article_dir.mkdir(parents=True)
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Series Article",
                        "summary: Article that belongs to a sequence.",
                        "updatedAt: 2026-03-26",
                        "series: Folio Evolution",
                        "---",
                        "",
                        "Body copy.",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
            )

            self.assertEqual(len(manifest), 1)
            self.assertEqual(manifest[0]["series"], "Folio Evolution")

    def test_projects_frontmatter_links_to_existing_project_ids(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            projects_manifest_path = repo_root / "projects.json"
            projects_manifest_path.write_text(
                json.dumps(
                    [
                        {
                            "id": "304aec94-4d3c-8029-a1b1-ea0f92487137",
                            "slug": "my-notion-pipeline",
                            "href": "/projects/my-notion-pipeline",
                            "title": "My Notion Pipeline",
                        }
                    ]
                ),
                encoding="utf-8",
            )

            article_dir = repo_root / "articles" / "linked-article"
            article_dir.mkdir(parents=True)
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Linked Article",
                        "summary: Article with project links.",
                        "updatedAt: 2026-04-01",
                        "projects:",
                        '  - "My Notion Pipeline (https://www.notion.so/My-Notion-Pipeline-304aec944d3c8029a1b1ea0f92487137?pvs=21)"',
                        "  - /projects/my-notion-pipeline",
                        "---",
                        "",
                        "Body copy.",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
                projects_manifest_path=projects_manifest_path,
            )

            self.assertEqual(len(manifest), 1)
            self.assertEqual(manifest[0]["projectIds"], ["304aec94-4d3c-8029-a1b1-ea0f92487137"])

    def test_series_fallback_links_article_to_matching_project(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            projects_manifest_path = repo_root / "projects.json"
            projects_manifest_path.write_text(
                json.dumps(
                    [
                        {
                            "id": "346aec94-4d3c-801e-851f-c7e727f0e186",
                            "slug": "the-wolf-project",
                            "href": "/projects/the-wolf-project",
                            "title": "The Wolf Project",
                        }
                    ]
                ),
                encoding="utf-8",
            )

            article_dir = repo_root / "articles" / "wolf-article"
            article_dir.mkdir(parents=True)
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: The Wolf Project - Reworking a Real-World Project",
                        "summary: Article linked by series.",
                        "updatedAt: 2026-04-18",
                        "series: The Wolf Project",
                        "---",
                        "",
                        "Body copy.",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
                projects_manifest_path=projects_manifest_path,
            )

            self.assertEqual(len(manifest), 1)
            self.assertEqual(manifest[0]["projectIds"], ["346aec94-4d3c-801e-851f-c7e727f0e186"])

    def test_standalone_external_links_generate_previews_but_inline_links_do_not(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            article_dir = repo_root / "articles" / "preview-article"
            article_dir.mkdir(parents=True)
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Preview Article",
                        "summary: Article with standalone previews.",
                        "updatedAt: 2026-04-19",
                        "---",
                        "",
                        "Inline link [https://example.com/docs](https://example.com/docs) should stay plain.",
                        "",
                        "[https://www.youtube.com/watch?v=NMf8mlxO4sk](https://www.youtube.com/watch?v=NMf8mlxO4sk)",
                        "",
                        "[https://www.instagram.com/_wolf_project/](https://www.instagram.com/_wolf_project/)",
                    ]
                ),
                encoding="utf-8",
            )

            def fake_urlopen(request, timeout=15):  # type: ignore[no-untyped-def]
                url = request.full_url if hasattr(request, "full_url") else str(request)
                if "youtube.com/watch" in url:
                    return FakeUrlopenResponse(
                        (
                            "<html><head><title>Husky With Zero Chance Of Survival</title>"
                            "<meta property='og:description' content='The Dodo story'>"
                            "<meta property='og:site_name' content='YouTube'></head></html>"
                        ).encode("utf-8"),
                        url=url,
                    )
                if "instagram.com/_wolf_project" in url:
                    return FakeUrlopenResponse(
                        (
                            "<html><head><meta property='og:title' content='The Wolf Project'>"
                            "<meta property='og:description' content='8,849 followers'>"
                            "<meta property='og:site_name' content='Instagram'>"
                            "<meta property='og:image' content='https://cdn.example.com/wolf.jpg'></head></html>"
                        ).encode("utf-8"),
                        url=url,
                    )
                raise AssertionError(f"Unexpected preview fetch: {url}")

            with patch("sync_articles.urlopen", side_effect=fake_urlopen):
                manifest = build_articles_from_directory(
                    source_repo_root=repo_root,
                    output_dir=output_root,
                    repo="ZSturman/Articles",
                    ref="main",
                )

            self.assertEqual(len(manifest), 1)
            link_previews = manifest[0]["linkPreviews"]
            self.assertEqual([preview["url"] for preview in link_previews], [
                "https://www.youtube.com/watch?v=NMf8mlxO4sk",
                "https://www.instagram.com/_wolf_project/",
            ])
            self.assertEqual(link_previews[0]["kind"], "youtube")
            self.assertEqual(link_previews[1]["kind"], "card")
            self.assertEqual(link_previews[1]["siteName"], "Instagram")
            self.assertNotIn("https://example.com/docs", {preview["url"] for preview in link_previews})

    def test_missing_series_is_recorded_as_none(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            article_dir = repo_root / "articles" / "standalone-article"
            article_dir.mkdir(parents=True)
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Standalone Article",
                        "summary: Article without a series.",
                        "updatedAt: 2026-03-26",
                        "---",
                        "",
                        "Body copy.",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
            )

            self.assertEqual(len(manifest), 1)
            self.assertIsNone(manifest[0]["series"])

    def test_missing_required_frontmatter_field_raises(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            article_dir = repo_root / "articles" / "broken-article"
            article_dir.mkdir(parents=True)
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Broken Article",
                        "publishedAt: 2026-03-10",
                        "---",
                        "",
                        "This article is missing its summary.",
                    ]
                ),
                encoding="utf-8",
            )

            with self.assertRaises(ArticleSyncError):
                build_articles_from_directory(
                    source_repo_root=repo_root,
                    output_dir=output_root,
                    repo="ZSturman/Articles",
                    ref="main",
                )

    def test_missing_published_at_does_not_raise(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            article_dir = repo_root / "articles" / "scheduled-article"
            article_dir.mkdir(parents=True)
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Scheduled Article",
                        "summary: Not yet published.",
                        "updatedAt: 2026-03-20",
                        "---",
                        "",
                        "Draft content.",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
            )

            self.assertEqual(len(manifest), 1)
            self.assertIsNone(manifest[0]["publishedAt"])
            self.assertEqual(manifest[0]["updatedAt"], "2026-03-20")

    def test_snake_case_cover_image_is_resolved(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            article_dir = repo_root / "articles" / "snake-cover"
            article_dir.mkdir(parents=True)
            (article_dir / "cover.png").write_bytes(b"cover-image")
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Snake Cover Article",
                        "summary: Article with snake_case cover_image key.",
                        "updatedAt: 2026-04-10",
                        "cover_image: ./cover.png",
                        "---",
                        "",
                        "Body copy.",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
            )

            self.assertEqual(len(manifest), 1)
            self.assertEqual(manifest[0]["coverImage"], "/articles/snake-cover/cover.png")
            self.assertTrue((output_root / "snake-cover" / "cover.png").exists())

    def test_one_liner_frontmatter_is_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            article_dir = repo_root / "articles" / "liner-article"
            article_dir.mkdir(parents=True)
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: Liner Article",
                        "summary: A longer summary for the article.",
                        "updatedAt: 2026-04-12",
                        "one_liner: A short catchy description.",
                        "---",
                        "",
                        "Body copy.",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
            )

            self.assertEqual(len(manifest), 1)
            self.assertEqual(manifest[0]["oneLiner"], "A short catchy description.")

    def test_missing_one_liner_is_recorded_as_none(self) -> None:
        with tempfile.TemporaryDirectory() as repo_root_str, tempfile.TemporaryDirectory() as output_root_str:
            repo_root = Path(repo_root_str)
            output_root = Path(output_root_str)

            article_dir = repo_root / "articles" / "no-liner"
            article_dir.mkdir(parents=True)
            (article_dir / "index.md").write_text(
                "\n".join(
                    [
                        "---",
                        "title: No Liner Article",
                        "summary: Just a summary.",
                        "updatedAt: 2026-04-12",
                        "---",
                        "",
                        "Body copy.",
                    ]
                ),
                encoding="utf-8",
            )

            manifest = build_articles_from_directory(
                source_repo_root=repo_root,
                output_dir=output_root,
                repo="ZSturman/Articles",
                ref="main",
            )

            self.assertEqual(len(manifest), 1)
            self.assertIsNone(manifest[0]["oneLiner"])


if __name__ == "__main__":
    unittest.main()
