#!/usr/bin/env node
/**
 * Rich daily GA4 analytics email.
 *
 * Pulls yesterday's metrics from Google Analytics Data API, enriches page rows
 * with local portfolio content metadata, renders dashboard-style HTML/text, and
 * POSTs the result to the Worker's /internal/daily-summary endpoint.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BetaAnalyticsDataClient } from "@google-analytics/data";

export const DEFAULT_TIME_ZONE = "America/Los_Angeles";
export const DEFAULT_SITE_NAME = "zacharysturman.com";
export const REPORT_SOURCE = "Google Analytics 4 Data API + local content manifest";

const DAY_MS = 24 * 60 * 60 * 1000;
const STANDARD_GA_EVENTS = new Set([
  "click",
  "file_download",
  "first_visit",
  "form_start",
  "page_view",
  "scroll",
  "session_start",
  "user_engagement",
  "view_search_results",
]);

const OVERVIEW_METRICS = [
  "totalUsers",
  "newUsers",
  "sessions",
  "engagedSessions",
  "engagementRate",
  "screenPageViews",
  "averageSessionDuration",
  "eventCount",
];

const COUNT_METRICS_FOR_DAILY_AVERAGE = new Set([
  "totalUsers",
  "newUsers",
  "sessions",
  "engagedSessions",
  "screenPageViews",
  "eventCount",
]);

export const OPTIONAL_CUSTOM_PARAMETERS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_referrer",
  "page_group",
  "page_slug",
  "project_slug",
  "article_slug",
  "resource_type",
  "social_network",
  "destination_domain",
  "surface",
  "status",
  "media_kind",
  "open_surface",
  "previous_page_group",
  "previous_page_slug",
  "route_step",
  "viewport_category",
  "route_surface",
  "modal_context",
  "section_key",
  "section_label",
  "item_id",
  "item_type",
  "item_label",
  "collection_key",
  "media_role",
  "scroll_percent",
  "engagement_bucket",
  "visible_time_sec",
  "progress_percent",
  "interaction_type",
];

const MANUAL_UTM_DIMENSIONS = [
  { key: "source", label: "Manual source", dimension: "sessionManualSource" },
  { key: "medium", label: "Manual medium", dimension: "sessionManualMedium" },
  { key: "campaign", label: "Manual campaign", dimension: "sessionManualCampaignName" },
  { key: "content", label: "Manual content", dimension: "sessionManualAdContent" },
  { key: "term", label: "Manual term", dimension: "sessionManualTerm" },
];

export const EVENT_CATALOG = {
  portfolio_route_view: {
    label: "Route view",
    group: "Navigation",
    intent: "Diagnostic",
    keyAction: false,
  },
  project_open: {
    label: "Project opened",
    group: "Content engagement",
    intent: "Engagement",
    keyAction: true,
  },
  article_open: {
    label: "Article opened",
    group: "Content engagement",
    intent: "Engagement",
    keyAction: true,
  },
  project_resource_click: {
    label: "Project resource click",
    group: "High-intent actions",
    intent: "Consideration",
    keyAction: true,
  },
  project_demo_click: {
    label: "Project demo click",
    group: "High-intent actions",
    intent: "Consideration",
    keyAction: true,
  },
  project_github_click: {
    label: "Project GitHub click",
    group: "High-intent actions",
    intent: "Consideration",
    keyAction: true,
  },
  github_click: {
    label: "GitHub click",
    group: "High-intent actions",
    intent: "Consideration",
    keyAction: true,
  },
  project_media_play: {
    label: "Project media interaction",
    group: "Content engagement",
    intent: "Engagement",
    keyAction: true,
  },
  article_source_click: {
    label: "Article source click",
    group: "High-intent actions",
    intent: "Consideration",
    keyAction: true,
  },
  outbound_click: {
    label: "Outbound link click",
    group: "Outbound engagement",
    intent: "Consideration",
    keyAction: true,
  },
  social_click: {
    label: "Social profile click",
    group: "Outbound engagement",
    intent: "Consideration",
    keyAction: true,
  },
  resume_view: {
    label: "Resume viewed",
    group: "Conversion signals",
    intent: "Conversion",
    keyAction: true,
  },
  resume_download: {
    label: "Resume downloaded",
    group: "Conversion signals",
    intent: "Conversion",
    keyAction: true,
  },
  contact_click: {
    label: "Contact intent",
    group: "Conversion signals",
    intent: "Conversion",
    keyAction: true,
  },
  contact_submit: {
    label: "Contact form submitted",
    group: "Conversion signals",
    intent: "Conversion",
    keyAction: true,
  },
  newsletter_interest: {
    label: "Newsletter interest",
    group: "Conversion signals",
    intent: "Conversion",
    keyAction: true,
  },
  automation_signal: {
    label: "Automation signal",
    group: "Data quality",
    intent: "Diagnostic",
    keyAction: false,
  },
  portfolio_scroll_depth: {
    label: "Scroll depth milestone",
    group: "Attention",
    intent: "Engagement",
    keyAction: false,
  },
  portfolio_section_view: {
    label: "Section viewed",
    group: "Attention",
    intent: "Engagement",
    keyAction: false,
  },
  portfolio_section_engaged: {
    label: "Section engaged",
    group: "Attention",
    intent: "Engagement",
    keyAction: true,
  },
  project_item_open: {
    label: "Project item opened",
    group: "Content engagement",
    intent: "Engagement",
    keyAction: true,
  },
  project_media_progress: {
    label: "Project media progress",
    group: "Content engagement",
    intent: "Engagement",
    keyAction: true,
  },
};

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rowValue(row, idx) {
  return row?.metricValues?.[idx]?.value ?? "0";
}

function rowDim(row, idx) {
  return row?.dimensionValues?.[idx]?.value ?? "(not set)";
}

function toTitleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanDimension(value, fallback = "Unattributed") {
  const text = String(value ?? "").trim();
  if (!text || text === "(not set)" || text === "(not provided)" || text === "not set") {
    return fallback;
  }
  return text;
}

function normalizePathname(value) {
  if (!value) return "/";

  let pathname = String(value).trim();
  try {
    pathname = new URL(pathname, "https://example.test").pathname;
  } catch {
    pathname = pathname.split("?")[0].split("#")[0];
  }

  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  pathname = pathname.replace(/\/{2,}/g, "/");
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
  return pathname || "/";
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()) : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}

export function addDaysIso(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

export function getDatePartsInTimeZone(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const keyed = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(keyed.year),
    month: Number(keyed.month),
    day: Number(keyed.day),
  };
}

export function getReportDateIso(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = getDatePartsInTimeZone(now, timeZone);
  const localTodayUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  return new Date(localTodayUtc - DAY_MS).toISOString().slice(0, 10);
}

export function formatDateLabel(isoDate, options = {}) {
  const { weekday = false } = options;
  const date = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: weekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatGeneratedAt(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatInteger(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numberOrZero(value));
}

export function formatDecimal(value, digits = 1) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(numberOrZero(value));
}

export function formatPercent(value, digits = 1) {
  return `${formatDecimal(numberOrZero(value) * 100, digits)}%`;
}

export function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(numberOrZero(seconds)));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (minutes < 60) {
    return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatDelta(current, baseline) {
  const currentValue = numberOrZero(current);
  if (baseline === null || baseline === undefined || !Number.isFinite(Number(baseline))) {
    return "no baseline";
  }

  const baselineValue = Number(baseline);
  if (baselineValue === 0) {
    return currentValue > 0 ? "new" : "0.0%";
  }

  const pct = ((currentValue - baselineValue) / Math.abs(baselineValue)) * 100;
  if (Math.abs(pct) < 0.05) return "0.0%";
  return `${pct > 0 ? "+" : ""}${formatDecimal(pct, 1)}%`;
}

function deltaTone(current, baseline) {
  const currentValue = numberOrZero(current);
  const baselineValue = Number(baseline);
  if (!Number.isFinite(baselineValue) || baselineValue === 0) {
    return currentValue > 0 ? "positive" : "neutral";
  }
  if (currentValue > baselineValue) return "positive";
  if (currentValue < baselineValue) return "negative";
  return "neutral";
}

function formatMetricValue(value, format) {
  if (format === "percent") return formatPercent(value);
  if (format === "duration") return formatDuration(value);
  if (format === "decimal") return formatDecimal(value);
  return formatInteger(value);
}

function averageBenchmark(key, value) {
  const metricValue = numberOrZero(value);
  return COUNT_METRICS_FOR_DAILY_AVERAGE.has(key) ? metricValue / 7 : metricValue;
}

function parseOverviewRow(row) {
  const values = Object.fromEntries(OVERVIEW_METRICS.map((metric, index) => [metric, numberOrZero(rowValue(row, index))]));
  values.viewsPerSession = values.sessions > 0 ? values.screenPageViews / values.sessions : 0;
  return values;
}

function buildScorecards(current, previous, prior7) {
  const cards = [
    { key: "sessions", label: "Sessions", format: "integer" },
    { key: "totalUsers", label: "Users", format: "integer" },
    { key: "newUsers", label: "New users", format: "integer" },
    { key: "screenPageViews", label: "Views", format: "integer" },
    { key: "viewsPerSession", label: "Views / session", format: "decimal" },
    { key: "engagedSessions", label: "Engaged sessions", format: "integer" },
    { key: "engagementRate", label: "Engagement rate", format: "percent" },
    { key: "averageSessionDuration", label: "Avg. session", format: "duration" },
    { key: "eventCount", label: "Events", format: "integer" },
  ];

  return cards.map((card) => {
    const value = numberOrZero(current[card.key]);
    const previousValue = numberOrZero(previous[card.key]);
    const prior7Value = card.key === "viewsPerSession"
      ? (numberOrZero(prior7.sessions) > 0 ? numberOrZero(prior7.screenPageViews) / numberOrZero(prior7.sessions) : 0)
      : averageBenchmark(card.key, prior7[card.key]);

    return {
      ...card,
      value,
      display: formatMetricValue(value, card.format),
      previousValue,
      previousDelta: formatDelta(value, previousValue),
      previousTone: deltaTone(value, previousValue),
      prior7Value,
      prior7Delta: formatDelta(value, prior7Value),
      prior7Tone: deltaTone(value, prior7Value),
    };
  });
}

function getEventDefinition(eventName) {
  return EVENT_CATALOG[eventName] ?? {
    label: toTitleCase(eventName),
    group: "Other tracked events",
    intent: "Engagement",
    keyAction: false,
  };
}

function isPortfolioEvent(eventName) {
  if (EVENT_CATALOG[eventName]) return true;
  return !STANDARD_GA_EVENTS.has(eventName);
}

function mapBreakdownRows(rows, dimensions, metrics, options = {}) {
  const { limit = rows.length, skipUnattributed = false } = options;
  return rows
    .map((row) => {
      const dimensionValues = dimensions.map((dimension, index) => ({
        key: dimension,
        value: cleanDimension(rowDim(row, index)),
      }));
      const metricValues = Object.fromEntries(metrics.map((metric, index) => [metric, numberOrZero(rowValue(row, index))]));
      const label = dimensionValues.map((entry) => entry.value).join(" / ");
      return {
        label,
        dimensions: Object.fromEntries(dimensionValues.map((entry) => [entry.key, entry.value])),
        metrics: metricValues,
      };
    })
    .filter((row) => !skipUnattributed || row.label !== "Unattributed")
    .slice(0, limit);
}

export function buildContentCatalog({ projects = [], articles = [] } = {}) {
  const entries = new Map();

  const addEntry = (pathname, entry) => {
    entries.set(normalizePathname(pathname), {
      path: normalizePathname(pathname),
      tags: [],
      taxonomy: [],
      ...entry,
    });
  };

  addEntry("/", {
    type: "Home",
    title: "Home",
    description: "Portfolio homepage",
    taxonomy: ["site"],
  });
  addEntry("/contact", {
    type: "Contact",
    title: "Contact",
    description: "Contact and newsletter page",
    taxonomy: ["conversion"],
  });
  addEntry("/articles", {
    type: "Article index",
    title: "Articles",
    description: "Article index",
    taxonomy: ["articles"],
  });
  addEntry("/projects", {
    type: "Project index",
    title: "Projects",
    description: "Project index",
    taxonomy: ["projects"],
  });
  addEntry("/work-logs", {
    type: "Work logs",
    title: "Work logs",
    description: "Work log index",
    taxonomy: ["work-logs"],
  });

  for (const project of projects) {
    if (!project || typeof project !== "object" || typeof project.slug !== "string") continue;
    const tags = safeArray(project.tags);
    const taxonomy = unique([
      project.domain,
      project.category,
      project.status,
      project.phase,
      ...safeArray(project.mediums),
      ...safeArray(project.genres),
      ...safeArray(project.topics),
      ...safeArray(project.subjects),
    ]);
    const entry = compactObject({
      type: "Project",
      title: project.title || project.name || project.slug,
      slug: project.slug,
      domain: project.domain,
      category: project.category,
      status: project.status,
      phase: project.phase,
      tags,
      taxonomy,
    });
    addEntry(project.href || `/projects/${project.slug}`, entry);
    addEntry(`/projects/${project.slug}`, entry);
  }

  for (const article of articles) {
    if (!article || typeof article !== "object" || typeof article.slug !== "string") continue;
    const tags = safeArray(article.tags);
    const entry = compactObject({
      type: "Article",
      title: article.title || article.slug,
      slug: article.slug,
      series: article.series,
      publishedAt: article.publishedAt,
      tags,
      taxonomy: unique([article.series, ...tags]),
    });
    addEntry(article.href || `/articles/${article.slug}`, entry);
    addEntry(`/articles/${article.slug}`, entry);
  }

  return {
    entries,
    lookup(pathname) {
      return getContentForPath({ entries }, pathname);
    },
  };
}

export function getContentForPath(catalog, pathname) {
  const normalized = normalizePathname(pathname);
  const entries = catalog?.entries instanceof Map ? catalog.entries : new Map();
  const direct = entries.get(normalized);
  if (direct) return direct;

  const segments = normalized.split("/").filter(Boolean);
  if (segments[0] === "projects" && segments[1]) {
    return {
      path: normalized,
      type: "Project",
      title: toTitleCase(segments[1]),
      slug: segments[1],
      tags: [],
      taxonomy: ["projects"],
      unknown: true,
    };
  }

  if (segments[0] === "articles" && segments[1]) {
    return {
      path: normalized,
      type: "Article",
      title: toTitleCase(segments[1]),
      slug: segments[1],
      tags: [],
      taxonomy: ["articles"],
      unknown: true,
    };
  }

  return {
    path: normalized,
    type: "Other",
    title: normalized,
    tags: [],
    taxonomy: [],
    unknown: true,
  };
}

async function readJsonArray(filePath, warnings) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.data)) return parsed.data;
    warnings.push(`Expected an array in ${path.relative(process.cwd(), filePath)}.`);
  } catch (error) {
    warnings.push(`Could not read ${path.relative(process.cwd(), filePath)}: ${error.message}`);
  }
  return [];
}

export async function loadContentCatalog(rootDir = process.cwd(), warnings = []) {
  const [projects, articles] = await Promise.all([
    readJsonArray(path.join(rootDir, "public", "projects", "projects.json"), warnings),
    readJsonArray(path.join(rootDir, "public", "articles", "articles.json"), warnings),
  ]);
  return buildContentCatalog({ projects, articles });
}

export function aggregateContentTags(pageRows, options = {}) {
  const { limit = 12 } = options;
  const weights = new Map();

  for (const row of pageRows) {
    const tags = safeArray(row.tags);
    const views = numberOrZero(row.views);
    for (const tag of tags) {
      const key = tag.trim();
      weights.set(key, (weights.get(key) ?? 0) + views);
    }
  }

  return [...weights.entries()]
    .map(([tag, views]) => ({ tag, views }))
    .sort((left, right) => right.views - left.views || left.tag.localeCompare(right.tag))
    .slice(0, limit);
}

function aggregateBy(pageRows, key, limit = 8) {
  const weights = new Map();
  for (const row of pageRows) {
    const value = row[key];
    if (!value) continue;
    weights.set(value, (weights.get(value) ?? 0) + numberOrZero(row.views));
  }

  return [...weights.entries()]
    .map(([label, views]) => ({ label, views }))
    .sort((left, right) => right.views - left.views || left.label.localeCompare(right.label))
    .slice(0, limit);
}

export function getCustomDimensionAvailability(availableDimensions, params = OPTIONAL_CUSTOM_PARAMETERS) {
  const dimensionSet = availableDimensions instanceof Set ? availableDimensions : new Set(availableDimensions || []);
  const available = [];
  const missing = [];

  for (const param of params) {
    const dimension = `customEvent:${param}`;
    if (dimensionSet.has(dimension)) {
      available.push({ param, dimension });
    } else {
      missing.push({ param, dimension });
    }
  }

  return { available, missing };
}

async function getMetadata(client, propertyId, warnings) {
  try {
    const [metadata] = await client.getMetadata({ name: `properties/${propertyId}/metadata` });
    return {
      available: true,
      dimensions: new Set((metadata.dimensions || []).map((dimension) => dimension.apiName).filter(Boolean)),
      metrics: new Set((metadata.metrics || []).map((metric) => metric.apiName).filter(Boolean)),
    };
  } catch (error) {
    warnings.push(`GA4 metadata unavailable, using safe fallbacks: ${error.message}`);
    return {
      available: false,
      dimensions: new Set(),
      metrics: new Set(),
    };
  }
}

function canQueryDimensions(metadata, dimensions, options = {}) {
  const { requireMetadata = false } = options;
  if (!metadata.available) return !requireMetadata;
  return dimensions.every((dimension) => metadata.dimensions.has(dimension));
}

function customDimension(param) {
  return `customEvent:${param}`;
}

function eventNameFilter(eventNames) {
  const values = Array.isArray(eventNames) ? eventNames : [eventNames];
  return {
    filter: {
      fieldName: "eventName",
      inListFilter: { values },
    },
  };
}

async function runReport(client, propertyId, input) {
  const {
    metrics,
    dimensions = [],
    dateRanges,
    limit,
    orderBy,
    dimensionFilter,
  } = input;

  const request = {
    property: `properties/${propertyId}`,
    dateRanges,
    metrics: metrics.map((name) => ({ name })),
    dimensions: dimensions.map((name) => ({ name })),
    limit,
  };

  if (orderBy) {
    request.orderBys = [{ metric: { metricName: orderBy }, desc: true }];
  }

  if (dimensionFilter) {
    request.dimensionFilter = dimensionFilter;
  }

  const [response] = await client.runReport(request);
  return response.rows || [];
}

async function safeReport(label, warnings, fn) {
  try {
    return await fn();
  } catch (error) {
    warnings.push(`${label} unavailable: ${error.message}`);
    return [];
  }
}

function dateRange(startDate, endDate = startDate) {
  return [{ startDate, endDate }];
}

async function fetchOverview(client, propertyId, isoDate, warnings, label) {
  const rows = await safeReport(label, warnings, () => runReport(client, propertyId, {
    metrics: OVERVIEW_METRICS,
    dateRanges: dateRange(isoDate),
  }));
  return parseOverviewRow(rows[0]);
}

async function fetchOverviewRange(client, propertyId, startDate, endDate, warnings, label) {
  const rows = await safeReport(label, warnings, () => runReport(client, propertyId, {
    metrics: OVERVIEW_METRICS,
    dateRanges: dateRange(startDate, endDate),
  }));
  return parseOverviewRow(rows[0]);
}

async function fetchBreakdown(client, propertyId, input, metadata, warnings) {
  const {
    label,
    dateIso,
    dimensions,
    metrics = ["sessions"],
    orderBy = metrics[0],
    limit = 10,
    requireMetadata = false,
    skipUnattributed = false,
    warnMissing = true,
    dimensionFilter,
  } = input;

  if (!canQueryDimensions(metadata, dimensions, { requireMetadata })) {
    if (warnMissing) {
      warnings.push(`${label} unavailable because GA4 does not expose ${dimensions.join(", ")}.`);
    }
    return [];
  }

  const rows = await safeReport(label, warnings, () => runReport(client, propertyId, {
    dimensions,
    metrics,
    orderBy,
    limit,
    dimensionFilter,
    dateRanges: dateRange(dateIso),
  }));
  return mapBreakdownRows(rows, dimensions, metrics, { limit, skipUnattributed });
}

function buildEventRows(rows) {
  return rows
    .map((row) => {
      const name = rowDim(row, 0);
      const count = numberOrZero(rowValue(row, 0));
      const definition = getEventDefinition(name);
      return {
        name,
        count,
        ...definition,
      };
    })
    .filter((event) => event.count > 0 && isPortfolioEvent(event.name))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function groupEvents(events) {
  const groups = new Map();
  for (const event of events) {
    const current = groups.get(event.group) ?? {
      group: event.group,
      count: 0,
      events: [],
    };
    current.count += event.count;
    current.events.push(event);
    groups.set(event.group, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      events: group.events.sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    }))
    .sort((left, right) => right.count - left.count || left.group.localeCompare(right.group));
}

function getKeyActionCount(events) {
  return events
    .filter((event) => event.keyAction)
    .reduce((sum, event) => sum + numberOrZero(event.count), 0);
}

function enrichPageRows(rows, catalog) {
  return rows.map((row) => {
    const pathname = normalizePathname(rowDim(row, 0));
    const pageTitle = cleanDimension(rowDim(row, 1), "");
    const content = getContentForPath(catalog, pathname);
    const views = numberOrZero(rowValue(row, 0));
    const users = numberOrZero(rowValue(row, 1));
    const engagementRate = numberOrZero(rowValue(row, 2));
    const averageSessionDuration = numberOrZero(rowValue(row, 3));

    return {
      path: pathname,
      pageTitle,
      title: content.title || pageTitle || pathname,
      type: content.type,
      slug: content.slug,
      domain: content.domain,
      category: content.category,
      status: content.status,
      phase: content.phase,
      series: content.series,
      tags: safeArray(content.tags),
      taxonomy: safeArray(content.taxonomy),
      unknown: Boolean(content.unknown),
      views,
      users,
      engagementRate,
      averageSessionDuration,
    };
  });
}

function buildHighlights(report) {
  const highlights = [];
  const sessions = report.scorecards.find((card) => card.key === "sessions");
  const views = report.scorecards.find((card) => card.key === "screenPageViews");
  const topSource = report.traffic.sourceMedium[0] || report.traffic.channelGroups[0];
  const topPage = report.content.pages[0];
  const topTag = report.tagInsights.tags[0];
  const topEvent = report.events.rows.find((event) => event.keyAction) || report.events.rows[0];
  const topTransition = report.journeys?.transitions?.[0];
  const topEngagedSection = report.attention?.sectionEngagement?.[0];
  const topMedia = report.media?.mediaProgress?.[0] || report.media?.itemOpens?.[0];

  if (sessions) {
    highlights.push(`Sessions were ${sessions.previousDelta} vs. the previous day and ${sessions.prior7Delta} vs. the prior 7-day daily average.`);
  }
  if (views) {
    highlights.push(`Views were ${views.previousDelta} day over day with ${views.display} total page views.`);
  }
  if (topSource) {
    highlights.push(`${topSource.label} was the leading traffic source with ${formatInteger(topSource.metrics.sessions)} sessions.`);
  }
  if (topPage) {
    highlights.push(`${topPage.title} led content performance with ${formatInteger(topPage.views)} views.`);
  }
  if (topTag) {
    highlights.push(`${topTag.tag} was the strongest local content tag with ${formatInteger(topTag.views)} attributed views.`);
  }
  if (topEvent) {
    highlights.push(`${topEvent.label} was the top tracked action with ${formatInteger(topEvent.count)} events.`);
  }
  if (topTransition) {
    highlights.push(`The leading journey path was ${topTransition.from} -> ${topTransition.to} with ${formatInteger(topTransition.count)} route events.`);
  }
  if (topEngagedSection) {
    highlights.push(`${topEngagedSection.sectionLabel} had the strongest section attention with ${formatInteger(topEngagedSection.count)} ${topEngagedSection.bucket} engagement events.`);
  }
  if (topMedia) {
    const mediaLabel = topMedia.itemId || topMedia.projectSlug || topMedia.mediaKind || topMedia.itemType || "media";
    highlights.push(`${mediaLabel} led media/detail interaction with ${formatInteger(topMedia.count)} events.`);
  }

  return highlights.slice(0, 5);
}

async function fetchCustomDimensionBreakdowns(client, propertyId, dateIso, metadata, warnings) {
  const availability = getCustomDimensionAvailability(metadata.dimensions);
  const breakdowns = {};

  if (!metadata.available) {
    return {
      available: [],
      missing: OPTIONAL_CUSTOM_PARAMETERS.map((param) => ({ param, dimension: `customEvent:${param}` })),
      breakdowns,
    };
  }

  for (const item of availability.available) {
    const rows = await fetchBreakdown(client, propertyId, {
      label: `Custom detail ${item.param}`,
      dateIso,
      dimensions: [item.dimension],
      metrics: ["eventCount"],
      orderBy: "eventCount",
      limit: 8,
      requireMetadata: true,
      skipUnattributed: true,
    }, metadata, warnings);
    breakdowns[item.param] = rows;
  }

  return {
    ...availability,
    breakdowns,
  };
}

async function fetchTraffic(client, propertyId, dateIso, metadata, warnings) {
  const [channelGroups, sourceMedium, campaigns] = await Promise.all([
    fetchBreakdown(client, propertyId, {
      label: "Channel groups",
      dateIso,
      dimensions: ["sessionDefaultChannelGroup"],
      metrics: ["sessions", "totalUsers"],
      orderBy: "sessions",
      limit: 8,
    }, metadata, warnings),
    fetchBreakdown(client, propertyId, {
      label: "Source / medium",
      dateIso,
      dimensions: ["sessionSource", "sessionMedium"],
      metrics: ["sessions", "totalUsers"],
      orderBy: "sessions",
      limit: 10,
    }, metadata, warnings),
    fetchBreakdown(client, propertyId, {
      label: "Campaigns",
      dateIso,
      dimensions: ["sessionCampaignName"],
      metrics: ["sessions"],
      orderBy: "sessions",
      limit: 10,
      skipUnattributed: true,
    }, metadata, warnings),
  ]);

  const manualUtm = {};
  for (const item of MANUAL_UTM_DIMENSIONS) {
    manualUtm[item.key] = await fetchBreakdown(client, propertyId, {
      label: item.label,
      dateIso,
      dimensions: [item.dimension],
      metrics: ["sessions"],
      orderBy: "sessions",
      limit: 8,
      skipUnattributed: true,
      warnMissing: false,
    }, metadata, warnings);
  }

  return { channelGroups, sourceMedium, campaigns, manualUtm };
}

async function fetchContent(client, propertyId, dateIso, catalog, warnings) {
  let rows;
  try {
    rows = await runReport(client, propertyId, {
      dimensions: ["pagePath", "pageTitle"],
      metrics: ["screenPageViews", "totalUsers", "engagementRate", "averageSessionDuration"],
      orderBy: "screenPageViews",
      limit: 15,
      dateRanges: dateRange(dateIso),
    });
  } catch (error) {
    warnings.push(`Top content engagement metrics unavailable: ${error.message}`);
    rows = await safeReport("Top content basic metrics", warnings, () => runReport(client, propertyId, {
      dimensions: ["pagePath", "pageTitle"],
      metrics: ["screenPageViews", "totalUsers"],
      orderBy: "screenPageViews",
      limit: 15,
      dateRanges: dateRange(dateIso),
    }));
  }

  const pages = enrichPageRows(rows, catalog);
  return {
    pages,
    types: aggregateBy(pages, "type"),
    domains: aggregateBy(pages, "domain"),
    categories: aggregateBy(pages, "category"),
  };
}

async function fetchEvents(client, propertyId, dateIso, warnings) {
  const rows = await safeReport("Tracked events", warnings, () => runReport(client, propertyId, {
    dimensions: ["eventName"],
    metrics: ["eventCount"],
    orderBy: "eventCount",
    limit: 80,
    dateRanges: dateRange(dateIso),
  }));
  const eventRows = buildEventRows(rows);
  const groups = groupEvents(eventRows);
  return {
    rows: eventRows,
    groups,
    keyActionCount: getKeyActionCount(eventRows),
  };
}

function metricCount(row, metricName = "eventCount") {
  return numberOrZero(row.metrics?.[metricName]);
}

function compactBreakdownLabel(parts) {
  return parts
    .map((part) => cleanDimension(part, ""))
    .filter(Boolean)
    .join(" / ") || "Unattributed";
}

async function fetchJourneyInsights(client, propertyId, dateIso, metadata, warnings) {
  const routeDims = [
    customDimension("previous_page_group"),
    customDimension("previous_page_slug"),
    customDimension("page_group"),
    customDimension("page_slug"),
    customDimension("route_surface"),
    customDimension("viewport_category"),
  ];

  const transitionRows = await fetchBreakdown(client, propertyId, {
    label: "Visitor journey transitions",
    dateIso,
    dimensions: routeDims,
    metrics: ["eventCount"],
    orderBy: "eventCount",
    limit: 12,
    requireMetadata: true,
    warnMissing: false,
    dimensionFilter: eventNameFilter("portfolio_route_view"),
  }, metadata, warnings);

  const surfaceRows = await fetchBreakdown(client, propertyId, {
    label: "Route surfaces",
    dateIso,
    dimensions: [customDimension("route_surface"), customDimension("viewport_category")],
    metrics: ["eventCount"],
    orderBy: "eventCount",
    limit: 8,
    requireMetadata: true,
    warnMissing: false,
    dimensionFilter: eventNameFilter("portfolio_route_view"),
  }, metadata, warnings);

  return {
    transitions: transitionRows.map((row) => ({
      from: compactBreakdownLabel([row.dimensions[routeDims[0]], row.dimensions[routeDims[1]]]),
      to: compactBreakdownLabel([row.dimensions[routeDims[2]], row.dimensions[routeDims[3]]]),
      surface: cleanDimension(row.dimensions[routeDims[4]], "page"),
      viewport: cleanDimension(row.dimensions[routeDims[5]], "unknown"),
      count: metricCount(row),
    })),
    surfaces: surfaceRows.map((row) => ({
      surface: cleanDimension(row.dimensions[customDimension("route_surface")], "page"),
      viewport: cleanDimension(row.dimensions[customDimension("viewport_category")], "unknown"),
      count: metricCount(row),
    })),
  };
}

async function fetchAttentionInsights(client, propertyId, dateIso, metadata, warnings) {
  const scrollDims = [
    customDimension("page_group"),
    customDimension("page_slug"),
    customDimension("scroll_percent"),
  ];
  const sectionDims = [
    customDimension("section_key"),
    customDimension("section_label"),
    customDimension("project_slug"),
    customDimension("article_slug"),
    customDimension("item_type"),
    customDimension("surface"),
  ];
  const engagementDims = [
    customDimension("section_key"),
    customDimension("section_label"),
    customDimension("project_slug"),
    customDimension("article_slug"),
    customDimension("engagement_bucket"),
  ];

  const [scrollRows, sectionRows, engagementRows] = await Promise.all([
    fetchBreakdown(client, propertyId, {
      label: "Scroll depth milestones",
      dateIso,
      dimensions: scrollDims,
      metrics: ["eventCount"],
      orderBy: "eventCount",
      limit: 12,
      requireMetadata: true,
      warnMissing: false,
      dimensionFilter: eventNameFilter("portfolio_scroll_depth"),
    }, metadata, warnings),
    fetchBreakdown(client, propertyId, {
      label: "Section views",
      dateIso,
      dimensions: sectionDims,
      metrics: ["eventCount"],
      orderBy: "eventCount",
      limit: 18,
      requireMetadata: true,
      warnMissing: false,
      dimensionFilter: eventNameFilter("portfolio_section_view"),
    }, metadata, warnings),
    fetchBreakdown(client, propertyId, {
      label: "Section engagement",
      dateIso,
      dimensions: engagementDims,
      metrics: ["eventCount"],
      orderBy: "eventCount",
      limit: 18,
      requireMetadata: true,
      warnMissing: false,
      dimensionFilter: eventNameFilter("portfolio_section_engaged"),
    }, metadata, warnings),
  ]);

  const sectionViews = sectionRows.map((row) => ({
    sectionKey: cleanDimension(row.dimensions[sectionDims[0]], "unknown"),
    sectionLabel: cleanDimension(row.dimensions[sectionDims[1]], cleanDimension(row.dimensions[sectionDims[0]], "unknown")),
    projectSlug: cleanDimension(row.dimensions[sectionDims[2]], ""),
    articleSlug: cleanDimension(row.dimensions[sectionDims[3]], ""),
    itemType: cleanDimension(row.dimensions[sectionDims[4]], ""),
    surface: cleanDimension(row.dimensions[sectionDims[5]], ""),
    count: metricCount(row),
  }));

  return {
    scrollDepth: scrollRows.map((row) => ({
      page: compactBreakdownLabel([row.dimensions[scrollDims[0]], row.dimensions[scrollDims[1]]]),
      percent: cleanDimension(row.dimensions[scrollDims[2]], "0"),
      count: metricCount(row),
    })),
    sectionViews,
    sectionEngagement: engagementRows.map((row) => ({
      sectionKey: cleanDimension(row.dimensions[engagementDims[0]], "unknown"),
      sectionLabel: cleanDimension(row.dimensions[engagementDims[1]], cleanDimension(row.dimensions[engagementDims[0]], "unknown")),
      projectSlug: cleanDimension(row.dimensions[engagementDims[2]], ""),
      articleSlug: cleanDimension(row.dimensions[engagementDims[3]], ""),
      bucket: cleanDimension(row.dimensions[engagementDims[4]], ""),
      count: metricCount(row),
    })),
  };
}

async function fetchMediaInsights(client, propertyId, dateIso, metadata, warnings) {
  const mediaDims = [
    customDimension("interaction_type"),
    customDimension("media_kind"),
    customDimension("project_slug"),
    customDimension("item_id"),
    customDimension("item_type"),
    customDimension("collection_key"),
    customDimension("progress_percent"),
  ];
  const itemDims = [
    customDimension("interaction_type"),
    customDimension("project_slug"),
    customDimension("item_id"),
    customDimension("item_type"),
    customDimension("collection_key"),
    customDimension("surface"),
  ];

  const [mediaRows, itemRows] = await Promise.all([
    fetchBreakdown(client, propertyId, {
      label: "Media progress",
      dateIso,
      dimensions: mediaDims,
      metrics: ["eventCount"],
      orderBy: "eventCount",
      limit: 16,
      requireMetadata: true,
      warnMissing: false,
      dimensionFilter: eventNameFilter("project_media_progress"),
    }, metadata, warnings),
    fetchBreakdown(client, propertyId, {
      label: "Project item opens",
      dateIso,
      dimensions: itemDims,
      metrics: ["eventCount"],
      orderBy: "eventCount",
      limit: 16,
      requireMetadata: true,
      warnMissing: false,
      dimensionFilter: eventNameFilter("project_item_open"),
    }, metadata, warnings),
  ]);

  return {
    mediaProgress: mediaRows.map((row) => ({
      interaction: cleanDimension(row.dimensions[mediaDims[0]], ""),
      mediaKind: cleanDimension(row.dimensions[mediaDims[1]], ""),
      projectSlug: cleanDimension(row.dimensions[mediaDims[2]], ""),
      itemId: cleanDimension(row.dimensions[mediaDims[3]], ""),
      itemType: cleanDimension(row.dimensions[mediaDims[4]], ""),
      collectionKey: cleanDimension(row.dimensions[mediaDims[5]], ""),
      progress: cleanDimension(row.dimensions[mediaDims[6]], ""),
      count: metricCount(row),
    })),
    itemOpens: itemRows.map((row) => ({
      interaction: cleanDimension(row.dimensions[itemDims[0]], ""),
      projectSlug: cleanDimension(row.dimensions[itemDims[1]], ""),
      itemId: cleanDimension(row.dimensions[itemDims[2]], ""),
      itemType: cleanDimension(row.dimensions[itemDims[3]], ""),
      collectionKey: cleanDimension(row.dimensions[itemDims[4]], ""),
      surface: cleanDimension(row.dimensions[itemDims[5]], ""),
      count: metricCount(row),
    })),
  };
}

async function fetchActionFlowInsights(client, propertyId, dateIso, metadata, warnings) {
  const actionDims = [
    "eventName",
    customDimension("project_slug"),
    customDimension("section_key"),
    customDimension("section_label"),
    customDimension("item_id"),
    customDimension("surface"),
  ];
  const actionEvents = [
    "project_resource_click",
    "project_demo_click",
    "project_github_click",
    "github_click",
    "article_source_click",
    "outbound_click",
    "social_click",
    "resume_view",
    "resume_download",
    "contact_click",
    "contact_submit",
    "newsletter_interest",
  ];

  const rows = await fetchBreakdown(client, propertyId, {
    label: "Content to action flow",
    dateIso,
    dimensions: actionDims,
    metrics: ["eventCount"],
    orderBy: "eventCount",
    limit: 18,
    requireMetadata: true,
    warnMissing: false,
    dimensionFilter: eventNameFilter(actionEvents),
  }, metadata, warnings);

  return {
    rows: rows.map((row) => ({
      eventName: row.dimensions.eventName,
      eventLabel: getEventDefinition(row.dimensions.eventName).label,
      projectSlug: cleanDimension(row.dimensions[customDimension("project_slug")], ""),
      sectionKey: cleanDimension(row.dimensions[customDimension("section_key")], ""),
      sectionLabel: cleanDimension(row.dimensions[customDimension("section_label")], ""),
      itemId: cleanDimension(row.dimensions[customDimension("item_id")], ""),
      surface: cleanDimension(row.dimensions[customDimension("surface")], ""),
      count: metricCount(row),
    })),
  };
}

async function fetchAudience(client, propertyId, dateIso, metadata, warnings) {
  const [countries, cities, devices, browsers, operatingSystems] = await Promise.all([
    fetchBreakdown(client, propertyId, {
      label: "Countries",
      dateIso,
      dimensions: ["country"],
      metrics: ["sessions", "totalUsers"],
      orderBy: "sessions",
      limit: 8,
    }, metadata, warnings),
    fetchBreakdown(client, propertyId, {
      label: "Cities",
      dateIso,
      dimensions: ["city"],
      metrics: ["sessions"],
      orderBy: "sessions",
      limit: 8,
      skipUnattributed: true,
    }, metadata, warnings),
    fetchBreakdown(client, propertyId, {
      label: "Devices",
      dateIso,
      dimensions: ["deviceCategory"],
      metrics: ["sessions"],
      orderBy: "sessions",
      limit: 5,
    }, metadata, warnings),
    fetchBreakdown(client, propertyId, {
      label: "Browsers",
      dateIso,
      dimensions: ["browser"],
      metrics: ["sessions"],
      orderBy: "sessions",
      limit: 5,
    }, metadata, warnings),
    fetchBreakdown(client, propertyId, {
      label: "Operating systems",
      dateIso,
      dimensions: ["operatingSystem"],
      metrics: ["sessions"],
      orderBy: "sessions",
      limit: 5,
    }, metadata, warnings),
  ]);

  return { countries, cities, devices, browsers, operatingSystems };
}

export async function buildDailyAnalyticsReport(options) {
  const {
    client,
    propertyId,
    siteName = DEFAULT_SITE_NAME,
    timeZone = DEFAULT_TIME_ZONE,
    now = new Date(),
    rootDir = process.cwd(),
    dateIso = getReportDateIso(now, timeZone),
  } = options;

  const warnings = [];
  const previousDate = addDaysIso(dateIso, -1);
  const prior7Start = addDaysIso(dateIso, -7);
  const prior7End = addDaysIso(dateIso, -1);

  const [catalog, metadata] = await Promise.all([
    loadContentCatalog(rootDir, warnings),
    getMetadata(client, propertyId, warnings),
  ]);

  const [
    current,
    previous,
    prior7,
    traffic,
    content,
    events,
    audience,
    customDimensions,
    journeys,
    attention,
    media,
    actionFlow,
  ] = await Promise.all([
    fetchOverview(client, propertyId, dateIso, warnings, "Overview"),
    fetchOverview(client, propertyId, previousDate, warnings, "Previous-day overview"),
    fetchOverviewRange(client, propertyId, prior7Start, prior7End, warnings, "Prior 7-day overview"),
    fetchTraffic(client, propertyId, dateIso, metadata, warnings),
    fetchContent(client, propertyId, dateIso, catalog, warnings),
    fetchEvents(client, propertyId, dateIso, warnings),
    fetchAudience(client, propertyId, dateIso, metadata, warnings),
    fetchCustomDimensionBreakdowns(client, propertyId, dateIso, metadata, warnings),
    fetchJourneyInsights(client, propertyId, dateIso, metadata, warnings),
    fetchAttentionInsights(client, propertyId, dateIso, metadata, warnings),
    fetchMediaInsights(client, propertyId, dateIso, metadata, warnings),
    fetchActionFlowInsights(client, propertyId, dateIso, metadata, warnings),
  ]);

  const scorecards = buildScorecards(current, previous, prior7);
  const tagInsights = {
    tags: aggregateContentTags(content.pages),
    contentTypes: content.types,
    domains: content.domains,
    categories: content.categories,
    customDimensions,
  };

  const report = {
    meta: {
      siteName,
      dateIso,
      dateLabel: formatDateLabel(dateIso, { weekday: true }),
      previousDate,
      prior7Start,
      prior7End,
      generatedAtIso: now.toISOString(),
      generatedAtLabel: formatGeneratedAt(now, timeZone),
      timeZone,
      source: REPORT_SOURCE,
    },
    scorecards,
    traffic,
    content,
    events,
    journeys,
    attention,
    media,
    actionFlow,
    tagInsights,
    audience,
    qualityNotes: [
      "Content tags, domains, categories, statuses, and series are enriched from the local portfolio manifests.",
      customDimensions.missing.length > 0
        ? "Some event-level custom details are not registered as GA4 custom dimensions yet, so the report shows available built-in attribution plus local content tags."
        : "All recommended event-level custom dimensions are available in GA4 metadata.",
    ],
    warnings: unique(warnings),
  };

  return {
    ...report,
    highlights: buildHighlights(report),
  };
}

function renderPill(label) {
  return `<span style="display:inline-block;margin:0 4px 4px 0;padding:3px 7px;border:1px solid #d8dee9;border-radius:999px;background:#f8fafc;color:#334155;font-size:12px;line-height:16px">${escapeHtml(label)}</span>`;
}

function renderEmpty(message = "No data for this period.") {
  return `<p style="margin:8px 0 0;color:#64748b;font-size:13px">${escapeHtml(message)}</p>`;
}

function renderSectionTitle(title, subtitle = "") {
  return `<tr><td style="padding:28px 28px 8px">
    <h2 style="margin:0;color:#0f172a;font-size:18px;line-height:24px">${escapeHtml(title)}</h2>
    ${subtitle ? `<p style="margin:4px 0 0;color:#64748b;font-size:13px;line-height:19px">${escapeHtml(subtitle)}</p>` : ""}
  </td></tr>`;
}

function renderTable(headers, rows) {
  if (rows.length === 0) return renderEmpty();
  const head = headers
    .map((header) => `<th align="${header.align || "left"}" style="padding:9px 10px;border-bottom:1px solid #d8dee9;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(header.label)}</th>`)
    .join("");
  const body = rows
    .map((row) => `<tr>${row
      .map((cell) => `<td align="${cell.align || "left"}" style="padding:10px;border-bottom:1px solid #e5e7eb;color:${cell.muted ? "#64748b" : "#0f172a"};font-size:13px;line-height:18px;vertical-align:top">${cell.html ? cell.value : escapeHtml(cell.value)}</td>`)
      .join("")}</tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">${`<thead><tr style="background:#f8fafc">${head}</tr></thead><tbody>${body}</tbody>`}</table>`;
}

function renderScorecards(scorecards) {
  const cells = scorecards
    .map((card) => {
      const prevColor = card.previousTone === "positive" ? "#047857" : card.previousTone === "negative" ? "#b91c1c" : "#64748b";
      const avgColor = card.prior7Tone === "positive" ? "#047857" : card.prior7Tone === "negative" ? "#b91c1c" : "#64748b";
      return `<td width="33.333%" style="padding:8px;vertical-align:top">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;background:#ffffff">
          <tr><td style="padding:14px">
            <div style="color:#64748b;font-size:12px;line-height:16px;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(card.label)}</div>
            <div style="margin-top:6px;color:#0f172a;font-size:26px;line-height:32px;font-weight:700">${escapeHtml(card.display)}</div>
            <div style="margin-top:8px;color:${prevColor};font-size:12px;line-height:17px">Prev day: ${escapeHtml(card.previousDelta)}</div>
            <div style="color:${avgColor};font-size:12px;line-height:17px">7-day avg: ${escapeHtml(card.prior7Delta)}</div>
          </td></tr>
        </table>
      </td>`;
    });

  const rows = [];
  for (let i = 0; i < cells.length; i += 3) {
    rows.push(`<tr>${cells.slice(i, i + 3).join("")}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows.join("")}</table>`;
}

function renderHighlights(highlights) {
  if (highlights.length === 0) return renderEmpty("No highlights available yet.");
  return `<ul style="margin:0;padding:0 0 0 18px;color:#0f172a;font-size:14px;line-height:21px">${highlights
    .map((highlight) => `<li style="margin:0 0 7px">${escapeHtml(highlight)}</li>`)
    .join("")}</ul>`;
}

function renderTrafficSection(report) {
  const sourceRows = report.traffic.sourceMedium.map((row) => [
    { value: row.label },
    { value: formatInteger(row.metrics.sessions), align: "right" },
    { value: formatInteger(row.metrics.totalUsers), align: "right" },
  ]);
  const campaignRows = report.traffic.campaigns.map((row) => [
    { value: row.label },
    { value: formatInteger(row.metrics.sessions), align: "right" },
  ]);

  const manualRows = Object.entries(report.traffic.manualUtm)
    .flatMap(([key, rows]) => rows.slice(0, 5).map((row) => [
      { value: toTitleCase(key) },
      { value: row.label },
      { value: formatInteger(row.metrics.sessions), align: "right" },
    ]));

  return `${renderSectionTitle("Acquisition Tags", "Where the day came from, including built-in acquisition and any available UTM dimensions.")}
  <tr><td style="padding:0 28px 14px">
    ${renderTable(
      [
        { label: "Source / medium" },
        { label: "Sessions", align: "right" },
        { label: "Users", align: "right" },
      ],
      sourceRows,
    )}
  </td></tr>
  <tr><td style="padding:0 28px 14px">
    ${renderTable(
      [
        { label: "Campaign" },
        { label: "Sessions", align: "right" },
      ],
      campaignRows,
    )}
  </td></tr>
  <tr><td style="padding:0 28px">
    ${renderTable(
      [
        { label: "UTM field" },
        { label: "Value" },
        { label: "Sessions", align: "right" },
      ],
      manualRows,
    )}
  </td></tr>`;
}

function renderContentSection(report) {
  const pageRows = report.content.pages.map((page) => [
    {
      value: `<strong>${escapeHtml(page.title)}</strong><br><span style="color:#64748b">${escapeHtml(page.path)}</span>`,
      html: true,
    },
    { value: page.type },
    { value: page.tags.slice(0, 4).map(renderPill).join("") || `<span style="color:#94a3b8">No local tags</span>`, html: true },
    { value: formatInteger(page.views), align: "right" },
    { value: formatPercent(page.engagementRate), align: "right" },
    { value: formatDuration(page.averageSessionDuration), align: "right" },
  ]);

  return `${renderSectionTitle("Top Content", "Pages enriched with project/article metadata from the local manifests.")}
  <tr><td style="padding:0 28px">
    ${renderTable(
      [
        { label: "Page" },
        { label: "Type" },
        { label: "Tags" },
        { label: "Views", align: "right" },
        { label: "Engagement", align: "right" },
        { label: "Avg. session", align: "right" },
      ],
      pageRows,
    )}
  </td></tr>`;
}

function renderJourneySection(report) {
  const transitionRows = (report.journeys?.transitions || []).map((row) => [
    { value: row.from },
    { value: row.to },
    { value: row.surface },
    { value: row.viewport },
    { value: formatInteger(row.count), align: "right" },
  ]);
  const surfaceRows = (report.journeys?.surfaces || []).map((row) => [
    { value: row.surface },
    { value: row.viewport },
    { value: formatInteger(row.count), align: "right" },
  ]);

  return `${renderSectionTitle("Visitor Journeys", "Aggregate route paths and modal/full-page browsing context.")}
  <tr><td style="padding:0 28px 14px">
    ${renderTable(
      [
        { label: "From" },
        { label: "To" },
        { label: "Surface" },
        { label: "Viewport" },
        { label: "Events", align: "right" },
      ],
      transitionRows,
    )}
  </td></tr>
  <tr><td style="padding:0 28px">
    ${renderTable(
      [
        { label: "Surface" },
        { label: "Viewport" },
        { label: "Route views", align: "right" },
      ],
      surfaceRows,
    )}
  </td></tr>`;
}

function renderAttentionSection(report) {
  const scrollRows = (report.attention?.scrollDepth || []).map((row) => [
    { value: row.page },
    { value: `${row.percent}%`, align: "right" },
    { value: formatInteger(row.count), align: "right" },
  ]);
  const engagementRows = (report.attention?.sectionEngagement || []).map((row) => [
    { value: row.sectionLabel },
    { value: row.projectSlug || row.articleSlug || "Site" },
    { value: row.bucket },
    { value: formatInteger(row.count), align: "right" },
  ]);

  return `${renderSectionTitle("Scroll & Attention", "Depth milestones and sections that stayed meaningfully visible.")}
  <tr><td style="padding:0 28px 14px">
    ${renderTable(
      [
        { label: "Page" },
        { label: "Depth", align: "right" },
        { label: "Events", align: "right" },
      ],
      scrollRows,
    )}
  </td></tr>
  <tr><td style="padding:0 28px">
    ${renderTable(
      [
        { label: "Section" },
        { label: "Content" },
        { label: "Visible" },
        { label: "Events", align: "right" },
      ],
      engagementRows,
    )}
  </td></tr>`;
}

function renderProjectDetailSection(report) {
  const detailRows = (report.attention?.sectionViews || [])
    .filter((row) => row.projectSlug || row.itemType || row.surface?.includes("project"))
    .map((row) => [
      { value: row.sectionLabel },
      { value: row.projectSlug || "Project surface" },
      { value: row.itemType || row.surface || "section" },
      { value: formatInteger(row.count), align: "right" },
    ]);

  return `${renderSectionTitle("Project Detail Engagement", "Project sections, collection items, assets, work logs, and related detail that entered view.")}
  <tr><td style="padding:0 28px">
    ${renderTable(
      [
        { label: "Detail" },
        { label: "Project" },
        { label: "Kind" },
        { label: "Views", align: "right" },
      ],
      detailRows,
    )}
  </td></tr>`;
}

function renderMediaSection(report) {
  const openRows = (report.media?.itemOpens || []).map((row) => [
    { value: row.projectSlug || "Project" },
    { value: row.itemId || "Item" },
    { value: row.itemType || row.collectionKey || "item" },
    { value: row.interaction || row.surface || "open" },
    { value: formatInteger(row.count), align: "right" },
  ]);
  const progressRows = (report.media?.mediaProgress || []).map((row) => [
    { value: row.projectSlug || "Project" },
    { value: row.mediaKind || row.itemType || "media" },
    { value: row.interaction || "interaction" },
    { value: row.progress ? `${row.progress}%` : "n/a", align: "right" },
    { value: formatInteger(row.count), align: "right" },
  ]);

  return `${renderSectionTitle("Media & Fullscreen Activity", "Collection/fullscreen opens plus video, audio, model, game, and link-preview interactions.")}
  <tr><td style="padding:0 28px 14px">
    ${renderTable(
      [
        { label: "Project" },
        { label: "Item" },
        { label: "Kind" },
        { label: "Interaction" },
        { label: "Events", align: "right" },
      ],
      openRows,
    )}
  </td></tr>
  <tr><td style="padding:0 28px">
    ${renderTable(
      [
        { label: "Project" },
        { label: "Media" },
        { label: "Interaction" },
        { label: "Progress", align: "right" },
        { label: "Events", align: "right" },
      ],
      progressRows,
    )}
  </td></tr>`;
}

function renderActionFlowSection(report) {
  const rows = (report.actionFlow?.rows || []).map((row) => [
    { value: row.eventLabel },
    { value: row.projectSlug || "Site" },
    { value: row.sectionLabel || row.sectionKey || "Unknown section" },
    { value: row.itemId || row.surface || "n/a" },
    { value: formatInteger(row.count), align: "right" },
  ]);

  return `${renderSectionTitle("Content-To-Action Flow", "Which visible project/article context preceded high-intent actions.")}
  <tr><td style="padding:0 28px">
    ${renderTable(
      [
        { label: "Action" },
        { label: "Content" },
        { label: "Section" },
        { label: "Item / surface" },
        { label: "Events", align: "right" },
      ],
      rows,
    )}
  </td></tr>`;
}

function renderTagInsights(report) {
  const tagRows = report.tagInsights.tags.map((tag) => [
    { value: tag.tag },
    { value: formatInteger(tag.views), align: "right" },
  ]);
  const typeRows = report.tagInsights.contentTypes.map((type) => [
    { value: type.label },
    { value: formatInteger(type.views), align: "right" },
  ]);
  const customRows = Object.entries(report.tagInsights.customDimensions.breakdowns)
    .flatMap(([param, rows]) => rows.slice(0, 5).map((row) => [
      { value: param },
      { value: row.label },
      { value: formatInteger(row.metrics.eventCount), align: "right" },
    ]));

  const missing = report.tagInsights.customDimensions.missing.map((item) => item.dimension);

  return `${renderSectionTitle("Content Tags & Custom Detail", "Local content taxonomy plus GA4 custom dimensions when registered.")}
  <tr><td style="padding:0 28px 14px">
    ${renderTable(
      [
        { label: "Local tag" },
        { label: "Views", align: "right" },
      ],
      tagRows,
    )}
  </td></tr>
  <tr><td style="padding:0 28px 14px">
    ${renderTable(
      [
        { label: "Content type" },
        { label: "Views", align: "right" },
      ],
      typeRows,
    )}
  </td></tr>
  <tr><td style="padding:0 28px 14px">
    ${renderTable(
      [
        { label: "Custom field" },
        { label: "Value" },
        { label: "Events", align: "right" },
      ],
      customRows,
    )}
  </td></tr>
  <tr><td style="padding:0 28px">
    <p style="margin:0;color:#64748b;font-size:13px;line-height:19px">${missing.length > 0
      ? `Custom detail unavailable until registered in GA4: ${escapeHtml(missing.slice(0, 10).join(", "))}${missing.length > 10 ? "..." : ""}.`
      : "All recommended custom dimensions are available."}</p>
  </td></tr>`;
}

function renderEventsSection(report) {
  const eventRows = report.events.rows.map((event) => [
    { value: event.label },
    { value: event.group },
    { value: event.intent },
    { value: formatInteger(event.count), align: "right" },
  ]);

  const groupRows = report.events.groups.map((group) => [
    { value: group.group },
    { value: group.events.slice(0, 3).map((event) => event.label).join(", "), muted: true },
    { value: formatInteger(group.count), align: "right" },
  ]);

  return `${renderSectionTitle("Key Actions", `${formatInteger(report.events.keyActionCount)} key actions from tracked portfolio events.`)}
  <tr><td style="padding:0 28px 14px">
    ${renderTable(
      [
        { label: "Group" },
        { label: "Top events" },
        { label: "Events", align: "right" },
      ],
      groupRows,
    )}
  </td></tr>
  <tr><td style="padding:0 28px">
    ${renderTable(
      [
        { label: "Event" },
        { label: "Group" },
        { label: "Intent" },
        { label: "Count", align: "right" },
      ],
      eventRows,
    )}
  </td></tr>`;
}

function renderAudienceSection(report) {
  const audienceRows = [
    ...report.audience.countries.slice(0, 5).map((row) => ["Country", row.label, row.metrics.sessions]),
    ...report.audience.devices.slice(0, 5).map((row) => ["Device", row.label, row.metrics.sessions]),
    ...report.audience.browsers.slice(0, 5).map((row) => ["Browser", row.label, row.metrics.sessions]),
    ...report.audience.operatingSystems.slice(0, 5).map((row) => ["OS", row.label, row.metrics.sessions]),
  ].map(([kind, label, sessions]) => [
    { value: kind },
    { value: label },
    { value: formatInteger(sessions), align: "right" },
  ]);

  return `${renderSectionTitle("Audience & Tech", "Geography, device, browser, and OS context.")}
  <tr><td style="padding:0 28px">
    ${renderTable(
      [
        { label: "Kind" },
        { label: "Value" },
        { label: "Sessions", align: "right" },
      ],
      audienceRows,
    )}
  </td></tr>`;
}

function renderQualitySection(report) {
  const notes = [...report.qualityNotes, ...report.warnings.map((warning) => `Warning: ${warning}`)];
  return `${renderSectionTitle("Data Quality", "Notes that affect interpretation.")}
  <tr><td style="padding:0 28px 30px">
    <ul style="margin:0;padding:0 0 0 18px;color:#475569;font-size:13px;line-height:20px">${notes
      .map((note) => `<li style="margin:0 0 6px">${escapeHtml(note)}</li>`)
      .join("")}</ul>
  </td></tr>`;
}

export function renderReportHtml(report) {
  const sessions = report.scorecards.find((card) => card.key === "sessions")?.display ?? "0";
  const keyActions = formatInteger(report.events.keyActionCount);

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eef2f7">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:860px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe3ef;border-radius:12px;overflow:hidden">
        <tr><td style="padding:30px 28px;background:#0f172a;color:#ffffff">
          <div style="color:#cbd5e1;font-size:13px;line-height:18px">${escapeHtml(report.meta.dateLabel)} &middot; generated ${escapeHtml(report.meta.generatedAtLabel)}</div>
          <h1 style="margin:8px 0 0;font-size:28px;line-height:34px;font-weight:750">${escapeHtml(report.meta.siteName)} analytics</h1>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:15px;line-height:22px">${escapeHtml(sessions)} sessions / ${escapeHtml(keyActions)} key actions</p>
          <p style="margin:14px 0 0;color:#94a3b8;font-size:12px;line-height:18px">Source: ${escapeHtml(report.meta.source)}</p>
        </td></tr>
        <tr><td style="padding:22px 20px 6px">${renderScorecards(report.scorecards)}</td></tr>
        ${renderSectionTitle("What Changed", "A short readout before the detail tables.")}
        <tr><td style="padding:0 28px">${renderHighlights(report.highlights)}</td></tr>
        ${renderTrafficSection(report)}
        ${renderContentSection(report)}
        ${renderJourneySection(report)}
        ${renderAttentionSection(report)}
        ${renderProjectDetailSection(report)}
        ${renderMediaSection(report)}
        ${renderActionFlowSection(report)}
        ${renderTagInsights(report)}
        ${renderEventsSection(report)}
        ${renderAudienceSection(report)}
        ${renderQualitySection(report)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderTextRows(headers, rows) {
  if (rows.length === 0) return "(no data)";
  return [
    headers.join(" | "),
    "-".repeat(headers.join(" | ").length),
    ...rows.map((row) => row.join(" | ")),
  ].join("\n");
}

export function renderReportText(report) {
  const lines = [
    `${report.meta.siteName} analytics - ${report.meta.dateLabel}`,
    `Generated: ${report.meta.generatedAtLabel}`,
    `Source: ${report.meta.source}`,
    "",
    "## Scorecards",
    renderTextRows(
      ["Metric", "Value", "Prev day", "7-day avg"],
      report.scorecards.map((card) => [card.label, card.display, card.previousDelta, card.prior7Delta]),
    ),
    "",
    "## What changed",
    ...(report.highlights.length ? report.highlights.map((item) => `- ${item}`) : ["(no highlights)"]),
    "",
    "## Acquisition tags",
    renderTextRows(
      ["Source / medium", "Sessions", "Users"],
      report.traffic.sourceMedium.map((row) => [
        row.label,
        formatInteger(row.metrics.sessions),
        formatInteger(row.metrics.totalUsers),
      ]),
    ),
    "",
    "## Top content",
    renderTextRows(
      ["Page", "Type", "Tags", "Views", "Engagement"],
      report.content.pages.map((page) => [
        `${page.title} (${page.path})`,
        page.type,
        page.tags.slice(0, 4).join(", ") || "No local tags",
        formatInteger(page.views),
        formatPercent(page.engagementRate),
      ]),
    ),
    "",
    "## Visitor journeys",
    renderTextRows(
      ["From", "To", "Surface", "Viewport", "Events"],
      (report.journeys?.transitions || []).map((row) => [
        row.from,
        row.to,
        row.surface,
        row.viewport,
        formatInteger(row.count),
      ]),
    ),
    "",
    "## Scroll and attention",
    renderTextRows(
      ["Page", "Depth", "Events"],
      (report.attention?.scrollDepth || []).map((row) => [
        row.page,
        `${row.percent}%`,
        formatInteger(row.count),
      ]),
    ),
    "",
    renderTextRows(
      ["Section", "Content", "Visible", "Events"],
      (report.attention?.sectionEngagement || []).map((row) => [
        row.sectionLabel,
        row.projectSlug || row.articleSlug || "Site",
        row.bucket,
        formatInteger(row.count),
      ]),
    ),
    "",
    "## Project detail engagement",
    renderTextRows(
      ["Detail", "Project", "Kind", "Views"],
      (report.attention?.sectionViews || [])
        .filter((row) => row.projectSlug || row.itemType || row.surface?.includes("project"))
        .map((row) => [
          row.sectionLabel,
          row.projectSlug || "Project surface",
          row.itemType || row.surface || "section",
          formatInteger(row.count),
        ]),
    ),
    "",
    "## Media and fullscreen activity",
    renderTextRows(
      ["Project", "Item", "Kind", "Interaction", "Events"],
      (report.media?.itemOpens || []).map((row) => [
        row.projectSlug || "Project",
        row.itemId || "Item",
        row.itemType || row.collectionKey || "item",
        row.interaction || row.surface || "open",
        formatInteger(row.count),
      ]),
    ),
    "",
    renderTextRows(
      ["Project", "Media", "Interaction", "Progress", "Events"],
      (report.media?.mediaProgress || []).map((row) => [
        row.projectSlug || "Project",
        row.mediaKind || row.itemType || "media",
        row.interaction || "interaction",
        row.progress ? `${row.progress}%` : "n/a",
        formatInteger(row.count),
      ]),
    ),
    "",
    "## Content-to-action flow",
    renderTextRows(
      ["Action", "Content", "Section", "Item / surface", "Events"],
      (report.actionFlow?.rows || []).map((row) => [
        row.eventLabel,
        row.projectSlug || "Site",
        row.sectionLabel || row.sectionKey || "Unknown section",
        row.itemId || row.surface || "n/a",
        formatInteger(row.count),
      ]),
    ),
    "",
    "## Content tags",
    renderTextRows(
      ["Tag", "Views"],
      report.tagInsights.tags.map((tag) => [tag.tag, formatInteger(tag.views)]),
    ),
    "",
    "## Custom detail availability",
    report.tagInsights.customDimensions.missing.length
      ? `Custom detail unavailable until registered in GA4: ${report.tagInsights.customDimensions.missing.map((item) => item.dimension).join(", ")}`
      : "All recommended custom dimensions are available.",
    "",
    "## Key actions",
    renderTextRows(
      ["Event", "Group", "Intent", "Count"],
      report.events.rows.map((event) => [event.label, event.group, event.intent, formatInteger(event.count)]),
    ),
    "",
    "## Audience and tech",
    renderTextRows(
      ["Kind", "Value", "Sessions"],
      [
        ...report.audience.countries.slice(0, 5).map((row) => ["Country", row.label, formatInteger(row.metrics.sessions)]),
        ...report.audience.devices.slice(0, 5).map((row) => ["Device", row.label, formatInteger(row.metrics.sessions)]),
        ...report.audience.browsers.slice(0, 5).map((row) => ["Browser", row.label, formatInteger(row.metrics.sessions)]),
        ...report.audience.operatingSystems.slice(0, 5).map((row) => ["OS", row.label, formatInteger(row.metrics.sessions)]),
      ],
    ),
    "",
    "## Data quality",
    ...[...report.qualityNotes, ...report.warnings.map((warning) => `Warning: ${warning}`)].map((note) => `- ${note}`),
  ];

  return lines.join("\n");
}

export function buildEmail(report) {
  const sessions = report.scorecards.find((card) => card.key === "sessions")?.value ?? 0;
  const subject = `${report.meta.siteName} analytics - ${formatDateLabel(report.meta.dateIso)} - ${formatInteger(sessions)} sessions / ${formatInteger(report.events.keyActionCount)} key actions`;
  return {
    subject,
    html: renderReportHtml(report),
    text: renderReportText(report),
  };
}

async function postToWorker({ apiBaseUrl, internalToken, subject, html, text }) {
  const url = `${apiBaseUrl.replace(/\/$/, "")}/internal/daily-summary`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${internalToken}`,
    },
    body: JSON.stringify({ subject, html, text }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Worker responded ${res.status}: ${body}`);
  }
  return body;
}

function readRuntimeConfig(env) {
  const dryRun = env.ANALYTICS_DRY_RUN === "true";
  const required = [
    "GA_PROPERTY_ID",
    "GA_SERVICE_ACCOUNT_JSON",
    ...(dryRun ? [] : ["API_BASE_URL", "INTERNAL_TOKEN"]),
  ];

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }

  let credentials;
  try {
    credentials = JSON.parse(env.GA_SERVICE_ACCOUNT_JSON);
  } catch (error) {
    throw new Error(`GA_SERVICE_ACCOUNT_JSON is not valid JSON: ${error.message}`);
  }

  return {
    credentials,
    propertyId: env.GA_PROPERTY_ID,
    apiBaseUrl: env.API_BASE_URL,
    internalToken: env.INTERNAL_TOKEN,
    siteName: env.SITE_NAME || DEFAULT_SITE_NAME,
    timeZone: env.ANALYTICS_TIME_ZONE || DEFAULT_TIME_ZONE,
    dryRun,
  };
}

export async function main(env = process.env) {
  const config = readRuntimeConfig(env);
  const client = new BetaAnalyticsDataClient({ credentials: config.credentials });
  const now = new Date();
  const report = await buildDailyAnalyticsReport({
    client,
    propertyId: config.propertyId,
    siteName: config.siteName,
    timeZone: config.timeZone,
    now,
  });
  const email = buildEmail(report);

  if (config.dryRun) {
    console.log(email.subject);
    console.log("");
    console.log(email.text);
    console.log("");
    console.log(`HTML length: ${email.html.length}`);
    return;
  }

  await postToWorker({
    apiBaseUrl: config.apiBaseUrl,
    internalToken: config.internalToken,
    ...email,
  });
  console.log(`Sent rich analytics summary for ${report.meta.dateIso}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Daily summary failed:", error);
    process.exit(1);
  });
}
