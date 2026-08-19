# HANDOVER — read this before changing anything

Last updated: **2026-08-19** (written as Phase 0 of the feeding-platform integration).
This file exists to stop the next session undoing work or destroying a production API.
If you read nothing else, read §1 and §2.

> **Integration notice (2026-08-19):** this project is being absorbed into the unified
> feeding platform (one repo, shared contracts, one test gate) together with the
> Feeding Report Manager (`..\Feeding manager_Telegram`). The plan of record is the
> "One Feeding Platform" assessment (Claude artifact, 2026-08-19). Until Phase 1 lands,
> everything below describes the CURRENT, still-live layout — keep honouring it.

---

## 1. The one thing that is most likely to be got wrong

**The `supersetplanner&feed.gs` file in this folder is a MIRROR. The LIVE Apps Script
project is the source of truth — and it serves a second production consumer.**

- The live script serves `mode=feeding` (this TV) **and `mode=checkinout`** — the
  boarding-stays feed the **Feeding Report Manager** builds its breakfast/dinner rosters
  from. Contract: `{dogName, checkIn, checkOut, type}`, where `checkOut` = the day AFTER
  the last booked night. Break that shape and another production system breaks with it.
- **Never paste the mirror over the live project.** On 2026-07-26 the live script held an
  entire check-in/out layer the old repo copy lacked — a blind paste/push would have
  destroyed a production API. Deploy flow: `clasp clone-script <scriptId>` into a scratch
  dir → **drift-check the clone against this mirror** → edit the clone → `clasp push -f`
  → `clasp redeploy <deploymentId>` (never a fresh `clasp deploy` — it mints a new URL).
  IDs: `CODING\_SECRETS\google-services.md`.
- There are currently **three copies** of the backend: the live script (truth), this
  gitignored mirror, and the public `Boardingplan` repo whose CI owns deploys. The
  integration plan consolidates this; until then, drift-check before trusting any copy.

## 2. Rules the owner has locked (2026-07-26) — not implementation details

- Dog cards are **never paged** — every today-dog on one screen; smaller cards, never a
  second page. Design ceiling 20 dogs.
- **Nothing is ever truncated** — text scales down (to the `TZ_MIN` floor), never clips.
- **Alphabetical order everywhere** (dog first name, then surname).
- **No auto-rotation** — page choice is manual via the TV remote (pills / ◄ ► / OK).
- This is a **safety display** (medication is on it). Treat every change accordingly.

## 3. Tripwires — doing X? do Y first

| About to… | Do this first |
|---|---|
| deploy `index.html` (push `main`) | run the scenario harness (see §4) — then **refresh the TV browser by hand**; the page never reloads itself and will run old HTML indefinitely |
| edit the `.gs` | read §1. Load the `gas-gotchas` skill. Never touch creds in source — they live in Script Properties (`getCreds_()`), and the IDE settings page **silently fails to save** on this project's big property blobs |
| change `mode=checkinout` output | STOP — the Feeding Report Manager consumes it (see §1). Change both sides together |
| rotate the shared `API_TOKEN` | it is hardcoded in the live script, this mirror, `index.html`, and the Feeding Report Manager's `CONFIG.CHECKINOUT_TOKEN` — all move together or consumers break |
| touch the JotForm parsing | the 15 question IDs (form `240635310347348`) are hardcoded and break **silently** if the form is recreated; same for the Acuity appointment-type names `'dog boarding'` / `'boarding school'` |
| wonder why an edited JotForm submission isn't showing | the incremental fetch keys on `created_at` — edits are invisible for up to 5h. `?mode=clearfeedingcache&token=…` forces a refresh |
| change refresh timing or dates | both sides assume **Europe/London** (Apps Script project TZ + TV browser TZ). Drift corrupts today/tomorrow around midnight |
| install/remove Apps Script triggers | run from the ORIGINAL Google account — `getProjectTriggers()` can't see another account's triggers, so duplicates installed elsewhere survive removal invisibly |

## 4. How changes are verified

The 19-scenario headless-Chrome harness (`build_and_run.ps1`) stamps fetch-stubbed copies
of `index.html` and asserts JS errors, overflow, the no-truncation metric, alphabetical
order, supplements blocks and per-card scale. **Run it after every frontend change.**

- Current location: `%TEMP%\ftboard-tests\build_and_run.ps1` (local-only). **Phase 0 of
  the integration is moving it into this repo with a synthetic fixture** — once
  `tests\` exists here, that copy is canonical and `%TEMP%` is retired.
- Its `live` scenario replays `live_api_sample.json` — **real customer names +
  medication; gitignored on purpose; must never reach the public repo or Pages.**
- Backend: run `testFeedingBoard()` in the LIVE Apps Script editor, or hit `/exec`
  directly (`mode=feeding`, `mode=clearfeedingcache`). `inspectCheckInOutSnapshot()` is
  the read-only, zero-Acuity diagnostic.

## 5. Known-imperfect, deliberately

- **Allergies have no field** — detected by regex `/allerg/i` over free-text notes; a
  differently-phrased allergy is invisible. (Integration plan: add a real form field.)
- **`API_TOKEN` is a pseudo-secret** — served in public HTML; it gates `/exec` but cannot
  be treated as private, and is effectively unrotatable until the contract consolidation.
- **Revoked keys remain in this public repo's git history** (rotated + revoked
  2026-08-09/10; history deliberately not rewritten). Fixtures must stay synthetic.
- **The check-in/out snapshot refuses to persist above ~8.9 KB**
  (`CHECKINOUT_PROPS_VALUE_LIMIT`) — degrades gracefully, but it is a silent capacity
  ceiling that scales with concurrent boarders.
- **Acuity budget is sacred:** ≤3 fetches/day via the 07/13/19 triggers + 65-min dedupe;
  the permanent dog-name cache means each appointment is fetched once, ever. Don't add
  callers that bypass this.

## 6. Where the detail lives

| Need | File |
|---|---|
| Architecture, contracts, owner decisions, deploy commands | `CLAUDE.md` |
| Dated history with rollback commands | `CHANGELOG.md` |
| The integration plan of record | "One Feeding Platform" assessment (Claude artifact) + `..\Feeding manager_Telegram` |
| Script/Deployment IDs, key rotation records | `CODING\_SECRETS\google-services.md` |
