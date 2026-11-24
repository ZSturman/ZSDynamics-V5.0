# November 22, 2026 GA4 investigation

The [requested three-day workflow run](https://github.com/ZSturman/ZSDynamics-V5.0/actions/runs/45291267889) included November 22. It combined November 20–23 inclusive. The [exact-day verification](https://github.com/ZSturman/ZSDynamics-V5.0/actions/runs/45292975115) isolated November 22 in GA4’s property time zone.

| Observation | Verified result |
| --- | --- |
| Better Workspace clicks vs detail-page views | GA4 recorded all **10** Better Workspace resource clicks on `/projects/better-workspace` across **two sessions**, in the same San Jose hour bucket. There were three detail-page views. Sessions can contain multiple clicks. The older tracking used the last visible section and did not distinguish exact resource surfaces, so those aggregates cannot establish each clicked control. The release records the clicked element’s own section, surface and destination category. |
| Direct attribution | All **49** sessions were `(direct) / (none)`. GA4 returned no page-view events with an external document referrer, and every counted GA4 user was counted as new that day. The canonical HTTP-to-HTTPS redirect preserved test campaign parameters. The subsequent production browser check independently recorded both an external referring host and campaign fields. This rules out a blanket loss on the canonical first-party collector path. The original acquisition channels are still unknown. GA4 also reported a LinkedIn referral on November 23, so the property can receive attributed traffic. |
| GA4 engaged sessions | **25** sessions met GA4’s engagement rule, and the exact-day query counted **six** `user_engagement` events. The original four was a distinct-session count for that event. Engagement events, engaged sessions and first-party active time measure different things. |
| Geography and viewport | 13 sessions with desktop device category recorded a tablet-width route view. A width bucket and an automation signal have different meanings. Geography, missing referrals and short visits cannot identify a bot. |
| Page views and route views | GA4 counted 54 page views and 51 portfolio route views. GA4 page views and the app’s deduplicated route event use different triggers. |

Historical GA4 aggregates remain available. Individual paths, engagement and traffic-quality classification start at the first-party rollout. No first-party evidence exists for November 22.

## Register six event-scoped custom dimensions

The live metadata showed **35 of 50** event-scoped dimensions in use and **six** missing from the recommended list. The previous list of seven mixed scope: `product_id`, `log_id` and `qa_run` are optional parameters outside this registration set, while `destination_category` and `source_section` belong in it. `product_slug` and `action_type` enable the product-activity table. The other four improve click and filter breakdowns. First-party collection does not depend on these definitions.

The reporting service account could list definitions, but its [authorized creation attempt](https://github.com/ZSturman/ZSDynamics-V5.0/actions/runs/45293343552) returned **403 PERMISSION_DENIED** before creating any dimensions.

Sign in with an Editor or Administrator role, open the **zacharysturman.com GA4 property 453629949** (web measurement ID `G-DGWTLKCFD9`), then go to **Admin → Data display → Custom definitions → Create custom dimension**. Set **Scope** to **Event** for each row.

| Display name | Event parameter | Description |
| --- | --- | --- |
| Product slug | `product_slug` | Stable portfolio product slug attached to product and resource events. |
| Action type | `action_type` | Type of tracked action, such as store referral, download, demo or repository click. |
| Destination category | `destination_category` | Category of the clicked destination, such as repository, store, download or website. |
| Source section | `source_section` | Tagged page section containing the clicked element. |
| Filter type | `filter_type` | Type of portfolio filter changed, such as category, tag, year or search. |
| Filter value | `filter_value` | Instrumented value of the selected portfolio filter. |

After saving, confirm the six rows in Custom definitions. Allow 24–48 hours for reporting, then run `gh workflow run analytics-verify.yml -f days=3` and check that **Recommended but missing** is empty. Definitions apply to newly processed event data and cannot provide the custom breakdown for November 22. [Google’s custom dimension guidance](https://support.google.com/analytics/answer/14240153).
