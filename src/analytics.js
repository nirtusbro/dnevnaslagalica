// Cookieless analytics via Umami (script tag in index.html). No identifier is stored or
// sent: retention is derived from the play history the game already keeps on the device,
// and only aggregate numbers (streak, days played…) are attached to events.
import { currentStreak } from './engine/stats.js';

export function track(name, data) {
  try { if (typeof window !== 'undefined' && window.umami) window.umami.track(name, data); } catch (e) { /* ignore */ }
}

/** Props for `day_completed`, computed from the (already updated) history. */
export function dayProps(history, day, total) {
  const days = Object.keys(history).map(Number);
  const first = Math.min(...days);
  const played = days.length;
  return {
    total,
    streak: currentStreak(history, day),
    daysPlayed: played,
    daysSinceFirst: day - first,           // 0 = first-ever day
    returning: played > 1 ? 'yes' : 'no',
  };
}
