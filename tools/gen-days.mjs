// Generates (or updates) per-day puzzle files in src/puzzles/days/NNN.json.
//
//   node tools/gen-days.mjs <fromDay> [toDay] [--force]
//
// Only the games that have a generator are written; other sections of an
// existing day file are preserved, and the app fills anything missing from the
// sample puzzle. Re-running is idempotent (same day → same puzzle) unless the
// generator changes; pass --force to overwrite sections that already exist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSlagalica, groupByLength } from './slagalica-gen.mjs';
import { generateMojBroj } from './mojbroj-gen.mjs';
import { generateSkocko } from './skocko-gen.mjs';
import { loadBank, validateBank, generateKoZnaZna, repeatHorizon } from './kozna-gen.mjs';
import { loadBank as loadAsocBank, validateBank as validateAsocBank, makeDealer as makeAsocDealer, repeatHorizon as asocHorizon } from './asocijacije-gen.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const force = process.argv.includes('--force');
const from = parseInt(args[0], 10);
const to = args[1] != null ? parseInt(args[1], 10) : from;
if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) {
  console.error('usage: node tools/gen-days.mjs <fromDay> [toDay] [--force]');
  process.exit(1);
}

const readList = (f) => fs.readFileSync(path.join(root, 'data', 'dict', f), 'utf8').split('\n').filter(Boolean);
const dict = readList('core.txt');
const extended = readList('extended.txt');
const freq = JSON.parse(fs.readFileSync(path.join(root, 'data', 'dict', 'letter-freq.json'), 'utf8'));
const byLen = groupByLength(dict);
const outDir = path.join(root, 'src', 'puzzles', 'days');
fs.mkdirSync(outDir, { recursive: true });

const bank = loadBank();
const bankErrors = validateBank(bank);
if (bankErrors.length) {
  console.error('Ko zna zna bank has problems:\n  ' + bankErrors.join('\n  '));
  process.exit(1);
}
const horizon = repeatHorizon(bank);
if (to >= horizon) console.warn(`note: Ko zna zna questions start repeating after day ${horizon - 1} (smallest category has ${horizon} questions)`);

const asocBank = loadAsocBank();
const asocErrors = validateAsocBank(asocBank);
if (asocErrors.length) {
  console.error('Asocijacije bank has problems:\n  ' + asocErrors.join('\n  '));
  process.exit(1);
}
const asocDealer = makeAsocDealer(asocBank);
const asocDays = asocHorizon(asocBank);
if (to >= asocDays) console.warn(`note: Asocijacije puzzles start repeating after day ${asocDays - 1} (bank has ${asocDays} puzzles)`);

const pad3 = (n) => String(n).padStart(3, '0');
let bytes = 0;
for (let day = from; day <= to; day++) {
  const file = path.join(outDir, pad3(day) + '.json');
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const out = { day, ...existing };
  if (force || !out.slagalica) {
    const g = generateSlagalica(day, dict, freq, { byLen, extended });
    out.slagalica = { letters: g.letters, words: g.words, best: g.best };
    console.log(`#${pad3(day)} ${g.letters.join('')}  best=${g.best} (${g.best.length})  words=${g.words.length}`);
  }
  if (force || !out.mojBroj) {
    const m = generateMojBroj(day);
    out.mojBroj = m;
    console.log(`#${pad3(day)} moj broj: [${m.numbers.join(' ')}] → ${m.target}  (${m.solution})`);
  }
  if (force || !out.skocko) {
    out.skocko = generateSkocko(day);
    console.log(`#${pad3(day)} skočko: ${out.skocko.secret.join(' ')}`);
  }
  if (force || !out.koZnaZna) {
    out.koZnaZna = generateKoZnaZna(day, bank);
    console.log(`#${pad3(day)} ko zna zna: ${out.koZnaZna.map((q) => 'ABC'[q.a]).join('')}  "${out.koZnaZna[0].q}"`);
  }
  if (force || !out.asocijacije) {
    const a = asocDealer.deal(day);
    out.asocijacije = { cols: a.cols, final: a.final };
    console.log(`#${pad3(day)} asocijacije: ${a.cols.map((c) => c.s).join(' / ')} → ${a.final.s}`);
  }
  const json = JSON.stringify(out);
  bytes += json.length;
  fs.writeFileSync(file, json + '\n', 'utf8');
}
console.log(`wrote ${to - from + 1} day file(s), ${(bytes / 1024).toFixed(0)} KB total`);
