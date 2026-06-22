# Setup: R2 media hosting

`zacharysturman.com` keeps a *foundation-only* media hosting layer. Originals and optimized variants stay in the repo; uploading to R2 is opt-in.

## Why opt-in

The full pipeline runs fine without R2 — the post-process step writes an empty `public/media-urls.json` and the resolvers fall back to local paths. R2 only kicks in when all five env vars are set, so contributors and CI without secrets can build the site normally.

## Architecture

```
public/projects/foo/hero-optimized.webp
        │
        ▼  lib/build_postprocess.py  (SHA-256 + Cache-Control: public, max-age=31536000, immutable)
        │
        ▼  R2 bucket: zacharysturman-media
        │   key: projects/foo/hero-optimized.{first12hex}.webp
        │
        ▼  Custom domain: media.zacharysturman.com
        │
        ▼  public/media-urls.json   { localPath → hostedUrl }
        │
        ▼  lib/media-url-map.ts → preferHostedUrl()
        │
        ▼  lib/utils.ts + lib/collection-item-media.ts (transparent)
```

The manifest file `lib/media-manifest.lock.json` (committed) records `sha256 + size` per source path. Re-runs upload only when content changes.

## Bucket setup

1. Cloudflare dashboard → **R2** → **Create bucket** → `zacharysturman-media`. Region: auto.
2. **Settings → Public access → Connect a custom domain** → `media.zacharysturman.com`.
3. **Manage R2 API Tokens → Create token** with read/write on the bucket. Save the access key id + secret.

## Env vars (build only)

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=zacharysturman-media
R2_PUBLIC_BASE_URL=https://media.zacharysturman.com
```

If any of these is missing the post-process step skips uploading (no error).

## Build flows

| Command | What it does |
| --- | --- |
| `npm run build:full` | Generate articles + projects + optimize media + post-process (no upload) + Next build. |
| `npm run build:full:hosted` | Same, but post-process uploads changed media to R2. |
| `npm run upload-media` | Just sync media to R2 (no JSON regeneration). |
| `npm run upload-media:dry-run` | Print planned uploads without touching the bucket. |

## Cache busting

Every R2 key has a 12-character hash of the file content suffixed before the extension:

```
projects/foo/hero-optimized.a1b2c3d4e5f6.webp
```

Combined with `Cache-Control: public, max-age=31536000, immutable`, content changes always produce a new URL and old URLs stay valid as long as anyone has them cached.
