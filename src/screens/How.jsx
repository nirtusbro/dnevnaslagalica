import React from 'react';
import { GAMES } from '../engine/rules.js';
import { Y } from '../theme.js';
import { Btn, Panel, GameArt } from '../components/ui.jsx';
import { Legend } from './Results.jsx';

export default function How({ nav }) {
  return (
    <div className="col" style={{ width: '100%', maxWidth: 640, margin: '0 auto', gap: 14, padding: '4px 0 36px', animation: 'rise .4s both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><h2 className="h2">Kako se igra</h2><Btn onClick={nav.home} style={{ height: 44, padding: '0 18px' }}>Zatvori</Btn></div>
      <span className="soft" style={{ fontSize: 16, lineHeight: 1.5, textWrap: 'pretty' }}>Svakog dana svi dobijaju istih pet igara. Igraju se redom i samo jednom. Boja kvadrata pokazuje koji si deo mogućih poena osvojio.</span>
      <div className="well" style={{ padding: '12px 16px' }}><Legend size={14} style={{ justifyContent: 'flex-start', fontSize: 13, fontStyle: 'normal', color: 'inherit', gap: 16 }} /></div>
      <Panel style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {GAMES.map((g, i) => (
          <div key={i} className="row-card" style={{ display: 'flex', gap: 14, padding: 12 }}>
            <div style={{ width: 76, height: 54, borderRadius: 4, background: 'oklch(0.23 0.104 262)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><GameArt gi={i} mini /></div>
            <div className="col" style={{ gap: 4, minWidth: 0 }}>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}><span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 16, textTransform: 'uppercase' }}>{g.name}</span><span style={{ fontSize: 13, fontWeight: 800, color: Y }}>{g.timeL} · do {g.max} p</span></span>
              <span className="soft" style={{ fontSize: 15, lineHeight: 1.5, textWrap: 'pretty' }}>{g.rule}</span>
            </div>
          </div>
        ))}
      </Panel>
      <span className="soft" style={{ fontSize: 13, lineHeight: 1.5 }}>Na tastaturi: slova i Enter u Slagalici (LJ, NJ i DŽ su jedno slovo i biraju se klikom) · brojevi 1–6 i + − * / ( ) u Mom broju · 1–6 u Skočku · A/B/C ili 1/2/3 i N (ne znam) u Ko zna zna.</span>
    </div>
  );
}
