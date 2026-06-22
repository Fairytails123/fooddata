# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A TV dashboard for Fairy Tails K9 Centre that shows which boarding dogs are staying today / arriving tomorrow and their feeding requirements. Two files, no build system, no tests:

- **`index.html`** — single-file static frontend (inline CSS + vanilla ES5 JS). Designed for a Hisense 40" FHD TV (1920×1080), no-scroll, all cards fit one screen. Refreshes at fixed times (07:00 / 13:00 / 18:00 browser-local) to stay under Acuity's bandwidth quota.
- **`supersetplanner&feed.gs`** — Google Apps Script web app (the backend "API"). Pulls boarding appointments from **Acuity Scheduling**, feeding records from **JotForm**, matches them, and returns JSON via `doGet`.

The two are deployed separately and communicate over HTTPS:
- The `.gs` file is pasted into a Google Apps Script project and deployed as a Web App. Its deployment URL + shared `API_TOKEN` are hardcoded into `index.html` (`API_URL`, `API_TOKEN` near the top of the `<script>`). **If you rotate the token or redeploy, update both files.**
- `index.html` deploys via **GitHub Pages from `main`** (https://fairytails123.github.io/fooddata/) — pushing `main` IS deploying, so verify before pushing. **The page never reloads itself** (the scheduled refreshes only re-fetch data), so after any frontend deploy the TV browser must be refreshed once by hand or it keeps running the old HTML indefinitely.

There is no build/lint tooling in the repo. To test the backend, paste it into the Apps Script editor and run `testFeedingBoard()` (logs output via `Logger.log`). To test the frontend, use the headless-Chrome scenario harness at `%TEMP%\ftboard-tests\build_and_run.ps1` (local-only, not committed): it stamps fetch-stubbed copies of the current `index.html` for ~12 scenarios (live replay, 18-dog paging, worst-case med load, offline/stale fallbacks, midnight rollover, XSS), runs each at 1920×1080, and reports assertion JSON (errors, card overflows, chip counts) plus screenshots. Run it after **every** frontend change — this is a safety display. Its `live` scenario replays `live_api_sample.json` from the repo root, which is **gitignored on purpose** (real customer names + medication details must never reach the public Pages site); keep a local copy or refresh it from the live API.

## Data flow (request → screen)

1. TV browser calls `API_URL?mode=feeding&token=...` at the three scheduled times (`SCHEDULED_REFRESH_HOURS = [7, 13, 18]`, driven by `scheduleNextRefresh()` / `computeNextRefreshTime()`).
2. `doGet` validates the token, routes `mode=feeding` → `getFeedingBoardData()`.
3. `getFeedingBoardData()` = `getBoardingData()` (Acuity) + `fetchJotformSubmissions_()` (JotForm) → `matchFeedingRecords_()`.
4. Returns `{ dogs, dogCount, dateRange, lastUpdated, error, feedingError }`.
5. Frontend `renderBoard()` runs **client-side** today/tomorrow classification + de-duplication (`classifyDogs` → `deduplicateTagged`), then `renderTodayPage()` / `renderTomorrowPage()` build the cards and `fitTodayZone()` auto-sizes each card (see the layout note below).

The backend sorts `dogs` so the most safety-critical entries are first: **medication dogs float to the top, then matched-before-unmatched, then alphabetical by dog name** (`getFeedingBoardData`). Preserve this — it's what makes meds visible on the TV.

**Important split of responsibility:** the backend returns stays for a wider window (7 days back to 6 forward), but the frontend narrows to *today's stays + tomorrow's arrivals*. The "next 7 days" empty-state text and the date math live in the frontend. Don't assume the displayed set equals the backend's `dogs` array.

## Key concepts when editing

**Dog-name matching is the trickiest logic** (`matchFeedingRecords_` in the `.gs`). Acuity stores names as `"DogFirstName OwnerSurname"`; JotForm's dog-name field is free text where owners inconsistently enter just the dog name or "Dog Surname", plus a separate (newer) surname field. Matching uses a **5-tier priority**, with most-recent submission breaking ties within a tier:
- **1 exact** — JotForm `ownerSurname` field + dog first name both match.
- **2 fullname** — dog field holds the full `"DogName Surname"` (or first name + trailing words = surname).
- **3 name_only** — dog first name matches and the JotForm record has *no* surname info anywhere.
- **4 fuzzy** (fallback) — dog first name matches and the surname is within one edit (`oneEditApart_`), absorbing owner typos like "Wighthman"/"Wightman".
- **5 surname** (fallback) — surname field matches regardless of dog name (covers a blank/wrong dog name in Acuity); **skipped if more than one dog shares that surname**, to avoid attaching the wrong dog's food/meds.

Tiers 4–5 run **only when tiers 1–3 find nothing** — they rescue otherwise-empty cards, never override a good match. The chosen tier is exposed on each dog as `matchType` (`exact | fullname | name_only | fuzzy | surname | none`). `ambiguousMatch` flags first-name-only collisions. If feeding data shows on the wrong dog, this is where to look.

**JotForm field IDs are hardcoded** in `JOTFORM_FIELDS` (top of the `.gs`) and keyed to form `240635310347348`. If the form is recreated or fields reordered, these IDs break silently (records parse as null/empty). `parseFeedingRecord_` maps them to clean records.

**Caching is layered and aggressive** (recent commits fixed Acuity bandwidth-quota errors). `CacheService` keys: `fullFeedingResponse`/`fullBoardingResponse` (**5 h**, `FULL_RESPONSE_CACHE_SECONDS`), `jotformFeedingData` (30 min, incremental via `created_at:gt`), appointment-type IDs (**6 h**, the CacheService max, `BOARDING_TYPE_CACHE_SECONDS`). Dog names are cached **permanently in `PropertiesService`** under `acuityDogNameCache` (`DOG_NAME_PROPERTY_KEY`) — an appointment ID's dog name never changes, so each appointment's detail is fetched exactly *once, ever* (this was the core fix for "Bandwidth quota exceeded"). Acuity appointment *details* (for dog names) are fetched in batches of 5 with 2 s sleeps to stay under rate limits. When debugging "stale data", account for these TTLs — changes can take up to 5 h to surface.

**Stale-data fallback.** On a successful run, `getBoardingData()` / `getFeedingBoardData()` mirror their last *clean* response into `PropertiesService` (`lastGoodBoardingResponse`, `lastGoodFeedingResponse`). If Acuity later throttles, the catch blocks serve that copy with `error` set to "Showing last known data — upstream error: …" while keeping `stays`/`dogs` populated. So **`error` can be non-null while the board still renders real dogs** — don't treat a set `error` as an empty board.

**Two appointment types** are merged: `BOARDING_TYPE_NAME` ('dog boarding') and `BOARDING_SCHOOL_TYPE_NAME` ('boarding school'), matched case-insensitively against Acuity type names. Each dog carries `type: 'boarding' | 'school'`, which drives card styling (purple "school" header vs blue).

**Timezone coupling:** both files use `new Date()` and rely on the Apps Script project timezone and the TV browser timezone both being **Europe/London**. Mismatches cause stays to appear/disappear incorrectly around midnight (see the header comment in the `.gs`).

**Card names show dog first name + owner surname** (`buildDogNameHtml` → `.name-first` / `.name-surname` spans, both escaped). Surnames disambiguate same-named dogs (two Rubys with different feeding plans) — never drop them from a card. The name block is a wrapping flex row: both parts share one line when they fit; otherwise the surname wraps to its own full-width line. Each part stays on one line (no mid-word break) — if a part would overflow, the per-card auto-fit (below) sees the clip (`scrollWidth > clientWidth` in `cardFits`) and backs `--tz` off until the whole name fits, so names are normally shown in full and unbroken. Only a single token longer than the card at the minimum scale is clipped (cleanly, no ellipsis, via `overflow:hidden`) rather than spilling over a neighbour. Today cards have **no "TODAY" badge** (the "STAYING TODAY" zone header + cyan border mark them); that was removed so the header width goes to the name. Don't reintroduce a per-card today badge or collapse the name to a single ellipsized block.

**Responsive layout is JS-driven, not CSS media queries — and it is now PER-CARD measure-and-fit, not a fixed per-count scale.** Two stages: (1) `todayLayoutClass(count)` picks the grid geometry only (columns×rows: 1=g1 … 5-6=g6, 7-8=g8 4×2, 9=g9 3×3; 10+ pages at `TODAY_PER_PAGE`=8 forcing g8). `SINGLE_PAGE_MAX`=9 dogs share one page. (2) `fitTodayZone()` → `fitCard()` then binary-searches **each card's own `--tz`** in `[TZ_MIN=0.85, TZ_MAX=2.2]` to the largest scale where `cardFits()` is true (body/card/name not overflowing, measured in pre-transform layout px — never `getBoundingClientRect`). This is what makes a near-empty card grow BIG and a long-medication card shrink so its text shows in FULL, instead of one global scale being pinned by the busiest card. Food/med/notes **wrap** (no ellipsis); high `--med-clamp`/`--notes-clamp`/`--qty-clamp` ceilings (12/12/8) never truncate real data. Only when even `TZ_MIN` overflows does `trimOverflowingCards()` shed lowest-priority content, in order: clamp/drop notes → drop the meals/food-tags row → drop extra qty-rows → clamp the **food** quantity → clamp **medication LAST** (med is never dropped, only reduced last). An empty tomorrow zone is collapsed (`#tomorrowZone` display:none) so today reclaims its ~200px. The fit re-runs on every render and on `document.fonts.ready` (measure with the real Nunito, whose 900-weight glyphs need `line-height` ≥ ~1.25 to not clip under `overflow:hidden`). Preserve the no-scroll, viewport-unit (`100vh`/`100vw`) approach; verify with the headless harness (now includes a `photo` 7-dog scenario and a `trunc` no-truncation metric).

## Conventions

- Frontend is **ES5-style vanilla JS** (`var`, function declarations, string concatenation for HTML, manual `escapeHtml`). Match that style — no frameworks, no build step, no template literals expected.
- Credentials/API keys live in plain variables at the top of the `.gs` file (it runs in the private Apps Script project, not committed to a public host). When keys rotate, update the variables there.
