import React from 'react';
import { QUESTIONS } from '../../engine/kozna.js';
import { YS, UN, N, Y, R, W, I2, MUTE, SKIPC } from '../../theme.js';
import { Btn, Panel, Kicker } from '../../components/ui.jsx';

export default function KoZnaZna({ s, act }) {
  const g = s.game.kz;
  const Q = s.puzzle.koZnaZna[g.q];
  const qa = g.q % 2 ? 'riseA' : 'riseB';
  const p = g.pick;
  const lastR = g.res[g.res.length - 1];
  const fb = p == null ? '' : lastR === 1 ? 'Tačno! +10' : lastR === -1 ? 'Netačno · −5' : g.to ? 'Vreme je isteklo · 0' : 'Preskočeno · 0';
  const fbC = p != null && lastR === 1 ? Y : p != null && lastR === -1 ? R : I2;

  const opts = Q.o.map((o, i) => {
    let x = { bg: 'oklch(0.37 0.182 262)', sh: 'inset 0 0 0 1.5px oklch(0.5 0.15 252),0 3px 0 oklch(0.22 0.104 262)', fg: W, cbg: Y, cfg: N, tag: '' };
    if (p != null) {
      if (i === Q.a) x = p === i ? { bg: YS.bg, sh: YS.sh, fg: N, cbg: N, cfg: Y, tag: '✓ +10' } : { bg: 'oklch(0.33 0.156 262)', sh: 'inset 0 0 0 2px ' + Y, fg: Y, cbg: Y, cfg: N, tag: '✓ tačno' };
      else if (i === p) x = { bg: R, sh: '0 3px 0 oklch(0.45 0.16 28)', fg: N, cbg: N, cfg: R, tag: '✕ −5' };
      else x = { bg: UN.bg, sh: UN.sh, fg: UN.fg, cbg: 'oklch(0.35 0.143 262)', cfg: UN.fg, tag: '' };
    }
    return { o, L: 'ABC'[i], ...x, anim: qa + ' .4s ' + (0.06 + i * 0.06).toFixed(2) + 's both' };
  });

  return (
    <div className="col" style={{ gap: 14, animation: 'rise .35s both' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: QUESTIONS }, (_, i) => {
          const bg = i < g.res.length ? (g.res[i] === 1 ? Y : g.res[i] === -1 ? R : SKIPC) : i === g.q ? W : MUTE;
          return <span key={i} style={{ flex: 1, height: 6, borderRadius: 1, background: bg, transition: 'background .3s' }} />;
        })}
      </div>
      <Panel key={g.q} style={{ minHeight: 'clamp(176px,34cqw,220px)', padding: 'clamp(20px,5cqw,32px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, animation: qa + ' .4s both' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <Kicker y>Pitanje {g.q + 1} / {QUESTIONS}{Q.cat ? ' · ' + Q.cat : ''}</Kicker>
          <span style={{ fontSize: 13, fontWeight: 800, color: I2, whiteSpace: 'nowrap' }}>Skor <b style={{ color: W }}>{(g.score > 0 ? '+' : '') + g.score}</b></span>
        </div>
        <span style={{ fontWeight: 800, fontSize: 'clamp(22px,5.8cqw,32px)', lineHeight: 1.22, textWrap: 'balance' }}>{Q.q}</span>
      </Panel>
      <div className="col" style={{ gap: 'clamp(8px,2cqw,10px)' }}>
        {opts.map((o, i) => (
          <button key={g.q + '-' + i} onClick={() => act('KZ_ANSWER', { i })}
            style={{ minHeight: 'clamp(58px,12.6cqw,66px)', border: 'none', borderRadius: 5, padding: '10px 16px 10px 10px', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', background: o.bg, boxShadow: o.sh, color: o.fg, animation: o.anim, transition: 'background .25s, color .25s, box-shadow .25s', textShadow: o.fg === N ? 'none' : undefined }}>
            <span style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontStyle: 'italic', fontSize: 16, background: o.cbg, color: o.cfg, textShadow: 'none' }}>{o.L}</span>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 'clamp(16px,4.4cqw,19px)', lineHeight: 1.25, textWrap: 'pretty' }}>{o.o}</span>
            <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 15, whiteSpace: 'nowrap' }}>{o.tag}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 50 }}>
        <span style={{ fontSize: 15, fontWeight: 800, fontStyle: 'italic', color: fbC }} aria-live="polite">{fb}</span>
        <Btn onClick={() => act('KZ_ANSWER', { i: -1 })} style={{ height: 48, padding: '0 20px', opacity: p == null ? 1 : 0.4 }}>Ne znam</Btn>
      </div>
      <span style={{ textAlign: 'center', fontSize: 13, color: I2 }}>Tačno +10 · Netačno −5 · Ne znam 0</span>
    </div>
  );
}
