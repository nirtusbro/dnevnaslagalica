// Turns the fetched Wikidata facts into quiz questions: data/kozna/generated/<category>.json.
//
//   node tools/wikidata-questions.mjs
//
// Every question carries `src` (the Wikidata item), so an answer can be audited, and `d`
// (1 easy – 3 hard) derived from the item's sitelink count within its fact type: the
// most-linked third is easy, the least-linked third is hard. Distractors are other
// answers of the same fact type, chosen deterministically per item.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng } from './slagalica-gen.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inDir = path.join(root, 'data', 'kozna', 'wikidata');
const outDir = path.join(root, 'data', 'kozna', 'generated');

const load = (name) => {
  const f = path.join(inDir, name + '.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
};
const seedOf = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const normKey = (s) => clean(s).toLowerCase();
// Serbian Latin uses ASCII letters plus č ć š ž đ; anything else (q, w, x, y, ë, ł, ñ …) means the
// label came through in a foreign spelling (Croatian/Bosnian label of an untranscribed name) and
// would look wrong in a Serbian quiz.
const SERBIAN_RE = /^[A-Za-zČĆŠŽĐčćšžđ0-9 .,'’"„“\-–:;!?/&+%()]*$/;
const serbian = (s) => SERBIAN_RE.test(s) && !/[qwxyQWXY]/.test(s);
const looksBad = (label) => !label || /^Q\d+$/.test(label) || label.length > 60 || /[{}\[\]]/.test(label) || !serbian(label);

/** Group rows by item; keep only items with exactly one distinct answer (avoids ambiguous facts). */
function uniqueByItem(rows, ansKey = 'ansLabel') {
  const by = new Map();
  for (const r of rows) {
    if (looksBad(r.itemLabel) || r[ansKey] == null || looksBad(String(r[ansKey]))) continue;
    const g = by.get(r.item) || { ...r, answers: new Set() };
    g.answers.add(String(r[ansKey]));
    by.set(r.item, g);
  }
  return [...by.values()].filter((g) => g.answers.size === 1).map((g) => ({ ...g, answer: [...g.answers][0] }));
}

/** Difficulty by sitelink tertile within the pool. */
function withDifficulty(items, bump = 0) {
  const sorted = [...items].sort((a, b) => b.links - a.links);
  const n = sorted.length;
  return sorted.map((it, i) => ({ ...it, d: Math.min(3, (i < n / 3 ? 1 : i < (2 * n) / 3 ? 2 : 3) + bump) }));
}

/** Pick two distractors from the pool of answers, different from the correct one (by normalized text). */
function distractors(correct, pool, seed, near = null) {
  const r = rng(seed);
  const cand = pool.filter((a) => normKey(a) !== normKey(correct));
  const out = [];
  const uniq = new Set([normKey(correct)]);
  const source = near && near.length >= 2 ? near.filter((a) => !uniq.has(normKey(a))) : cand;
  let guard = 0;
  while (out.length < 2 && guard++ < 200 && (source.length || cand.length)) {
    const arr = out.length < source.length && source.length ? source : cand;
    const a = arr[Math.floor(r() * arr.length)];
    if (!uniq.has(normKey(a))) { uniq.add(normKey(a)); out.push(a); }
  }
  return out.length === 2 ? out : null;
}

/** Year distractors: plausible nearby years, never the correct one. */
function yearDistractors(year, seed) {
  const r = rng(seed);
  const set = new Set([year]);
  const out = [];
  let guard = 0;
  while (out.length < 2 && guard++ < 50) {
    const span = 3 + Math.floor(r() * 25);
    const y = year + (r() < 0.5 ? -span : span);
    if (!set.has(y)) { set.add(y); out.push(String(y)); }
  }
  return out;
}

const Q = {};
const add = (cat, q) => { (Q[cat] ||= []).push(q); };

/** country label → continent label (for region-aware distractors), when the fact file exists. */
const CONTINENT = new Map();
for (const r of load('country_continent')) if (!looksBad(r.itemLabel) && !looksBad(r.ansLabel) && !CONTINENT.has(r.itemLabel)) CONTINENT.set(r.itemLabel, r.ansLabel);

/** The answer gives itself away when it is part of the question's subject (Meksiko Siti → Meksiko). */
const giveaway = (subject, answer) => {
  const a = normKey(answer), s = normKey(subject);
  return a.length >= 4 && (s.includes(a) || a.includes(s));
};

function simple(name, cat, template, opts = {}) {
  const items = withDifficulty(uniqueByItem(load(name)), opts.bump || 0);
  const pool = [...new Set(items.map((it) => it.answer))];
  for (const it of items) {
    if (giveaway(it.itemLabel, it.answer)) continue;
    let near = opts.nearBy ? items.filter((o) => o[opts.nearBy] === it[opts.nearBy]).map((o) => o.answer) : null;
    // answers that are countries: prefer distractors from the same continent
    if (!near && opts.countries && CONTINENT.has(it.answer)) {
      const cont = CONTINENT.get(it.answer);
      near = pool.filter((c) => CONTINENT.get(c) === cont);
    }
    const ds = distractors(it.answer, pool, seedOf(name + it.item), near);
    if (!ds) continue;
    add(cat, { q: template(it), o: [it.answer, ...ds], d: it.d, src: it.item });
  }
}

function years(name, cat, template, opts = {}) {
  const items = withDifficulty(uniqueByItem(load(name), 'ans'), opts.bump || 0);
  for (const it of items) {
    const y = Number(it.answer);
    if (!Number.isInteger(y)) continue;
    add(cat, { q: template(it), o: [String(y), ...yearDistractors(y, seedOf(name + it.item))], d: it.d, src: it.item });
  }
}

const female = (it) => it.sex === 'Q6581072';

// ---- Geografija ----
simple('capitals', 'geografija', (it) => `Glavni grad države ${it.itemLabel} je:`);
simple('city_country', 'geografija', (it) => `Grad ${it.itemLabel} nalazi se u državi:`, { bump: 1, countries: true });
simple('city_river', 'geografija', (it) => `Grad ${it.itemLabel} leži na reci:`, { bump: 1 });
// ---- Istorija ----
years('battle_year', 'istorija', (it) => `Koje godine se odigrala bitka: ${it.itemLabel}?`, { bump: 1 });
simple('monarch_country', 'istorija', (it) => `Monarh države ${it.itemLabel} je:`);
{
  // birth years, routed by occupation
  const OCC = { Q36180: 'književnost', Q4964182: 'književnost', Q1028181: 'umetnost', Q36834: 'umetnost', Q116: 'istorija', Q82955: 'istorija', Q169470: 'nauka', Q593644: 'nauka', Q170790: 'nauka', Q11063: 'nauka', Q2526255: 'muzika i film', Q33999: 'muzika i film', Q177220: 'muzika i film', Q937857: 'sport', Q3665646: 'sport', Q10833314: 'sport' };
  const all = fs.readdirSync(inDir).filter((f) => f.startsWith('person_birth')).flatMap((f) => JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8')));
  const items = withDifficulty(uniqueByItem(all, 'ans'), 1);
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.item)) continue;
    seen.add(it.item);
    const cat = OCC[it.occ] || 'istorija';
    const y = Number(it.answer);
    add(cat, { q: `Koje godine je ${female(it) ? 'rođena' : 'rođen'} ${it.itemLabel}?`, o: [String(y), ...yearDistractors(y, seedOf('birth' + it.item))], d: it.d, src: it.item });
  }
}
// ---- Književnost / Umetnost / Film ----
simple('book_author', 'književnost', (it) => `Autor dela „${it.itemLabel}“ je:`);
simple('painting_creator', 'umetnost', (it) => `Autor slike „${it.itemLabel}“ je:`);
simple('opera_composer', 'umetnost', (it) => `Kompozitor opere „${it.itemLabel}“ je:`);
simple('film_director', 'muzika i film', (it) => `Reditelj filma „${it.itemLabel}“ je:`);
// ---- Nauka ----
{
  const els = uniqueByItem(load('element_symbol'), 'ans');
  const syms = els.map((e) => e.answer);
  const names = els.map((e) => e.itemLabel);
  els.forEach((e, i) => {
    const d = i < 20 ? 1 : i < 56 ? 2 : 3;
    const ds = distractors(e.answer, syms, seedOf('sym' + e.item));
    if (ds) add('nauka', { q: `Hemijski simbol elementa ${e.itemLabel} je:`, o: [e.answer, ...ds], d, src: e.item });
    const dn = distractors(e.itemLabel, names, seedOf('nam' + e.item));
    if (dn) add('nauka', { q: `Koji hemijski element ima simbol ${e.answer}?`, o: [e.itemLabel, ...dn], d, src: e.item });
  });
}
simple('discoverer', 'nauka', (it) => `Ko je otkrio ili izumeo: ${it.itemLabel}?`);
// ---- Opšta kultura ----
simple('currency', 'opšta kultura', (it) => `Valuta države ${it.itemLabel} je:`);
simple('official_language', 'opšta kultura', (it) => `Službeni jezik države ${it.itemLabel} je:`);
simple('company_founder', 'opšta kultura', (it) => `Osnivač kompanije ${it.itemLabel} je:`);
// ---- Priroda ----
simple('mountain_country', 'priroda', (it) => `Planina ${it.itemLabel} nalazi se u državi:`, { countries: true });
simple('lake_country', 'priroda', (it) => `Jezero ${it.itemLabel} nalazi se u državi:`, { countries: true });
// ---- Sport ----
{
  const rows = fs.readdirSync(inDir).filter((f) => f.startsWith('athlete_country')).flatMap((f) => JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8')))
    .filter((r) => !looksBad(r.itemLabel) && !looksBad(r.ansLabel) && !looksBad(r.sportLabel));
  const byItem = new Map();
  for (const r of rows) { const g = byItem.get(r.item) || { ...r, countries: new Set(), sports: new Set() }; g.countries.add(r.ansLabel); g.sports.add(r.sportLabel); byItem.set(r.item, g); }
  const items = withDifficulty([...byItem.values()].filter((g) => g.countries.size === 1 && g.sports.size === 1).map((g) => ({ ...g, answer: [...g.countries][0], sport: [...g.sports][0] })));
  const countries = [...new Set(items.map((i) => i.answer))];
  const sports = [...new Set(items.map((i) => i.sport))];
  // people famous for something other than sport (a scientist who ran marathons) must not be "athletes"
  const nonAthletes = new Set(fs.readdirSync(inDir).filter((f) => f.startsWith('person_birth') && !f.includes('sport'))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8'))).map((r) => r.item));
  for (const it of items) {
    if (nonAthletes.has(it.item) || giveaway(it.itemLabel, it.answer)) continue;
    const near = items.filter((o) => o.sport === it.sport).map((o) => o.answer);
    const dc = distractors(it.answer, countries, seedOf('ac' + it.item), near);
    if (dc) add('sport', { q: `Iz koje je države ${it.itemLabel} (${it.sport})?`, o: [it.answer, ...dc], d: it.d, src: it.item });
    const dsp = distractors(it.sport, sports, seedOf('as' + it.item));
    if (dsp) add('sport', { q: `U kom sportu se takmiči ${it.itemLabel}?`, o: [it.sport, ...dsp], d: Math.min(3, it.d + 1), src: it.item });
  }
}
{
  const games = uniqueByItem(load('olympics_city'));
  const cities = [...new Set(games.map((g) => g.answer))];
  for (const g of games) {
    const y = Number(g.year);
    const d = y >= 1980 ? 1 : y >= 1948 ? 2 : 3;
    const dc = distractors(g.answer, cities, seedOf('oc' + g.item));
    if (dc) add('sport', { q: `Letnje olimpijske igre ${y}. održane su u gradu:`, o: [g.answer, ...dc], d, src: g.item });
    add('sport', { q: `Koje godine su održane Letnje olimpijske igre u gradu ${g.answer}?`, o: [String(y), ...yearDistractors(y, seedOf('oy' + g.item)).map((s) => String(Number(s) - (Number(s) % 4)))].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3), d: Math.min(3, d + 1), src: g.item });
  }
  const cups = uniqueByItem(load('worldcup_winner'));
  const winners = [...new Set(cups.map((c) => c.answer))];
  for (const c of cups) {
    const y = Number(c.year);
    const dw = distractors(c.answer, winners, seedOf('wc' + c.item));
    if (dw) add('sport', { q: `Svetsko prvenstvo u fudbalu ${y}. osvojila je:`, o: [c.answer, ...dw], d: y >= 1990 ? 1 : y >= 1958 ? 2 : 3, src: c.item });
  }
}

// ---- write ----
fs.mkdirSync(outDir, { recursive: true });
const FILE = { geografija: 'geografija', istorija: 'istorija', književnost: 'knjizevnost', umetnost: 'umetnost', 'muzika i film': 'muzika-film', nauka: 'nauka', 'opšta kultura': 'opsta-kultura', priroda: 'priroda', sport: 'sport' };
for (const [cat, list] of Object.entries(Q)) {
  // de-duplicate by question text and by options with the same set of three
  const seen = new Set();
  const out = [];
  for (const q of list) {
    if (q.o.length !== 3 || new Set(q.o.map(normKey)).size !== 3) continue;
    const key = normKey(q.q);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ q: clean(q.q), o: q.o.map(clean), a: 0, d: q.d, src: q.src });
  }
  fs.writeFileSync(path.join(outDir, FILE[cat] + '.json'), JSON.stringify(out, null, 0).replace(/},{/g, '},\n{') + '\n', 'utf8');
  const byD = [1, 2, 3].map((d) => out.filter((q) => q.d === d).length);
  console.log(`${cat}: ${out.length} questions (easy/medium/hard ${byD.join('/')})`);
}
