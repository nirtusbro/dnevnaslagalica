import React from 'react';
import { GAMES, GRADES, grade, totalOf, remarkFor, maxesOf, maxTotalOf } from '../engine/rules.js';
import { pad3, dateOfDay, MONTHS, secondsToMidnight, hms, dani } from '../engine/day.js';
import { summarize } from '../engine/stats.js';
import { GRADE_COLORS, MUTE, N, Y, W, CY, GR, O, I2 } from '../theme.js';
import { Btn, Gold, Panel, Kicker, CountUp } from '../components/ui.jsx';

export const Legend = ({ size = 10, style }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 14px', fontSize: 12, fontWeight: 800, fontStyle: 'italic', color: I2, ...style }}>
    {GRADES.map((g, i) => <span key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: size, height: size, borderRadius: 1, background: GRADE_COLORS[i] }} />{g.label}</span>)}
  </div>
);

export default function Results({ s, nav, now }) {
  const total = totalOf(s.scores);
  const maxes = maxesOf(s.puzzle);
  const MAX_TOTAL = maxTotalOf(s.puzzle);
  const ratio = total / MAX_TOTAL;
  const st = summarize(s.history, s.day);
  const d = dateOfDay(s.day);
  const countdown = hms(secondsToMidnight(new Date(now)));
  const confetti = ratio >= 0.5 ? Array.from({ length: 14 }, (_, k) => ({ left: (4 + (k * 53) % 90) + '%', c: [Y, CY, GR, W, O][k % 5], d: 300 + (k * 137) % 800, sz: (7 + (k * 7) % 6) + 'px' })) : [];
  const stats3 = [{ v: st.streak, l: 'Niz · ' + dani(st.streak), c: Y }, { v: st.best, l: 'Najbolji niz', c: W }, { v: st.played, l: 'Odigrano', c: W }];

  return (
    <div style={{ width: '100%', maxWidth: 580, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 32px', containerType: 'inline-size' }}>
      <Panel style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(18px,5cqw,30px)', display: 'flex', flexDirection: 'column', gap: 'clamp(18px,4.4cqw,24px)', animation: 'rise .4s both' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{confetti.map((q, i) => <span key={i} style={{ position: 'absolute', left: q.left, top: 0, width: q.sz, height: q.sz, borderRadius: 1, background: q.c, opacity: 0, animation: 'confetti 1.8s cubic-bezier(.3,.6,.5,1) both', animationDelay: q.d + 'ms' }} />)}</div>
        <div className="col" style={{ position: 'relative', alignItems: 'center', gap: 6, textAlign: 'center' }}>
          <Kicker>{s.practice ? 'Vežba' : 'Dnevna Slagalica #' + pad3(s.day) + ' · ' + d.getDate() + '. ' + MONTHS[d.getMonth()]}</Kicker>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span className="mono" style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(84px,24cqw,128px)', lineHeight: .95, letterSpacing: '-.03em', color: Y }}><CountUp to={total} dur={1300} /></span><span style={{ fontWeight: 800, fontSize: 'clamp(18px,4.6cqw,22px)', color: I2 }}>/ {MAX_TOTAL}</span></div>
          <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(18px,4.6cqw,22px)', textTransform: 'uppercase' }}>{remarkFor(total, MAX_TOTAL)}</span>
        </div>
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 'clamp(6px,1.8cqw,10px)' }}>
          {GAMES.map((g, i) => { const gr = grade(i, s.scores[i], maxes[i]); return (
            <div key={i} className="col" style={{ alignItems: 'center', gap: 6, minWidth: 0 }}>
              <div style={{ width: '100%', aspectRatio: '1', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: gr == null ? MUTE : GRADE_COLORS[gr], boxShadow: 'inset 0 1px 0 oklch(1 0 0 / .35),0 3px 0 oklch(0.22 0.104 262)', color: N, animation: 'pop .45s cubic-bezier(.3,1.5,.5,1) both', animationDelay: (500 + i * 120) + 'ms', textShadow: 'none' }}>
                <span className="mono" style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(20px,6cqw,30px)', lineHeight: 1 }}>{s.scores[i] == null ? '—' : s.scores[i]}</span><span style={{ fontSize: 'clamp(10px,2.6cqw,12px)', fontWeight: 800, opacity: .7 }}>/{maxes[i]}</span>
              </div>
              <span style={{ fontSize: 'clamp(10px,2.6cqw,12px)', fontWeight: 800, textTransform: 'uppercase', color: I2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{g.name}</span>
            </div>
          ); })}
        </div>
        <Legend style={{ position: 'relative', marginTop: -6 }} />
        {!s.practice && (
          <Gold onClick={nav.share} style={{ position: 'relative', height: 66, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, animation: 'rise .4s .9s both' }}>
            <span style={{ position: 'relative', width: 18, height: 18 }}><span style={{ position: 'absolute', left: 2, bottom: 1, width: 14, height: 10, border: '2.5px solid currentColor', borderTop: 'none', borderRadius: '0 0 3px 3px' }} /><span style={{ position: 'absolute', left: 7.5, top: 0, width: 2.5, height: 11, background: 'currentColor' }} /><span style={{ position: 'absolute', left: 4.5, top: 1, width: 7, height: 7, borderLeft: '2.5px solid currentColor', borderTop: '2.5px solid currentColor', transform: 'rotate(45deg)' }} /></span>
            <span>Podeli rezultat</span>
          </Gold>
        )}
        <div className="well" style={{ position: 'relative', padding: '12px 16px', display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 10, marginTop: -8 }}><Kicker>Sledeći izazov za</Kicker><span className="mono" style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 22 }}>{countdown}</span></div>
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', borderTop: '1px solid oklch(0.45 0.14 258 / .5)', paddingTop: 16 }}>
          {stats3.map((x, i) => <div key={i} className="col" style={{ alignItems: 'center', gap: 4, padding: 4 }}><span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 28, lineHeight: 1, color: x.c }}>{x.v}</span><Kicker style={{ fontSize: 11, color: I2, textAlign: 'center' }}>{x.l}</Kicker></div>)}
        </div>
      </Panel>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, animation: 'fadeIn .5s 1s both' }}>
        <Btn onClick={nav.stats} style={{ height: 44, padding: '0 18px' }}>Statistika</Btn>
        <Btn onClick={nav.archive} style={{ height: 44, padding: '0 18px' }}>Arhiva</Btn>
        <Btn onClick={nav.home} style={{ height: 44, padding: '0 18px' }}>Početna</Btn>
      </div>
    </div>
  );
}
