import React, { useRef } from 'react';
import { finalWorth } from '../../engine/asocijacije.js';
import { AV, OPEN, SOLV, YS, WL, N, Y, W, I2, shakeAnim } from '../../theme.js';
import { Btn, Gold, Panel, Kicker } from '../../components/ui.jsx';

// Sub-components live at module level so React keeps their DOM between renders
// (animations, focus and click targets would otherwise reset on every state change).

const FieldBtn = ({ x, wide }) => (
  <button onClick={x.onClick} style={{ height: wide ? 50 : 48, border: 'none', borderRadius: 4, padding: wide ? '0 8px' : '0 14px', display: 'flex', alignItems: 'center', justifyContent: wide ? 'center' : undefined, gap: 12, fontWeight: x.fw, fontSize: wide ? 16 : 17, letterSpacing: x.ls, background: x.bg, boxShadow: x.sh, color: x.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'background .25s, color .25s', animation: x.anim, textShadow: x.open ? 'none' : undefined }}>
    {wide ? x.text : <><span style={{ fontSize: 12, fontWeight: 800, opacity: .6, width: 22, textAlign: 'left', letterSpacing: 0 }}>{x.code}</span><span style={{ flex: 1, textAlign: 'center', marginRight: 34 }}>{x.word}</span></>}
  </button>
);

const SolBtn = ({ x }) => (
  <button onClick={x.onClick} style={{ height: 54, border: 'none', borderRadius: 4, fontWeight: 800, fontStyle: 'italic', fontSize: 18, letterSpacing: '.06em', background: x.bg, boxShadow: x.sh, color: x.fg, transition: 'background .3s, box-shadow .2s', textShadow: x.fg === N ? 'none' : undefined }}>{x.text}</button>
);

const Quad = ({ fields, sol, rev }) => (
  <div className="col" style={{ gap: 7 }}>
    {rev && <SolBtn x={sol} />}
    {(rev ? [...fields].reverse() : fields).map((x) => <FieldBtn key={x.code} x={x} wide />)}
    {!rev && <SolBtn x={sol} />}
  </div>
);

const FinalBox = ({ final, tall }) => (
  <div style={{ gridColumn: 'span 2', height: tall ? 72 : 54, borderRadius: 5, display: 'flex', flexDirection: tall ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: tall ? 2 : 12, background: final.bg, boxShadow: final.sh, color: final.fg, transition: 'background .4s', textShadow: final.fg === N ? 'none' : undefined }}>
    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>{tall ? 'Konačno rešenje' : 'Konačno'}</span>
    <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: tall ? 28 : 22, lineHeight: 1, letterSpacing: '.04em' }}>{final.text}</span>
  </div>
);

const Card = ({ L, s, sv, open, active, onClick }) => {
  const x = sv === 1 ? YS : sv === 2 ? OPEN : { bg: 'oklch(0.31 0.143 262)', sh: 'inset 0 0 0 1px oklch(0.45 0.14 258)', fg: W };
  return (
    <button onClick={onClick} style={{ minHeight: 58, border: 'none', borderRadius: 5, padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6, textAlign: 'left', background: x.bg, boxShadow: x.sh + (active ? ', 0 0 0 2.5px ' + Y : ''), color: x.fg, transition: 'background .3s, box-shadow .2s', textShadow: sv ? 'none' : undefined }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 13, letterSpacing: '.08em' }}>KOLONA {L}</span>
        <span style={{ display: 'flex', gap: 3 }}>{open.map((o, k) => <span key={k} style={{ width: 7, height: 7, borderRadius: 1, background: o ? (sv ? N : W) : 'transparent', boxShadow: o ? 'none' : 'inset 0 0 0 1.5px ' + (sv ? 'oklch(0.26 0.117 262 / .4)' : 'oklch(0.58 0.12 252)') }} />)}</span>
      </span>
      <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 17, letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sv ? s : '?'}</span>
    </button>
  );
};

export default function Asocijacije({ s, act, dispatch, vp }) {
  const P = s.puzzle.asocijacije;
  const A = s.game.a;
  const narrow = vp.narrow;
  const inputRef = useRef(null);
  const worth = finalWorth(A.open, A.sol);
  const ring = (c) => A.act === c && !A.fin;

  const field = (c, k) => {
    const op = A.open[c][k]; const sv = A.sol[c];
    const x = op ? (sv === 1 ? SOLV : OPEN) : AV;
    const key = c + '-' + k;
    return { text: op ? P.cols[c].f[k] : P.cols[c].L + (k + 1), word: op ? P.cols[c].f[k] : '', code: P.cols[c].L + (k + 1), fw: op ? 800 : 900, ls: op ? '.01em' : '.1em', bg: x.bg, sh: x.sh, fg: x.fg, anim: op && A.newKey === key ? 'flipIn .4s both' : 'none', open: !!op, onClick: () => act('A_OPEN', { c, k }) };
  };
  const colSol = (c) => {
    const sv = A.sol[c];
    const x = sv === 1 ? YS : sv === 2 ? OPEN : { bg: WL.bg, sh: WL.sh, fg: I2 };
    return { text: sv ? P.cols[c].s : 'KOLONA ' + P.cols[c].L, bg: x.bg, fg: x.fg, sh: x.sh + (ring(c) ? ', 0 0 0 2px ' + Y : ''), onClick: () => { dispatch({ type: 'A_ACT', c }); try { inputRef.current && inputRef.current.focus(); } catch (e) { /* ignore */ } } };
  };
  const final = A.fin === 1 ? { ...YS, text: P.final.s } : A.fin === 2 ? { ...OPEN, text: P.final.s } : { bg: WL.bg, sh: 'inset 0 0 0 2px oklch(0.87 0.17 92 / .8)', fg: Y, text: '?' };
  const quad = (c, rev) => <Quad fields={[0, 1, 2, 3].map((k) => field(c, k))} sol={colSol(c)} rev={rev} />;
  const card = (c) => <Card L={P.cols[c].L} s={P.cols[c].s} sv={A.sol[c]} open={A.open[c]} active={ring(c)} onClick={() => dispatch({ type: 'A_ACT', c })} />;
  const nOpenAct = A.open[A.act].filter(Boolean).length;

  return (
    <div className="col" style={{ gap: 12, animation: 'rise .35s both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, fontWeight: 800, fontStyle: 'italic', color: I2 }}>
        <span>{narrow ? 'Izaberi kolonu, otvaraj polja' : 'Otvori polje, pa pogodi kolonu ili konačno rešenje'}</span>
        <span style={{ whiteSpace: 'nowrap' }}>Konačno vredi <b style={{ color: Y, fontSize: 15 }}>{worth} p</b></span>
      </div>
      {!narrow && (
        <Panel style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', columnGap: 18, rowGap: 12 }}>
          {quad(0)}{quad(1)}
          <FinalBox final={final} tall />
          {quad(2, true)}{quad(3, true)}
        </Panel>
      )}
      {narrow && (
        <>
          <Panel style={{ padding: 10, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            {card(0)}{card(1)}
            <FinalBox final={final} />
            {card(2)}{card(3)}
          </Panel>
          <Panel style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 2px 2px' }}>
              <Kicker y>Tragovi · kolona {P.cols[A.act].L}</Kicker>
              <span style={{ fontSize: 13, fontWeight: 800, fontStyle: 'italic', color: I2 }}>{A.sol[A.act] ? 'Rešeno: ' + P.cols[A.act].s : nOpenAct + ' / 4 otvoreno'}</span>
            </div>
            {[0, 1, 2, 3].map((k) => <FieldBtn key={k} x={field(A.act, k)} />)}
          </Panel>
        </>
      )}
      <div className="col" style={{ gap: 8, animation: shakeAnim(A.shake) }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input ref={inputRef} className="input" value={A.input} onChange={(e) => dispatch({ type: 'A_INPUT', value: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') act('A_GUESS'); }}
            placeholder="Upiši rešenje…" aria-label="Rešenje kolone ili konačno rešenje" autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done" disabled={!!A.fin || s.locked} />
          <Gold onClick={() => act('A_GUESS')} style={{ fontSize: 17 }}>Potvrdi</Gold>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: A.msg ? A.msgC : I2 }} aria-live="polite">{A.msg || 'Kolona: 3 p + neotvorena polja'}</span>
          <button className="btn-ghost" onClick={() => act('A_GIVEUP')}>Odustani</button>
        </div>
      </div>
    </div>
  );
}
