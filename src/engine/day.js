// Calendar helpers. Day numbering is shared by the puzzle feed, storage and share text.

/**
 * Release day: challenge #1 is played on this date, #2 the day after, and so on.
 * Puzzle files are numbered the same way (src/puzzles/days/001.json is launch day).
 * Before this date the app shows challenge #1, so pre-release testing sees the real first day.
 * Set this to the actual release date before shipping.
 */
export const LAUNCH_DATE = '2026-11-06';
export const LAUNCH = parseLocalDate(LAUNCH_DATE);

function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const DAYS = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
export const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];

/** Midnight (local) of the given date. */
export function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Challenge number for a date (today by default): 1 on launch day, never below 1. */
export function dayNumber(d = new Date()) {
  return Math.max(1, Math.round((startOfDay(d) - LAUNCH) / 864e5) + 1);
}

/** Calendar date of challenge number `n` (n = 1 is launch day). */
export function dateOfDay(n) {
  const d = new Date(LAUNCH);
  d.setDate(d.getDate() + (n - 1));
  return d;
}

export const pad2 = (n) => String(n).padStart(2, '0');
export const pad3 = (n) => String(n).padStart(3, '0');

/** "sreda, 4. novembar" */
export function longDate(d) {
  return `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

/** "4. nov" */
export function shortDate(d) {
  return `${d.getDate()}. ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** Seconds until next local midnight. */
export function secondsToMidnight(now = new Date()) {
  const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, Math.floor((mid - now) / 1000));
}

/** "hh:mm:ss" */
export function hms(seconds) {
  return `${pad2(Math.floor(seconds / 3600))}:${pad2(Math.floor(seconds / 60) % 60)}:${pad2(seconds % 60)}`;
}

/** Serbian plural for "dan": 1 dan, 2 dana, 11 dana, 21 dan */
export function dani(n) {
  return n % 10 === 1 && n % 100 !== 11 ? 'dan' : 'dana';
}
