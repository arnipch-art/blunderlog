// Partirapport i chess.com-stil: bräde + eval-stapel, klassificering för båda,
// klickbar draglista, kommentar per drag, tangentbord ← →.
import { COLORS, LABEL_ORDER, winPct, fmtEval, blendAcc } from './review.js';
import { boardSvg } from './board.js';
import { Chess } from '../vendor/chess.js';
import { t } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SYMBOL = { Brilliant: '!!', Great: '!', Best: '★', Excellent: '✓', Good: '✓', Book: '📖', Inaccuracy: '?!', Mistake: '?', Blunder: '??' };
const DARK = new Set(['Blunder', 'Great', 'Book']);

export const badge = (label, cls = '') => `<span class="badge ${cls}" style="background:${COLORS[label]};color:${DARK.has(label) ? '#fff' : '#111'}" title="${label}">${SYMBOL[label]}</span>`;

let cleanup = null;

export function mountGame(panel, rec, blend, startPly = null) {
  if (cleanup) cleanup();
  const g = rec.meta, h = rec.headers || {};
  const moves = rec.moves;
  const orientation = g.color;
  const mine = g.color;
  let ply = startPly ?? moves.length; // 0 = startställning

  const counts = { white: {}, black: {} };
  for (const m of moves) counts[m.color][m.label] = (counts[m.color][m.label] || 0) + 1;
  const accW = blendAcc(rec.accuracy.white, blend), accB = blendAcc(rec.accuracy.black, blend);

  const classRows = LABEL_ORDER.map((l) => `<tr><td class="cw">${counts.white[l] || 0}</td><td class="cl">${badge(l)} ${l}</td><td class="cb">${counts.black[l] || 0}</td></tr>`).join('');

  let list = '';
  for (let i = 0; i < moves.length; i += 2) {
    const w = moves[i], b = moves[i + 1];
    const cell = (m) => (m ? `<button type="button" class="mv" data-ply="${m.ply}">${esc(m.san)} ${badge(m.label, 'sm')}</button>` : '');
    list += `<div class="mrow"><span class="mnum">${i / 2 + 1}.</span>${cell(w)}${cell(b) || '<span></span>'}</div>`;
  }

  // eval-graf (klickbar)
  const wps = [50, ...moves.map((m) => winPct(m.cpAfter))];
  if (moves.length) wps[0] = winPct(moves[0].cpBefore);
  const W = 900, H = 120, P = 6, n = wps.length;
  const xs = wps.map((_, i) => P + (W - 2 * P) * (n > 1 ? i / (n - 1) : 0));
  const ys = wps.map((v) => P + (H - 2 * P) * (1 - v / 100));
  const area = `M${xs[0].toFixed(1)},${H - P} ` + xs.map((x, i) => `L${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ') + ` L${xs[n - 1].toFixed(1)},${H - P} Z`;
  const marks = moves.filter((m) => ['Blunder', 'Mistake', 'Brilliant', 'Great'].includes(m.label))
    .map((m) => `<circle cx="${xs[m.ply].toFixed(1)}" cy="${ys[m.ply].toFixed(1)}" r="4.5" fill="${COLORS[m.label]}" stroke="#222"/>`).join('');

  panel.innerHTML = `
<div class="gv">
  <div class="gv-head">
    <div class="gv-player ${mine === 'white' ? 'me' : ''}"><span class="sq w"></span><b>${esc(h.White)}</b> <span class="muted">(${esc(h.WhiteElo)})</span><span class="gv-acc">${accW.toFixed(1)}<small>%</small></span></div>
    <div class="gv-result">${esc(h.Result)}<br><span class="muted">${esc(rec.opening)}</span></div>
    <div class="gv-player ${mine === 'black' ? 'me' : ''}"><span class="gv-acc">${accB.toFixed(1)}<small>%</small></span><b>${esc(h.Black)}</b> <span class="muted">(${esc(h.BlackElo)})</span><span class="sq b"></span></div>
    <div class="gv-actions"><a href="${esc(g.url)}" target="_blank" rel="noopener">chess.com</a> <button class="close-game" type="button">${t('close')}</button></div>
  </div>
  <div class="gv-body">
    <div class="gv-left">
      <div class="gv-boardwrap"><div class="evalbar" id="gv-evalbar"><div class="evalbar-w"></div><span class="evalbar-txt"></span></div><div id="gv-board"></div></div>
      <div class="gv-ctrl">
        <button type="button" data-go="first" title="Home">⏮</button><button type="button" data-go="prev" title="←">◀</button>
        <span id="gv-pos" class="muted"></span>
        <button type="button" data-go="next" title="→">▶</button><button type="button" data-go="last" title="End">⏭</button>
      </div>
      <div id="gv-comment" class="gv-comment"></div>
      <svg viewBox="0 0 ${W} ${H}" class="gv-graph" id="gv-graph"><rect width="${W}" height="${H}" fill="#3b3b3b"/><path d="${area}" fill="#f0f0f0"/><line x1="${P}" y1="${H / 2}" x2="${W - P}" y2="${H / 2}" stroke="#c0392b" stroke-dasharray="4 4" opacity=".7"/>${marks}<line id="gv-cursor" x1="0" y1="0" x2="0" y2="${H}" stroke="#1abc9c" stroke-width="2"/></svg>
    </div>
    <div class="gv-right">
      <table class="gv-class"><tr><th>${t('white')}</th><th></th><th>${t('black')}</th></tr>${classRows}</table>
      <div class="gv-moves" id="gv-moves">${list}</div>
    </div>
  </div>
</div>`;

  const boardEl = panel.querySelector('#gv-board');
  const commentEl = panel.querySelector('#gv-comment');
  const posEl = panel.querySelector('#gv-pos');
  const bar = panel.querySelector('#gv-evalbar');
  const cursor = panel.querySelector('#gv-cursor');

  function show(p) {
    ply = Math.max(0, Math.min(moves.length, p));
    const m = ply ? moves[ply - 1] : null;
    let fen = moves[0] ? moves[0].fen : new Chess().fen();
    const opts = { orientation, size: 360 };
    if (m) {
      const c = new Chess(m.fen);
      c.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] });
      fen = c.fen();
      opts.badge = { square: m.uci.slice(2, 4), label: m.label };
      opts.lastMove = m.uci;
      // grön pil för bästa draget bara om pjäsen fortfarande står kvar där pilen börjar
      if (!['Best', 'Book', 'Brilliant', 'Great', 'Excellent'].includes(m.label) && m.best && m.best.slice(0, 2) !== m.uci.slice(0, 2)) opts.best = m.best;
    }
    boardEl.innerHTML = boardSvg(fen, opts);
    const cp = m ? m.cpAfter : (moves[0] ? moves[0].cpBefore : 0);
    const wp = winPct(cp);
    bar.querySelector('.evalbar-w').style.height = `${wp}%`;
    bar.querySelector('.evalbar-txt').textContent = fmtEval(cp);
    bar.classList.toggle('black-lead', wp < 50);
    cursor.setAttribute('x1', xs[ply].toFixed(1)); cursor.setAttribute('x2', xs[ply].toFixed(1));
    posEl.textContent = m ? `${Math.floor((m.ply + 1) / 2)}${m.color === 'white' ? '.' : '...'} ${m.san}` : t('startPos');
    if (m) {
      const who = m.mine ? t('you') : esc(m.color === 'white' ? h.White : h.Black);
      let text = `<div class="gv-c1">${badge(m.label)} <b>${esc(m.san)}</b> ${t('isLabel', { label: m.label })}</div>`;
      if (!['Best', 'Book', 'Brilliant', 'Great'].includes(m.label) && m.best) text += `<div>${t('wasBest', { best: esc(m.bestSan) })} <span class="muted">(${who}: ${m.wpBefore.toFixed(0)} % → ${m.wpAfter.toFixed(0)} %)</span></div>`;
      if (m.label === 'Brilliant') text += `<div class="muted">${t('brilliantWhy')}</div>`;
      if (m.label === 'Great') text += `<div class="muted">${t('greatWhy')}</div>`;
      commentEl.innerHTML = text;
    } else commentEl.innerHTML = `<div class="muted">${t('clickMove')}</div>`;
    for (const b of panel.querySelectorAll('.mv')) b.classList.toggle('cur', Number(b.dataset.ply) === ply);
    const cur = panel.querySelector('.mv.cur');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  const onClick = (e) => {
    const mv = e.target.closest('.mv');
    if (mv) { show(Number(mv.dataset.ply)); return; }
    const go = e.target.closest('[data-go]');
    if (go) { const d = go.dataset.go; show(d === 'first' ? 0 : d === 'last' ? moves.length : d === 'prev' ? ply - 1 : ply + 1); }
  };
  const onGraph = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    show(best);
  };
  const onKey = (e) => {
    if (panel.hidden || e.target.matches('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') { show(ply - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { show(ply + 1); e.preventDefault(); }
    else if (e.key === 'Home') { show(0); e.preventDefault(); }
    else if (e.key === 'End') { show(moves.length); e.preventDefault(); }
  };
  panel.addEventListener('click', onClick);
  panel.querySelector('#gv-graph').addEventListener('click', onGraph);
  document.addEventListener('keydown', onKey);
  cleanup = () => { panel.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); cleanup = null; };
  show(ply);
}

export function unmountGame() { if (cleanup) cleanup(); }
