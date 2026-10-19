# Better Signals showcase and listing pages

The active app was renamed from Current State / Timing Coach to Better Signals on October 19, 2026. Its iOS identity remains `com.zacharysturman.checkin2`; App Store Connect app ID: `6824696184`.

## Public routes

- `/projects/better-signals`: showcase, gallery, engineering story, and public project README.
- `/better-signals`: app overview and current availability.
- `/better-signals/support`: usage and troubleshooting; used by the app and App Store listing.
- `/better-signals/privacy`: factual data-handling policy; used by the app and listing.

The app is being prepared for TestFlight. The site deliberately has no App Store download button or public TestFlight invitation until one is available. The personal internal testing group is not a public beta.

## Maintain the content

The durable source is `content/projects/better-signals/{project.json,README.md,images/}`. `lib/local_projects.py` merges it by ID/slug into cached builds and full Notion refreshes, preventing duplicate cards or disappearance during synchronization. Do not hand-author only the generated `public/projects/projects.json`.

Media originates in the app's `Marketing/AppStore/screenshots/en-US/` and `Marketing/Portfolio/images/`. The app's `scripts/prepare-media.py` stages full-resolution, unmodified native screenshots separately from resized website assets and portfolio compositions. `Marketing/AppStore/media-manifest.json` records native dimensions and SHA-256 checksums. Screens contain synthetic Signals in disposable simulators, not personal history. The Watch capture shows synthetic phone Signals received over WatchConnectivity; it does not establish physical-device acceptance.

For changes:

```sh
npm run sync:local-projects
npx eslint app/better-signals --max-warnings 0
npm run typecheck
npm run build
```

Expected: one Better Signals entry; static routes for the showcase, overview, support, and privacy; no missing optimized gallery images. Recheck desktop and mobile layouts and all four routes before publishing. Production browser automation must set `window.__ZS_DISABLE_ANALYTICS__ = true` before page scripts and block Google Analytics requests.

The normal `main` push publishes through Firebase Hosting. Keep unrelated in-progress edits out of a release. This release was prepared in a separate Git worktree because the main portfolio checkout had existing uncommitted work.

## Once availability changes

Update the availability text in `app/better-signals/{page.tsx,support/page.tsx}`, the project's JSON description, and its README. Add a download resource only with a verified public URL. Keep personal/internal TestFlight access private. Review the privacy page whenever app behavior changes, especially storage, location, export destinations, and any future networking or analytics.

## Current product boundary

Watch transfers to its paired iPhone. iPad history is separate. The app has no account, developer-operated backend, iCloud history sync, scoring, or medical advice. The previous qualitative Better Signals database remains untouched and is not converted. Individual Signal deletion is not available in this version. Those limits are reflected in support and privacy text.
