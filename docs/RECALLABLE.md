# Recallable portfolio entry

Updated October 13, 2026. The project page is at `/projects/recallable`; the app's support and privacy pages are at `/recallable/support` and `/recallable/privacy`. The app links to those two pages from Settings and from its App Store listing, so **deploy them before submitting the app to App Review**.

## Sources

- `content/projects/recallable/project.json`: title, summary, description and story (plain text: the page shows these fields verbatim, so no Markdown), status (`Active`, phase `Testing`), `featured: true`, tags, image roles, resources (Support and Privacy policy), and the screenshot gallery (`assets`).
- `content/projects/recallable/README.md`: the public README shown on the project page.
- `content/projects/recallable/images/`: originals plus `-optimized.webp`, `-thumb.webp` and `-placeholder.jpg` variants.
  - `hero.jpg`: the 16:9 hero composition.
  - `banner.jpg`: a text-free crop of the hero for the page header.
  - `thumbnail.jpg`: 4:3, for project cards and the featured carousel.
  - `icon.png`: the app icon.
  - `social.jpg`: 1200×630, the page's Open Graph and Twitter image (`images.social`; `app/projects/[project]/page.tsx` now prefers `images.social` over the banner for any project that sets it).
  - `feature-*.jpg`: marketing panels.
  - `gallery-*.jpg`: 16:9 tiles that put several real captures side by side (iPhone, iPad, Watch, dark appearance). The gallery shows every asset full width, which crops tall phone screenshots, so portrait captures go in tiles.
  - `mac-*.jpg`: the Mac app's window (16:10).
  - `iphone-0[1-4]-*`, `watch-0[12]-*`: single captures, used inline by the README.
- `app/recallable/{privacy,support}/page.tsx`: the public help pages.
- `app/recallable/deck/`: the page a shared deck link (`/recallable/deck/<id>`) shows when Recallable isn't installed, with "Open in Recallable" (`recallable://deck/<id>`) and the App Store link. `firebase.json` rewrites every `/recallable/deck/**` path to it.
- `public/apple-app-site-association.json`: the Associated Domains file that lets iOS and macOS open `/recallable/deck/*` links in the app (team `MF8J7AY2X3`, bundle `com.zacharysturman.recallable`). `firebase.json` serves it at `/.well-known/apple-app-site-association` and `/apple-app-site-association` as `application/json`; Firebase's ignore rule skips dot-folders, so it can't live in `public/.well-known/`, and `"appAssociation": "NONE"` stops Firebase Hosting from serving its own empty Dynamic Links file at those paths instead.
- `tests/recallable.spec.ts`: a desktop and mobile browser check.
- `.gitignore` re-includes `content/projects/recallable/`, alongside the Better Workspace exception.

The images come from the Recallable repository's `Marketing/` folder: App Store screenshots captured by its UI tests from the real app, and compositions rendered from `Marketing/Source/compositions.html`. There are no mockups of features the app doesn't have. The originals were downscaled (to 2,000 px on the long edge at most) and saved as JPEG, except the icon and the Watch captures. Gallery tiles come from `Marketing/Promotional/gallery/`.

`lib/local_projects.py` merges the entry into `public/projects/projects.json`, copies the README and images to `public/projects/recallable_5031ef4c-2724-54a4-92ca-42d270a59716/`, and writes `public/api/projects/recallable.json`. It runs as part of `npm run build`.

## Availability

The page says Recallable is being prepared for the App Store. It has no App Store or GitHub link, because the listing isn't live and the repository is private.

## Preview and checks

```bash
npm run sync:local-projects
npm run dev            # open http://localhost:3000/projects/recallable
npx playwright test tests/recallable.spec.ts
npm run build          # static export: out/projects/recallable.html, out/recallable/{privacy,support}.html
```

The browser check covers both widths:

- the hero and gallery images decode;
- the README is present;
- the Support link works, and there are no App Store or GitHub links yet;
- there's no horizontal overflow at 1280 or 390 px;
- both help pages render, with Contact pointing to `/contact`;
- the home page lists and features Recallable;
- no request returns an error.

Set `RECALLABLE_SHOT_DIR=<folder>` to save desktop and mobile screenshots.

## When the App Store listing is live

1. Add a resource to `project.json`: `{"type": "appstore", "label": "App Store", "url": "https://apps.apple.com/app/id<APP_ID>"}`. Use the URL App Store Connect gives you; check which resource `type` values the resource buttons support.
2. Change `phase` to `Release` (or `Production`), update `updatedAt`, and replace "being prepared for the App Store" in `description`, `README.md` and the support page's Availability section.
3. Update `tests/recallable.spec.ts`, which currently asserts there's no App Store link.
4. To refresh images, regenerate them in the Recallable repository (see `Marketing/README.md` there), copy them over the files in `content/projects/recallable/images/`, then run:

   ```bash
   .venv/bin/python lib/media-optimizer.py content/projects/recallable/images
   npm run sync:local-projects
   ```

   Never pass `--delete-originals` here; `local_projects.py` copies the originals. The sync copies files but never deletes them, so after removing an image from `content/`, delete its copies from `public/projects/recallable_5031ef4c-2724-54a4-92ca-42d270a59716/images/` too.
