#!/usr/bin/env python3
"""
Folio pre-build script.

This script walks a root directory looking for .folio files (which contain JSON data),
processes the project metadata, and copies assets (images, thumbnails, collection items, etc.)
into the public/projects/<id>/ directory structure.

.folio file structure (NEW FORMAT):
- All assets are resolved relative to assetsFolder.path (required at root level)
- Images use { "id": "...", "path": "relative/path/to/file.png" } format
- Collections are structured as { "collectionName": { "items": [...] } }
  or legacy { "collectionName": [ items... ] }
- Collection items have filePath and thumbnail objects with { "id": "...", "path": "..." }
- The 'title' field is mapped to 'name' in the output
- Domain can be any value or will default to "Unknown Domain" if missing
- Only .folio files are processed; legacy _project.json files are no longer supported

This script processes all .folio files found in the given root directory.
"""

import json
import re
import shutil
import tempfile
import os
import sys
import time
from pathlib import Path
from typing import Optional, Dict, Set
import argparse
from urllib.parse import urlparse, unquote
import errno
from datetime import datetime
import logging

# Logging setup
log_dir = Path(__file__).parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"folio-prebuild_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
    ]
)
logger = logging.getLogger(__name__)

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff"}

# Extended extension maps for normalizing collection item types
IMAGE_EXTS_FULL = IMAGE_EXTS | {".svg", ".heic", ".avif"}
VIDEO_EXTS = {".mov", ".mp4", ".webm", ".mkv", ".avi", ".flv", ".ogv", ".wmv", ".mpg", ".mpeg"}
AUDIO_EXTS = {".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac", ".opus"}
MODEL_EXTS = {".glb", ".gltf", ".obj", ".fbx", ".stl", ".dae", ".3ds", ".ply"}
GAME_EXTS = {".html", ".htm", ".unityweb", ".wasm"}
TEXT_EXTS = {".md", ".markdown", ".txt", ".tex", ".csv", ".json", ".pdf"}


def determine_collection_item_type(raw_type: Optional[str], path_val: Optional[str]) -> str:
    """Map a raw type string or path/filename to one of the canonical types:
    "image", "video", "3d-model", "game", "text", "audio", "url-link", "folio".
    Defaults to "image" when unsure (safe fallback for thumbnails/previews).
    """
    if raw_type and isinstance(raw_type, str):
        t = raw_type.strip().lower()
        
        # Handle Folio app types: "File", "URL", "Folio"
        if t == "url":
            return "url-link"
        if t == "folio":
            return "folio"
        
        # If it's already one of the canonical names, return it
        if t in {"image", "video", "3d-model", "3d", "game", "text", "audio", "url-link"}:
            if t == "3d":
                return "3d-model"
            return t
        
        # For "file" type, try to determine from path (don't return early)
        if t == "file":
            # Will fall through to path checking below
            pass
        # Sometimes the type field contains an extension or short form like "mov", "glb", "png"
        elif t.startswith('.'):
            t = t[1:]
            # Check if it matches an extension
            if t in {ext.lstrip('.') for ext in IMAGE_EXTS_FULL}:
                return "image"
            if t in {ext.lstrip('.') for ext in VIDEO_EXTS}:
                return "video"
            if t in {ext.lstrip('.') for ext in AUDIO_EXTS}:
                return "audio"
            if t in {ext.lstrip('.') for ext in MODEL_EXTS}:
                return "3d-model"
            if t in {ext.lstrip('.') for ext in GAME_EXTS}:
                return "game"
            if t in {ext.lstrip('.') for ext in TEXT_EXTS}:
                return "text"
        # extension-like - check if raw type looks like an extension
        else:
            if t in {ext.lstrip('.') for ext in IMAGE_EXTS_FULL}:
                return "image"
            if t in {ext.lstrip('.') for ext in VIDEO_EXTS}:
                return "video"
            if t in {ext.lstrip('.') for ext in AUDIO_EXTS}:
                return "audio"
            if t in {ext.lstrip('.') for ext in MODEL_EXTS}:
                return "3d-model"
            if t in {ext.lstrip('.') for ext in GAME_EXTS}:
                return "game"
            if t in {ext.lstrip('.') for ext in TEXT_EXTS}:
                return "text"

    # Inspect the path if provided
    if path_val and isinstance(path_val, str):
        # Check if it's a URL first
        if path_val.strip().startswith(('http://', 'https://', 'ftp://')):
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

    # As a last-resort fallback, attempt to glean an extension from the string
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
                if ext.lstrip('.') in lower or ext in lower:
                    return canon

    # Default fallback
    return "image"


def slugify(name: str) -> str:
    """Convert a string to a URL-safe slug."""
    s = (name or "").strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s-]+", "_", s).strip("_")
    return s or "untitled"


def make_project_folder_name(title: str, project_id: str) -> str:
    """Create a folder name from title and id: {slugified-title}_{id}"""
    slug = slugify(title)
    return f"{slug}_{project_id}"


def find_folio_file(proj_dir: Path) -> Optional[Path]:
    """Find a .folio file in the given directory."""
    for p in proj_dir.iterdir():
        if p.is_file() and p.suffix.lower() == ".folio":
            return p
    return None


def copy_thumbnail_for_project(proj_dir: Path, project_obj: dict, public_projects_root: Path) -> Optional[Path]:
    """If project_obj has id and thumbnail, copy thumbnail into public/projects/<folder_name>/ and return dest path.

    This function now accepts thumbnail names that may be relative to an
    alternate `base_dir` (assetsFolder). To keep call sites simple the
    function will detect if `project_obj` contains a special key
    `_base_dir` (Path) and use that when resolving relative paths.
    """
    if not isinstance(project_obj, dict):
        return None
    project_id = project_obj.get("id")
    title = project_obj.get("title", "")
    thumb_name = project_obj.get("thumbnail")
    if not project_id or not thumb_name:
        return None

    # Allow caller to override base dir by setting a Path at project_obj['_base_dir']
    base_dir = project_obj.get("_base_dir")
    if not isinstance(base_dir, Path):
        base_dir = proj_dir if isinstance(proj_dir, Path) else Path(".")
    thumb_val = thumb_name
    # Support file:// URIs or percent-encoded paths
    if isinstance(thumb_val, str) and thumb_val.startswith("file://"):
        try:
            parsed = urlparse(thumb_val)
            src = Path(unquote(parsed.path))
        except Exception:
            src = base_dir / thumb_val
    else:
        src = Path(str(thumb_val))
        if not src.is_absolute():
            src = base_dir / src
    if not src.exists() or not src.is_file():
        # If thumbnail value isn't present as-is, check for a 'thumbnail.*' file
        for p in proj_dir.iterdir():
            if p.is_file() and p.stem.lower() == "thumbnail" and p.suffix.lower() in IMAGE_EXTS:
                src = p
                break
        else:
            return None

    folder_name = make_project_folder_name(title, project_id)
    dest_dir = public_projects_root / folder_name
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    shutil.copy2(src, dest)
    return dest


def copy_images_for_project(proj_dir: Path, project_obj: dict, public_projects_root: Path) -> list[str]:
    """Copy all images listed in `project_obj['images']` into public/projects/<folder_name>/.
    
    Images now have structure: { "id": "...", "path": "relative/path.png" }
    All paths are resolved relative to assetsFolder.path (stored in project_obj['_base_dir']).
    
    Returns list of destination paths copied (strings).
    """
    out: list[str] = []
    if not isinstance(project_obj, dict):
        return out
    images = project_obj.get("images")
    project_id = project_obj.get("id")
    title = project_obj.get("title", "")
    if not images or not isinstance(images, dict) or not project_id:
        return out

    folder_name = make_project_folder_name(title, project_id)
    dest_dir = public_projects_root / folder_name
    dest_dir.mkdir(parents=True, exist_ok=True)

    for key, val in list(images.items()):
        if not val:
            continue

        # Images in new format: { "id": "...", "path": "..." } or simple string
        path_to_copy = None
        if isinstance(val, dict):
            path_to_copy = val.get("path")
        elif isinstance(val, str):
            path_to_copy = val
        else:
            # unknown format; skip
            continue
        if not path_to_copy:
            continue
        
        # Handle both absolute and relative paths
        path_obj = Path(str(path_to_copy))
        
        # Determine source file using assetsFolder base directory
        base_dir = project_obj.get("_base_dir")
        if not isinstance(base_dir, Path):
            base_dir = proj_dir if isinstance(proj_dir, Path) else Path(".")
        
        # Resolve path relative to base_dir (assetsFolder.path)
        if str(path_to_copy).startswith("file://"):
            try:
                parsed = urlparse(str(path_to_copy))
                src = Path(unquote(parsed.path))
            except Exception:
                src = base_dir / path_obj
        elif path_obj.is_absolute():
            # If it's an absolute path, use it directly
            src = path_obj
        else:
            # If it's relative, resolve it relative to base_dir (assetsFolder.path)
            src = base_dir / path_obj
        
        if not src.exists() or not src.is_file():
            # Try finding a file with matching stem
            stem = path_obj.stem.lower()
            found = None
            for p in proj_dir.rglob("*"):
                if p.is_file() and p.stem.lower() == stem and p.suffix.lower() in IMAGE_EXTS:
                    found = p
                    break
            if found:
                src = found
            else:
                continue

        # Copy to destination with just the filename (no subdirectories)
        # This simplifies the path structure: all images go directly in the project folder
        dest_file = dest_dir / src.name
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            shutil.copy2(src, dest_file)
            # Update the image object to use just the filename
            project_obj["images"][key] = src.name
            out.append(str(dest_file))
        except Exception:
            # skip failures but continue
            continue

    return out


def copy_resources_for_project(proj_dir: Path, project_obj: dict, public_projects_root: Path) -> list[str]:
    """Copy files for resources with category 'download' or type 'local-download' into public/projects/<folder_name>/.
    Updates each resource's 'url' to point to the public path ("/projects/<folder_name>/<filename>").
    Returns list of destination paths copied (strings).
    """
    out: list[str] = []
    if not isinstance(project_obj, dict):
        return out
    resources = project_obj.get("resources")
    project_id = project_obj.get("id")
    title = project_obj.get("title", "")
    if not resources or not isinstance(resources, list) or not project_id:
        return out

    folder_name = make_project_folder_name(title, project_id)
    dest_dir = public_projects_root / folder_name
    dest_dir.mkdir(parents=True, exist_ok=True)

    for res in resources:
        if not isinstance(res, dict):
            continue
        # Support a "local-link" resource type which should point to an
        # internal site path. It can be expressed either as:
        #   { type: "local-link", url: "/projects/proj-1" }
        # or encoded in the type itself:
        #   { type: "local-link:/projects/proj-1" }
        # Normalize and set `res["url"]` to a site-relative path (leading '/').
        rtype = res.get("type") or ""
        if isinstance(rtype, str) and rtype.lower().startswith("local-link"):
            # If the type contains a colon, the part after it is the path
            path_from_type = None
            if ":" in rtype:
                try:
                    _, after = rtype.split(":", 1)
                    if after:
                        path_from_type = unquote(after)
                except Exception:
                    path_from_type = None

            url_val = res.get("url")
            if path_from_type:
                p = str(path_from_type)
                if not p.startswith("/"):
                    p = "/" + p
                res["url"] = p
            elif url_val:
                try:
                    u = unquote(str(url_val))
                    if not u.startswith("/"):
                        u = "/" + u
                    res["url"] = u
                except Exception:
                    # leave as-is on error
                    pass
            # nothing to copy for local-link, continue to next resource
            continue

        # Check for both category=="download" and type=="local-download"
        category = res.get("category", "").lower() if res.get("category") else ""
        rtype_lower = (res.get("type") or "").lower()
        is_download = category == "download" or rtype_lower == "local-download"
        
        if not is_download:
            continue

        # Get the URL value for download resources
        url_val = res.get("url")
        if not url_val:
            continue

        # First, try to handle absolute file:// URIs and percent-encoded paths.
        found = None
        try:
            if isinstance(url_val, str) and url_val.startswith("file://"):
                # file:///absolute/path or file://localhost/absolute/path
                parsed = urlparse(url_val)
                candidate = Path(unquote(parsed.path))
                if candidate.exists() and candidate.is_file():
                    found = candidate
            else:
                # If url_val is an absolute path (possibly percent-encoded), use it directly
                if isinstance(url_val, str):
                    maybe = Path(unquote(url_val))
                    if maybe.is_absolute() and maybe.exists() and maybe.is_file():
                        found = maybe
        except Exception:
            # fall back to existing heuristics on any error
            found = None

        # If not found yet, try to resolve the source file relative to the project directory
        if not found:
            base_dir = project_obj.get("_base_dir")
            if not isinstance(base_dir, Path):
                base_dir = proj_dir if isinstance(proj_dir, Path) else Path(".")
            try:
                candidate = Path(unquote(str(url_val)))
                if not candidate.is_absolute():
                    src = base_dir / candidate
                else:
                    src = candidate
            except Exception:
                src = base_dir / str(url_val)

            if src.exists() and src.is_file():
                found = src
            else:
                # try finding a file with the same stem in the base dir
                stem = Path(unquote(str(url_val))).stem.lower()
                for p in base_dir.iterdir():
                    if p.is_file() and p.stem.lower() == stem:
                        found = p
                        break
                # also walk subdirectories as a last resort
                if not found:
                    for root, dirs, files in os.walk(str(base_dir)):
                        for f in files:
                            p = Path(root) / f
                            if p.stem.lower() == stem:
                                found = p
                                break
                        if found:
                            break

        if not found:
            # nothing to copy for this resource
            continue

        dest = dest_dir / found.name
        try:
            shutil.copy2(found, dest)
            # update the project object to reference the public path
            res["url"] = f"/projects/{folder_name}/{dest.name}"
            out.append(str(dest))
        except Exception:
            # skip failures but continue
            continue

    return out


def copy_collection_for_project(proj_dir: Path, project_obj: dict, public_projects_root: Path) -> list[str]:
    """Copy collection items into public/projects/<folder_name>/<collection_name>/<item_id>/.
    
    Collection structure: { "collectionName": { "items": [...] } } or { "collectionName": [...] }
    
    Each item has:
    - filePath: { "id": "...", "path": "relative/path.ext" }
    - thumbnail: { "id": "...", "path": "relative/path.png" }
    - resource: { ... } (kept as-is)
    
    All paths are resolved relative to assetsFolder.path (stored in project_obj['_base_dir']).
    Updates each item's `filePath` and `thumbnail` to simple filenames.
    Returns list of destination paths copied (strings).
    """
    out: list[str] = []
    if not isinstance(project_obj, dict):
        return out
    collection = project_obj.get("collection")
    project_id = project_obj.get("id")
    title = project_obj.get("title", "")
    if not collection or not isinstance(collection, dict) or not project_id:
        return out

    folder_name = make_project_folder_name(title, project_id)
    dest_root = public_projects_root / folder_name
    dest_root.mkdir(parents=True, exist_ok=True)

    # Iterate through all collection arrays (episodes, gallery, etc.)
    for collection_name, collection_data in collection.items():
        # Handle both array format and object format with "items" key
        items_array = None
        if isinstance(collection_data, list):
            # Direct array format: { "collectionName": [...] }
            items_array = collection_data
        elif isinstance(collection_data, dict) and "items" in collection_data:
            # Object format with items: { "collectionName": { "items": [...], ... } }
            items_array = collection_data.get("items")
        
        if not items_array or not isinstance(items_array, list):
            continue

        for item in items_array:
            if not isinstance(item, dict):
                continue
            
            # Normalize and validate the item type
            raw_type = item.get("type")
            item_id = item.get("id", "unknown")
            
            # Get path for type determination
            path_for_type = None
            if item.get("filePath"):
                fp = item["filePath"]
                if isinstance(fp, dict):
                    path_for_type = fp.get("path") or fp.get("pathToEdited") or fp.get("pathToOriginal")
                elif isinstance(fp, str):
                    path_for_type = fp
            elif item.get("path"):
                path_for_type = item["path"]
            
            # Determine normalized type
            normalized_type = determine_collection_item_type(raw_type, path_for_type)
            
            # Warn if type was changed (compare case-insensitively)
            if raw_type and normalized_type.lower() != raw_type.lower():
                print(f"  ⚠️  Collection '{collection_name}' item '{item_id}': normalized type '{raw_type}' → '{normalized_type}'")
            
            # Update the item type to normalized value
            item["type"] = normalized_type

            # Ensure item has an id
            item_id = item.get("id") or slugify(item.get("label") or item.get("type") or "")
            item["id"] = item_id

            # Create directory structure: <folder_name>/<collection_name>/<item_id>/
            item_dir = dest_root / collection_name / item_id
            item_dir.mkdir(parents=True, exist_ok=True)

            # Copy main file referenced by `filePath` if present
            file_path_obj = item.get("filePath")
            path_to_copy = None
            if isinstance(file_path_obj, dict):
                # New format: { "id": "...", "path": "..." }
                path_to_copy = file_path_obj.get("path")
            elif isinstance(file_path_obj, str):
                path_to_copy = file_path_obj
            
            if path_to_copy:
                path_obj = Path(str(path_to_copy))
                found = None
                
                # Handle both absolute and relative paths using assetsFolder base
                try:
                    base_dir = project_obj.get("_base_dir")
                    if not isinstance(base_dir, Path):
                        base_dir = proj_dir if isinstance(proj_dir, Path) else Path(".")
                    
                    if str(path_to_copy).startswith("file://"):
                        parsed = urlparse(str(path_to_copy))
                        src = Path(unquote(parsed.path))
                    elif path_obj.is_absolute():
                        src = path_obj
                    else:
                        # Resolve relative to assetsFolder.path
                        src = base_dir / unquote(str(path_to_copy))

                    if src.exists() and src.is_file():
                        found = src
                except Exception:
                    found = None

                if not found:
                    # search for matching stem in project directory and subdirs
                    stem = Path(unquote(str(path_to_copy))).stem.lower()
                    for root, dirs, files in os.walk(proj_dir):
                        for f in files:
                            fp = Path(root) / f
                            if fp.stem.lower() == stem:
                                found = fp
                                break
                        if found:
                            break

                if found:
                    try:
                        # Use just the filename, no subdirectories
                        dest = item_dir / found.name
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(found, dest)
                        out.append(str(dest))
                        
                        # For 3D models, check if an optimized GLB version exists
                        if normalized_type == "3d-model" and found.suffix.lower() in {'.obj', '.gltf'}:
                            glb_path = item_dir / f"{found.stem}.glb"
                            if glb_path.exists():
                                # Use the optimized GLB filename instead
                                item["filePath"] = glb_path.name
                                print(f"  Using optimized GLB: {glb_path.name}")
                            else:
                                # Keep original filename if GLB doesn't exist yet
                                item["filePath"] = found.name
                        else:
                            # For non-3D-model types, use the copied filename
                            item["filePath"] = found.name
                    except Exception:
                        pass

            # Copy thumbnail if present
            thumb_obj = item.get("thumbnail")
            thumb_path = None
            if isinstance(thumb_obj, dict):
                # New format: { "id": "...", "path": "..." }
                thumb_path = thumb_obj.get("path")
            elif isinstance(thumb_obj, str):
                thumb_path = thumb_obj
            
            if thumb_path:
                path_obj = Path(str(thumb_path))
                tfound = None
                
                # Handle both absolute and relative paths using assetsFolder base
                try:
                    bd = project_obj.get("_base_dir")
                    if not isinstance(bd, Path):
                        bd = proj_dir if isinstance(proj_dir, Path) else Path(".")
                    
                    if str(thumb_path).startswith("file://"):
                        parsed = urlparse(str(thumb_path))
                        tsrc = Path(unquote(parsed.path))
                    elif path_obj.is_absolute():
                        tsrc = path_obj
                    else:
                        # Resolve relative to assetsFolder.path
                        tsrc = bd / unquote(str(thumb_path))

                    if tsrc.exists() and tsrc.is_file():
                        tfound = tsrc
                except Exception:
                    tfound = None

                if not tfound:
                    # search for matching file
                    stem = Path(unquote(str(thumb_path))).stem.lower()
                    THUMBNAIL_EXTS = IMAGE_EXTS | VIDEO_EXTS
                    for p in proj_dir.rglob("*"):
                        if p.is_file() and p.stem.lower() == stem and p.suffix.lower() in THUMBNAIL_EXTS:
                            tfound = p
                            break

                if tfound:
                    try:
                        # Use just the filename, no subdirectories
                        tdest = item_dir / tfound.name
                        tdest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(tfound, tdest)
                        out.append(str(tdest))
                        # update thumbnail to just the filename
                        item["thumbnail"] = tfound.name
                    except Exception:
                        pass

    return out


def extract_external_image_hostnames(projects: list[dict]) -> set[str]:
    """Extract all external image hostnames from project data.
    
    Scans through projects looking for:
    - thumbnail URLs
    - collection item paths (images, videos, etc.)
    - hero image URLs
    - any other image fields that might contain external URLs
    
    Returns a set of hostnames (e.g., 'example.com', 'cdn.example.org')
    """
    hostnames = set()
    
    def extract_hostname(url_str: str) -> Optional[str]:
        """Extract hostname from a URL string if it's an external URL."""
        if not url_str or not isinstance(url_str, str):
            return None
        
        url_str = url_str.strip()
        
        # Skip local paths (starting with / or not containing ://)
        if url_str.startswith('/') or '://' not in url_str:
            return None
        
        try:
            parsed = urlparse(url_str)
            if parsed.hostname:
                return parsed.hostname
        except Exception:
            pass
        
        return None
    
    def scan_dict(obj: dict):
        """Recursively scan a dictionary for URL strings."""
        if not isinstance(obj, dict):
            return
        
        for key, value in obj.items():
            # Check string values for URLs
            if isinstance(value, str):
                hostname = extract_hostname(value)
                if hostname:
                    hostnames.add(hostname)
            # Recurse into nested dicts
            elif isinstance(value, dict):
                scan_dict(value)
            # Recurse into lists
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        scan_dict(item)
                    elif isinstance(item, str):
                        hostname = extract_hostname(item)
                        if hostname:
                            hostnames.add(hostname)
    
    # Scan all projects
    for project in projects:
        if isinstance(project, dict):
            scan_dict(project)
    
    return hostnames


def resolve_folio_resources(projects: list[dict], folio_url_to_id: Dict[str, str]):
    """Resolve folio type resources to project IDs and remove invalid references.
    
    Args:
        projects: List of project dictionaries to process
        folio_url_to_id: Mapping of folio file URLs to project IDs
    
    Processes:
    - Top-level resources with type='folio' OR category='folio'
    - Collection item resources with type='folio' OR category='folio'
    - Collection items with type='Folio' at item level
    - Removes resources if folio file not found or marked as private
    - Updates URL to /projects/<project_id> for valid folio references
    """
    warnings = []
    
    def normalize_url(url: str) -> str:
        """Normalize a URL/path for comparison by removing file:// prefix and decoding."""
        if not url:
            return ""
        # Remove file:// prefix if present
        if url.startswith("file://"):
            try:
                parsed = urlparse(url)
                url = unquote(parsed.path)
            except Exception:
                pass
        # Remove trailing slashes
        return url.rstrip('/')
    
    # Create a normalized lookup map
    normalized_folio_map = {}
    for orig_url, project_id in folio_url_to_id.items():
        norm_url = normalize_url(orig_url)
        normalized_folio_map[norm_url] = project_id
        logger.debug(f"Normalized mapping: '{norm_url}' -> '{project_id}'")
    
    def is_folio_resource(res: dict) -> bool:
        """Check if a resource object represents a folio reference."""
        if not isinstance(res, dict):
            return False
        res_type = res.get('type', '')
        res_category = res.get('category', '')
        return (isinstance(res_type, str) and res_type.lower() == 'folio') or \
               (isinstance(res_category, str) and res_category.lower() == 'folio')
    
    for project in projects:
        if not isinstance(project, dict):
            continue
            
        project_title = project.get('title', 'Unknown')
        
        # Process top-level resources
        if 'resources' in project and isinstance(project['resources'], list):
            valid_resources = []
            for res in project['resources']:
                if not isinstance(res, dict):
                    valid_resources.append(res)
                    continue
                    
                if is_folio_resource(res):
                    url = res.get('url', '')
                    norm_url = normalize_url(url)
                    if norm_url in normalized_folio_map:
                        target_id = normalized_folio_map[norm_url]
                        res['type'] = 'local-link'
                        res['url'] = f'/projects/{target_id}'
                        valid_resources.append(res)
                        logger.info(f"Resolved folio resource in '{project_title}' to /projects/{target_id}")
                    else:
                        warning = f"⚠️  Folio resource in '{project_title}' points to '{url}' which was not found or is private - resource removed"
                        warnings.append(warning)
                        logger.warning(warning)
                else:
                    valid_resources.append(res)
            
            project['resources'] = valid_resources
        
        # Process collection item resources
        if 'collection' in project and isinstance(project['collection'], dict):
            for collection_name, collection_data in project['collection'].items():
                items_array = None
                if isinstance(collection_data, list):
                    items_array = collection_data
                elif isinstance(collection_data, dict) and 'items' in collection_data:
                    items_array = collection_data.get('items')
                
                if not items_array or not isinstance(items_array, list):
                    continue
                
                for item in items_array:
                    if not isinstance(item, dict):
                        continue
                    
                    # Check if the item itself has type='Folio' and a url field
                    item_type = item.get('type', '')
                    if isinstance(item_type, str) and item_type.lower() == 'folio':
                        url = item.get('url', '')
                        norm_url = normalize_url(url)
                        if norm_url and norm_url in normalized_folio_map:
                            target_id = normalized_folio_map[norm_url]
                            item['type'] = 'local-link'
                            item['url'] = f'/projects/{target_id}'
                            logger.info(f"Resolved folio item in collection of '{project_title}' to /projects/{target_id}")
                        elif url:
                            warning = f"⚠️  Folio item in collection of '{project_title}' points to '{url}' which was not found or is private"
                            warnings.append(warning)
                            logger.warning(warning)
                    
                    # Also check the resource object within the item
                    if 'resource' in item and isinstance(item['resource'], dict):
                        res = item['resource']
                        if is_folio_resource(res):
                            url = res.get('url', '')
                            norm_url = normalize_url(url)
                            if norm_url in normalized_folio_map:
                                target_id = normalized_folio_map[norm_url]
                                res['type'] = 'local-link'
                                res['url'] = f'/projects/{target_id}'
                                # Only update the item-level url if it doesn't already have a valid external URL
                                # This preserves external URLs (like GitHub Pages) while allowing folio links
                                item_url = item.get('url', '')
                                is_external_url = isinstance(item_url, str) and (
                                    item_url.startswith('http://') or item_url.startswith('https://')
                                )
                                # If item has no URL or only has a local path, update it to the folio project link
                                if not is_external_url:
                                    item['url'] = f'/projects/{target_id}'
                                logger.info(f"Resolved folio resource in collection item of '{project_title}' to /projects/{target_id}")
                            else:
                                warning = f"⚠️  Folio resource in collection item of '{url}' points to '{url}' which was not found or is private - resource removed"
                                warnings.append(warning)
                                logger.warning(warning)
                                # Remove the resource from the item
                                del item['resource']
    
    # Print warnings to console
    if warnings:
        print("\n" + "="*80)
        print("FOLIO RESOURCE WARNINGS:")
        for warning in warnings:
            print(warning)
        print("="*80 + "\n")
    
    return projects


def _sanitize_for_json(value, is_project_root=False):
    """Recursively convert Path objects to strings and remove internal keys.

    Removes keys that start with an underscore (private/internal), e.g.
    `_base_dir`, and also removes Folio app-specific internal fields like
    `assetsFolder`, `createdAt`, `updatedAt`, etc. that aren't needed in the final JSON.
    
    Args:
        value: The value to sanitize
        is_project_root: True if this is the top-level project object (used to remove filePath only at root)
    
    Converts any Path instances to their string form so the object is JSON serializable.
    """
    # Fields to remove from final output (Folio app internals)
    # Note: filePath is only removed at project root level, not from collection items
    REMOVE_KEYS = {
        "assetsFolder",
        "requiresFollowUp",
    }
    
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            # drop internal/private keys (starting with _)
            if isinstance(k, str) and k.startswith("_"):
                continue
            # Remove Folio internals
            if isinstance(k, str) and k in REMOVE_KEYS:
                continue
            # Remove filePath only at project root level (not in collection items)
            if isinstance(k, str) and k == "filePath" and is_project_root:
                continue
            out[k] = _sanitize_for_json(v, is_project_root=False)
        return out
    if isinstance(value, list):
        return [_sanitize_for_json(v, is_project_root=False) for v in value]
    # For other simple types, return as-is
    return value


def main():
    parser = argparse.ArgumentParser(description="Process .folio files and copy assets into public/projects/<id>/")
    parser.add_argument("root", nargs="?", default="Projects", help="Root directory to search for .folio files.")
    parser.add_argument("--repair", action="store_true", help="When set, attempt to repair stray 'projects 2'/'projects 3' folders by renaming the newest one to 'projects' and exit.")
    args = parser.parse_args()

    root = Path(args.root)
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"Root directory not found: {root.resolve()}")

    # Build into a temporary directory inside public/ so the existing
    # `public/projects` remains available until the pre-build completes
    public_root = Path(__file__).parent.parent / "public"
    public_root.mkdir(parents=True, exist_ok=True)
    target_public_projects = public_root / "projects"

    # Simple exclusive lock to avoid concurrent pre-build runs which can
    # produce unexpected directory name collisions (e.g. Finder creating
    # "projects 2"). We create a lockfile in `public` using O_EXCL so that
    # other processes will fail fast if a build is already running.
    lockfile = public_root / "projects_build.lock"
    lock_acquired = False
    lock_fd = None

    def acquire_lock():
        nonlocal lock_acquired, lock_fd
        try:
            # os.O_CREAT | os.O_EXCL ensures this fails if the file already exists
            lock_fd = os.open(str(lockfile), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(lock_fd, f"pid={os.getpid()} time={int(time.time())}\n".encode("utf-8"))
            lock_acquired = True
        except OSError as e:
            if e.errno == errno.EEXIST:
                raise SystemExit(f"Another pre-build appears to be running (lockfile exists at {lockfile}). Exiting to avoid race conditions.")
            raise

    def release_lock():
        nonlocal lock_acquired, lock_fd
        try:
            if lock_fd is not None:
                os.close(lock_fd)
            if lock_acquired and lockfile.exists():
                lockfile.unlink()
        except Exception:
            # best-effort cleanup; don't fail the build just because lock removal failed
            pass

    def repair_projects_dir():
        """If there is no `projects` directory but there are siblings like
        `projects 2`, `projects 3`, pick the most recently-modified one and
        rename it to `projects`. This is a manual/explicit repair action and
        will only run when --repair is passed.
        """
        # collect candidates whose name starts with 'projects'
        candidates = []
        for p in public_root.iterdir():
            if not p.is_dir():
                continue
            name = p.name
            # match 'projects' optionally followed by space+digits
            if name == "projects" or (name.startswith("projects ") and name[len("projects "):].strip().isdigit()):
                candidates.append(p)

        # If the canonical folder exists, nothing to repair
        canonical = public_root / "projects"
        if canonical.exists():
            print(f"Canonical folder exists at {canonical}; nothing to repair.")
            return

        if not candidates:
            print("No 'projects' or 'projects N' folders found to repair.")
            return

        # pick the newest candidate by modification time
        chosen = max(candidates, key=lambda p: p.stat().st_mtime)
        backup = public_root / f"projects_backup_before_repair_{int(time.time())}"
        try:
            # rename chosen to canonical name; if canonical exists this will fail
            chosen.rename(canonical)
            print(f"Renamed {chosen} -> {canonical}")
            # After restoring the canonical folder, remove any other numbered
            # siblings (projects 2, projects 3, etc.) to avoid stray folders.
            for p in candidates:
                try:
                    if p.exists() and p != chosen and p != canonical:
                        try:
                            shutil.rmtree(p)
                            print(f"Removed old sibling folder {p}")
                        except Exception:
                            # best-effort: if removal fails, leave it in place
                            print(f"Warning: failed to remove old sibling folder {p}")
                except Exception:
                    pass
        except Exception as e:
            # if rename fails, attempt a safer move: first try to rename canonical to backup
            try:
                if canonical.exists():
                    canonical.rename(backup)
                chosen.rename(canonical)
                print(f"Renamed {chosen} -> {canonical} (backup of previous placed at {backup})")
            except Exception as e2:
                raise SystemExit(f"Failed to repair projects folder: {e} then {e2}")

    def delete_old_backups():
        """Remove leftover backup directories created by previous runs.

        Only removes directories whose names start with 'projects_backup' or
        'projects_backup_before_repair_' inside the `public` directory. This
        helps avoid accumulating many backups over time. This is best-effort
        and will log warnings to `pre-build.log` on failures.
        """
        try:
            for p in public_root.iterdir():
                if not p.is_dir():
                    continue
                name = p.name
                if name.startswith("projects_backup") or name.startswith("projects_backup_before_repair_"):
                    # Don't attempt to remove the canonical live folder
                    if name == "projects":
                        continue
                    try:
                        shutil.rmtree(p)
                        append_log(f"CLEANUP: removed old backup {p}")
                        print(f"Removed old backup {p}")
                    except Exception as e:
                        append_log(f"WARNING: failed to remove old backup {p}: {e}")
                        print(f"Warning: failed to remove old backup {p}: {e}")
        except Exception:
            # best-effort only; don't raise
            pass

    def remove_projects_siblings():
        """Remove any sibling folders in `public` whose name starts with
        'projects' but are not the canonical 'projects' folder. This is a
        best-effort cleanup to remove folders like 'projects 2' that may be
        created by external processes shortly after a build completes.
        """
        try:
            for p in public_root.iterdir():
                if not p.is_dir():
                    continue
                name = p.name
                if name == "projects":
                    continue
                if name.startswith("projects"):
                    try:
                        shutil.rmtree(p)
                        append_log(f"CLEANUP: removed stray projects sibling {p}")
                        print(f"Removed stray projects sibling {p}")
                    except Exception as e:
                        append_log(f"WARNING: failed to remove stray projects sibling {p}: {e}")
                        print(f"Warning: failed to remove stray projects sibling {p}: {e}")
        except Exception:
            # best-effort only
            pass
    
    def verify_and_repair_post_build():
        """Verify that 'public/projects' exists and repair if it was renamed.
        
        Cloud sync services (iCloud, Dropbox, OneDrive) sometimes rename the
        projects folder to 'projects 2' during the build process. This function
        detects that situation and restores the canonical name.
        """
        canonical = public_root / "projects"
        
        # If canonical exists, we're good
        if canonical.exists():
            return True
        
        # Find any 'projects N' siblings
        candidates = []
        for p in public_root.iterdir():
            if not p.is_dir():
                continue
            name = p.name
            if name.startswith("projects") and name != "projects":
                candidates.append(p)
        
        if not candidates:
            print("⚠️  WARNING: No 'projects' folder found after build!")
            return False
        
        # Pick the most recently modified one (likely the one we just built)
        chosen = max(candidates, key=lambda p: p.stat().st_mtime)
        
        try:
            print(f"⚠️  Detected cloud sync renamed folder: {chosen.name} → projects")
            print(f"   This is likely due to iCloud/Dropbox/OneDrive syncing.")
            chosen.rename(canonical)
            print(f"✓ Repaired: restored canonical 'projects' folder")
            
            # Remove any other siblings
            for p in candidates:
                if p != chosen and p.exists():
                    try:
                        shutil.rmtree(p)
                        print(f"✓ Removed duplicate: {p.name}")
                    except Exception:
                        pass
            
            return True
        except Exception as e:
            print(f"⚠️  Failed to repair projects folder: {e}")
            return False

    # If user asked for repair only, run repair and exit
    if args.repair:
        repair_projects_dir()
        return

    # If the canonical `public/projects` folder is missing but there are
    # siblings like `projects 2`/`projects 3`, attempt an automatic repair
    # to restore the most-recent one to `projects`. This mirrors the
    # behavior in the temp_prebuild workflow to avoid creating additional
    # `projects N` folders.
    try:
        if not target_public_projects.exists():
            repair_projects_dir()
    except Exception:
        # Best-effort: if repair fails, continue and let later steps handle it.
        pass

    # Acquire build lock before mutating public/projects
    acquire_lock()

    # If a canonical projects folder exists, rename it to a backup immediately
    # so we can build the new folder without interfering with the live one.
    # We record `backup_path` so we can restore it on failure or delete it
    # after a successful build.
    try:
        if target_public_projects.exists():
            # Prefer the simpler approach used in temp_prebuild: remove the
            # existing `public/projects` directory so we can create the new
            # one cleanly. If removal fails (permissions, locked files),
            # fall back to renaming to a backup so we can still build.
            backup_path = None
            try:
                shutil.rmtree(target_public_projects)
                print(f"Removed existing {target_public_projects} before building new projects")
            except Exception as e_rm:
                # Removal failed; attempt to rename to a backup instead
                backup_path = public_root / f"projects_backup_{int(time.time())}_{os.getpid()}"
                try:
                    target_public_projects.rename(backup_path)
                    print(f"Renamed existing {target_public_projects} -> {backup_path} before building new projects")
                except Exception as e_rename:
                    # If both removal and rename fail, abort and release lock.
                    try:
                        release_lock()
                    except Exception:
                        pass
                    raise SystemExit(f"Failed to prepare existing projects folder for rebuild: remove_error={e_rm} rename_error={e_rename}")
    except Exception as e:
        # Unexpected error preparing backup; release lock and exit.
        try:
            release_lock()
        except Exception:
            pass
        raise

    # Create a temp directory sibling to `projects`, e.g. public/projects_tmp_xxx
    tmp_dir_path = Path(tempfile.mkdtemp(prefix="projects_tmp_", dir=str(public_root)))
    temp_public_projects_root = tmp_dir_path

    copied = []
    skipped = []
    all_projects: list[dict] = []
    missing_thumbnail_projects: list[str] = []
    missing_summary_projects: list[str] = []
    backup_path = None
    
    # Map folio file URLs to project IDs for resolving folio type resources
    folio_url_to_id: Dict[str, str] = {}

    def collect_folio_files(d: Path):
        """Recursively find .folio files and .folio package directories.
        Yields either the `.folio` file path (legacy single-file documents) or the
        `content.json`/`contents.json` file inside a `.folio` directory package.

        Results are deduplicated and yielded in sorted order by path.
        """
        # Directories to ignore while scanning
        IGNORE_DIRS = {
            "node_modules",
            ".git",
            "__pycache__",
            "venv",
            "env",
            "dist",
            "build",
            ".next",
            "public",
        }

        def is_in_ignored_path(p: Path) -> bool:
            # return True if any ancestor directory (or the path itself) should be ignored
            for ancestor in [p, *p.parents]:
                name = ancestor.name
                if not name:
                    continue
                if name.startswith("."):
                    return True
                if name in IGNORE_DIRS:
                    return True
            return False

        seen = set()
        matches: list[Path] = []

        # Search for .folio matches (files or directories). Use case-insensitive
        # matching for both the .folio suffix and the internal content filename
        CONTENT_NAMES = {"content.json", "contents.json"}
        for p in d.rglob("*"):
            name_lower = p.name.lower()
            if not name_lower.endswith(".folio"):
                continue

            # If the match is within an ignored path (including itself), skip it
            if is_in_ignored_path(p):
                continue

            # If it's a regular file, keep it (legacy single-file document)
            if p.is_file():
                matches.append(p)
                continue

            # If it's a directory package, look for content.json / contents.json inside
            if p.is_dir():
                found_candidate = None
                for child in p.iterdir():
                    if not child.is_file():
                        continue
                    if child.name.lower() in CONTENT_NAMES:
                        found_candidate = child
                        break

                if found_candidate:
                    # Make sure the package itself isn't in an ignored path
                    if is_in_ignored_path(found_candidate.parent):
                        continue
                    matches.append(found_candidate)
                # If no content file found, skip this package
                continue

        # sort by path string to keep order deterministic
        for p in sorted(matches, key=lambda x: str(x)):
            if p in seen:
                continue
            seen.add(p)
            yield p

    # Gather candidates and print debugging information about what was found.
    candidates = list(collect_folio_files(root))
    print(f"\n🔍 Found {len(candidates)} .folio candidates")
    logger.info(f"Found {len(candidates)} .folio candidates:")
    for c in candidates:
        kind = "package content" if c.name.lower() in {"content.json", "contents.json"} else "legacy file"
        logger.info(f" - {c} ({kind})")

    for idx, folio_path in enumerate(candidates, 1):
        print(f"\r📦 Processing {idx}/{len(candidates)}...", end='', flush=True)
        logger.info(f"\n--- Processing candidate: {folio_path} ---")
        proj_dir = folio_path.parent
        try:
            raw = folio_path.read_text(encoding="utf-8")
            # Show a short raw preview to help debugging (first 1k chars)
            preview = raw[:1000].replace('\n', '\\n')
            logger.info(f"Raw preview (first 1k chars): {preview}{'...' if len(raw) > 1000 else ''}")
            try:
                parsed = json.loads(raw)
            except Exception as parse_exc:
                logger.error(f"Failed to parse JSON for {folio_path}: {parse_exc}")
                skipped.append((str(folio_path), f"error: json parse failed: {parse_exc}"))
                continue
            # If file contains an array, process each object; otherwise treat as single object
            objs = parsed if isinstance(parsed, list) else [parsed]
            acted_any = False
            for obj in objs:
                if not isinstance(obj, dict):
                    continue
                # Print top-level keys for visibility into contents
                try:
                    keys = list(obj.keys())
                except Exception:
                    keys = []
                logger.info(f"  Object keys: {keys}")
                logger.info(f"  id/title/visibility/isPublic: id={obj.get('id')} title={obj.get('title')} visibility={obj.get('visibility')} isPublic={obj.get('isPublic')}")
                
                # Ensure id exists early so we can use it for mapping
                if not obj.get("id"):
                    obj["id"] = slugify(obj.get("title") or proj_dir.name)
                
                # Map folio file URL to project ID (before checking isPublic)
                # This ensures we can detect folio references even if they're private
                project_id = obj.get('id')
                file_path = obj.get('filePath')
                if project_id and file_path:
                    # Store the mapping using just the project ID (not folder name)
                    # Routes use /projects/{id}, not /projects/{slug}_{id}
                    folio_url_to_id[file_path] = project_id
                    logger.info(f"  Mapped folio URL '{file_path}' -> project ID '{project_id}'")

                # Inclusion rules: skip if isPublic is False
                if "isPublic" in obj and obj.get("isPublic") is False:
                    reason = f"skipped id={obj.get('id') or obj.get('title')} isPublic=false"
                    logger.info(f"  SKIP: {reason}")
                    skipped.append((str(folio_path), reason))
                    continue
                    
                # Skip if visibility exists and is not public
                if "visibility" in obj and obj.get("visibility") != "public":
                    reason = f"skipped id={obj.get('id') or obj.get('title')} visibility={obj.get('visibility')}"
                    logger.info(f"  SKIP: {reason}")
                    skipped.append((str(folio_path), reason))
                    continue
                
                # Map title -> name for output
                if "title" in obj and "name" not in obj:
                    obj["name"] = obj["title"]
                
                # Ensure domain exists, add "Unknown Domain" if missing
                if not obj.get("domain"):
                    obj["domain"] = "Unknown Domain"

                # Determine a base directory for resolving relative asset paths.
                # New `content.json` files often include an `assetsFolder.path` or
                # a `filePath` that points to the package root. Prefer an
                # explicit assetsFolder.path when present, otherwise fall back
                # to the folio package directory (`proj_dir`). Store this as
                # an internal `_base_dir` Path on the object so copy helpers
                # can use it.
                base_dir = proj_dir
                try:
                    assets_val = None
                    if isinstance(obj.get("assetsFolder"), dict):
                        assets_val = obj["assetsFolder"].get("path")
                    elif isinstance(obj.get("assetsFolder"), str):
                        assets_val = obj.get("assetsFolder")
                    
                    if isinstance(assets_val, str) and assets_val:
                        if assets_val.startswith("file://"):
                            parsed = urlparse(assets_val)
                            assets_path = Path(unquote(parsed.path))
                        else:
                            assets_path = Path(assets_val)
                        
                        if assets_path.exists() and assets_path.is_dir():
                            base_dir = assets_path
                        else:
                            maybe = proj_dir / assets_path
                            if maybe.exists() and maybe.is_dir():
                                base_dir = maybe
                    
                    # Only consider filePath as fallback if assetsFolder wasn't found
                    # (Don't let filePath override an explicit assetsFolder.path)
                    if base_dir == proj_dir:
                        fp = obj.get("filePath")
                        if isinstance(fp, str) and fp.startswith("file://"):
                            try:
                                fp_parsed = urlparse(fp)
                                fp_path = Path(unquote(fp_parsed.path))
                                if fp_path.exists() and fp_path.is_dir():
                                    base_dir = fp_path
                            except Exception:
                                pass
                except Exception:
                    base_dir = proj_dir

                obj["_base_dir"] = base_dir

                # Handle thumbnail - new format: { "id": "...", "path": "..." }
                thumb_obj = obj.get("images", {}).get("thumbnail") if isinstance(obj.get("images"), dict) else None
                thumb_copied = False
                
                if isinstance(thumb_obj, dict):
                    thumb_path = thumb_obj.get("path")
                    if thumb_path:
                        path_obj = Path(str(thumb_path))
                        
                        # Handle both absolute and relative paths using assetsFolder base
                        if path_obj.is_absolute():
                            src = path_obj
                        else:
                            src = base_dir / path_obj
                        
                        if src.exists() and src.is_file():
                            # Create a temporary object with title, id, and thumbnail for copy function
                            temp_obj = {"id": obj["id"], "title": obj.get("title", ""), "thumbnail": src.name, "_base_dir": base_dir}
                            dest = copy_thumbnail_for_project(proj_dir, temp_obj, temp_public_projects_root)
                            if dest:
                                copied.append(str(dest))
                                # Update the main object's thumbnail to just the filename
                                if "images" not in obj:
                                    obj["images"] = {}
                                obj["images"]["thumbnail"] = src.name
                                thumb_copied = True
                elif isinstance(thumb_obj, str):
                    thumb_path = thumb_obj
                    path_obj = Path(str(thumb_path))
                    if path_obj.is_absolute():
                        src = path_obj
                    else:
                        src = base_dir / path_obj
                    if src.exists() and src.is_file():
                        temp_obj = {"id": obj["id"], "title": obj.get("title", ""), "thumbnail": src.name, "_base_dir": base_dir}
                        dest = copy_thumbnail_for_project(proj_dir, temp_obj, temp_public_projects_root)
                        if dest:
                            copied.append(str(dest))
                            if "images" not in obj:
                                obj["images"] = {}
                            obj["images"]["thumbnail"] = src.name
                            thumb_copied = True
                
                # If no thumbnail found in new structure, try finding thumbnail.* file
                if not thumb_copied:
                    found = None
                    for p in proj_dir.iterdir():
                        if p.is_file() and p.stem.lower() == "thumbnail" and p.suffix.lower() in IMAGE_EXTS:
                            found = p
                            break
                    if found:
                        temp_obj = {"id": obj["id"], "title": obj.get("title", ""), "thumbnail": found.name}
                        dest = copy_thumbnail_for_project(proj_dir, temp_obj, temp_public_projects_root)
                        if dest:
                            copied.append(str(dest))
                            if "images" not in obj:
                                obj["images"] = {}
                            obj["images"]["thumbnail"] = found.name
                            thumb_copied = True
                    else:
                        # Record missing thumbnail
                        missing_thumbnail_projects.append(str(obj.get("id") or obj.get("title") or folio_path))
                
                # Copy other images
                img_copied = copy_images_for_project(proj_dir, obj, temp_public_projects_root)
                if img_copied:
                    copied.extend(img_copied)
                
                # Copy local-download resources and update their urls
                res_copied = copy_resources_for_project(proj_dir, obj, temp_public_projects_root)
                if res_copied:
                    copied.extend(res_copied)
                
                # Copy collection items if this project contains a collection
                col_copied = copy_collection_for_project(proj_dir, obj, temp_public_projects_root)
                if col_copied:
                    copied.extend(col_copied)

                # Add folderName to the project so components know which folder to look in
                folder_name = make_project_folder_name(obj.get("title", ""), obj["id"])
                obj["folderName"] = folder_name

                # Finally, include the project object in the aggregated list
                all_projects.append(obj)
                
                # Record summary-missing projects
                try:
                    summary_val = obj.get("summary")
                    if not (isinstance(summary_val, str) and summary_val.strip()):
                        missing_summary_projects.append(str(obj.get("id") or obj.get("title") or folio_path))
                except Exception:
                    pass
                    
                acted_any = True
                
            if not acted_any:
                reason = "no valid project objects found"
                logger.info(f"  SKIP: {reason} for {folio_path}")
                skipped.append((str(folio_path), reason))
        except Exception as e:
            logger.error(f"Error processing {folio_path}: {e}")
            skipped.append((str(folio_path), f"error:{e}"))

    print(f"\r✅ Processed {len(candidates)} projects                    ")
    logger.info(f"\nProcessed {len(candidates)} candidates")
    
    # Resolve folio type resources before writing JSON
    print("\n🔗 Resolving folio resource links...")
    logger.info(f"Resolving folio resources with {len(folio_url_to_id)} known folio URLs")
    all_projects = resolve_folio_resources(all_projects, folio_url_to_id)
    
    # Interactive featured project ordering prompt
    featured_projects = [p for p in all_projects if p.get("featured")]
    if featured_projects:
        print("\n⭐ Featured Projects Ordering")
        print("━" * 60)
        print("The following projects are marked as featured:")
        for idx, proj in enumerate(featured_projects, 1):
            title = proj.get("title", "Untitled")
            proj_id = proj.get("id", "No ID")
            print(f"  {idx}. {title}")
            print(f"     ID: {proj_id}")
        
        print("\n" + "━" * 60)
        print("Enter the order you want these featured projects to appear")
        print("as comma-separated numbers (e.g., '1,3,2' or '2,1,3').")
        print("Press Enter to skip and keep current order.")
        print("━" * 60)
        
        try:
            user_input = input("Order: ").strip()
            
            if user_input:
                # Parse the input
                order_indices = [int(x.strip()) for x in user_input.split(",")]
                
                # Validate indices
                valid = True
                for idx in order_indices:
                    if idx < 1 or idx > len(featured_projects):
                        print(f"❌ Error: Index {idx} is out of range (1-{len(featured_projects)})")
                        valid = False
                        break
                
                if valid and len(set(order_indices)) == len(order_indices):
                    # Apply the ordering
                    for position, original_idx in enumerate(order_indices, 1):
                        project = featured_projects[original_idx - 1]
                        project["featuredOrder"] = position
                    
                    # For any featured projects not in the list, don't assign order
                    ordered_ids = {featured_projects[i - 1].get("id") for i in order_indices}
                    for proj in featured_projects:
                        if proj.get("id") not in ordered_ids:
                            # Remove featuredOrder if it exists
                            proj.pop("featuredOrder", None)
                    
                    print(f"✅ Applied custom order to {len(order_indices)} featured projects")
                elif not valid:
                    print("⚠️  Invalid input. Keeping current order.")
                else:
                    print("❌ Error: Duplicate indices found. Keeping current order.")
            else:
                print("⏭️  Skipped ordering. Featured projects will use current order.")
        except ValueError:
            print("❌ Error: Invalid input format. Keeping current order.")
        except KeyboardInterrupt:
            print("\n⚠️  Interrupted. Keeping current order.")
        except EOFError:
            # Handle non-interactive mode (CI/CD, etc.)
            print("⏭️  Non-interactive mode detected. Skipping ordering.")
    
    # Extract all external image hostnames from projects
    external_hostnames = extract_external_image_hostnames(all_projects)
    
    # Write external hostnames config for Next.js
    hostnames_config_path = public_root / "image-hostnames.json"
    try:
        hostnames_config_path.write_text(
            json.dumps({"hostnames": sorted(list(external_hostnames))}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8"
        )
        logger.info(f"Wrote {len(external_hostnames)} external image hostnames to {hostnames_config_path}")
        if external_hostnames:
            logger.info("External image hostnames found:")
            for hostname in sorted(external_hostnames):
                logger.info(f"  - {hostname}")
    except Exception as e:
        logger.warning(f"Warning: Failed to write image hostnames config: {e}")
    
    # Write aggregated projects.json into the temp dir
    output_path = temp_public_projects_root / "projects.json"

    try:
        # Sanitize projects to ensure JSON serializability (convert Paths,
        # remove internal keys like `_base_dir`, etc.)
        serializable_projects = [_sanitize_for_json(p, is_project_root=True) for p in all_projects]
        output_path.write_text(json.dumps(serializable_projects, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"📄 Wrote {len(all_projects)} projects to projects.json")
        logger.info(f"Wrote {len(all_projects)} projects to {output_path}")

        # prepare a simple log file in public to record build outcome/errors
        legacy_log_file = public_root / "pre-build.log"
        def append_log(line: str):
            try:
                with open(str(legacy_log_file), "a", encoding="utf-8") as fh:
                    fh.write(f"{int(time.time())}: {line}\n")
            except Exception:
                pass

        # Successfully finished building into temp dir. Now atomically replace
        # the existing `public/projects` directory. We remove the old one first
        # to ensure a clean rename.
        try:
            # Try to remove the existing `public/projects` directory first to avoid
            # accumulating duplicate files. If removal fails (permissions, locked
            # files, etc.) fall back to renaming the folder to a backup name so we
            # can still roll back on failure.
            backup_path = None
            if target_public_projects.exists():
                try:
                    shutil.rmtree(target_public_projects)
                    logger.info(f"Removed existing {target_public_projects} to avoid duplicates.")
                except Exception as e_rm:
                    # Removal failed; fall back to renaming to a backup so we can
                    # restore if the subsequent rename fails.
                    backup_path = public_root / f"projects_backup_{int(time.time())}"
                    try:
                        target_public_projects.rename(backup_path)
                        logger.info(f"Renamed existing {target_public_projects} to backup {backup_path}")
                    except Exception as e_rename:
                        # If both removal and rename fail, raise to trigger the
                        # outer exception handling and avoid leaving the temp dir in an
                        # inconsistent state.
                        raise RuntimeError(f"Failed to remove or rename existing projects dir: remove_error={e_rm}, rename_error={e_rename}")

            # Move temp into place
            try:
                # Move temp into place. Prefer rename for atomicity when possible.
                try:
                    temp_public_projects_root.rename(target_public_projects)
                except Exception:
                    # Fallback to os.replace which may succeed when rename fails.
                    os.replace(str(temp_public_projects_root), str(target_public_projects))

                print(f"✅ Build complete - {len(all_projects)} projects published")
                logger.info(f"Replaced {target_public_projects} with {temp_public_projects_root}")
                append_log(f"SUCCESS: replaced projects with new build; wrote {len(all_projects)} projects")

                # If we created a backup earlier, attempt to remove it now that the
                # new folder is in place.
                if backup_path and backup_path.exists():
                    try:
                        shutil.rmtree(backup_path)
                        logger.info(f"Removed backup at {backup_path}")
                    except Exception:
                        append_log(f"WARNING: failed to remove backup at {backup_path}; left in place")
                        logger.warning(f"Warning: failed to remove backup at {backup_path}; leaving it in place.")
                # Remove any older backup directories left from previous runs
                try:
                    delete_old_backups()
                except Exception:
                    # best-effort only
                    pass
                # Additional cleanup: some external process may create
                # 'projects 2'/'projects 3' shortly after we finish. Run a
                # small loop to remove stray 'projects*' siblings created
                # after the replace. This is best-effort; don't fail the
                # build if cleanup cannot remove them.
                try:
                    for _ in range(3):
                        time.sleep(0.5)
                        remove_projects_siblings()
                except Exception:
                    pass
                
                # Final verification: check that 'projects' still exists after a short delay
                # Cloud sync services may rename the folder during/after the build
                try:
                    logger.info("\n⏳ Waiting for cloud sync to settle...")
                    time.sleep(2)  # Give cloud sync time to finish
                    if not verify_and_repair_post_build():
                        logger.warning("⚠️  WARNING: Could not verify projects folder after build!")
                        append_log("WARNING: projects folder verification failed")
                except Exception as e:
                    logger.warning(f"⚠️  Post-build verification error: {e}")
                    append_log(f"WARNING: post-build verification error: {e}")
            except Exception as replace_exc:
                err_msg = f"Failed to replace {target_public_projects} with temp build: {replace_exc}"
                logger.error(err_msg)
                append_log(f"ERROR: {err_msg}")
                # Attempt to roll back: if we created a backup and the target doesn't exist,
                # try restoring the backup back to the original target path.
                try:
                    if backup_path and backup_path.exists() and not target_public_projects.exists():
                        backup_path.rename(target_public_projects)
                        append_log(f"RESTORE: restored original projects folder from {backup_path}")
                        logger.info(f"Restored original projects folder from backup: {backup_path} -> {target_public_projects}")
                except Exception as e2:
                    append_log(f"ERROR: failed to restore original projects folder from backup: {e2}")
                    print(f"Failed to restore original projects folder from backup: {e2}")

                # Cleanup temp dir if it still exists (partial build)
                try:
                    if temp_public_projects_root.exists():
                        shutil.rmtree(temp_public_projects_root)
                        append_log(f"CLEANUP: removed partial temp build at {temp_public_projects_root}")
                except Exception:
                    pass
                # Reraise to allow outer handlers to proceed to finally block
                raise
        except Exception as e:
            print(f"Failed to replace {target_public_projects} with temp build: {e}")
            # Attempt to roll back: if we created a backup and the target doesn't exist,
            # try restoring the backup back to the original target path.
            try:
                if 'backup_path' in locals() and backup_path and backup_path.exists() and not target_public_projects.exists():
                    backup_path.rename(target_public_projects)
                    logger.info(f"Restored original projects folder from backup: {backup_path} -> {target_public_projects}")
            except Exception as e2:
                logger.error(f"Failed to restore original projects folder from backup: {e2}")
            logger.info(f"Temp build left at: {temp_public_projects_root}")

    except Exception as e:
        logger.error(f"Failed to write projects.json into temp dir: {e}")
        print(f"❌ Build failed: {e}")
        # Clean up temp dir to avoid clutter, but preserve original target
        try:
            if temp_public_projects_root.exists():
                shutil.rmtree(temp_public_projects_root)
        except Exception:
            pass

    finally:
        # Always release the build lock if we acquired it
        try:
            release_lock()
        except Exception:
            pass

    # Also print readable lists for convenience
    if missing_thumbnail_projects:
        print("\n⚠️  Projects missing thumbnails:")
        logger.info("Projects added to projects.json missing a thumbnail:")
        for p in missing_thumbnail_projects:
            print(f" - {p}")
            logger.info(f" - {p}")
    else:
        logger.info("All included projects have thumbnails.")
    if missing_summary_projects:
        print("\n⚠️  Projects missing summaries:")
        logger.info("\nProjects added to projects.json missing a summary:")
        for p in missing_summary_projects:
            print(f" - {p}")
            logger.info(f" - {p}")
    else:
        logger.info("All included projects have summaries.")
    
    print(f"\n📋 Full build log: {log_file}")


if __name__ == "__main__":
    print("🚀 Running folio pre-build script")
    logger.info("Starting folio pre-build script")
    main()