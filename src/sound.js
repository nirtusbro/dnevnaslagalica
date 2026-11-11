// Quiet timer cues, synthesised with Web Audio (no audio files to load).
// Every call is guarded: a browser without audio, or one that blocks it, just stays silent.

let ctx = null;

function audio() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  } catch (e) { /* no audio */ }
  return ctx;
}

// Browsers (iOS in particular) only let audio start from inside a tap or key press,
// so the context is created and resumed on the player's first interactions.
function unlock() {
  const c = audio();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

/** One soft sine blip: quick fade in, longer fade out, so there is no click. */
function blip(c, freq, at, dur, peak) {
  const osc = c.createOscillator(), gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

const CUES = {
  // Half of the time is gone: a single low note.
  half: (c, t) => blip(c, 660, t, 0.22, 0.06),
  // Last seconds: two slightly higher notes.
  last: (c, t) => { blip(c, 880, t, 0.16, 0.07); blip(c, 880, t + 0.2, 0.2, 0.07); },
};

export function playCue(name) {
  try {
    const c = audio();
    if (!c || c.state !== 'running' || !CUES[name]) return;
    CUES[name](c, c.currentTime + 0.01);
  } catch (e) { /* stay silent */ }
}

/**
 * Which cue (if any) fires when the clock moves from `prev` to `t` seconds in a round of `tMax`.
 * Long rounds: halfway and the last 10 s. Short rounds (Ko zna zna, 10 s a question): only the last 3 s.
 */
export function cueFor(prev, t, tMax) {
  if (!(prev > t) || prev - t > 1.5) return null;   // only a normal tick, never a restart or a restore
  const crossed = (x) => prev > x && t <= x;
  if (tMax < 30) return crossed(3) ? 'half' : null;
  if (crossed(10)) return 'last';
  if (crossed(tMax / 2)) return 'half';
  return null;
}
