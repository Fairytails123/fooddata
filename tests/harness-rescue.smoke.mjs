// Acceptance tests for task `harness-rescue` (contract v2: .task/contract.md).
// Plain node, no framework: report() accumulator, exit code = failure count.
// Authored BEFORE implementation (tests-first) and revised per the Codex
// pre-flight critique of 2026-08-19 (operator-owned oracles, no tautologies).
//
// Env: FTBOARD_SKIP_SPAWN=1 skips every test that spawns a child process (the
// Codex sandbox denies nested spawns). Skips are LOUD and are never a pass;
// the operator runs the full suite outside the sandbox before the gate counts.
//
// This file and the three fixtures it owns (expected_scenarios.json,
// selftest_good.json, selftest_bad.json) are OPERATOR-owned: the contract
// forbids the implementer from editing them. This file is also the contract's
// single authorised exemption from the live_api_sample content scans (it must
// name the string to assert its absence elsewhere).

import { readFileSync, existsSync, statSync, mkdtempSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const selfName = basename(fileURLToPath(import.meta.url));
const harnessPath = join(here, 'build_and_run.ps1');
const assertPath = join(here, 'assert_results.ps1');
const fixturePath = join(here, 'fixtures', 'api_sample.synthetic.json');
const oraclePath = join(here, 'fixtures', 'expected_scenarios.json');
const selftestGood = join(here, 'fixtures', 'selftest_good.json');
const selftestBad = join(here, 'fixtures', 'selftest_bad.json');
const skipSpawn = process.env.FTBOARD_SKIP_SPAWN === '1';

const MANIFEST = ['fixture', 'two', 'photo', 'eighteen', 'twenty', 'lists',
  'select_back', 'ok_toggle', 'no_rotate', 'empty', 'arrivals_only',
  'fail_nocache', 'fail_cache', 'backend_stale', 'overlap', 'xss',
  'bad_payload', 'hang_cache', 'worst_case', 'midnight'];
const SHOT_SCENARIOS = ['fixture', 'two', 'photo', 'eighteen', 'twenty', 'lists',
  'empty', 'arrivals_only', 'fail_cache', 'worst_case'];
const FIRST_POOL = ['axo', 'bolt', 'glimmer', 'luna', 'momo', 'misty', 'tock',
  'zephyr', 'quill', 'nimbus', 'pixel', 'waffle', 'biscuit', 'comet', 'fig',
  'juniper', 'orbit', 'tansy', 'umbra', 'vole'];
const SURNAME_POOL = ['zorblatt', 'nebulon', 'quixling', 'vexworth', 'snorkelby',
  'fablewick', 'pretendle', 'mockingham', 'testerly', 'fictionford', 'imaginer',
  'storybrook'];
const FOOD_TYPES = ['Kibble', 'Wet Food - Sachet/Tray', 'Wet Food - Tin',
  'Pre-Portioned by parents', 'Special Requirements'];
const AMOUNTLESS = ['Pre-Portioned by parents', 'Special Requirements'];
const SUPPLEMENTS = ['Hemp Oil', 'Multivitamin Tabs', 'Probiotic Powder/Tab', 'Calming Tabs'];
const MATCH_TYPES = ['exact', 'fullname', 'name_only', 'fuzzy', 'surname', 'none'];
const TOP_KEYS = ['_synthetic', 'dogs', 'dogCount', 'dateRange', 'lastUpdated', 'error', 'feedingError'];
const DOG_KEYS = ['dogName', 'ownerSurname', 'checkIn', 'checkOut', 'type', 'matched', 'matchType', 'ambiguousMatch', 'feeding'];
const FEED_KEYS_REQ = ['mealsPerDay', 'foodTypes', 'kibbleSummary', 'wetFood', 'tinFood', 'specialNotes', 'medication', 'medicationDetails'];
const PII_BASENAME = 'live_api_sample';
const USER_PATH_RE = new RegExp('C:\\\\+Users\\\\', 'i');

let failures = 0;
let checks = 0;
function report(name, ok, detail) {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? '  -- ' + detail : ''}`);
}
function skip(name, why) {
  console.log(`SKIP  ${name}  -- ${why} (NOT a pass; operator must run without the skip)`);
}
function readText(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }
function git(args) {
  const r = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}
function gitOk(args) {
  return spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).status === 0;
}
function ps(args, opts) {
  return spawnSync('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args],
    { encoding: 'utf8', timeout: 16 * 60 * 1000, ...opts });
}
function trackedFiles() {
  const out = git(['ls-files']);
  return out === null ? null : out.split(/\r?\n/).filter(Boolean);
}
const isoDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const keySetOk = (obj, allowed, required) => {
  const keys = Object.keys(obj);
  return keys.every(k => allowed.includes(k)) && required.every(k => keys.includes(k));
};
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// ---------------------------------------------------------------- test 1
// harness-resolves-paths
{
  const t = readText(harnessPath);
  report('paths: tests/build_and_run.ps1 exists', t !== null);

  const tf = trackedFiles();
  if (tf !== null) {
    let hit = null;
    for (const f of tf.filter(x => x.startsWith('tests/') && basename(x) !== selfName)) {
      if (USER_PATH_RE.test(readText(join(repoRoot, f)) || '')) hit = f;
    }
    report('paths: no literal user-profile path in any tracked tests/ file (smoke exempt)', hit === null, hit || '');
  } else {
    report('paths: git ls-files available', false);
  }

  if (skipSpawn) {
    skip('paths: -Validate resolves from a foreign cwd', 'FTBOARD_SKIP_SPAWN=1');
    skip('paths: missing Chrome fails loudly', 'FTBOARD_SKIP_SPAWN=1');
  } else if (t === null) {
    report('paths: -Validate resolves from a foreign cwd', false, 'harness missing');
    report('paths: missing Chrome fails loudly', false, 'harness missing');
  } else {
    const tmpBase = mkdtempSync(join(tmpdir(), 'frv-'));
    const v = ps(['-File', harnessPath, '-Validate'],
      { cwd: tmpdir(), env: { ...process.env, TEMP: tmpBase, TMP: tmpBase } });
    let vj = null;
    try { vj = JSON.parse((v.stdout || '').trim()); } catch { }
    const norm = p => String(p || '').replace(/[\\/]+/g, '\\').replace(/\\$/, '').toLowerCase();
    report('paths: -Validate resolves from a foreign cwd',
      v.status === 0 && vj !== null && norm(vj.repoRoot) === norm(repoRoot) &&
      norm(vj.outDir).startsWith(norm(tmpBase)) && vj.chromeFound === true,
      `exit=${v.status} json=${JSON.stringify(vj || (v.stdout || '').slice(0, 120))}`);

    const emptyDir = join(tmpBase, 'empty'); mkdirSync(emptyDir, { recursive: true });
    const nc = ps(['-File', harnessPath, '-Validate'],
      { cwd: tmpdir(), env: { ...process.env, TEMP: tmpBase, TMP: tmpBase,
        FTBOARD_CHROME: join(tmpBase, 'no-chrome.exe'),
        ProgramFiles: emptyDir, 'ProgramFiles(x86)': emptyDir, LOCALAPPDATA: emptyDir } });
    report('paths: missing Chrome fails loudly',
      nc.status !== 0 && /chrome/i.test((nc.stdout || '') + (nc.stderr || '')),
      `exit=${nc.status}`);
  }
}

// ---------------------------------------------------------------- test 2
// fixture-schema-and-synthetic-marker
let fx = null;
{
  const raw = readText(fixturePath);
  report('fixture: file exists', raw !== null);
  if (raw !== null) { try { fx = JSON.parse(raw); } catch (e) { report('fixture: parses as JSON', false, String(e)); } }
  if (fx) {
    report('fixture: parses as JSON', true);
    report('fixture: exact top-level keys', keySetOk(fx, TOP_KEYS, TOP_KEYS));
    report('fixture: _synthetic === true', fx._synthetic === true);
    const dogs = Array.isArray(fx.dogs) ? fx.dogs : [];
    report('fixture: 18 dogs, dogCount matches', dogs.length === 18 && fx.dogCount === 18, `got ${dogs.length}/${fx.dogCount}`);
    report('fixture: dateRange exact keys + ISO ordered',
      !!fx.dateRange && keySetOk(fx.dateRange, ['start', 'end'], ['start', 'end']) &&
      isoDate(fx.dateRange.start) && isoDate(fx.dateRange.end) && fx.dateRange.start < fx.dateRange.end);
    report('fixture: lastUpdated ISO-8601 timestamp',
      typeof fx.lastUpdated === 'string' && /T/.test(fx.lastUpdated) && !isNaN(Date.parse(fx.lastUpdated)));
    report('fixture: error and feedingError null', fx.error === null && fx.feedingError === null);

    let shapeOk = dogs.length > 0, keysOk = dogs.length > 0, namesOk = dogs.length > 0, why = '';
    for (const d of dogs) {
      if (!keySetOk(d, DOG_KEYS, DOG_KEYS)) { keysOk = false; why = 'dog keys ' + Object.keys(d); break; }
      if (typeof d.dogName !== 'string' || typeof d.ownerSurname !== 'string' ||
          !isoDate(d.checkIn) || !isoDate(d.checkOut) || d.checkIn >= d.checkOut ||
          !['boarding', 'school'].includes(d.type) || typeof d.matched !== 'boolean' ||
          !MATCH_TYPES.includes(d.matchType) || typeof d.ambiguousMatch !== 'boolean') { shapeOk = false; why = 'dog ' + d.dogName; break; }
      if (d.matched === false) {
        if (d.feeding !== null || d.matchType !== 'none') { shapeOk = false; why = 'unmatched ' + d.dogName; break; }
      } else {
        const f = d.feeding;
        if (typeof f !== 'object' || f === null) { shapeOk = false; why = 'feeding null ' + d.dogName; break; }
        if (!keySetOk(f, [...FEED_KEYS_REQ, 'supplements'], FEED_KEYS_REQ)) { keysOk = false; why = 'feeding keys ' + Object.keys(f); break; }
        if (typeof f.mealsPerDay !== 'string' || typeof f.kibbleSummary !== 'string' ||
            typeof f.wetFood !== 'string' || typeof f.tinFood !== 'string' ||
            typeof f.specialNotes !== 'string' || typeof f.medicationDetails !== 'string' ||
            !['Yes', 'No'].includes(f.medication) ||
            !Array.isArray(f.foodTypes) || f.foodTypes.length === 0 ||
            !f.foodTypes.every(x => FOOD_TYPES.includes(x)) ||
            ('supplements' in f && (!Array.isArray(f.supplements) || !f.supplements.every(x => SUPPLEMENTS.includes(x))))) {
          shapeOk = false; why = 'feeding types ' + d.dogName; break;
        }
      }
      const toks = d.dogName.split(' ');
      if (toks.length < 1 || toks.length > 2 ||
          !FIRST_POOL.includes(toks[0].toLowerCase()) ||
          (toks.length === 2 && !SURNAME_POOL.includes(toks[1].toLowerCase())) ||
          !SURNAME_POOL.includes(d.ownerSurname.toLowerCase())) { namesOk = false; why = 'name ' + d.dogName + '/' + d.ownerSurname; break; }
      if (d.matchType === 'fullname' && toks.length !== 2) { namesOk = false; why = 'fullname dog needs 2 tokens: ' + d.dogName; break; }
    }
    report('fixture: exact dog/feeding key allowlists', keysOk, why);
    report('fixture: every dog matches the shape + value rules', shapeOk, why);
    report('fixture: names only from the fictional pools', namesOk, why);

    const feds = dogs.filter(d => d.feeding).map(d => d.feeding);
    report('fixture-mix: >=1 unmatched dog', dogs.some(d => d.matched === false));
    report('fixture-mix: >=1 ambiguousMatch true', dogs.some(d => d.ambiguousMatch === true));
    report('fixture-mix: >=1 feeding WITHOUT supplements key', feds.some(f => !('supplements' in f)));
    report('fixture-mix: >=1 feeding with supplements: []', feds.some(f => Array.isArray(f.supplements) && f.supplements.length === 0));
    report('fixture-mix: >=2 feedings with 1-4 supplements',
      feds.filter(f => Array.isArray(f.supplements) && f.supplements.length >= 1 && f.supplements.length <= 4).length >= 2);
    report('fixture-mix: >=1 amount-less food type with empty quantities',
      feds.some(f => f.foodTypes.some(t => AMOUNTLESS.includes(t)) && f.kibbleSummary === '' && f.wetFood === '' && f.tinFood === ''));
    report('fixture-mix: >=1 medication Yes with >=90-char details',
      feds.some(f => f.medication === 'Yes' && f.medicationDetails.length >= 90));
    report('fixture-mix: >=1 specialNotes with an allergy sentence', feds.some(f => /allerg/i.test(f.specialNotes)));
    report('fixture-mix: both boarding and school',
      dogs.some(d => d.type === 'boarding') && dogs.some(d => d.type === 'school'));
    const mts = new Set(dogs.map(d => d.matchType));
    report('fixture-mix: matchTypes exact+fullname+fuzzy+none present',
      ['exact', 'fullname', 'fuzzy', 'none'].every(m => mts.has(m)));
    const firsts = dogs.map(d => d.dogName.split(' ')[0].toLowerCase());
    report('fixture-mix: >=2 dogs share a first name', firsts.some((n, i) => firsts.indexOf(n) !== i));
  }
}

// ---------------------------------------------------------------- test 3
// no-pii-tracked-or-referenced
{
  const tf = trackedFiles();
  if (tf !== null) {
    const badName = tf.find(f => basename(f).toLowerCase().includes(PII_BASENAME));
    report('no-pii: no tracked file is named like the PII capture', badName === undefined, badName || '');
    let hit = null;
    for (const f of tf.filter(x => x.startsWith('tests/') && basename(x) !== selfName)) {
      if (new RegExp(PII_BASENAME, 'i').test(readText(join(repoRoot, f)) || '')) hit = f;
    }
    report('no-pii: no tracked tests/ file references the PII capture (smoke exempt)', hit === null, hit || '');
  } else {
    report('no-pii: git ls-files available', false);
  }
  const t = readText(harnessPath) || '';
  report('no-pii: fixture scenario present, reading the synthetic file',
    /api_sample\.synthetic\.json/.test(t) && /['"]fixture['"]/.test(t));
  report('no-pii: no scenario named live remains',
    t !== '' && !/name\s*=\s*'live'/.test(t) && !/name\s*=\s*"live"/.test(t));
}

// ---------------------------------------------------------------- protected behaviour
{
  for (const f of ['index.html', '.gitignore', 'supersetplanner&feed.gs']) {
    const st = git(['status', '--porcelain', '--', f]);
    report(`protected: ${f} has no uncommitted change`, st !== null && st.trim() === '', (st || '').trim());
  }
  const diff = git(['diff', 'main...HEAD', '--name-only']);
  if (diff !== null) {
    const changed = diff.split(/\r?\n/).filter(Boolean);
    for (const f of ['index.html', '.gitignore', 'supersetplanner&feed.gs']) {
      report(`protected: ${f} untouched on this branch`, !changed.includes(f));
    }
  } else {
    report('protected: branch diff readable', false);
  }
  report('protected: live_api_sample.json still gitignored', gitOk(['check-ignore', '-q', 'live_api_sample.json']));
  report('protected: supersetplanner&feed.gs still gitignored', gitOk(['check-ignore', '-q', 'supersetplanner&feed.gs']));
}

// ---------------------------------------------------------------- test 4
// full-harness-green
{
  const name = 'full-harness-green';
  if (skipSpawn) {
    skip(name, 'FTBOARD_SKIP_SPAWN=1');
  } else if (!existsSync(harnessPath)) {
    report(name, false, 'tests/build_and_run.ps1 missing');
  } else {
    const oracleRaw = readText(oraclePath);
    let oracle = null;
    try { oracle = JSON.parse(oracleRaw); } catch { }
    report('full: oracle fixture parses', oracle !== null);

    const preStatus = git(['status', '--porcelain']) || 'PRE-FAIL';
    const runStart = Date.now();
    const run = ps(['-File', harnessPath], { cwd: repoRoot });
    const out = (run.stdout || '');
    report('full: 20-scenario run exits 0', run.status === 0,
      `exit=${run.status}; tail: ${(out + (run.stderr || '')).slice(-300).replace(/\s+/g, ' ')}`);

    const blocks = {};
    const re = /^=== (\S+) ===\r?\n(\{.*\})\s*$/gm;
    let m; while ((m = re.exec(out)) !== null) { try { blocks[m[1]] = JSON.parse(m[2]); } catch { blocks[m[1]] = null; } }
    const got = Object.keys(blocks).sort();
    report('full: output scenarios exactly match the manifest',
      JSON.stringify(got) === JSON.stringify([...MANIFEST].sort()),
      `got ${got.join(',') || 'none'}`);

    const invariants = (n, j) => {
      if (!j) { report(`full: ${n} inspection JSON parses`, false); return; }
      const inv = Array.isArray(j.errors) && j.errors.length === 0 && j.overflows === 0 &&
        j.listOverflow === 0 && j.trunc && j.trunc.count === 0 &&
        j.alphaCards === true && j.alphaPrep === true && j.alphaTom === true &&
        j.logoOk === true && j.loading === false;
      report(`full: ${n} invariants (errors/overflow/trunc/alpha/logo)`, inv,
        JSON.stringify({ e: j.errors, o: j.overflows, lo: j.listOverflow, t: j.trunc && j.trunc.count, ac: j.alphaCards, l: j.logoOk }));
    };
    for (const n of MANIFEST) invariants(n, blocks[n]);

    if (oracle) {
      const FIELDS = ['screen', 'tcards', 'prepItems', 'tomItems', 'empty', 'offline', 'board',
        'stale', 'medChips', 'allergyChips', 'suppBlocks', 'medFlags', 'listDetails',
        'clipWarns', 'noMatch', 'gridClass', 'cacheHasDogs', 'selPill'];
      for (const [n, exp] of Object.entries(oracle)) {
        const j = blocks[n];
        if (!j) { report(`full: ${n} matches oracle`, false, 'no output'); continue; }
        const bad = [];
        for (const f of FIELDS) if (f in exp && JSON.stringify(j[f]) !== JSON.stringify(exp[f])) bad.push(`${f}=${JSON.stringify(j[f])}!=${JSON.stringify(exp[f])}`);
        if ('errorsLen' in exp && (!Array.isArray(j.errors) || j.errors.length !== exp.errorsLen)) bad.push('errorsLen');
        if ('xssTextPrefix' in exp && !(typeof j.xssText === 'string' && j.xssText.startsWith(exp.xssTextPrefix))) bad.push(`xssText=${j.xssText}`);
        report(`full: ${n} matches oracle`, bad.length === 0, bad.join(' '));
      }
    }

    if (fx) {
      const d0 = fx.dateRange.start;
      const staying = fx.dogs.filter(d => d.checkIn <= d0 && d.checkOut > d0);
      const j = blocks.fixture;
      if (j) {
        const sorted = [...staying].sort((a, b) => a.dogName.toLowerCase() < b.dogName.toLowerCase() ? -1 : 1);
        const expFirst = sorted.length ? sorted[0].dogName.split(' ')[0] : null;
        const bad = [];
        if (j.tcards !== staying.length) bad.push(`tcards=${j.tcards}!=${staying.length}`);
        if (j.screen !== 'cards') bad.push('screen=' + j.screen);
        if (j.empty !== false || j.offline !== false || j.board !== true) bad.push('state');
        if (j.noMatch !== staying.filter(d => !d.matched).length) bad.push('noMatch=' + j.noMatch);
        if (j.medChips !== staying.filter(d => d.feeding && d.feeding.medication === 'Yes').length) bad.push('medChips=' + j.medChips);
        if (expFirst && !(typeof j.xssText === 'string' && j.xssText.startsWith(expFirst))) bad.push(`firstCard=${j.xssText}`);
        report('full: fixture matches smoke-computed expectations (rebase rule)', bad.length === 0, bad.join(' '));
      } else {
        report('full: fixture matches smoke-computed expectations (rebase rule)', false, 'no fixture output');
      }
    } else {
      report('full: fixture expectations computable', false, 'fixture unparsed');
    }

    const scratch = join(process.env.TEMP || tmpdir(), 'ftboard-tests');
    let shotBad = null;
    for (const s of SHOT_SCENARIOS) {
      const p = join(scratch, `shot_${s}.png`);
      if (!existsSync(p)) { shotBad = s + ' missing'; break; }
      const st = statSync(p);
      if (st.mtimeMs < runStart) { shotBad = s + ' stale'; break; }
      if (st.size < 10000) { shotBad = s + ' tiny'; break; }
    }
    report('full: screenshots fresh + non-trivial for all shot scenarios', shotBad === null, shotBad || '');

    const postStatus = git(['status', '--porcelain']) || 'POST-FAIL';
    report('full: repo tree untouched by the run', preStatus === postStatus);
  }
}

// ---------------------------------------------------------------- test 5
// checker-detects-failures
{
  const name = 'checker-detects-failures';
  if (skipSpawn) {
    skip(name, 'FTBOARD_SKIP_SPAWN=1');
  } else if (!existsSync(assertPath)) {
    report(name, false, 'tests/assert_results.ps1 missing');
  } else {
    const good = ps(['-File', assertPath, '-ResultsFile', selftestGood], { cwd: repoRoot });
    report('checker: operator-owned GOOD sample exits 0', good.status === 0,
      `exit=${good.status}; ${((good.stdout || '') + (good.stderr || '')).slice(-200).replace(/\s+/g, ' ')}`);
    const bad = ps(['-File', assertPath, '-ResultsFile', selftestBad], { cwd: repoRoot });
    report('checker: operator-owned BAD sample (2 defects) exits exactly 2', bad.status === 2,
      `exit=${bad.status}; ${((bad.stdout || '') + (bad.stderr || '')).slice(-200).replace(/\s+/g, ' ')}`);
  }
}

// ---------------------------------------------------------------- test 6
// docs-and-encoding
{
  const readme = readText(join(here, 'README.md'));
  report('docs: tests/README.md exists with substance', readme !== null && readme.length > 800);
  report('docs: README covers rebase rule + screenshot checklist',
    readme !== null && /rebase/i.test(readme) && /screenshot/i.test(readme));

  const claude = readText(join(repoRoot, 'CLAUDE.md')) || '';
  const handover = readText(join(repoRoot, 'HANDOVER.md')) || '';
  const repoTestsRef = /(?:^|[^A-Za-z0-9_-])tests[\\/]build_and_run\.ps1/;
  report('docs: CLAUDE.md points at tests\\build_and_run.ps1', repoTestsRef.test(claude));
  report('docs: HANDOVER.md points at tests\\build_and_run.ps1', repoTestsRef.test(handover));
  report('docs: CLAUDE.md no longer instructs the %TEMP% harness', !/%TEMP%\\ftboard-tests/.test(claude));
  report('docs: HANDOVER.md no longer claims %TEMP% is the location', !/%TEMP%\\ftboard-tests/.test(handover));
  report('docs: CLAUDE.md no longer references the PII capture', !new RegExp(PII_BASENAME, 'i').test(claude));

  for (const p of [harnessPath, assertPath]) {
    const label = basename(p);
    if (!existsSync(p)) { report(`docs: ${label} pure ASCII`, false, 'missing'); continue; }
    const bytes = readFileSync(p);
    let nonAscii = -1;
    for (let i = 0; i < bytes.length; i++) { if (bytes[i] > 127) { nonAscii = i; break; } }
    report(`docs: ${label} pure ASCII`, nonAscii === -1, `byte>127 at offset ${nonAscii}`);
  }
  if (skipSpawn) {
    skip('docs: both .ps1 parse under Windows PowerShell 5.1', 'FTBOARD_SKIP_SPAWN=1');
  } else {
    let parseBad = null;
    for (const p of [harnessPath, assertPath]) {
      if (!existsSync(p)) { parseBad = basename(p) + ' missing'; break; }
      const r = ps(['-Command',
        `$t=[IO.File]::ReadAllText('${p.replace(/'/g, "''")}'); $e=$null; [void][System.Management.Automation.PSParser]::Tokenize($t,[ref]$e); exit $e.Count`]);
      if (r.status !== 0) { parseBad = `${basename(p)}: ${r.status} parse error(s)`; break; }
    }
    report('docs: both .ps1 parse under Windows PowerShell 5.1', parseBad === null, parseBad || '');
  }
}

console.log(`\n${checks} checks, ${failures} failure(s)${skipSpawn ? ' [SPAWN TESTS SKIPPED - not a full pass]' : ''}`);
process.exit(Math.min(failures, 250));
