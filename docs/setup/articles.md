# Setup: Article ingestion

Articles are **not** sourced from Notion. `npm run generate-articles` (`python3 lib/sync_articles.py`)
downloads the public GitHub repository `ZSturman/Articles` (tarball, no auth required) at ref `main`
and builds `public/articles/articles.json` plus one `public/articles/<slug>/index.md` (and any
referenced local assets) per article. Every run fully replaces `public/articles/`, so an article
removed from the source repo is correctly removed from the site on the next sync — there is no
stale-content accumulation to manage.

## What identifies an article

Each article is a Markdown file with YAML-lite frontmatter, either `articles/<slug>/index.md`
(directory layout, for articles with local images) or a flat `articles/<slug>.md`. The slug comes
from the file/directory name. Metadata (title, summary, tags, series, `publishedAt`, `coverImage`,
`projectIds`, `sourceUrl`) is read from frontmatter; project relationships are resolved against
`public/projects/projects.json` by alias matching, and standalone URLs in the body get a fetched
link-preview card (title/description/image) where reachable.

## Draft handling

**The only draft signal in the schema is a missing `publishedAt`.** This is enforced, not just
cosmetic: a draft is excluded from `articles.json` (which gates both `/articles` and
`generateStaticParams` for `/articles/[slug]`) **and** its `index.md`/assets are never written to
`public/articles/<slug>/` at all — Next's static export copies `public/` verbatim regardless of
routing, so an unlisted-but-present file on disk would still be a reachable, public URL.

To preview a draft locally (never in a production sync), set:

```bash
PORTFOLIO_INCLUDE_DRAFT_ARTICLES=true npm run generate-articles
```

`public/articles/sync-report.json` (written on every sync) records `discovered`, `imported`,
`skipped` (malformed articles, with reasons), and `excludedDrafts` for observability without
re-reading logs.

## Failure isolation

One malformed article (missing frontmatter, a required field missing, or any unexpected parse
error) is skipped — logged with its slug and reason — and does not prevent the rest of the
articles from importing, or the broader portfolio pipeline from continuing. This is covered by
`tests_python/test_sync_articles.py::test_one_broken_article_does_not_prevent_siblings_from_importing`.

## Known source-content correction

The source repository's articles carry a recurring self-referential typo: `zachary-sturman.com`
(with a hyphen) instead of the real domain `zacharysturman.com`. Since the source repo is external
and not owned by this build, `lib/sync_articles.py` corrects this one confirmed, narrow string at
ingestion time (`fix_self_domain_typo`) rather than rewriting arbitrary content, and logs every
correction it makes. It does not touch any other content.

## Testing

- `python3 -m pytest -q tests_python/test_sync_articles.py` — discovery, frontmatter parsing, slug
  generation, link rewriting, draft exclusion (both directions), the typo correction, per-article
  failure isolation, and missing-optional-field handling.
- `npm run test:e2e -- tests/articles.spec.ts` — rendering, cards, previews, breadcrumbs, and
  project/article relationships against real generated output.
- Manual real sync: `python3 lib/sync_articles.py` from the repo root (`.env.local` needs no
  credentials for this step — the source repo is public), then inspect
  `public/articles/articles.json` and `public/articles/sync-report.json` directly.

## Publication chronology and browsing

Source `publishedAt` controls chronological ordering; `updatedAt` retains the original edit date and is displayed only if later than publication. Optional `createdAt` and `substantiallyRevisedAt` pass through from explicit frontmatter. Ingestion never changes these dates. Filters and browser history follow [content behavior](content-reliability.md).
