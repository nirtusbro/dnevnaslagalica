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
  book_author: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q8261; wikibase:sitelinks ?links . FILTER(?links > 40) ?item wdt:P50 ?ans .
    ${LABEL} } LIMIT 500`,
  play_author: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q25379; wikibase:sitelinks ?links . FILTER(?links > 30) ?item wdt:P50 ?ans .
    ${LABEL} } LIMIT 300`,
  poem_author: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q5185279; wikibase:sitelinks ?links . FILTER(?links > 20) ?item wdt:P50 ?ans .
    ${LABEL} } LIMIT 300`,
  painting_creator: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q3305213; wikibase:sitelinks ?links . FILTER(?links > 45) ?item wdt:P170 ?ans .
    ${LABEL} } LIMIT 400`,
  opera_composer: `SELECT ?item ?itemLabel ?ans ?ansLabel ?links WHERE {
    ?item wdt:P31 wd:Q1344; wdt:P86 ?ans; wikibase:sitelinks ?links .
    FILTER(?links > 15) ${LABEL} } ORDER BY DESC(?links) LIMIT 300`,
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
    const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } });
    if (res.status === 429 || res.status >= 500) { await sleep(5000 * attempt); continue; }
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
    const json = await res.json();
    return json.results.bindings.map(simplify).filter(Boolean);
  }
  throw new Error(name + ': gave up after retries');
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
