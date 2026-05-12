# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: media-resilience.spec.ts >> @smoke @matrix media resilience >> collection fullscreen viewer falls back cleanly when the video asset is unreadable
- Location: tests/media/media-resilience.spec.ts:249:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('collection-fullscreen').getByTestId('collection-video-content-fallback')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByTestId('collection-fullscreen').getByTestId('collection-video-content-fallback')

```

```yaml
- navigation "Breadcrumb":
  - list:
    - listitem:
      - link "Home":
        - /url: /
    - listitem:
      - link "Projects":
        - /url: /#projects
    - listitem: Animation Collection
- banner:
  - img "Animation Collection banner"
  - img "Animation Collection icon"
  - heading "Animation Collection" [level=1]
  - paragraph: An archive of motion experiments, and finished pieces across 2D and 3D.
  - paragraph: This collection brings together a range of animations produced across different periods, tools, and creative goals. It includes 3D models and scenes developed in Blender alongside 2D animations focused on timing, clarity, and visual communication. Some works are polished and complete, while others function more as studies—short explorations of movement, structure, or technique. Together, they show how ideas evolve when approached through different dimensions and constraints. The collection is intended for viewers interested in process as much as outcome, offering a clear look at how visual ideas are tested, refined, and sometimes left intentionally unresolved.
- navigation "Project sections":
  - paragraph: On this page
  - link "Collection":
    - /url: "#collection"
  - link "Work Logs":
    - /url: "#work-logs"
  - link "Project Details":
    - /url: "#project-details"
- tablist:
  - tab "2D" [selected]
  - tab "3D"
- tabpanel "2D":
  - heading "2D" [level=3]
  - button "Funeral preview":
    - img "Funeral preview"
  - heading "Funeral" [level=4]
  - button "Easter Bunny preview":
    - img "Easter Bunny preview"
  - heading "Easter Bunny" [level=4]
  - button "Channel 5 News preview":
    - img "Channel 5 News preview"
  - heading "Channel 5 News" [level=4]
  - button "Bassackwards preview":
    - img "Bassackwards preview"
  - heading "Bassackwards" [level=4]
- button
- heading "Animation Collection" [level=1]
- text: video
- button "Previous (←)" [disabled]
- text: 1 / 4
- button "Next (→)"
- text: Your browser does not support the video tag.
- button
- button
- button "Show Info"
- heading "Work Logs" [level=3]
- link "See all logs":
  - /url: /work-logs?project=animation-collection
- heading "Created new project entry for Animation Collection" [level=4]
- text: Dec 27, 2020 12/27/2020, 4:00 PM - Dec 28, 2020 12/28/2020, 1:00 AM
- paragraph: Created new project entry for Animation Collection and added the 'Project Starter' milestones and tasks.
- text: "Duration: 1h"
- complementary:
  - heading "Project Details" [level=3]
  - text: Active (Occasional updates) Started Dec 2020 Last Updated Mar 2023
  - paragraph: Tags
  - text: Art Cartoons Comedy Blender Anime
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
```

# Test source

```ts
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
  233 |       await expect(assetCard).toBeVisible();
  234 |       await expect(assetCard.locator(`[data-link-preview-state="${expectedState}"]`).first()).toBeVisible();
  235 |     } catch (error) {
  236 |       await attachMediaContext(testInfo, "media-context", {
  237 |         ...context,
  238 |         failedResponses: tracker.failedResponses,
  239 |         failedRequests: tracker.failedRequests,
  240 |         consoleErrors: tracker.consoleErrors,
  241 |         pageErrors: tracker.pageErrors,
  242 |       });
  243 |       throw error;
  244 |     } finally {
  245 |       tracker.stop();
  246 |     }
  247 |   });
  248 | 
  249 |   test("collection fullscreen viewer falls back cleanly when the video asset is unreadable", async ({ page }, testInfo) => {
  250 |     test.skip(!collectionVideoProject, "No collection-backed video item found in canonical projects.");
  251 |     test.skip(
  252 |       testInfo.project.name.includes("mobile"),
  253 |       "Fullscreen fallback fault injection is covered on Chromium desktop for determinism."
  254 |     );
  255 | 
  256 |     const { project, item, itemId, videoUrl } = collectionVideoProject!;
  257 |     test.skip(!videoUrl, "Collection video item does not expose a predictable source path.");
  258 | 
  259 |     await page.route((url) => mediaRequestMatches(url.toString(), videoUrl), async (route) => {
  260 |       await route.fulfill({
  261 |         status: 404,
  262 |         contentType: "text/plain",
  263 |         body: "forced-collection-video-failure",
  264 |       });
  265 |     });
  266 | 
  267 |     const tracker = trackMediaRuntimeIssues(page);
  268 |     const fullscreenRoute = `${getProjectRoute(project)}?collectionItem=${itemId}`;
  269 |     const context = buildRuntimeContext(page, testInfo, {
  270 |       scenario: "collection-video-fullscreen-fallback",
  271 |       route: fullscreenRoute,
  272 |       projectId: project.id,
  273 |       projectTitle: project.title,
  274 |       mediaKey: itemId,
  275 |       resolvedUrl: videoUrl,
  276 |       environment: process.env.NODE_ENV || "test",
  277 |     });
  278 | 
  279 |     try {
  280 |       await gotoProjectReady(page, project.id, project.title, fullscreenRoute);
  281 |       const fullscreen = page.getByTestId("collection-fullscreen");
  282 |       const openedFromRoute = await fullscreen.isVisible({ timeout: 5_000 }).catch(() => false);
  283 |       if (!openedFromRoute) {
  284 |         const card = page.locator(`[data-collection-item-id="${itemId}"][data-collection-item-type="video"]`).first();
  285 |         await expect(card).toBeVisible();
  286 |         await card.click();
  287 |       }
  288 | 
  289 |       await expect(fullscreen).toBeVisible();
  290 |       await expect(fullscreen).toHaveAttribute("data-collection-item-id", itemId);
> 291 |       await expect(fullscreen.getByTestId("collection-video-content-fallback")).toBeVisible();
      |                                                                                 ^ Error: expect(locator).toBeVisible() failed
  292 |       await expect(fullscreen.locator("video")).toHaveCount(0);
  293 | 
  294 |       const hasFailure =
  295 |         tracker.failedResponses.some((failure) => mediaRequestMatches(failure.url, videoUrl)) ||
  296 |         tracker.failedRequests.some((failure) => mediaRequestMatches(failure.url, videoUrl));
  297 |       expect(hasFailure, "forced collection video failure should be visible in diagnostics").toBeTruthy();
  298 | 
  299 |       const fallbackSource = await fullscreen
  300 |         .getByTestId("collection-video-content-fallback")
  301 |         .getAttribute("data-fallback-source");
  302 |       expect(["poster", "placeholder"]).toContain(fallbackSource);
  303 |       expect(item, "collection item should remain available for fallback rendering").toBeTruthy();
  304 |     } catch (error) {
  305 |       await attachMediaContext(testInfo, "media-context", {
  306 |         ...context,
  307 |         failedResponses: tracker.failedResponses,
  308 |         failedRequests: tracker.failedRequests,
  309 |         consoleErrors: tracker.consoleErrors,
  310 |         pageErrors: tracker.pageErrors,
  311 |       });
  312 |       throw error;
  313 |     } finally {
  314 |       tracker.stop();
  315 |     }
  316 |   });
  317 | 
  318 |   test("capture-backed standalone URL previews skip iframe requests and use optimized preview assets", async ({ page }, testInfo) => {
  319 |     test.skip(!captureBackedStandaloneUrlAssetProject, "No capture-backed standalone URL asset found in canonical projects.");
  320 | 
  321 |     const { project, asset } = captureBackedStandaloneUrlAssetProject!;
  322 |     let capturedRequestCount = 0;
  323 | 
  324 |     await page.route((url) => standaloneAssetUrlMatches(url.toString(), asset.url), async (route) => {
  325 |       capturedRequestCount += 1;
  326 |       await route.abort("failed");
  327 |     });
  328 | 
  329 |     const tracker = trackMediaRuntimeIssues(page);
  330 |     const context = buildRuntimeContext(page, testInfo, {
  331 |       scenario: "standalone-url-asset-capture-preview",
  332 |       route: getProjectRoute(project),
  333 |       projectId: project.id,
  334 |       projectTitle: project.title,
  335 |       mediaKey: asset.id,
  336 |       resolvedUrl: asset.url,
  337 |       environment: process.env.NODE_ENV || "test",
  338 |     });
  339 | 
  340 |     try {
  341 |       await gotoProjectReady(page, project.id, project.title, getProjectRoute(project));
  342 | 
  343 |       const assetCard = page
  344 |         .locator(
  345 |           `[data-testid="project-standalone-assets"][data-project-id="${project.id}"] ` +
  346 |             `[data-testid="project-standalone-asset"][data-asset-id="${asset.id}"]`
  347 |         )
  348 |         .first();
  349 |       await expect(assetCard).toBeVisible();
  350 |       await expect(assetCard.locator('[data-link-preview-state="thumbnail"]').first()).toBeVisible();
  351 | 
  352 |       const previewImage = assetCard.locator('[data-link-preview-state="thumbnail"] img').last();
  353 |       await expect(previewImage).toBeVisible();
  354 |       const imageSrc = decodeURIComponent((await previewImage.getAttribute("src")) || "");
  355 |       expect(
  356 |         imageSrc,
  357 |         "capture-backed preview should render the normalized optimized asset path"
  358 |       ).toContain("-optimized.webp");
  359 | 
  360 |       await page.waitForTimeout(500);
  361 |       expect(capturedRequestCount, "capture-backed previews should skip iframe network requests").toBe(0);
  362 |     } catch (error) {
  363 |       await attachMediaContext(testInfo, "media-context", {
  364 |         ...context,
  365 |         failedResponses: tracker.failedResponses,
  366 |         failedRequests: tracker.failedRequests,
  367 |         consoleErrors: tracker.consoleErrors,
  368 |         pageErrors: tracker.pageErrors,
  369 |       });
  370 |       throw error;
  371 |     } finally {
  372 |       tracker.stop();
  373 |     }
  374 |   });
  375 | 
  376 |   test("standalone URL asset falls back gracefully inside the project modal", async ({ page }, testInfo) => {
  377 |     test.skip(testInfo.project.name.includes("mobile"), "Modal validation is desktop-specific.");
  378 |     test.skip(!standaloneUrlAssetProject, "No standalone URL asset found in canonical projects.");
  379 | 
  380 |     const { project, asset } = standaloneUrlAssetProject!;
  381 |     const expectedState = getExpectedStandaloneAssetState(asset);
  382 |     const tracker = trackMediaRuntimeIssues(page);
  383 |     const context = buildRuntimeContext(page, testInfo, {
  384 |       scenario: "standalone-url-asset-fallback-modal",
  385 |       route: `/?project=${getProjectSlug(project)}`,
  386 |       projectId: project.id,
  387 |       projectTitle: project.title,
  388 |       mediaKey: asset.id,
  389 |       resolvedUrl: asset.url,
  390 |       environment: process.env.NODE_ENV || "test",
  391 |     });
```