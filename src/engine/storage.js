// Persistence: today's progress (so a refresh does not lose the day) and the play
// history that feeds streaks, stats and the archive. localStorage only; every call
// is guarded so private mode or a full quota never breaks the game.

const PROGRESS_KEY = 'dnevna-slagalica:progress:v1';
const HISTORY_KEY = 'dnevna-slagalica:history:v1';

export function makeStorage(store = typeof localStorage !== 'undefined' ? localStorage : null) {
  const read = (k) => {
    try { return JSON.parse(store.getItem(k) || 'null'); } catch (e) { return null; }
  };
  const write = (k, v) => {
    try { store.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
  };
  const remove = (k) => { try { store.removeItem(k); } catch (e) { /* ignore */ } };

  return {
    /** Progress for `day`, or null if none / another day. */
    loadProgress(day) {
      const p = read(PROGRESS_KEY);
      return p && p.day === day ? p : null;
    },
    saveProgress(p) { write(PROGRESS_KEY, p); },
    clearProgress() { remove(PROGRESS_KEY); },

    /** {[day]: {scores, total, maxes, finishedAt}} */
    loadHistory() { return read(HISTORY_KEY) || {}; },
    recordDay(day, scores, total, maxes) {
      const h = read(HISTORY_KEY) || {};
      h[day] = { scores, total, maxes, finishedAt: Date.now() };
      write(HISTORY_KEY, h);
      return h;
    },
    clearAll() { remove(PROGRESS_KEY); remove(HISTORY_KEY); },
  };
}

/** In-memory stand-in for tests and server-side rendering. */
export function memoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
