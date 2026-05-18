# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: media-rendering.spec.ts >> @smoke @matrix media rendering >> collection video cards stay static and open in the fullscreen viewer
- Location: tests/media/media-rendering.spec.ts:212:7

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('[data-collection-item-id="320aec94-4d3c-8055-bfcb-e43151baab66"][data-collection-item-type="video"]').first().getByTestId('collection-video-card-media')
Expected: "frames"
Received: "poster"
Timeout:  10000ms

Call log:
  - Expect "toHaveAttribute" with timeout 10000ms
  - waiting for locator('[data-collection-item-id="320aec94-4d3c-8055-bfcb-e43151baab66"][data-collection-item-type="video"]').first().getByTestId('collection-video-card-media')
    24 × locator resolved to <button type="button" data-preview-state="poster" aria-label="Funeral preview" data-testid="collection-video-card-media" class="relative h-full w-full overflow-hidden bg-muted text-left">…</button>
       - unexpected value "poster"

```

```yaml
- button "Funeral preview":
  - img "Funeral preview"
```

# Test source

```ts
  148 |       representativeProjects["thumbnail-only"],
  149 |     ]);
  150 | 
  151 |     for (const project of candidates) {
  152 |       const route = `/projects/${project.id}`;
  153 |       await gotoProjectReady(page, project.id, project.title);
  154 | 
  155 |       const requiredRoles = getRequiredRoles(project);
  156 |       for (const mediaKey of requiredRoles) {
  157 |         const context = buildRuntimeContext(page, testInfo, {
  158 |           scenario: "project-detail-media-role",
  159 |           route,
  160 |           projectId: project.id,
  161 |           projectTitle: project.title,
  162 |           mediaKey,
  163 |           environment: process.env.NODE_ENV || "test",
  164 |         });
  165 | 
  166 |         try {
  167 |           const media = page.locator(
  168 |             `[data-project-id=\"${project.id}\"][data-media-role=\"${mediaKey}\"] img, [data-project-id=\"${project.id}\"][data-media-role=\"${mediaKey}\"] video`
  169 |           );
  170 |           const count = await media.count();
  171 |           expect(count, `project media role not rendered on detail page: ${mediaKey}`).toBeGreaterThan(0);
  172 |         } catch (error) {
  173 |           await attachMediaContext(testInfo, "media-context", context);
  174 |           throw error;
  175 |         }
  176 |       }
  177 |     }
  178 |   });
  179 | 
  180 |   test("project header preview media opens in a fullscreen lightbox", async ({ page }, testInfo) => {
  181 |     test.skip(!headerPreviewProject, "No project with hero or poster preview media found in canonical dataset.");
  182 | 
  183 |     const project = headerPreviewProject!;
  184 |     const route = getProjectRoute(project);
  185 |     await gotoProjectReady(page, project.id, project.title, route);
  186 | 
  187 |     const context = buildRuntimeContext(page, testInfo, {
  188 |       scenario: "project-header-preview-lightbox",
  189 |       route,
  190 |       projectId: project.id,
  191 |       projectTitle: project.title,
  192 |       environment: process.env.NODE_ENV || "test",
  193 |     });
  194 | 
  195 |     try {
  196 |       const trigger = page
  197 |         .locator(`[data-testid="project-header-media-trigger"][data-project-id="${project.id}"]`)
  198 |         .first();
  199 | 
  200 |       await expect(trigger).toBeVisible();
  201 |       const headerMediaRoute = `${route}?headerMedia=${getHeaderPreviewQueryValue(project)}`;
  202 |       await gotoProjectReady(page, project.id, project.title, headerMediaRoute);
  203 |       const lightbox = page.getByTestId("project-header-media-lightbox");
  204 |       await expect(lightbox).toBeVisible();
  205 |       await expect(lightbox.locator("img, video").first()).toBeVisible();
  206 |     } catch (error) {
  207 |       await attachMediaContext(testInfo, "media-context", context);
  208 |       throw error;
  209 |     }
  210 |   });
  211 | 
  212 |   test("collection video cards stay static and open in the fullscreen viewer", async ({ page }, testInfo) => {
  213 |     test.skip(!collectionVideoProject, "No project with collection-backed video items found in canonical dataset.");
  214 | 
  215 |     const { project, itemId, collectionName } = collectionVideoProject!;
  216 |     const route = getProjectRoute(project);
  217 |     await gotoProjectReady(page, project.id, project.title, route);
  218 | 
  219 |     const context = buildRuntimeContext(page, testInfo, {
  220 |       scenario: "collection-video-card-fullscreen",
  221 |       route,
  222 |       projectId: project.id,
  223 |       projectTitle: project.title,
  224 |       mediaKey: itemId,
  225 |       environment: process.env.NODE_ENV || "test",
  226 |     });
  227 | 
  228 |     try {
  229 |       if (collectionName) {
  230 |         const tab = page.getByRole("tab", { name: collectionName }).first();
  231 |         if (await tab.isVisible().catch(() => false)) {
  232 |           await tab.click();
  233 |         }
  234 |       }
  235 | 
  236 |       const card = page.locator(`[data-collection-item-id="${itemId}"][data-collection-item-type="video"]`).first();
  237 |       await expect(card).toBeVisible();
  238 |       await expect(card.locator("video")).toHaveCount(0);
  239 | 
  240 |       const preview = card.getByTestId("collection-video-card-media");
  241 |       await expect(preview).toBeVisible();
  242 |       await expect(preview).toHaveAttribute("data-preview-state", "poster");
  243 |       const previewImage = preview.locator("img").first();
  244 |       await expect(previewImage).toHaveAttribute("src", /-thumb\.jpg/i);
  245 | 
  246 |       if (!testInfo.project.name.includes("mobile")) {
  247 |         await preview.hover();
> 248 |         await expect(preview).toHaveAttribute("data-preview-state", "frames");
      |                               ^ Error: expect(locator).toHaveAttribute(expected) failed
  249 |         await expect(previewImage).toHaveAttribute("src", /-preview-\d+\.jpg/i);
  250 |         const frameSrc = decodeURIComponent((await previewImage.getAttribute("src")) || "");
  251 |         expect(frameSrc).not.toContain("-optimized.webp");
  252 |       }
  253 | 
  254 |       await gotoProjectReady(page, project.id, project.title, `${route}?collectionItem=${itemId}`);
  255 | 
  256 |       const fullscreen = page.getByTestId("collection-fullscreen");
  257 |       await expect(fullscreen).toHaveAttribute("data-collection-item-id", itemId);
  258 |       await expect(fullscreen.locator("video").first()).toBeVisible();
  259 |     } catch (error) {
  260 |       await attachMediaContext(testInfo, "media-context", context);
  261 |       throw error;
  262 |     }
  263 |   });
  264 | 
  265 |   test("collection video cards remain static on narrow viewports", async ({ page }, testInfo) => {
  266 |     test.skip(!collectionVideoProject, "No project with collection-backed video items found in canonical dataset.");
  267 | 
  268 |     await page.setViewportSize({ width: 390, height: 844 });
  269 | 
  270 |     const { project, itemId, collectionName } = collectionVideoProject!;
  271 |     const route = getProjectRoute(project);
  272 |     await gotoProjectReady(page, project.id, project.title, route);
  273 | 
  274 |     const context = buildRuntimeContext(page, testInfo, {
  275 |       scenario: "collection-video-card-mobile-like",
  276 |       route,
  277 |       projectId: project.id,
  278 |       projectTitle: project.title,
  279 |       mediaKey: itemId,
  280 |       environment: process.env.NODE_ENV || "test",
  281 |     });
  282 | 
  283 |     try {
  284 |       if (collectionName) {
  285 |         const tab = page.getByRole("tab", { name: collectionName }).first();
  286 |         if (await tab.isVisible().catch(() => false)) {
  287 |           await tab.click();
  288 |         }
  289 |       }
  290 | 
  291 |       const card = page.locator(`[data-collection-item-id="${itemId}"][data-collection-item-type="video"]`).first();
  292 |       await expect(card).toBeVisible();
  293 |       await expect(card.locator("video")).toHaveCount(0);
  294 | 
  295 |       const preview = card.getByTestId("collection-video-card-media");
  296 |       await expect(preview).toBeVisible();
  297 | 
  298 |       await gotoProjectReady(page, project.id, project.title, `${route}?collectionItem=${itemId}`);
  299 | 
  300 |       const fullscreen = page.getByTestId("collection-fullscreen");
  301 |       await expect(fullscreen).toHaveAttribute("data-collection-item-id", itemId);
  302 |       await expect(fullscreen.locator("video").first()).toBeVisible();
  303 |     } catch (error) {
  304 |       await attachMediaContext(testInfo, "media-context", context);
  305 |       throw error;
  306 |     }
  307 |   });
  308 | 
  309 |   test("project without images still renders without media crashes", async ({ page }, testInfo) => {
  310 |     const project = representativeProjects["no-images"];
  311 |     test.skip(!project, "No project without images found in canonical dataset.");
  312 | 
  313 |     const route = `/projects/${project!.id}`;
  314 |     await gotoProjectReady(page, project!.id, project!.title);
  315 | 
  316 |     const context = buildRuntimeContext(page, testInfo, {
  317 |       scenario: "project-no-image-route",
  318 |       route,
  319 |       projectId: project!.id,
  320 |       projectTitle: project!.title,
  321 |       environment: process.env.NODE_ENV || "test",
  322 |     });
  323 | 
  324 |     try {
  325 |       await expect(page.getByRole("heading", { name: project!.title }).first()).toBeVisible();
  326 | 
  327 |       const renderedMedia = page.locator(`[data-project-id="${project!.id}"][data-media-role] img, [data-project-id="${project!.id}"][data-media-role] video`);
  328 |       await expect(renderedMedia).toHaveCount(0);
  329 |     } catch (error) {
  330 |       await attachMediaContext(testInfo, "media-context", context);
  331 |       throw error;
  332 |     }
  333 |   });
  334 | 
  335 |   test("project detail route renders standalone URL asset preview state", async ({ page }, testInfo) => {
  336 |     test.skip(!standaloneUrlAssetProject, "No standalone URL asset found in canonical dataset.");
  337 | 
  338 |     const { project, asset } = standaloneUrlAssetProject!;
  339 |     const route = getProjectRoute(project);
  340 |     await gotoProjectReady(page, project.id, project.title, route);
  341 | 
  342 |     const context = buildRuntimeContext(page, testInfo, {
  343 |       scenario: "project-standalone-url-asset-preview",
  344 |       route,
  345 |       projectId: project.id,
  346 |       projectTitle: project.title,
  347 |       mediaKey: asset.id,
  348 |       environment: process.env.NODE_ENV || "test",
```