import React, { useRef, useEffect } from 'react';
import { finalWorth, allOpen } from '../../engine/asocijacije.js';
import { AV, OPEN, SOLV, YS, WL, N, Y, W, I2, shakeAnim } from '../../theme.js';
import { Panel, Kicker } from '../../components/ui.jsx';
import { aBlocked } from '../../state.js';

// Sub-components live at module level so React keeps their DOM between renders
// (animations, focus and click targets would otherwise reset on every state change).

/**
 * Phones (iOS in particular) only open the keyboard for a focus() made inside the tap itself, but the
 * answer box appears one render later. So the tap focuses a hidden input right away (keyboard opens),
 * and the answer box takes the focus over when it mounts.
 */
function primeKeyboard() {
  let el = document.getElementById('kb-proxy');
  if (!el) {
    el = document.createElement('input');
    el.id = 'kb-proxy'; el.tabIndex = -1; el.autocomplete = 'off'; el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;pointer-events:none';
    document.body.appendChild(el);
  }
  try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}
function releaseKeyboard() {
  const el = document.getElementById('kb-proxy');
  if (el && document.activeElement === el) el.blur();
}

/** The answer box, rendered inside the field being guessed. Enter or ✓ submits, Escape cancels. */
const Inline = ({ value, onChange, onSubmit, onCancel, label }) => {
  const ref = useRef(null);
  useEffect(() => { try { ref.current && ref.current.focus(); } catch (e) { /* ignore */ } }, []);
  return (
    <div style={{ display: 'flex', gap: 6, width: '100%', minWidth: 0, flex: 1, alignItems: 'stretch', padding: 4, boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
      <input ref={ref} className="input inline" value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit(); } else if (e.key === 'Escape') onCancel(); }}
        placeholder="Rešenje" aria-label={label} autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done" />
      <button className="inline-ok" onClick={onSubmit} aria-label="Potvrdi" style={{ background: YS.bg, boxShadow: YS.sh, color: N }}>✓</button>
    </div>
  );
};

const FieldBtn = ({ x, wide }) => (
  <button onClick={x.onClick} style={{ height: wide ? 50 : undefined, minHeight: wide ? undefined : 'clamp(40px,6.6dvh,48px)', maxHeight: wide ? undefined : 80, flex: wide ? undefined : '1 1 0', border: 'none', borderRadius: 4, padding: wide ? '0 8px' : '0 14px', display: 'flex', alignItems: 'center', justifyContent: wide ? 'center' : undefined, gap: 12, fontWeight: x.fw, fontSize: wide ? 16 : 17, letterSpacing: x.ls, background: x.bg, boxShadow: x.sh, color: x.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'background .25s, color .25s', animation: x.anim, textShadow: x.open ? 'none' : undefined }}>
    {wide ? x.text : <><span style={{ fontSize: 12, fontWeight: 800, opacity: .6, width: 22, textAlign: 'left', letterSpacing: 0 }}>{x.code}</span><span style={{ flex: 1, textAlign: 'center', marginRight: 34 }}>{x.word}</span></>}
  </button>
);

/** Column solution slot: a button that opens the answer box, or the answer box itself while typing. */
const SolBtn = ({ x }) => x.editor ? (
  <div style={{ height: 54, borderRadius: 4, display: 'flex', background: WL.bg, boxShadow: WL.sh + ', 0 0 0 2px ' + Y }}>{x.editor}</div>
) : (
  <button onClick={x.onClick} aria-label={x.sv ? undefined : 'Upiši rešenje kolone ' + x.L} style={{ height: 54, border: 'none', borderRadius: 4, fontWeight: 800, fontStyle: 'italic', fontSize: 18, letterSpacing: '.06em', background: x.bg, boxShadow: x.sh, color: x.fg, transition: 'background .3s, box-shadow .2s', textShadow: x.fg === N ? 'none' : undefined }}>{x.text}</button>
);

const Quad = ({ fields, sol, rev }) => (
  <div className="col" style={{ gap: 7 }}>
    {rev && <SolBtn x={sol} />}
    {(rev ? [...fields].reverse() : fields).map((x) => <FieldBtn key={x.code} x={x} wide />)}
    {!rev && <SolBtn x={sol} />}
  </div>
);

/** Final answer slot; clicking it opens the answer box inside. */
const FinalBox = ({ final, tall, worth }) => {
  const clickable = !!final.onClick && !final.editor;
  // Phone layout has no hint line above the board, so the final's worth is shown in its label.
  const label = tall ? 'Konačno rešenje' : 'Konačno' + (worth != null && clickable ? ' · ' + worth + ' p' : '');
  return (
    <div role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} onClick={clickable ? final.onClick : undefined}
      onKeyDown={(e) => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); final.onClick(); } }}
      aria-label={clickable ? 'Upiši konačno rešenje' + (worth != null ? ', vredi ' + worth + ' poena' : '') : undefined}
      style={{ gridColumn: 'span 2', minHeight: tall ? 72 : 'clamp(46px,7.4dvh,66px)', borderRadius: 5, display: 'flex', flexDirection: tall ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: tall ? 2 : 12, padding: final.editor ? (tall ? '6px 6px 2px' : '2px 2px 2px 12px') : 0, boxSizing: 'border-box', background: final.bg, boxShadow: final.sh, color: final.fg, cursor: clickable ? 'pointer' : 'default', transition: 'background .4s', textShadow: final.fg === N ? 'none' : undefined }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
      {final.editor
        ? <div style={{ display: 'flex', width: tall ? '100%' : undefined, flex: 1, minWidth: 0, minHeight: 44, alignSelf: 'stretch' }}>{final.editor}</div>
        : <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: tall ? 28 : 22, lineHeight: 1, letterSpacing: '.04em' }}>{final.text}</span>}
    </div>
  );
};

/** Narrow layout: one card per column; the active unsolved card opens the answer box on a second tap. */
const Card = ({ L, s, sv, open, active, onClick, editor }) => {
  const x = sv === 1 ? YS : sv === 2 ? OPEN : { bg: 'oklch(0.31 0.143 262)', sh: 'inset 0 0 0 1px oklch(0.45 0.14 258)', fg: W };
  const Tag = editor ? 'div' : 'button';
  return (
    <Tag onClick={editor ? undefined : onClick} aria-label={editor || sv ? undefined : (active ? 'Upiši rešenje kolone ' + L : 'Kolona ' + L)}
      style={{ minHeight: 'clamp(50px,8.4dvh,72px)', border: 'none', borderRadius: 5, padding: 'clamp(5px,1dvh,8px) 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6, textAlign: 'left', background: x.bg, boxShadow: x.sh + (active ? ', 0 0 0 2.5px ' + Y : ''), color: x.fg, transition: 'background .3s, box-shadow .2s', textShadow: sv ? 'none' : undefined, boxSizing: 'border-box' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 13, letterSpacing: '.08em' }}>KOLONA {L}</span>
        <span style={{ display: 'flex', gap: 3 }}>{open.map((o, k) => <span key={k} style={{ width: 7, height: 7, borderRadius: 1, background: o ? (sv ? N : W) : 'transparent', boxShadow: o ? 'none' : 'inset 0 0 0 1.5px ' + (sv ? 'oklch(0.26 0.117 262 / .4)' : 'oklch(0.58 0.12 252)') }} />)}</span>
      </span>
      {editor
        ? <div style={{ display: 'flex', width: '100%', minHeight: 44, margin: '0 -4px' }}>{editor}</div>
        : active && !sv
          // Looks like the answer box it turns into, so it is clear the answer is typed here.
          ? <span className="input inline faux" aria-hidden="true">✎ Upiši rešenje</span>
          : <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 17, letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sv ? s : '?'}</span>}
    </Tag>
  );
};

export default function Asocijacije({ s, act, dispatch, vp }) {
  const P = s.puzzle.asocijacije;
  const A = s.game.a;
  const narrow = vp.narrow;
  const worth = finalWorth(A.open, A.sol);
  const locked = !A.fin && A.tried && !allOpen(A.open);
  const editingCol = (c) => !!A.target && A.target.kind === 'col' && A.target.c === c;
  const editingFinal = !!A.target && A.target.kind === 'final';
  const ring = (c) => (A.act === c || editingCol(c)) && !A.fin;
  // Open the answer box in a column or the final; prime the phone keyboard only when the box will open.
  const canEdit = (t) => !A.fin && !s.locked && !aBlocked(A) && !(t.kind === 'col' && A.sol[t.c]);
  const edit = (t) => {
    if (canEdit(t)) primeKeyboard();
    act('A_EDIT', t);
  };
  // Phone cards: the first tap selects the column (its clues show below); a second tap on the
  // selected, unsolved column opens the answer box.
  const tapCard = (c) => {
    if (A.act === c && !A.sol[c]) edit({ kind: 'col', c });
    else dispatch({ type: 'A_ACT', c });
  };
  // If the box did not open after all, do not leave the keyboard up for the hidden input.
  useEffect(() => { if (!A.target) releaseKeyboard(); }, [A.target, A.shake]);
  const editor = (label) => (
    <Inline value={A.input} label={label} onChange={(v) => dispatch({ type: 'A_INPUT', value: v })} onSubmit={() => act('A_GUESS')} onCancel={() => dispatch({ type: 'A_CANCEL' })} />
  );

  const field = (c, k) => {
    const op = A.open[c][k]; const sv = A.sol[c];
    const x = op ? (sv === 1 ? SOLV : OPEN) : AV;
    const key = c + '-' + k;
    return { text: op ? P.cols[c].f[k] : P.cols[c].L + (k + 1), word: op ? P.cols[c].f[k] : '', code: P.cols[c].L + (k + 1), fw: op ? 800 : 900, ls: op ? '.01em' : '.1em', bg: x.bg, sh: x.sh, fg: x.fg, anim: op && A.newKey === key ? 'flipIn .4s both' : 'none', open: !!op, onClick: () => act('A_OPEN', { c, k }) };
  };
  const colSol = (c) => {
    const sv = A.sol[c];
    const x = sv === 1 ? YS : sv === 2 ? OPEN : { bg: WL.bg, sh: WL.sh, fg: locked ? 'oklch(0.5 0.09 260)' : I2 };
    return { L: P.cols[c].L, sv, text: sv ? P.cols[c].s : 'KOLONA ' + P.cols[c].L, bg: x.bg, fg: x.fg, sh: x.sh + (ring(c) ? ', 0 0 0 2px ' + Y : ''), editor: editingCol(c) ? editor('Rešenje kolone ' + P.cols[c].L) : null, onClick: () => edit({ kind: 'col', c }) };
  };
  const final = A.fin === 1 ? { ...YS, text: P.final.s } : A.fin === 2 ? { ...OPEN, text: P.final.s }
    : { bg: WL.bg, sh: 'inset 0 0 0 2px oklch(0.87 0.17 92 / ' + (locked ? '.35' : '.8') + ')', fg: Y, text: '?', editor: editingFinal ? editor('Konačno rešenje') : null, onClick: () => edit({ kind: 'final' }) };
  const quad = (c, rev) => <Quad fields={[0, 1, 2, 3].map((k) => field(c, k))} sol={colSol(c)} rev={rev} />;
  const card = (c) => (
    <Card L={P.cols[c].L} s={P.cols[c].s} sv={A.sol[c]} open={A.open[c]} active={ring(c)} editor={editingCol(c) ? editor('Rešenje kolone ' + P.cols[c].L) : null}
      onClick={() => tapCard(c)} />
  );
  const nOpenAct = A.open[A.act].filter(Boolean).length;
  const hint = locked ? 'Otvori novo polje pre sledećeg pokušaja'
    : A.target ? 'Upiši rešenje i pritisni Enter'
      : narrow ? 'Rešenje upisuješ u samu kolonu ili u konačno' : 'Klikni na kolonu ili na konačno da upišeš rešenje';

  return (
    <div className="col" style={{ gap: narrow ? 10 : 12, flex: narrow ? 1 : undefined, animation: 'rise .35s both' }}>
      {!narrow && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, fontWeight: 800, fontStyle: 'italic', color: I2 }}>
          <span>Otvori polje, pa upiši rešenje u kolonu ili u konačno</span>
          <span style={{ whiteSpace: 'nowrap' }}>Konačno vredi <b style={{ color: Y, fontSize: 15 }}>{worth} p</b></span>
        </div>
      )}
      {!narrow && (
        <Panel style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', columnGap: 18, rowGap: 12, animation: shakeAnim(A.shake) }}>
          {quad(0)}{quad(1)}
          <FinalBox final={final} tall />
          {quad(2, true)}{quad(3, true)}
        </Panel>
      )}
      {narrow && (
        <>
          <Panel style={{ padding: 10, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, animation: shakeAnim(A.shake) }}>
            {card(0)}{card(1)}
            <FinalBox final={final} worth={worth} />
            {card(2)}{card(3)}
          </Panel>
          <Panel style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 'clamp(6px,1.2dvh,8px)', flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 34, padding: '0 2px' }}>
              <Kicker y style={{ whiteSpace: 'nowrap' }}>Kolona {P.cols[A.act].L}</Kicker>
              {A.sol[A.act]
                ? <span style={{ fontSize: 13, fontWeight: 800, fontStyle: 'italic', color: I2 }}>Rešeno: {P.cols[A.act].s}</span>
                : editingCol(A.act)
                  ? <span style={{ fontSize: 13, fontWeight: 800, fontStyle: 'italic', color: I2 }}>{nOpenAct} / 4 otvoreno</span>
                  : <button className="btn-ghost" onClick={() => edit({ kind: 'col', c: A.act })} disabled={A.fin || s.locked} style={{ height: 34, whiteSpace: 'nowrap' }}>Pogodi kolonu · {nOpenAct}/4</button>}
            </div>
            {[0, 1, 2, 3].map((k) => <FieldBtn key={k} x={field(A.act, k)} />)}
          </Panel>
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: A.msg ? A.msgC : I2 }} aria-live="polite">{A.msg || hint}</span>
        <button className="btn-ghost" onClick={() => act('A_GIVEUP')} style={narrow ? { height: 40 } : undefined}>Odustani</button>
      </div>
    </div>
  );
}
