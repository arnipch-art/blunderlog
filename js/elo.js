// Uppskattad spelstyrka (Elo). Två oberoende skattningar som vägs ihop:
//  1) accuracy -> rating via ankarpunkter (ungefärliga typiska accuracy-nivåer per
//     rating i 10-minutersschack på chess.com; grov men monoton)
//  2) prestationsrating på resultaten: motståndarnas snittrating + 400·(V−F)/N
// Slutsiffran = 60 % accuracy-skattning + 40 % prestation. Det är en uppskattning,
// inte en rating – en handfull partier ger lätt ±150.
const ANCHORS = [[35, 200], [45, 350], [55, 500], [62, 650], [68, 800], [74, 1000], [79, 1250], [84, 1500], [88, 1800], [92, 2100], [96, 2400], [100, 2800]];

export function accToRating(acc) {
  if (acc <= ANCHORS[0][0]) return ANCHORS[0][1];
  for (let i = 1; i < ANCHORS.length; i++) {
    const [a0, r0] = ANCHORS[i - 1], [a1, r1] = ANCHORS[i];
    if (acc <= a1) return Math.round(r0 + (r1 - r0) * (acc - a0) / (a1 - a0));
  }
  return ANCHORS[ANCHORS.length - 1][1];
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// recs kronologiskt, accs = mina accuracy per parti. Använder de senaste `window` partierna.
export function estimateElo(recs, accs, window = 20) {
  const n = Math.min(recs.length, window);
  if (n < 3) return null;
  const R = recs.slice(-n), A = accs.slice(-n);
  const byAcc = Math.round(median(A.map(accToRating)));
  const score = R.reduce((s, r) => s + (r.meta.outcome === 'win' ? 1 : r.meta.outcome === 'draw' ? 0.5 : 0), 0);
  const oppAvg = R.reduce((s, r) => s + r.meta.oppRating, 0) / n;
  const perf = Math.round(oppAvg + 400 * (2 * score - n) / n);
  return { estimate: Math.round(0.6 * byAcc + 0.4 * perf), byAcc, perf, n, current: R[R.length - 1].meta.myRating };
}
