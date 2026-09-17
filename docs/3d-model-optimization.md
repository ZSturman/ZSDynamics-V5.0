# 3D Model Optimization

## Overview
3D models are now automatically optimized during the build process to improve web performance.

## Supported Formats

### Input Formats
- **OBJ** (.obj) - Converts to GLB
- **GLTF** (.gltf) - Notes recommendation to convert to GLB
- **GLB** (.glb) - Already optimized, copied as-is

### Output Format
- **GLB** (binary GLTF) - Optimized for web, compressed, includes materials

## Why GLB?

OBJ files have several issues for web:
- ❌ Large file sizes (text-based)
- ❌ Separate material files (.mtl)
- ❌ No built-in compression
- ❌ Slower to parse and render
- ❌ Not optimized for real-time viewing

GLB files are ideal:
- ✅ Binary format (smaller size)
- ✅ Single file (includes materials/textures)
- ✅ Built-in compression
- ✅ Fast loading and rendering
- ✅ Industry standard for web 3D

## How It Works

### 1. During Build
```bash
npm run dev  # Runs folio-prebuild + optimize
```

The optimizer automatically:
1. Scans for .obj and .gltf files
2. Converts them to .glb using `obj2gltf`
3. Reports file size reduction
4. Preserves original files (unless --delete-originals flag)

### 2. In the Browser
The components automatically:
1. Check for optimized .glb version first
2. Fall back to original if .glb doesn't exist
3. Load using Three.js OBJLoader or GLTF loader as needed
4. Center and scale models automatically

## Manual Optimization

To optimize a single model:
```bash
python3 lib/media-optimizer.py path/to/model.obj
```

To optimize all models in a directory:
```bash
python3 lib/media-optimizer.py public/projects
```

## Requirements

- **obj2gltf**: Installed globally via npm
  ```bash
  npm install -g obj2gltf
  ```

## Component Support

Both viewer components support OBJ and GLB:
- `components/project-details/collection/content-viewer.tsx`
- `components/project-details/collection/collection-item.tsx`

Features:
- Automatic model centering
- Automatic scaling to fit viewport
- Interactive controls (rotate, zoom, pan)
- Animation support (for models with animations)

## Performance Benefits

Example conversion (Standard Model):
- Original OBJ: ~15MB
- Optimized GLB: ~3MB
- **80% size reduction** = faster loading & better performance
