# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: media-resilience.spec.ts >> @smoke @matrix media resilience >> project route stays usable when a media request returns 500
- Location: tests/media/media-resilience.spec.ts:97:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-project-id="35eaec94-4d3c-809c-a0f4-ff355a7a6d21"][data-media-role="banner"] [data-media-fallback="true"], [data-project-id="35eaec94-4d3c-809c-a0f4-ff355a7a6d21"][data-media-role="banner"] [data-media-placeholder="true"]').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-project-id="35eaec94-4d3c-809c-a0f4-ff355a7a6d21"][data-media-role="banner"] [data-media-fallback="true"], [data-project-id="35eaec94-4d3c-809c-a0f4-ff355a7a6d21"][data-media-role="banner"] [data-media-placeholder="true"]').first()

```

```yaml
- text: Welcome — I occasionally post updates here. Thanks for visiting.
- button "Dismiss banner": Dismiss
- navigation "Breadcrumb":
  - list:
    - listitem:
      - link "Home":
        - /url: /
    - listitem:
      - link "Projects":
        - /url: /#projects
    - listitem: Marina Departure NOAA Risk Checker
- banner:
  - img "Marina Departure NOAA Risk Checker banner"
  - img "Marina Departure NOAA Risk Checker icon"
  - heading "Marina Departure NOAA Risk Checker" [level=1]
  - paragraph: A NOAA-powered web app for checking marina departure risk before heading out on the water.
  - button "web Visit":
    - img "web"
    - text: Visit
  - button "github Repo":
    - img "github"
    - text: Repo
  - button "Marina Departure NOAA Risk Checker hero media Fullscreen":
    - img "Marina Departure NOAA Risk Checker hero media"
    - text: Fullscreen
  - paragraph: Marina Departure NOAA Risk Checker helps boaters evaluate whether a coastal departure window looks safe. It combines NOAA tides and currents, NWS marine forecasts and alerts, and sunrise/sunset data into a transparent weighted risk score with charts, alerts, station search, and shareable departure windows.
- navigation "Project sections":
  - paragraph: On this page
  - link "Work Logs":
    - /url: "#work-logs"
  - link "Project Details":
    - /url: "#project-details"
- heading "Work Logs" [level=3]
- link "See all logs":
  - /url: /work-logs?project=marina-departure-noaa-risk-checker
- heading "Complete Marina Departure NOAA Risk Checker. 'Occasional updates'" [level=4]
- text: May 7, 2026 5/7/2026, 5:00 PM - May 8, 2026 5/8/2026, 1:00 AM
- paragraph: Finalized project entry for Marina Departure NOAA Risk Checker.
- text: "Duration: 1h"
- heading "Created new project entry for Marina Departure NOAA Risk Checker" [level=4]
- text: Apr 29, 2026 4/29/2026, 5:00 PM - Apr 30, 2026 4/30/2026, 1:00 AM
- paragraph: Created new project entry for Marina Departure NOAA Risk Checker and added the 'Project Starter' milestones and tasks.
- text: "Duration: 1h"
- complementary:
  - heading "Project Details" [level=3]
  - text: Complete (Occasional updates) Started Apr 2026 Last Updated May 2026
  - paragraph: Tags
  - text: Next.js TypeScript NOAA Happiness Data Vizualization Recharts Tailwind CSS
- contentinfo:
  - paragraph: Zachary Sturman
  - heading "Design, engineering, and writing in one shared portfolio." [level=2]
  - paragraph: I think a lot about how design influences trust, and how AI can support human judgment instead of replacing it.
  - navigation "Footer":
    - link "Home":
      - /url: /
    - link "Projects":
      - /url: /#projects
    - link "Articles":
      - /url: /articles
    - link "Work Logs":
      - /url: /work-logs
  - heading "Profiles" [level=3]
  - link "Email":
    - /url: mailto:zasturman@gmail.com
  - link "GitHub":
    - /url: https://github.com/zsturman
  - link "LinkedIn":
    - /url: https://linkedin.com/in/zacharysturman
  - link "X":
    - /url: https://x.com/XzckndhttqZ
  - link "Bluesky":
    - /url: https://bsky.app/profile/zacharysturman.bsky.social
  - link "IMDb":
    - /url: https://www.imdb.com/name/nm6373994/?ref_=ext_shr_lnk
  - heading "Resume" [level=3]
  - link "View Resume":
    - /url: /Zachary Sturman Resume.pdf
  - link "Download PDF":
    - /url: /Zachary Sturman Resume.pdf
  - paragraph: © 2026 Zachary Sturman. Built to keep projects, articles, and work logs in one consistent frame.
- alert
```

# Test source

```ts
  32  |       "Fault-injection resilience checks run on Chromium only for deterministic diagnostics."
  33  |     );
  34  |   });
  35  | 
  36  |   test("home remains usable when a card thumbnail request fails", async ({ page }, testInfo) => {
  37  |     const project = representativeProjects["thumbnail-only"] || defaultProject;
  38  |     const entry = findEntryForProject(project.id, ["thumbnail"]);
  39  |     test.skip(!entry, "No thumbnail media entry found for home resilience check.");
  40  | 
  41  |     await page.route((url) => mediaRequestMatches(url.toString(), entry!.resolvedUrl), async (route) => {
  42  |       await route.fulfill({
  43  |         status: 404,
  44  |         contentType: "text/plain",
  45  |         body: "forced-home-thumbnail-failure",
  46  |       });
  47  |     });
  48  | 
  49  |     const tracker = trackMediaRuntimeIssues(page);
  50  |     const context = buildRuntimeContext(page, testInfo, {
  51  |       scenario: "resilience-broken-home-thumbnail-request",
  52  |       route: "/",
  53  |       projectId: project.id,
  54  |       projectTitle: project.title,
  55  |       mediaKey: "thumbnail",
  56  |       resolvedUrl: entry!.resolvedUrl,
  57  |       environment: process.env.NODE_ENV || "test",
  58  |     });
  59  | 
  60  |     try {
  61  |       await gotoHomeReady(page);
  62  | 
  63  |       const card = page
  64  |         .locator(
  65  |           `[data-testid="project-card-root"][data-project-id="${project.id}"], [data-testid="project-list-item-root"][data-project-id="${project.id}"]`
  66  |         )
  67  |         .first();
  68  |       await card.scrollIntoViewIfNeeded();
  69  |       await expect(card).toBeVisible();
  70  |       await expect(
  71  |         card
  72  |           .locator('[data-testid="project-card-media"], [data-testid="project-list-item-media"]')
  73  |           .first()
  74  |           .locator('[data-media-fallback="true"], [data-media-placeholder="true"]')
  75  |           .first()
  76  |       ).toBeVisible();
  77  | 
  78  |       await page.waitForTimeout(1000);
  79  |       const hasFailure =
  80  |         tracker.failedResponses.some((failure) => mediaRequestMatches(failure.url, entry!.resolvedUrl)) ||
  81  |         tracker.failedRequests.some((failure) => mediaRequestMatches(failure.url, entry!.resolvedUrl));
  82  |       expect(hasFailure, "forced broken thumbnail should surface as a media request failure").toBeTruthy();
  83  |     } catch (error) {
  84  |       await attachMediaContext(testInfo, "media-context", {
  85  |         ...context,
  86  |         failedResponses: tracker.failedResponses,
  87  |         failedRequests: tracker.failedRequests,
  88  |         consoleErrors: tracker.consoleErrors,
  89  |         pageErrors: tracker.pageErrors,
  90  |       });
  91  |       throw error;
  92  |     } finally {
  93  |       tracker.stop();
  94  |     }
  95  |   });
  96  | 
  97  |   test("project route stays usable when a media request returns 500", async ({ page }, testInfo) => {
  98  |     const project = representativeProjects.banner || representativeProjects.poster || defaultProject;
  99  |     const entry = findEntryForProject(project.id, ["banner", "poster", "thumbnail"]);
  100 |     test.skip(!entry, "No renderable media entry found for resilience 500 check.");
  101 | 
  102 |     await page.route((url) => mediaRequestMatches(url.toString(), entry!.resolvedUrl), async (route) => {
  103 |       await route.fulfill({
  104 |         status: 500,
  105 |         contentType: "text/plain",
  106 |         body: "forced-media-failure",
  107 |       });
  108 |     });
  109 | 
  110 |     const tracker = trackMediaRuntimeIssues(page);
  111 |     const context = buildRuntimeContext(page, testInfo, {
  112 |       scenario: "resilience-forced-500",
  113 |       route: `/projects/${project.id}`,
  114 |       projectId: project.id,
  115 |       projectTitle: project.title,
  116 |       mediaKey: entry!.mediaKey,
  117 |       resolvedUrl: entry!.resolvedUrl,
  118 |       environment: process.env.NODE_ENV || "test",
  119 |     });
  120 | 
  121 |     try {
  122 |       await gotoProjectReady(page, project.id, project.title);
  123 | 
  124 |       await page.waitForTimeout(500);
  125 |       await expect(
  126 |         page
  127 |           .locator(
  128 |             `[data-project-id="${project.id}"][data-media-role="${entry!.mediaKey}"] [data-media-fallback="true"], ` +
  129 |               `[data-project-id="${project.id}"][data-media-role="${entry!.mediaKey}"] [data-media-placeholder="true"]`
  130 |           )
  131 |           .first()
> 132 |       ).toBeVisible();
      |         ^ Error: expect(locator).toBeVisible() failed
  133 |       expect(
  134 |         tracker.failedResponses.some((failure) => failure.status === 500 && mediaRequestMatches(failure.url, entry!.resolvedUrl)) ||
  135 |           tracker.failedRequests.some((failure) => mediaRequestMatches(failure.url, entry!.resolvedUrl)),
  136 |         "forced 500 media response should be captured in diagnostics"
  137 |       ).toBeTruthy();
  138 |       const unexpectedPageErrors = tracker.pageErrors.filter(
  139 |         (pageError) => !isExpectedForcedMediaPageError(pageError.message)
  140 |       );
  141 |       expect(unexpectedPageErrors, "media failures should not trigger page-level crashes").toHaveLength(0);
  142 |     } catch (error) {
  143 |       await attachMediaContext(testInfo, "media-context", {
  144 |         ...context,
  145 |         failedResponses: tracker.failedResponses,
  146 |         failedRequests: tracker.failedRequests,
  147 |         consoleErrors: tracker.consoleErrors,
  148 |         pageErrors: tracker.pageErrors,
  149 |       });
  150 |       throw error;
  151 |     } finally {
  152 |       tracker.stop();
  153 |     }
  154 |   });
  155 | 
  156 |   test("project route tolerates delayed media responses", async ({ page }, testInfo) => {
  157 |     const project = representativeProjects.hero || representativeProjects.banner || representativeProjects.poster || defaultProject;
  158 |     const entry = findEntryForProject(project.id, ["hero", "banner", "poster", "thumbnail"]);
  159 |     test.skip(!entry, "No renderable media entry found for delayed media check.");
  160 | 
  161 |     await page.route((url) => mediaRequestMatches(url.toString(), entry!.resolvedUrl), async (route) => {
  162 |       await new Promise((resolve) => setTimeout(resolve, 1200));
  163 |       await route.continue();
  164 |     });
  165 | 
  166 |     const tracker = trackMediaRuntimeIssues(page);
  167 |     const context = buildRuntimeContext(page, testInfo, {
  168 |       scenario: "resilience-delayed-media",
  169 |       route: `/projects/${project.id}`,
  170 |       projectId: project.id,
  171 |       projectTitle: project.title,
  172 |       mediaKey: entry!.mediaKey,
  173 |       resolvedUrl: entry!.resolvedUrl,
  174 |       environment: process.env.NODE_ENV || "test",
  175 |     });
  176 | 
  177 |     try {
  178 |       await gotoProjectReady(page, project.id, project.title);
  179 | 
  180 |       const media = page
  181 |         .locator(
  182 |           `[data-project-id="${project.id}"][data-media-role="${entry!.mediaKey}"] img, [data-project-id="${project.id}"][data-media-role="${entry!.mediaKey}"] video`
  183 |         )
  184 |         .first();
  185 |       await expect(media).toBeVisible();
  186 |       const unexpectedPageErrors = tracker.pageErrors.filter(
  187 |         (pageError) => !isExpectedForcedMediaPageError(pageError.message)
  188 |       );
  189 |       expect(unexpectedPageErrors, "delayed media should not trigger unexpected page errors").toHaveLength(0);
  190 |     } catch (error) {
  191 |       await attachMediaContext(testInfo, "media-context", {
  192 |         ...context,
  193 |         failedResponses: tracker.failedResponses,
  194 |         failedRequests: tracker.failedRequests,
  195 |         consoleErrors: tracker.consoleErrors,
  196 |         pageErrors: tracker.pageErrors,
  197 |       });
  198 |       throw error;
  199 |     } finally {
  200 |       tracker.stop();
  201 |     }
  202 |   });
  203 | 
  204 |   test("standalone URL asset falls back gracefully on the project detail route", async ({ page }, testInfo) => {
  205 |     test.skip(!standaloneUrlAssetProject, "No standalone URL asset found in canonical projects.");
  206 | 
  207 |     const { project, asset } = standaloneUrlAssetProject!;
  208 |     const expectedState = getExpectedStandaloneAssetState(asset);
  209 |     await page.route((url) => standaloneAssetUrlMatches(url.toString(), asset.url), async (route) => {
  210 |       await route.fulfill(buildBlockedIframeResponse(503));
  211 |     });
  212 | 
  213 |     const tracker = trackMediaRuntimeIssues(page);
  214 |     const context = buildRuntimeContext(page, testInfo, {
  215 |       scenario: "standalone-url-asset-fallback-project-route",
  216 |       route: getProjectRoute(project),
  217 |       projectId: project.id,
  218 |       projectTitle: project.title,
  219 |       mediaKey: asset.id,
  220 |       resolvedUrl: asset.url,
  221 |       environment: process.env.NODE_ENV || "test",
  222 |     });
  223 | 
  224 |     try {
  225 |       await gotoProjectReady(page, project.id, project.title, getProjectRoute(project));
  226 | 
  227 |       const assetCard = page
  228 |         .locator(
  229 |           `[data-testid="project-standalone-assets"][data-project-id="${project.id}"] ` +
  230 |             `[data-testid="project-standalone-asset"][data-asset-id="${asset.id}"]`
  231 |         )
  232 |         .first();
```