# This repo is a PUBLISH TARGET — do not edit the page here

**The maintained source of the TV feeding-plans page lives in the platform repo:**

```
..\Feeding manager_Telegram\tv-plans\index.html      ← the ONE canonical copy
..\Feeding manager_Telegram\tests\tv-plans\          ← its 20-scenario Chrome harness
```

`index.html` and `assets/` in THIS repo are the **published artefact** that GitHub Pages
serves at https://fairytails123.github.io/fooddata/ (the TV's bookmarked URL, which never
changes). They are generated output, not a source. Editing them here creates exactly the
two-drifting-copies problem this split was made to end.

## To change the TV page

```bash
# in ..\Feeding manager_Telegram
#   1. edit tv-plans/index.html
#   2. verify — 20 scenarios, real Chrome, exit code = failure count
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\tv-plans\build_and_run.ps1
#   3. publish (staged payload is proven byte-identical to the live page)
bash scripts/publish_plans_tv.sh "what changed"
```

`--dry-run` stages and prints the SHA-256 without cloning or pushing.
⚠️ **The TV never reloads itself** — after any publish, refresh the browser on the TV once
by hand or it keeps running the old page indefinitely.

## The boarding Apps Script

The **live Apps Script is the only source of truth** — it is the code that actually runs:

- Script ID `12ZBH5zualFVdVz23pmC7orrqcf6wyUA8YbXKa6kR3kxm4T4KdBubh5gM`
- Deploy vehicle: `Fairytails123/Boardingplan` (`src/supersetplanner-feed.gs`). Its CI
  fingerprints repo vs live HEAD vs the deployed version and **refuses to deploy when live
  matches no committed state**, so editor-only changes are never destroyed.
- The old local mirror in this folder was **deleted 2026-08-20** — it had no drift
  protection and was the copy behind the 2026-07-26 near-miss. Verified byte-identical to
  both live and Boardingplan before removal. To read the truth:
  `clasp clone-script 12ZBH5zualFVdVz23pmC7orrqcf6wyUA8YbXKa6kR3kxm4T4KdBubh5gM`
- To prove live still matches the deploy vehicle:
  `BOARDING=1 bash tests/run.sh` in the platform repo.

**Never push to the live script from a local copy.** Changes go through Boardingplan's
guarded workflow.

## Still here on purpose

- `CHANGELOG.md` — this repo's history, kept.
- `live_api_sample.json` — real customer names + medication, **gitignored**, local only.
  Stays until the folder-merge endgame; it must never reach this public repo or Pages.
- `AGENTS.md` — standing rules.

Background and the full integration plan: `..\Feeding manager_Telegram\INTEGRATION.md`.
