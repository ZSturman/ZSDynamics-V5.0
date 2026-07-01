import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  aggregateContentTags,
  buildContentCatalog,
  buildEmail,
  buildDailyAnalyticsReport,
  formatDelta,
  getContentForPath,
  getCustomDimensionAvailability,
  getReportDateIso,
  renderReportHtml,
  renderReportText,
} from "../scripts/daily-analytics-summary.mjs";

function metricRow(values) {
  return {
    metricValues: values.map((value) => ({ value: String(value) })),
  };
}

function dimensionMetricRow(dimensions, metrics) {
  return {
    dimensionValues: dimensions.map((value) => ({ value })),
    metricValues: metrics.map((value) => ({ value: String(value) })),
  };
}

test("selects yesterday in America/Los_Angeles instead of UTC", () => {
  assert.equal(
    getReportDateIso(new Date("2026-06-29T06:30:00Z"), "America/Los_Angeles"),
    "2026-06-27",
  );
  assert.equal(
    getReportDateIso(new Date("2026-06-29T15:00:00Z"), "America/Los_Angeles"),
    "2026-06-28",
  );
});

test("enriches known project, article, home, contact, and unknown paths", () => {
  const catalog = buildContentCatalog({
    projects: [
      {
        slug: "chewsense",
        href: "/projects/chewsense",
        title: "ChewSense",
        domain: "Technology",
        category: "Application",
        status: "Complete",
        phase: "Active",
        tags: ["AI", "Health"],
        mediums: ["Web App"],
      },
    ],
    articles: [
      {
        slug: "analytics-writeup",
        href: "/articles/analytics-writeup",
        title: "Analytics Writeup",
        series: "Portfolio Ops",
        tags: ["Analytics", "GA4"],
      },
    ],
  });

  assert.deepEqual(getContentForPath(catalog, "/projects/chewsense?utm_source=x"), {
    path: "/projects/chewsense",
    type: "Project",
    title: "ChewSense",
    slug: "chewsense",
    domain: "Technology",
    category: "Application",
    status: "Complete",
    phase: "Active",
    tags: ["AI", "Health"],
    taxonomy: ["Technology", "Application", "Complete", "Active", "Web App"],
  });
  assert.equal(getContentForPath(catalog, "/articles/analytics-writeup").series, "Portfolio Ops");
  assert.equal(getContentForPath(catalog, "/").type, "Home");
  assert.equal(getContentForPath(catalog, "/contact").type, "Contact");
  assert.equal(getContentForPath(catalog, "/unexpected/path").type, "Other");
  assert.equal(getContentForPath(catalog, "/unexpected/path").unknown, true);
});

test("aggregates content tags by page views", () => {
  assert.deepEqual(
    aggregateContentTags([
      { tags: ["AI", "Health"], views: 10 },
      { tags: ["AI", "Next.js"], views: 5 },
      { tags: [], views: 99 },
    ]),
    [
      { tag: "AI", views: 15 },
      { tag: "Health", views: 10 },
      { tag: "Next.js", views: 5 },
    ],
  );
});

test("formats deltas for positive, negative, zero, and missing baselines", () => {
  assert.equal(formatDelta(125, 100), "+25.0%");
  assert.equal(formatDelta(75, 100), "-25.0%");
  assert.equal(formatDelta(100, 100), "0.0%");
  assert.equal(formatDelta(4, 0), "new");
  assert.equal(formatDelta(0, 0), "0.0%");
  assert.equal(formatDelta(10, undefined), "no baseline");
});

test("detects available and missing GA4 custom dimensions", () => {
  const availability = getCustomDimensionAvailability(
    new Set(["customEvent:utm_source", "customEvent:project_slug"]),
    ["utm_source", "project_slug", "resource_type"],
  );

  assert.deepEqual(availability.available, [
    { param: "utm_source", dimension: "customEvent:utm_source" },
    { param: "project_slug", dimension: "customEvent:project_slug" },
  ]);
  assert.deepEqual(availability.missing, [
    { param: "resource_type", dimension: "customEvent:resource_type" },
  ]);
});

test("builds a report with local tags when custom dimensions are missing", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "analytics-report-"));
  await fs.mkdir(path.join(root, "public", "projects"), { recursive: true });
  await fs.mkdir(path.join(root, "public", "articles"), { recursive: true });
  await fs.writeFile(
    path.join(root, "public", "projects", "projects.json"),
    JSON.stringify([
      {
        slug: "mock-project",
        href: "/projects/mock-project",
        title: "Mock Project",
        domain: "Technology",
        category: "Application",
        status: "Complete",
        tags: ["Mock Tag", "Analytics"],
      },
    ]),
  );
  await fs.writeFile(path.join(root, "public", "articles", "articles.json"), "[]");

  const standardDimensions = [
    "sessionDefaultChannelGroup",
    "sessionSource",
    "sessionMedium",
    "sessionCampaignName",
    "pagePath",
    "pageTitle",
    "eventName",
    "country",
    "city",
    "deviceCategory",
    "browser",
    "operatingSystem",
  ];

  const client = {
    async getMetadata() {
      return [{ dimensions: standardDimensions.map((apiName) => ({ apiName })) }];
    },
    async runReport(request) {
      const dimensions = (request.dimensions || []).map((dimension) => dimension.name);

      if (dimensions.length === 0) {
        return [{ rows: [metricRow([12, 8, 14, 9, 0.6, 32, 75, 44])] }];
      }
      if (dimensions.includes("sessionDefaultChannelGroup")) {
        return [{ rows: [dimensionMetricRow(["Organic Social"], [7, 6])] }];
      }
      if (dimensions.includes("sessionSource") && dimensions.includes("sessionMedium")) {
        return [{ rows: [dimensionMetricRow(["linkedin", "social"], [7, 6])] }];
      }
      if (dimensions.includes("pagePath")) {
        return [{ rows: [dimensionMetricRow(["/projects/mock-project", "Mock Project"], [20, 10, 0.7, 60])] }];
      }
      if (dimensions.includes("eventName")) {
        return [{ rows: [dimensionMetricRow(["project_resource_click"], [5]), dimensionMetricRow(["page_view"], [99])] }];
      }
      if (dimensions.includes("country")) {
        return [{ rows: [dimensionMetricRow(["United States"], [10, 8])] }];
      }
      if (dimensions.includes("deviceCategory")) {
        return [{ rows: [dimensionMetricRow(["desktop"], [8])] }];
      }
      if (dimensions.includes("browser")) {
        return [{ rows: [dimensionMetricRow(["Chrome"], [8])] }];
      }
      if (dimensions.includes("operatingSystem")) {
        return [{ rows: [dimensionMetricRow(["macOS"], [8])] }];
      }
      return [{ rows: [] }];
    },
  };

  const report = await buildDailyAnalyticsReport({
    client,
    propertyId: "123456",
    siteName: "example.test",
    now: new Date("2026-06-29T15:00:00Z"),
    rootDir: root,
  });

  assert.equal(report.meta.dateIso, "2026-06-28");
  assert.equal(report.content.pages[0].title, "Mock Project");
  assert.deepEqual(report.tagInsights.tags.slice(0, 2), [
    { tag: "Analytics", views: 20 },
    { tag: "Mock Tag", views: 20 },
  ]);
  assert.equal(report.events.keyActionCount, 5);
  assert.ok(report.tagInsights.customDimensions.missing.some((item) => item.dimension === "customEvent:project_slug"));
  assert.match(renderReportText(report), /Custom detail unavailable/);
});

test("builds journey, attention, media, and action-flow sections from custom dimensions", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "analytics-journey-report-"));
  await fs.mkdir(path.join(root, "public", "projects"), { recursive: true });
  await fs.mkdir(path.join(root, "public", "articles"), { recursive: true });
  await fs.writeFile(
    path.join(root, "public", "projects", "projects.json"),
    JSON.stringify([
      {
        slug: "chewsense",
        href: "/projects/chewsense",
        title: "ChewSense",
        domain: "Technology",
        category: "Application",
        status: "Complete",
        tags: ["AI", "Health"],
      },
    ]),
  );
  await fs.writeFile(path.join(root, "public", "articles", "articles.json"), "[]");

  const standardDimensions = [
    "sessionDefaultChannelGroup",
    "sessionSource",
    "sessionMedium",
    "sessionCampaignName",
    "pagePath",
    "pageTitle",
    "eventName",
    "country",
    "city",
    "deviceCategory",
    "browser",
    "operatingSystem",
  ];
  const customParams = [
    "previous_page_group",
    "previous_page_slug",
    "page_group",
    "page_slug",
    "route_surface",
    "viewport_category",
    "scroll_percent",
    "section_key",
    "section_label",
    "project_slug",
    "article_slug",
    "item_type",
    "surface",
    "engagement_bucket",
    "interaction_type",
    "media_kind",
    "item_id",
    "collection_key",
    "progress_percent",
  ];

  const client = {
    async getMetadata() {
      return [{
        dimensions: [
          ...standardDimensions,
          ...customParams.map((param) => `customEvent:${param}`),
        ].map((apiName) => ({ apiName })),
      }];
    },
    async runReport(request) {
      const dimensions = (request.dimensions || []).map((dimension) => dimension.name);

      if (dimensions.length === 0) {
        return [{ rows: [metricRow([4, 3, 5, 4, 0.8, 12, 90, 24])] }];
      }
      if (dimensions.includes("sessionDefaultChannelGroup")) {
        return [{ rows: [dimensionMetricRow(["Organic Social"], [3, 2])] }];
      }
      if (dimensions.includes("sessionSource") && dimensions.includes("sessionMedium")) {
        return [{ rows: [dimensionMetricRow(["linkedin", "social"], [3, 2])] }];
      }
      if (dimensions.includes("pagePath")) {
        return [{ rows: [dimensionMetricRow(["/projects/chewsense", "ChewSense"], [8, 4, 0.8, 90])] }];
      }
      if (dimensions.includes("eventName") && dimensions.length === 1) {
        return [{ rows: [
          dimensionMetricRow(["portfolio_section_engaged"], [4]),
          dimensionMetricRow(["project_media_progress"], [3]),
          dimensionMetricRow(["project_resource_click"], [2]),
        ] }];
      }
      if (dimensions.includes("country")) {
        return [{ rows: [dimensionMetricRow(["United States"], [4, 3])] }];
      }
      if (dimensions.includes("deviceCategory")) {
        return [{ rows: [dimensionMetricRow(["desktop"], [4])] }];
      }
      if (dimensions.includes("browser")) {
        return [{ rows: [dimensionMetricRow(["Chrome"], [4])] }];
      }
      if (dimensions.includes("operatingSystem")) {
        return [{ rows: [dimensionMetricRow(["macOS"], [4])] }];
      }
      if (dimensions.includes("customEvent:previous_page_group")) {
        return [{ rows: [dimensionMetricRow(["home", "home", "project", "chewsense", "page", "desktop"], [3])] }];
      }
      if (
        dimensions.includes("customEvent:route_surface") &&
        dimensions.includes("customEvent:viewport_category") &&
        dimensions.length === 2
      ) {
        return [{ rows: [dimensionMetricRow(["page", "desktop"], [5])] }];
      }
      if (dimensions.includes("customEvent:scroll_percent")) {
        return [{ rows: [dimensionMetricRow(["project", "chewsense", "90"], [4])] }];
      }
      if (dimensions.includes("customEvent:engagement_bucket")) {
        return [{ rows: [dimensionMetricRow(["project_collection", "Project collection", "chewsense", "", "15s"], [4])] }];
      }
      if (
        dimensions.includes("customEvent:section_key") &&
        dimensions.includes("customEvent:item_type") &&
        dimensions.includes("customEvent:surface") &&
        !dimensions.includes("eventName")
      ) {
        return [{ rows: [dimensionMetricRow(["collection_item", "Demo clip", "chewsense", "", "video", "project_page"], [6])] }];
      }
      if (dimensions.includes("customEvent:media_kind")) {
        return [{ rows: [dimensionMetricRow(["progress", "video", "chewsense", "demo-clip", "video", "clips", "50"], [3])] }];
      }
      if (
        dimensions.includes("customEvent:interaction_type") &&
        dimensions.includes("customEvent:item_id") &&
        dimensions.includes("customEvent:surface") &&
        !dimensions.includes("customEvent:media_kind") &&
        !dimensions.includes("eventName")
      ) {
        return [{ rows: [dimensionMetricRow(["fullscreen_open", "chewsense", "demo-clip", "video", "clips", "project_page_fullscreen"], [2])] }];
      }
      if (dimensions.includes("eventName") && dimensions.includes("customEvent:section_key")) {
        return [{ rows: [dimensionMetricRow(["project_resource_click", "chewsense", "project_collection", "Project collection", "demo-clip", "project_page"], [2])] }];
      }
      return [{ rows: [] }];
    },
  };

  const report = await buildDailyAnalyticsReport({
    client,
    propertyId: "123456",
    siteName: "example.test",
    now: new Date("2026-06-29T15:00:00Z"),
    rootDir: root,
  });

  assert.equal(report.journeys.transitions[0].from, "home / home");
  assert.equal(report.journeys.transitions[0].to, "project / chewsense");
  assert.equal(report.attention.scrollDepth[0].percent, "90");
  assert.equal(report.attention.sectionEngagement[0].sectionLabel, "Project collection");
  assert.equal(report.attention.sectionViews[0].itemType, "video");
  assert.equal(report.media.mediaProgress[0].progress, "50");
  assert.equal(report.media.itemOpens[0].interaction, "fullscreen_open");
  assert.equal(report.actionFlow.rows[0].eventLabel, "Project resource click");

  const html = renderReportHtml(report);
  assert.match(html, /Visitor Journeys/);
  assert.match(html, /Scroll &amp; Attention/);
  assert.match(html, /Project Detail Engagement/);
  assert.match(html, /Media &amp; Fullscreen Activity/);
  assert.match(html, /Content-To-Action Flow/);
});

test("renders all major email sections and custom-dimension fallback", () => {
  const report = {
    meta: {
      siteName: "zacharysturman.com",
      dateIso: "2026-06-28",
      dateLabel: "Sun, Jun 28, 2026",
      generatedAtLabel: "Jun 29, 2026, 8:00 AM PDT",
      source: "Google Analytics 4 Data API + local content manifest",
    },
    scorecards: [
      {
        key: "sessions",
        label: "Sessions",
        value: 42,
        display: "42",
        previousDelta: "+20.0%",
        previousTone: "positive",
        prior7Delta: "+10.0%",
        prior7Tone: "positive",
      },
      {
        key: "screenPageViews",
        label: "Views",
        value: 84,
        display: "84",
        previousDelta: "-5.0%",
        previousTone: "negative",
        prior7Delta: "0.0%",
        prior7Tone: "neutral",
      },
    ],
    traffic: {
      sourceMedium: [
        { label: "linkedin / social", metrics: { sessions: 20, totalUsers: 18 } },
      ],
      campaigns: [
        { label: "portfolio-launch", metrics: { sessions: 12 } },
      ],
      manualUtm: {
        source: [{ label: "linkedin", metrics: { sessions: 20 } }],
        medium: [],
        campaign: [],
        content: [],
        term: [],
      },
    },
    content: {
      pages: [
        {
          title: "ChewSense",
          path: "/projects/chewsense",
          type: "Project",
          tags: ["AI", "Health"],
          views: 30,
          engagementRate: 0.75,
          averageSessionDuration: 91,
        },
      ],
    },
    tagInsights: {
      tags: [{ tag: "AI", views: 30 }],
      contentTypes: [{ label: "Project", views: 30 }],
      customDimensions: {
        missing: [{ param: "resource_type", dimension: "customEvent:resource_type" }],
        breakdowns: {
          utm_source: [{ label: "linkedin", metrics: { eventCount: 9 } }],
        },
      },
    },
    events: {
      keyActionCount: 11,
      rows: [
        {
          label: "Project resource click",
          group: "High-intent actions",
          intent: "Consideration",
          count: 11,
        },
      ],
      groups: [
        {
          group: "High-intent actions",
          count: 11,
          events: [{ label: "Project resource click", count: 11 }],
        },
      ],
    },
    audience: {
      countries: [{ label: "United States", metrics: { sessions: 32 } }],
      devices: [{ label: "desktop", metrics: { sessions: 25 } }],
      browsers: [{ label: "Chrome", metrics: { sessions: 21 } }],
      operatingSystems: [{ label: "macOS", metrics: { sessions: 18 } }],
    },
    qualityNotes: ["Content tags are enriched from local manifests."],
    warnings: ["Example warning"],
    highlights: ["ChewSense led content performance with 30 views."],
  };

  const html = renderReportHtml(report);
  const text = renderReportText(report);
  const email = buildEmail(report);

  for (const section of [
    "What Changed",
    "Acquisition Tags",
    "Top Content",
    "Visitor Journeys",
    "Scroll &amp; Attention",
    "Project Detail Engagement",
    "Media &amp; Fullscreen Activity",
    "Content-To-Action Flow",
    "Content Tags &amp; Custom Detail",
    "Key Actions",
    "Audience &amp; Tech",
    "Data Quality",
    "Custom detail unavailable",
  ]) {
    assert.match(html, new RegExp(section));
  }

  for (const section of [
    "## Scorecards",
    "## Acquisition tags",
    "## Top content",
    "## Visitor journeys",
    "## Scroll and attention",
    "## Project detail engagement",
    "## Media and fullscreen activity",
    "## Content-to-action flow",
    "## Content tags",
    "## Custom detail availability",
    "## Key actions",
    "## Audience and tech",
    "## Data quality",
  ]) {
    assert.match(text, new RegExp(section));
  }

  assert.equal(email.subject, "zacharysturman.com analytics - Jun 28, 2026 - 42 sessions / 11 key actions");
});
