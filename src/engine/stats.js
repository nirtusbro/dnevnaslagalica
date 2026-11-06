// Statistics derived from the play history: {[day]: {scores, total, maxes?}}.
// `maxes` is the per-game maximum of that day (Slagalica's varies); older entries without it
// fall back to the fixed maxima.
import { GAMES, MAX_TOTAL, grade } from './rules.js';

const maxOf = (entry, i) => (entry.maxes && entry.maxes[i]) || GAMES[i].max;
const maxTotalOf = (entry) => GAMES.reduce((a, g, i) => a + maxOf(entry, i), 0);

/** Consecutive played days ending today (or yesterday if today is not finished yet). */
export function currentStreak(history, today) {
  let n = 0;
  let d = history[today] ? today : today - 1;
  while (history[d]) { n++; d--; }
  return n;
}

export function bestStreak(history) {
  const days = Object.keys(history).map(Number).sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    run = prev != null && d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export const HIST_BUCKETS = [
  { label: '< 40', max: 40 },
  { label: '40–60', max: 60 },
  { label: '60–80', max: 80 },
  { label: '80–100', max: 100 },
  { label: '100+', max: Infinity },
];

export function bucketOf(total) {
  return HIST_BUCKETS.findIndex((b) => total < b.max);
}

export function summarize(history, today) {
  const entries = Object.values(history);
  const played = entries.length;
  const avg = played ? Math.round(entries.reduce((a, e) => a + e.total / maxTotalOf(e), 0) / played * 100) : 0;
  const hist = HIST_BUCKETS.map(() => 0);
  for (const e of entries) hist[bucketOf(e.total)]++;
  const perGame = GAMES.map((g, i) => {
    const vals = entries.filter((e) => e.scores[i] != null).map((e) => Math.max(0, e.scores[i]) / maxOf(e, i));
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, x) => a + x, 0) / vals.length * 100);
  });
  return {
    played,
    streak: currentStreak(history, today),
    best: bestStreak(history),
    avg,
    hist,
    perGame,
  };
}

/** Grade tiers for one history entry. */
export function gradesOf(entry) {
  return GAMES.map((g, i) => (entry ? grade(i, entry.scores[i], maxOf(entry, i)) : null));
}

/** Last `n` days ending today, each with 5 grade indices (null = not played). */
export function recentDays(history, today, n = 14) {
  return Array.from({ length: n }, (_, k) => {
    const day = today - (n - 1) + k;
    return { day, grades: gradesOf(history[day]) };
  });
}

/** Share card text. */
export function shareText(day, scores, total, streak, url, maxes = GAMES.map((g) => g.max)) {
  const sq = scores.map((x, i) => (x == null ? '⬜' : ['🟩', '🟨', '🟧', '🟥'][grade(i, x, maxes[i])])).join('');
  const dani = streak % 10 === 1 && streak % 100 !== 11 ? 'dan' : 'dana';
  return `Dnevna Slagalica #${String(day).padStart(3, '0')}\n\n${sq}\n${total} poena\n🔥 ${streak} ${dani}\n\n${url}`;
}

export { MAX_TOTAL };
