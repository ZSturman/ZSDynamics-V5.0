# Public project access

Cards and project pages prefer install/download actions, then working product/demo links, then public source. Setup/support and project-story links follow those actions. `lib/project-resources.ts` applies that order before the card's three-link limit.

`content/project-updates.json` contains reviewed resource, description and public work-log updates for Notion-owned projects. `lib/local_projects.py` applies these after authored local entries during both cached builds and full Notion imports. Work logs merge by ID, preserving imported history. Project detail API endpoints refresh when their data changes. Authored projects and their screenshots remain in `content/projects/`.

When maintaining a link:

1. Verify anonymous public access. For Apple apps, verify App Store Connect state and the actual public listing; an uploaded/TestFlight build is not an App Store release.
2. Prefer a direct install/download or actual application. Use the working release/installation page when the artifact needs setup.
3. Confirm GitHub visibility. Private repositories remain private and are not visitor-facing source links.
4. Add a reviewed override or update the authored entry. Add public-safe milestone logs, with no invented session durations or personal records.
5. Run `npm run sync:local-projects`, `uv run --with pytest python -m pytest -q tests_python/test_local_projects.py`, `npx playwright test tests/project-access.spec.ts`, then `npm run build` when publishing.

The browser demos at `/transactions/demo`, `/content-manager/demo`, and `/recallable/demo` are simplified, interactive walkthroughs using fictional data. They do not authenticate, persist records, send requests to those app backends, or reproduce full native behavior. Transactions' gallery images are real native captures with synthetic accounts.

For local project/repository association, Finder reads `remote.origin.url`. Better Projects prefers a normalized Notion Resources row with detected title, URL, `type=repo`, and project relation, or a direct repository property as fallback. Hue Light Control now has both its origin remote and a normalized resource/project repo relation. Finder Workspace Extensions has its new private origin. These changes do not edit application-private databases.

See [the dated link audit](evidence/project-link-audit-20261024.json) for verified URLs, Apple release states and projects without a verified public deliverable. Preserve the distinction between public versions and later beta features. Never publish raw local project folders or histories solely to fill an empty portfolio button.
