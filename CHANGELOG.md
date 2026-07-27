# Changelog — One-Page Board + Rotating Lists Screen, 26 July 2026

Deployed to GitHub Pages 2026-07-26: commits `424a336` (docs) + `40612c4` (board), verified serving live. The TV browser needs one manual refresh after any deploy (the page never reloads itself).

## Same-day revision (night): supplements split, selection-state fixes, security hardening

- **Prescription medication vs training supplements are now separate.** The red MEDICATION chip is prescription-only; the new JotForm "Training Supplements" checklist (Hemp Oil / Multivitamin Tabs / Probiotic Powder/Tab / Calming Tabs) renders as its own green SUPPLEMENTS subcard inside the dog card, between the allergy chip and the food rows. Backend parses the new field (deployed via clasp onto the existing web-app deployment); frontend guards for older cached payloads without the field. Takes visual effect per-record as staff adopt the checklist — existing records still carry supplement text inside Medication Details until edited.
- **Selection-state fixes from the adversarial review of the manual-selection build:** the midnight reset of a manual page choice now works even during a no-data outage; the "never park on a bare cards shell while arrivals exist" rule is a hard per-render pin again (overriding a sticky choice — the arrivals' med detail lives only on the lists page) with a pointer message if the empty page is manually visited; a visibly no-op press no longer silently sets the sticky flag; **OK/Enter now toggles the page** (previously OK could be a no-op on focus-driven TV browsers), and the hint text was made glyph-safe ("Remote arrows or OK change the page"); dead rotation-era CSS/comments removed; old-WebKit fallbacks for the pill buttons.
- **Security hardening:** the backend `.gs` was removed from this public repo (gitignored; it contains API credentials and the repo is Pages-served). The local file is now a mirror of the LIVE Apps Script — which also carries a check-in/out snapshot layer the old repo copy lacked (caught by a pre-push drift check). Credential rotation tracked separately.
- Verified: 19 headless-Chrome scenarios green (supplements on sparse/dense/worst-case cards, supplements-only dog shows no red chip, OK-toggle, arrow toggle, no-rotation hold, arrivals-only pin); live API re-verified 200 after the backend redeploy.
- **Owner-confirmed live on the TV same night** ("it all works"): the first real supplement records render the green subcard with no red chip. A token-gated `mode=clearfeedingcache` admin hook was added to the backend so freshly ticked/edited submissions can be pulled onto the board immediately for testing (drops the two feeding caches only — zero Acuity quota cost).

### Final review round (closed out late night — frontend `6b328c1`, backend deployment @28, all 12 findings fixed)

- **Arriving dogs' supplements now show on the ARRIVING TOMORROW list** as a green detail line — arrivals have no card, so that list is their only surface; without this the supplement was invisible exactly when feeds are prepped in advance.
- **Sticky/pin interaction closed:** the zero-today lists pin clears the sticky flag it overrides (a stale morning press can no longer park the board on the lists page after dogs check in); remote presses are ignored while the board has zero dogs; only a page-changing press is sticky; the day is stamped at boot so even a press during a cache-less pre-midnight boot resets next day.
- **OK/Enter hardened:** `e.repeat` + 450 ms debounce (held or stuck OK cannot strobe pages) and pill clicks inside the window are dropped (TV shells sending both a keydown and a synthesized click per OK press cannot un-toggle).
- **Backend:** shared `parseCheckboxAnswer_` for foodTypes + supplements handles object-shaped JotForm answers and logs unrecognised shapes instead of silently dropping them.
- Docs synced (file-header remote contract, clasp-only backend testing, 19-scenario harness description). All 19 scenarios green, including new arrivals-supplements and repeat/double-fire assertions.

## Same-day revision (evening): manual page selection replaces auto-rotation

- **Auto-rotation removed entirely** (owner request): the board stays on the chosen page until the other button is pressed.
- The header count pills are now real **remote-driven buttons**: **TODAY** (cards page) and **TOMORROW & PREP LIST** (renamed — that page holds tomorrow's arrivals AND today's feed-prep checklist). Selected pill = filled; other = ghost outline; hint line "◄ ► or OK on the remote changes page".
- **Three input paths**, all reaching `selectScreen()` (TV browsers vary): pill click (cursor-mode remotes), focus + OK (pills are focusable buttons; focus follows the selection so OK always has a target), and raw ◄/► arrow keys anywhere (deterministic: ◄=TODAY ►=TOMORROW, `e.key` + `e.keyCode` both checked for old WebKits).
- **Selection rules:** an explicit press is sticky (renders never override it); defaults until then = TODAY, or TOMORROW & PREP LIST when only arrivals exist; midnight resets the manual choice (yesterday's "tomorrow" page is about today).
- Page content, card layout, feeding info and dog counts unchanged.
- Verified: 18 headless-Chrome scenarios green, incl. click-path selection, ArrowRight/ArrowLeft toggle, a 70-virtual-second no-rotation hold, and the arrivals-only default; zero errors/overflows/truncation throughout.
- ✅ Owner-confirmed working on the real TV with the physical remote, 2026-07-26 evening ("all works fine"). All three input paths remain wired — do not remove any of them; which one the Hisense browser uses was never isolated, only that the combination works.

## Rollback

```
git push origin 2a61e12:main --force
```

(`2a61e12` = the last pre-rebuild commit / the previous live board. The older `pre-tv-upgrade-20260611` tag still restores the pre-June-2026 board.)

## Owner-locked decisions (interviewed 2026-07-26)

- **Dog cards are NEVER paged.** Every dog staying today renders on ONE cards screen; a fuller house means smaller cards, never a second page.
- **Nothing is ever truncated — text shrinks as far as needed** (per-card fit floor `TZ_MIN` 0.85 → 0.3). The trim ladder only exists below that floor and was never reached in testing.
- **Alphabetical display order** (dog first name, then surname; `localeCompare` so accented names file correctly) on the cards and both lists. The backend's med-first sort is transport-only now — CLAUDE.md records that med-first display MUST return if paging ever does. Safe because every dog is always on screen.
- **Design ceiling 20 dogs** (grid ladder g10 5×2 → g20 5×4, `dense` styling ≥10, inline cols×rows valve beyond 20).
- **The tomorrow mini-card strip is gone** — replaced by a second rotating LISTS screen so the cards screen keeps the whole canvas. Dwell 45 s cards / 15 s lists (`CARDS_SCREEN_SECONDS` / `LISTS_SCREEN_SECONDS`, one-line retunables).

## Changes

- **Lists screen:** "FEED PREP — IN TONIGHT" (every today dog, alphabetical, checkbox bullets, red MEDS / amber ALLERGY / NO RECORD flags) + "ARRIVING TOMORROW" (same flags **plus full medication-details and allergy-sentence lines** — arrivals have no card anywhere, so their med text lives here and must never be reduced to a bare flag).
- **Rotation guards:** a board with only arrivals pins the lists screen (no bare "No dogs boarding today" shell 45 s of every minute); leaving the board view cancels any mid-flight fade swap (the 360 ms callback can never resurrect the board over the offline/empty state — the callback also re-checks itself); the dwell counter resets while rotation is parked so a returning board gets its full 45 s; the cross-fade genuinely fades both ways (incoming zone's opacity hits 0 before its render/fit); rotation swaps skip rebuilding unchanged screens via `state.renderVersion` stamps (a swap is a display/opacity toggle, not ~180 forced reflows on the TV CPU).
- **List fitting:** shared `bisectScale()` (also used by the card fit) sizes each panel's `--lz`; `listFits()` checks the container on both axes AND every name span (stops long names overlapping the next column invisibly); columns escalate to 4 before an explicit amber "LIST TOO LONG — SOME NAMES CLIPPED" banner — a safety checklist never clips silently.
- **Removed:** today-zone paging (constants, slicing, `PAGE x OF y` indicator element + CSS), the tomorrow strip and its `scard` styles, the day badge, the per-page fade machinery.
- Name rendering unified in `buildNamePartsHtml` (cards + lists share the escape-both / never-drop-the-surname contract); `-webkit-` column prefixes for the old Hisense WebKit.

## Verification

16 headless-Chrome scenarios at 1920×1080 (live replay, 18- and 20-dog single-page boards with shuffled names proving the alphabetical sort, arrivals-only pin, 50 s rotation landing on the lists screen, worst-case 10× heavy meds, empty, fetch-fail with/without cache, hung fetch, poison payload, backend stale, overlap dedup, midnight rollover, XSS) — zero JS errors, zero card overflows, zero truncation, order checks green — plus two 24/32-agent adversarial review workflows; all 15 verified findings (8 correctness, incl. the fade-timer/offline race and the missing arrivals med details) fixed and re-verified.

---

# Changelog — TV Display Upgrade, 11 June 2026

## Rollback

One command restores the previous live board exactly as it was:

```
git push origin pre-tv-upgrade-20260611:main --force
```

(Backups: tag `pre-tv-upgrade-20260611` and branch `backup/pre-tv-upgrade-20260611`, both pushed to origin, both pointing at commit `516a0d5` — the version live before this upgrade.)

## Audit findings

- **Data source:** Google Apps Script web app (`supersetplanner&feed.gs`), `GET ?mode=feeding&token=…` returning `{dogs, dogCount, dateRange, lastUpdated, error, feedingError}`. Each dog: `dogName`, `ownerSurname`, `checkIn`/`checkOut` (`YYYY-MM-DD`, checkOut exclusive), `type` (`boarding`|`school`), `matched`, `matchType`, and `feeding` (`mealsPerDay`, `foodTypes[]`, `kibbleSummary`, `wetFood`, `tinFood`, `specialNotes`, `medication`, `medicationDetails`) or `null`. **Unchanged** — zero backend edits.
- **Today/tomorrow** was already derived client-side in `filterTodayTomorrow`: staying today = `checkIn <= today && checkOut > today`; arriving tomorrow = `checkIn === tomorrow`; overlap counts as today. The same rules are kept verbatim (now in `classifyDogs`), but the two groups are rendered in separate zones instead of one mixed grid.
- **Refresh:** fixed at 07:00 / 13:00 / 18:00 browser-local (Acuity quota protection) — preserved.
- **Resilience flaw found:** the old board rendered `dogs: []` on any fetch error, blanking the screen until the next scheduled slot (up to ~13 h). Fixed (see below).
- **No dedicated allergy field exists** in the JotForm data — allergies live in `specialNotes` free text. The new allergy flag is detected from there (`/allerg/i`).

## Changes

### Layout & theme (new)
- Dark navy theme built on the brand family — deep navy `#023E8A`, mid blue `#0077B6`, cyan `#00B4D8` — with amber `#FFB703` as the tomorrow family. Chosen for distance legibility and glare on a wall TV; all text/background pairs computed to WCAG AA at their size.
- **Today zone** (~75–80% of screen): cyan-edged cards, paged 8 per page (4×2). With ≤8 dogs the grid rescales for bigger cards (2 dogs = half-screen cards with 72px names).
- **Tomorrow strip** along the bottom: compact amber-edged cards, max 5 per row, amber top rule separating it.
- **Colour is never the only signal:** every card carries a large `TODAY` (cyan) or `TOMORROW` (amber) text badge.
- **Header band:** local logo, title, today/tomorrow count pills, live clock + date, status pill (`LIVE` / `DATA MAY BE OUT OF DATE` / `WAITING FOR DATA`), last-updated time and refresh countdown. The old footer was removed; its countdown moved into the header.
- **Paging:** both zones cycle every 12 s with a 0.35 s fade and a `PAGE x OF y` indicator. Text never shrinks below the minimums to cram more in.
- **Minimum sizes at the densest layout:** dog name 48px, quantity values 30px, notes/medication 28px, TODAY badge 24px, strip names 32px.
- **TV-safe margins:** all content inside 38px/76px page padding (~4% per edge for overscan).
- **Logo** downloaded from ImgBB into `assets/img/logo.jpg` and referenced relatively (with an `onerror` hide so a missing file can never show a broken-image glyph). No more hot-linking.
- Empty, loading and offline states restyled to match. Empty-state text now says "No dogs boarding today or arriving tomorrow" (the old "next 7 days" wording no longer matched what the board shows).

### Behaviour (new or fixed)
- **Dogs beyond tomorrow are hidden** (previously: already filtered — unchanged), and their presence causes no errors (tested).
- **Midnight rollover:** classification is recomputed from the device date on every render, and a master tick re-renders when the date changes — no page reload needed (tested with a simulated 23:59→00:00 clock).
- **Never blanks:** the last good payload is kept in memory **and localStorage**, so even a reboot during an outage restores the last known board with a stale indicator. A fetch failure shows the cached board + amber "DATA MAY BE OUT OF DATE" pill + explanation banner, retrying after 10 minutes instead of waiting hours for the next slot (retries hit the Apps Script cache, not Acuity's quota).
- **Fetch watchdog (review finding):** a request that never settles is abandoned after 90 s — previously (in both old and new code) a single hung fetch would have silently disabled all future refreshes forever while still showing "LIVE".
- **Poison-payload guard (review finding):** a 200-OK response carrying an error with no dogs (bad token, backend first-run failure) no longer replaces good data or overwrites the localStorage cache — the board keeps the last good dogs and retries.
- **Error-aware empty state (review finding):** when an error is present and no dogs parse, the board shows the problem state, not a misleading "No dogs boarding" claim (this restores a deliberate behaviour of the old board).
- **Timer hygiene:** exactly one `setInterval` for the page's lifetime drives the clock, countdown, paging, rollover and refresh schedule; the only `setTimeout` is the guarded page-fade (cleared before reuse). All rendering replaces `innerHTML` of fixed containers — nothing accumulates.
- **Graceful density degradation:** a card that physically cannot hold everything sheds content in strict priority order (notes clamp → notes → meals/food-tags row → extra quantity rows bottom-up → med details clamp to one line → spacing compression). Medication, allergy and the primary quantity row are never removed, and nothing is ever clipped mid-line (verified with 8× worst-case cards: meds + allergy + 3 quantities + long notes + error banner simultaneously).

### Preserved unchanged
- API URL, token, request shape, response parsing; 07:00/13:00/18:00 schedule semantics.
- Dedup rules (medication > matched > later check-in, first-seen position kept), extended only by "today beats tomorrow" across zones.
- Backend sort respected (medication dogs render first, so they appear on page 1).
- School vs boarding distinction (purple/blue type pill), meals-per-day badge, food-type tags incl. unknown-type fallback, kibble/wet/tin quantity rows, notes, medication alert with the same fallback text, "No feeding record — check JotForm" banner, `error`/`feedingError` banners, `escapeHtml` on every user-data interpolation (XSS-probed).
- ES5-only JS and the CSS feature set already proven on this TV (custom properties, calc, grid, flex+gap, line-clamp). No new risky features.

## Open decisions taken (and why)
- **Theme: dark.** Bright cards on near-black read best at 3–5 m and minimise glare; brand cyan/amber give maximum day-colour separation (also distinguishable with the most common colour-vision deficiencies, plus the text badges).
- **Page timing: 12 s** per page — long enough to read an 8-card page from across a room, short enough that a 3-page day fully cycles in ~36 s.
- **Allergy chip** is self-contained: it extracts the allergy sentence from the notes (e.g. "ALLERGY: Allergic to chicken") so the warning survives even when the notes block is trimmed for space.
- **Failure retry: 10 min**, capped at the next scheduled slot; fetch watchdog 90 s.
- **Tomorrow strip at 4–5 cards** drops the Holiday/School pill and slims the badge to keep names legible (the zone header still says ARRIVING TOMORROW).
- **Med fallback text** unified to "See medication bag / check with owner" everywhere.

## How today/tomorrow is derived
From `checkIn`/`checkOut` only, against the TV's local date, recomputed every render:
- **TODAY** = `checkIn <= today AND checkOut > today` (already boarding, not yet checked out — a dog also staying tomorrow stays TODAY).
- **TOMORROW** = `checkIn === tomorrow` and not already staying.
- Anything else is not rendered.

## Verification
13 headless-Chrome scenarios at 1920×1080 (live API data, 2/18-dog loads, paging cycle, empty, fetch-fail with/without cache, hung fetch, poison payload, backend stale fallback, overlap dedup, midnight rollover, XSS probe, worst-case density) — all passing with zero JS errors and zero clipped cards — plus a 17-agent adversarial code review (5 lenses, every finding independently verified; 7 confirmed findings all fixed, 2 false positives rejected).
