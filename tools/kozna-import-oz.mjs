// Builds data/kozna/oz/<category>.json from the OZ Eval dataset (DjMel/oz-eval on Hugging Face,
// Apache-2.0): ~1,000 general-knowledge questions from the entrance exams of the Faculty of
// Philosophy and the Faculty of Organizational Sciences, University of Belgrade (2003–2024).
//
//   node tools/kozna-import-oz.mjs [--write]
//
// Inputs (git-ignored, see data/README.md):
//   data/raw/kozna-src/oz-eval/all.json       the dataset rows {index, questions, options[5], answer_index}
//   data/raw/kozna-src/oz-eval/class-*.jsonl  the review of each question: either
//       {i, cat, d, x:[two distractors], q?, c?}   keep (q / c only fix typos)
//       {i, drop: reason}                          time-sensitive, wrong key, jargon, too slow…
//
// The exam has five options, the game three: the review keeps the correct answer and the two most
// plausible wrong ones. Without --write the script only reports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'data', 'raw', 'kozna-src', 'oz-eval');
const outDir = path.join(root, 'data', 'kozna', 'oz');
const write = process.argv.includes('--write');

const CATS = ['jezik', 'knjizevnost', 'istorija', 'geografija', 'nauka', 'umetnost', 'muzika-film', 'priroda', 'opsta-kultura', 'sport'];
export const MAX_QUESTION = 150;
export const MAX_OPTION = 48;
/** Kept by the review but flagged as debatable; left out. */
const EXCLUDE = new Set([3, 13, 118, 122, 315, 321, 338, 742, 921, 970]);

/** Proofreading of the built questions: src -> false (leave out) or {q?, o?: [correct, wrong, wrong], d?, cat?}. */
const FIXES = JSON.parse(fs.readFileSync(path.join(root, 'data', 'kozna', 'fixes.json'), 'utf8'));

const clean = (s) => String(s).replace(/\s+/g, ' ').replace(/[«"“”]([^«»"“”„]+)[»"“”]/g, '„$1“').trim();
const norm = (s) => clean(s).toLowerCase().replace(/[„“.,:;!?]/g, '');

const rows = new Map(JSON.parse(fs.readFileSync(path.join(srcDir, 'all.json'), 'utf8')).map((r) => [r.index, r]));
const reviews = fs.readdirSync(srcDir).filter((f) => /^class-\d+\.jsonl$/.test(f)).sort()
  .flatMap((f) => fs.readFileSync(path.join(srcDir, f), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)));

const out = Object.fromEntries(CATS.map((c) => [c, []]));
const skipped = {};
const skip = (why) => { skipped[why] = (skipped[why] || 0) + 1; };
const seenIds = new Set();
const seenQ = new Set();
for (const rv of reviews) {
  const row = rows.get(rv.i);
  if (!row || seenIds.has(rv.i)) { skip('unknown or repeated id'); continue; }
  seenIds.add(rv.i);
  if (rv.drop) { skip('dropped in review'); continue; }
  if (EXCLUDE.has(rv.i)) { skip('excluded'); continue; }
  if (!CATS.includes(rv.cat) || ![1, 2, 3].includes(rv.d) || !Array.isArray(rv.x) || rv.x.length !== 2) { skip('malformed review'); continue; }
  const fix = FIXES['oz:' + rv.i];
  if (fix === false) { skip('dropped in proofreading'); continue; }
  const q = clean(fix?.q || rv.q || row.questions);
  const o = (fix?.o || [rv.c || row.options[row.answer_index], ...rv.x]).map(clean);
  const cat = fix?.cat || rv.cat;
  const d = fix?.d || rv.d;
  if (new Set(o.map(norm)).size !== 3) { skip('duplicate options'); continue; }
  if (q.length > MAX_QUESTION || o.some((x) => !x || x.length > MAX_OPTION)) { skip('too long'); continue; }
  if (seenQ.has(norm(q))) { skip('duplicate question'); continue; }
  seenQ.add(norm(q));
  out[cat].push({ q, o, a: 0, d, src: 'oz:' + rv.i });
}

let total = 0;
for (const cat of CATS) {
  const list = out[cat].sort((a, b) => Number(a.src.slice(3)) - Number(b.src.slice(3)));
  total += list.length;
  const byD = [1, 2, 3].map((d) => list.filter((q) => q.d === d).length);
  console.log(`${cat}: ${list.length} (easy/medium/hard ${byD.join('/')})`);
  if (write) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, cat + '.json'), JSON.stringify(list).replace(/},{/g, '},\n{') + '\n', 'utf8');
  }
}
console.log(`${total} questions kept of ${reviews.length} reviewed (${rows.size} in the dataset); skipped: ${JSON.stringify(skipped)}`);
if (!write) console.log('dry run, pass --write to save');
