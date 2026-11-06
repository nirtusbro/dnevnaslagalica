import React from 'react';
import { SYMBOLS } from '../engine/skocko.js';
import { SYM_COLORS, N } from '../theme.js';

export const Panel = ({ style, className = '', children, ...rest }) => (
  <div className={'panel ' + className} style={style} {...rest}>{children}</div>
);

export const Btn = ({ className = '', children, ...rest }) => (
  <button className={'btn ' + className} {...rest}>{children}</button>
);

export const Gold = ({ className = '', children, ...rest }) => (
  <button className={'btn-gold ' + className} {...rest}>{children}</button>
);

export const Kicker = ({ y, style, children }) => (
  <span className={'kicker' + (y ? ' kicker-y' : '')} style={style}>{children}</span>
);

/** The yellow smiley used for the "Skočko" symbol. */
export const Face = ({ size = 28 }) => (
  <span className="face" style={{ width: size, height: size }}><i /><i /><b /></span>
);

/** One Skočko symbol, glyph or face. */
export const Sym = ({ i, size = 28, anim, delay }) => {
  const s = SYMBOLS[i];
  const st = anim ? { animation: anim, animationDelay: (delay || 0) + 'ms' } : undefined;
  if (!s.glyph) return <span style={{ display: 'block', ...st }}><Face size={size} /></span>;
  return <span className="sym" style={{ fontSize: size, color: SYM_COLORS[i] || N, ...st }}>{s.glyph}</span>;
};

/** Small preview artwork for each game (home cards, how-to, "next up"). */
export function GameArt({ gi, mini }) {
  const sym = (g, c) => <span className="sym-tile" style={{ width: mini ? 12 : 'clamp(30px,3.6cqw,48px)', height: mini ? 12 : 'clamp(30px,3.6cqw,48px)', fontSize: mini ? 8 : 'clamp(30px,3.6cqw,48px)', color: c, borderRadius: mini ? 1 : 6 }}><span className="sym">{g}</span></span>;
  if (gi === 0) {
    const L = ['A', 'K', 'O', 'S', 'R', 'E'];
    return mini
      ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,16px)', gap: 3 }}>{L.map((l, i) => <span key={i} className="tile tile-sm">{l}</span>)}</div>
      : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,auto)', gap: 'clamp(8px,1.2cqw,14px)' }}>{L.map((l, i) => <span key={i} className="tile" style={{ width: 'clamp(52px,7cqw,104px)', height: 'clamp(52px,7cqw,100px)', fontSize: 'clamp(34px,5cqw,72px)' }}>{l}</span>)}</div>;
  }
  if (gi === 1) {
    return (
      <div className="col" style={{ alignItems: 'center', gap: mini ? 4 : 'clamp(8px,1.2cqw,14px)' }}>
        <div style={{ display: 'flex', gap: mini ? 3 : 'clamp(8px,1cqw,14px)' }}>{[0, 1, 2].map((i) => <span key={i} className="slot-y" style={mini ? { width: 15, height: 19, fontSize: 11, borderRadius: 1 } : { width: 'clamp(32px,3.8cqw,50px)', height: 'clamp(34px,4cqw,52px)', fontSize: 'clamp(22px,2.8cqw,34px)' }}>?</span>)}</div>
        <div style={{ display: 'flex', gap: mini ? 3 : 'clamp(5px,0.8cqw,10px)' }}>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={mini ? 'tile' : 'bar-b'} style={mini ? { width: 8, height: 8, borderRadius: 1 } : { width: 'clamp(18px,2.2cqw,30px)', height: 'clamp(14px,1.7cqw,22px)', borderRadius: 5 }} />)}</div>
      </div>
    );
  }
  if (gi === 2) {
    const W = 'oklch(0.99 0.005 250)', Y = 'oklch(0.87 0.17 92)', R = 'oklch(0.66 0.2 30)', C = 'oklch(0.88 0.11 228)', O = 'oklch(0.76 0.16 60)', K = 'oklch(0.14 0.03 270)';
    if (mini) {
      const peg = (c) => <span style={{ width: 4, height: 4, borderRadius: '50%', background: c, boxShadow: 'inset 0 0 0 1px oklch(0.5 0.12 255)' }} />;
      const row = (gs, pegs) => <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>{gs.map((g, i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 1, background: 'oklch(0.33 0.143 262)', display: 'grid', placeItems: 'center', fontSize: 8, lineHeight: 1, color: g[1] }} className="sym">{g[0]}</span>)}<span style={{ display: 'grid', gridTemplateColumns: 'repeat(2,4px)', gap: 2, marginLeft: 3 }}>{pegs.map((c, i) => <React.Fragment key={i}>{peg(c)}</React.Fragment>)}</span></div>;
      return <div className="col" style={{ gap: 3 }}>{row([['♣︎', W], ['★', Y], ['♥︎', R], ['♠︎', C]], [R, Y, 'transparent', 'transparent'])}{row([['★', Y], ['♣︎', R], ['♠︎', C], ['♥︎', W]], [R, Y, R, Y])}</div>;
    }
    return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,auto)', gap: 'clamp(5px,0.8cqw,10px)' }}>{[['♣︎', W], ['♦︎', R], ['♥︎', R], ['♠︎', K], ['★', Y], ['♣︎', W], ['♥︎', R], ['♦︎', R]].map((g, i) => <React.Fragment key={i}>{sym(g[0], g[1])}</React.Fragment>)}</div>;
  }
  if (gi === 3) {
    const rows = ['b', 'y', 'b'];
    return <div className="col" style={{ gap: mini ? 3 : 'clamp(6px,1cqw,12px)' }}>{rows.map((r, i) => <div key={i} style={{ display: 'flex', gap: mini ? 3 : 8, alignItems: 'center' }}><span className={mini ? 'slot-y' : 'bar-y'} style={mini ? { width: 9, height: 9, borderRadius: 1 } : { width: 'clamp(16px,2cqw,26px)', height: 'clamp(16px,2cqw,24px)', borderRadius: 5 }} /><span className={r === 'y' ? (mini ? 'slot-y' : 'bar-y') : (mini ? '' : 'bar-b')} style={mini ? { width: 42, height: 9, borderRadius: 1, background: r === 'y' ? undefined : 'oklch(0.42 0.182 262)' } : { width: 'clamp(90px,14cqw,190px)', height: 'clamp(13px,1.6cqw,20px)' }} /></div>)}</div>;
  }
  const bar = (k) => <span key={k} className={mini ? 'tile' : 'bar-b'} style={mini ? { width: 24, height: 7, borderRadius: 1 } : { width: 'clamp(54px,7.6cqw,108px)', height: 'clamp(13px,1.6cqw,20px)' }} />;
  const pair = (k) => <div key={k} style={{ display: 'flex', gap: mini ? 6 : 'clamp(10px,2cqw,24px)' }}>{bar(0)}{bar(1)}</div>;
  return <div className="col" style={{ alignItems: 'center', gap: mini ? 3 : 'clamp(4px,0.6cqw,7px)' }}>{pair(0)}{pair(1)}<span className={mini ? 'slot-y' : 'bar-y'} style={mini ? { width: 54, height: 8, borderRadius: 1 } : { width: '100%', height: 'clamp(13px,1.6cqw,20px)' }} />{pair(2)}{pair(3)}</div>;
}

/** Animated number that counts up to `to`. */
export function CountUp({ to, dur = 900 }) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(to); return undefined; }
    let raf, st;
    const f = (t) => { if (!st) st = t; const q = Math.min(1, (t - st) / dur); setV(Math.round(to * (1 - Math.pow(1 - q, 3)))); if (q < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    const fb = setTimeout(() => setV(to), dur + 250);
    return () => { cancelAnimationFrame(raf); clearTimeout(fb); };
  }, [to, dur]);
  return <span>{v}</span>;
}
