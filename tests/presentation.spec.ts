import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { loadCanonicalProjects } from "./media/helpers/project-media-fixtures";

const projects = loadCanonicalProjects();
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1280, height: 900 },
];
const PAGES = ["/apps", "/articles", "/work-logs", "/recallable", "/home-page","/", "/projects", "/about", "/experience", "/resume", "/explore/hardware", "/projects/hue-light-control"];

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
}

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("Professional presentation", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const viewport of VIEWPORTS) {
    test(`key pages render without overflow on ${viewport.name}`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.setViewportSize(viewport);
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        if (viewport.width < 1024) await page.getByRole("button", { name: "Open menu", exact: true }).click();
        await expect(page.getByTestId("site-nav")).toBeVisible();
        if (viewport.width < 1024) {
          await page.keyboard.press("Escape");
          await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeFocused();
        }
        await expectNoHorizontalOverflow(page);
      }
      expect(errors).toEqual([]);
    });
  }

  test("primary navigation reaches every section and marks the current page", async ({ page }) => {
    await page.goto("/about");
    const nav = page.getByTestId("site-nav");
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    for (const [name, path, heading] of [
      ["Projects", "/projects", "Projects"],
      ["Experience", "/experience", "Experience"],
      ["Résumé", "/resume", "Résumé"],
      ["Writing", "/articles", "Articles"],
    ] as const) {
      await page.getByTestId("site-nav").getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test("keyboard users can reach the homepage actions", async ({ page }) => {
    await page.goto("/");
    const target = page.getByRole("link", { name: "View selected work" });
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press("Tab");
      if (await target.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(target).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#selected-work$/);
  });

  test("résumé is downloadable from the homepage, footer, and résumé page", async ({ page, request }) => {
    const response = await request.get("/Zachary Sturman Resume.pdf");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("pdf");

    await page.goto("/resume");
    await expect(page.getByTestId("resume-page-download")).toHaveAttribute("download", "Zachary Sturman Resume.pdf");
    await expect(page.getByTestId("experience-role").first()).toBeVisible();
    await expect(page.getByText("B.S. in Media Communication")).toBeVisible();
    await expect(page.getByText(/^Seattle Central College/)).toBeVisible();
  });

  test("experience distinguishes engagement types and links related projects", async ({ page }) => {
    await page.goto("/experience");
    await expect(page.getByTestId("experience-engagement").filter({ hasText: "Contract" })).toHaveCount(1);
    await expect(page.getByTestId("experience-engagement").filter({ hasText: "Client project" })).toHaveCount(1);
    await page.getByRole("link", { name: /Related project: Lost & Hound/ }).click();
    await expect(page).toHaveURL(/\/projects\/lost-and-hound$/);
  });

  test("focus views are shareable and filter the archive", async ({ page }) => {
    await page.goto("/explore/hardware");
    await expect(page.getByRole("heading", { level: 1, name: "Hardware & Electronics" })).toBeVisible();
    await expect(page.getByText("Oscilloscope")).toBeVisible();
    await expect(page.locator('[data-project-slug="hue-light-control"]')).toBeVisible();

    await page.goto("/projects?focus=hardware");
    await expect(page.getByTestId("project-focus-hardware")).toHaveAttribute("aria-pressed", "true");
    const rows = page.locator('[data-testid="project-list-item-root"], [data-testid="project-card-root"]');
    await expect(rows.first()).toBeVisible();
    const hue = projects.find((project) => project.slug === "hue-light-control")!;
    await expect(page.locator(`[data-project-id="${hue.id}"]`).first()).toBeVisible();
    const hardwareCount = await rows.count();
    expect(hardwareCount).toBeLessThan(projects.length);

    await page.getByTestId("project-focus-all").click();
    await expect(page).not.toHaveURL(/focus=/);
    await page.getByTestId("project-evidence-download").click();
    await expect(page).toHaveURL(/has=download/);
    await expect(rows.first()).toBeVisible();
  });

  test("case-study sections render only when provided; bare projects stay compatible", async ({ page }) => {
    await page.goto("/projects/hue-light-control");
    const caseStudy = page.getByTestId("project-case-study");
    await expect(caseStudy.getByRole("heading", { name: "Validation" })).toBeVisible();
    await expect(caseStudy.getByRole("heading", { name: "Results" })).toHaveCount(0);
    await expect(page.getByTestId("project-work-logs")).toBeVisible();

    const bare = projects.find((project) => !project.caseStudy && !project.description && project.slug === "zsdynamics-10");
    test.skip(!bare, "Bare legacy project fixture required.");
    await page.goto(`/projects/${bare!.slug}`);
    await expect(page.getByRole("heading", { name: bare!.title }).first()).toBeVisible();
    await expect(page.getByTestId("project-case-study")).toHaveCount(0);
  });

  test("support links are secondary to install and demo actions", async ({ page }) => {
    const project = projects.find(
      (item) =>
        ((item.resources || []) as Array<{ label: string }>).some((r) => /support|setup|privacy|story/i.test(r.label)) &&
        ((item.resources || []) as Array<{ label: string }>).some((r) => !/support|setup|privacy|story/i.test(r.label))
    );
    test.skip(!project, "A project with primary and secondary resources is required.");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/projects/${project!.slug}`);
    await expect(page.getByTestId("project-secondary-actions").first()).toBeVisible();
  });

  test("internal links on new pages resolve", async ({ page, request }) => {
    const hrefs = new Set<string>();
    for (const path of ["/", "/about", "/experience", "/resume", "/explore/software", "/explore/research"]) {
      await page.goto(path);
      const links = await page.locator("main a[href^='/'], header a[href^='/'], section a[href^='/']").evaluateAll(
        (anchors) => anchors.map((anchor) => anchor.getAttribute("href") || "")
      );
      links.forEach((href) => hrefs.add(href.split("#")[0].split("?")[0] || "/"));
    }
    const broken: string[] = [];
    for (const href of hrefs) {
      const response = await request.get(href);
      if (response.status() >= 400) broken.push(`${href} ${response.status()}`);
    }
    expect(broken).toEqual([]);
  });

  test("homepage exposes structured person data and SEO routes", async ({ page, request }) => {
    await page.goto("/");
    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) || "{}");
    expect(jsonLd["@type"]).toBe("Person");
    expect(jsonLd.sameAs.some((url: string) => url.includes("github.com"))).toBe(true);
    expect((await request.get("/sitemap.xml")).status()).toBe(200);
    expect((await request.get("/robots.txt")).status()).toBe(200);
  });

  // axe-core arrives transitively; skip rather than add a dependency for it.
  const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");
  for (const colorScheme of ["light", "dark"] as const) {
    test(`new and core pages have no WCAG A/AA violations (${colorScheme})`, async ({ page }) => {
      test.skip(!existsSync(axePath), "axe-core is not installed.");
      await page.emulateMedia({ colorScheme });
      for (const route of PAGES) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await page.addScriptTag({ path: axePath });
        const violations = await page.evaluate(async () => {
          const result = await (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: Array<{ id: string; nodes: unknown[] }> }> } }).axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] });
          return result.violations.map((violation) => `${violation.id} (${violation.nodes.length})`);
        });
        expect(violations, route).toEqual([]);
      }
    });
  }
});
