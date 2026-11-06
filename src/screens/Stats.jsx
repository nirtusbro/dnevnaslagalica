import React from 'react';
import { GAMES, grade } from '../engine/rules.js';
import { summarize, recentDays, HIST_BUCKETS } from '../engine/stats.js';
import { GRADE_COLORS, MUTE, N, Y, W } from '../theme.js';
import { Btn, Panel, Kicker } from '../components/ui.jsx';

export default function Stats({ s, nav }) {
  const st = summarize(s.history, s.day);
  const hMax = Math.max(1, ...st.hist);
  const days = recentDays(s.history, s.day, 14);
  const stats4 = [{ v: st.streak, l: 'Niz', c: Y }, { v: st.best, l: 'Najbolji niz', c: W }, { v: st.played, l: 'Odigrano', c: W }, { v: st.avg + '%', l: 'Prosek', c: W }];
  const todayTotal = s.history[s.day]?.total;

  return (
    <div className="col" style={{ width: '100%', maxWidth: 760, margin: '0 auto', gap: 16, padding: '4px 0 36px', animation: 'rise .4s both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><h2 className="h2">Statistika</h2><Btn onClick={nav.back} style={{ height: 44, padding: '0 18px' }}>Zatvori</Btn></div>
      <Panel style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 4 }}>
        {stats4.map((x, i) => <div key={i} className="col" style={{ alignItems: 'center', gap: 4, padding: 4 }}><span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 28, lineHeight: 1, color: x.c }}>{x.v}</span><Kicker style={{ fontSize: 11, color: 'oklch(0.92 0.05 248)', textAlign: 'center' }}>{x.l}</Kicker></div>)}
      </Panel>
      {!st.played && <span className="soft" style={{ fontSize: 15 }}>Još nema odigranih izazova. Statistika se puni posle prvog završenog dana.</span>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Panel style={{ flex: '1 1 300px', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Kicker>Raspodela poena</Kicker>
          {HIST_BUCKETS.map((b, i) => {
            const me = todayTotal != null && (todayTotal < b.max) && (i === 0 || todayTotal >= HIST_BUCKETS[i - 1].max);
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '62px minmax(0,1fr)', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'oklch(0.92 0.05 248)' }}>{b.label}</span>
                <div style={{ height: 28, width: (st.hist[i] / hMax * 100).toFixed(0) + '%', minWidth: 32, borderRadius: 3, background: me ? Y : 'oklch(0.46 0.195 262)', color: me ? N : W, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 10px', fontWeight: 800, fontStyle: 'italic', fontSize: 13, transformOrigin: 'left', animation: 'widthGrow .6s cubic-bezier(.3,1.2,.5,1) both', textShadow: me ? 'none' : undefined }}>{st.hist[i]}</div>
              </div>
            );
          })}
        </Panel>
        <Panel style={{ flex: '1 1 300px', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Kicker>Prosečan uspeh po igri</Kicker>
          {GAMES.map((g, i) => {
            const pct = st.perGame[i];
            const bg = GRADE_COLORS[grade(i, g.max * pct / 100)];
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '104px minmax(0,1fr) 40px', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 13, textTransform: 'uppercase' }}>{g.name}</span>
                <div className="well" style={{ height: 12, padding: 2, borderRadius: 2 }}><div style={{ height: '100%', width: pct + '%', background: bg, borderRadius: 2, transformOrigin: 'left', animation: 'widthGrow .7s both' }} /></div>
                <span className="mono" style={{ fontSize: 13, fontWeight: 800, fontStyle: 'italic', textAlign: 'right' }}>{pct}%</span>
              </div>
            );
          })}
        </Panel>
      </div>
      <Panel style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Kicker>Poslednjih 14 dana</Kicker>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14,minmax(0,1fr))', gap: 5 }}>
          {days.map((d) => <div key={d.day} style={{ display: 'grid', gridTemplateRows: 'repeat(5,1fr)', gap: 3 }} title={'#' + d.day}>{d.grades.map((x, i) => <span key={i} style={{ aspectRatio: '1', borderRadius: 1, background: x == null ? MUTE : GRADE_COLORS[x] }} />)}</div>)}
        </div>
      </Panel>
    </div>
  );
}
