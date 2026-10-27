# Portfolio improvements checklist — October 27, 2026

Every requirement from the professional-positioning brief, reviewed against the actual
implementation. **Done** = implemented and verified; **Partial**; **Deferred** (reason);
**Needs owner** (see [content review](CONTENT_REVIEW.md)). Maintenance guide:
[portfolio presentation controls](setup/portfolio-presentation.md).

| # | Requirement | Status | Evidence / notes |
| --- | --- | --- | --- |
| 1 | Audit system; baseline | Done | Pipeline: Notion (Workspace-synced) → `notion_projects_export.py` → `projects_pipeline.py` → `local_projects.py` overlays `content/projects/*` and `content/project-updates.json`. Baseline: typecheck clean, 45 unit, 171 Python, browser 37 pass / 2 pre-existing fail. |
| 2 | Preserve Workspace publishing, work logs, articles, URLs | Done | No pipeline code changed. `npm run sync:local-projects` → 45 projects; Hue keeps 3 work logs; new Python test proves overrides never replace imported logs; validator: 45 projects, 9 articles. Slug and UUID routes still pass. |
| 3 | Homepage introduction + Selected work / Résumé / Contact actions, GitHub & LinkedIn | Done | `components/portfolio-header.tsx`; personal statement kept as a quote. |
| 4 | Selected Work (4–6) + full archive | Done | Six ranked featured projects; archive keeps every project, filters, modal deep links and `/#projects`. |
| 4a | Featured control, predictable ordering | Done | One ranking control, `content/selected-work.json`; Notion Featured / Featured Order are never overridden and act as the fallback. Optional `cardSummary`, `images.featured`, `disciplines`. |
| 5 | Categories, filtering, search, navigation | Done | Five derived focus areas; focus + demo/download/source filters added to existing search/domain/status/tag filters (platform/technology via tag filter and search). Nav: Projects · Experience · About · Writing · Work Logs · Résumé · Contact, on every page. |
| 6 | About page | Done / Needs owner | `/about` from verified facts. No photo: existing headshot appears AI-generated (item 9). |
| 7 | Professional experience | Done / Needs owner | `/experience`, single source `lib/site-content.ts`, engagement labels from résumé, related-project links. Items 2–8 to confirm. |
| 8 | Progressive project pages | Done | Optional `caseStudy` → "Engineering notes" (only filled sections render) + TOC entry; bare projects unchanged (tested). Work logs labelled as development history. |
| 9 | Visual evidence | Partial | `caseStudy.media` supports diagrams/photos with alt text; conventions documented. No new media created (no fabrication); needs real photos/demos (items 10–12). |
| 10 | Hardware & electronics visibility | Done / Needs owner | `/explore/hardware` with equipment list and non-credential disclaimer; Hue Light Control in Selected Work with verified case study. Only 2 hardware projects published (item 11). |
| 11 | Résumé accessibility | Done / Needs owner | Hero, nav, footer, `/resume`, `/experience`, `/about`; PDF returns 200. One public version; tailored résumés not published. PDF is from April 2026 (item 1). |
| 12 | How I Work | Done | Four themes, each tied to real projects/articles. |
| 13 | Role-specific shareable views | Done | `/explore/{software,ai-data,hardware,research,creative}` static pages with per-page metadata; `/projects?focus=…`. |
| 14 | Standardized actions | Done | Existing install → demo → source order kept; support/privacy/setup/story moved to a secondary row; empty URLs hidden. 21 external links checked: all 200. |
| 15 | Writing and work-log discovery | Done | Recent writing on homepage; Writing + Work Logs in nav; project articles and logs unchanged. |
| 16 | Credibility and accurate status | Done | Stage labels (Released, Complete, In testing, Working prototype, Research experiment, Paused, Archived…) and evidence labels on cards; Hue validation states builder-reported operation. |
| 17 | Accessibility, performance, SEO, responsive | Done | axe WCAG A/AA: 0 violations on 7 pages × light/dark (contrast token fixed site-wide). Keyboard test. 390/820/1280 no overflow. Person JSON-LD, sitemap (67 URLs), robots, per-page titles/descriptions/canonicals. Homepage carousel autoplay removed. |
| 18 | Preserve design language | Done | Existing tokens, typography, components; no new UI framework or dependency. |
| 19 | Maintainability + docs | Done | `docs/setup/portfolio-presentation.md`; no new env vars or GA4 definitions. |
| 20 | Testing | Done | 52 unit (7 new), 172 Python (1 new), `tests/presentation.spec.ts` (13 tests), updated home/articles/recallable/footer specs; static export build + validator; export-served browser checks; screenshots inspected at three viewports. |
| 21–22 | Phased, minimal-risk | Done | No pipeline, database, or URL changes. |
| 23 | Content accuracy | Done | Claims traced to résumé, project records, or the brief; open questions in `CONTENT_REVIEW.md`. |
| 24 | Deployment | Done | Released `ceccdc6` (Firebase run 40512601942); live marker, routes, production and presentation suites verified. Contact Worker fix awaits owner deploy (see NEXT_STEPS). |

## Previously reported test failures — resolved

- `tests/articles.spec.ts` grid-card measurement: passes on the reconciled tree (the failure came from stale local state in the old checkout).
- `tests/contact.spec.ts` under the default config was posting to the production contact API with a fake Turnstile token; it now runs only under `playwright.contact.config.ts` (passes).
- Load timeouts on the dev server: run the default suite with `--workers=2`.
- `scripts/serve-export.py` resets connections under parallel load (local chunk-load errors); serial runs pass. Firebase Hosting is unaffected.
