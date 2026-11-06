import React from 'react';
import { SYMBOLS, MAX_ATTEMPTS } from '../../engine/skocko.js';
import { WL, DASH, Y, R, I2, W, shakeAnim } from '../../theme.js';
import { Btn, Gold, Panel, Sym } from '../../components/ui.jsx';

export default function Skocko({ s, act }) {
  const g = s.game.sk;
  const secret = s.puzzle.skocko.secret;
  const msg = g.msg || (g.cur.length ? 'Dodirni znak u redu da ga skloniš' : '');
  const msgC = g.msg ? g.msgC : I2;

  return (
    <div className="col" style={{ gap: 12, animation: 'rise .35s both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, fontWeight: 800, fontStyle: 'italic', color: I2 }}>
        <span style={{ color: W, letterSpacing: '.04em', textTransform: 'uppercase' }}>{g.done ? 'Kraj igre' : 'Pokušaj ' + (g.rows.length + 1) + ' od ' + MAX_ATTEMPTS}</span>
        <span style={{ display: 'flex', gap: 14 }}>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: R }} />na mestu</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: Y }} />nije na mestu</span>
        </span>
      </div>
      <Panel style={{ padding: 'clamp(8px,2.4cqw,14px)', display: 'flex', flexDirection: 'column', gap: 'clamp(4px,1cqw,6px)', animation: shakeAnim(g.shake) }}>
        {Array.from({ length: MAX_ATTEMPTS }, (_, r) => {
          const done = g.rows[r];
          const cur = !g.done && r === g.rows.length;
          const row = done ? done.g : cur ? g.cur : [];
          return (
            <div key={r} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0,1fr) auto', gap: 'clamp(6px,2cqw,14px)', alignItems: 'center', padding: 'clamp(4px,1cqw,6px) clamp(6px,1.4cqw,10px)', borderRadius: 5, background: cur ? 'oklch(0.42 0.2 262 / .5)' : 'transparent', boxShadow: cur ? 'inset 0 0 0 1.5px ' + Y : 'none', opacity: done || cur ? 1 : 0.5, transition: 'background .3s, box-shadow .3s' }}>
              <span style={{ fontWeight: 800, fontSize: 13, textAlign: 'center', color: cur ? Y : done ? I2 : 'oklch(0.52 0.09 258)' }}>{r + 1}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 'clamp(4px,1.2cqw,8px)' }}>
                {[0, 1, 2, 3].map((k) => {
                  const has = row[k] != null;
                  const st = has ? { bg: WL.bg, sh: cur ? 'inset 0 0 0 1.5px oklch(0.87 0.17 92 / .55)' : WL.sh } : { bg: 'transparent', sh: cur ? 'inset 0 0 0 1.5px oklch(0.62 0.12 245)' : DASH };
                  return (
                    <button key={k} className="cell-btn" aria-label={has ? SYMBOLS[row[k]].name : 'prazno'} onClick={() => cur && has && act('SK_REMOVE', { k })}
                      style={{ height: 'clamp(44px,10.4cqw,56px)', background: st.bg, boxShadow: st.sh, cursor: cur && has ? 'pointer' : 'default' }}>
                      {has && <Sym i={row[k]} size="clamp(24px,6.4cqw,32px)" anim="pop .25s cubic-bezier(.3,1.6,.5,1) both" />}
                    </button>
                  );
                })}
              </div>
              <div className="well" style={{ borderRadius: 3, padding: 'clamp(6px,1.3cqw,8px)', display: 'grid', gridTemplateColumns: 'repeat(2,clamp(13px,3.4cqw,16px))', gap: 'clamp(4px,1cqw,6px)' }}>
                {[0, 1, 2, 3].map((k) => {
                  if (!done) return <span key={k} style={{ aspectRatio: '1', borderRadius: '50%', boxShadow: DASH }} />;
                  const c = k < done.ex ? R : k < done.ex + done.near ? Y : 'transparent';
                  return <span key={k} style={{ aspectRatio: '1', borderRadius: '50%', background: c, boxShadow: c === 'transparent' ? DASH : 'none', animation: 'pop .3s ' + (k * 0.1) + 's both' }} />;
                })}
              </div>
            </div>
          );
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '16px minmax(0,1fr) auto', gap: 'clamp(6px,2cqw,14px)', alignItems: 'center', padding: 'clamp(8px,2cqw,12px) clamp(6px,1.4cqw,10px) 4px', marginTop: 4, borderTop: '2px solid ' + Y }}>
          <span />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 'clamp(4px,1.2cqw,8px)' }}>
            {secret.map((x, k) => (
              <div key={k} className="well" style={{ height: 'clamp(40px,9cqw,50px)', display: 'grid', placeItems: 'center', fontWeight: 800, fontStyle: 'italic', fontSize: 20, color: Y }}>
                {g.done ? <Sym i={x} size="clamp(22px,6cqw,30px)" anim="flipIn .45s both" delay={k * 140} /> : <span>?</span>}
              </div>
            ))}
          </div>
          <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: Y, width: 'clamp(40px,9cqw,46px)', textAlign: 'center' }}>Tajna</span>
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 'clamp(5px,1.4cqw,10px)' }}>
        {SYMBOLS.map((y, i) => (
          <Btn key={i} aria-label={y.name} onClick={() => act('SK_ADD', { i })} style={{ height: 'clamp(54px,12.6cqw,64px)', padding: 0, display: 'grid', placeItems: 'center', opacity: g.cur.length >= 4 || g.done ? 0.45 : 1 }}>
            <Sym i={i} size="clamp(26px,7cqw,34px)" />
          </Btn>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10 }}>
        <Btn onClick={() => act('SK_DEL')}>← Obriši</Btn>
        <Gold onClick={() => act('SK_SUBMIT')}>Potvrdi</Gold>
      </div>
      <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, minHeight: 18, color: msgC }}>{msg}</span>
    </div>
  );
}
