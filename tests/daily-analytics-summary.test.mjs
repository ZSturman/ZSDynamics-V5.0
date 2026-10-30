import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  aggregateContentTags,
  buildContentCatalog,
  buildDeterministicAnalysis,
  buildEmail,
  buildDailyAnalyticsReport,
  buildTrafficQuality,
  createResilientGa4Client,
  enhanceWithLocalAnalysis,
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

test("flags only the documented aggregate low-engagement rule without classifying sessions", () => {
  const quality = buildTrafficQuality(
    {
      sessions: 102,
      totalUsers: 103,
      newUsers: 102,
      engagedSessions: 8,
      engagementRate: 0.078,
      averageSessionDuration: 0,
      eventCount: 360,
    },
    { sourceMedium: [{ label: "(direct) / (none)", metrics: { sessions: 102 } }] },
    { keyActionCount: 1 },
    { devices: [{ label: "desktop", metrics: { sessions: 51 } }, { label: "mobile", metrics: { sessions: 51 } }] },
    { sessionsAt10Seconds: 8, routeViewEvents: 250, knownSyntheticSessions: 0, automationSignals: 0 },
  );

  assert.equal(quality.engagedSessions, 8);
  assert.equal(quality.sessionsWithoutObservedEngagement, 94);
  assert.equal(quality.lowEngagement, true);
  assert.match(quality.reasons.join(" "), /at least 20 sessions/);
});

test("deterministic analysis avoids a misleading percentage when the baseline is tiny", () => {
  const analysis = buildDeterministicAnalysis({
    current: { sessions: 102, totalUsers: 103, screenPageViews: 150, engagedSessions: 8, engagementRate: 0.078 },
    previous: { sessions: 1 },
    trafficQuality: { rawSessions: 102, likelyHumanSessions: 8, suspicious: true, reasons: ["engagement was unusually low"] },
    traffic: { sourceMedium: [{ label: "(direct) / (none)", metrics: { sessions: 102 }, actions: 0 }] },
    content: { pages: [{ title: "Articles", views: 30, engagementRate: 0.2 }] },
    events: { highIntentActions: [] },
  });
  assert.match(analysis[0], /moved from 1 to 102/);
  assert.match(analysis[0], /percentage change is intentionally not emphasized/);
});

test("LM Studio failure preserves deterministic analysis without a paid API", async () => {
  const report = {
    meta: { dateIso: "2026-06-28" },
    current: { sessions: 1, totalUsers: 1, screenPageViews: 1, engagedSessions: 1 },
    previous: { sessions: 1 },
    scorecards: [],
    trafficQuality: { rawSessions: 1, likelyHumanSessions: 1, engagedSessions: 1, reasons: [] },
    traffic: { sourceMedium: [] }, content: { pages: [] }, events: { highIntentActions: [] }, warnings: [], analysis: ["Fallback analysis"],
  };
  const result = await enhanceWithLocalAnalysis(report, {
    endpoint: "http://127.0.0.1:1234",
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.deepEqual(result.analysis, ["Fallback analysis"]);
  assert.match(result.warnings[0], /LM Studio unavailable/);
});

test("serializes and retries temporary GA4 quota failures", async () => {
  let attempts = 0;
  let active = 0;
  let maxActive = 0;
  const client = createResilientGa4Client({
    async getMetadata() { return [{}]; },
    async runReport() {
      active += 1;
      maxActive = Math.max(maxActive, active);
      attempts += 1;
      active -= 1;
      if (attempts === 1) throw new Error("RESOURCE_EXHAUSTED: concurrent quota");
      return [{ rows: [] }];
    },
  }, { retryDelayMs: 0 });
  await Promise.all([client.runReport({ request: "one" }), client.runReport({ request: "two" })]);
  assert.equal(attempts, 3);
  assert.equal(maxActive, 1);
});

test("keeps GA4 country, region, and city aggregates privacy-preserving and separate", async () => {
  const dimensions = ["country", "region", "city", "deviceCategory", "eventName", "sessionDefaultChannelGroup", "sessionSource", "sessionMedium", "sessionCampaignName", "landingPagePlusQueryString", "pagePath", "pageTitle"];
  const client = {
    async getMetadata() { return [{ dimensions: dimensions.map((apiName) => ({ apiName })) }]; },
    async runReport(request) {
      const names = (request.dimensions || []).map((dimension) => dimension.name);
      if (names.length === 0) return [{ rows: [metricRow([3, 2, 3, 2, 0.67, 4, 14, 20])] }];
      if (names.includes("city")) return [{ rows: [dimensionMetricRow(["Seattle", "Washington"], [2, 2, 1, 0.5])] }];
      if (names.includes("region")) return [{ rows: [dimensionMetricRow(["Washington"], [2, 2, 1, 0.5])] }];
      if (names.includes("country")) return [{ rows: [dimensionMetricRow(["United States"], [3, 2, 2, 0.67])] }];
      return [{ rows: [] }];
    },
  };
  const report = await buildDailyAnalyticsReport({ client, propertyId: "123", rootDir: await fs.mkdtemp(path.join(os.tmpdir(), "analytics-geo-")), retryDelayMs: 0 });
  assert.equal(report.audience.countries[0].label, "United States");
  assert.equal(report.audience.regions[0].label, "Washington");
  assert.equal(report.audience.cities[0].label, "Seattle / Washington");
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
    "Daily Analytics Summary",
    "What Actually Happened",
    "Traffic Quality",
    "Acquisition",
    "Geography",
    "Top Content",
    "Visitor Journeys",
    "Scroll &amp; Attention",
    "Project Detail Engagement",
    "Media &amp; Fullscreen Activity",
    "Content-To-Action Flow",
    "Content Tags &amp; Custom Detail",
    "High-Intent Actions",
    "Technical / Data Quality",
    "Data Quality",
    "Custom detail unavailable",
  ]) {
    assert.match(html, new RegExp(section));
  }

  for (const section of [
    "## Daily analytics summary",
    "## What actually happened",
    "## Traffic quality",
    "## Acquisition",
    "## Geography",
    "## Content performance",
    "## Visitor journeys",
    "## Scroll and attention",
    "## Project detail engagement",
    "## Media and fullscreen activity",
    "## Content-to-action flow",
    "## Content tags",
    "## Custom detail availability",
    "## High-intent actions",
    "## Technical / data quality",
    "## Data quality",
  ]) {
    assert.match(text, new RegExp(section));
  }

  assert.equal(email.subject, "zacharysturman.com analytics - Jun 28, 2026 - 42 sessions / 11 key actions");
});

test("excludes QA sessions from every query, reports campaign conversions, and never counts failed submissions", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "analytics-qa-report-"));
  await fs.mkdir(path.join(root, "public", "projects"), { recursive: true });
  await fs.mkdir(path.join(root, "public", "articles"), { recursive: true });
  await fs.writeFile(path.join(root, "public", "projects", "projects.json"), "[]");
  await fs.writeFile(path.join(root, "public", "articles", "articles.json"), "[]");

  const requests = [];
  const row = (dims, metrics) => ({
    dimensionValues: dims.map((value) => ({ value })),
    metricValues: metrics.map((value) => ({ value: String(value) })),
  });
  const client = {
    async getMetadata() {
      return [{ dimensions: ["sessionCampaignName", "sessionSource", "sessionMedium", "eventName"].map((apiName) => ({ apiName })) }];
    },
    async runReport(request) {
      requests.push(request);
      const dimensions = (request.dimensions || []).map((dimension) => dimension.name);
      const filterText = JSON.stringify(request.dimensionFilter || {});
      if (dimensions.length === 1 && dimensions[0] === "sessionCampaignName") {
        return filterText.includes("contact_submit")
          ? [{ rows: [row(["spring-applications"], [3])] }]
          : [{ rows: [row(["spring-applications"], [4, 3])] }];
      }
      if (dimensions.includes("eventName")) {
        return [{ rows: [row(["contact_submit"], [1]), row(["contact_submit_failed"], [2]), row(["resume_download"], [2])] }];
      }
      return [{ rows: [] }];
    },
  };

  const report = await buildDailyAnalyticsReport({ client, propertyId: "1", siteName: "example.test", now: new Date("2026-10-28T15:00:00Z"), rootDir: root });

  assert.ok(requests.length > 5);
  for (const request of requests) {
    assert.match(JSON.stringify(request.dimensionFilter), /"notExpression".*"sessionSource".*"qa"/, "every query excludes QA sessions");
  }
  assert.deepEqual(
    report.traffic.campaigns.map((campaign) => [campaign.label, campaign.metrics.sessions, campaign.conversions]),
    [["spring-applications", 4, 3]],
  );
  assert.equal(report.events.keyActionCount, 3, "failed contact submissions are not key actions");
  assert.match(renderReportHtml(report), /Conversions/);
});

test("failed overview and quality queries remain unavailable while product reporting distinguishes events from sessions", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "analytics-partial-"));
  try {
    const client = {
      async getMetadata() {
        return [{ dimensions: ["eventName", "customEvent:product_slug", "customEvent:action_type"].map((apiName) => ({ apiName })) }];
      },
      async runReport(request) {
        const dimensions = request.dimensions.map((d) => d.name);
        if (!dimensions.length) throw new Error("permission denied");
        if (dimensions.includes("customEvent:product_slug")) return [{ rows: [dimensionMetricRow(["project_resource_click", "recallable", "store"], [7, 2])] }];
        if (dimensions.length === 1 && dimensions[0] === "eventName" && request.dimensionFilter?.andGroup) throw new Error("permission denied");
        return [{ rows: [] }];
      },
    };
    const report = await buildDailyAnalyticsReport({ client, propertyId: "test", rootDir: root, retryDelayMs: 0 });
    assert.equal(report.current.sessions, null);
    assert.equal(report.scorecards.find((c) => c.key === "sessions").display, "Unavailable");
    assert.equal(report.trafficQuality.knownSyntheticSessions, null);
    assert.equal(report.productActivity.available, true);
    assert.equal(report.productActivity.rows[0].metrics.eventCount, 7);
    assert.equal(report.productActivity.rows[0].metrics.sessions, 2);
    assert.match(renderReportHtml(report), /Verified installations are unavailable/);
    assert.match(renderReportText(report), /Sessions with action \(overlapping\)/);
    assert.match(report.analysis[0], /overview query is unavailable/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
