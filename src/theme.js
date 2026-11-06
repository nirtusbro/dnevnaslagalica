// Colour tokens and the dynamic tile/field looks used as inline styles.
// Static chrome lives in styles.css; these are the states JS switches between.

export const N = 'oklch(0.26 0.117 262)';   // navy ink on light/yellow surfaces
export const W = 'oklch(0.99 0.005 250)';   // white
export const Y = 'oklch(0.87 0.17 92)';     // yellow accent
export const I2 = 'oklch(0.92 0.05 248)';   // soft text
export const CY = 'oklch(0.88 0.11 228)';   // cyan kicker
export const O = 'oklch(0.76 0.16 60)';     // orange
export const R = 'oklch(0.66 0.2 30)';      // red
export const GR = 'oklch(0.76 0.16 150)';   // green
export const MUTE = 'oklch(0.42 0.169 262)';
export const SKIPC = 'oklch(0.62 0.07 255)';

/** Letter / number tile: available */
export const AV = {
  bg: 'radial-gradient(130% 100% at 30% 10%,#3d5ee4,#1d3ebf 55%,#152f9e)',
  sh: 'inset 0 0 0 3px #7092e2,inset 0 0 0 4px oklch(0.32 0.17 266),inset 0 5px 6px oklch(1 0 0 / .18),0 0 0 2px oklch(0.17 0.1 270),4px 5px 0 oklch(0.1 0.07 272 / .6)',
  fg: W, tf: 'none',
};
/** Tile: selected (pressed down, yellow ring) */
export const SEL = { bg: 'oklch(0.23 0.104 262)', sh: 'inset 0 0 0 2px ' + Y, fg: Y, tf: 'translateY(3px)' };
/** Tile: used up / unavailable */
export const UN = { bg: 'oklch(0.3 0.13 262)', sh: 'inset 0 0 0 1px oklch(0.38 0.156 262)', fg: 'oklch(0.5 0.09 260)', tf: 'translateY(3px)' };
/** Opened clue (white card) */
export const OPEN = { bg: 'oklch(0.95 0.015 250)', sh: '0 2px 0 oklch(0.22 0.104 262)', fg: N };
/** Clue inside a solved column (pale yellow) */
export const SOLV = { bg: 'oklch(0.94 0.07 95)', sh: '0 2px 0 oklch(0.22 0.104 262)', fg: N };
/** Yellow slot / solved */
export const YS = {
  bg: 'linear-gradient(180deg,#fff27a,#fcd61e 50%,#f2a628)',
  sh: 'inset 0 2px 0 oklch(1 0.05 100),inset 0 -3px 0 oklch(0.62 0.14 70),0 0 0 2px oklch(0.18 0.1 270),3px 4px 0 oklch(0.14 0.09 272 / .55)',
  fg: N,
};
/** Dark inset well */
export const WL = {
  bg: '#12145a',
  sh: 'inset 0 0 0 2px oklch(0.86 0.025 250),inset 0 0 0 4px oklch(0.16 0.09 270),inset 0 5px 10px oklch(0 0 0 / .45)',
  fg: I2,
};
export const DASH = 'inset 0 0 0 1.5px oklch(0.48 0.169 262)';

/** Grade tier colours, index matches rules.GRADES */
export const GRADE_COLORS = [GR, Y, O, R];

export const SYM_COLORS = [null, W, CY, R, O, Y];

/** Shake animation name alternates so consecutive shakes restart. */
export const shakeAnim = (n) => (n ? (n % 2 ? 'shakeA' : 'shakeB') + ' .38s' : 'none');

export const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* no-op */ } };
