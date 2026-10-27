import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getProjectEvidence,
  getProjectFocusAreas,
  getProjectStage,
  getSelectedWork,
  isSecondaryResource,
} from "../lib/project-presentation.ts";

const manifest = JSON.parse(readFileSync(new URL("../public/projects/projects.json", import.meta.url), "utf8"));
const selectedSlugs = JSON.parse(readFileSync(new URL("../content/selected-work.json", import.meta.url), "utf8")).projects;

test("projects without any new metadata still derive presentation values", () => {
  const bare = { id: "x", slug: "x", href: "/projects/x", title: "Bare", summary: "", domain: "", status: "", createdAt: null, updatedAt: null };
  assert.deepEqual(getProjectFocusAreas(bare), []);
  assert.equal(getProjectStage(bare).label, "Active development");
  assert.deepEqual(getProjectEvidence(bare), { demo: false, download: false, source: false, liveSite: false, workLogs: 0, articles: 0 });
  // Malformed optional metadata is ignored rather than throwing.
  assert.deepEqual(getProjectFocusAreas({ ...bare, tags: "ESP32", disciplines: "nope", category: 5 }), ["hardware"]);
});

test("explicit disciplines override derived focus areas", () => {
  const project = { title: "P", tags: ["React"], domain: "Technology", disciplines: ["Hardware & Electronics", "research"] };
  assert.deepEqual(getProjectFocusAreas(project), ["hardware", "research"]);
});

test("narrative projects are creative, not software", () => {
  assert.deepEqual(getProjectFocusAreas({ domain: "Narrative", tags: ["Film", "Story"], category: ["Screenplay"] }), ["creative"]);
});

test("stage labels distinguish released, prototype, research, paused, and archived work", () => {
  assert.equal(getProjectStage({ status: "Active", phase: "Released on iOS" }).key, "released");
  assert.equal(getProjectStage({ status: "Active", phase: "Prototype" }).key, "prototype");
  assert.equal(getProjectStage({ status: "Active", phase: "Research" }).key, "research");
  assert.equal(getProjectStage({ status: "Paused", phase: "Production" }).key, "paused");
  assert.equal(getProjectStage({ status: "Deprecated", phase: "" }).key, "archived");
  assert.equal(getProjectStage({ status: "Maintained", phase: "Maintenance" }).key, "maintained");
});

test("without a ranked list, selected work uses featuredOrder, then unranked featured, capped at six", () => {
  const projects = [
    { id: "a", featured: true, updatedAt: "2026-01-01" },
    { id: "b", featured: true, featuredOrder: 2 },
    { id: "c", featured: false, featuredOrder: 1 },
    { id: "d", featured: true, featuredOrder: 1 },
    { id: "e", featured: true, updatedAt: "2026-05-01" },
  ];
  assert.deepEqual(getSelectedWork(projects).map((p) => p.id), ["d", "b", "e", "a"]);
  assert.equal(getSelectedWork(Array.from({ length: 9 }, (_, i) => ({ id: `${i}`, featured: true }))).length, 6);
});

test("the ranked list is the only ranking control and ignores featured flags", () => {
  const projects = [
    { id: "1", slug: "one", featured: true, featuredOrder: 1 },
    { id: "2", slug: "two", featured: false },
    { id: "3", slug: "hidden", visibility: "private" },
  ];
  assert.deepEqual(getSelectedWork(projects, 6, ["two", "missing", "hidden", "one", "two"]).map((p) => p.slug), ["two", "one"]);
  // Nothing valid in the list: fall back to Notion Featured.
  assert.deepEqual(getSelectedWork(projects, 6, ["missing"]).map((p) => p.slug), ["one"]);
});

test("current selected-work list resolves to 4-6 projects covering software, AI/data, and hardware", () => {
  const selected = getSelectedWork(manifest, 6, selectedSlugs);
  assert.equal(selected.length, selectedSlugs.length, "every listed slug exists in the manifest");
  assert.ok(selected.length >= 4 && selected.length <= 6, `selected ${selected.length}`);
  const focus = new Set(selected.flatMap(getProjectFocusAreas));
  for (const key of ["software", "ai-data", "hardware"]) assert.ok(focus.has(key), `missing ${key}`);
});

test("support and privacy links are secondary actions", () => {
  assert.equal(isSecondaryResource({ type: "website", label: "Support", url: "/x/support" }), true);
  assert.equal(isSecondaryResource({ type: "apple", label: "Install from App Store", url: "https://apps.apple.com" }), false);
});
