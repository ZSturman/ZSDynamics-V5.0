# Zachary Sturman Portfolio

This repository showcases my creative, scientific, and technological projects.

## Project Organization

To see the full implementation of this project organization system, check out the **OPE** project, which is featured in my portfolio at [zachary-sturman.com](https://zachary-sturman.com).

## Firebase Analytics

The site includes a client-only Firebase Analytics integration for GA4/Firebase web tracking.

1. Copy `.env.example` to `.env.local`.
2. Run `firebase login --reauth`.
3. Run `firebase apps:list WEB --project zachary-sturman-portfolio`.
4. Run `firebase apps:sdkconfig WEB <APP_ID> --project zachary-sturman-portfolio`.
5. Paste the returned values into `.env.local` and set `NEXT_PUBLIC_FIREBASE_ANALYTICS_ENABLED=true`.

This setup is intended to stay on Firebase/GA4's no-cost path and does not require BigQuery export, Cloud Functions, or other paid services.
