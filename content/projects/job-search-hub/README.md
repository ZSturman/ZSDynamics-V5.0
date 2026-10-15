# Job Search Hub

Find, evaluate, and track jobs through Notion and the CLI.

![Job Search Hub CLI Demonstration](/projects/job_search_hub_04827feb-2508-51d8-ba15-ed7738b57f7e/images/terminal-demo-optimized.webp)

## Overview

**Job Search Hub** is an open-source workflow engine designed for software engineers who want a structured, private, and automated system to manage their job search pipeline.

Instead of relying on third-party SaaS platforms that harvest personal data or manual spreadsheets that easily drift out of date, Job Search Hub bridges two complementary surfaces:
1. **Notion**: Acts as the visual front-end where you review matches, edit search preferences, approve reusable answers, and track interview progress across dedicated, structured views.
2. **The `jobhub` CLI**: An autonomous local tool that handles job board ingestion, candidate fact extraction, application lifecycle reconciliation, SQLite deduplication, and secure credential storage.

---

## Key Features

- **Scoped Notion Integration**: Provisions 10 dedicated databases and numbered step-by-step navigation pages (`1 — My search`, `2 — Review jobs`, `3 — Resolve questions`, `4 — Apply`, `5 — Track progress`) underneath an isolated parent page without searching or touching other workspace pages.
- **Multi-Source Job Ingestion**: Supports discovery across Greenhouse, Lever, Ashby, Recruitee, SmartRecruiters, RSS feeds, Remotive, and direct manual job capture.
- **Privacy & Local Ownership**: Credentials (Notion integration tokens, source API keys) are stored in your operating system's native keychain (via `keyring`), never in plaintext files, Git history, or Notion. Resumes and raw PDFs stay exclusively on your local machine.
- **Resume Fact Catalog & Reusable Answer Bank**: Extracts verified facts from your resume PDFs deterministically with a local human approval queue before syncing approved facts and reusable answers to Notion.
- **Lifecycle Reconciliation**: Translates decisions made in Notion (`Shortlist`, `Apply`, `Skip`) into structured application records, tracking stages from `Planned` to `Submitted`, `Interviewing`, and `Offer`.
- **Scheduled Background Refresh**: Native macOS `launchd` automation for hands-free discovery and status updates.

---

## Technologies Used

- **Python 3.11+**: Built as an installable CLI (`jobhub`) using modern packaging standards (`pyproject.toml`, Hatchling).
- **Notion REST API (2025-09-03)**: Schema validation, root-page discovery, page/database CRUD, and relation rollups.
- **HTTPX & Tenacity**: Robust HTTP client with exponential backoff and request pacing coordinator respecting Notion rate limits.
- **SQLite**: Local relational database for fingerprint deduplication and notification delivery ledgers.
- **PyPDF**: Local document text extraction for candidate resume fact parsing.
- **Keyring**: Native OS credential storage (macOS Keychain).
- **Rich**: Terminal output formatting, diagnostics, and table rendering.

---

## Engineering Highlights

### 1. Zero Personal Data Leakage & Scoped Access
Job Search Hub implements strict isolation rules:
- Discovery searches *only* descend from the user-selected root page, guaranteeing that personal databases elsewhere in Notion are never read, migrated, or touched.
- Secrets are stored exclusively in the OS keychain. Inspection and preview modes (`--preview`) are strictly read-only and enforce zero write side-effects.

### 2. Request Pacing & Write Concurrency Coordinator
To ensure stability against Notion API rate limits and transient 529 overloads, all API interactions pass through a centralized `NotionRequestCoordinator`. Writes are serialized via a bounded semaphore with adaptive exponential backoff and jitter.

### 3. Idempotent Template Provisioning
Setting up the workspace is fully restartable: `jobhub setup --create-template` creates missing schemas, validates existing databases, and seeds default profiles and scoring criteria without duplication.

---

## Installation & Quick Start

### Quick Install

Download the latest wheel from the [GitHub Releases](https://github.com/ZSturman/job-search-hub/releases/tag/v0.1.0) and install via pip:

```bash
# Install with optional resume parsing extra
pip install notion_job_search_hub-0.1.0-py3-none-any.whl[resume]
```

### Initial Setup

```bash
# 1. Connect Notion and provision your workspace
jobhub setup --create-template --root-url "https://www.notion.so/your-page-id"

# 2. Verify configuration and connectivity
jobhub doctor

# 3. Import your resume PDF locally
jobhub resumes add ~/Documents/Resume.pdf --title "Software Engineer" --tag backend

# 4. Review and approve candidate facts
jobhub profile extract <DOC_ID>
jobhub profile pending
jobhub profile approve <FACT_ID>

# 5. Run a refresh to ingest jobs
jobhub run --preview
jobhub run
```

---

## Links

- **Repository**: [github.com/ZSturman/job-search-hub](https://github.com/ZSturman/job-search-hub)
- **Releases & Downloads**: [github.com/ZSturman/job-search-hub/releases](https://github.com/ZSturman/job-search-hub/releases/tag/v0.1.0)
- **License**: MIT License
