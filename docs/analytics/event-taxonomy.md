# Analytics event taxonomy

Canonical source: [`lib/analytics-taxonomy.mjs`](../../lib/analytics-taxonomy.mjs) (version 2). The browser, the API Worker and the daily report all read it, and `tests/session-journeys.test.mjs` fails if an event in code is missing here.

There are two destinations:

- **GA4** (Firebase Analytics): aggregate reporting, long-term history, geography. Unchanged event names, so historical reports stay comparable.
- **First-party session stream** (`POST /collect` on the API Worker, stored in D1 for 30 days): anonymous, ordered events used to rebuild individual session timelines and classify traffic quality. See [session-analytics.md](./session-analytics.md).

## Categories

| Category | Meaning | Counted as a meaningful action? |
| --- | --- | --- |
| navigation | Where a session went: page loads, client-side route changes, filters. | No |
| attention | Foreground exposure and measured time. **Exposure is not proof of reading.** | No |
| engagement | Deliberate interaction with content on the site (opening items, media, demos). | No |
| action | Leaving for a project resource, repository, store, website or profile. | Yes |
| conversion | Contact, résumé and subscription outcomes. | Yes (contact *click* is intent only) |
| diagnostic | Instrumentation bookkeeping and failures. Never a visitor action. | No |

"Visible" and "clicked" are separate events: `portfolio_section_view` records that a link or section became meaningfully visible; `project_resource_click` records a click. "Opened" and "engaged" are also separate: `project_open` records a successful mount; time is measured by `page_attention` and `portfolio_section_engaged`.

## Standard properties

| Property | Values | Where |
| --- | --- | --- |
| `project_slug`, `article_slug`, `product_slug` | Existing content slugs | Content events and actions |
| `surface` | Where the interaction happened: `project_page`, `project_modal`, `project_grid`, `project_list`, `selected_work`, `product_page`, `home`, `site_footer`, … (from the nearest `data-analytics-surface`, else the page type) | Actions, opens |
| `source_section` | The tagged section that **contains the clicked element** (`project_resources`, `project_description_story`, …) | Actions (also written to the existing `section_key` dimension) |
| `destination_category` | `repository`, `app_store`, `download`, `demo`, `website`, `email`, `social`, `resume`, `internal_project`, `internal`, `other` | Actions |
| `action_type` | `source`, `store`, `download`, `demo`, `external`, `internal` (existing product taxonomy) | `project_resource_click` |
| `interaction_type`, `media_kind`, `item_type`, `collection_key` | Structured interaction detail | Engagement events |
| `filter_type`, `filter_value` | Filter name and value; search text is reduced to keywords for GA4 and **omitted** from the session stream | `portfolio_filter_change` |
| `engagement_bucket`, `visible_time_sec`, `scroll_percent` | 5/15/30/60 s; 25/50/75/90/100 % | Attention events |

Session-stream page events add `path` (no query string), `group`, `slug`, `nav` (`landing`, `route`, `reload`, `back_forward`, `resume`), the landing `ref_host` and UTM values, and cumulative `fg_ms`, `active_ms` and input-activity tallies.

### Attribution fix (November 2026)

Before this change every event inherited the `section_key`/`section_label`/`project_slug` of **whichever tagged element had most recently been visible**. A click on a project card's GitHub icon was therefore attributed to the "View Source" item that happened to be in view, and card clicks were indistinguishable from detail-page clicks (all used `surface=project_resource`). Clicks now carry the surface and section of the clicked element itself, plus `destination_category`. Historical GA4 rows keep the old semantics; see [anomalies.md](./anomalies.md).

## Events

### Navigation

| Event | GA4 | Session stream | Meaningful | Purpose | De-duplication |
| --- | --- | --- | --- | --- | --- |
| `page_view` | — | yes | — | A full page load or client-side route change in the session timeline. GA4 records its own page_view separately. | One per page instance (pv id); refreshes and back/forward are new instances labelled by nav type. |
| `portfolio_filter_change` | yes | yes | — | Archive, article or work-log filters. Search text is reduced to keywords for GA4 and omitted from the session stream. | Settled changes only. |
| `product_view` | yes | — | — | Product landing or demo route visit (GA4 reporting by product_slug). The session stream uses page_view. | Once per route view. |

### Attention

| Event | GA4 | Session stream | Meaningful | Purpose | De-duplication |
| --- | --- | --- | --- | --- | --- |
| `page_attention` | — | yes | — | Cumulative foreground and active milliseconds plus input-activity counts for one page instance. | Cumulative; the latest value per page instance wins, so duplicates and retries cannot inflate time. |
| `portfolio_scroll_depth` | yes | yes | — | First time a route reaches 25/50/75/90/100% depth. | Once per milestone per route view. |
| `portfolio_section_view` | yes | — | — | A tagged section or link first became meaningfully visible. Exposure, not interest. | Once per target per route view. |
| `portfolio_section_engaged` | yes | yes | — | A tagged section stayed meaningfully visible in a foreground tab for 5/15/30/60 s. Eligible exposure, not proof of reading. | Once per target per bucket per route view. |

### Engagement

| Event | GA4 | Session stream | Meaningful | Purpose | De-duplication |
| --- | --- | --- | --- | --- | --- |
| `project_open` | yes | yes | — | A project detail page or home project modal mounted successfully (not a click on a card). | Once per project per route view. |
| `article_open` | yes | yes | — | An article page mounted successfully. | Once per article per route view. |
| `work_log_open` | yes | yes | — | A work-log session was expanded by its existing ID. | Per interaction. |
| `project_item_open` | yes | yes | — | A collection item or fullscreen artifact was opened or navigated. | Per interaction. |
| `project_media_play` | yes | yes | — | Image, video or 3D model interaction started. | Per interaction. |
| `project_media_progress` | yes | yes | — | Video/audio progress milestones and fullscreen media, model, game or text interactions. | Once per milestone per media element. |
| `product_demo_start` | yes | yes | — | First interaction with an in-browser product demo attempt. | Once per attempt. |
| `article_project_click` | yes | yes | — | An explicit related-project link inside an article. | Per click. |

### Action

| Event | GA4 | Session stream | Meaningful | Purpose | De-duplication |
| --- | --- | --- | --- | --- | --- |
| `project_resource_click` | yes | yes | **yes** | The canonical project/product action: repository, demo, website, App Store, download or internal project link, with action_type, destination_category and the surface it was clicked from. | Per click. Repeated clicks are real events; reports also count distinct sessions. |
| `article_source_click` | yes | yes | **yes** | An article's source or reference link. | Per click. |
| `outbound_click` | yes | yes | **yes** | Any other external link (delegated listener). Not emitted when a specific tracker handled the click. | Per click; skipped for links with data-analytics-skip. |
| `social_click` | yes | yes | **yes** | LinkedIn, GitHub profile or other social link. | Per click. |
| `github_click` | yes | yes | **yes** | Historical generic GitHub event; new repository clicks use project_resource_click with destination_category=repository. | Per click. |
| `project_demo_click` | yes | yes | **yes** | Historical demo event; new demo clicks use project_resource_click with action_type=demo. | Per click. |

### Conversion

| Event | GA4 | Session stream | Meaningful | Purpose | De-duplication |
| --- | --- | --- | --- | --- | --- |
| `product_demo_complete` | yes | yes | **yes** | The demo's documented completion step was reached. No entered text is sent. | Once per attempt. |
| `resume_view` | yes | yes | **yes** | Résumé PDF opened for viewing. | Per click. |
| `resume_download` | yes | yes | **yes** | Résumé download link activated; completion is not observable. | Per click. |
| `contact_click` | yes | yes | **yes** | A link to /contact or mailto: was activated. Intent only. | Per click. |
| `contact_submit` | yes | yes | **yes** | Only after the contact API accepted the message. No form content is sent. | Once per accepted request. |
| `newsletter_interest` | yes | yes | **yes** | Writing-update signup accepted (confirmation follows by email). | Once per accepted request. |

### Diagnostic

| Event | GA4 | Session stream | Meaningful | Purpose | De-duplication |
| --- | --- | --- | --- | --- | --- |
| `portfolio_route_view` | yes | — | — | GA4-side route bookkeeping (route_step, previous page). Aggregate transitions only; the session stream holds real paths. | Once per pathname/modal key. |
| `contact_submit_failed` | yes | yes | — | Rejected contact attempt (status, error_code). | Per attempt. |
| `newsletter_interest_failed` | yes | yes | — | Rejected subscription attempt. | Per attempt. |
| `automation_signal` | yes | — | — | Historical only. Known automation is now suppressed before analytics initialises. | n/a |

## Timestamps, attribution and de-duplication

- **Timestamps.** Session-stream events carry the browser time; the Worker corrects each batch by the difference between its own clock and the batch's `sent_at` (ignored below 2 s), so a wrong device clock does not reorder a timeline. GA4 keeps its own timestamps.
- **Attribution.** UTM values and the external referrer host are captured on the first page of a session and kept for the rest of it (GA4 via `sessionStorage`, the session stream on the landing `page_view`). Internal navigation never replaces them.
- **De-duplication.** Session-stream event ids are `<tab>-<sequence>`; the Worker ignores repeats, so retried beacons cannot double-count. `page_attention` values are cumulative and the reconstruction keeps the maximum per page instance. Opens fire once per route view; repeated clicks are real and reports show both *events* and *distinct sessions*.

## GA4 custom dimensions

GA4 standard properties allow 50 event-scoped custom dimensions. As of November 23, 2026, 35 are registered. To keep cardinality and quota under control:

| Register (recommended) | Why |
| --- | --- |
| `product_slug`, `action_type` | Product activity section (currently shows "unavailable"). |
| `destination_category`, `source_section` | New click attribution (where a click happened and what it opened). |
| `filter_type`, `filter_value` | Archive filter usage. |

| Do not register | Why |
| --- | --- |
| `product_id` | Duplicates `product_slug`. |
| `log_id`, `destination_url`, `resource_label`, `link_label`, `item_label`, titles | High cardinality or free text; available in explorations/BigQuery if ever needed. |
| Session ids, `pv`, timestamps | Unique per session. The session stream handles these outside GA4. |

`qa_run` is optional; the verification workflow only needs it when isolating a single QA run.
