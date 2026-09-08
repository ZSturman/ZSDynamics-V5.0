#!/usr/bin/env python3
"""
Media optimization utilities for portfolio projects.

This module provides functions to:
- Compress and optimize images (JPEG, PNG, WebP conversion)
- Compress and convert videos to web-optimized formats
- Generate responsive image variants (thumbnail, medium, large)
- Create video thumbnails and previews
- Generate blur placeholders for lazy loading

Optimized files are placed alongside originals with suffixes like:
- image.jpg -> image-optimized.webp, image-thumb.webp, image-placeholder.jpg
- video.mp4 -> video-optimized.mp4, video-thumb.jpg

Dependencies:
- Pillow (PIL) for image processing
- ffmpeg (via system command) for video processing
"""

import hashlib
import os
import re
import sys
import subprocess
from pathlib import Path
from typing import Any, Optional, Tuple, Dict, List
import json
import shutil

try:
    from PIL import Image
    import PIL.ImageFilter
except ImportError:
    print("Error: Pillow is required. Install with: pip3 install Pillow", file=sys.stderr)
    sys.exit(1)

# Configuration
IMAGE_QUALITY = {
    "webp": 85,      # WebP quality (0-100)
    "jpeg": 85,      # JPEG quality (0-100)
    "png": 6,        # PNG compression level (0-9)
}

IMAGE_SIZES = {
    "thumbnail": 400,    # Max dimension for thumbnails
    "medium": 1200,      # Max dimension for medium size
    "large": 2400,       # Max dimension for large/original
}

VIDEO_QUALITY = {
    "crf": 28,           # Constant Rate Factor (18-28 is good, lower = better quality)
    "max_dimension": 1920,  # Max width or height
    "max_bitrate": "2M",    # Maximum bitrate
}
VIDEO_PREVIEW_FRAME_COUNT = 6
VIDEO_PREVIEW_INTERVAL_MS = 650
VIDEO_PREVIEW_START_RATIO = 0.12
VIDEO_PREVIEW_END_RATIO = 0.88

PLACEHOLDER_SIZE = 20    # Size of blur placeholder (very small)

# Threshold for using cloud storage (in MB)
CLOUD_STORAGE_THRESHOLD_MB = 5

# ---------------------------------------------------------------------------
# Content-hash cache
# ---------------------------------------------------------------------------
# folio-prebuild.py deletes and rebuilds the entire public/projects tree from
# scratch on every run (see docs/notion-and-storage-architecture.md), so a
# freshly-copied source file is byte-identical to the one optimized on a
# previous run far more often than not — but its *directory* is brand new
# each time. This cache lives outside public/projects (so it survives that
# wipe) and is keyed by the source file's own content hash (not its path or
# mtime, which are not stable across the rebuild), mirroring the sha256-keyed
# manifest pattern lib/r2_uploader.py already uses for R2 uploads. A cache
# miss (new file, changed content, or a missing/corrupt cache entry) always
# falls through to full reprocessing — this is a pure performance
# optimization and never changes what a from-scratch run would produce.
_OPTIMIZER_CACHE_ROOT = Path(__file__).resolve().parent.parent / "tmp" / "media-optimizer-cache"
# Set by main() when --no-media-cache is passed; forces every file through
# full reprocessing without needing to delete the cache directory.
_OPTIMIZER_CACHE_DISABLED = False


def _sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(chunk_size), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _optimizer_cache_dir(content_hash: str, kind: str) -> Path:
    # Namespaced by kind (image/svg/video/3d-model) and sharded by the first
    # two hash characters to avoid an enormous flat directory over time.
    return _OPTIMIZER_CACHE_ROOT / kind / content_hash[:2] / content_hash


# Reset at the start of each batch_optimize_directory() run; read afterward
# to report how much work the cache actually skipped.
_OPTIMIZER_CACHE_STATS = {"hits": 0, "misses": 0}


def _load_from_optimizer_cache(src: Path, output_dir: Path, kind: str) -> Optional[Dict[str, Any]]:
    """Track hit/miss stats around the real cache lookup (_load_from_optimizer_cache_impl)."""
    result = _load_from_optimizer_cache_impl(src, output_dir, kind)
    _OPTIMIZER_CACHE_STATS["hits" if result is not None else "misses"] += 1
    return result


def _load_from_optimizer_cache_impl(src: Path, output_dir: Path, kind: str) -> Optional[Dict[str, Any]]:
    """Return a results dict identical in shape to optimize_*_full()'s return
    value, with every variant file copied into output_dir, if a cache entry
    exists for src's *current* byte content. Returns None on any cache miss
    or corrupt/incomplete entry so the caller transparently falls through to
    full reprocessing.
    """
    if _OPTIMIZER_CACHE_DISABLED:
        return None

    try:
        content_hash = _sha256_file(src)
    except OSError:
        return None

    cache_dir = _optimizer_cache_dir(content_hash, kind)
    manifest_path = cache_dir / "manifest.json"
    if not manifest_path.exists():
        return None

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    stem = src.stem
    results: Dict[str, Any] = dict(manifest.get("scalar_fields", {}))
    results["original"] = src.name

    for variant_key, info in manifest.get("files", {}).items():
        cached_file = cache_dir / info["cached_name"]
        if not cached_file.exists():
            return None
        target_name = f"{stem}{info['suffix']}"
        try:
            shutil.copy2(cached_file, output_dir / target_name)
        except OSError:
            return None
        results[variant_key] = target_name

    preview = manifest.get("preview_frames")
    if preview:
        frame_names = []
        for idx, cached_name in enumerate(preview["cached_names"], 1):
            cached_file = cache_dir / cached_name
            if not cached_file.exists():
                return None
            target_name = f"{stem}{preview['suffix_template'].format(idx=idx)}"
            try:
                shutil.copy2(cached_file, output_dir / target_name)
            except OSError:
                return None
            frame_names.append(target_name)
        results["previewFrames"] = frame_names

    print(f"  [cache] {kind} unchanged, reused cached variants: {src.name}")
    return results


def _save_to_optimizer_cache(src: Path, output_dir: Path, kind: str, results: Dict[str, Any]) -> None:
    """Best-effort: persist this run's freshly generated variants into the
    content-hash cache for future runs. Derives each variant's filename
    *suffix* directly from the actual output filenames (e.g. "-optimized.webp"
    for images, ".glb" for 3D models) rather than hardcoding per-kind naming
    rules, so it stays correct if optimize_*_full()'s naming ever changes.
    Never raises: a caching failure must never fail, or even warn during, an
    otherwise-successful build — it only costs the reprocessing time a full
    run would have cost anyway.
    """
    if results.get("issues"):
        # A partial/failed result (e.g. ffmpeg unavailable at the time) is
        # never cached — it may well be a transient/environmental failure
        # unrelated to this file's content, and caching it would silently
        # keep reproducing that failure on every future run even after the
        # underlying cause is fixed.
        return
    try:
        stem = src.stem
        content_hash = _sha256_file(src)
        cache_dir = _optimizer_cache_dir(content_hash, kind)
        cache_dir.mkdir(parents=True, exist_ok=True)

        manifest: Dict[str, Any] = {"scalar_fields": {}, "files": {}}
        for field in ("useCloudStorage", "issues", "fallbacks", "previewIntervalMs"):
            if field in results:
                manifest["scalar_fields"][field] = results[field]

        for variant_key in ("optimized", "thumbnail", "placeholder"):
            filename = results.get(variant_key)
            if not filename or not filename.startswith(stem):
                continue
            source_file = output_dir / filename
            if not source_file.exists():
                continue
            suffix = filename[len(stem):]
            cached_name = f"{variant_key}{Path(filename).suffix}"
            shutil.copy2(source_file, cache_dir / cached_name)
            manifest["files"][variant_key] = {"suffix": suffix, "cached_name": cached_name}

        preview_frames = results.get("previewFrames") or []
        if preview_frames:
            cached_names = []
            suffix_template = None
            for idx, filename in enumerate(preview_frames, 1):
                if not filename.startswith(stem):
                    continue
                source_file = output_dir / filename
                if not source_file.exists():
                    continue
                suffix = filename[len(stem):]
                if suffix_template is None:
                    # e.g. "-preview-01.jpg" -> "-preview-{idx:02d}.jpg"
                    digits = re.search(r"(\d+)(?=\.\w+$)", suffix)
                    if digits:
                        suffix_template = (
                            suffix[: digits.start()] + f"{{idx:0{len(digits.group(1))}d}}" + suffix[digits.end():]
                        )
                cached_name = f"preview-{idx:02d}{Path(filename).suffix}"
                shutil.copy2(source_file, cache_dir / cached_name)
                cached_names.append(cached_name)
            if cached_names and suffix_template:
                manifest["preview_frames"] = {"suffix_template": suffix_template, "cached_names": cached_names}

        if not manifest["files"] and "preview_frames" not in manifest:
            # Nothing was actually produced (e.g. optimize_3d_model() failed
            # with no dedicated issues/fallbacks tracking to catch it above).
            # Caching an empty result would permanently freeze that outcome
            # even after a transient/environmental cause (a missing tool,
            # say) is fixed, so skip writing a manifest entirely.
            return

        (cache_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    except Exception:
        pass


def check_ffmpeg() -> bool:
    """Check if ffmpeg is available in the system."""
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False
        )
        return True
    except FileNotFoundError:
        return False


def check_obj2gltf() -> bool:
    """Check if obj2gltf is available in the system."""
    try:
        subprocess.run(
            ["obj2gltf", "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False
        )
        return True
    except FileNotFoundError:
        return False


def check_ffprobe() -> bool:
    """Check if ffprobe is available in the system."""
    try:
        subprocess.run(
            ["ffprobe", "-version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False
        )
        return True
    except FileNotFoundError:
        return False


# SVG optimization: just copy and treat as all variants
def optimize_svg_full(src: Path, output_dir: Optional[Path] = None) -> Dict[str, str]:
    """
    Handle SVG assets without rasterizing them.

    SVGs are already resolution-independent and usually small, so we preserve
    the original file instead of attempting Pillow-based optimization.

    Args:
        src: Source SVG path
        output_dir: Directory for output files (default: same as src)

    Returns:
        Dictionary mapping variant names to relative paths.
        SVGs reuse the original asset for optimized/thumbnail variants so
        downstream media resolution can treat them like a valid image asset.
    """
    if output_dir is None:
        output_dir = src.parent

    output_dir.mkdir(parents=True, exist_ok=True)

    cached = _load_from_optimizer_cache(src, output_dir, "svg")
    if cached is not None:
        return cached

    stem = src.stem
    original_path = output_dir / src.name
    optimized_path = output_dir / f"{stem}-optimized.svg"
    thumbnail_path = output_dir / f"{stem}-thumb.svg"

    if src != original_path:
        shutil.copy2(src, original_path)

    if src != optimized_path:
        shutil.copy2(src, optimized_path)

    if src != thumbnail_path:
        shutil.copy2(src, thumbnail_path)

    results = {
        'original': original_path.name,
        'optimized': optimized_path.name,
        'thumbnail': thumbnail_path.name,
        'useCloudStorage': should_use_cloud_storage(original_path)
    }

    _save_to_optimizer_cache(src, output_dir, "svg", results)
    return results


def get_file_size_mb(path: Path) -> float:
    """Get file size in megabytes."""
    return path.stat().st_size / (1024 * 1024)


def should_use_cloud_storage(path: Path) -> bool:
    """Determine if a file should be uploaded to cloud storage based on size."""
    return get_file_size_mb(path) > CLOUD_STORAGE_THRESHOLD_MB


def get_image_dimensions(path: Path) -> Tuple[int, int]:
    """Get image dimensions (width, height)."""
    try:
        with Image.open(path) as img:
            return img.size
    except Exception:
        return (0, 0)


def optimize_image(
    src: Path,
    dest: Path,
    max_dimension: Optional[int] = None,
    quality: int = 85,
    format: str = "webp"
) -> Optional[Path]:
    """
    Optimize an image by resizing and converting to an efficient format.
    
    Args:
        src: Source image path
        dest: Destination path (can be same as src to overwrite)
        max_dimension: Maximum width or height (maintains aspect ratio)
        quality: Quality setting (0-100 for JPEG/WebP, 0-9 for PNG)
        format: Output format ('webp', 'jpeg', 'png')
    
    Returns:
        Path to optimized image, or None on failure
    """
    try:
        with Image.open(src) as img:
            # Preserve original mode for format checking
            original_mode = img.mode
            has_transparency = original_mode in ('RGBA', 'LA', 'P')
            
            # For PNG output, preserve alpha channel
            if format.lower() == 'png':
                # Convert palette images to RGBA if they have transparency
                if img.mode == 'P':
                    if 'transparency' in img.info:
                        img = img.convert('RGBA')
                    else:
                        img = img.convert('RGB')
                # Keep RGBA and LA modes as-is for PNG
                # No conversion needed - PNG supports transparency
            # For WebP, preserve alpha if possible
            elif format.lower() == 'webp':
                # WebP supports alpha, so convert appropriately
                if img.mode == 'P':
                    img = img.convert('RGBA')
                elif img.mode == 'LA':
                    img = img.convert('RGBA')
                # Keep RGBA for webp, it supports transparency
            # For JPEG, must convert to RGB (no alpha support)
            elif format.lower() == 'jpeg':
                if has_transparency:
                    # Create white background for transparent images
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    if img.mode in ('RGBA', 'LA'):
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'RGBA':
                            background.paste(img, mask=img.split()[3])
                        else:
                            background.paste(img, mask=img.split()[1])
                        img = background
                    else:
                        img = img.convert('RGB')
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
            
            # Resize if needed
            if max_dimension:
                img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            
            # Save with optimization
            save_kwargs = {}
            if format.lower() == 'webp':
                save_kwargs = {'quality': quality, 'method': 6}
                # Ensure lossless alpha for webp if image has transparency
                if img.mode in ('RGBA', 'LA'):
                    save_kwargs['lossless'] = False  # Still use lossy but preserve alpha
            elif format.lower() == 'jpeg':
                save_kwargs = {'quality': quality, 'optimize': True}
            elif format.lower() == 'png':
                save_kwargs = {'optimize': True, 'compress_level': quality}
            
            img.save(dest, format=format.upper(), **save_kwargs)
            return dest
    except Exception as e:
        print(f"Error optimizing image {src}: {e}", file=sys.stderr)
        return None


def optimize_animated_gif(
    src: Path,
    dest: Path,
    max_dimension: Optional[int] = None,
    quality: int = 85
) -> Optional[Path]:
    """
    Optimize an animated GIF by converting to animated WebP.
    
    Args:
        src: Source GIF path
        dest: Destination WebP path
        max_dimension: Maximum width or height (maintains aspect ratio)
        quality: Quality setting (0-100)
    
    Returns:
        Path to optimized animated WebP, or None on failure
    """
    try:
        with Image.open(src) as img:
            # Check if it's actually animated
            is_animated = getattr(img, 'is_animated', False)
            
            if not is_animated:
                # If not animated, use regular optimization
                return optimize_image(src, dest, max_dimension, quality, 'webp')
            
            # Process all frames
            frames = []
            durations = []
            
            try:
                for frame_num in range(img.n_frames):
                    img.seek(frame_num)
                    
                    # Convert frame to RGBA
                    frame = img.convert('RGBA')
                    
                    # Resize if needed
                    if max_dimension:
                        frame.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                    
                    frames.append(frame.copy())
                    
                    # Get frame duration (in milliseconds)
                    duration = img.info.get('duration', 100)
                    durations.append(duration)
            except EOFError:
                pass  # End of frames
            
            if not frames:
                return None
            
            # Save as animated WebP
            frames[0].save(
                dest,
                format='WEBP',
                save_all=True,
                append_images=frames[1:],
                duration=durations,
                loop=img.info.get('loop', 0),
                quality=quality,
                method=6
            )
            
            return dest
    except Exception as e:
        print(f"Error optimizing animated GIF {src}: {e}", file=sys.stderr)
        return None


def generate_blur_placeholder(src: Path, dest: Path, size: int = PLACEHOLDER_SIZE) -> Optional[Path]:
    """
    Generate a tiny blurred placeholder image for lazy loading.
    
    Args:
        src: Source image path
        dest: Destination path for placeholder
        size: Maximum dimension of placeholder (default: 20px)
    
    Returns:
        Path to placeholder image, or None on failure
    """
    try:
        with Image.open(src) as img:
            # For animated images, use first frame
            if getattr(img, 'is_animated', False):
                img.seek(0)
            
            # Convert to RGB
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Create tiny thumbnail
            img.thumbnail((size, size), Image.Resampling.LANCZOS)
            
            # Apply blur
            img = img.filter(PIL.ImageFilter.GaussianBlur(radius=2))
            
            # Save as very low quality JPEG
            img.save(dest, 'JPEG', quality=20, optimize=True)
            return dest
    except Exception as e:
        print(f"Error generating placeholder for {src}: {e}", file=sys.stderr)
        return None


def optimize_image_full(src: Path, output_dir: Optional[Path] = None) -> Dict[str, str]:
    """
    Generate all optimized variants of an image.
    
    Creates:
    - WebP versions at multiple sizes
    - Blur placeholder
    - Preserves original
    
    Args:
        src: Source image path
        output_dir: Directory for optimized images (default: same as src)
    
    Returns:
        Dictionary mapping variant names to relative paths:
        {
            'original': 'image.jpg',
            'optimized': 'image-optimized.webp',
            'thumbnail': 'image-thumb.webp',
            'placeholder': 'image-placeholder.jpg',
            'useCloudStorage': True/False
        }
    """
    if output_dir is None:
        output_dir = src.parent
    
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = src.stem
    is_gif = src.suffix.lower() == '.gif'
    if src.suffix.lower() == '.svg':
        return optimize_svg_full(src, output_dir)

    cached = _load_from_optimizer_cache(src, output_dir, "image")
    if cached is not None:
        return cached

    results = {
        'original': src.name,
        'useCloudStorage': should_use_cloud_storage(src)
    }
    
    # Generate optimized full-size WebP (use animated GIF handler for GIFs)
    optimized_path = output_dir / f"{stem}-optimized.webp"
    if is_gif:
        if optimize_animated_gif(src, optimized_path, max_dimension=IMAGE_SIZES['large'], 
                                quality=IMAGE_QUALITY['webp']):
            results['optimized'] = optimized_path.name
    else:
        if optimize_image(src, optimized_path, max_dimension=IMAGE_SIZES['large'], 
                         quality=IMAGE_QUALITY['webp'], format='webp'):
            results['optimized'] = optimized_path.name
    
    # Generate thumbnail (use animated GIF handler for GIFs)
    thumb_path = output_dir / f"{stem}-thumb.webp"
    if is_gif:
        if optimize_animated_gif(src, thumb_path, max_dimension=IMAGE_SIZES['thumbnail'],
                                quality=IMAGE_QUALITY['webp']):
            results['thumbnail'] = thumb_path.name
    else:
        if optimize_image(src, thumb_path, max_dimension=IMAGE_SIZES['thumbnail'],
                         quality=IMAGE_QUALITY['webp'], format='webp'):
            results['thumbnail'] = thumb_path.name
    
    # Generate blur placeholder
    placeholder_path = output_dir / f"{stem}-placeholder.jpg"
    if generate_blur_placeholder(src, placeholder_path):
        results['placeholder'] = placeholder_path.name

    _save_to_optimizer_cache(src, output_dir, "image", results)
    return results


def optimize_video(
    src: Path,
    dest: Path,
    max_dimension: int = VIDEO_QUALITY['max_dimension'],
    crf: int = VIDEO_QUALITY['crf']
) -> Optional[Path]:
    """
    Optimize a video using ffmpeg.
    
    Args:
        src: Source video path
        dest: Destination path
        max_dimension: Maximum width or height
        crf: Constant Rate Factor (18-28, lower = better quality)
    
    Returns:
        Path to optimized video, or None on failure
    """
    if not check_ffmpeg():
        print("Warning: ffmpeg not found. Video optimization skipped.", file=sys.stderr)
        return None
    
    try:
        # Build ffmpeg command
        # Scale to max dimension while maintaining aspect ratio
        scale_filter = f"scale='min({max_dimension},iw)':'min({max_dimension},ih)':force_original_aspect_ratio=decrease"
        
        cmd = [
            'ffmpeg',
            '-i', str(src),
            '-c:v', 'libx264',  # H.264 codec (widely supported)
            '-crf', str(crf),
            '-preset', 'medium',
            '-vf', scale_filter,
            '-c:a', 'aac',      # AAC audio codec
            '-b:a', '128k',     # Audio bitrate
            '-movflags', '+faststart',  # Enable streaming
            '-y',               # Overwrite output
            str(dest)
        ]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False
        )
        
        if result.returncode == 0 and dest.exists():
            return dest
        else:
            print(f"Error optimizing video {src}: {result.stderr.decode()}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Error optimizing video {src}: {e}", file=sys.stderr)
        return None


def generate_video_thumbnail(src: Path, dest: Path, time_offset: str = "00:00:01") -> Optional[Path]:
    """
    Generate a thumbnail image from a video.
    
    Args:
        src: Source video path
        dest: Destination image path
        time_offset: Time offset to extract frame (format: HH:MM:SS)
    
    Returns:
        Path to thumbnail image, or None on failure
    """
    if not check_ffmpeg():
        print("Warning: ffmpeg not found. Video thumbnail skipped.", file=sys.stderr)
        return None
    
    try:
        cmd = [
            'ffmpeg',
            '-ss', time_offset,
            '-i', str(src),
            '-vframes', '1',
            '-q:v', '2',
            '-y',
            str(dest)
        ]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False
        )
        
        if result.returncode == 0 and dest.exists():
            return dest
        else:
            return None
    except Exception as e:
        print(f"Error generating video thumbnail for {src}: {e}", file=sys.stderr)
        return None


def get_video_duration_seconds(src: Path) -> Optional[float]:
    """Return video duration in seconds when ffprobe is available."""
    if not check_ffprobe():
        return None

    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(src),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except Exception:
        return None

    if result.returncode != 0:
        return None

    try:
        return float(result.stdout.decode().strip())
    except Exception:
        return None


def format_ffmpeg_timestamp(seconds: float) -> str:
    """Format seconds as an ffmpeg-compatible timestamp."""
    total_ms = max(0, int(round(seconds * 1000)))
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{milliseconds:03d}"


def generate_video_preview_frames(
    src: Path,
    output_dir: Path,
    *,
    count: int = VIDEO_PREVIEW_FRAME_COUNT,
) -> Tuple[List[Path], Optional[str]]:
    """
    Generate a deterministic sequence of preview frames for a video.

    Returns:
        A tuple of generated frame paths and an optional issue summary.
    """
    if count < 2:
        return [], "preview frame count must be at least 2"

    if not check_ffmpeg():
        return [], "ffmpeg not found"

    duration = get_video_duration_seconds(src)
    if duration and duration > 0:
        start_seconds = min(max(duration * VIDEO_PREVIEW_START_RATIO, 0.25), max(duration - 0.1, 0.25))
        end_seconds = max(start_seconds, duration * VIDEO_PREVIEW_END_RATIO)
        if count == 1:
            offsets = [start_seconds]
        else:
            step = (end_seconds - start_seconds) / max(count - 1, 1)
            offsets = [start_seconds + (step * index) for index in range(count)]
    else:
        offsets = [0.5 + (index * 1.1) for index in range(count)]

    generated: List[Path] = []
    failed_offsets: List[str] = []
    stem = src.stem

    for index, offset in enumerate(offsets, start=1):
        destination = output_dir / f"{stem}-preview-{index:02d}.jpg"
        if generate_video_thumbnail(src, destination, time_offset=format_ffmpeg_timestamp(offset)):
            generated.append(destination)
        else:
            failed_offsets.append(format_ffmpeg_timestamp(offset))

    if len(generated) >= 2:
        if failed_offsets:
            return generated, f"{len(failed_offsets)} preview frames failed at {', '.join(failed_offsets)}"
        return generated, None

    if failed_offsets:
        return generated, f"preview frame extraction failed at {', '.join(failed_offsets)}"
    return generated, "preview frame extraction failed"


def optimize_video_full(src: Path, output_dir: Optional[Path] = None) -> Dict[str, Any]:
    """
    Generate all optimized variants of a video.
    
    Creates:
    - Optimized web-ready video (H.264, smaller size)
    - Thumbnail image from video
    - Blur placeholder of thumbnail
    
    Args:
        src: Source video path
        output_dir: Directory for optimized files (default: same as src)
    
    Returns:
        Dictionary mapping variant names to relative paths:
        {
            'original': 'video.mp4',
            'optimized': 'video-optimized.mp4',
            'thumbnail': 'video-thumb.jpg',
            'placeholder': 'video-placeholder.jpg',
            'useCloudStorage': True/False
        }
    """
    if output_dir is None:
        output_dir = src.parent
    
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = src.stem

    cached = _load_from_optimizer_cache(src, output_dir, "video")
    if cached is not None:
        return cached

    results: Dict[str, Any] = {
        'original': src.name,
        'useCloudStorage': should_use_cloud_storage(src)
    }
    issues: List[str] = []
    fallbacks: List[str] = []

    # Generate optimized video
    optimized_path = output_dir / f"{stem}-optimized.mp4"
    if optimize_video(src, optimized_path):
        results['optimized'] = optimized_path.name
        # Update cloud storage check for optimized version
        if optimized_path.exists():
            results['useCloudStorage'] = should_use_cloud_storage(optimized_path)
    else:
        issues.append("optimized video generation failed")
        fallbacks.append("the UI will use the original video file when it is still readable")
    
    # Generate thumbnail
    thumb_path = output_dir / f"{stem}-thumb.jpg"
    if generate_video_thumbnail(src, thumb_path):
        results['thumbnail'] = thumb_path.name
        
        # Generate blur placeholder from thumbnail
        placeholder_path = output_dir / f"{stem}-placeholder.jpg"
        if generate_blur_placeholder(thumb_path, placeholder_path):
            results['placeholder'] = placeholder_path.name
    else:
        issues.append("thumbnail generation failed")
        fallbacks.append("the UI will fall back to a play-icon placeholder for poster surfaces")

    preview_frames, preview_issue = generate_video_preview_frames(src, output_dir)
    if len(preview_frames) >= 2:
        results['previewFrames'] = [frame.name for frame in preview_frames]
        results['previewIntervalMs'] = VIDEO_PREVIEW_INTERVAL_MS
    else:
        if preview_issue:
            issues.append(preview_issue)
        else:
            issues.append("preview frame generation failed")
        fallbacks.append("collection video cards will stay on a static poster instead of cycling hover previews")

    if issues:
        results['issues'] = issues
        results['fallbacks'] = list(dict.fromkeys(fallbacks))

    _save_to_optimizer_cache(src, output_dir, "video", results)
    return results


def optimize_3d_model(src: Path, dest: Path) -> Optional[Path]:
    """
    Convert a 3D model to GLB format for web optimization.
    
    Currently supports:
    - OBJ to GLB conversion (requires obj2gltf)
    - Passthrough for GLB/GLTF files (already optimized)
    
    Args:
        src: Source model path (.obj, .gltf, .glb, etc.)
        dest: Destination GLB path
    
    Returns:
        Path to optimized model, or None on failure
    """
    src_ext = src.suffix.lower()
    
    # If already GLB, just copy it
    if src_ext == '.glb':
        if src != dest:
            try:
                shutil.copy2(src, dest)
                return dest
            except Exception as e:
                print(f"Error copying GLB {src}: {e}", file=sys.stderr)
                return None
        return src
    
    # If GLTF, we could convert to GLB but for now just note it
    if src_ext == '.gltf':
        print(f"Note: {src.name} is GLTF. Consider converting to GLB for better performance.", file=sys.stderr)
        return None
    
    # Convert OBJ to GLB
    if src_ext == '.obj':
        if not check_obj2gltf():
            print("Warning: obj2gltf not found. Install with: npm install -g obj2gltf", file=sys.stderr)
            print(f"Skipping {src.name}", file=sys.stderr)
            return None
        
        try:
            # obj2gltf command with optimization flags
            cmd = [
                'obj2gltf',
                '-i', str(src),
                '-o', str(dest),
                '--binary',  # Output as GLB (binary)
            ]
            
            # Check if there's an MTL file (material file)
            mtl_path = src.with_suffix('.mtl')
            if mtl_path.exists():
                print(f"  Found material file: {mtl_path.name}")
            
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False
            )
            
            if result.returncode == 0 and dest.exists():
                original_size = get_file_size_mb(src)
                new_size = get_file_size_mb(dest)
                savings = ((original_size - new_size) / original_size * 100) if original_size > 0 else 0
                print(f"  Converted {src.name}: {original_size:.2f}MB → {new_size:.2f}MB ({savings:.1f}% reduction)")
                return dest
            else:
                error_msg = result.stderr.decode() if result.stderr else "Unknown error"
                print(f"Error converting {src.name}: {error_msg}", file=sys.stderr)
                return None
        except Exception as e:
            print(f"Error converting {src}: {e}", file=sys.stderr)
            return None
    
    # Unsupported format
    print(f"Warning: Unsupported 3D model format: {src_ext}", file=sys.stderr)
    return None


def optimize_3d_model_full(src: Path, output_dir: Optional[Path] = None) -> Dict[str, str]:
    """
    Generate optimized GLB version of a 3D model.
    
    Args:
        src: Source model path
        output_dir: Directory for optimized files (default: same as src)
    
    Returns:
        Dictionary with optimization results:
        {
            'original': 'model.obj',
            'optimized': 'model.glb',
            'useCloudStorage': True/False
        }
    """
    if output_dir is None:
        output_dir = src.parent
    
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = src.stem

    cached = _load_from_optimizer_cache(src, output_dir, "model")
    if cached is not None:
        return cached

    results = {
        'original': src.name,
        'useCloudStorage': should_use_cloud_storage(src)
    }

    # Generate optimized GLB
    optimized_path = output_dir / f"{stem}.glb"
    if optimize_3d_model(src, optimized_path):
        results['optimized'] = optimized_path.name
        # Update cloud storage check for optimized version
        if optimized_path.exists():
            results['useCloudStorage'] = should_use_cloud_storage(optimized_path)

    _save_to_optimizer_cache(src, output_dir, "model", results)
    return results


def batch_optimize_directory(
    directory: Path,
    image_exts: set = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.tif', '.bmp', '.ico', '.heic', '.heif', '.svg'},
    video_exts: set = {'.mp4', '.mov', '.webm', '.avi', '.mkv', '.ogv', '.wmv', '.mpg', '.mpeg', '.flv'},
    model_exts: set = {'.obj', '.gltf'}
) -> Dict[str, Dict[str, Any]]:
    """
    Optimize all media files in a directory.
    
    Args:
        directory: Directory to process
        image_exts: Set of image extensions to process
        video_exts: Set of video extensions to process
        model_exts: Set of 3D model extensions to process
    
    Returns:
        Dictionary mapping original filenames to their variant info
    """
    results: Dict[str, Dict[str, Any]] = {}
    _OPTIMIZER_CACHE_STATS["hits"] = 0
    _OPTIMIZER_CACHE_STATS["misses"] = 0

    # First, scan recursively to find all media files
    print(f"Scanning {directory} for media files...")
    all_images = []
    all_videos = []
    all_models = []
    
    for file in directory.rglob('*'):
        if not file.is_file():
            continue
        
        ext = file.suffix.lower()
        
        # Skip already optimized files
        if any(suffix in file.stem for suffix in ['-optimized', '-thumb', '-placeholder', '-preview-']):
            continue
        
        # Skip GLB files (already optimized)
        if ext == '.glb':
            continue
        
        if ext in image_exts:
            all_images.append(file)
        elif ext in video_exts:
            all_videos.append(file)
        elif ext in model_exts:
            all_models.append(file)
    
    print(f"Found {len(all_images)} images, {len(all_videos)} videos, and {len(all_models)} 3D models")
    
    if not all_images and not all_videos and not all_models:
        print("No media files found to optimize.")
        return results
    
    # Process images
    for i, file in enumerate(all_images, 1):
        print(f"[{i}/{len(all_images)}] Optimizing image: {file.relative_to(directory)}")
        results[str(file.relative_to(directory))] = optimize_image_full(file)
    
    # Process videos
    for i, file in enumerate(all_videos, 1):
        print(f"[{i}/{len(all_videos)}] Optimizing video: {file.relative_to(directory)}")
        results[str(file.relative_to(directory))] = optimize_video_full(file)
    
    # Process 3D models
    for i, file in enumerate(all_models, 1):
        print(f"[{i}/{len(all_models)}] Optimizing 3D model: {file.relative_to(directory)}")
        results[str(file.relative_to(directory))] = optimize_3d_model_full(file)

    hits = _OPTIMIZER_CACHE_STATS["hits"]
    misses = _OPTIMIZER_CACHE_STATS["misses"]
    if hits or misses:
        print(f"Media cache: {hits} unchanged (skipped reprocessing), {misses} new/changed (reprocessed)")

    return results


def print_video_optimization_summary(results: Dict[str, Dict[str, Any]]) -> None:
    """Print a clear end-of-run summary for video issues and runtime fallbacks."""
    video_results = {
        rel_path: variants
        for rel_path, variants in results.items()
        if Path(rel_path).suffix.lower() in {'.mp4', '.mov', '.webm', '.avi', '.mkv', '.ogv', '.wmv', '.mpg', '.mpeg'}
    }

    if not video_results:
        return

    preview_frame_total = sum(
        len(variants.get('previewFrames', []))
        for variants in video_results.values()
        if isinstance(variants.get('previewFrames'), list)
    )
    issue_entries = [
        (rel_path, variants)
        for rel_path, variants in video_results.items()
        if variants.get('issues')
    ]

    print("\n🎞️ Video optimization summary:")
    print(f"  - videos processed: {len(video_results)}")
    print(f"  - preview frames generated: {preview_frame_total}")

    if not issue_entries:
        print("  - failures: 0")
        return

    print("  - failures:")
    for rel_path, variants in issue_entries:
        issues = variants.get('issues') or []
        fallbacks = variants.get('fallbacks') or []
        issue_text = "; ".join(str(issue) for issue in issues)
        fallback_text = "; ".join(str(fallback) for fallback in fallbacks) if fallbacks else "no runtime fallback recorded"
        print(f"    • {rel_path}: {issue_text}")
        print(f"      fallback used: {fallback_text}")

    print("  - how to fix: verify ffmpeg/ffprobe are installed, make sure the source video opens locally, then rerun `npm run optimize`.")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Optimize images and videos for web")
    parser.add_argument("path", help="File or directory to optimize")
    parser.add_argument("--output", "-o", help="Output directory (default: same as input)")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("--delete-originals", action="store_true", help="Delete original files after optimization")
    parser.add_argument(
        "--no-media-cache",
        action="store_true",
        help=(
            "Disable the content-hash reprocessing cache (tmp/media-optimizer-cache) and "
            "force every file through full Pillow/ffmpeg reprocessing, regardless of whether "
            "its content already has a cached result from a previous run."
        ),
    )

    args = parser.parse_args()

    if args.no_media_cache:
        _OPTIMIZER_CACHE_DISABLED = True

    path = Path(args.path)
    output_dir = Path(args.output) if args.output else None
    
    # Handle cloud sync renaming issues (e.g., 'projects' → 'projects 2')
    if not path.exists() and path.name == "projects":
        parent_dir = path.parent
        # Look for 'projects 2', 'projects 3', etc. in the parent directory
        candidates = []
        if parent_dir.exists():
            for p in parent_dir.iterdir():
                if p.is_dir() and p.name.startswith("projects"):
                    candidates.append(p)
        
        if candidates:
            # Use the most recently modified one
            actual_path = max(candidates, key=lambda p: p.stat().st_mtime)
            if actual_path != path:
                print(f"⚠️  WARNING: '{path.name}' not found, but found '{actual_path.name}'")
                print(f"   Cloud sync may have renamed the folder. Using '{actual_path.name}' instead.")
                print(f"   Consider disabling cloud sync for the 'public/' directory.\n")
                path = actual_path
    
    if not path.exists():
        print(f"Error: Path not found: {path}", file=sys.stderr)
        sys.exit(1)
    
    if path.is_file():
        ext = path.suffix.lower()
        if ext in {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.tif', '.bmp', '.ico', '.heic', '.heif', '.svg'}:
            result = optimize_image_full(path, output_dir)
        elif ext in {'.mp4', '.mov', '.webm', '.avi', '.mkv', '.ogv', '.wmv', '.mpg', '.mpeg', '.flv'}:
            result = optimize_video_full(path, output_dir)
        elif ext in {'.obj', '.gltf'}:
            result = optimize_3d_model_full(path, output_dir)
        else:
            print(f"Error: Unsupported file type: {ext}", file=sys.stderr)
            sys.exit(1)
        
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"✓ Optimized {path.name}")
            for variant, filename in result.items():
                print(f"  - {variant}: {filename}")
            if ext in {'.mp4', '.mov', '.webm', '.avi'}:
                print_video_optimization_summary({path.name: result})
    
    elif path.is_dir():
        results = batch_optimize_directory(path)
        
        # Delete originals if requested
        if args.delete_originals and results:
            print("\nDeleting original files...")
            deleted_count = 0
            for rel_path, variants in results.items():
                original_file = path / rel_path

                # Never delete the original when it is also the canonical output asset.
                original_name = variants.get('original')
                optimized_name = variants.get('optimized')
                thumbnail_name = variants.get('thumbnail')

                if original_name and original_name in {optimized_name, thumbnail_name}:
                    print(f"  Preserved canonical original: {rel_path}")
                    continue

                if original_file.exists():
                    try:
                        original_file.unlink()
                        deleted_count += 1
                        print(f"  Deleted: {rel_path}")
                    except Exception as e:
                        print(f"  Failed to delete {rel_path}: {e}", file=sys.stderr)
            print(f"✓ Deleted {deleted_count} original files")
        
        if args.json:
            print(json.dumps(results, indent=2))
        else:
            print(f"\n✓ Optimized {len(results)} files in {path}")
            cloud_count = sum(1 for r in results.values() if r.get('useCloudStorage'))
            if cloud_count:
                print(f"  - {cloud_count} files recommended for cloud storage (>{CLOUD_STORAGE_THRESHOLD_MB}MB)")
            print_video_optimization_summary(results)
