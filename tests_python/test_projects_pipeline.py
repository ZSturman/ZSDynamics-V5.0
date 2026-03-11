import json
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import quote

# Allow `from projects_pipeline import ...`
sys.path.insert(0, str((Path(__file__).resolve().parent.parent / "lib")))

from projects_pipeline import (  # noqa: E402
    build_projects_from_json,
    determine_collection_item_type,
    make_project_folder_name,
)


class TestProjectsPipeline(unittest.TestCase):
    def test_determine_collection_item_type(self) -> None:
        cases = [
            ("File", "clip.mov", "video"),
            ("3d", "model.obj", "3d-model"),
            ("URL", "https://example.com", "url-link"),
            ("folio", None, "folio"),
            ("png", None, "image"),
            (None, "file:///tmp/audio.mp3", "audio"),
            (None, "unknown.bin", "image"),
        ]
        for raw_type, path_val, expected in cases:
            with self.subTest(raw_type=raw_type, path_val=path_val):
                self.assertEqual(determine_collection_item_type(raw_type, path_val), expected)

    def test_build_pipeline_schema_copy_rewrite_and_determinism(self) -> None:
        with tempfile.TemporaryDirectory() as temp_root_str, tempfile.TemporaryDirectory() as out1_str, tempfile.TemporaryDirectory() as out2_str:
            temp_root = Path(temp_root_str)
            out1 = Path(out1_str)
            out2 = Path(out2_str)

            assets_dir = temp_root / "Technology" / "Top Note" / "FolioAssets"
            assets_dir.mkdir(parents=True)

            image_file = assets_dir / "file.png"
            thumb_file = assets_dir / "thumbnail.png"
            download_file = assets_dir / "Spec Sheet.pdf"
            video_file = assets_dir / "video clip.mp4"

            image_file.write_bytes(b"png")
            thumb_file.write_bytes(b"thumb")
            download_file.write_text("download", encoding="utf-8")
            video_file.write_bytes(b"video")

            video_uri = f"file://{quote(str(video_file))}"

            input_payload = {
                "config": {"root_path": str(temp_root)},
                "projects": [
                    {
                        "id": "proj-a",
                        "projectPageId": "proj-a-page",
                        "title": "Top Note",
                        "summary": "Project summary",
                        "domain": None,
                        "featured": True,
                        "featuredOrder": 3,
                        "category": ["application"],
                        "status": "Complete",
                        "phase": "Regular updates",
                        "startedAt": "2026-02-13T10:00:00.000Z",
                        "lastUpdateAt": "2026-02-20T18:30:00.000Z",
                        "startDate": "2026-02-13",
                        "thumbnail": {
                            "relativePath": "Technology/Top Note/FolioAssets/thumbnail.png"
                        },
                        "tags": ["iOS", "Widgets"],
                        "resources": [
                            {
                                "label": "Github Repo",
                                "type": "repo",
                                "icon": "github",
                                "url": "github.com/ZSturman/TopNote",
                            },
                            {
                                "label": "Spec",
                                "type": "local-download",
                                "category": "download",
                                "url": "Technology/Top Note/FolioAssets/Spec Sheet.pdf",
                            },
                            {
                                "label": "Related Project",
                                "type": "folio",
                                "url": "proj-b-page",
                            },
                        ],
                        "collections": [
                            {
                                "name": "Assets",
                                "label": "Assets",
                                "summary": "Collection summary",
                                "items": [
                                    {
                                        "id": "item-1",
                                        "label": "Image",
                                        "type": "image",
                                        "relativePath": "Technology/Top Note/FolioAssets/file.png",
                                        "thumbnail": {
                                            "relativePath": "Technology/Top Note/FolioAssets/thumbnail.png"
                                        },
                                        "resources": [
                                            {
                                                "label": "Website",
                                                "type": "view",
                                                "url": "zachary-sturman.com",
                                            }
                                        ],
                                    },
                                    {
                                        "id": "item-2",
                                        "label": "Video",
                                        "type": "file",
                                        "filePath": video_uri,
                                        "order": 10,
                                    },
                                    {
                                        "id": "item-3",
                                        "label": "Internal",
                                        "type": "folio",
                                        "url": "proj-b-page",
                                    },
                                ],
                            }
                        ],
                    },
                    {
                        "id": "proj-b",
                        "projectPageId": "proj-b-page",
                        "title": "Second Project",
                        "summary": "Second summary",
                        "domain": "Technology",
                        "category": ["application"],
                        "status": "In Progress",
                        "phase": "Build",
                        "startedAt": "2025-01-01T00:00:00.000Z",
                        "startDate": "2025-01-01",
                        "collections": [],
                        "resources": [],
                    },
                ],
            }

            input_json = temp_root / "new_projects.json"
            input_json.write_text(json.dumps(input_payload), encoding="utf-8")

            result1 = build_projects_from_json(
                input_json_path=input_json,
                temp_public_projects_root=out1,
            )
            result2 = build_projects_from_json(
                input_json_path=input_json,
                temp_public_projects_root=out2,
            )

            self.assertEqual(len(result1["projects"]), 2)
            self.assertEqual(
                json.dumps(result1["projects"], sort_keys=True),
                json.dumps(result2["projects"], sort_keys=True),
            )

            proj_a = next(p for p in result1["projects"] if p["id"] == "proj-a")
            proj_b = next(p for p in result1["projects"] if p["id"] == "proj-b")

            # Schema + normalization
            required_keys = {
                "id",
                "title",
                "name",
                "summary",
                "domain",
                "category",
                "status",
                "phase",
                "featured",
                "createdAt",
                "updatedAt",
                "images",
                "resources",
                "collection",
                "folderName",
            }
            self.assertTrue(required_keys.issubset(set(proj_a.keys())))
            self.assertEqual(proj_a["title"], "Top Note")
            self.assertEqual(proj_a["name"], "Top Note")
            self.assertEqual(proj_a["domain"], "Unknown Domain")
            self.assertEqual(proj_a["folderName"], make_project_folder_name("Top Note", "proj-a"))
            self.assertEqual(proj_a["createdAt"], "2026-02-13T10:00:00.000Z")
            self.assertEqual(proj_a["updatedAt"], "2026-02-20T18:30:00.000Z")
            self.assertEqual(proj_b["createdAt"], "2025-01-01T00:00:00.000Z")
            self.assertIsNone(proj_b["updatedAt"])

            # Top-level image copied + rewritten to filename
            self.assertEqual(proj_a["images"]["thumbnail"], "thumbnail.png")
            self.assertTrue((out1 / proj_a["folderName"] / "thumbnail.png").exists())

            # Resource normalization
            resources = proj_a["resources"]
            github = next(r for r in resources if r["label"] == "Github Repo")
            self.assertEqual(github["type"], "github")
            self.assertEqual(github["url"], "https://github.com/ZSturman/TopNote")

            spec = next(r for r in resources if r["label"] == "Spec")
            self.assertEqual(spec["url"], f"/projects/{proj_a['folderName']}/Spec Sheet.pdf")
            self.assertTrue((out1 / proj_a["folderName"] / "Spec Sheet.pdf").exists())

            internal = next(r for r in resources if r["label"] == "Related Project")
            self.assertEqual(internal["type"], "local-link")
            self.assertEqual(internal["url"], "/projects/proj-b")

            # Collection structure + item defaults
            self.assertIn("Assets", proj_a["collection"])
            collection = proj_a["collection"]["Assets"]
            self.assertEqual(collection["label"], "Assets")
            self.assertIn("items", collection)
            self.assertEqual(len(collection["items"]), 3)

            item1 = next(i for i in collection["items"] if i["id"] == "item-1")
            self.assertEqual(item1["order"], 0)
            self.assertEqual(item1["type"], "image")
            self.assertEqual(item1["filePath"], "file.png")
            self.assertEqual(item1["thumbnail"], "thumbnail.png")
            self.assertEqual(item1["resource"]["url"], "https://zachary-sturman.com")

            item2 = next(i for i in collection["items"] if i["id"] == "item-2")
            self.assertEqual(item2["order"], 10)
            self.assertEqual(item2["type"], "video")
            self.assertEqual(item2["filePath"], "video clip.mp4")

            item3 = next(i for i in collection["items"] if i["id"] == "item-3")
            self.assertEqual(item3["type"], "url-link")
            self.assertEqual(item3["url"], "/projects/proj-b")

            # Paths are rewritten to public references, not local absolute paths
            result_json = json.dumps(result1["projects"])
            self.assertNotIn(str(temp_root), result_json)

            # Basic sanity for second project included
            self.assertEqual(proj_b["id"], "proj-b")

    def test_validation_fail_fast_for_duplicate_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temp_root_str, tempfile.TemporaryDirectory() as out_str:
            temp_root = Path(temp_root_str)
            out_dir = Path(out_str)

            payload = {
                "config": {"root_path": str(temp_root)},
                "projects": [
                    {"id": "dup", "title": "First"},
                    {"id": "dup", "title": "Second"},
                ],
            }

            input_json = temp_root / "new_projects.json"
            input_json.write_text(json.dumps(payload), encoding="utf-8")

            with self.assertRaises(ValueError):
                build_projects_from_json(
                    input_json_path=input_json,
                    temp_public_projects_root=out_dir,
                )

    def test_collection_item_project_link_inherits_target_thumbnail_and_resources(self) -> None:
        with tempfile.TemporaryDirectory() as temp_root_str, tempfile.TemporaryDirectory() as out_str:
            temp_root = Path(temp_root_str)
            out_dir = Path(out_str)

            parent_assets_dir = temp_root / "Technology" / "Parent" / "FolioAssets"
            target_assets_dir = temp_root / "Technology" / "Target" / "FolioAssets"
            parent_assets_dir.mkdir(parents=True)
            target_assets_dir.mkdir(parents=True)

            (parent_assets_dir / "parent-thumb.png").write_bytes(b"parent-thumb")
            (target_assets_dir / "target-thumb.png").write_bytes(b"target-thumb")
            (target_assets_dir / "Target Guide.pdf").write_text("guide", encoding="utf-8")

            input_payload = {
                "config": {"root_path": str(temp_root)},
                "projects": [
                    {
                        "id": "proj-parent",
                        "projectPageId": "proj-parent-page",
                        "title": "Parent Project",
                        "summary": "Parent summary",
                        "domain": "Technology",
                        "category": ["application"],
                        "status": "Complete",
                        "phase": "Build",
                        "startDate": "2026-02-14",
                        "thumbnail": {"relativePath": "Technology/Parent/FolioAssets/parent-thumb.png"},
                        "collections": [
                            {
                                "name": "Related Projects",
                                "items": [
                                    {
                                        "id": "item-target-project",
                                        "label": "Target Project",
                                        "type": "URL",
                                        "projectId": "proj-target-page",
                                    }
                                ],
                            }
                        ],
                        "resources": [],
                    },
                    {
                        "id": "proj-target",
                        "projectPageId": "proj-target-page",
                        "title": "Target Project",
                        "summary": "Target summary from project page",
                        "domain": "Technology",
                        "category": ["application"],
                        "status": "Complete",
                        "phase": "Ship",
                        "startDate": "2026-01-01",
                        "thumbnail": {"relativePath": "Technology/Target/FolioAssets/target-thumb.png"},
                        "resources": [
                            {
                                "label": "Target Site",
                                "type": "website",
                                "url": "https://example.com/target",
                            },
                            {
                                "label": "Target Guide",
                                "type": "local-download",
                                "category": "download",
                                "url": "Technology/Target/FolioAssets/Target Guide.pdf",
                            },
                        ],
                        "collections": [],
                    },
                ],
            }

            input_json = temp_root / "new_projects.json"
            input_json.write_text(json.dumps(input_payload), encoding="utf-8")

            result = build_projects_from_json(
                input_json_path=input_json,
                temp_public_projects_root=out_dir,
            )

            parent_project = next(p for p in result["projects"] if p["id"] == "proj-parent")
            target_project = next(p for p in result["projects"] if p["id"] == "proj-target")
            related_collection = parent_project["collection"]["Related Projects"]
            linked_item = related_collection["items"][0]

            self.assertEqual(linked_item["type"], "url-link")
            self.assertEqual(linked_item["url"], "/projects/proj-target")
            self.assertEqual(linked_item["thumbnail"], "target-thumb.png")
            self.assertEqual(linked_item["summary"], "Target summary from project page")

            inherited_labels = {resource["label"] for resource in linked_item["resources"]}
            self.assertIn("Target Site", inherited_labels)
            self.assertIn("Target Guide", inherited_labels)

            inherited_download = next(r for r in linked_item["resources"] if r["label"] == "Target Guide")
            self.assertEqual(
                inherited_download["url"],
                f"/projects/{target_project['folderName']}/Target Guide.pdf",
            )
            self.assertTrue((out_dir / target_project["folderName"] / "Target Guide.pdf").exists())
            self.assertTrue(
                (
                    out_dir
                    / parent_project["folderName"]
                    / "Related Projects"
                    / "item-target-project"
                    / "target-thumb.png"
                ).exists()
            )

    def test_fallback_builds_project_collections_from_relation_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temp_root_str, tempfile.TemporaryDirectory() as out_str:
            temp_root = Path(temp_root_str)
            out_dir = Path(out_str)

            assets_dir = temp_root / "Technology" / "Frontend" / "FolioAssets"
            assets_dir.mkdir(parents=True)
            (assets_dir / "frontend-thumb.png").write_bytes(b"frontend-thumb")
            (assets_dir / "proj-a-thumb.png").write_bytes(b"proj-a-thumb")
            (assets_dir / "proj-b-thumb.png").write_bytes(b"proj-b-thumb")

            collection_id = "collection-frontend"

            input_payload = {
                "config": {"root_path": str(temp_root)},
                "projects": [
                    {
                        "id": "proj-front",
                        "projectPageId": "proj-front-page",
                        "title": "Frontend Collection",
                        "oneLiner": "Frontend versions",
                        "summary": "Owner summary",
                        "domain": "Technology",
                        "category": ["web"],
                        "status": "Complete",
                        "phase": "Maintained",
                        "startDate": "2024-01-01",
                        "thumbnail": {"relativePath": "Technology/Frontend/FolioAssets/frontend-thumb.png"},
                        "collections": [],
                        "collectionIds": [collection_id],
                        "resources": [],
                        "raw": {
                            "property_collections": [collection_id],
                            "property_as_an_item_in_collection": [],
                        },
                    },
                    {
                        "id": "proj-a",
                        "projectPageId": "proj-a-page",
                        "title": "ZSDynamics 1.0",
                        "summary": "Project A summary",
                        "domain": "Technology",
                        "category": ["web"],
                        "status": "Complete",
                        "phase": "Archived",
                        "startDate": "2023-01-01",
                        "thumbnail": {"relativePath": "Technology/Frontend/FolioAssets/proj-a-thumb.png"},
                        "collections": [],
                        "resources": [{"label": "Project A Site", "type": "visit", "url": "https://example.com/a"}],
                        "raw": {
                            "property_collections": [],
                            "property_as_an_item_in_collection": [collection_id],
                        },
                    },
                    {
                        "id": "proj-b",
                        "projectPageId": "proj-b-page",
                        "title": "Towardbetter.me",
                        "summary": "Project B summary",
                        "domain": "Technology",
                        "category": ["web"],
                        "status": "Complete",
                        "phase": "Archived",
                        "startDate": "2023-02-01",
                        "thumbnail": {"relativePath": "Technology/Frontend/FolioAssets/proj-b-thumb.png"},
                        "collections": [],
                        "resources": [{"label": "Project B Site", "type": "visit", "url": "https://example.com/b"}],
                        "raw": {
                            "property_collections": [],
                            "property_as_an_item_in_collection": [collection_id],
                        },
                    },
                ],
            }

            input_json = temp_root / "new_projects.json"
            input_json.write_text(json.dumps(input_payload), encoding="utf-8")

            result = build_projects_from_json(
                input_json_path=input_json,
                temp_public_projects_root=out_dir,
            )

            owner_project = next(p for p in result["projects"] if p["id"] == "proj-front")
            self.assertIn("Frontend Collection", owner_project["collection"])

            collection = owner_project["collection"]["Frontend Collection"]
            self.assertEqual(collection["label"], "Frontend Collection")
            self.assertEqual(collection["summary"], "Frontend versions")

            items = collection["items"]
            self.assertEqual({item["id"] for item in items}, {"proj-a", "proj-b"})
            for item in items:
                self.assertEqual(item["type"], "url-link")
                self.assertTrue(item["url"].startswith("/projects/"))
                self.assertIn("thumbnail", item)
                self.assertIn("resources", item)

            item_a = next(item for item in items if item["id"] == "proj-a")
            self.assertEqual(item_a["url"], "/projects/proj-a")
            self.assertEqual(item_a["summary"], "Project A summary")
            self.assertEqual(item_a["resource"]["label"], "Project A Site")

    def test_generated_assets_exclude_reused_and_preview_media(self) -> None:
        with tempfile.TemporaryDirectory() as temp_root_str, tempfile.TemporaryDirectory() as out_str:
            temp_root = Path(temp_root_str)
            out_dir = Path(out_str)

            assets_dir = temp_root / "Technology" / "Demo" / "FolioAssets"
            assets_dir.mkdir(parents=True)

            media_files = {
                "thumbnail.png": b"thumb",
                "banner.png": b"banner",
                "hero.png": b"hero",
                "poster.png": b"poster",
                "icon.png": b"icon",
                "video-thumb.png": b"video-thumb",
                "spec-cover.png": b"spec-cover",
                "unique.png": b"unique",
                "explicit.png": b"explicit",
                "intro.mp4": b"intro-video",
            }
            for filename, content in media_files.items():
                (assets_dir / filename).write_bytes(content)

            input_payload = {
                "config": {"root_path": str(temp_root)},
                "projects": [
                    {
                        "id": "proj-assets",
                        "title": "Asset Demo",
                        "summary": "Asset coverage",
                        "domain": "Technology",
                        "category": ["application"],
                        "status": "Complete",
                        "phase": "Build",
                        "startDate": "2026-02-14",
                        "thumbnail": {"relativePath": "Technology/Demo/FolioAssets/thumbnail.png"},
                        "resources": [
                            {
                                "label": "Spec",
                                "type": "local-download",
                                "category": "download",
                                "url": "Technology/Demo/FolioAssets/spec-cover.png",
                            }
                        ],
                        "collections": [
                            {
                                "name": "Showcase",
                                "items": [
                                    {
                                        "id": "video-item",
                                        "label": "Intro Video",
                                        "type": "video",
                                        "relativePath": "Technology/Demo/FolioAssets/intro.mp4",
                                        "thumbnail": {
                                            "relativePath": "Technology/Demo/FolioAssets/video-thumb.png"
                                        },
                                    },
                                    {
                                        "id": "asset-explicit",
                                        "label": "Explicit Asset",
                                        "type": "image",
                                        "relativePath": "Technology/Demo/FolioAssets/explicit.png",
                                    },
                                ],
                            }
                        ],
                        "assets": [
                            {
                                "id": "asset-thumb",
                                "label": "Project Thumbnail",
                                "type": "image",
                                "relativePath": "Technology/Demo/FolioAssets/thumbnail.png",
                            },
                            {
                                "id": "asset-banner",
                                "label": "Project Banner",
                                "type": "image",
                                "relativePath": "Technology/Demo/FolioAssets/banner.png",
                            },
                            {
                                "id": "asset-hero",
                                "label": "Project Hero",
                                "type": "image",
                                "relativePath": "Technology/Demo/FolioAssets/hero.png",
                            },
                            {
                                "id": "asset-poster",
                                "label": "Project Poster",
                                "type": "image",
                                "relativePath": "Technology/Demo/FolioAssets/poster.png",
                            },
                            {
                                "id": "asset-icon",
                                "label": "Project Icon",
                                "type": "image",
                                "relativePath": "Technology/Demo/FolioAssets/icon.png",
                            },
                            {
                                "id": "asset-video-thumb",
                                "label": "Video Thumbnail",
                                "type": "image",
                                "relativePath": "Technology/Demo/FolioAssets/video-thumb.png",
                            },
                            {
                                "id": "asset-download-cover",
                                "label": "Spec Cover",
                                "type": "image",
                                "relativePath": "Technology/Demo/FolioAssets/spec-cover.png",
                            },
                            {
                                "id": "asset-explicit",
                                "label": "Explicit Asset",
                                "type": "image",
                                "relativePath": "Technology/Demo/FolioAssets/explicit.png",
                            },
                            {
                                "id": "asset-unique",
                                "label": "Unique Asset",
                                "type": "image",
                                "relativePath": "Technology/Demo/FolioAssets/unique.png",
                            },
                        ],
                    }
                ],
            }

            input_json = temp_root / "new_projects.json"
            input_json.write_text(json.dumps(input_payload), encoding="utf-8")

            result = build_projects_from_json(
                input_json_path=input_json,
                temp_public_projects_root=out_dir,
            )

            self.assertEqual(len(result["projects"]), 1)
            project = result["projects"][0]

            # Project media roles are still assigned.
            self.assertEqual(project["images"]["thumbnail"], "thumbnail.png")
            self.assertEqual(project["images"]["banner"], "banner.png")
            self.assertEqual(project["images"]["hero"], "hero.png")
            self.assertEqual(project["images"]["poster"], "poster.png")
            self.assertEqual(project["images"]["icon"], "icon.png")

            # Explicit collection items remain intact.
            showcase = project["collection"]["Showcase"]
            showcase_ids = {item["id"] for item in showcase["items"]}
            self.assertIn("asset-explicit", showcase_ids)

            # Auto-generated assets should only contain genuinely unused items.
            generated_assets = project["collection"]["assets"]["items"]
            generated_asset_ids = {item["id"] for item in generated_assets}
            self.assertEqual(generated_asset_ids, {"asset-unique"})

    def test_project_dates_only_use_started_and_last_update_columns(self) -> None:
        with tempfile.TemporaryDirectory() as temp_root_str, tempfile.TemporaryDirectory() as out_str:
            temp_root = Path(temp_root_str)
            out_dir = Path(out_str)

            input_payload = {
                "config": {"root_path": str(temp_root)},
                "projects": [
                    {
                        "id": "proj-dates",
                        "title": "Date Rules",
                        "startDate": "2001-01-01",
                        "lastUpdateDate": "2002-02-02",
                        "startedAt": "2026-02-01T12:00:00.000Z",
                        "lastUpdateAt": "2026-03-01T10:45:00.000Z",
                        "raw": {
                            "property_start_date": "1999-01-01",
                            "property_created_time": "1998-01-01T00:00:00.000Z",
                            "property_last_update_date": "1997-01-01",
                            "property_last_edited_time": "1996-01-01T00:00:00.000Z",
                        },
                    },
                    {
                        "id": "proj-dates-missing",
                        "title": "Date Missing",
                        "startDate": "2001-01-01",
                        "lastUpdateDate": "2002-02-02",
                        "raw": {
                            "property_start_date": "1999-01-01",
                            "property_last_update_date": "1997-01-01",
                        },
                    },
                ],
            }

            input_json = temp_root / "new_projects.json"
            input_json.write_text(json.dumps(input_payload), encoding="utf-8")

            result = build_projects_from_json(
                input_json_path=input_json,
                temp_public_projects_root=out_dir,
            )

            project_by_id = {project["id"]: project for project in result["projects"]}
            self.assertEqual(project_by_id["proj-dates"]["createdAt"], "2026-02-01T12:00:00.000Z")
            self.assertEqual(project_by_id["proj-dates"]["updatedAt"], "2026-03-01T10:45:00.000Z")
            self.assertIsNone(project_by_id["proj-dates-missing"]["createdAt"])
            self.assertIsNone(project_by_id["proj-dates-missing"]["updatedAt"])

    def test_collection_falls_back_to_assets_when_items_is_empty_list(self) -> None:
        with tempfile.TemporaryDirectory() as temp_root_str, tempfile.TemporaryDirectory() as out_str:
            temp_root = Path(temp_root_str)
            out_dir = Path(out_str)

            pages_dir = temp_root / "Creative" / "Coloring Book"
            pages_dir.mkdir(parents=True)
            (pages_dir / "1_In The Beginning.PNG").write_bytes(b"page-image")

            input_payload = {
                "config": {"root_path": str(temp_root)},
                "projects": [
                    {
                        "id": "proj-history",
                        "title": "History of Everything Coloring Book",
                        "collections": [
                            {
                                "name": "Pages",
                                "items": [],
                                "assets": [
                                    {
                                        "id": "page-1",
                                        "label": "1. In The Beginning",
                                        "type": "image",
                                        "relativePath": "Creative/Coloring Book/1_In The Beginning.PNG",
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }

            input_json = temp_root / "new_projects.json"
            input_json.write_text(json.dumps(input_payload), encoding="utf-8")

            result = build_projects_from_json(
                input_json_path=input_json,
                temp_public_projects_root=out_dir,
            )

            self.assertEqual(len(result["projects"]), 1)
            project = result["projects"][0]
            self.assertIn("Pages", project["collection"])
            pages = project["collection"]["Pages"]
            self.assertEqual(len(pages["items"]), 1)
            page_item = pages["items"][0]
            self.assertEqual(page_item["id"], "page-1")
            self.assertEqual(page_item["filePath"], "1_In The Beginning.PNG")

    def test_source_path_fallback_handles_collection_filename_mismatches(self) -> None:
        with tempfile.TemporaryDirectory() as temp_root_str, tempfile.TemporaryDirectory() as out_str:
            temp_root = Path(temp_root_str)
            out_dir = Path(out_str)

            pages_dir = temp_root / "Creative" / "Coloring Book"
            pages_dir.mkdir(parents=True)
            (pages_dir / "23_Mesopotamia :: Indus Valley.PNG").write_bytes(b"mesopotamia")
            (pages_dir / "5_Earth Science.PNG").write_bytes(b"earth-science")

            input_payload = {
                "config": {"root_path": str(temp_root)},
                "projects": [
                    {
                        "id": "proj-history-paths",
                        "title": "History Paths",
                        "collections": [
                            {
                                "name": "Pages",
                                "items": [],
                                "assets": [
                                    {
                                        "id": "page-mesopotamia",
                                        "label": "23_Mesopotamia // Indus Valley.PNG",
                                        "type": "image",
                                        "relativePath": "Creative/Coloring Book/23_Mesopotamia // Indus Valley.PNG",
                                    },
                                    {
                                        "id": "page-earth",
                                        "label": "5. Earth Science",
                                        "type": "image",
                                        "relativePath": "5_Earth Science.PNG",
                                    },
                                ],
                            }
                        ],
                    }
                ],
            }

            input_json = temp_root / "new_projects.json"
            input_json.write_text(json.dumps(input_payload), encoding="utf-8")

            result = build_projects_from_json(
                input_json_path=input_json,
                temp_public_projects_root=out_dir,
            )

            project = result["projects"][0]
            pages = project["collection"]["Pages"]["items"]
            page_by_id = {item["id"]: item for item in pages}

            self.assertEqual(page_by_id["page-mesopotamia"]["filePath"], "23_Mesopotamia :: Indus Valley.PNG")
            self.assertEqual(page_by_id["page-earth"]["filePath"], "5_Earth Science.PNG")

    def test_svg_assets_are_preserved_not_rasterized(self) -> None:
        """SVG files should be copied as SVGs throughout the pipeline, never converted to .webp."""
        with tempfile.TemporaryDirectory() as temp_root_str, tempfile.TemporaryDirectory() as out_str:
            temp_root = Path(temp_root_str)
            out_dir = Path(out_str)

            assets_dir = temp_root / "Technology" / "SVG Project" / "FolioAssets"
            assets_dir.mkdir(parents=True)

            svg_content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>'
            (assets_dir / "icon.svg").write_text(svg_content, encoding="utf-8")
            (assets_dir / "thumbnail.svg").write_text(svg_content, encoding="utf-8")
            (assets_dir / "banner.png").write_bytes(b"png-data")

            input_payload = {
                "config": {"root_path": str(temp_root)},
                "projects": [
                    {
                        "id": "proj-svg",
                        "projectPageId": "proj-svg-page",
                        "title": "SVG Project",
                        "summary": "Has SVG assets",
                        "domain": "Technology",
                        "category": ["design"],
                        "status": "Complete",
                        "phase": "Build",
                        "startDate": "2026-03-01",
                        "thumbnail": {"relativePath": "Technology/SVG Project/FolioAssets/thumbnail.svg"},
                        "collections": [
                            {
                                "name": "Icons",
                                "items": [
                                    {
                                        "id": "item-svg",
                                        "label": "Icon",
                                        "type": "image",
                                        "relativePath": "Technology/SVG Project/FolioAssets/icon.svg",
                                    },
                                ],
                            }
                        ],
                        "resources": [],
                    },
                ],
            }

            input_json = temp_root / "new_projects.json"
            input_json.write_text(json.dumps(input_payload), encoding="utf-8")

            result = build_projects_from_json(
                input_json_path=input_json,
                temp_public_projects_root=out_dir,
            )

            proj = result["projects"][0]
            folder = proj["folderName"]

            # Thumbnail should remain .svg (not renamed to .webp)
            self.assertEqual(proj["images"]["thumbnail"], "thumbnail.svg")
            self.assertTrue(proj["images"]["thumbnail"].endswith(".svg"))
            self.assertTrue((out_dir / folder / "thumbnail.svg").exists())

            # Collection item should keep its .svg extension
            collection_item = proj["collection"]["Icons"]["items"][0]
            self.assertEqual(collection_item["filePath"], "icon.svg")
            self.assertTrue(collection_item["filePath"].endswith(".svg"))


class TestMediaOptimizer(unittest.TestCase):
    """Test the media optimizer SVG handling."""

    @classmethod
    def _import_media_optimizer(cls):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "media_optimizer",
            str(Path(__file__).resolve().parent.parent / "lib" / "media-optimizer.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_optimize_svg_full_creates_svg_variants(self) -> None:
        """optimize_svg_full should create -optimized.svg and -thumb.svg, not .webp."""
        mod = self._import_media_optimizer()

        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            svg_content = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
            src = output_dir / "icon.svg"
            src.write_text(svg_content, encoding="utf-8")

            results = mod.optimize_svg_full(src, output_dir)

            # Should produce SVG variants, not WebP
            self.assertEqual(results["optimized"], "icon-optimized.svg")
            self.assertEqual(results["thumbnail"], "icon-thumb.svg")
            self.assertEqual(results["original"], "icon.svg")

            # Files should exist on disk
            self.assertTrue((output_dir / "icon-optimized.svg").exists())
            self.assertTrue((output_dir / "icon-thumb.svg").exists())

            # Content should be preserved
            self.assertEqual(
                (output_dir / "icon-optimized.svg").read_text(encoding="utf-8"),
                svg_content,
            )

    def test_optimize_image_full_dispatches_svg_to_svg_handler(self) -> None:
        """optimize_image_full should detect .svg and use optimize_svg_full."""
        mod = self._import_media_optimizer()

        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            svg_content = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
            src = output_dir / "logo.svg"
            src.write_text(svg_content, encoding="utf-8")

            results = mod.optimize_image_full(src, output_dir)

            self.assertEqual(results["optimized"], "logo-optimized.svg")
            self.assertEqual(results["thumbnail"], "logo-thumb.svg")
            self.assertNotIn(".webp", results.get("optimized", ""))
            self.assertNotIn(".webp", results.get("thumbnail", ""))


if __name__ == "__main__":
    unittest.main()
