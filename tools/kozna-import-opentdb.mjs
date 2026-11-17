// Builds data/kozna/opentdb/<category>.json from Open Trivia DB (opentdb.com, CC BY-SA 4.0):
// user-contributed, moderator-verified multiple-choice questions in English, translated into
// Serbian and filtered for a Serbian audience.
//
//   node tools/kozna-import-opentdb.mjs [--write]
//
// Inputs (git-ignored, see data/README.md):
//   data/raw/kozna-src/opentdb/pre.json     the downloaded questions {i, cat, diff, q, c, x[3]}
//   data/raw/kozna-src/opentdb/tr-*.jsonl   one line per question, either
//       {i, cat, d, q, c, x:[two distractors]}   kept, translated
//       {i, drop: reason}                        too local, English-only, time-sensitive, wrong key…
//
// Without --write the script only reports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'data', 'raw', 'kozna-src', 'opentdb');
const outDir = path.join(root, 'data', 'kozna', 'opentdb');
const write = process.argv.includes('--write');

const CATS = ['jezik', 'knjizevnost', 'istorija', 'geografija', 'nauka', 'umetnost', 'muzika-film', 'priroda', 'opsta-kultura', 'sport'];
const MAX_QUESTION = 150;
const MAX_OPTION = 48;
/** Kept by the review but flagged as debatable, weak or duplicating another question; left out. */
const EXCLUDE = new Set([73, 74, 128, 220, 366, 382, 1032, 1078, 1088, 1127, 1294, 1363, 1540, 1555, 1582, 1614, 1709, 1724, 1985, 2030, 2143, 2809, 2877, 2968, 2973, 577, 696, 659,
  764, 936, 958, 966, 1743, 1786, 1860, 2235, 2310, 2395, 2418, 2451, 2522, 2553, 2699]);

/** Proofreading of the built questions: src -> false (leave out) or {q?, o?: [correct, wrong, wrong], d?, cat?}. */
const FIXES = JSON.parse(fs.readFileSync(path.join(root, 'data', 'kozna', 'fixes.json'), 'utf8'));

const clean = (s) => String(s).replace(/\s+/g, ' ').replace(/[«"“”]([^«»"“”„]+)[»"“”]/g, '„$1“').trim();
const norm = (s) => clean(s).toLowerCase().replace(/[„“.,:;!?]/g, '');
// Croatian or untranslated leftovers that must not reach the game
const SUSPECT = /\b(tko|tjedan|tisuć|točk|općen|također|siječanj|veljač|travanj|svibanj|lipanj|srpanj|kolovoz|rujan|listopad|studeni|prosinac|which|what|the following)\b/i;

const known = new Set(JSON.parse(fs.readFileSync(path.join(srcDir, 'pre.json'), 'utf8')).map((r) => r.i));
const lines = fs.readdirSync(srcDir).filter((f) => /^tr-\d+\.jsonl$/.test(f)).sort()
  .flatMap((f) => fs.readFileSync(path.join(srcDir, f), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)));

const out = Object.fromEntries(CATS.map((c) => [c, []]));
const skipped = {};
const skip = (why) => { skipped[why] = (skipped[why] || 0) + 1; };
const seenIds = new Set();
const seenQ = new Set();
for (const t of lines) {
  if (!known.has(t.i) || seenIds.has(t.i)) { skip('unknown or repeated id'); continue; }
  seenIds.add(t.i);
  if (t.drop) { skip('dropped in review'); continue; }
  if (EXCLUDE.has(t.i)) { skip('excluded'); continue; }
  if (!CATS.includes(t.cat) || ![1, 2, 3].includes(t.d) || !t.q || !t.c || !Array.isArray(t.x) || t.x.length !== 2) { skip('malformed'); continue; }
  const fix = FIXES['otdb:' + t.i];
  if (fix === false) { skip('dropped in proofreading'); continue; }
  const q = clean(fix?.q || t.q);
  const o = (fix?.o || [t.c, ...t.x]).map(clean);
  const cat = fix?.cat || t.cat;
  const d = fix?.d || t.d;
  if (new Set(o.map(norm)).size !== 3) { skip('duplicate options'); continue; }
  if (q.length > MAX_QUESTION || o.some((x) => !x || x.length > MAX_OPTION)) { skip('too long'); continue; }
  if (SUSPECT.test(q)) { skip('suspect wording'); continue; }
  if (seenQ.has(norm(q))) { skip('duplicate question'); continue; }
  seenQ.add(norm(q));
  out[cat].push({ q, o, a: 0, d, src: 'otdb:' + t.i });
}

let total = 0;
for (const cat of CATS) {
  const list = out[cat].sort((a, b) => Number(a.src.slice(5)) - Number(b.src.slice(5)));
  total += list.length;
  const byD = [1, 2, 3].map((d) => list.filter((q) => q.d === d).length);
  console.log(`${cat}: ${list.length} (easy/medium/hard ${byD.join('/')})`);
  if (write) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, cat + '.json'), JSON.stringify(list).replace(/},{/g, '},\n{') + '\n', 'utf8');
  }
}
console.log(`${total} questions kept of ${lines.length} reviewed (${known.size} candidates); skipped: ${JSON.stringify(skipped)}`);
if (!write) console.log('dry run, pass --write to save');
