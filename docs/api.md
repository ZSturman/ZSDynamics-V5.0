# Static JSON API

The site emits a small read-only JSON API alongside its static export, so any future tool, agent, or third-party integration can pull structured data without scraping HTML.

All endpoints live under `/api/` on the same origin as the site (e.g. `https://zacharysturman.com/api/projects.json`). Generation runs in `lib/build_postprocess.py` and is committed to `public/api/` on every build.

## Envelope

Every endpoint returns the same shape:

```jsonc
{
  "schema_version": 1,
  "kind": "projects.list",
  "generated_at": "2026-05-04T15:54:29.658Z",
  "data": [ /* … */ ],
  "count": 17
}
```

Breaking changes bump `schema_version` to `2`. Additive fields do not.

## Endpoints

| Path | Kind | Notes |
| --- | --- | --- |
| `/api/index.json` | `index` | Lists every endpoint and the schema-versioning policy. |
| `/api/site.json` | `site` | Site-level metadata (name, description, canonical URL). |
| `/api/projects.json` | `projects.list` | Slim project list — id, slug, title, summary, primary image. |
| `/api/projects/{slug}.json` | `projects.detail` | Full project record (everything from `projects.json`). |
| `/api/articles.json` | `articles.list` | Slim article list. |
| `/api/articles/{slug}.json` | `articles.detail` | Full article record. |

## Caching

`firebase.json` sets these headers on `/api/**`:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Cache-Control: public, max-age=300, s-maxage=600
Content-Type: application/json; charset=utf-8
```

CORS is open because the data is already public on the site. The 5-minute browser TTL and 10-minute edge TTL keep load minimal while giving redeploys a quick TTL turnover.

## Stability promise

The list endpoints (`projects.json`, `articles.json`) are intentionally *slim* — only the fields that are stable across schema iterations. If you depend on a field in the slim list, that field will keep working at `schema_version: 1`. Detail endpoints are richer but their internal field shapes can shift; treat unknown fields as additive and tolerate missing ones.
