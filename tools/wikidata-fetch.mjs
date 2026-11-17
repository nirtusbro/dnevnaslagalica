// Pulls structured facts from Wikidata into data/kozna/wikidata/<name>.json.
//
//   node tools/wikidata-fetch.mjs [name ...]     (no names = all queries)
//
// Each result row is reduced to plain values; labels are kept only when they come from a
// Serbian/Serbo-Croatian label (sr, sr-el, sh, hr, bs), never from the English fallback,
// and Cyrillic is transliterated to Latin. `links` (sitelink count) is the fame measure
// used later for difficulty.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toLatin } from './translit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'data', 'kozna', 'wikidata');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'DnevnaSlagalicaBot/0.1 (daily puzzle generator; contact via repository)';
const LANGS = 'sr,sr-el,sh,hr,bs,en';
const OK_LANGS = new Set(['sr', 'sr-el', 'sh', 'hr', 'bs']);
/** Only items with an article on the Serbian Wikipedia: known here, and selective enough to be fast. */
const SRWIKI = '?srwiki schema:about ?item; schema:isPartOf <https://sr.wikipedia.org/> .';
const LABEL = `SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }`;

export const QUERIES = {
  country_continent: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q6256; wdt:P30 ?ans; wikibase:sitelinks ?links .
    FILTER NOT EXISTS { ?item wdt:P576 ?d } ${LABEL} } LIMIT 400`,
  capitals: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q6256; wdt:P36 ?ans; wikibase:sitelinks ?links .
    FILTER NOT EXISTS { ?item wdt:P576 ?d } FILTER NOT EXISTS { ?item wdt:P31 wd:Q3024240 }
    ${LABEL} } ORDER BY DESC(?links) LIMIT 220`,
  city_country: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q515; wdt:P17 ?ans; wdt:P1082 ?pop; wikibase:sitelinks ?links .
    FILTER(?pop > 250000) FILTER NOT EXISTS { ?item wdt:P31 wd:Q6256 }
    ${LABEL} } ORDER BY DESC(?links) LIMIT 700`,
  city_river: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q515; wdt:P206 ?ans; wdt:P1082 ?pop; wikibase:sitelinks ?links .
    ?ans wdt:P31 wd:Q4022 . FILTER(?pop > 150000)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 500`,
  battle_year: `SELECT ?item ?itemLabel ?ans ?links WHERE {
    ?item wdt:P31 wd:Q178561; wdt:P585 ?t; wikibase:sitelinks ?links .
    BIND(YEAR(?t) AS ?ans) FILTER(?ans > 1000 && ?ans < 2000)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 500`,
  ...Object.fromEntries(Object.entries({
    writers: 'wd:Q36180 wd:Q4964182 wd:Q49757', artists: 'wd:Q1028181 wd:Q36834 wd:Q1281618', scientists: 'wd:Q169470 wd:Q593644 wd:Q170790 wd:Q11063',
    politics: 'wd:Q116 wd:Q82955 wd:Q30461', film: 'wd:Q2526255 wd:Q33999 wd:Q177220', sport: 'wd:Q937857 wd:Q3665646 wd:Q10833314 wd:Q10843402',
  }).map(([k, occs]) => ['person_birth_' + k, `SELECT ?item ?itemLabel ?ans ?sex ?occ ?links WHERE {
    VALUES ?occ { ${occs} }
    ?item wdt:P106 ?occ; wdt:P569 ?b; wdt:P21 ?sex; wikibase:sitelinks ?links .
    FILTER(?links > 120) BIND(YEAR(?b) AS ?ans) FILTER(?ans > 1400 && ?ans < 1990)
    ${LABEL} } LIMIT 300`])),
  // literary works are typed loosely on Wikidata (novel, literary work, written work, book…), so ask for
  // anything with an author and a form/genre-free type from this list
  book_author: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q7725634; wdt:P50 ?ans; wikibase:sitelinks ?links . FILTER(?links > 45)
    ${LABEL} } LIMIT 700`,
  book_author_sr: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P50 ?ans; wdt:P407 wd:Q9299; wikibase:sitelinks ?links . FILTER(?links > 1) ${SRWIKI}
    ${LABEL} } LIMIT 800`,
  novel_author: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q8261; wdt:P50 ?ans; wikibase:sitelinks ?links . FILTER(?links > 12) ${SRWIKI}
    ${LABEL} } LIMIT 3000`,
  story_author: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q47461344 wd:Q49084 wd:Q149537 wd:Q37484 wd:Q1279564 wd:Q571 wd:Q5185279 wd:Q482 wd:Q25379 wd:Q12106333 wd:Q386724 }
    ?item wdt:P31 ?type; wdt:P50 ?ans; wikibase:sitelinks ?links . FILTER(?links > 8) ${SRWIKI}
    ${LABEL} } LIMIT 3000`,
  play_author: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q25379 wd:Q80930 wd:Q40831 wd:Q116476516 }
    ?item wdt:P31 ?type; wdt:P50 ?ans; wikibase:sitelinks ?links . FILTER(?links > 15)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 500`,
  poem_author: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q5185279 wd:Q37484 wd:Q482 wd:Q12106333 }
    ?item wdt:P31 ?type; wdt:P50 ?ans; wikibase:sitelinks ?links . FILTER(?links > 12)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 500`,
  character_work: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q3658341 wd:Q15632617 wd:Q95074 }
    ?item wdt:P31 ?type; wdt:P1441 ?ans; wikibase:sitelinks ?links . FILTER(?links > 25)
    ?ans wdt:P50 ?author .
    ${LABEL} } ORDER BY DESC(?links) LIMIT 500`,
  painting_creator: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q3305213; wdt:P170 ?ans; wikibase:sitelinks ?links . FILTER(?links > 14)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 1500`,
  sculpture_creator: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q860861 wd:Q179700 }
    ?item wdt:P31 ?type; wdt:P170 ?ans; wikibase:sitelinks ?links . FILTER(?links > 14) ?ans wdt:P31 wd:Q5 .
    ${LABEL} } ORDER BY DESC(?links) LIMIT 400`,
  building_architect: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P84 ?ans; wikibase:sitelinks ?links . FILTER(?links > 45) ?ans wdt:P31 wd:Q5 .
    ${LABEL} } ORDER BY DESC(?links) LIMIT 600`,
  artist_movement: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?occ { wd:Q1028181 wd:Q1281618 }
    ?item wdt:P106 ?occ; wdt:P135 ?ans; wikibase:sitelinks ?links . FILTER(?links > 70)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 600`,
  museum_city: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q207694 wd:Q33506 wd:Q17431399 }
    ?item wdt:P31 ?type; wdt:P131 ?ans; wikibase:sitelinks ?links . FILTER(?links > 40)
    ${LABEL} } LIMIT 300`,
  opera_composer: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q1344 wd:Q2743 wd:Q41425 wd:Q9734 wd:Q1366112 wd:Q207628 wd:Q9748 }
    ?item wdt:P31 ?type; wdt:P86 ?ans; wikibase:sitelinks ?links . FILTER(?links > 12)
    ${LABEL} } LIMIT 500`,
  song_performer: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q7366 wd:Q134556 wd:Q482994 }
    ?item wdt:P31 ?type; wdt:P175 ?ans; wikibase:sitelinks ?links . FILTER(?links > 25) ${SRWIKI}
    ${LABEL} } LIMIT 2000`,
  srwiki_film_director: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q11424; wdt:P57 ?ans; wdt:P495 ?c; wikibase:sitelinks ?links . VALUES ?c { wd:Q36704 wd:Q403 wd:Q83286 wd:Q37024 } ${SRWIKI}
    FILTER(?links > 5) ${LABEL} } LIMIT 1500`,
  srwiki_painting: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q3305213; wdt:P170 ?ans; wikibase:sitelinks ?links . FILTER(?links > 4) ${SRWIKI}
    ${LABEL} } LIMIT 2000`,
  srwiki_monarch_dynasty: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q5; wdt:P53 ?ans; wdt:P27 ?c; wikibase:sitelinks ?links . VALUES ?c { wd:Q14773 wd:Q241748 wd:Q838261 wd:Q191077 wd:Q389004 wd:Q2252973 wd:Q12544 wd:Q12560 wd:Q12548 wd:Q34266 wd:Q28513 } FILTER(?links > 25) ${SRWIKI}
    ${LABEL} } LIMIT 1500`,
  composer_country: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P106 wd:Q36834; wdt:P27 ?ans; wdt:P569 ?b; wikibase:sitelinks ?links . FILTER(?links > 90) FILTER(YEAR(?b) < 1920)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 300`,
  monarch_dynasty: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?occ { wd:Q116 wd:Q12097 wd:Q39018 wd:Q2304859 }
    ?item wdt:P106 ?occ; wdt:P53 ?ans; wikibase:sitelinks ?links . FILTER(?links > 60)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 700`,
  battle_war: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q178561; wdt:P361 ?ans; wikibase:sitelinks ?links . FILTER(?links > 30) ?ans wdt:P31 wd:Q198 .
    ${LABEL} } LIMIT 600`,
  former_capital: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q3024240 wd:Q48349 wd:Q417175 wd:Q1250464 }
    ?item wdt:P31 ?type; wdt:P36 ?ans; wdt:P576 ?end; wikibase:sitelinks ?links . FILTER(?links > 55)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 400`,
  killer_victim: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P157 ?ans; wdt:P31 wd:Q5; wikibase:sitelinks ?links . FILTER(?links > 80) ?ans wdt:P31 wd:Q5 .
    ${LABEL} } ORDER BY DESC(?links) LIMIT 200`,
  language_family: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q34770; wdt:P279 ?ans; wikibase:sitelinks ?links . FILTER(?links > 120) ?ans wdt:P31 wd:Q25295 .
    ${LABEL} } ORDER BY DESC(?links) LIMIT 300`,
  language_script: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q34770; wdt:P282 ?ans; wikibase:sitelinks ?links . FILTER(?links > 120)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 300`,
  animal_class: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?ans { wd:Q7377 wd:Q5113 wd:Q10811 wd:Q10908 wd:Q1390 wd:Q1358 wd:Q25364 wd:Q127282 }
    ?item wdt:P105 wd:Q7432; wikibase:sitelinks ?links . FILTER(?links > 110) ?item wdt:P171+ ?ans .
    ${LABEL} } LIMIT 500`,
  river_mouth: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q4022; wdt:P403 ?ans; wikibase:sitelinks ?links . FILTER(?links > 75)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 400`,
  planet_moon: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P397 ?ans; wikibase:sitelinks ?links . FILTER(?links > 50) ?ans wdt:P31 wd:Q3504248 .
    ${LABEL} } LIMIT 100`,
  band_country: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q215380 wd:Q5741069 }
    ?item wdt:P31 ?type; wdt:P495 ?ans; wikibase:sitelinks ?links . FILTER(?links > 75)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 400`,
  club_city: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q476028; wdt:P159 ?ans; wikibase:sitelinks ?links . FILTER(?links > 70)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 400`,
  club_stadium: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q476028; wdt:P115 ?ans; wikibase:sitelinks ?links . FILTER(?links > 80)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 300`,
  nobel_field: `SELECT DISTINCT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?ans { wd:Q38104 wd:Q44585 wd:Q80061 wd:Q37922 wd:Q35637 wd:Q47170 }
    ?item wdt:P166 ?ans; wdt:P31 wd:Q5; wikibase:sitelinks ?links . FILTER(?links > 90)
    ${LABEL} } ORDER BY DESC(?links) LIMIT 600`,
  film_director: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q11424; wdt:P57 ?ans; wikibase:sitelinks ?links .
    FILTER(?links > 45) ${LABEL} } ORDER BY DESC(?links) LIMIT 900`,
  element_symbol: `SELECT ?item ?itemLabel ?ans ?links WHERE {
    ?item wdt:P31 wd:Q11344; wdt:P246 ?ans; wdt:P1086 ?z; wikibase:sitelinks ?links .
    FILTER(?z <= 103) ${LABEL} } ORDER BY ?z`,
  discoverer: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P61 ?ans; wikibase:sitelinks ?links . FILTER(?links > 90) ?ans wdt:P31 wd:Q5 .
    ${LABEL} } LIMIT 300`,
  currency: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q6256; wdt:P38 ?ans; wikibase:sitelinks ?links .
    FILTER NOT EXISTS { ?item wdt:P576 ?d } FILTER NOT EXISTS { ?ans wdt:P582 ?e }
    ${LABEL} } ORDER BY DESC(?links) LIMIT 300`,
  official_language: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q6256; wdt:P37 ?ans; wikibase:sitelinks ?links .
    FILTER NOT EXISTS { ?item wdt:P576 ?d } ${LABEL} } ORDER BY DESC(?links) LIMIT 400`,
  company_founder: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    VALUES ?type { wd:Q4830453 wd:Q891723 wd:Q783794 wd:Q6881511 wd:Q1589009 wd:Q1137109 }
    ?item wdt:P31 ?type; wdt:P112 ?ans; wikibase:sitelinks ?links . ?ans wdt:P31 wd:Q5 .
    FILTER(?links > 60) ${LABEL} } LIMIT 400`,
  ...Object.fromEntries(Object.entries({
    football: 'wd:Q2736', basketball: 'wd:Q5372', tennis: 'wd:Q847', water: 'wd:Q7707 wd:Q31920', team: 'wd:Q1734 wd:Q8418 wd:Q41466',
    individual: 'wd:Q542 wd:Q32112 wd:Q718 wd:Q43450 wd:Q1455 wd:Q1707432',
  }).map(([k, sports]) => ['athlete_country_' + k, `SELECT ?item ?itemLabel ?ans ?ansLabel ?sport ?sportLabel ?sex ?links WHERE {
    VALUES ?sport { ${sports} }
    ?item wdt:P641 ?sport; wikibase:sitelinks ?links . FILTER(?links > 75)
    ?item wdt:P27 ?ans; wdt:P21 ?sex .
    ${LABEL} } LIMIT 500`])),
  olympics_city: `SELECT ?item ?itemLabel ?ans ?ansLabel ?year ?links WHERE {
    ?item wdt:P31 wd:Q135976384; wdt:P276 ?ans; wdt:P580 ?t; wikibase:sitelinks ?links .
    BIND(YEAR(?t) AS ?year) FILTER(?year < 2030)
    ${LABEL} } ORDER BY ?year`,
  worldcup_winner: `SELECT ?item ?itemLabel ?ans ?ansLabel ?year ?links WHERE {
    ?item wdt:P3450 wd:Q19317; wdt:P1346 ?ans; wdt:P580 ?t; wikibase:sitelinks ?links .
    BIND(YEAR(?t) AS ?year) ${LABEL} } ORDER BY ?year`,
  mountain_country: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q8502; wdt:P17 ?ans; wdt:P2044 ?h; wikibase:sitelinks ?links .
    FILTER(?h > 2500) FILTER(?links > 30) ${LABEL} } ORDER BY DESC(?links) LIMIT 400`,
  lake_country: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q23397; wdt:P17 ?ans; wikibase:sitelinks ?links .
    FILTER(?links > 35) ${LABEL} } ORDER BY DESC(?links) LIMIT 300`,
  monarch_country: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q6256; wdt:P35 ?ans; wikibase:sitelinks ?links . ?item wdt:P122 ?form . ?form wdt:P279* wd:Q7269 .
    FILTER NOT EXISTS { ?item wdt:P576 ?d } ${LABEL} } ORDER BY DESC(?links) LIMIT 60`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, query) {
  const url = ENDPOINT + '?query=' + encodeURIComponent(query);
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res;
    // the endpoint sometimes never answers; give up on the attempt after 75 s
    try { res = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA }, signal: AbortSignal.timeout(75000) }); }
    catch { await sleep(5000 * attempt); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(5000 * attempt); continue; }
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
    // labels occasionally carry raw control characters (even line breaks), which JSON.parse rejects
    const json = parseLenient(await res.text());
    return json.results.bindings.map(simplify).filter(Boolean);
  }
  throw new Error(name + ': gave up after retries');
}

/**
 * JSON.parse that survives a label with a raw line break in it: the broken line and its
 * continuation are blanked (the row then has an empty label and is dropped later).
 */
function parseLenient(text) {
  const lines = text.replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').split('\n');
  for (let guard = 0; guard < 200; guard++) {
    try { return JSON.parse(lines.join('\n')); } catch (e) {
      const m = /line (\d+)/.exec(e.message);
      if (!m) throw e;
      const n = Number(m[1]) - 1;
      // a property that starts here lost its end; otherwise this is the tail of the previous one
      lines[n] = /^\s*"[\w:]+"\s*:/.test(lines[n]) ? '"broken" : "",' : '"value" : ""';
    }
  }
  throw new Error('response is not valid JSON');
}
const qid = (uri) => uri.replace(/^.*\/(Q\d+)$/, '$1');

/** Flatten one SPARQL row; drop rows whose labels are not Serbian/Serbo-Croatian. */
function simplify(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.endsWith('Label')) {
      if (!OK_LANGS.has(v['xml:lang'])) return null;
      out[k] = toLatin(v.value);
    } else if (v.type === 'uri') out[k] = qid(v.value);
    else if (v.datatype && v.datatype.endsWith('#integer')) out[k] = parseInt(v.value, 10);
    else out[k] = v.value;
  }
  return out;
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(QUERIES);
fs.mkdirSync(outDir, { recursive: true });
for (const name of names) {
  if (!QUERIES[name]) { console.error('unknown query', name); process.exit(1); }
  process.stdout.write(name + ' … ');
  try {
    const rows = await run(name, QUERIES[name]);
    fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(rows) + '\n', 'utf8');
    console.log(rows.length + ' rows');
  } catch (e) {
    console.log('FAILED: ' + e.message.slice(0, 200));
  }
  await sleep(1500);
}
