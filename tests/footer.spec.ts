import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { gotoHomeReady, gotoProjectReady } from "./helpers/route-readiness";
import {
  getProjectRoute,
  loadCanonicalProjects,
  pickDefaultProject,
} from "./media/helpers/project-media-fixtures";

type PersonalLinkFixture = {
  key: string;
  label: string;
  href: string;
  iconPattern: RegExp;
};

type ArticleFixture = {
  href: string;
  title: string;
};

const defaultPersonalLinks: PersonalLinkFixture[] = [
  {
    key: "portfolio",
    label: "Portfolio",
    href: "https://zacharysturman.com",
    iconPattern: /portfolio\.svg/i,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    href: "https://linkedin.com/in/zacharysturman",
    iconPattern: /linkedin\.svg/i,
  },
  {
    key: "x",
    label: "X",
    href: "https://x.com/XzckndhttqZ",
    iconPattern: /X\.svg/i,
  },
  {
    key: "github",
    label: "GitHub",
    href: "https://github.com/zsturman",
    iconPattern: /github\.svg/i,
  },
  {
    key: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/zachary.sturman/",
    iconPattern: /instagram\.svg/i,
  },
  {
    key: "bluesky",
    label: "Bluesky",
    href: "https://bsky.app/profile/zacharysturman.bsky.social",
    iconPattern: /bluesky\.svg/i,
  },
  {
    key: "email",
    label: "Email",
    href: "mailto:zasturman@gmail.com",
    iconPattern: /email\.svg/i,
  },
  {
    key: "threads",
    label: "Threads",
    href: "https://www.threads.com/@zachary.sturman",
    iconPattern: /threads\.svg/i,
  },
  {
    key: "imdb",
    label: "IMDb",
    href: "https://www.imdb.com/name/nm6373994/?ref_=ext_shr_lnk",
    iconPattern: /imdb\.svg/i,
  },
];

const articleFixtures = loadArticleFixtures();
const defaultArticle = articleFixtures[0];
const canonicalProjects = loadCanonicalProjects();
const defaultProject = pickDefaultProject(canonicalProjects);
const personalLinks = loadPersonalLinkFixtures();

function normalizeLinkLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function loadArticleFixtures(): ArticleFixture[] {
  const manifestPath = path.join(process.cwd(), "public", "articles", "articles.json");
  if (!fs.existsSync(manifestPath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(
    (article): article is ArticleFixture =>
      Boolean(
        article &&
          typeof article === "object" &&
          typeof article.href === "string" &&
          typeof article.title === "string"
      )
  );
}

function loadPersonalLinkFixtures(): PersonalLinkFixture[] {
  const csvPath = path.join(process.cwd(), "docs", "personal_links.csv");
  if (!fs.existsSync(csvPath)) {
    return defaultPersonalLinks;
  }

  const lines = fs
    .readFileSync(csvPath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return defaultPersonalLinks;
  }

  const [headerLine, ...dataLines] = lines;
  const headers = headerLine.split(",").map((header) => header.trim().toLowerCase());
  const fallbackByKey = new Map(defaultPersonalLinks.map((link) => [link.key, link]));
  const linksByKey = new Map<string, PersonalLinkFixture>();

  for (const line of dataLines) {
    const columns = line.split(",");
    const row = headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = columns[index]?.trim() || "";
      return accumulator;
    }, {});

    const normalizedLabel = normalizeLinkLabel(row.label || "");
    const fallbackMatch = defaultPersonalLinks.find(
      (link) =>
        link.key === normalizedLabel ||
        normalizeLinkLabel(link.label) === normalizedLabel ||
        (link.key === "bluesky" && normalizedLabel === "bsky")
    );

    if (!fallbackMatch) {
      continue;
    }

    const href = row.email ? `mailto:${row.email}` : row.url;
    if (!href) {
      continue;
    }

    linksByKey.set(fallbackMatch.key, {
      ...fallbackMatch,
      href,
    });
  }

  const resolvedLinks = defaultPersonalLinks
    .map((link) => linksByKey.get(link.key) || fallbackByKey.get(link.key))
    .filter((link): link is PersonalLinkFixture => Boolean(link));

  return resolvedLinks;
}

test.describe("Site Footer", () => {
  test("renders across home, article, project, and work-log surfaces", async ({ page }) => {
    await gotoHomeReady(page);
    await expect(page.getByTestId("site-footer")).toBeVisible();

    await page.goto("/articles");
    await expect(page.getByRole("heading", { name: "Articles" })).toBeVisible();
    await expect(page.getByTestId("site-footer")).toBeVisible();

    if (defaultArticle) {
      await page.goto(defaultArticle.href, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: defaultArticle.title })).toBeVisible();
      await expect(page.getByTestId("site-footer")).toBeVisible();
    }

    await gotoProjectReady(page, defaultProject.id, defaultProject.title, getProjectRoute(defaultProject));
    await expect(page.getByTestId("site-footer")).toBeVisible();

    await page.goto("/work-logs");
    await expect(page.getByRole("heading", { name: /Work Logs/ })).toBeVisible();
    await expect(page.getByTestId("site-footer")).toBeVisible();
  });

  test("uses source-backed links, removes Hashnode, and exposes resume actions", async ({ page }) => {
    await gotoHomeReady(page);

    const footer = page.getByTestId("site-footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText("Hashnode", { exact: false })).toHaveCount(0);

    await expect(footer.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await expect(footer.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/#projects");
    await expect(footer.getByRole("link", { name: "Articles" })).toHaveAttribute("href", "/articles");
    await expect(footer.getByRole("link", { name: "Work Logs" })).toHaveAttribute("href", "/work-logs");

    for (const link of personalLinks) {
      const footerLink = footer.getByTestId(`site-footer-link-${link.key}`);
      await expect(footerLink).toBeVisible();
      await expect(footerLink).toHaveAttribute("href", link.href);
      await expect(footerLink.locator("img")).toHaveAttribute("src", link.iconPattern);
    }

    await expect(footer.getByTestId("site-footer-link-email")).not.toHaveAttribute("target", "_blank");
    await expect(footer.getByTestId("site-footer-link-portfolio")).toHaveAttribute("target", "_blank");
    await expect(footer.getByTestId("site-footer-link-github")).toHaveAttribute("target", "_blank");
    await expect(footer.getByTestId("site-footer-link-linkedin")).toHaveAttribute("target", "_blank");
    await expect(footer.getByTestId("site-footer-link-x")).toHaveAttribute("target", "_blank");
    await expect(footer.getByTestId("site-footer-link-instagram")).toHaveAttribute("target", "_blank");
    await expect(footer.getByTestId("site-footer-link-bluesky")).toHaveAttribute("target", "_blank");
    await expect(footer.getByTestId("site-footer-link-threads")).toHaveAttribute("target", "_blank");
    await expect(footer.getByTestId("site-footer-link-imdb")).toHaveAttribute("target", "_blank");

    const resumeView = footer.getByTestId("site-footer-resume-view");
    const resumeDownload = footer.getByTestId("site-footer-resume-download");

    await expect(resumeView).toBeVisible();
    await expect(resumeView).toHaveAttribute("href", /Zachary(?:\s|%20)Sturman(?:\s|%20)Resume\.pdf$/);
    await expect(resumeView).toHaveAttribute("target", "_blank");

    await expect(resumeDownload).toBeVisible();
    await expect(resumeDownload).toHaveAttribute("href", /Zachary(?:\s|%20)Sturman(?:\s|%20)Resume\.pdf$/);
    await expect(resumeDownload).toHaveAttribute("download", "Zachary Sturman Resume.pdf");
  });
});
