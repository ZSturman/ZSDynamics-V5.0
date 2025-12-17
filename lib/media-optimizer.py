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

import os
import sys
import subprocess
from pathlib import Path
from typing import Optional, Tuple, Dict, List
import json
import hashlib

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

PLACEHOLDER_SIZE = 20    # Size of blur placeholder (very small)

# Threshold for using cloud storage (in MB)
CLOUD_STORAGE_THRESHOLD_MB = 5


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


def optimize_video_full(src: Path, output_dir: Optional[Path] = None) -> Dict[str, str]:
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
    
    results = {
        'original': src.name,
        'useCloudStorage': should_use_cloud_storage(src)
    }
    
    # Generate optimized video
    optimized_path = output_dir / f"{stem}-optimized.mp4"
    if optimize_video(src, optimized_path):
        results['optimized'] = optimized_path.name
        # Update cloud storage check for optimized version
        if optimized_path.exists():
            results['useCloudStorage'] = should_use_cloud_storage(optimized_path)
    
    # Generate thumbnail
    thumb_path = output_dir / f"{stem}-thumb.jpg"
    if generate_video_thumbnail(src, thumb_path):
        results['thumbnail'] = thumb_path.name
        
        # Generate blur placeholder from thumbnail
        placeholder_path = output_dir / f"{stem}-placeholder.jpg"
        if generate_blur_placeholder(thumb_path, placeholder_path):
            results['placeholder'] = placeholder_path.name
    
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
                import shutil
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
    
    return results


def batch_optimize_directory(
    directory: Path,
    image_exts: set = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.tif', '.bmp', '.ico', '.heic', '.heif'},
    video_exts: set = {'.mp4', '.mov', '.webm'},
    model_exts: set = {'.obj', '.gltf'}
) -> Dict[str, Dict[str, str]]:
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
    results = {}
    
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
        if any(suffix in file.stem for suffix in ['-optimized', '-thumb', '-placeholder']):
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
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Optimize images and videos for web")
    parser.add_argument("path", help="File or directory to optimize")
    parser.add_argument("--output", "-o", help="Output directory (default: same as input)")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("--delete-originals", action="store_true", help="Delete original files after optimization")
    
    args = parser.parse_args()
    
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
        if ext in {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.tif', '.bmp', '.ico', '.heic', '.heif'}:
            result = optimize_image_full(path, output_dir)
        elif ext in {'.mp4', '.mov', '.webm', '.avi'}:
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
    
    elif path.is_dir():
        results = batch_optimize_directory(path)
        
        # Delete originals if requested
        if args.delete_originals and results:
            print("\nDeleting original files...")
            deleted_count = 0
            for rel_path in results.keys():
                original_file = path / rel_path
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
