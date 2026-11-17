// Turns the fetched Wikidata facts into quiz questions: data/kozna/generated/<category>.json.
//
//   node tools/wikidata-questions.mjs
//
// Every question carries `src` (the Wikidata item), so an answer can be audited, and `d`
// (1 easy – 3 hard) derived from the item's sitelink count within its fact type: the
// most-linked third is easy, the least-linked third is hard. Distractors are other
// answers of the same fact type, chosen deterministically per item; where the answers are
// people, they are well-known people of the same kind (domestic or foreign).
//
// Templates are mechanical (random wrong options, obscure subjects, people who are not what the
// template assumes), so only proofread questions are written: data/kozna/wikidata-review.json maps a
// generated question text to true (fine as it is), false (leave it out) or {q?, o?, d?} (replacement
// text, options with the correct one first, difficulty). --all also writes the questions nobody has
// read yet, to see what the dealer would pick from them and review those next; never ship that.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng } from './slagalica-gen.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inDir = path.join(root, 'data', 'kozna', 'wikidata');
const outDir = path.join(root, 'data', 'kozna', 'generated');
const reviewFile = path.join(root, 'data', 'kozna', 'wikidata-review.json');

const load = (name) => {
  const f = path.join(inDir, name + '.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
};
const loadAll = (prefix) => fs.readdirSync(inDir).filter((f) => f.startsWith(prefix)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8')));
const seedOf = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const normKey = (s) => clean(s).toLowerCase();
const lcFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
// Serbian Latin uses ASCII letters plus č ć š ž đ; anything else (q, w, x, y, ë, ł, ñ …) means the
// label came through in a foreign spelling (Croatian/Bosnian label of an untranscribed name) and
// would look wrong in a Serbian quiz.
const SERBIAN_RE = /^[A-Za-zČĆŠŽĐčćšžđ0-9 .,'’"„“\-–:;!?/&+%()]*$/;
const serbian = (s) => SERBIAN_RE.test(s) && !/[qwxyQWXY]/.test(s);
// labels that came from the Croatian or Bosnian Wikipedia
const CROATIAN = /zaljev|rijek|sjever|otok|otočj|djed|gospa|općin|županij|kolodvor|vlak|povijes|tisuć|kazališ|glazb|sveučiliš|\bsv\. /i;
const looksBad = (label) => !label || /^Q\d+$/.test(label) || label.length > 60 || /[{}\[\]]/.test(label) || !serbian(label) || CROATIAN.test(label);
// A name left in its original spelling (Ken Follett, Bill Condon): letter groups Serbian does not have.
const FOREIGN = /ll|tt|ss|nn|ff|pp|th|ph|sh|ch|gh|ee|oo|ck(?!i)/i;
const FOREIGN_TITLE = /\b(the|of|and|an|le|der|die|das|del|della|von|saint)\b/i;
const foreignName = (s) => FOREIGN.test(s);
const foreignTitle = (s) => FOREIGN.test(s) || FOREIGN_TITLE.test(s);
/** Serbian (or regional) surname: domestic people get domestic distractors. */
const domestic = (s) => /ić\b/.test(s);

/** "Mona Liza (slika)" → "Mona Liza": Wikipedia-style disambiguation is not part of the name. */
const bare = (label) => clean(label.replace(/\s*\([^)]*\)\s*$/, ''));
/** Everyday names of countries instead of the formal ones. */
const ALIAS = { 'Kraljevina Holandija': 'Holandija', 'Kraljevina Danska': 'Danska', 'Republika Irska': 'Irska', 'Država Palestina': 'Palestina', 'Narodna Republika Kina': 'Kina', 'Sjedinjene Američke Države': 'SAD' };
const label = (s) => { const b = bare(String(s)); return ALIAS[b] || b; };

/** Group rows by item; keep only items with exactly one distinct answer (avoids ambiguous facts). */
function uniqueByItem(rows, ansKey = 'ansLabel') {
  const by = new Map();
  for (const r of rows) {
    if (looksBad(r.itemLabel) || !bare(r.itemLabel) || r[ansKey] == null || looksBad(String(r[ansKey]))) continue;
    const g = by.get(r.item) || { ...r, itemLabel: label(r.itemLabel), answers: new Set() };
    g.answers.add(ansKey === 'ansLabel' ? label(r[ansKey]) : String(r[ansKey]));
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

/** Year distractors: plausible nearby years, never the correct one and never in the future. */
function yearDistractors(year, seed) {
  const r = rng(seed);
  const set = new Set([year]);
  const out = [];
  let guard = 0;
  while (out.length < 2 && guard++ < 50) {
    const span = 3 + Math.floor(r() * 25);
    const y = year + (r() < 0.5 ? -span : span);
    if (!set.has(y) && y <= 2010) { set.add(y); out.push(String(y)); }
  }
  return out;
}

const Q = {};
const add = (cat, q) => { (Q[cat] ||= []).push(q); };

/** country label → continent label (for region-aware distractors), when the fact file exists. */
const CONTINENT = new Map();
for (const r of load('country_continent')) if (!looksBad(r.itemLabel) && !looksBad(r.ansLabel) && !CONTINENT.has(label(r.itemLabel))) CONTINENT.set(label(r.itemLabel), r.ansLabel);

/** The answer gives itself away when it is part of the question's subject (Meksiko Siti → Meksiko). */
const stems = (t) => normKey(t).split(/[^a-zčćšžđ]+/).filter((w) => w.length >= 5).map((w) => w.slice(0, 5));
const giveaway = (subject, answer) => {
  const a = normKey(answer), s = normKey(subject);
  if (a.length >= 4 && (s.includes(a) || a.includes(s))) return true;
  // Libija → libijski dinar, Manojlo Komnin → dinastija Komnina: a shared word stem is just as telling
  const sub = new Set(stems(subject));
  return stems(answer).some((w) => sub.has(w));
};

/**
 * One question per item of a fact file. Options:
 *   bump            added to the difficulty
 *   top             keep only this most-linked fraction of the items (the well-known ones)
 *   people          answers are people: untranscribed names are left out, distractors are well-known
 *                   people of the same kind (domestic / foreign)
 *   title           the item is a work: untranslated titles are left out
 *   countries       answers are countries: distractors from the same continent
 *   byContinent     items are countries: distractors are answers of countries on the same continent
 *   minAnswers      keep only answers shared by at least this many items
 *   mapAnswer, keep row-level hooks
 */
function simple(name, cat, template, opts = {}) {
  let rows = [].concat(name).flatMap(load);
  if (opts.mapAnswer) rows = rows.map((r) => ({ ...r, ansLabel: r.ansLabel && opts.mapAnswer(r.ansLabel) }));
  if (opts.keep) rows = rows.filter(opts.keep);
  let items = uniqueByItem(rows).sort((a, b) => b.links - a.links);
  if (opts.people) items = items.filter((it) => !foreignName(it.answer));
  if (opts.title) items = items.filter((it) => !foreignTitle(it.itemLabel));
  if (opts.minAnswers) {
    const n = new Map();
    for (const it of items) n.set(it.answer, (n.get(it.answer) || 0) + 1);
    items = items.filter((it) => n.get(it.answer) >= opts.minAnswers);
  }
  if (opts.top) items = items.slice(0, Math.ceil(items.length * opts.top));
  items = withDifficulty(items, opts.bump || 0);
  name = [].concat(name)[0];
  const pool = [...new Set(items.map((it) => it.answer))]; // most-linked first
  const famous = pool.slice(0, Math.max(15, Math.ceil(pool.length / 3)));
  for (const it of items) {
    if (giveaway(it.itemLabel, it.answer)) continue;
    let near = null;
    if (opts.people) {
      near = famous.filter((a) => domestic(a) === domestic(it.answer));
      if (near.length < 4) near = pool.filter((a) => domestic(a) === domestic(it.answer));
    } else if (opts.byContinent && CONTINENT.has(it.itemLabel)) {
      const cont = CONTINENT.get(it.itemLabel);
      near = items.filter((o) => CONTINENT.get(o.itemLabel) === cont).map((o) => o.answer);
    } else if (opts.countries && CONTINENT.has(it.answer)) {
      // answers that are countries: prefer distractors from the same continent
      const cont = CONTINENT.get(it.answer);
      near = pool.filter((c) => CONTINENT.get(c) === cont);
    }
    const ds = distractors(it.answer, pool, seedOf(name + it.item), near);
    if (!ds) continue;
    add(cat, { q: template(it), o: [it.answer, ...ds], d: it.d, src: it.item });
  }
}

const female = (it) => it.sex === 'Q6581072';

// ---- Geografija ----
simple('capitals', 'geografija', (it) => `Glavni grad države ${it.itemLabel} je:`, { byContinent: true });
simple('city_country', 'geografija', (it) => `Grad ${it.itemLabel} nalazi se u državi:`, { bump: 1, countries: true, top: 0.4 });
simple('city_river', 'geografija', (it) => `Grad ${it.itemLabel} leži na reci:`, { bump: 1, top: 0.4 });
simple('river_mouth', 'geografija', (it) => `Reka ${it.itemLabel} uliva se u:`, { top: 0.7 });

// ---- Godine (dealer ih deli najviše jednom u tri dana) ----
{
  const battles = withDifficulty(uniqueByItem(load('battle_year'), 'ans'), 1);
  for (const it of battles.slice(0, Math.ceil(battles.length / 2))) {
    const y = Number(it.answer);
    if (!Number.isInteger(y) || !/^(bitka|opsada|boj) /i.test(it.itemLabel)) continue;
    add('istorija', { q: `Koje godine se odigrala ${lcFirst(it.itemLabel)}?`, o: [String(y), ...yearDistractors(y, seedOf('battle_year' + it.item))], d: it.d, src: it.item });
  }
  // birth years of the best-known people, routed by occupation
  const OCC = { Q36180: 'književnost', Q4964182: 'opšta kultura', Q1028181: 'umetnost', Q36834: 'umetnost', Q116: 'istorija', Q82955: 'istorija', Q169470: 'nauka', Q593644: 'nauka', Q170790: 'nauka', Q11063: 'nauka', Q2526255: 'muzika i film', Q33999: 'muzika i film', Q177220: 'muzika i film', Q937857: 'sport', Q3665646: 'sport', Q10833314: 'sport' };
  const people = withDifficulty(uniqueByItem(loadAll('person_birth'), 'ans'), 1);
  const seen = new Set();
  for (const it of people.slice(0, Math.ceil(people.length / 3))) {
    if (seen.has(it.item) || /,/.test(it.itemLabel)) continue;
    seen.add(it.item);
    const y = Number(it.answer);
    add(OCC[it.occ] || 'istorija', { q: `Koje godine je ${female(it) ? 'rođena' : 'rođen'} ${it.itemLabel}?`, o: [String(y), ...yearDistractors(y, seedOf('birth' + it.item))], d: it.d, src: it.item });
  }
}

// ---- Književnost ----
const WORKS = ['book_author', 'book_author_sr', 'novel_author', 'story_author', 'poem_author'];
simple(WORKS, 'književnost', (it) => `Autor dela „${it.itemLabel}“ je:`, { people: true, title: true });
simple('play_author', 'književnost', (it) => `Dramu „${it.itemLabel}“ napisao je:`, { people: true, title: true, top: 0.7 });
{
  // the reverse direction: one question per author, about a work other than the best-known one
  const works = uniqueByItem([...WORKS, 'play_author'].flatMap(load)).filter((w) => !foreignTitle(w.itemLabel) && !foreignName(w.answer)).sort((a, b) => b.links - a.links);
  const byAuthor = new Map();
  for (const w of works) (byAuthor.get(w.ans) || byAuthor.set(w.ans, []).get(w.ans)).push(w);
  const titles = works.slice(0, Math.ceil(works.length / 2));
  for (const [author, list] of byAuthor) {
    if (list.length < 2) continue;
    const w = list[1];
    const own = new Set(list.map((x) => normKey(x.itemLabel)));
    const pool = titles.filter((t) => !own.has(normKey(t.itemLabel)) && domestic(t.answer) === domestic(w.answer)).map((t) => t.itemLabel);
    const ds = distractors(w.itemLabel, [...new Set(pool)], seedOf('aw' + author));
    if (ds) add('književnost', { q: `${w.answer} je autor dela:`, o: [w.itemLabel, ...ds], d: w.links > 60 ? 2 : 3, src: w.item });
  }
}

// ---- Umetnost ----
simple(['painting_creator', 'srwiki_painting'], 'umetnost', (it) => `Autor slike „${it.itemLabel}“ je:`, { people: true, title: true, top: 0.7 });
simple('sculpture_creator', 'umetnost', (it) => `Autor skulpture „${it.itemLabel}“ je:`, { people: true, title: true, top: 0.7 });
simple('building_architect', 'umetnost', (it) => `Arhitekta građevine ${it.itemLabel} je:`, { bump: 1, people: true, top: 0.7 });
{
  const MOVEMENT = { renesansa: 'renesansa', 'rana renesansa': 'renesansa', 'visoka renesansa': 'renesansa', 'nemačka renesansa': 'renesansa', barok: 'barok', rokoko: 'rokoko', klasicizam: 'klasicizam', neoklasicizam: 'klasicizam', romantizam: 'romantizam', realizam: 'realizam', impresionizam: 'impresionizam', postimpresionizam: 'postimpresionizam', ekspresionizam: 'ekspresionizam', kubizam: 'kubizam', nadrealizam: 'nadrealizam', simbolizam: 'simbolizam', dadaizam: 'dadaizam', fovizam: 'fovizam', manirizam: 'manirizam', 'pop art': 'pop-art', 'pop-art': 'pop-art', secesija: 'secesija', futurizam: 'futurizam' };
  simple('artist_movement', 'umetnost', (it) => `Kom umetničkom pravcu pripada ${it.itemLabel}?`, { mapAnswer: (a) => MOVEMENT[normKey(a)] || null });
}
simple('opera_composer', 'umetnost', (it) => `Kompozitor dela „${it.itemLabel}“ je:`, { people: true, title: true });

// ---- Muzika i film ----
simple(['film_director', 'srwiki_film_director'], 'muzika i film', (it) => `Reditelj filma „${it.itemLabel}“ je:`, { people: true, title: true });

// ---- Istorija ----
simple(['monarch_dynasty', 'srwiki_monarch_dynasty'], 'istorija', (it) => `Kojoj dinastiji pripada ${it.itemLabel}?`,
  { keep: (r) => !/,/.test(r.itemLabel || ''), mapAnswer: (a) => (foreignName(a) ? null : a.replace(/^(dinastija|kuća|dom) /i, '')), minAnswers: 4, top: 0.7 });

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
  // "discovered or invented by" is clean only for chemical elements
  const elementNames = new Set(names.map(normKey));
  simple('discoverer', 'nauka', (it) => `Ko je otkrio hemijski element ${it.itemLabel}?`, { keep: (r) => elementNames.has(normKey(r.itemLabel || '')), people: true, bump: 1 });
}

// ---- Opšta kultura ----
simple('currency', 'opšta kultura', (it) => `Valuta države ${it.itemLabel} je:`, { top: 0.7 });
simple('official_language', 'opšta kultura', (it) => `Službeni jezik države ${it.itemLabel} je:`, { mapAnswer: (a) => a.replace(/ jezik$/, ''), top: 0.7 });
simple('company_founder', 'opšta kultura', (it) => `Osnivač kompanije ${it.itemLabel} je:`, { people: true, keep: (r) => !foreignName(r.itemLabel || '') });
simple('nobel_field', 'opšta kultura', (it) => `${it.itemLabel} – Nobelova nagrada za:`,
  { mapAnswer: (a) => a.replace(/^Nobelova nagrada za /i, '').replace(/^Nagrada Švedske narodne banke.*$/i, 'ekonomiju'), top: 0.5 });

// ---- Priroda ----
simple('mountain_country', 'priroda', (it) => `${/^planin/i.test(it.itemLabel) ? it.itemLabel : 'Planina ' + it.itemLabel} nalazi se u državi:`, { countries: true, top: 0.6 });
simple('lake_country', 'priroda', (it) => `${/jezero/i.test(it.itemLabel) ? it.itemLabel : 'Jezero ' + it.itemLabel} nalazi se u državi:`, { countries: true, top: 0.6 });
simple('planet_moon', 'priroda', (it) => `Satelit ${it.itemLabel} kruži oko planete:`);

// ---- Sport ----
simple('club_city', 'sport', (it) => `Fudbalski klub ${it.itemLabel.replace(/^FK /, '')} ima sedište u gradu:`, { keep: (r) => !/opština|okrug|distrikt/i.test(r.ansLabel || ''), top: 0.6 });
{
  const rows = loadAll('athlete_country').filter((r) => !looksBad(r.itemLabel) && !/,/.test(r.itemLabel) && !looksBad(r.ansLabel) && !looksBad(r.sportLabel));
  const byItem = new Map();
  for (const r of rows) { const g = byItem.get(r.item) || { ...r, itemLabel: label(r.itemLabel), countries: new Set(), sports: new Set() }; g.countries.add(label(r.ansLabel)); g.sports.add(r.sportLabel); byItem.set(r.item, g); }
  const items = withDifficulty([...byItem.values()].filter((g) => g.countries.size === 1 && g.sports.size === 1).map((g) => ({ ...g, answer: [...g.countries][0], sport: [...g.sports][0] })));
  const countries = [...new Set(items.map((i) => i.answer))];
  const sports = [...new Set(items.map((i) => i.sport))];
  // people famous for something other than sport (a scientist who ran marathons) must not be "athletes"
  const nonAthletes = new Set(fs.readdirSync(inDir).filter((f) => f.startsWith('person_birth') && !f.includes('sport'))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8'))).map((r) => r.item));
  for (const it of items) {
    if (nonAthletes.has(it.item) || giveaway(it.itemLabel, it.answer)) continue;
    const football = it.sport === 'fudbal';
    // British footballers play for England, Scotland or Wales, which the citizenship does not tell
    if (!(football && it.answer === 'Ujedinjeno Kraljevstvo')) {
      const near = items.filter((o) => o.sport === it.sport).map((o) => o.answer);
      const dc = distractors(it.answer, countries, seedOf('ac' + it.item), near);
      if (dc) add('sport', { q: `Iz koje je države ${it.itemLabel} (${it.sport})?`, o: [it.answer, ...dc], d: it.d, src: it.item });
    }
    // "which sport" is a giveaway for footballers
    const dsp = football ? null : distractors(it.sport, sports, seedOf('as' + it.item));
    if (dsp) add('sport', { q: `Sport po kome je ${female(it) ? 'poznata' : 'poznat'} ${it.itemLabel} je:`, o: [it.sport, ...dsp], d: it.d, src: it.item });
  }
}
{
  const games = uniqueByItem(load('olympics_city')).filter((g) => !/stadion/i.test(g.answer));
  const cities = [...new Set(games.map((g) => g.answer))];
  for (const g of games) {
    const y = Number(g.year);
    const d = y >= 1980 ? 1 : y >= 1948 ? 2 : 3;
    const dc = distractors(g.answer, cities, seedOf('oc' + g.item));
    if (dc) add('sport', { q: `Letnje olimpijske igre ${y}. održane su u gradu:`, o: [g.answer, ...dc], d, src: g.item });
    add('sport', { q: `Koje godine su održane Letnje olimpijske igre u gradu ${g.answer}?`, o: [String(y), ...yearDistractors(y, seedOf('oy' + g.item)).map((s) => String(Number(s) - (Number(s) % 4)))].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3), d: Math.min(3, d + 1), src: g.item });
  }
  const TEAM = { Italije: 'Italija', Brazila: 'Brazil', Nemačke: 'Nemačka', 'Zapadne Nemačke': 'Zapadna Nemačka', Urugvaja: 'Urugvaj', Argentine: 'Argentina', Engleske: 'Engleska', Francuske: 'Francuska', Španije: 'Španija' };
  const cups = uniqueByItem(load('worldcup_winner')).map((c) => ({ ...c, answer: TEAM[c.answer.replace(/^Fudbalska reprezentacija /, '')] })).filter((c) => c.answer);
  const winners = [...new Set(cups.map((c) => c.answer))];
  for (const c of cups) {
    const y = Number(c.year);
    const dw = distractors(c.answer, winners, seedOf('wc' + c.item));
    if (dw) add('sport', { q: `Ko je osvojio Svetsko prvenstvo u fudbalu ${y}?`, o: [c.answer, ...dw], d: y >= 1990 ? 1 : y >= 1958 ? 2 : 3, src: c.item });
  }
}

// ---- write ----
const review = fs.existsSync(reviewFile) ? JSON.parse(fs.readFileSync(reviewFile, 'utf8')) : {};
const used = new Set();
const ALL = process.argv.includes('--all');
fs.mkdirSync(outDir, { recursive: true });
const FILE = { jezik: 'jezik', geografija: 'geografija', istorija: 'istorija', književnost: 'knjizevnost', umetnost: 'umetnost', 'muzika i film': 'muzika-film', nauka: 'nauka', 'opšta kultura': 'opsta-kultura', priroda: 'priroda', sport: 'sport' };
for (const cat of Object.keys(FILE)) {
  const list = Q[cat] || [];
  // de-duplicate by question text and by options with the same set of three
  const seen = new Set();
  const out = [];
  let dropped = 0, unreviewed = 0;
  for (const g of list) {
    let q = { ...g, q: clean(g.q), o: g.o.map(clean) };
    if (Object.hasOwn(review, q.q)) {
      const fix = review[q.q];
      used.add(q.q);
      if (!fix) { dropped++; continue; }
      if (fix !== true) q = { ...q, q: fix.q || q.q, o: fix.o || q.o, d: fix.d || q.d };
    } else if (!ALL) { unreviewed++; continue; }
    if (q.o.length !== 3 || new Set(q.o.map(normKey)).size !== 3) continue;
    const key = normKey(q.q);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ q: q.q, o: q.o, a: 0, d: q.d, src: q.src });
  }
  fs.writeFileSync(path.join(outDir, FILE[cat] + '.json'), out.length ? JSON.stringify(out, null, 0).replace(/},{/g, '},\n{') + '\n' : '[]\n', 'utf8');
  const byD = [1, 2, 3].map((d) => out.filter((q) => q.d === d).length);
  console.log(`${cat}: ${out.length} questions (easy/medium/hard ${byD.join('/')}), ${dropped} left out by review, ${unreviewed} not reviewed yet`);
}
const stale = Object.keys(review).filter((k) => !used.has(k));
if (stale.length) console.log(`${stale.length} review entries match no generated question`);
