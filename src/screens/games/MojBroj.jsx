import React from 'react';
import * as mb from '../../engine/mojbroj.js';
import { AV, UN, OPEN, N, Y, I2, shakeAnim } from '../../theme.js';
import { Btn, Gold, Panel, Kicker } from '../../components/ui.jsx';

const OP_ARIA = { '+': 'plus', '−': 'minus', '×': 'puta', '÷': 'podeljeno', '(': 'otvori zagradu', ')': 'zatvori zagradu' };

export default function MojBroj({ s, act }) {
  const P = s.puzzle.mojBroj;
  const g = s.game.mb;
  const isVal = mb.endsWithValue(g.tok);
  const openN = mb.openBrackets(g.tok);
  const toks = g.tok.map((t) => (t.n != null ? { t: String(P.numbers[t.n]), bg: OPEN.bg, fg: N } : { t: t.o, bg: 'transparent', fg: Y }))
    .concat(Array.from({ length: Math.max(0, openN) }, () => ({ t: ')', bg: 'transparent', fg: 'oklch(0.52 0.1 258)' })));
  const nT = toks.length;
  const fs = nT <= 9 ? 22 : nT <= 13 ? 19 : 16, th = nT <= 9 ? 36 : nT <= 13 ? 32 : 28;
  // The running value of the expression is deliberately hidden: the player has to work it out.
  const msg = g.msg || '';
  const msgC = g.msg ? g.msgC : I2;

  return (
    <div className="col" style={{ gap: 14, animation: 'rise .35s both' }}>
      <Panel style={{ padding: 'clamp(12px,3.4cqw,22px)', display: 'flex', flexDirection: 'column', gap: 'clamp(12px,3cqw,18px)' }}>
        <div className="col" style={{ alignItems: 'center', gap: 8 }}>
          <Kicker>Traženi broj</Kicker>
          <div style={{ display: 'flex', gap: 'clamp(4px,1.2cqw,8px)' }}>
            {String(P.target).split('').map((d, i) => (
              <div key={i} style={{ position: 'relative', width: 'clamp(54px,14cqw,80px)', aspectRatio: '.8', borderRadius: 4, background: 'linear-gradient(180deg,#fff27a,#fcd61e 50%,#f2a628)', boxShadow: 'inset 0 2px 0 oklch(1 0.05 100),inset 0 -3px 0 oklch(0.62 0.14 70),0 0 0 2px oklch(0.18 0.1 270),3px 4px 0 oklch(0.14 0.09 272 / .55)', color: N, display: 'grid', placeItems: 'center', overflow: 'hidden', textShadow: 'none' }}>
                <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(40px,11.4cqw,62px)', lineHeight: 1, animation: 'rollIn .5s cubic-bezier(.3,1.3,.5,1) both', animationDelay: (120 + i * 140) + 'ms' }}>{d}</span>
                <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1.5, background: 'oklch(0.26 0.117 262 / .16)' }} />
              </div>
            ))}
          </div>
        </div>
        <div className="well" style={{ minHeight: 'clamp(84px,17cqw,100px)', padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8, animation: shakeAnim(g.shake) }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', minHeight: 34 }}>
            {!g.tok.length && <span style={{ fontSize: 15, color: I2 }}>Sastavi izraz od brojeva ispod</span>}
            {toks.map((k, i) => <span key={i} style={{ height: th, minWidth: 18, padding: '0 6px', borderRadius: 3, display: 'grid', placeItems: 'center', fontWeight: 800, fontStyle: 'italic', fontSize: fs, background: k.bg, color: k.fg, animation: 'pop .2s cubic-bezier(.3,1.6,.5,1) both', textShadow: k.bg === 'transparent' ? undefined : 'none' }}>{k.t}</span>)}
          </div>
          {msg && <span style={{ fontSize: 14, fontWeight: 800, color: msgC }}>{msg}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 'clamp(5px,1.4cqw,10px)' }}>
          {P.numbers.map((n, i) => {
            const used = g.tok.some((t) => t.n === i);
            const st = used || s.locked ? UN : AV;
            return (
              <button key={i} aria-disabled={used} onClick={() => act('MB_PUSH', { tok: { n: i } })}
                style={{ height: 'clamp(54px,12.4cqw,66px)', border: 'none', borderRadius: 4, padding: 0, fontWeight: 800, fontStyle: 'italic', fontSize: 'clamp(20px,5.8cqw,30px)', background: st.bg, boxShadow: st.sh, color: st.fg, transform: st.tf, opacity: !used && isVal ? 0.55 : 1, textDecoration: used ? 'line-through' : 'none', transition: 'transform .14s, background .14s, opacity .2s' }}>{n}</button>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 'clamp(5px,1.4cqw,10px)' }}>
          {mb.OPS.map((o) => {
            const ok = o === '(' ? !isVal : o === ')' ? isVal && openN > 0 : isVal;
            return <Btn key={o} aria-label={OP_ARIA[o]} onClick={() => act('MB_PUSH', { tok: { o } })} style={{ height: 'clamp(48px,10.6cqw,54px)', padding: 0, fontSize: 'clamp(20px,5.4cqw,26px)', fontStyle: 'italic', color: Y, opacity: ok ? 1 : 0.4 }}>{o}</Btn>;
          })}
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: 10 }}>
        <Btn onClick={() => act('MB_BACK')}>← Obriši</Btn>
        <Btn onClick={() => act('MB_CLEAR')}>Poništi</Btn>
        <Gold onClick={() => act('MB_SUBMIT')}>Potvrdi</Gold>
      </div>
      <span style={{ textAlign: 'center', fontSize: 13, lineHeight: 1.45, color: I2, textWrap: 'pretty' }}>Množenje i deljenje se računaju pre sabiranja i oduzimanja. Otvorene zagrade se same zatvaraju.</span>
    </div>
  );
}
