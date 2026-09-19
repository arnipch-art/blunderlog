// Partigranskning: formler, etiketter, SEE, accuracy. Port av review.py.
import { Chess } from '../vendor/chess.js';

export const WIN_K = 0.00368208;
export const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-WIN_K * cp)) - 1);
export const moveAccuracy = (loss) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));

export const COLORS = {
  Brilliant: '#1abc9c', Great: '#3498db', Best: '#5dbb63', Excellent: '#7fb069', Good: '#95a5a6',
  Book: '#a58b6f', Inaccuracy: '#f1c40f', Mistake: '#e67e22', Blunder: '#c0392b',
};
export const LABEL_ORDER = Object.keys(COLORS);

export function labelForLoss(loss) {
  if (loss > 20) return 'Blunder';
  if (loss > 10) return 'Mistake';
  if (loss > 5) return 'Inaccuracy';
  if (loss > 2) return 'Good';
  return 'Excellent';
}

export const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

// ---------------------------------------------------------------- öppningsbok

function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export const posKey = (fen) => fnv(fen.split(' ').slice(0, 3).join(' '));

let book = null;
export async function loadBook(url = 'data/openings.json') {
  if (book) return book;
  const d = await (await fetch(url)).json();
  book = { positions: new Set(d.positions), names: d.names };
  return book;
}

// ---------------------------------------------------------------- SEE

// Static exchange evaluation för ett drag (i bönder, för den som drar).
// Negativt = draget hänger material. Använder lagliga drag, så bindningar räknas.
export function see(fenBefore, move) {
  const b = new Chess(fenBefore);
  const sq = move.to;
  const target = b.get(sq);
  const isEp = move.flags && move.flags.includes('e');
  const gain = [target ? PIECE_VALUE[target.type] : (isEp ? 1 : 0)];
  b.move({ from: move.from, to: move.to, promotion: move.promotion });
  let onSq = b.get(sq).type;
  let d = 0;
  for (;;) {
    const cands = b.moves({ verbose: true }).filter((m) => m.to === sq && (!m.promotion || m.promotion === 'q'));
    if (!cands.length) break;
    cands.sort((x, y) => PIECE_VALUE[x.piece] - PIECE_VALUE[y.piece]);
    const m = cands[0];
    d += 1;
    gain.push(PIECE_VALUE[onSq] - gain[d - 1]);
    onSq = m.piece;
    b.move(m);
  }
  while (d > 0) { gain[d - 1] = -Math.max(-gain[d - 1], gain[d]); d -= 1; }
  return gain[0];
}

// ---------------------------------------------------------------- analys av ett parti

export function parsePgn(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const header = chess.getHeaders ? chess.getHeaders() : chess.header();
  const history = chess.history({ verbose: true });
  // klocktider: {[%clk 0:09:59.9]}
  const clocks = [];
  const re = /\{\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]\}/g;
  let m;
  while ((m = re.exec(pgn))) clocks.push(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
  return { header, history, clocks: clocks.length === history.length ? clocks : [] };
}

export function terminalInfo(chess) {
  if (chess.isCheckmate()) return { cp: chess.turn() === 'w' ? -10000 : 10000, best: null, secondCp: null, pv: [] };
  return { cp: 0, best: null, secondCp: null, pv: [] };
}

// Kör motorn på varje ställning. onProgress(i, n). Returnerar {infos, fens, history}
export async function analyseGame(history, engine, limit, onProgress, shouldStop) {
  const chess = new Chess();
  const fens = [chess.fen()];
  for (const mv of history) { chess.move(mv); fens.push(chess.fen()); }
  const infos = [];
  for (let i = 0; i < fens.length; i++) {
    if (shouldStop && shouldStop()) return null;
    const c = new Chess(fens[i]);
    if (c.isGameOver()) { infos.push(terminalInfo(c)); continue; }
    infos.push(await engine.analyse(fens[i], limit));
    if (onProgress) onProgress(i + 1, fens.length);
  }
  return { infos, fens };
}

// Etikettlogiken samlad så att sparade partier kan få nya etiketter utan motor.
// Höj LABEL_VERSION när reglerna ändras.
export const LABEL_VERSION = 2;

export function classify({ inBook, isBest, loss, wpB, wpA, secondWp, sac, obvious }) {
  if (inBook) return 'Book';
  // Brilliant som chess.com: ett offer (pjäsen kan slås med materialvinst), draget är bästa
  // eller nästan bästa, ställningen håller efteråt, och ingen matt redan på brädet.
  if (sac && loss < 5 && wpA >= 45 && wpB < 98) return 'Brilliant';
  if (isBest && !obvious && secondWp !== null && wpA - secondWp >= 10 && wpA >= 45) return 'Great';
  if (isBest) return 'Best';
  return labelForLoss(loss);
}

export function relabel(rec, bookData) {
  let inBook = true;
  for (const m of rec.moves) {
    const c = new Chess(m.fen);
    const mv = c.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] });
    if (!mv) continue;
    inBook = inBook && bookData.positions.has(posKey(c.fen()));
    const sign = m.color === 'white' ? 1 : -1;
    const exchange = see(m.fen, mv);
    const isBest = m.best !== null && m.uci === m.best;
    m.sacrifice = mv.piece !== 'p' && mv.piece !== 'k' && exchange <= -2;
    m.label = classify({
      inBook, isBest, loss: m.loss, wpB: m.wpBefore, wpA: m.wpAfter,
      secondWp: m.secondCp === null || m.secondCp === undefined ? null : winPct(sign * m.secondCp),
      sac: m.sacrifice, obvious: mv.flags.includes('c') && exchange > 0,
    });
  }
  rec.labelVersion = LABEL_VERSION;
  return rec;
}

export function reviewMoves(history, fens, infos, bookData) {
  const out = [];
  let inBook = true;
  for (let i = 0; i < history.length; i++) {
    const mv = history[i];
    const before = infos[i], after = infos[i + 1];
    const white = mv.color === 'w';
    const sign = white ? 1 : -1;
    const wpB = winPct(sign * before.cp);
    const wpA = winPct(sign * after.cp);
    const uci = mv.from + mv.to + (mv.promotion || '');
    const isBest = before.best !== null && uci === before.best;
    const loss = isBest ? 0 : Math.max(0, wpB - wpA);
    const acc = moveAccuracy(loss);
    let bestSan = '-';
    if (before.best) {
      const c = new Chess(fens[i]);
      const bm = c.move({ from: before.best.slice(0, 2), to: before.best.slice(2, 4), promotion: before.best[4] });
      if (bm) bestSan = bm.san;
    }
    inBook = inBook && bookData.positions.has(posKey(fens[i + 1]));
    const exchange = see(fens[i], mv);
    const sac = mv.piece !== 'p' && mv.piece !== 'k' && exchange <= -2;
    const obvious = mv.flags.includes('c') && exchange > 0;

    const label = classify({
      inBook, isBest, loss, wpB, wpA, secondWp: before.secondCp === null ? null : winPct(sign * before.secondCp), sac, obvious,
    });

    out.push({
      ply: i + 1, color: white ? 'white' : 'black', san: mv.san, uci, best: before.best, bestSan,
      cpBefore: before.cp, cpAfter: after.cp, secondCp: before.secondCp,
      wpBefore: wpB, wpAfter: wpA, loss, accuracy: acc, label, sacrifice: sac,
      fen: fens[i], replyBest: after.best,
    });
  }
  return out;
}

export function openingName(fens, bookData) {
  let name = '–';
  for (const f of fens) { const n = bookData.names[posKey(f)]; if (n) name = n; }
  return name;
}

// Vikt = std-avvikelse i win% i glidande fönster, kapad [0.5, 12].
export function accuracyParts(reviews, infos, color) {
  const wps = infos.map((p) => winPct(p.cp));
  const n = wps.length;
  const window = Math.max(2, Math.min(8, Math.floor(n / 10)));
  const weights = [];
  for (let i = 1; i < n; i++) {
    const seg = wps.slice(Math.max(0, i - window), i + 1);
    const mean = seg.reduce((a, b) => a + b, 0) / seg.length;
    const sd = Math.sqrt(seg.reduce((a, b) => a + (b - mean) ** 2, 0) / seg.length);
    weights.push(Math.min(12, Math.max(0.5, sd)));
  }
  const accs = reviews.filter((r) => r.color === color).map((r) => [r.accuracy, weights[r.ply - 1]]);
  if (!accs.length) return { weighted: 0, harmonic: 0 };
  const weighted = accs.reduce((s, [a, w]) => s + a * w, 0) / accs.reduce((s, [, w]) => s + w, 0);
  const harmonic = accs.length / accs.reduce((s, [a]) => s + 1 / Math.max(a, 0.01), 0);
  return { weighted, harmonic };
}

export const ACC_BLEND = 0.82; // kalibrerad mot chess.com:s egna siffror (39 partier)
export const blendAcc = (parts, blend = ACC_BLEND) => blend * parts.weighted + (1 - blend) * parts.harmonic;

export function fmtEval(cp) {
  if (Math.abs(cp) >= 9000) { const n = 10000 - Math.abs(cp); return (cp > 0 ? '+M' : '-M') + (n || ''); }
  return (cp >= 0 ? '+' : '') + (cp / 100).toFixed(2);
}
