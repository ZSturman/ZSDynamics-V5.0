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
