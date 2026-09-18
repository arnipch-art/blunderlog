// Litet SVG-bräde med pilar. Rött = spelat drag, grönt = bästa draget.
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

export function boardSvg(fen, { played, best, orientation = 'white', size = 200 } = {}) {
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
      pieces += `<text x="${x}" y="${y}" font-size="21" text-anchor="middle" dominant-baseline="central" ` +
        `fill="${white ? '#fff' : '#111'}" stroke="${white ? '#111' : 'none'}" stroke-width=".8" paint-order="stroke">${GLYPH[ch.toLowerCase()]}</text>`;
      f += 1;
    }
  }
  let arrows = '';
  if (played) arrows += arrow(played.slice(0, 2), played.slice(2, 4), '#c0392b', flip);
  if (best) arrows += arrow(best.slice(0, 2), best.slice(2, 4), '#27ae60', flip);
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" class="board">${squares}${pieces}${arrows}</svg>`;
}
