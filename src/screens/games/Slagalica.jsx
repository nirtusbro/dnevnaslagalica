import React from 'react';
import { AV, SEL, UN, YS, WL, I2, Y, shakeAnim } from '../../theme.js';
import { POINTS_PER_LETTER } from '../../engine/slagalica.js';
import { Btn, Gold, Panel } from '../../components/ui.jsx';

/** Tile font size; LJ, NJ and DŽ are one tile with two characters, so they get a smaller face. */
const tileFont = (l, big) => (l && l.length > 1 ? (big ? 'clamp(16px,4.8cqw,30px)' : 'clamp(13px,3.6cqw,22px)') : (big ? 'clamp(24px,7.2cqw,44px)' : 'clamp(18px,5.2cqw,32px)'));

export default function Slagalica({ s, act, vp }) {
  const L = s.puzzle.slagalica.letters;
  const g = s.game.sl;
  const tiles = g.pick.map((i) => L[i]);
  const n = tiles.length;
  const msg = g.msg || (n ? 'Dodirni slovo u reči da ga skloniš' : 'Dodiruj slova i složi najdužu reč');
  const msgC = g.msg ? g.msgC : I2;
  const count = n ? n + ' slova · ' + n * POINTS_PER_LETTER + ' p + bonus' : '';

  return (
    <div className="col" style={{ gap: 14, animation: 'rise .35s both' }}>
      <Panel style={{ padding: 'clamp(12px,3.4cqw,22px)', display: 'flex', flexDirection: 'column', gap: 'clamp(12px,3cqw,20px)' }}>
        <div className="col" style={{ gap: 8, animation: shakeAnim(g.shake) }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gap: 'clamp(3px,0.8cqw,6px)' }}>
            {Array.from({ length: 12 }, (_, k) => {
              const l = tiles[k];
              const st = l ? YS : WL;
              return (
                <button key={k} className="cell-btn" aria-label={l ? 'Ukloni slovo ' + l : 'Prazno mesto'} onClick={() => l && act('SL_REMOVE', { k })}
                  style={{ height: 'clamp(38px,9.4cqw,58px)', background: st.bg, boxShadow: st.sh, fontWeight: 800, fontStyle: 'italic', fontSize: tileFont(l, false), color: 'oklch(0.26 0.117 262)', transition: 'background .15s, box-shadow .15s', textShadow: 'none' }}>
                  {l && <span style={{ animation: 'pop .22s cubic-bezier(.3,1.6,.5,1) both' }}>{l}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: msgC }}>{msg}</span>
            <span className="mono" style={{ fontSize: 14, fontWeight: 800, fontStyle: 'italic', color: I2, whiteSpace: 'nowrap' }}>{count}</span>
          </div>
        </div>
        <div className="hr" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 'clamp(6px,1.8cqw,12px)' }}>
          {L.map((l, i) => {
            const k = g.pick.indexOf(i);
            const st = s.locked && k < 0 ? UN : k >= 0 ? SEL : AV;
            return (
              <button key={i} aria-pressed={k >= 0} aria-label={'Slovo ' + l} onClick={() => act('SL_ADD', { i })}
                style={{ position: 'relative', aspectRatio: '1 / 1.05', border: 'none', borderRadius: 4, padding: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontStyle: 'italic', fontSize: tileFont(l, true), letterSpacing: l.length > 1 ? '-0.03em' : 0, background: st.bg, boxShadow: st.sh, color: st.fg, transform: st.tf, transition: 'transform .14s cubic-bezier(.3,1.5,.5,1), background .14s, box-shadow .14s' }}>
                {l}
                <span style={{ position: 'absolute', right: 'clamp(4px,1cqw,8px)', top: 'clamp(3px,0.8cqw,6px)', fontSize: 'clamp(10px,2.4cqw,13px)', fontWeight: 800, color: Y }}>{k >= 0 ? k + 1 : ''}</span>
              </button>
            );
          })}
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: 10 }}>
        <Btn onClick={() => act('SL_BACK')}>← Obriši</Btn>
        <Btn onClick={() => act('SL_CLEAR')}>Poništi</Btn>
        <Gold onClick={() => act('SL_SUBMIT')}>Potvrdi</Gold>
      </div>
      {!vp.narrow && <span style={{ textAlign: 'center', fontSize: 13, color: I2 }}>Možeš i da kucaš · Enter potvrđuje · Backspace briše · LJ, NJ i DŽ biraj klikom</span>}
    </div>
  );
}
