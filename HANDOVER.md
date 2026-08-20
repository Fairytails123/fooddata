# HANDOVER — this repo is a publish target, not a source

Last updated **2026-08-20**, when the TV feeding-plans page was consolidated into one
canonical home. Read `CLAUDE.md` here first — it is short and it is the whole story.

## The one thing to get right

**Do not edit `index.html` in this repo.** It is the published artefact GitHub Pages serves
at https://fairytails123.github.io/fooddata/. The maintained source is
`..\Feeding manager_Telegram\tv-plans\index.html`, and it is published from there with
`bash scripts/publish_plans_tv.sh`. Two editable copies is precisely what this change ended.

## Owner-locked display rules (unchanged, still binding on the source)

- Dog cards are **never paged** — every today-dog on one screen. Design ceiling 20 dogs.
- **Nothing is ever truncated** — text scales down to a floor, never clips.
- **Alphabetical order everywhere.** **No auto-rotation** — the TV remote chooses the page.
- This is a **safety display** (medication is on it). Treat every change accordingly.

## Where everything went

| Was here | Now |
|---|---|
| `index.html` (source) | `..\Feeding manager_Telegram\tv-plans\index.html` — edit there |
| `tests\` (20-scenario harness) | `..\Feeding manager_Telegram\tests\tv-plans\` |
| `supersetplanner&feed.gs` (boarding mirror) | **deleted** — the live Apps Script is the truth; `Fairytails123/Boardingplan` is the guarded deploy vehicle |
| how to verify | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\tv-plans\build_and_run.ps1` in the platform repo |
| how to publish | `bash scripts/publish_plans_tv.sh "msg"` in the platform repo |

## Cross-system facts that still bite

- The live boarding Apps Script serves `mode=feeding` (this TV) **and `mode=checkinout`** —
  the boarding-stays feed the Feeding Report Manager builds its breakfast/dinner rosters
  from. Contract: `{dogName, checkIn, checkOut, type}` with `checkOut` = the day AFTER the
  last booked night. Change that shape and another production system breaks with it. The
  shared `/exec` URL and `API_TOKEN` are now asserted equal from both sides by
  `scripts/check_contract.js` in the platform repo.
- **The TV never reloads itself** — every publish needs a manual browser refresh on the TV.
- Both sides assume **Europe/London**; drift corrupts today/tomorrow around midnight.
- Allergies have **no field** — they are sniffed out of free-text notes by `/allerg/i`.
- Acuity budget is sacred: ≤3 fetches/day, with a permanent dog-name cache.

Full architecture and the integration plan: `..\Feeding manager_Telegram\CLAUDE.md` and
`..\Feeding manager_Telegram\INTEGRATION.md`.
