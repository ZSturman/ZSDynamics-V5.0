# Portfolio presentation controls

How to manage the professional presentation added on October 27, 2026. Nothing here
changes the publishing pipeline: Notion and the Workspace remain the source for projects
and work logs, `lib/local_projects.py` still layers authored entries and reviewed
overrides on top, and every new field is optional.

## Where each thing lives

| What | Source of truth | Notes |
| --- | --- | --- |
| Projects, status, phase, tags, media, work logs | Notion Projects / Work Logs (synced from Workspace) | Unchanged. |
| Homepage Selected Work order | `content/selected-work.json` | Single ranking control; Notion Featured is the fallback. |
| Authored product entries | `content/projects/<slug>/project.json` | Unchanged; same merge. |
| Small reviewed changes to Notion-owned projects | `content/project-updates.json` | Keys overlay the Notion record; `workLogs` merge by ID. |
| Intro, About, Experience, Education, Skills, How I Work, hardware equipment | `lib/site-content.ts` | One file feeds the homepage, `/about`, `/experience`, `/resume`, and JSON-LD. |
| Public résumé PDF | `public/Zachary Sturman Resume.pdf` | Single public version. |
| Focus areas and stage labels | `lib/project-presentation.ts` | Derived from existing tags/category/medium/status/phase. |

## Selected Work (homepage, 4–6 projects)

Ranking has exactly **one control**: the ordered slug list in `content/selected-work.json`.

```json
{ "projects": ["better-workspace", "recallable", "transactions", "job-search-hub", "chewsense", "hue-light-control"] }
```

- Order in the file is the order on the homepage; the first six are shown.
- Unknown, renamed or private slugs are skipped, so a Notion rename never breaks the page
  (the unit test `tests/project-presentation.test.mjs` fails if a listed slug disappears).
- Focus pages (`/explore/<focus>`) show listed projects that belong to that focus, in the same order.
- If the list is empty or missing, Selected Work falls back to Notion **Featured** projects
  ranked by **Featured Order**, then most recent update.

Notion's Featured / Featured Order are never overridden locally. They still drive the ★
badge in the archive and the fallback above. To change the homepage, edit the list; to use
Notion instead, empty the list (`"projects": []`).

## Focus areas and role-specific links

Five focus areas — Software Engineering, AI & Data, Hardware & Electronics, Research &
Experiments, Design & Creative Technology — are derived from each project's tags, category,
mediums and domain (`FOCUS_AREAS` in `lib/project-presentation.ts`). A project can belong
to several. To override, add `disciplines` (keys or labels), for example
`"disciplines": ["hardware", "software"]`.

Shareable views for applications:

- `https://zacharysturman.com/explore/software`
- `https://zacharysturman.com/explore/ai-data`
- `https://zacharysturman.com/explore/hardware` (includes the equipment list)
- `https://zacharysturman.com/explore/research`
- `https://zacharysturman.com/explore/creative`
- Filtered archive: `/projects?focus=hardware`, `/projects?has=demo,source`

Archive filters (`focus`, `has=demo|download|source`) combine with the existing search,
domain, status, tag, sort, group and view parameters.

## Stage labels

Cards show an accurate stage from existing status/phase: Released, Complete,
Released · maintained, In testing, Working prototype, Research experiment, Active
development, Paused, Archived. Fix a wrong label at the source (Notion status/phase).

## Case studies (optional)

Add a `caseStudy` object to an authored `project.json` or a `content/project-updates.json`
entry. Every section is optional; only filled sections render, under **Engineering notes**:

```json
"caseStudy": {
  "problem": "Why it exists.",
  "role": "What I personally did.",
  "architecture": ["Component A talks to B over …"],
  "decisions": ["Chose X over Y because …"],
  "challenges": ["…"],
  "validation": ["Tests, measurements, or how it was checked."],
  "results": ["What works now."],
  "limitations": ["What is incomplete or next."],
  "media": [{ "path": "images/wiring.png", "alt": "Wiring diagram", "caption": "Optional" }]
}
```

Only write what is verified. Do not add placeholder text: a project without `caseStudy`
keeps its full existing page (description, story, README, media, logs, articles).
`cardSummary` optionally shortens the Selected Work card text, and `images.featured`
optionally replaces the thumbnail on Selected Work cards.

## Media

Existing conventions are unchanged: Notion asset roles (thumbnail, hero, banner, poster,
icon) and project assets flow through `projects_pipeline.py` and `media-optimizer.py`;
authored entries keep images in `content/projects/<slug>/images/`. Case-study `media`
paths resolve against the project's public folder, so diagrams, wiring photos, CAD renders
or charts added to an authored entry's `images/` folder can be referenced as
`images/<file>`. Always provide `alt` text. Label illustrations as illustrations.

## Professional information

Edit `lib/site-content.ts`:

- `profile` — headline, introduction, location, availability, personal statement.
- `portfolioData.experience.roles` — copy from the public résumé; keep `engagement`
  accurate (Contract, Client project, Collaboration, Employment). `projectSlug` links a
  related portfolio project.
- `portfolioData.skills` — skills, education, certifications.
- `aboutSections`, `howIWork`, `hardwareCapabilities`.

When the résumé changes, replace `public/Zachary Sturman Resume.pdf` and update the roles
to match. Keep application-specific résumés out of `public/`.

## Verification

```bash
npm run sync:local-projects          # applies overrides; expect "45 projects available"
npm run test:unit                    # includes tests/project-presentation.test.mjs
uv run --with pytest python -m pytest -q tests_python/test_local_projects.py
npx playwright test tests/presentation.spec.ts tests/home.spec.ts --workers=2
npm run build && npm run validate:portfolio
```

`tests/presentation.spec.ts` checks three viewports, navigation, keyboard access, résumé
download, focus filters, case-study rendering, internal links, JSON-LD/sitemap, and
WCAG A/AA with axe in light and dark themes.
