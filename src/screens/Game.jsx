import React from 'react';
import { GAMES, grade, totalOf, maxesOf } from '../engine/rules.js';
import { pad3 } from '../engine/day.js';
import { GRADE_COLORS, W, MUTE, CY, R, O, Y } from '../theme.js';
import Slagalica from './games/Slagalica.jsx';
import MojBroj from './games/MojBroj.jsx';
import Skocko from './games/Skocko.jsx';
import KoZnaZna from './games/KoZnaZna.jsx';
import Asocijacije from './games/Asocijacije.jsx';

export function DayDots({ s, current }) {
  const maxes = maxesOf(s.puzzle);
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {GAMES.map((g, i) => {
        const gr = grade(i, s.scores[i], maxes[i]);
        const bg = gr != null ? GRADE_COLORS[gr] : current && i === s.gi ? W : MUTE;
        return <span key={i} className="pill" style={{ background: bg }} />;
      })}
    </div>
  );
}

export default function Game(props) {
  const { s, nav, relaxed } = props;
  const G = GAMES[s.gi];
  const total = totalOf(s.scores);
  const crit = s.t <= Math.min(5, s.tMax * 0.3), urg = s.t <= Math.min(10, s.tMax * 0.5);
  const tColor = relaxed ? CY : crit ? R : urg ? O : Y;
  const tPct = relaxed ? '100%' : Math.max(0, s.t / s.tMax * 100).toFixed(1) + '%';

  return (
    <div className="game-wrap">
      <div className="col" style={{ gap: 12, paddingTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', alignItems: 'center', gap: 12 }}>
          <button className="btn" onClick={nav.home} aria-label="Pauza" style={{ width: 44, height: 44, padding: 0, fontSize: 20, display: 'grid', placeItems: 'center' }}>×</button>
          <div className="col" style={{ gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="kicker">Igra {s.gi + 1} / 5 · {s.practice ? 'Vežba' : '#' + pad3(s.day)}</span>
              <DayDots s={s} current />
            </div>
            <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(20px,5.4cqw,26px)', lineHeight: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{G.name}</span>
          </div>
          <div className="well timer" aria-live="off">
            <span style={{ color: tColor, animation: crit && s.running && !relaxed ? 'tick 1s ease-in-out infinite' : 'none' }}>{relaxed ? '∞' : Math.ceil(s.t)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="well tbar"><div><div className="fill" style={{ width: tPct, background: tColor }} /><div className="ticks" /></div></div>
          <span style={{ fontSize: 13, fontWeight: 800, fontStyle: 'italic', color: 'oklch(0.92 0.05 248)', whiteSpace: 'nowrap' }}>Ukupno <b className="mono" style={{ color: W }}>{total}</b> p</span>
        </div>
      </div>
      {s.gi === 0 && <Slagalica {...props} />}
      {s.gi === 1 && <MojBroj {...props} />}
      {s.gi === 2 && <Skocko {...props} />}
      {s.gi === 3 && <KoZnaZna {...props} />}
      {s.gi === 4 && <Asocijacije {...props} />}
    </div>
  );
}
