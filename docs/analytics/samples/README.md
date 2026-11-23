# Daily email samples

| File | What it is |
| --- | --- |
| `before-daily-email.html` / `.txt` | The previous email, rendered by the pre-change script from the same fixture. |
| `after-daily-email.html` / `.txt` | The new brief with session-stream evidence. |
| `after-daily-email-ga4-only.html` / `.txt` | The new brief when the session stream is unavailable (the historical case for November 22). |
| `after-detailed-report.html` | The full report the brief links to. |

GA4 figures come from `tests/fixtures/analytics/ga4-nov22-fixture.mjs`, shaped after the live November 22, 2026 report (49 sessions, 54 views, 25 engaged, 17 resource clicks). The click-by-page split and the device/window table in that fixture are **illustrative**, as is the whole session stream (`tests/fixtures/analytics/synthetic-sessions.mjs`). No real visitor data appears here. Sample links use the reserved `portfolio.example` domain.

Regenerate with `node scripts/render-analytics-sample.mjs`.
