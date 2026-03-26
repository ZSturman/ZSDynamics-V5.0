import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str((Path(__file__).resolve().parent.parent / "lib")))

from sync_articles import ArticleSyncError, build_articles_from_directory  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
