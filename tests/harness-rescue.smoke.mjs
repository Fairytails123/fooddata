// Acceptance tests for task `harness-rescue` (contract: .task/contract.md).
// Plain node, no framework: report() accumulator, exit code = failure count.
// Authored BEFORE implementation (tests-first) — they MUST fail on the bare repo.
//
// Env: FTBOARD_SKIP_CHROME=1 skips the two tests that spawn PowerShell/Chrome
// (the Codex sandbox cannot spawn nested browsers). The skip is reported LOUDLY;
// the operator runs the full suite outside the sandbox before the gate counts.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const harnessPath = join(here, 'build_and_run.ps1');
const assertPath = join(here, 'assert_results.ps1');
const fixturePath = join(here, 'fixtures', 'api_sample.synthetic.json');
const skipChrome = process.env.FTBOARD_SKIP_CHROME === '1';

const FOOD_TYPES = ['Kibble', 'Wet Food - Sachet/Tray', 'Wet Food - Tin',
  'Pre-Portioned by parents', 'Special Requirements'];
const AMOUNTLESS = ['Pre-Portioned by parents', 'Special Requirements'];
const SUPPLEMENTS = ['Hemp Oil', 'Multivitamin Tabs', 'Probiotic Powder/Tab', 'Calming Tabs'];
const MATCH_TYPES = ['exact', 'fullname', 'name_only', 'fuzzy', 'surname', 'none'];

let failures = 0;
let checks = 0;
function report(name, ok, detail) {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? '  -- ' + detail : ''}`);
}
function skip(name, why) {
  console.log(`SKIP  ${name}  -- ${why} (NOT counted as pass; operator must run without the skip)`);
}
function readText(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }
function git(args) {
  const r = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}

// ---------------------------------------------------------------- test 1
// harness-paths-self-relative
{
  const t = readText(harnessPath);
  report('harness-paths-self-relative: tests/build_and_run.ps1 exists', t !== null);
  if (t !== null) {
    const committedTexts = [['build_and_run.ps1', t]];
    const at = readText(assertPath);
    if (at !== null) committedTexts.push(['assert_results.ps1', at]);
    for (const [name, text] of committedTexts) {
      report(`harness-paths-self-relative: no hardcoded user path in ${name}`,
        !/C:\\+Users\\/i.test(text), 'found a literal C:\\Users\\ path');
    }
    report('harness-paths-self-relative: repo root derived from $PSCommandPath',
      /\$PSCommandPath/.test(t));
    report('harness-paths-self-relative: scratch dir derived from $env:TEMP',
      /\$env:TEMP/i.test(t));
    report('harness-paths-self-relative: Chrome resolved by probing (ProgramFiles), not one literal path',
      /ProgramFiles/i.test(t));
  }
}

// ---------------------------------------------------------------- test 2
// fixture-schema-and-synthetic-marker
{
  const raw = readText(fixturePath);
  report('fixture-schema: tests/fixtures/api_sample.synthetic.json exists', raw !== null);
  let fx = null;
  if (raw !== null) { try { fx = JSON.parse(raw); } catch (e) { report('fixture-schema: parses as JSON', false, String(e)); } }
  if (fx) {
    report('fixture-schema: parses as JSON', true);
    report('fixture-schema: _synthetic === true', fx._synthetic === true);
    const dogs = Array.isArray(fx.dogs) ? fx.dogs : [];
    report('fixture-schema: 18 dogs', dogs.length === 18, `got ${dogs.length}`);
    report('fixture-schema: dogCount matches', fx.dogCount === dogs.length);
    report('fixture-schema: dateRange start/end strings',
      !!fx.dateRange && typeof fx.dateRange.start === 'string' && typeof fx.dateRange.end === 'string');
    report('fixture-schema: lastUpdated string', typeof fx.lastUpdated === 'string');
    report('fixture-schema: error and feedingError null', fx.error === null && fx.feedingError === null);

    let shapeOk = dogs.length > 0;
    const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
    for (const d of dogs) {
      if (typeof d.dogName !== 'string' || typeof d.ownerSurname !== 'string' ||
          !isDate(d.checkIn) || !isDate(d.checkOut) ||
          !['boarding', 'school'].includes(d.type) ||
          typeof d.matched !== 'boolean' ||
          !MATCH_TYPES.includes(d.matchType) ||
          typeof d.ambiguousMatch !== 'boolean' ||
          (d.matched === false ? d.feeding !== null : (typeof d.feeding !== 'object' || d.feeding === null))) {
        shapeOk = false; break;
      }
    }
    report('fixture-schema: every dog matches the Dog shape', shapeOk);

    const feds = dogs.filter(d => d.feeding).map(d => d.feeding);
    let vocabOk = feds.length > 0;
    for (const f of feds) {
      if (!Array.isArray(f.foodTypes) || !f.foodTypes.every(x => FOOD_TYPES.includes(x))) { vocabOk = false; break; }
      if ('supplements' in f && (!Array.isArray(f.supplements) || !f.supplements.every(x => SUPPLEMENTS.includes(x)))) { vocabOk = false; break; }
      if (!['Yes', 'No'].includes(f.medication)) { vocabOk = false; break; }
    }
    report('fixture-schema: foodTypes/supplements/medication use the exact vocabularies', vocabOk);

    report('fixture-mix: >=1 unmatched dog (feeding null, matchType none)',
      dogs.some(d => d.matched === false && d.feeding === null && d.matchType === 'none'));
    report('fixture-mix: >=1 ambiguousMatch true', dogs.some(d => d.ambiguousMatch === true));
    report('fixture-mix: >=1 feeding WITHOUT a supplements key',
      feds.some(f => !('supplements' in f)));
    report('fixture-mix: >=1 feeding with supplements: []',
      feds.some(f => Array.isArray(f.supplements) && f.supplements.length === 0));
    report('fixture-mix: >=2 feedings with 1-4 supplements',
      feds.filter(f => Array.isArray(f.supplements) && f.supplements.length >= 1 && f.supplements.length <= 4).length >= 2);
    report('fixture-mix: >=1 amount-less food type with empty quantity fields',
      feds.some(f => f.foodTypes.some(t => AMOUNTLESS.includes(t)) &&
        f.kibbleSummary === '' && f.wetFood === '' && f.tinFood === ''));
    report('fixture-mix: >=1 medication Yes with long medicationDetails (>=90 chars)',
      feds.some(f => f.medication === 'Yes' && typeof f.medicationDetails === 'string' && f.medicationDetails.length >= 90));
    report('fixture-mix: >=1 specialNotes containing "allerg"',
      feds.some(f => /allerg/i.test(f.specialNotes || '')));
    report('fixture-mix: both boarding and school present',
      dogs.some(d => d.type === 'boarding') && dogs.some(d => d.type === 'school'));
    const mts = new Set(dogs.map(d => d.matchType));
    report('fixture-mix: matchType variety (exact, fullname, fuzzy, none all present)',
      ['exact', 'fullname', 'fuzzy', 'none'].every(m => mts.has(m)));
    const firsts = dogs.map(d => (d.dogName || '').split(' ')[0].toLowerCase());
    report('fixture-mix: >=2 dogs share a first name',
      firsts.some((n, i) => firsts.indexOf(n) !== i));
  }
}

// ---------------------------------------------------------------- test 3
// no-pii-tracked-or-referenced
{
  const tracked = git(['ls-files']);
  report('no-pii: git ls-files available', tracked !== null);
  if (tracked !== null) {
    report('no-pii: live_api_sample.json is NOT tracked by git',
      !tracked.split(/\r?\n/).includes('live_api_sample.json'));
  }
  let refFound = null;
  if (existsSync(here)) {
    const walk = dir => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name !== 'harness-rescue.smoke.mjs' && /live_api_sample/.test(readText(p) || '')) refFound = p;
      }
    };
    walk(here);
  }
  report('no-pii: no committed file under tests/ references live_api_sample', refFound === null, refFound || '');
  const t = readText(harnessPath) || '';
  report('no-pii: scenario renamed to fixture, reading the synthetic file',
    /api_sample\.synthetic\.json/.test(t) && /['"]fixture['"]/.test(t));
  report('no-pii: no scenario named live remains',
    t !== '' && !/name\s*=\s*'live'/.test(t) && !/name\s*=\s*"live"/.test(t));
}

// ---------------------------------------------------------------- protected behaviour
{
  const diff = git(['diff', 'main...HEAD', '--name-only']);
  if (diff !== null) {
    const changed = diff.split(/\r?\n/).filter(Boolean);
    report('protected: index.html untouched on this branch', !changed.includes('index.html'));
    report('protected: .gitignore untouched on this branch', !changed.includes('.gitignore'));
    report('protected: supersetplanner&feed.gs untouched on this branch',
      !changed.includes('supersetplanner&feed.gs'));
  } else {
    report('protected: branch diff readable', false, 'git diff main...HEAD failed');
  }
}

// ---------------------------------------------------------------- tests 4 + 5
// full-harness-green / assertion-layer-detects-failure (Chrome-spawning)
if (skipChrome) {
  skip('full-harness-green', 'FTBOARD_SKIP_CHROME=1');
  skip('assertion-layer-detects-failure', 'FTBOARD_SKIP_CHROME=1');
} else {
  if (!existsSync(harnessPath)) {
    report('full-harness-green', false, 'tests/build_and_run.ps1 missing');
    report('assertion-layer-detects-failure', false, 'tests/assert_results.ps1 missing');
  } else {
    const run = spawnSync('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harnessPath],
      { encoding: 'utf8', cwd: repoRoot, timeout: 15 * 60 * 1000 });
    const out = (run.stdout || '') + (run.stderr || '');
    report('full-harness-green: 20-scenario run exits 0', run.status === 0,
      `exit=${run.status}; tail: ${out.slice(-400).replace(/\s+/g, ' ')}`);

    const st = spawnSync('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', assertPath, '-SelfTest'],
      { encoding: 'utf8', cwd: repoRoot, timeout: 2 * 60 * 1000 });
    report('assertion-layer-detects-failure: -SelfTest exits 0 (checker flags the embedded bad sample)',
      st.status === 0, `exit=${st.status}; tail: ${((st.stdout || '') + (st.stderr || '')).slice(-300).replace(/\s+/g, ' ')}`);
  }
}

console.log(`\n${checks} checks, ${failures} failure(s)${skipChrome ? ' [CHROME TESTS SKIPPED — not a full pass]' : ''}`);
process.exit(failures);
