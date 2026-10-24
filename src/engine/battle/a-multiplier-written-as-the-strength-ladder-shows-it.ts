// A multiplier written as the strength ladder shows it (×1.4, ×1.375). Its own module (plan P1-13e1) so that
// battle/lines.ts and battle/ladder.ts, which both write multipliers this way, need not import each other.
export function ladderFm(v: number) {
  let t = (+v).toFixed(3);
  while (t.endsWith('0') && !/\.\d$/.test(t)) t = t.slice(0, -1);
  return '×' + t;
} // ×1.4, ×2.0, ×1.44, ×1.375 — exact to 3 dp so the ladder can be checked by hand
