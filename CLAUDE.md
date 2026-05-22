# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A TV dashboard for Fairy Tails K9 Centre that shows which boarding dogs are staying today / arriving tomorrow and their feeding requirements. Two files, no build system, no tests:

- **`index.html`** — single-file static frontend (inline CSS + vanilla ES5 JS). Designed for a Hisense 40" FHD TV (1920×1080), no-scroll, all cards fit one screen. Polls the backend hourly.
- **`supersetplanner&feed.gs`** — Google Apps Script web app (the backend "API"). Pulls boarding appointments from **Acuity Scheduling**, feeding records from **JotForm**, matches them, and returns JSON via `doGet`.

The two are deployed separately and communicate over HTTPS:
- The `.gs` file is pasted into a Google Apps Script project and deployed as a Web App. Its deployment URL + shared `API_TOKEN` are hardcoded into `index.html` (`API_URL`, `API_TOKEN` near the top of the `<script>`). **If you rotate the token or redeploy, update both files.**
- `index.html` is hosted wherever the TV browser loads it from.

There is no local run/build/test/lint tooling. To test the backend, paste it into the Apps Script editor and run `testFeedingBoard()` (logs output via `Logger.log`). To test the frontend, open `index.html` in a browser — it will fetch from the live deployed backend.

## Data flow (request → screen)

1. TV browser calls `API_URL?mode=feeding&token=...` hourly (`REFRESH_INTERVAL_MS`).
2. `doGet` validates the token, routes `mode=feeding` → `getFeedingBoardData()`.
3. `getFeedingBoardData()` = `getBoardingData()` (Acuity) + `fetchJotformSubmissions_()` (JotForm) → `matchFeedingRecords_()`.
4. Returns `{ dogs, dogCount, dateRange, lastUpdated, error, feedingError }`.
5. Frontend `renderData()` runs **client-side** filtering (`filterTodayTomorrow`) and de-duplication (`deduplicateDogs`), computes a responsive grid via `calculateLayout()`, then builds cards.

**Important split of responsibility:** the backend returns stays for a wider window (7 days back to 6 forward), but the frontend narrows to *today's stays + tomorrow's arrivals*. The "next 7 days" empty-state text and the date math live in the frontend. Don't assume the displayed set equals the backend's `dogs` array.

## Key concepts when editing

**Dog-name matching is the trickiest logic** (`matchFeedingRecords_` in the `.gs`). Acuity stores names as `"DogFirstName OwnerSurname"`; JotForm's dog-name field is free text where owners inconsistently enter just the dog name or "Dog Surname", plus a separate (newer) surname field. Matching uses a 3-tier priority (exact surname → full name in dog field → first-name-only fallback), with most-recent submission breaking ties. `ambiguousMatch` flags first-name-only collisions. If feeding data shows on the wrong dog, this is where to look.

**JotForm field IDs are hardcoded** in `JOTFORM_FIELDS` (top of the `.gs`) and keyed to form `240635310347348`. If the form is recreated or fields reordered, these IDs break silently (records parse as null/empty). `parseFeedingRecord_` maps them to clean records.

**Caching is layered and aggressive** (recent commits fixed Acuity bandwidth-quota errors). `CacheService` keys: `fullFeedingResponse`/`fullBoardingResponse` (5 min), `jotformFeedingData` (30 min, incremental via `created_at:gt`), `dogNameCache` (30 min), appointment-type IDs (24 h). Acuity appointment *details* (for dog names) are fetched in batches of 5 with 2 s sleeps to stay under rate limits. When debugging "stale data", account for these TTLs — changes can take up to 5 min to surface.

**Two appointment types** are merged: `BOARDING_TYPE_NAME` ('dog boarding') and `BOARDING_SCHOOL_TYPE_NAME` ('boarding school'), matched case-insensitively against Acuity type names. Each dog carries `type: 'boarding' | 'school'`, which drives card styling (purple "school" header vs blue).

**Timezone coupling:** both files use `new Date()` and rely on the Apps Script project timezone and the TV browser timezone both being **Europe/London**. Mismatches cause stays to appear/disappear incorrectly around midnight (see the header comment in the `.gs`).

**Responsive layout is JS-driven, not CSS media queries.** `calculateLayout(dogCount)` sets CSS custom properties (`--card-cols`, `--fs`, `--notes-clamp`, etc.) on `:root` based on how many dogs there are, scaling font size and grid columns to fit everything on one screen without scrolling. Recent commit history shows repeated tuning of this fit-to-TV behavior — preserve the no-scroll, viewport-unit (`100vh`/`100vw`) approach.

## Conventions

- Frontend is **ES5-style vanilla JS** (`var`, function declarations, string concatenation for HTML, manual `escapeHtml`). Match that style — no frameworks, no build step, no template literals expected.
- Credentials/API keys live in plain variables at the top of the `.gs` file (it runs in the private Apps Script project, not committed to a public host). When keys rotate, update the variables there.
