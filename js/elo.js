// Uppskattad spelstyrka. Två skattningar som visas som ett intervall:
//  byAcc: accuracy -> rating via ankarpunkter (grova, handvalda – se README)
//  perf:  prestationsrating på resultaten = motståndarnas snittrating + 400·(V−F)/N.
//         OBS: chess.com matchar mot spelare nära din egen rating, så perf ≈ din rating ± form.
// Räknas bara på den tidsklass du spelat mest av bland de senaste partierna, kräver ≥10 partier.
// Ankarna är sänkta efter kontroll mot projektets eget data (rapid ~600 ≈ 71 % här). Fortfarande grovt.
const ANCHORS = [[35, 150], [45, 250], [55, 350], [62, 450], [68, 550], [74, 750], [79, 1000], [84, 1300], [88, 1600], [92, 1950], [96, 2300], [100, 2700]];

export function accToRating(acc) {
  if (acc <= ANCHORS[0][0]) return ANCHORS[0][1];
  for (let i = 1; i < ANCHORS.length; i++) {
    const [a0, r0] = ANCHORS[i - 1], [a1, r1] = ANCHORS[i];
    if (acc <= a1) return Math.round(r0 + (r1 - r0) * (acc - a0) / (a1 - a0));
  }
  return ANCHORS[ANCHORS.length - 1][1];
}

// recs kronologiskt, accs = mina accuracy per parti.
export function estimateElo(recs, accs, window = 20) {
  const counts = {};
  for (const r of recs.slice(-window)) counts[r.meta.timeClass] = (counts[r.meta.timeClass] || 0) + 1;
  const cls = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const idx = recs.map((r, i) => [r, i]).filter(([r, i]) => r.meta.timeClass === cls && r.moves.some((m) => m.mine)).slice(-window);
  const n = idx.length;
  if (n < 10) return null;
  const R = idx.map(([r]) => r), A = idx.map(([, i]) => accs[i]);
  // på snitt-accuracyn (samma siffra som visas på översikten), inte median av per-parti-skattningar
  const byAcc = accToRating(A.reduce((x, y) => x + y, 0) / A.length);
  const score = R.reduce((s, r) => s + (r.meta.outcome === 'win' ? 1 : r.meta.outcome === 'draw' ? 0.5 : 0), 0);
  const oppAvg = R.reduce((s, r) => s + r.meta.oppRating, 0) / n;
  const perf = Math.round(oppAvg + 400 * (2 * score - n) / n);
  return { low: Math.min(byAcc, perf), high: Math.max(byAcc, perf), byAcc, perf, n, cls, current: R[R.length - 1].meta.myRating };
}
