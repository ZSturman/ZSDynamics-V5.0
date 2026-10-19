import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    (window as Window & { __ZS_DISABLE_ANALYTICS__?: boolean }).__ZS_DISABLE_ANALYTICS__ = true;
  });
  await context.route(/https:\/\/[^/]*(google-analytics\.com|googletagmanager\.com)\//, route => route.abort());
});

test("curated collection tabs load all fourteen previews", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/projects/3d-models-collection");
  await expect(page.getByRole("heading", { name: "3D Models Collection", exact: true }).first()).toBeVisible();
  for (const [name, count] of [["Selected designs", 6], ["Characters", 2], ["Scenes & studies", 2], ["Work in progress", 4]] as const) {
    await page.getByRole("tab", { name, exact: true }).click();
    const panel = page.getByRole("tabpanel").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(panel.locator('[data-testid="collection-item-card"]')).toHaveCount(count);
    for (const image of await panel.locator("img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(element =>
        (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test("published GLBs contain selected parts and isolated walk clips", async ({ request }) => {
  const response = await request.get("/api/projects/3d-models-collection.json");
  expect(response.ok()).toBe(true);
  const { data: project } = await response.json();
  const items = Object.values(project.collection as Record<string, { items: Array<{ id: string; type: string; path: string }> }>).flatMap(group => group.items);
  expect(items).toHaveLength(14);
  for (const item of items.filter(item => item.type === "3d-model")) {
    const file = await request.get(item.path);
    expect(file.ok(), item.id).toBe(true);
    const bytes = await file.body();
    expect(bytes.toString("ascii", 0, 4), item.id).toBe("glTF");
    const length = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + length));
    expect(gltf.meshes, item.id).toHaveLength(item.id === "under-desk-drawer" ? 4 : 1);
    if (item.id === "robot" || item.id === "main-character") {
      expect(gltf.skins, item.id).toHaveLength(1);
      expect(gltf.animations, item.id).toHaveLength(1);
      expect(gltf.animations[0].name).toBe(item.id === "robot" ? "Walking" : "Walking.001");
    } else {
      expect(gltf.animations || [], item.id).toHaveLength(0);
    }
  }
});

test("robot viewer loads its walking animation and closes on mobile", async ({ page }, testInfo) => {
  await page.goto("/projects/3d-models-collection");
  await page.getByRole("tab", { name: "Characters", exact: true }).click();
  const loaded = page.waitForResponse(response => /robot-[^/]+\.glb/.test(response.url()) && response.ok());
  await page.locator('[data-testid="collection-item-card"][data-collection-item-id="robot"]').click();
  await loaded;
  const viewer = page.getByTestId("collection-fullscreen");
  await expect(viewer.getByRole("heading", { name: "Robot", exact: true })).toBeVisible();
  await expect(viewer.locator("canvas")).toBeVisible();
  await expect(viewer.locator("svg.lucide-pause")).toBeVisible();
  await page.screenshot({ path: `artifacts/3d-models-${testInfo.project.name}.png` });
  await viewer.getByRole("button", { name: "Close preview" }).click();
  await expect(viewer).toHaveCount(0);
});
