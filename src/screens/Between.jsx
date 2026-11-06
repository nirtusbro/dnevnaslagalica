import React from 'react';
import { GAMES, grade, gameMax, percent } from '../engine/rules.js';
import { bestWord, bonusFor, letterCount, BONUS_SAME_WORD, BONUS_SAME_LENGTH, BONUS_LONGER } from '../engine/slagalica.js';
import { solve } from '../engine/mojbroj.js';
import { QUESTIONS } from '../engine/kozna.js';
import { GRADE_COLORS, MUTE, YS, UN, OPEN, N, Y, R, I2, SKIPC } from '../theme.js';
import { Btn, Gold, Panel, Kicker, Sym, GameArt, CountUp } from '../components/ui.jsx';
import { DayDots } from './Game.jsx';

/** Reveal data for one game: verdict, note and the comparison block. */
export function revealOf(s, gi) {
  const rd = s.reveals[gi] || {};
  const pts = s.scores[gi] || 0;
  const P = s.puzzle;
  const max = gameMax(gi, P);
  if (gi === 0) {
    const w = rd.word || '';
    const best = bestWord(P.slagalica);
    const bonus = rd.ok ? bonusFor(w, best) : 0;
    const bonusTxt = bonus === BONUS_SAME_WORD ? 'To je zadata reč: +5 bonus.' : bonus === BONUS_SAME_LENGTH ? 'Iste dužine kao zadata reč: +10 bonus.' : bonus === BONUS_LONGER ? 'Duža od zadate reči: +15 bonus!' : '';
    const note = rd.ok ? (bonus ? letterCount(w) + ' slova · ' + bonusTxt : 'Tvoja reč ima ' + letterCount(w) + ' slova. Zadata reč ima ' + letterCount(best) + '.') : w ? 'Reč „' + w + '“ nije u rečniku.' : 'Vreme je isteklo pre nego što si potvrdio reč.';
    const verdict = bonus ? 'Savršeno!' : pts >= Math.max(6, max - 8) ? 'Odlična reč!' : pts > 0 ? 'Tačno!' : 'Bez poena';
    return { verdict, note, body: <SlBody w={w} ok={rd.ok} best={best} /> };
  }
  if (gi === 1) {
    const T = P.mojBroj.target;
    const solved = P.mojBroj.solution ? { text: P.mojBroj.solution, value: T, diff: 0 } : solve(P.mojBroj.numbers, T);
    const d = rd.val != null ? Math.abs(T - rd.val) : null;
    const note = d === 0 ? 'Tačno do broja.' : pts ? 'Traženi broj nije dostižan, a tvoj rezultat je najbliži mogući.' : d != null ? 'Razlika od traženog broja: ' + d + '. Poene donosi samo tačan broj.' : 'Izraz nije završen na vreme.';
    const verdict = pts ? 'Tačno!' : d != null && d <= 10 ? 'Blizu, ali ne' : 'Ovog puta ne';
    return { verdict, note, body: <MbBody expr={rd.expr} val={rd.val} sol={solved.text} target={T} solValue={solved.value} /> };
  }
  if (gi === 2) {
    const note = rd.won ? 'Pogođeno iz ' + rd.n + '. pokušaja.' : 'Kombinacija nije pogođena.';
    return { verdict: rd.won ? 'Pogođeno!' : 'Tajna otkrivena', note, body: <SkBody last={rd.last || []} secret={P.skocko.secret} /> };
  }
  if (gi === 3) {
    const res = rd.res || [];
    const c = res.filter((x) => x === 1).length, w = res.filter((x) => x === -1).length;
    const note = c + ' tačnih · ' + w + ' netačnih · ' + (QUESTIONS - c - w) + ' bez odgovora';
    const verdict = c >= QUESTIONS ? 'Sve tačno!' : c >= QUESTIONS * 0.8 ? 'Odlično!' : c >= QUESTIONS * 0.6 ? 'Dobro!' : 'Može bolje';
    return { verdict, note, body: <KzBody res={res} qs={P.koZnaZna} /> };
  }
  const sol = rd.sol || [0, 0, 0, 0];
  const n = sol.filter((x) => x === 1).length;
  const note = (rd.fin === 1 ? 'Pogodio si konačno rešenje' : 'Konačno rešenje nije pogođeno') + ' · samostalno rešenih kolona: ' + n + ' od 4. Žuto = tvoja rešenja.';
  const verdict = rd.fin === 1 ? 'Rešeno!' : pts > 0 ? 'Delimično' : 'Bez poena';
  return { verdict, note, body: <AsBody sol={sol} fin={rd.fin} A={P.asocijacije} /> };
}

const Letter = ({ l, st, delay }) => (
  <span style={{ width: 'clamp(30px,7.6cqw,40px)', height: 'clamp(36px,9cqw,46px)', borderRadius: 3, display: 'grid', placeItems: 'center', fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(18px,5cqw,24px)', background: st.bg, boxShadow: st.sh, color: st.fg, textShadow: st.fg === N ? 'none' : undefined, animation: delay != null ? 'flipIn .4s both' : undefined, animationDelay: delay != null ? delay + 'ms' : undefined }}>{l}</span>
);
const TILE = { bg: 'radial-gradient(130% 100% at 30% 10%,#5a80f6,#2d55dc 55%,#2343c0)', sh: 'inset 0 0 0 3px #d0dcfa,inset 0 0 0 5px oklch(0.45 0.17 266),inset 0 7px 9px oklch(1 0 0 / .28),0 0 0 2px oklch(0.17 0.1 270),4px 5px 0 oklch(0.1 0.07 272 / .6)', fg: 'oklch(0.99 0.005 250)' };

function SlBody({ w, ok, best }) {
  const st = ok ? YS : { ...UN, fg: 'oklch(0.7 0.06 255)' };
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="col" style={{ gap: 8 }}><Kicker>Tvoja reč</Kicker>
        {w ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{w.split('').map((l, i) => <Letter key={i} l={l} st={st} />)}</div> : <span style={{ fontSize: 16, fontWeight: 800, fontStyle: 'italic', color: I2 }}>Nisi složio reč</span>}
      </div>
      <div className="col" style={{ gap: 8 }}><Kicker y>Najduža reč</Kicker>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{best.split('').map((l, i) => <Letter key={i} l={l} st={TILE} delay={350 + i * 60} />)}</div>
      </div>
    </div>
  );
}
function MbBody({ expr, val, sol, target, solValue }) {
  const exact = solValue == null || solValue === target;
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="col" style={{ gap: 8 }}><Kicker>Tvoj izraz</Kicker>
        <div className="well" style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}><span style={{ fontWeight: 800, fontSize: 'clamp(17px,4.6cqw,21px)' }}>{expr || '—'}</span><span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 20, color: I2 }}>{val != null ? '= ' + val : ''}</span></div>
      </div>
      <div className="col" style={{ gap: 8 }}><Kicker y>{exact ? 'Jedno tačno rešenje' : 'Najbliže moguće rešenje'}</Kicker>
        <div className="well" style={{ boxShadow: 'inset 0 0 0 1.5px oklch(0.87 0.17 92 / .7)', padding: '12px 14px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, animation: 'rise .4s .3s both' }}><span style={{ fontWeight: 800, fontSize: 'clamp(17px,4.6cqw,21px)' }}>{sol}</span><span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 20, color: Y }}>= {exact ? target : solValue}</span></div>
      </div>
    </div>
  );
}
function SkBody({ last, secret }) {
  const cell = (i, k, reveal) => <div key={k} className="well" style={{ width: 50, height: 50, display: 'grid', placeItems: 'center', boxShadow: reveal ? 'inset 0 0 0 1.5px oklch(0.87 0.17 92 / .7)' : undefined }}>{i != null && <Sym i={i} size={28} anim={reveal ? 'flipIn .45s both' : undefined} delay={reveal ? 300 + k * 140 : 0} />}</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
      <div className="col" style={{ gap: 8 }}><Kicker>Tvoj poslednji pokušaj</Kicker><div style={{ display: 'flex', gap: 6 }}>{[0, 1, 2, 3].map((k) => cell(last[k], k, false))}</div></div>
      <div className="col" style={{ gap: 8 }}><Kicker y>Tajna kombinacija</Kicker><div style={{ display: 'flex', gap: 6 }}>{secret.map((x, k) => cell(x, k, true))}</div></div>
    </div>
  );
}
function KzBody({ res, qs }) {
  return (
    <div className="col" style={{ gap: 6 }}>
      {qs.map((q, i) => {
        const r = res[i]; const c = r === 1 ? Y : r === -1 ? R : SKIPC;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '10px minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 4, background: 'oklch(0.25 0.117 262 / .6)', animation: 'rise .35s both', animationDelay: (200 + i * 80) + 'ms' }}>
            <span style={{ width: 10, height: 10, borderRadius: 1, background: c }} />
            <div className="col" style={{ gap: 2, minWidth: 0 }}><span style={{ fontSize: 13, color: I2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.q}</span><span style={{ fontSize: 15, fontWeight: 800 }}>{q.o[q.a]}</span></div>
            <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 14, color: c }}>{r === 1 ? '+10' : r === -1 ? '−5' : '0'}</span>
          </div>
        );
      })}
    </div>
  );
}
function AsBody({ sol, fin, A }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6 }}>
        {A.cols.map((C, i) => { const st = sol[i] === 1 ? YS : OPEN; return (
          <div key={i} className="col" style={{ gap: 4, alignItems: 'center' }}><span style={{ fontSize: 11, fontWeight: 800, color: I2 }}>Kolona {C.L}</span><span style={{ width: '100%', height: 42, borderRadius: 4, display: 'grid', placeItems: 'center', fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(12px,3.4cqw,15px)', background: st.bg, boxShadow: st.sh, color: N, textShadow: 'none' }}>{C.s}</span></div>
        ); })}
      </div>
      {(() => { const st = fin === 1 ? YS : OPEN; return <div style={{ height: 54, borderRadius: 5, display: 'grid', placeItems: 'center', fontWeight: 800, fontStyle: 'italic', fontSize: 24, letterSpacing: '.05em', background: st.bg, boxShadow: st.sh, color: N, textShadow: 'none', animation: 'pop .5s .3s both' }}>{A.final.s}</div>; })()}
    </div>
  );
}

export default function Between({ s, nav }) {
  const gi = s.gi;
  const pts = s.scores[gi] || 0;
  const max = gameMax(gi, s.puzzle);
  const gr = grade(gi, s.scores[gi], max);
  const R0 = revealOf(s, gi);
  const nx = GAMES[gi + 1];

  return (
    <div className="game-wrap" style={{ paddingTop: 16, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><Kicker>Igra {gi + 1} / 5 · {GAMES[gi].name}</Kicker><DayDots s={s} /></div>
      <Panel style={{ padding: 'clamp(16px,4cqw,24px)', display: 'flex', flexDirection: 'column', gap: 18, animation: 'rise .4s both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px,3cqw,18px)' }}>
          <div style={{ width: 'clamp(64px,16cqw,80px)', aspectRatio: '1', borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center', background: gr == null ? MUTE : GRADE_COLORS[gr], boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .35),0 3px 0 oklch(0.22 0.104 262)', color: N, fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(17px,4.4cqw,21px)', animation: 'pop .5s .5s cubic-bezier(.3,1.5,.5,1) both', textShadow: 'none' }}>{percent(pts, max)}%</div>
          <div className="col" style={{ gap: 4, minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(20px,5.4cqw,26px)', lineHeight: 1.05, textTransform: 'uppercase' }}>{R0.verdict}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span className="mono" style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(42px,11cqw,56px)', lineHeight: 1, color: Y }}>{pts < 0 ? '−' : '+'}<CountUp key={'b' + gi} to={Math.abs(pts)} /></span><span style={{ fontSize: 15, fontWeight: 800, fontStyle: 'italic', color: I2 }}>od {max} poena</span></div>
          </div>
        </div>
        <div className="hr" />
        {R0.body}
        <span style={{ fontSize: 15, lineHeight: 1.45, color: I2, textWrap: 'pretty' }}>{R0.note}</span>
      </Panel>
      {nx && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 5, boxShadow: 'inset 0 0 0 1.5px oklch(0.48 0.169 262)', animation: 'rise .4s .3s both' }}>
          <div style={{ width: 76, height: 54, borderRadius: 4, background: 'oklch(0.23 0.104 262)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><GameArt gi={gi + 1} mini /></div>
          <div className="col" style={{ gap: 3, minWidth: 0 }}><Kicker y style={{ fontSize: 11 }}>Sledeće · {nx.timeL}</Kicker><span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 17, textTransform: 'uppercase' }}>{nx.name}</span><span style={{ fontSize: 14, color: I2 }}>{nx.desc}</span></div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 'auto' }}>
        <Btn onClick={nav.home} style={{ height: 62 }}>Pauza</Btn>
        <Gold onClick={nav.next} style={{ height: 62, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}><span>{gi < 4 ? 'Sledeća igra' : 'Konačni rezultat'}</span><span>→</span></Gold>
      </div>
    </div>
  );
}
