import React from 'react';
import { GAMES } from '../engine/rules.js';
import { gradesOf } from '../engine/stats.js';
import { pad3, dateOfDay, shortDate } from '../engine/day.js';
import { GRADE_COLORS, MUTE, Y } from '../theme.js';
import { Btn, Gold, Panel } from '../components/ui.jsx';

const DAYS_SHOWN = 12;

export default function Archive({ s, nav }) {
  const rows = [];
  for (let k = 1; k <= DAYS_SHOWN; k++) {
    const n = s.day - k;
    if (n < 1) break;
    const e = s.history[n];
    rows.push({ n, date: shortDate(dateOfDay(n)), e });
  }
  return (
    <div className="col" style={{ width: '100%', maxWidth: 640, margin: '0 auto', gap: 14, padding: '4px 0 36px', animation: 'rise .4s both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><h2 className="h2">Arhiva</h2><Btn onClick={nav.home} style={{ height: 44, padding: '0 18px' }}>Zatvori</Btn></div>
      <span className="soft" style={{ fontSize: 15 }}>Propuštene izazove možeš da odigraš kao vežbu. Ne utiču na niz.</span>
      <Panel style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!rows.length && <span className="soft" style={{ padding: 12, fontSize: 15 }}>Ovo je prvi izazov. Arhiva počinje sutra.</span>}
        {rows.map((r) => (
          <div key={r.n} className="row-card" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '8px 10px' }}>
            <div className="col" style={{ width: 70, flexShrink: 0 }}><span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 17 }}>#{pad3(r.n)}</span><span className="soft" style={{ fontSize: 12, fontWeight: 800, fontStyle: 'italic' }}>{r.date}</span></div>
            <div style={{ flex: 1, display: 'flex', gap: 4 }}>{gradesOf(r.e).map((gr, i) => <span key={i} style={{ width: 20, height: 20, borderRadius: 2, background: gr == null ? MUTE : GRADE_COLORS[gr] }} />)}</div>
            {r.e
              ? <span className="well mono" style={{ minWidth: 52, height: 36, display: 'grid', placeItems: 'center', fontWeight: 800, fontStyle: 'italic', fontSize: 18, color: Y }}>{r.e.total}</span>
              : <Gold onClick={() => nav.practice(r.n)} style={{ height: 40, padding: '0 16px', fontSize: 14, borderRadius: 4 }}>Igraj</Gold>}
          </div>
        ))}
      </Panel>
    </div>
  );
}
