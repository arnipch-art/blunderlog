// SVG-bräde med pilar, senaste-drag-markering och etikettbricka.
// played = röd pil, best = grön pil, lastMove = gula rutor, badge = {square, label}.
import { COLORS } from './review.js';
const SYM = { Brilliant: '!!', Great: '!', Best: '★', Excellent: '✓', Good: '•', Book: '≡', Inaccuracy: '?!', Mistake: '?', Blunder: '??' };
const DARK = new Set(['Blunder']);
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

function sqXY(sq, flip) {
  let file = sq.charCodeAt(0) - 97;
  let rank = Number(sq[1]) - 1;
  if (flip) { file = 7 - file; } else { rank = 7 - rank; }
  return [file * 25 + 12.5, rank * 25 + 12.5];
}

function arrow(from, to, color, flip) {
  const [x1, y1] = sqXY(from, flip);
  const [x2, y2] = sqXY(to, flip);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const hx = x2 - ux * 9, hy = y2 - uy * 9;
  const px = -uy * 6, py = ux * 6;
  return `<line x1="${x1}" y1="${y1}" x2="${hx}" y2="${hy}" stroke="${color}" stroke-width="5" stroke-linecap="round" opacity=".85"/>` +
    `<polygon points="${x2},${y2} ${hx + px},${hy + py} ${hx - px},${hy - py}" fill="${color}" opacity=".85"/>`;
}

export function boardSvg(fen, { played, best, lastMove, badge, orientation = 'white', size = 200 } = {}) {
  const flip = orientation === 'black';
  const rows = fen.split(' ')[0].split('/');
  let squares = '', pieces = '';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const light = (r + f) % 2 === 0;
      const x = (flip ? 7 - f : f) * 25, y = (flip ? 7 - r : r) * 25;
      squares += `<rect x="${x}" y="${y}" width="25" height="25" fill="${light ? '#f0d9b5' : '#b58863'}"/>`;
    }
  }
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      const white = ch === ch.toUpperCase();
      const x = (flip ? 7 - f : f) * 25 + 12.5, y = (flip ? 7 - r : r) * 25 + 13;
      pieces += `<text x="${x}" y="${y}" font-size="21" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI Symbol','Apple Symbols','DejaVu Sans','Noto Sans Symbols2',sans-serif" ` +
        `fill="${white ? '#fff' : '#111'}" stroke="${white ? '#111' : 'none'}" stroke-width=".8" paint-order="stroke">${GLYPH[ch.toLowerCase()]}</text>`;
      f += 1;
    }
  }
  let arrows = '';
  if (lastMove) {
    for (const sq of [lastMove.slice(0, 2), lastMove.slice(2, 4)]) {
      const [cx, cy] = sqXY(sq, flip);
      squares += `<rect x="${cx - 12.5}" y="${cy - 12.5}" width="25" height="25" fill="#f6f669" opacity=".45"/>`;
    }
  }
  if (played) arrows += arrow(played.slice(0, 2), played.slice(2, 4), '#c0392b', flip);
  if (best) arrows += arrow(best.slice(0, 2), best.slice(2, 4), '#27ae60', flip);
  let mark = '';
  if (badge) {
    const [cx, cy] = sqXY(badge.square, flip);
    mark = `<circle cx="${cx + 10}" cy="${cy - 10}" r="7.5" fill="${COLORS[badge.label]}" stroke="#fff" stroke-width="1.2"/><text x="${cx + 10}" y="${cy - 9.5}" font-size="8" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="${DARK.has(badge.label) ? '#fff' : '#111'}" font-family="-apple-system,Helvetica,Arial,sans-serif">${SYM[badge.label]}</text>`;
  }
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" class="board">${squares}${pieces}${arrows}${mark}</svg>`;
}
