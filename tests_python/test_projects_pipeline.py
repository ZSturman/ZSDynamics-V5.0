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
            self.assertEqual(item3["type"], "local-link")
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


if __name__ == "__main__":
    unittest.main()
