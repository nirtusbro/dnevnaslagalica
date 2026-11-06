// Moj broj: combine six numbers with + − × ÷ and brackets to hit the target.
// Tokens: {n: index} for a number from the puzzle, {o: '+'|'−'|'×'|'÷'|'('|')'} for operators.

export const OPS = ['+', '−', '×', '÷', '(', ')'];

export function lastToken(tokens) {
  return tokens[tokens.length - 1];
}

/** The expression currently ends in a value (number or closing bracket). */
export function endsWithValue(tokens) {
  const l = lastToken(tokens);
  return !!l && (l.n != null || l.o === ')');
}

export function openBrackets(tokens) {
  let open = 0;
  for (const t of tokens) {
    if (t.o === '(') open++;
    else if (t.o === ')') open--;
  }
  return open;
}

export function usedIndices(tokens) {
  return new Set(tokens.filter((t) => t.n != null).map((t) => t.n));
}

/**
 * Try to append a token. Returns {ok, tokens} or {ok:false, error}.
 * Rules: numbers follow operators or "(", operators follow values, "(" follows operators,
 * ")" follows a value when a bracket is open, each number is used at most once.
 */
export function push(tokens, tok) {
  const v = endsWithValue(tokens);
  if (tok.n != null) {
    if (usedIndices(tokens).has(tok.n)) return { ok: false, error: 'Broj je već iskorišćen' };
    if (v) return { ok: false, error: 'Prvo izaberi operaciju' };
    return { ok: true, tokens: [...tokens, tok] };
  }
  if (tok.o === '(') {
    if (v) return { ok: false, error: 'Zagrada ide posle operacije' };
    return { ok: true, tokens: [...tokens, tok] };
  }
  if (tok.o === ')') {
    if (!v || openBrackets(tokens) <= 0) return { ok: false, error: 'Nema otvorene zagrade' };
    return { ok: true, tokens: [...tokens, tok] };
  }
  if (!v) return { ok: false, error: 'Prvo izaberi broj' };
  return { ok: true, tokens: [...tokens, tok] };
}

/** Trailing operators are dropped and open brackets are closed before evaluating. */
export function complete(tokens) {
  const t = [...tokens];
  while (t.length && t[t.length - 1].o && t[t.length - 1].o !== ')') t.pop();
  while (t.length && t[t.length - 1].o === '(') t.pop();
  const open = openBrackets(t);
  for (let i = 0; i < open; i++) t.push({ o: ')' });
  return t;
}

/**
 * Evaluates a completed token list with standard precedence. Returns a number,
 * or null when empty, malformed, or dividing by zero. All inputs are integers, so
 * floats are exact except for division; the caller requires an integer result.
 */
export function evaluate(tokens, numbers) {
  const t = complete(tokens);
  if (!t.length) return null;
  let i = 0;
  const peek = () => t[i];
  const next = () => t[i++];
  let bad = false;

  function primary() {
    const tok = next();
    if (!tok) { bad = true; return 0; }
    if (tok.n != null) return numbers[tok.n];
    if (tok.o === '(') {
      const v = expr();
      const c = next();
      if (!c || c.o !== ')') bad = true;
      return v;
    }
    bad = true;
    return 0;
  }
  function term() {
    let v = primary();
    while (peek() && (peek().o === '×' || peek().o === '÷')) {
      const op = next().o;
      const r = primary();
      if (op === '×') v *= r;
      else {
        if (r === 0) { bad = true; return 0; }
        v /= r;
      }
    }
    return v;
  }
  function expr() {
    let v = term();
    while (peek() && (peek().o === '+' || peek().o === '−')) {
      const op = next().o;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const v = expr();
  if (bad || i !== t.length || !Number.isFinite(v)) return null;
  return v;
}

/** Human-readable expression, e.g. "75 × (8 + 2) − 15 + 7". */
export function format(tokens, numbers) {
  const t = complete(tokens);
  return t.map((x) => (x.n != null ? String(numbers[x.n]) : x.o)).join(' ')
    .replace(/\( /g, '(').replace(/ \)/g, ')');
}

export const POINTS = 10;

/**
 * TV rule: a correct procedure to the exact number is worth 10. When the target is
 * not reachable at all, the best reachable number is worth 10 instead (`bestDiff` is
 * the distance of the closest reachable value, 0 when the target can be hit).
 * Anything else scores 0.
 */
export function pointsFor(target, value, bestDiff = 0) {
  if (value == null || !Number.isInteger(value)) return 0;
  const d = Math.abs(target - value);
  return d <= bestDiff ? POINTS : 0;
}

/**
 * Finds one expression that reaches `target` exactly (or the closest value), using
 * each number at most once. Shown as "Jedno tačno rešenje" on the reveal screen when
 * the puzzle does not ship a solution string. Exhaustive over all pairings; six
 * numbers finish in well under 100 ms.
 */
export function solve(numbers, target) {
  const best = { diff: Infinity, text: '', value: null };
  const items = numbers.map((n) => ({ v: n, s: String(n), p: 3 }));
  const consider = (it) => {
    const d = Math.abs(it.v - target);
    if (d < best.diff) { best.diff = d; best.text = it.s; best.value = it.v; }
  };
  items.forEach(consider);
  const wrap = (it, prec) => (it.p < prec ? '(' + it.s + ')' : it.s);
  function rec(list) {
    if (best.diff === 0) return;
    for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const a = list[i], b = list[j];
        const rest = list.filter((_, k) => k !== i && k !== j);
        const cands = [];
        if (i < j) {
          cands.push({ v: a.v + b.v, s: wrap(a, 1) + ' + ' + wrap(b, 1), p: 1 });
          cands.push({ v: a.v * b.v, s: wrap(a, 2) + ' × ' + wrap(b, 2), p: 2 });
        }
        if (a.v - b.v > 0) cands.push({ v: a.v - b.v, s: wrap(a, 1) + ' − ' + wrap(b, 2), p: 1 });
        if (b.v !== 0 && b.v !== 1 && a.v % b.v === 0) cands.push({ v: a.v / b.v, s: wrap(a, 2) + ' ÷ ' + wrap(b, 3), p: 2 });
        for (const c of cands) {
          consider(c);
          if (rest.length) rec([...rest, c]);
          if (best.diff === 0) return;
        }
      }
    }
  }
  rec(items);
  return best;
}
