#!/usr/bin/env python3
"""
Build projects.json and public/projects/ from a folder-based project structure.

Input:
  ROOT/
    PROJECT_NAME_1/
      project_info.json
      Images/
        ... image files ...
      resources.json              (optional)
      Collections/
        collection_info.json      (one collection per project)
        Images/                   (optional collection-level images)
          ... image files ...
        resources.json            (optional collection-level resources)
        Items/
          0/
            item_info.json
            Images/              (optional item-level images, e.g. thumbnail.png)
              ... image files ...
            resources.json       (optional item-level resources)
            <main media file>    (e.g. video.mp4, model.glb, etc.)
          1/
            ...

Output:
  public/
    image-hostnames.json
    projects/
      projects.json              (array of all project objects)
      <folderName1>/             (slugified-title_id)
        <copied project images>
        <copied project resources>
        <collection_id>/
          <item_id>/
            <copied item media + thumbnails + resources>
      <folderName2>/
        ...

Notes:
- Only projects with project_info["public"] == True are included.
- `folderName = "{slugified_title}_{id}"`.
- Project images/resources/collections are mapped to a JSON structure similar
  to the original folio script’s final output, but adapted to your new layout.
"""

import argparse
import json
import os
import shutil
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse, unquote

# ---------- Extension sets and helpers (reuse from original design) ----------

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff"}
IMAGE_EXTS_FULL = IMAGE_EXTS | {".svg", ".heic", ".avif"}
VIDEO_EXTS = {".mov", ".mp4", ".webm", ".mkv", ".avi", ".flv", ".ogv", ".wmv", ".mpg", ".mpeg"}
MEDIA_EXTS = IMAGE_EXTS_FULL | VIDEO_EXTS  # Combined for thumbnails, banners, posters, etc.
AUDIO_EXTS = {".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac", ".opus"}
MODEL_EXTS = {".glb", ".gltf", ".obj", ".fbx", ".stl", ".dae", ".3ds", ".ply"}
GAME_EXTS = {".html", ".htm", ".unityweb", ".wasm"}
TEXT_EXTS = {".md", ".markdown", ".txt", ".tex", ".csv", ".json", ".pdf"}


def determine_collection_item_type(raw_type: Optional[str], path_val: Optional[str]) -> str:
    """Map a raw type string or path/filename to a canonical type."""
    if raw_type and isinstance(raw_type, str):
        t = raw_type.strip().lower()

        if t == "url":
            return "url-link"
        if t == "folio":
            return "folio"

        if t in {"image", "video", "3d-model", "3d", "game", "text", "audio", "url-link"}:
            if t == "3d":
                return "3d-model"
            return t

        if t == "file":
            pass
        elif t.startswith("."):
            t = t[1:]
            if t in {e.lstrip(".") for e in IMAGE_EXTS_FULL}:
                return "image"
            if t in {e.lstrip(".") for e in VIDEO_EXTS}:
                return "video"
            if t in {e.lstrip(".") for e in AUDIO_EXTS}:
                return "audio"
            if t in {e.lstrip(".") for e in MODEL_EXTS}:
                return "3d-model"
            if t in {e.lstrip(".") for e in GAME_EXTS}:
                return "game"
            if t in {e.lstrip(".") for e in TEXT_EXTS}:
                return "text"
        else:
            if t in {e.lstrip(".") for e in IMAGE_EXTS_FULL}:
                return "image"
            if t in {e.lstrip(".") for e in VIDEO_EXTS}:
                return "video"
            if t in {e.lstrip(".") for e in AUDIO_EXTS}:
                return "audio"
            if t in {e.lstrip(".") for e in MODEL_EXTS}:
                return "3d-model"
            if t in {e.lstrip(".") for e in GAME_EXTS}:
                return "game"
            if t in {e.lstrip(".") for e in TEXT_EXTS}:
                return "text"

    if path_val and isinstance(path_val, str):
        if path_val.strip().startswith(("http://", "https://", "ftp://")):
            return "url-link"
        try:
            p = Path(unquote(str(path_val)))
            ext = p.suffix.lower()
            if ext in IMAGE_EXTS_FULL:
                return "image"
            if ext in VIDEO_EXTS:
                return "video"
            if ext in AUDIO_EXTS:
                return "audio"
            if ext in MODEL_EXTS:
                return "3d-model"
            if ext in GAME_EXTS:
                return "game"
            if ext in TEXT_EXTS:
                return "text"
        except Exception:
            pass

    if path_val and isinstance(path_val, str):
        lower = path_val.lower()
        for extset, canon in (
            (IMAGE_EXTS_FULL, "image"),
            (VIDEO_EXTS, "video"),
            (AUDIO_EXTS, "audio"),
            (MODEL_EXTS, "3d-model"),
            (GAME_EXTS, "game"),
            (TEXT_EXTS, "text"),
        ):
            for ext in extset:
                if ext.lstrip(".") in lower or ext in lower:
                    return canon

    return "image"


def slugify(name: str) -> str:
    import re

    s = (name or "").strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s-]+", "_", s).strip("_")
    return s or "untitled"


def generate_unique_id(base_name: str, context: str = "") -> str:
    """
    Generate a unique ID from a base name.
    Format: {slugified_base_name}_{short_hash}
    The hash is derived from base_name + context for uniqueness.
    """
    slug = slugify(base_name)
    # Create a short hash from the base name and context for uniqueness
    hash_input = f"{base_name}_{context}".encode('utf-8')
    hash_hex = hashlib.md5(hash_input).hexdigest()[:8]
    return f"{slug}_{hash_hex}"


def make_project_folder_name(title: str, project_id: str) -> str:
    slug = slugify(title)
    return f"{slug}_{project_id}"


def load_json(path: Path) -> Optional[Any]:
    # Provide more helpful debug output when loading *_info.json files
    is_info_file = str(path.name).endswith("_info.json")
    if not path.exists() or not path.is_file():
        if is_info_file:
            print(f"    JSON missing: {path} (exists={path.exists()}, is_file={path.is_file()})")
        return None

    try:
        text = path.read_text(encoding="utf-8")
    except Exception as e:
        if is_info_file:
            print(f"    Error reading file {path}: {e}")
        return None

    try:
        return json.loads(text)
    except Exception as e:
        if not is_info_file:
            return None

        # Attempt a lenient auto-fix for common JS-like patterns (unquoted keys,
        # trailing commas). This is best-effort and only used for debugging/fixing
        # local data files; we'll print the attempted transformation.
        try:
            import re

            fixed = text
            # Remove BOM if present
            if fixed.startswith("\ufeff"):
                fixed = fixed.lstrip("\ufeff")

            # Quote unquoted keys: handle start-of-file or after {, comma, or whitespace
            fixed = re.sub(r'(^|[\{,\n\r\t\s])([A-Za-z0-9_\-]+)\s*:', r'\1"\2":', fixed)

            # Do NOT blindly replace all single quotes (this breaks contractions like
            # "Here's"). Safer strategies may be applied later if needed.

            # Remove trailing commas before closing } or ]
            fixed = re.sub(r',\s*([}\]])', r'\1', fixed)

            # Try parsing again
            parsed = json.loads(fixed)
            print(f"    Parsed {path} after attempting lenient fixes")
            snippet = fixed[:400].replace("\n", "\\n")
            print(f"    Fixed file snippet (first 400 chars): {snippet}")
            return parsed
        except Exception as e2:
            snippet = text[:400].replace("\n", "\\n")
            print(f"    Error parsing JSON {path}: {e}")
            print(f"    Attempted lenient parse failed: {e2}")
            print(f"    Original file snippet (first 400 chars): {snippet}")
            return None


# ---------- Resource handling ----------

def _normalize_resources(
    resources: List[Dict[str, Any]],
    base_dir: Path,
    dest_dir: Path,
    url_prefix: str,
) -> List[Dict[str, Any]]:
    """
    Normalize resources list:
    - local-link: make URL site-relative, no copying.
    - local-download: copy file to dest_dir and set url to <url_prefix>/<filename>.
    """
    out: List[Dict[str, Any]] = []
    dest_dir.mkdir(parents=True, exist_ok=True)

    for res in resources:
        if not isinstance(res, dict):
            continue
        res = dict(res)  # shallow copy
        rtype = str(res.get("type") or "").strip().lower()
        url_val = res.get("url")

        # local-link and local-link:/path syntax
        if rtype.startswith("local-link"):
            path_from_type = None
            if ":" in rtype:
                try:
                    _, after = rtype.split(":", 1)
                    if after:
                        path_from_type = unquote(after)
                except Exception:
                    path_from_type = None

            if path_from_type:
                p = str(path_from_type)
            else:
                p = str(url_val or "")

            if p:
                p = unquote(p)
                if not p.startswith("/"):
                    p = "/" + p
                res["url"] = p

            out.append(res)
            continue

        # local-download: copy into dest_dir and rewrite url
        if rtype == "local-download" and url_val:
            found: Optional[Path] = None
            try:
                u = str(url_val)
                # absolute path?
                maybe = Path(unquote(u))
                if maybe.is_absolute() and maybe.exists() and maybe.is_file():
                    found = maybe
            except Exception:
                found = None

            # relative to base_dir
            if not found:
                candidate = base_dir / unquote(str(url_val))
                if candidate.exists() and candidate.is_file():
                    found = candidate
                else:
                    stem = Path(unquote(str(url_val))).stem.lower()
                    for p in base_dir.rglob("*"):
                        if p.is_file() and p.stem.lower() == stem:
                            found = p
                            break

            if not found:
                out.append(res)
                continue

            dest_file = dest_dir / found.name
            try:
                shutil.copy2(found, dest_file)
                res["url"] = f"{url_prefix}/{dest_file.name}"
            except Exception:
                pass

            out.append(res)
            continue

        # other resource types: leave as-is
        out.append(res)

    return out


def process_resources_json(
    json_path: Path,
    base_dir: Path,
    dest_dir: Path,
    url_prefix: str,
) -> List[Dict[str, Any]]:
    data = load_json(json_path)
    if data is None:
        return []
    if isinstance(data, dict):
        resources = [data]
    elif isinstance(data, list):
        resources = [r for r in data if isinstance(r, dict)]
    else:
        return []
    return _normalize_resources(resources, base_dir, dest_dir, url_prefix)


# ---------- Image/Video copying helpers ----------

def copy_media_files_to_dir(src_dir: Path, dest_dir: Path) -> Dict[str, str]:
    """
    Copy all media files (images and videos) from src_dir to dest_dir.
    This supports GIFs, videos, and all image formats for thumbnails, banners, posters, icons, etc.
    Return a dict mapping logical keys -> filename, e.g.:
      - thumbnail -> thumbnail.png (or thumbnail.mp4 for video)
      - banner    -> banner.jpg (or banner.webm for video)
      - poster    -> poster.gif
      - icon      -> icon.png
      - other media keyed by slugified stem.
    """
    media: Dict[str, str] = {}
    if not src_dir.exists() or not src_dir.is_dir():
        return media

    dest_dir.mkdir(parents=True, exist_ok=True)

    for p in src_dir.iterdir():
        if not p.is_file():
            continue
        ext = p.suffix.lower()
        if ext not in MEDIA_EXTS:
            continue

        dest = dest_dir / p.name
        try:
            shutil.copy2(p, dest)
        except Exception:
            continue

        stem = p.stem.lower()
        key: Optional[str] = None
        if stem in {"thumbnail", "thumb"}:
            key = "thumbnail"
        elif "banner" in stem:
            key = "banner"
        elif "poster" in stem:
            # Check for orientation-specific posters
            if "portrait" in stem:
                key = "posterPortrait"
            elif "landscape" in stem:
                key = "posterLandscape"
            else:
                key = "poster"
        elif "icon" in stem:
            key = "icon"
        else:
            key = slugify(stem)

        # Do not overwrite an existing key
        if key in media:
            continue

        media[key] = p.name

    return media


# Maintain backward compatibility alias
def copy_image_files_to_dir(src_dir: Path, dest_dir: Path) -> Dict[str, str]:
    """Legacy alias for copy_media_files_to_dir for backward compatibility."""
    return copy_media_files_to_dir(src_dir, dest_dir)


# ---------- Collections and items ----------

def process_collection_for_project(
    project_dir: Path,
    project_obj: Dict[str, Any],
    public_projects_root: Path,
) -> None:
    """
    Build project_obj["collection"] from:
      PROJECT/Collections/<CollectionName>/...
    Each collection is now in its own named folder.
    """
    collections_root = project_dir / "Collections"
    if not collections_root.exists() or not collections_root.is_dir():
        print(f"    No Collections directory at {collections_root} for project {project_dir.name}")
        return

    # Project folder
    proj_id = project_obj["id"]
    title = project_obj.get("title", "") or project_obj.get("name", "")
    folder_name = make_project_folder_name(title, proj_id)
    project_obj["folderName"] = folder_name  # ensure present

    proj_dest_root = public_projects_root / folder_name
    proj_dest_root.mkdir(parents=True, exist_ok=True)

    project_obj.setdefault("collection", {})

    # Iterate through each collection folder
    collection_folders = sorted([p for p in collections_root.iterdir() if p.is_dir()], key=lambda p: p.name)
    print(f"    Found {len(collection_folders)} collection folders in {collections_root}")
    
    for collection_folder in collection_folders:
        print(f"    Processing collection: {collection_folder.name}")
        
        collection_info_path = collection_folder / "collection_info.json"
        print(f"      Checking collection_info.json in {collection_folder}")
        col_info = load_json(collection_info_path)
        if not isinstance(col_info, dict):
            print(f"      collection_info.json not found or invalid in {collection_folder.name}")
            continue

        # Generate unique collection ID if not provided
        if "id" in col_info and col_info["id"]:
            collection_id = str(col_info["id"])
        else:
            # Use folder name and its index as context for uniqueness
            collection_id = generate_unique_id(
                collection_folder.name, 
                context=f"{proj_id}_{collection_folder.name}"
            )
            print(f"        Generated collection ID: {collection_id}")
        
        collection_label = col_info.get("label") or collection_folder.name
        
        # Ensure collection_id is unique within this project
        if collection_id in project_obj["collection"]:
            print(f"      WARNING: Duplicate collection_id '{collection_id}' found. Regenerating with folder path.")
            collection_id = generate_unique_id(
                collection_folder.name,
                context=str(collection_folder.absolute())
            )
            print(f"        New collection ID: {collection_id}")

        # Collection-level images
        collection_images_dir = collection_folder / "Images"
        collection_images = copy_image_files_to_dir(
            collection_images_dir,
            proj_dest_root / collection_id / "images",
        )

        # Prefix collection image paths with "images/" since they're in a subdirectory
        collection_images_with_prefix: Dict[str, str] = {}
        for key, filename in collection_images.items():
            collection_images_with_prefix[key] = f"images/{filename}"

        # Collection-level resources
        collection_resources_path = collection_folder / "resources.json"
        collection_resources = process_resources_json(
            collection_resources_path,
            base_dir=collection_folder,
            dest_dir=proj_dest_root / collection_id / "resources",
            url_prefix=f"/projects/{folder_name}/{collection_id}/resources",
        )

        items_dir = collection_folder / "Items"
        items: List[Dict[str, Any]] = []

        if items_dir.exists() and items_dir.is_dir():
            item_folders = sorted([p for p in items_dir.iterdir() if p.is_dir()], key=lambda p: p.name)
            print(f"      Found {len(item_folders)} item folders in {items_dir}")
            for item_folder in item_folders:
                print(f"        Checking item_info.json in {item_folder}")
                item_info_path = item_folder / "item_info.json"
                item_info = load_json(item_info_path)
                if not isinstance(item_info, dict):
                    print(f"        item_info.json not found or invalid in {item_folder}")
                    continue

                # Parse item folder name: "0_V1" -> index=0, name="V1"
                folder_name_parts = item_folder.name.split("_", 1)
                item_index = folder_name_parts[0] if len(folder_name_parts) > 0 else "0"
                item_name = folder_name_parts[1] if len(folder_name_parts) > 1 else item_folder.name
                
                # Generate unique item ID if not provided
                if "id" in item_info and item_info["id"]:
                    item_id = str(item_info["id"])
                else:
                    # Use folder name/index and collection context for uniqueness
                    base_name = item_name if item_name != item_folder.name else f"item_{item_index}"
                    item_id = generate_unique_id(
                        base_name,
                        context=f"{proj_id}_{collection_id}_{item_folder.name}"
                    )
                    print(f"          Generated item ID: {item_id}")
                
                item_label = item_info.get("label") or item_name

                # Item-level dest dir
                item_dest_dir = proj_dest_root / collection_id / item_id
                item_dest_dir.mkdir(parents=True, exist_ok=True)

                # Item main media file: first non-image, non-json, non-resources file.
                main_file: Optional[Path] = None
                for p in item_folder.iterdir():
                    if not p.is_file():
                        continue
                    # Skip system and metadata files
                    if p.name in {"item_info.json", "resources.json", ".DS_Store", "Thumbs.db", "desktop.ini"}:
                        continue
                    if p.suffix.lower() in IMAGE_EXTS_FULL:
                        continue
                    # skip any file under "Images" subdir
                    if p.parent.name == "Images":
                        continue
                    main_file = p
                    break

                main_filename: Optional[str] = None
                if main_file is not None:
                    dest = item_dest_dir / main_file.name
                    try:
                        shutil.copy2(main_file, dest)
                        main_filename = main_file.name
                    except Exception:
                        main_filename = None

                # Item images (for thumbnails, etc.)
                item_images_dir = item_folder / "Images"
                item_images = copy_image_files_to_dir(item_images_dir, item_dest_dir / "images")

                # Prefix image paths with "images/" since they're in a subdirectory
                item_images_with_prefix: Dict[str, str] = {}
                for key, filename in item_images.items():
                    item_images_with_prefix[key] = f"images/{filename}"

                thumbnail_name: Optional[str] = None
                if "thumbnail" in item_images_with_prefix:
                    thumbnail_name = item_images_with_prefix["thumbnail"]
                elif item_images_with_prefix:
                    # pick an arbitrary image as thumbnail if none explicitly marked
                    thumbnail_name = next(iter(item_images_with_prefix.values()))

                raw_type = item_info.get("type")
                type_path_for_guess = str(main_file) if main_file is not None else None
                normalized_type = determine_collection_item_type(raw_type, type_path_for_guess)

                # Item-level resources
                item_resources_path = item_folder / "resources.json"
                item_resources = process_resources_json(
                    item_resources_path,
                    base_dir=item_folder,
                    dest_dir=item_dest_dir / "resources",
                    url_prefix=f"/projects/{folder_name}/{collection_id}/{item_id}/resources",
                )

                item_obj: Dict[str, Any] = dict(item_info)
                item_obj["id"] = item_id
                item_obj.setdefault("label", item_label)
                item_obj["type"] = normalized_type
                if main_filename:
                    item_obj["filePath"] = main_filename
                if thumbnail_name:
                    item_obj["thumbnail"] = thumbnail_name
                if item_images_with_prefix:
                    item_obj["images"] = item_images_with_prefix
                if item_resources:
                    item_obj["resources"] = item_resources

                items.append(item_obj)

        collection_obj: Dict[str, Any] = dict(col_info)
        collection_obj["id"] = collection_id
        collection_obj.setdefault("label", collection_label)
        if collection_images_with_prefix:
            collection_obj["images"] = collection_images_with_prefix
        if collection_resources:
            collection_obj["resources"] = collection_resources
        collection_obj["items"] = items

        project_obj["collection"][collection_id] = collection_obj


# ---------- Project processing ----------

def process_project_dir(
    project_dir: Path,
    public_projects_root: Path,
) -> Optional[Dict[str, Any]]:
    """
    Turn one PROJECT_NAME/ folder into a project object and copy its assets.
    """
    print(f"  Checking project_info.json in {project_dir.name}")
    project_info_path = project_dir / "project_info.json"
    proj_info = load_json(project_info_path)
    if not isinstance(proj_info, dict):
        print(f"    project_info.json not found or invalid in {project_dir.name}")
        return None

    # Respect "public" flag
    is_public = bool(proj_info.get("public", False))
    print(f"    Public flag: {is_public}")
    if not is_public:
        print(f"    Skipping non-public project: {project_dir.name}")
        return None

    print(f"    Processing project: {project_dir.name}")
    # Generate unique project ID if not provided
    if "id" in proj_info and proj_info["id"]:
        project_id = str(proj_info["id"])
    else:
        # Use folder name as context for uniqueness
        project_id = generate_unique_id(project_dir.name, context=str(project_dir.absolute()))
        print(f"      Generated project ID: {project_id}")
    title = proj_info.get("title") or proj_info.get("label") or project_dir.name
    title = str(title)

    project_obj: Dict[str, Any] = dict(proj_info)
    project_obj["id"] = project_id
    project_obj.setdefault("title", title)
    project_obj.setdefault("name", title)
    project_obj["domain"] = project_obj.get("domain") or "Unknown Domain"

    folder_name = make_project_folder_name(title, project_id)
    project_obj["folderName"] = folder_name

    proj_dest_root = public_projects_root / folder_name
    proj_dest_root.mkdir(parents=True, exist_ok=True)

    # Project-level images (now supports videos too for thumbnails, banners, posters, icons)
    proj_images_dir = project_dir / "Images"
    proj_images = copy_image_files_to_dir(proj_images_dir, proj_dest_root)
    if proj_images:
        project_obj["images"] = proj_images
        
    # If imageSettings exist in project_info, preserve them (for video autoPlay, loop, etc.)
    # These settings apply to video files used as thumbnails, banners, posters, icons
    if "imageSettings" in proj_info:
        project_obj["imageSettings"] = proj_info["imageSettings"]

    # Project-level resources
    proj_resources_path = project_dir / "resources.json"
    proj_resources = process_resources_json(
        proj_resources_path,
        base_dir=project_dir,
        dest_dir=proj_dest_root / "resources",
        url_prefix=f"/projects/{folder_name}/resources",
    )
    if proj_resources:
        project_obj["resources"] = proj_resources

    # Collections
    process_collection_for_project(project_dir, project_obj, public_projects_root)

    return project_obj


# ---------- External image hostnames ----------

def extract_external_image_hostnames(projects: List[Dict[str, Any]]) -> set:
    hostnames = set()

    def extract_hostname(url_str: str) -> Optional[str]:
        if not url_str or not isinstance(url_str, str):
            return None
        url_str_stripped = url_str.strip()
        if url_str_stripped.startswith("/") or "://" not in url_str_stripped:
            return None
        try:
            parsed = urlparse(url_str_stripped)
            if parsed.hostname:
                return parsed.hostname
        except Exception:
            return None
        return None

    def scan_dict(obj: Dict[str, Any]):
        if not isinstance(obj, dict):
            return
        for _, value in obj.items():
            if isinstance(value, str):
                hn = extract_hostname(value)
                if hn:
                    hostnames.add(hn)
            elif isinstance(value, dict):
                scan_dict(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        scan_dict(item)
                    elif isinstance(item, str):
                        hn = extract_hostname(item)
                        if hn:
                            hostnames.add(hn)

    for proj in projects:
        if isinstance(proj, dict):
            scan_dict(proj)

    return hostnames


# ---------- Main ----------

def main():
    parser = argparse.ArgumentParser(
        description="Build projects.json and public/projects/ from folder-based projects."
    )
    parser.add_argument(
        "root",
        help="Root directory containing project subfolders (each with project_info.json, etc.)",
    )
    args = parser.parse_args()

    root = Path(args.root)
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"Root directory not found or not a directory: {root.resolve()}")

    # public/ is sibling of this script's parent (same convention as original script)
    public_root = Path(__file__).parent.parent / "public"
    public_root.mkdir(parents=True, exist_ok=True)
    public_projects_root = public_root / "projects"

    # Clean and recreate public/projects
    if public_projects_root.exists():
        shutil.rmtree(public_projects_root)
    public_projects_root.mkdir(parents=True, exist_ok=True)

    all_projects: List[Dict[str, Any]] = []

    print(f"Walking through root directory: {root}")
    proj_dirs = [p for p in root.iterdir() if p.is_dir()]
    print(f"Found {len(proj_dirs)} subdirectories: {[p.name for p in proj_dirs]}")

    for proj_dir in sorted(proj_dirs, key=lambda p: p.name):
        print(f"Processing project directory: {proj_dir.name}")
        project_obj = process_project_dir(proj_dir, public_projects_root)
        if project_obj is not None:
            print(f"Added project: {project_obj.get('title', 'Unknown')}")
            all_projects.append(project_obj)
        else:
            print(f"Skipped project directory: {proj_dir.name} (returned None)")

    print(f"Total projects processed: {len(all_projects)}")

    # Write projects.json inside public/projects/
    projects_json_path = public_projects_root / "projects.json"
    projects_json_path.write_text(
        json.dumps(all_projects, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(all_projects)} projects to {projects_json_path}")

    # Write image-hostnames.json at public/
    hostnames = extract_external_image_hostnames(all_projects)
    hostnames_config_path = public_root / "image-hostnames.json"
    hostnames_config_path.write_text(
        json.dumps({"hostnames": sorted(list(hostnames))}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(hostnames)} external image hostnames to {hostnames_config_path}")


if __name__ == "__main__":
    print("DONT FORGET TO UPDATE THE PACKAGE.JSON TO BE THE CORRECT PATH LATER:")
    print("python3 lib/folio-prebuild.py /Users/zacharysturman/Desktop/PORTFOLIO")
    main()