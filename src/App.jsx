import React, { useEffect, useReducer, useRef, useState, useCallback } from 'react';
import { reducer, initialState, progressOf } from './state.js';
import { loadPuzzle } from './puzzles/index.js';
import { makeStorage } from './engine/storage.js';
import { dayNumber } from './engine/day.js';
import { totalOf, maxesOf } from './engine/rules.js';
import { summarize, shareText } from './engine/stats.js';
import { buzz } from './theme.js';
import Header from './components/Header.jsx';
import Home from './screens/Home.jsx';
import Game from './screens/Game.jsx';
import Between from './screens/Between.jsx';
import Results from './screens/Results.jsx';
import Stats from './screens/Stats.jsx';
import Archive from './screens/Archive.jsx';
import How from './screens/How.jsx';

export const SHARE_URL = 'https://dnevnaslagalica.rs';
const STAGE_W = 1448, STAGE_H = 1086, STAGE_PAD = 44, MAX_ZOOM = 2.2;

const storage = makeStorage();

/** Viewport mode: TV stage on wide landscape screens, scrolling column otherwise. */
function useViewport() {
  const get = () => {
    const w = window.innerWidth, h = window.innerHeight;
    const stage = w >= 760 && w / h >= 1.05;
    return { w, h, stage, narrow: !stage && w < 640 };
  };
  const [v, setV] = useState(get);
  useEffect(() => {
    const f = () => setV(get());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return v;
}

export default function App() {
  const [s, dispatch] = useReducer(reducer, undefined, initialState);
  const vp = useViewport();
  const [now, setNow] = useState(Date.now());
  const fitBox = useRef(null), fitIn = useRef(null);
  const relaxed = typeof location !== 'undefined' && /[?&]relaxed/.test(location.search);

  // Boot: today's puzzle + saved progress + history
  useEffect(() => {
    const day = dayNumber();
    loadPuzzle(day).then((puzzle) => {
      dispatch({ type: 'INIT', day, puzzle, progress: storage.loadProgress(day), history: storage.loadHistory() });
      // Dev shortcut: ?game=N opens game N (1–5) in practice mode without touching the real day.
      const m = /[?&]game=([1-5])/.exec(location.search);
      if (m) { dispatch({ type: 'PRACTICE', day, puzzle }); dispatch({ type: 'START_GAME', gi: +m[1] - 1 }); }
    });
  }, []);

  // Timer: real elapsed time, 200 ms resolution
  useEffect(() => {
    if (!(s.screen === 'game' && s.running && !s.locked)) return undefined;
    let last = performance.now();
    const iv = setInterval(() => {
      const t = performance.now(); const dt = (t - last) / 1000; last = t;
      dispatch({ type: 'TICK', dt, relaxed });
    }, 200);
    return () => clearInterval(iv);
  }, [s.screen, s.running, s.locked, relaxed]);

  // Result commit after the short "Tačno!" beat
  useEffect(() => {
    if (!s.pending) return undefined;
    const { seq, delay } = s.pending;
    const id = setTimeout(() => dispatch({ type: 'COMMIT', seq }), delay);
    return () => clearTimeout(id);
  }, [s.pending]);

  // Delayed dispatches (Ko zna zna question advance)
  useEffect(() => {
    if (!s.later || s.screen !== 'game') return undefined;
    const { seq, delay } = s.later;
    const id = setTimeout(() => dispatch({ type: 'LATER_FIRE', seq }), delay);
    return () => clearTimeout(id);
  }, [s.later, s.screen]);

  // Persist progress; record the day in history once it is finished
  useEffect(() => {
    if (!s.ready || s.practice) return;
    storage.saveProgress(progressOf(s));
  }, [s.ready, s.practice, s.scores, s.reveals, s.done, s.gi, s.game, s.t, s.screen, s.paused, s.pending]);
  useEffect(() => {
    if (!s.ready || s.practice || !s.done || s.history[s.day]) return;
    const history = storage.recordDay(s.day, s.scores, totalOf(s.scores), maxesOf(s.puzzle));
    dispatch({ type: 'HISTORY', history });
  }, [s.ready, s.practice, s.done, s.day, s.scores, s.history]);

  // Wall clock for countdowns
  useEffect(() => {
    if (!(s.screen === 'results' || s.screen === 'home')) return undefined;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [s.screen]);

  // Toast auto-hide
  useEffect(() => {
    if (!s.toast) return undefined;
    const id = setTimeout(() => dispatch({ type: 'TOAST_CLEAR' }), 2200);
    return () => clearTimeout(id);
  }, [s.toast]);

  // Keyboard play on desktop
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (s.screen !== 'game' || s.locked) return;
      const k = e.key;
      if (s.gi === 0) {
        if (k === 'Enter') dispatch({ type: 'SL_SUBMIT' });
        else if (k === 'Backspace') dispatch({ type: 'SL_BACK' });
        else if (/^[a-zA-ZčćšžđČĆŠŽĐ]$/.test(k)) { dispatch({ type: 'SL_TYPE', letter: k.toUpperCase() }); }
        else return;
      } else if (s.gi === 1) {
        if (k === 'Backspace') dispatch({ type: 'MB_BACK' });
        else if (k === 'Enter') dispatch({ type: 'MB_SUBMIT' });
        else {
          const m = { '+': '+', '-': '−', '*': '×', '/': '÷', '(': '(', ')': ')' }[k];
          if (m) dispatch({ type: 'MB_PUSH', tok: { o: m } });
          else if (/^[1-6]$/.test(k)) dispatch({ type: 'MB_PUSH', tok: { n: +k - 1 } });
          else return;
        }
      } else if (s.gi === 2) {
        if (/^[1-6]$/.test(k)) dispatch({ type: 'SK_ADD', i: +k - 1 });
        else if (k === 'Enter') dispatch({ type: 'SK_SUBMIT' });
        else if (k === 'Backspace') dispatch({ type: 'SK_DEL' });
        else return;
      } else if (s.gi === 3) {
        const m = { a: 0, b: 1, c: 2, 1: 0, 2: 1, 3: 2 }[k.toLowerCase()];
        if (m != null) dispatch({ type: 'KZ_ANSWER', i: m });
        else if (k === 'n' || k === 'N') dispatch({ type: 'KZ_ANSWER', i: -1 });
        else return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.screen, s.gi, s.locked]);

  // Stage: zoom the content column so it fills the TV frame — up when there is free
  // space, down when it would overflow — capped so the column never exceeds the frame width.
  const fit = useCallback(() => {
    const b = fitBox.current, el = fitIn.current;
    if (!b || !el) return;
    if (!vp.stage) { el.style.zoom = '1'; return; }
    el.style.zoom = '1';
    const screen = el.querySelector('[data-screen]');
    const content = screen && screen.firstElementChild;
    // Measure the natural (unstretched) height: the column normally fills the frame.
    el.style.minHeight = '0';
    if (screen) screen.style.flex = 'none';
    const naturalH = el.scrollHeight;
    const contentW = content ? content.offsetWidth : el.clientWidth;
    el.style.minHeight = '';
    if (screen) screen.style.flex = '';
    const availW = b.clientWidth - 2 * STAGE_PAD;
    const byHeight = b.clientHeight / Math.max(1, naturalH);
    let z = Math.min(byHeight, availW / Math.max(1, contentW), MAX_ZOOM);
    z = Math.max(0.4, z);
    el.style.zoom = String(z);
    // Reflow can change the height (header wraps, text wraps); settle in a few passes.
    for (let n = 0; n < 3; n++) {
      const c = b.clientHeight, sh = b.scrollHeight;
      if (sh <= c + 1) break;
      z = Math.max(0.4, z * c / sh * 0.995);
      el.style.zoom = String(z);
    }
    b.scrollTop = 0;
  }, [vp.stage]);
  useEffect(() => { fit(); }, [s.screen, s.gi, s.ready, vp.w, vp.h, vp.stage, fit]);
  useEffect(() => {
    if (!fitIn.current) return undefined;
    // Observe the screen content, not the zoomed wrapper, so our own zoom changes do not re-trigger fitting.
    const ro = new ResizeObserver(() => fit());
    const target = fitIn.current.querySelector('[data-screen]');
    if (target) ro.observe(target);
    if (document.fonts) document.fonts.ready.then(() => fit());
    return () => ro.disconnect();
  }, [fit, s.screen, s.gi, s.ready]);

  const toast = (msg) => dispatch({ type: 'TOAST', msg });
  const act = useCallback((type, extra) => { buzz(); dispatch({ type, ...(extra || {}) }); }, []);

  const share = () => {
    const stats = summarize(s.history, s.day);
    const text = shareText(s.day, s.scores, totalOf(s.scores), stats.streak, SHARE_URL, maxesOf(s.puzzle));
    const done = () => toast('Rezultat je kopiran');
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove(); done();
    };
    try {
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) { navigator.share({ text }).catch(() => {}); return; }
      navigator.clipboard.writeText(text).then(done, fallback);
    } catch (e) { fallback(); }
  };

  const nav = {
    home: () => dispatch({ type: 'HOME' }),
    stats: () => dispatch({ type: 'GO', screen: 'stats' }),
    archive: () => dispatch({ type: 'GO', screen: 'archive' }),
    how: () => dispatch({ type: 'GO', screen: 'how' }),
    back: () => dispatch({ type: 'BACK' }),
    primary: () => act('PRIMARY'),
    next: () => act('NEXT'),
    practice: async (day) => { const puzzle = await loadPuzzle(day); dispatch({ type: 'PRACTICE', day, puzzle }); },
    reset: () => { storage.clearAll(); dispatch({ type: 'RESET' }); toast('Napredak je obrisan'); },
    share,
  };

  const k = Math.min(vp.w / STAGE_W, vp.h / STAGE_H);
  const screenStyle = vp.stage
    ? { left: (vp.w - STAGE_W * k) / 2, top: (vp.h - STAGE_H * k) / 2, width: STAGE_W, height: STAGE_H, transform: `scale(${k})` }
    : undefined;

  // Phone-sized home carries its own top row (day chip + buttons) and logo, so the global header is skipped there.
  const homePhone = s.screen === 'home' && vp.narrow;
  const showTop = !['game', 'between'].includes(s.screen) && !homePhone;
  const common = { s, dispatch, act, nav, vp, now, relaxed };

  return (
    <div className={'tv-outer' + (vp.stage ? ' stage' : '')}>
      <div className="tv-screen" style={screenStyle}>
        {vp.stage && <div aria-hidden="true" className="ov ov-blur" />}
        <div aria-hidden="true" className="ov ov-scan" />
        {vp.stage && <div aria-hidden="true" className="ov ov-rgb" />}
        <div aria-hidden="true" className="ov ov-glow" />
        {vp.stage && <div aria-hidden="true" className="ov ov-noise" />}
        {vp.stage && <div aria-hidden="true" className="ov ov-vignette" />}
        {vp.stage && <div aria-hidden="true" className="ov ov-roll" />}
        <div ref={fitBox} className="tv-fit">
          <div ref={fitIn} className={'tv-inner' + (s.screen === 'home' && !vp.narrow ? ' home' : '')}>
            {showTop && <Header nav={nav} />}
            <div data-screen className="screen">
              {!s.ready && <div style={{ flex: 1, display: 'grid', placeItems: 'center', fontWeight: 800 }}>Učitavanje…</div>}
              {s.ready && s.screen === 'home' && <Home {...common} />}
              {s.ready && s.screen === 'game' && <Game {...common} />}
              {s.ready && s.screen === 'between' && <Between {...common} />}
              {s.ready && s.screen === 'results' && <Results {...common} />}
              {s.ready && s.screen === 'stats' && <Stats {...common} />}
              {s.ready && s.screen === 'archive' && <Archive {...common} />}
              {s.ready && s.screen === 'how' && <How {...common} />}
            </div>
          </div>
        </div>
        {s.toast && <div role="status" className="toast">{s.toast}</div>}
      </div>
    </div>
  );
}
