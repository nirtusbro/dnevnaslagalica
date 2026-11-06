import React from 'react';
import { GAMES, GRADES, totalOf, maxesOf, maxTotalOf } from '../engine/rules.js';
import { pad3, longDate, dateOfDay, secondsToMidnight, hms, dani } from '../engine/day.js';
import { summarize } from '../engine/stats.js';

const EDGE = 'oklch(0.17 0.1 270)';
const RIM = '0 0 0 2px ' + EDGE + ',inset 0 0 0 2px ' + EDGE;
const GOLD = '#f7c62a';
const TILE_BG = 'radial-gradient(130% 100% at 30% 10%,#5a80f6,#2d55dc 55%,#2343c0)';
const TILE_SH = 'inset 0 0 0 3px #d0dcfa,inset 0 0 0 5px oklch(0.45 0.17 266),inset 0 7px 9px oklch(1 0 0 / .28),0 0 0 2px ' + EDGE + ',4px 5px 0 oklch(0.1 0.07 272 / .6)';
const STROKE = { WebkitTextStroke: '2px oklch(0.12 0.06 270)', paintOrder: 'stroke fill', textShadow: '3px 3px 0 oklch(0.1 0.06 272)' };
const STREAK_BG = 'linear-gradient(180deg,#dc2a2c,#b41417 55%,#8a0c10)';
const STREAK_SH = 'inset 0 0 0 2px #e8605a,0 0 0 2px ' + EDGE + ',3px 4px 0 oklch(0.1 0.07 272 / .6)';

/** Everything the two layouts share: labels, pips, spotlight content. */
function useHomeModel(s, now) {
  const total = totalOf(s.scores);
  const started = s.scores.some((x) => x != null);
  const nx = s.scores.findIndex((x) => x == null);
  const cur = nx < 0 ? 0 : nx;
  const allDone = s.done || nx < 0;
  const st = summarize(s.history, s.day);
  const countdown = hms(secondsToMidnight(new Date(now)));
  const playedCount = s.scores.filter((x) => x != null).length;
  const maxes = maxesOf(s.puzzle);

  const pips = GAMES.map((g, i) => {
    const done = s.scores[i] != null;
    const isNext = !s.done && i === cur;
    return {
      i,
      bg: done ? 'linear-gradient(180deg,#fff27a,#fcd61e 50%,#f2a628)' : 'oklch(0.3 0.14 266)',
      rim: isNext ? '0 0 0 2px ' + EDGE + ',0 0 0 4px ' + GOLD : '0 0 0 2px ' + EDGE,
      title: done ? g.name + ' · ' + s.scores[i] + ' / ' + maxes[i] : g.name,
    };
  });

  return {
    pips,
    streak: st.streak,
    streakWord: dani(st.streak),
    dayNo: pad3(s.day),
    dateLabel: longDate(dateOfDay(s.day)),
    btn: allDone ? 'Rezultat' : started ? 'Nastavi' : 'Igraj',
    sub: allDone ? 'Sledeći izazov za ' + countdown : started ? 'Do sada ' + total + ' poena · ostalo još ' + (5 - playedCount) : '',
    spotNo: allDone ? '5' : String(cur + 1),
    spotLabel: allDone ? 'Izazov završen' : started ? 'Sledeća igra' : 'Prva igra',
    spotName: allDone ? total + ' / ' + maxTotalOf(s.puzzle) + ' poena' : GAMES[cur].name,
  };
}

/** Home — "Spotlight" layout: progress pips plus the next game in a single card. */
export default function Home({ s, nav, now, vp }) {
  const m = useHomeModel(s, now);
  if (vp && vp.narrow) return <HomePhone m={m} nav={nav} />;
  return <HomeWide m={m} nav={nav} />;
}

function Pips({ pips, height, gap }) {
  return (
    <div style={{ display: 'flex', gap }} role="list" aria-label="Napredak po igrama">
      {pips.map((p) => (
        <span key={p.i} role="listitem" title={p.title} style={{ flex: 1, height, borderRadius: 99, background: p.bg, boxShadow: p.rim }} />
      ))}
    </div>
  );
}

function HomeWide({ m, nav }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'clamp(16px,2cqw,26px)', padding: 0, position: 'relative' }}>
      <div className="col" style={{ width: '100%', maxWidth: 720, animation: 'rise .4s both' }}>
        <div style={{ display: 'flex', padding: '0 clamp(14px,3cqw,40px)', position: 'relative', zIndex: 1, marginBottom: -2 }}>
          <span className="tab" style={{ height: 'clamp(32px,3.6cqw,44px)', padding: '0 clamp(14px,2.2cqw,28px)', gap: 10, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(14px,1.9cqw,24px)', textTransform: 'uppercase', color: 'oklch(0.16 0.09 270)' }}>
            <span>Izazov #{m.dayNo}</span>
            <span style={{ fontStyle: 'normal', fontWeight: 800, color: 'oklch(0.3 0.17 266)' }}>{m.dateLabel}</span>
          </span>
        </div>
        <div className="panel col" style={{ gap: 'clamp(16px,2cqw,24px)', padding: 'clamp(18px,2.4cqw,32px) clamp(16px,3cqw,40px) clamp(18px,2.4cqw,30px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(26px,4cqw,52px)', lineHeight: 1, textTransform: 'uppercase', letterSpacing: '-.01em', WebkitTextStroke: '2.5px oklch(0.12 0.06 270)', paintOrder: 'stroke fill', textShadow: '3px 4px 0 oklch(0.1 0.06 272)' }}>Današnji izazov</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 'clamp(15px,1.8cqw,22px)', textTransform: 'uppercase', textShadow: '2px 2px 0 oklch(0.1 0.06 272)' }}>
              <span style={{ minWidth: 'clamp(36px,4cqw,48px)', height: 'clamp(34px,3.8cqw,46px)', padding: '0 6px', display: 'grid', placeItems: 'center', borderRadius: 4, background: STREAK_BG, boxShadow: STREAK_SH, fontSize: 'clamp(20px,2.6cqw,32px)', lineHeight: 1, WebkitTextStroke: '1.5px oklch(0.12 0.06 270)', paintOrder: 'stroke fill' }}>{m.streak}</span>
              <span>{m.streakWord}</span>
            </div>
          </div>
          <div className="col" style={{ gap: 'clamp(14px,1.8cqw,20px)' }}>
            <Pips pips={m.pips} height="clamp(10px,1.2cqw,14px)" gap="clamp(6px,1cqw,12px)" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(14px,2cqw,24px)', padding: 'clamp(14px,2cqw,24px)', borderRadius: 8, background: 'linear-gradient(180deg,#1b278e,#172184)', border: '3px solid #c9d4f6', boxShadow: RIM }}>
              <span style={{ width: 'clamp(64px,8cqw,96px)', height: 'clamp(70px,8.8cqw,106px)', flexShrink: 0, fontSize: 'clamp(40px,5.6cqw,68px)', borderRadius: 7, background: TILE_BG, boxShadow: TILE_SH, display: 'grid', placeItems: 'center', fontWeight: 900, fontStyle: 'italic', lineHeight: 1, ...STROKE }}>{m.spotNo}</span>
              <div className="col" style={{ gap: 6, minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 'clamp(12px,1.4cqw,16px)', letterSpacing: '.14em', textTransform: 'uppercase', color: GOLD, textShadow: '2px 2px 0 oklch(0.1 0.06 272)' }}>{m.spotLabel}</span>
                <span style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(26px,4cqw,50px)', lineHeight: 1, textTransform: 'uppercase', overflowWrap: 'anywhere', ...STROKE }}>{m.spotName}</span>
              </div>
            </div>
          </div>
          <div className="col" style={{ gap: 10, padding: '0 clamp(0px,4cqw,60px)' }}>
            <button className="btn-cta" onClick={nav.primary}><span>{m.btn}</span></button>
            {m.sub && <span style={{ fontSize: 'clamp(13px,1.5cqw,16px)', fontWeight: 800, color: 'oklch(0.95 0.03 248)', textAlign: 'center', textShadow: '2px 2px 0 oklch(0.1 0.06 272)' }}>{m.sub}</span>}
          </div>
        </div>
      </div>
      <button className="link-btn" onClick={nav.archive} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 0, boxShadow: 'none', padding: '8px 14px', fontFamily: "'Archivo', Arial, sans-serif", fontWeight: 800, fontSize: 'clamp(14px,1.6cqw,18px)', textTransform: 'uppercase', letterSpacing: '.06em', textShadow: '2px 2px 0 oklch(0.1 0.06 272)', textDecoration: 'underline', textUnderlineOffset: 5, textDecorationThickness: 2, animation: 'fadeIn .5s .4s both' }}>Arhiva prethodnih izazova</button>
      <button className="reset-link" onClick={() => { if (window.confirm('Obrisati sav sačuvani napredak i statistiku?')) nav.reset(); }}>Obriši napredak</button>
    </div>
  );
}

/**
 * Phone layout (viewport narrower than 640px): the global header is hidden, so this screen
 * carries its own top row (day chip + help/stats buttons), a full-width logo and the card,
 * spread evenly over the viewport height with the archive link pinned at the bottom.
 */
function HomePhone({ m, nav }) {
  return (
    <div className="home-phone">
      <div className="home-phone-top">
        <span className="day-chip">Izazov #{m.dayNo}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-big ibtn ibtn-fixed" onClick={nav.how} aria-label="Kako se igra">?</button>
          <button className="btn btn-big ibtn ibtn-fixed ibtn-bars" onClick={nav.stats} aria-label="Statistika">
            <span style={{ height: 7 }} /><span style={{ height: 12 }} /><span style={{ height: 17 }} /><span style={{ height: 22 }} />
          </button>
        </div>
      </div>
      <div className="home-phone-body">
        <button className="logo logo-phone" onClick={nav.home} aria-label="Dnevna Slagalica — početna">
          <span className="logo-top">DNEVNA</span>
          <span className="logo-tiles">{'SLAGALICA'.split('').map((l, i) => <span key={i} className="tile">{l}</span>)}</span>
        </button>
        <div className="panel col home-phone-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div className="col" style={{ gap: 5, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(20px,6.4cqw,28px)', lineHeight: 1, textTransform: 'uppercase', letterSpacing: '-.01em', whiteSpace: 'nowrap', ...STROKE }}>Današnji izazov</h1>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'oklch(0.9 0.05 248)', textShadow: '1px 1px 0 oklch(0.1 0.06 272)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.dateLabel}</span>
            </div>
            <div className="col" style={{ flexShrink: 0, alignItems: 'center', gap: 3 }}>
              <span style={{ minWidth: 40, height: 38, padding: '0 6px', display: 'grid', placeItems: 'center', borderRadius: 4, background: STREAK_BG, boxShadow: STREAK_SH, fontWeight: 900, fontSize: 24, lineHeight: 1, WebkitTextStroke: '1.5px oklch(0.12 0.06 270)', paintOrder: 'stroke fill', textShadow: '2px 2px 0 oklch(0.1 0.06 272)' }}>{m.streak}</span>
              <span style={{ fontWeight: 900, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', textShadow: '1px 1px 0 oklch(0.1 0.06 272)' }}>{m.streakWord}</span>
            </div>
          </div>
          <Pips pips={m.pips} height={10} gap={6} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 8, background: 'linear-gradient(180deg,#1b278e,#172184)', border: '3px solid #c9d4f6', boxShadow: RIM }}>
            <span style={{ width: 58, height: 64, flexShrink: 0, fontSize: 40, borderRadius: 7, background: TILE_BG, boxShadow: TILE_SH, display: 'grid', placeItems: 'center', fontWeight: 900, fontStyle: 'italic', lineHeight: 1, ...STROKE }}>{m.spotNo}</span>
            <div className="col" style={{ gap: 6, minWidth: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: GOLD, textShadow: '2px 2px 0 oklch(0.1 0.06 272)' }}>{m.spotLabel}</span>
              <span style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(20px,6.4cqw,28px)', lineHeight: 1.05, textTransform: 'uppercase', WebkitTextStroke: '1.5px oklch(0.12 0.06 270)', paintOrder: 'stroke fill', textShadow: '2px 3px 0 oklch(0.1 0.06 272)', textWrap: 'balance' }}>{m.spotName}</span>
            </div>
          </div>
          <div className="col" style={{ gap: 8 }}>
            <button className="btn-cta btn-cta-phone" onClick={nav.primary}><span>{m.btn}</span></button>
            {m.sub && <span style={{ fontSize: 13, fontWeight: 800, color: 'oklch(0.95 0.03 248)', textAlign: 'center', textShadow: '2px 2px 0 oklch(0.1 0.06 272)' }}>{m.sub}</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button className="link-btn link-btn-phone" onClick={nav.archive}>Arhiva prethodnih izazova</button>
      </div>
    </div>
  );
}

export { GRADES };
