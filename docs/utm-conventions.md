# UTM conventions

The site captures UTM parameters on first visit, persists them in `sessionStorage`, and merges them into every analytics event. To get clean attribution, append UTM tags to outbound links from anywhere you control.

## Quick reference

| Parameter | Use for | Example |
| --- | --- | --- |
| `utm_source` | The platform / domain. | `linkedin`, `bluesky`, `x`, `github`, `email` |
| `utm_medium` | The mechanism. | `social`, `referral`, `email`, `direct` |
| `utm_campaign` | A specific push or theme. | `2026-portfolio-relaunch`, `chewsense-writeup` |
| `utm_content` | Differentiate variants. | `header-link`, `bio-link`, `footer` |
| `utm_term` | Keyword (rarely used here). | — |

Keep values lowercase, hyphenated, and short. Re-use existing campaigns when posting follow-ups so the dashboard groups them.

## Naming rules for cleaner analytics emails

The daily analytics email groups UTM values, local project/article tags, and registered GA4 custom dimensions. Cleaner input makes the email read like a dashboard instead of a pile of one-off labels.

- Use lowercase kebab-case: `portfolio-launch`, not `Portfolio Launch`.
- Keep `utm_source` to the platform or domain: `linkedin`, `github`, `newsletter`, `email`.
- Keep `utm_medium` to the channel mechanism: `social`, `referral`, `email`, `community`, `direct`.
- Use `utm_campaign` for the actual initiative: `2026-portfolio-relaunch`, `chewsense-writeup`, `resume-push`.
- Use `utm_content` for placement or variant: `bio-link`, `post-2026-06`, `footer`, `hero-cta`, `thread-reply`.
- Reuse campaign names for follow-up posts so the daily email can show cumulative campaign performance instead of fragmented rows.
- Do not put dates in `utm_source` or `utm_medium`; dates belong in `utm_content` only when they identify a specific post or variant.

## Paste-ready URLs

LinkedIn profile bio link:

```
https://zacharysturman.com/?utm_source=linkedin&utm_medium=social&utm_campaign=profile&utm_content=bio-link
```

LinkedIn post linking to a project:

```
https://zacharysturman.com/projects/chewsense?utm_source=linkedin&utm_medium=social&utm_campaign=chewsense-writeup&utm_content=post-2026-05
```

Bluesky bio:

```
https://zacharysturman.com/?utm_source=bluesky&utm_medium=social&utm_campaign=profile&utm_content=bio-link
```

X / Twitter:

```
https://zacharysturman.com/?utm_source=x&utm_medium=social&utm_campaign=profile&utm_content=bio-link
```

GitHub README link:

```
https://zacharysturman.com/?utm_source=github&utm_medium=referral&utm_campaign=readme&utm_content=profile-readme
```

Email signature:

```
https://zacharysturman.com/?utm_source=email&utm_medium=email&utm_campaign=signature&utm_content=footer
```

## Job applications and email outreach

Use one campaign per application round or outreach batch, never per person:

```text
https://zacharysturman.com/?utm_source=application&utm_medium=resume&utm_campaign=2026-q4-software&utm_content=resume-header
https://zacharysturman.com/explore/hardware?utm_source=application&utm_medium=cover-letter&utm_campaign=2026-q4-technician
https://zacharysturman.com/?utm_source=email&utm_medium=outreach&utm_campaign=2026-q4-research-labs
```

- `utm_source=application` for links inside résumés, cover letters, and application forms; `utm_source=email` for messages you send.
- `utm_campaign` names the round or role family (`2026-q4-software`). A company name is acceptable; **never** put a recipient's name, email address, or any identifier that would tie anonymous browsing to a named person. Recipient-level attribution is intentionally not supported.
- The daily email's **Campaigns** table shows sessions, engaged sessions, and conversions (résumé downloads, sent contact messages, project demo/source/install clicks, GitHub/LinkedIn clicks) per campaign.
- `utm_source=qa` is reserved for release checks and is excluded from the daily report.

Email opens are not measured. Apple Mail Privacy Protection, image blocking, and corporate link scanners make open and click counts unreliable; scanners can also "click" links, which shows up as very short Direct-looking sessions. Judge outreach by engaged sessions and conversions, not clicks.

## How capture works

1. On the first page of a browser session, `lib/analytics-utm.ts` stores any `utm_*` values (and the external referrer hostname) in `sessionStorage`.
2. The parameters stay in the address bar. GA4 reads campaign attribution from the landing page view, which Firebase sends only after its script loads; removing them earlier (the behaviour before October 27, 2026) recorded campaign visits as Direct or referral. Moving to another page drops them naturally.
3. Every custom event spreads the stored values into its parameters, so `utm_source` etc. also appear on `resume_download`, `contact_submit`, `project_resource_click`, and so on, for the rest of the session.

## GA4 custom dimensions

GA4 receives the event parameters automatically, but the Data API can only report event-level detail when parameters are registered as custom dimensions. For the richest daily email, register these as event-scoped custom dimensions in GA4:

```text
utm_source
utm_medium
utm_campaign
utm_content
utm_term
utm_referrer
page_group
page_slug
project_slug
article_slug
resource_type
social_network
destination_domain
surface
status
media_kind
open_surface
previous_page_group
previous_page_slug
route_step
viewport_category
route_surface
modal_context
section_key
section_label
item_id
item_type
item_label
collection_key
media_role
scroll_percent
engagement_bucket
visible_time_sec
progress_percent
interaction_type
```

The email has a fallback: if a dimension is not registered, it still reports built-in acquisition and enriches top pages with local project/article tags from the site manifests.
