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

## How capture works

1. On first page view of a session, [lib/analytics-utm.ts](../lib/analytics-utm.ts) reads `utm_*` from the URL and stores them under `zs_utm_v1` in `sessionStorage`.
2. The current URL is rewritten via `history.replaceState` to remove the query params (so the address bar stays clean).
3. Every analytics event spreads those stored values into its parameters first, so `utm_source` etc. show up on `outbound_click`, `contact_submit`, and so on.
4. If no UTM is present, the referrer hostname is captured as `utm_referrer` for soft attribution.

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
```

The email has a fallback: if a dimension is not registered, it still reports built-in acquisition and enriches top pages with local project/article tags from the site manifests.
