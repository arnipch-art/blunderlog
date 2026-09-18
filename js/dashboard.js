// Renderar dashboarden ur en lista analyserade partier. Port av stats.py build().
import { COLORS, LABEL_ORDER, winPct, fmtEval, blendAcc } from './review.js';
import { patternInfo, PHASES, phaseOf, detectPatterns, incrementOf } from './patterns.js';
import { t } from './i18n.js';
import { boardSvg } from './board.js';
import { estimateElo } from './elo.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmtDate = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const PIECE_KEY = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn', k: 'king' };

function lineChart(vals, { y0 = 0, y1 = 100, color = '#5dbb63', smooth = null, hline = null } = {}) {
  if (!vals.length) return '';
  const w = 900, h = 180, pad = 28, n = vals.length;
  const X = (i) => pad + (w - 2 * pad) * (n > 1 ? i / (n - 1) : 0.5);
  const Y = (v) => pad + (h - 2 * pad) * (1 - (v - y0) / (y1 - y0));
  const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const dots = vals.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.5" fill="${color}"><title>${v.toFixed(0)}</title></circle>`).join('');
  const sm = smooth ? `<polyline fill="none" style="stroke:var(--fg)" stroke-width="2" points="${smooth.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"/>` : '';
  const hl = hline != null ? `<line x1="${pad}" y1="${Y(hline).toFixed(1)}" x2="${w - pad}" y2="${Y(hline).toFixed(1)}" style="stroke:var(--grid)" stroke-dasharray="4 4"/>` : '';
  const ticks = [y0, (y0 + y1) / 2, y1].map((t) => `<text x="4" y="${(Y(t) + 4).toFixed(1)}" style="fill:var(--muted)" font-size="10">${Math.round(t)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${hl}${ticks}<polyline fill="none" stroke="${color}" stroke-width="1" opacity=".5" points="${pts}"/>${sm}${dots}</svg>`;
}

const movingAvg = (vals, k = 5) => vals.map((_, i) => mean(vals.slice(Math.max(0, i - k + 1), i + 1)));
const bar = (pct, color) => `<div class="bar"><div style="width:${Math.max(0, Math.min(100, pct)).toFixed(0)}%;background:${color}"></div></div>`;
const DARK_TAGS = new Set(['Blunder', 'Great', 'Book']);
const tag = (label) => `<span class="tag"${DARK_TAGS.has(label) ? ' data-dark' : ''} style="background:${COLORS[label]}">${label}</span>`;

export function myAcc(rec, blend) { return blendAcc(rec.accuracy[rec.meta.color], blend); }

export function calibrate(recs) {
  const pairs = recs.filter((r) => r.meta.ccAccuracy).map((r) => [r, r.meta.ccAccuracy]);
  if (pairs.length < 5) return null;
  let best = null;
  for (let k = 0; k <= 100; k++) {
    const b = k / 100;
    const err = mean(pairs.map(([r, cc]) => Math.abs(myAcc(r, b) - cc)));
    if (!best || err < best.err) best = { blend: b, err, n: pairs.length };
  }
  return best;
}

export function renderDashboard(recs, user, blend, calib) {
  const n = recs.length;
  if (!n) return '';
  const accs = recs.map((r) => myAcc(r, blend));
  const ratings = recs.map((r) => r.meta.myRating);
  const outcomes = {};
  for (const r of recs) outcomes[r.meta.outcome] = (outcomes[r.meta.outcome] || 0) + 1;

  const labelCounts = {}, phaseBad = {}, phaseMoves = {};
  let myMoves = 0;
  for (const r of recs) for (const m of r.moves) {
    if (!m.mine) continue;
    myMoves++;
    labelCounts[m.label] = (labelCounts[m.label] || 0) + 1;
    const ph = phaseOf(m.fen, Math.floor((m.ply + 1) / 2));
    phaseMoves[ph] = (phaseMoves[ph] || 0) + 1;
    if (m.label === 'Mistake' || m.label === 'Blunder') phaseBad[ph] = (phaseBad[ph] || 0) + 1;
  }

  const hitsBy = {};
  for (const r of recs) for (const h of detectPatterns(r)) (hitsBy[h.pattern] ||= []).push(h);

  const openings = {};
  recs.forEach((r, i) => {
    const name = r.opening !== '–' ? r.opening.split(':')[0] : '?';
    const wp10 = r.moves.find((m) => m.mine && Math.floor((m.ply + 1) / 2) === 10)?.wpAfter ?? null;
    (openings[`${r.meta.color}|${name}`] ||= []).push([accs[i], r.meta.outcome, wp10]);
  });

  const lossHow = {};
  for (const r of recs) if (r.meta.outcome === 'loss') lossHow[r.meta.result] = (lossHow[r.meta.result] || 0) + 1;

  const spentBad = [], spentOk = [];
  for (const r of recs) {
    const inc = incrementOf(r.meta.timeControl);
    let prev = null;
    for (const m of r.moves) {
      if (!m.mine || m.clock == null) continue;
      if (prev != null) (m.label === 'Mistake' || m.label === 'Blunder' ? spentBad : spentOk).push(Math.max(0, prev + inc - m.clock));
      prev = m.clock;
    }
  }

  const elo = estimateElo(recs, accs);

  // rankning på andel drabbade partier (ett långt slutspel ska inte kunna dominera), träffar som sekundärnyckel
  const ranked = Object.entries(hitsBy).map(([p, hs]) => [p, new Set(hs.map((h) => h.game.id)).size / n, hs]).sort((a, b) => b[1] - a[1] || b[2].length - a[2].length);

  const example = (h) => {
    const g = h.game.meta;
    const mv = `${h.moveNo}.${g.color === 'white' ? '' : '..'}${esc(h.san)}`;
    const sign = g.color === 'white' ? 1 : -1;
    const m = h.game.moves[h.ply - 1];
    let cost = `−${h.loss.toFixed(0)} %`;
    if (h.pattern === 'missed_mate') cost = `${t('mateIn', { n: 10000 - Math.abs(m.cpBefore) })} → ${fmtEval(sign * m.cpAfter)}`;
    if (h.pattern === 'opening_trouble') cost = `${t('wp10')}: ${m.wpAfter.toFixed(0)} %`;
    const extra = (h.spent != null ? ` · ${t('thought', { s: h.spent.toFixed(0) })}` : '') + (h.clock != null ? ` · ${t('left', { s: h.clock.toFixed(0) })}` : '');
    return `<div class="ex">${boardSvg(h.fen, { played: h.uci, best: h.best, orientation: g.color, size: 150 })}<div><b>${mv}</b> ${tag(h.label)}<br>${h.pattern === 'opening_trouble' ? esc(h.game.opening) : `${t('best')}: <b>${esc(h.bestSan)}</b>`} · ${cost}${extra}<br><a href="${esc(g.url)}?move=${h.ply}" target="_blank" rel="noopener">vs ${esc(g.opponent)} (${g.timeClass}, ${fmtDate(g.endTime)})</a> · <a href="#" data-game="${h.game.id}" class="show-game">${t('report')}</a></div></div>`;
  };

  let patternHtml = '', tabsHtml = '';
  let active = null;
  try { active = localStorage.getItem('patternTab'); } catch { /* ignore */ }
  if (!ranked.some(([p]) => p === active)) active = ranked[0]?.[0];
  ranked.forEach(([p, perGame, hs], idx) => {
    const info = patternInfo(p);
    const worst = [...hs].sort((a, b) => (p === 'opening_trouble' ? a.game.moves[a.ply - 1].wpAfter - b.game.moves[b.ply - 1].wpAfter : b.loss - a.loss)).slice(0, 3);
    const phases = {};
    for (const h of hs) phases[h.phase] = (phases[h.phase] || 0) + 1;
    const ph = Object.entries(phases).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${t(k)} ${v}`).join(', ');
    let extra = '';
    if (p === 'hung_piece') {
      const v = {};
      for (const h of hs) v[h.victim] = (v[h.victim] || 0) + 1;
      extra = ` ${t('hungPieces')}: ` + Object.entries(v).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${t(PIECE_KEY[k] || k)} ×${c}`).join(', ') + '.';
    }
    const games = new Set(hs.map((h) => h.game.id)).size;
    tabsHtml += `<button type="button" role="tab" class="ptab" data-pattern="${p}" aria-selected="${p === active}" ${p === active ? '' : 'tabindex="-1"'}><span class="rank">${idx + 1}</span><span class="ptab-title">${info.title}</span><span class="ptab-n">${games}/${n}</span></button>`;
    patternHtml += `<div class="card pattern" role="tabpanel" data-pattern="${p}" ${p === active ? '' : 'hidden'}><div class="phead"><h3>${info.title}</h3><span class="stat">${hs.length} ${t('times')} · ${t('inGames', { k: games, n })} · ${ph}</span></div>
<p class="what">${info.what}${extra}</p><p class="fix"><b>${t('doThis')}:</b> ${info.fix}</p><p class="drill"><b>${t('drill')}:</b> ${info.drill}</p>
<div class="examples">${worst.map(example).join('')}</div></div>`;
  });

  const opRows = Object.entries(openings).sort((a, b) => b[1].length - a[1].length).slice(0, 14).filter(([, l]) => l.length >= 2).map(([k, lst]) => {
    const [color, name] = k.split('|');
    const wins = lst.filter(([, o]) => o === 'win').length;
    const wp10s = lst.map(([, , w]) => w).filter((w) => w != null);
    return `<tr><td>${t(color)}</td><td>${esc(name)}</td><td>${lst.length}</td><td>${(100 * wins / lst.length).toFixed(0)} %</td><td>${mean(lst.map(([a]) => a)).toFixed(0)} %</td><td>${wp10s.length ? mean(wp10s).toFixed(0) + ' %' : '–'}</td></tr>`;
  }).join('');

  const gameRows = [...recs].reverse().map((r) => {
    const g = r.meta, a = myAcc(r, blend);
    const bl = r.moves.filter((m) => m.mine && m.label === 'Blunder').length;
    const mi = r.moves.filter((m) => m.mine && m.label === 'Mistake').length;
    return `<tr class="${g.outcome}"><td>${fmtDate(g.endTime).slice(5)}</td><td>${g.color === 'white' ? t('W') : t('B')}</td><td>${esc(g.opponent)} (${g.oppRating})</td><td>${t(g.outcome)}</td><td>${esc(r.opening.split(':')[0])}</td><td>${a.toFixed(0)}</td><td>${g.ccAccuracy ? g.ccAccuracy.toFixed(0) : '–'}</td><td>${mi}</td><td>${bl}</td><td><a href="#" data-game="${r.id}" class="show-game">${t('report')}</a> · <a href="${esc(g.url)}" target="_blank" rel="noopener">chess.com</a></td></tr>`;
  }).join('');

  const colorCard = (c) => {
    const lst = recs.map((r, i) => [r, accs[i]]).filter(([r]) => r.meta.color === c);
    if (!lst.length) return '';
    const w = lst.filter(([r]) => r.meta.outcome === 'win').length;
    return `<div class="card"><h2>${c === 'white' ? t('asWhite') : t('asBlack')}</h2><div class="big">${mean(lst.map(([, a]) => a)).toFixed(0)}<small>%</small></div><div class="muted">${t('gamesN', { n: lst.length })} · ${(100 * w / lst.length).toFixed(0)} ${t('winPct')}</div></div>`;
  };

  const labelsHtml = LABEL_ORDER.filter((k) => labelCounts[k]).map((k) => `<div class="cnt"><span class="dot" style="background:${COLORS[k]}"></span>${k}<span class="muted">${(100 * labelCounts[k] / myMoves).toFixed(1)} %</span><b>${labelCounts[k]}</b></div>`).join('');
  const phaseHtml = PHASES.map((ph) => { const b = phaseBad[ph] || 0, tot = phaseMoves[ph] || 0; return `<div class="cnt">${t(ph)}<span class="muted">${b} ${t('of')} ${tot} ${t('moves')}</span><b>${(100 * b / Math.max(1, tot)).toFixed(1)} %</b></div>${bar(100 * b / Math.max(1, tot) * 5, '#e67e22')}`; }).join('');
  const howLost = Object.entries(lossHow).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${t(k)} ${v}`).join(', ');
  const timeHtml = spentBad.length && spentOk.length
    ? `<div class="cnt">${t('avgPerMove')}<b>${mean(spentOk).toFixed(1)} s</b></div><div class="cnt">${t('avgOnBad')}<b>${mean(spentBad).toFixed(1)} s</b></div><div class="cnt">${t('badFast')}<b>${spentBad.filter((s) => s <= 3).length} ${t('of')} ${spentBad.length}</b></div>`
    : `<div class="muted">${t('noClocks')}</div>`;
  const classes = [...new Set(recs.map((r) => r.meta.timeClass))].sort().join(', ');
  const calibNote = calib ? ` · ${t('calibNote', { n: calib.n, err: calib.err.toFixed(1) })}` : '';

  let main = 'overview';
  try { main = localStorage.getItem('mainTab') || 'overview'; } catch { /* ignore */ }
  const sec = (id, html) => `<section class="mtab-panel" role="tabpanel" data-main="${id}" ${id === main ? '' : 'hidden'}>${html}</section>`;
  const mtab = (id, label) => `<button type="button" role="tab" class="mtab" data-main="${id}" aria-selected="${id === main}" ${id === main ? '' : 'tabindex="-1"'}>${label}</button>`;
  return `
<h1>${esc(user)} – ${t('gamesN', { n })} (${classes})</h1>
<div class="sub">${outcomes.win || 0} ${t('wins')} · ${outcomes.loss || 0} ${t('losses')} · ${outcomes.draw || 0} ${t('draws')} · ${t('lostBy')}: ${howLost || '–'}${calibNote}</div>
<div class="mtabs" role="tablist">${mtab('overview', t('tabOverview'))}${mtab('patterns', t('tabPatterns'))}${mtab('openings', t('tabOpenings'))}${mtab('games', t('tabGames'))}</div>
${sec('overview', `<div class="grid">
<div class="card"><h2>${t('eloHead')}</h2>${elo ? `<div class="big">${elo.low}–${elo.high}</div><div class="muted">${t('eloNote', { n: elo.n, cls: elo.cls, a: elo.byAcc, p: elo.perf, r: elo.current })}</div>` : `<div class="muted">${t('eloFew')}</div>`}</div>
<div class="card"><h2>${t('accAvg')}</h2><div class="big">${mean(accs).toFixed(0)}<small>%</small></div><div class="muted">${t('last10')}: ${mean(accs.slice(-10)).toFixed(0)} % · ${t('ratingNow')} ${ratings[ratings.length - 1]}</div></div>
${colorCard('white')}${colorCard('black')}
<div class="card"><h2>${t('time')}</h2>${timeHtml}</div>
</div>
<div class="grid">
<div class="card"><h2>${t('accChart')}</h2>${lineChart(accs, { smooth: movingAvg(accs), hline: mean(accs) })}</div>
<div class="card"><h2>${t('rating')}</h2>${lineChart(ratings, { y0: Math.min(...ratings) - 30, y1: Math.max(...ratings) + 30, color: '#3498db' })}</div>
</div>
<div class="grid">
<div class="card"><h2>${t('yourMoves')} (${myMoves})</h2>${labelsHtml}</div>
<div class="card"><h2>${t('badPerPhase')}</h2>${phaseHtml}</div>
</div>`)}
${sec('patterns', `<h2 class="section">${t('patternsHead')}</h2>
${patternHtml ? `<div class="ptabs" role="tablist">${tabsHtml}</div>${patternHtml}` : `<p class="muted">${t('noPatterns')}</p>`}`)}
${sec('openings', `<div class="card"><h2>${t('openings')}</h2><div class="tbl"><table><tr><th>${t('color')}</th><th>${t('openingCol')}</th><th>${t('games')}</th><th>${t('winCol')}</th><th>${t('accCol')}</th><th>${t('wp10')}</th></tr>${opRows}</table></div></div>`)}
${sec('games', `<div class="card"><h2>${t('allGames')}</h2><div class="tbl"><table><tr><th>${t('date')}</th><th></th><th>${t('opponent')}</th><th>${t('result')}</th><th>${t('openingCol')}</th><th>Acc</th><th>chess.com</th><th title="Mistake">?</th><th title="Blunder">??</th><th></th></tr>${gameRows}</table></div></div>`)}`;
}

// Partirapport: eval-graf + draglista
export function renderGame(rec, blend) {
  const g = rec.meta, h = rec.headers || {};
  const infosWp = [winPct(rec.moves.length ? rec.moves[0].cpBefore : 0), ...rec.moves.map((m) => winPct(m.cpAfter))];
  const W = 900, H = 200, P = 10, n = infosWp.length;
  const xs = infosWp.map((_, i) => P + (W - 2 * P) * (n > 1 ? i / (n - 1) : 0));
  const ys = infosWp.map((v) => P + (H - 2 * P) * (1 - v / 100));
  const area = `M${xs[0].toFixed(1)},${H - P} ` + xs.map((x, i) => `L${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ') + ` L${xs[n - 1].toFixed(1)},${H - P} Z`;
  const marks = rec.moves.filter((m) => ['Blunder', 'Mistake', 'Inaccuracy', 'Brilliant', 'Great'].includes(m.label))
    .map((m) => `<circle cx="${xs[m.ply].toFixed(1)}" cy="${ys[m.ply].toFixed(1)}" r="5" fill="${COLORS[m.label]}" stroke="#222"><title>${m.ply}: ${esc(m.san)} – ${m.label}</title></circle>`).join('');
  const cell = (m) => (m ? `<td class="san" title="${t('tooltip', { a: m.wpBefore.toFixed(0), b: m.wpAfter.toFixed(0), best: esc(m.bestSan) })}">${esc(m.san)}</td><td>${tag(m.label)}</td><td class="ev">${fmtEval(m.cpAfter)}</td>` : '<td></td><td></td><td></td>');
  let rows = '';
  for (let i = 0; i < rec.moves.length; i += 2) rows += `<tr><td class="num">${Math.floor(i / 2) + 1}.</td>${cell(rec.moves[i])}${cell(rec.moves[i + 1])}</tr>`;
  const summary = (color) => {
    const c = {};
    for (const m of rec.moves) if (m.color === color) c[m.label] = (c[m.label] || 0) + 1;
    return `<div class="acc">${blendAcc(rec.accuracy[color], blend).toFixed(1)}<small>%</small></div>` + LABEL_ORDER.filter((k) => c[k]).map((k) => `<div class="cnt"><span class="dot" style="background:${COLORS[k]}"></span>${k}<b>${c[k]}</b></div>`).join('');
  };
  return `<div class="gamehead"><div><b>${esc(h.White)} (${esc(h.WhiteElo)}) – ${esc(h.Black)} (${esc(h.BlackElo)})</b> ${esc(h.Result)}<br><span class="muted">${esc(rec.opening)} · ${esc(h.Date)} · ${esc(h.Termination || '')}</span></div><a href="${esc(g.url)}" target="_blank" rel="noopener">chess.com</a> <button class="close-game" type="button">${t('close')}</button></div>
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="evalgraph"><rect width="${W}" height="${H}" fill="#3b3b3b"/><path d="${area}" fill="#f0f0f0"/><line x1="${P}" y1="${H / 2}" x2="${W - P}" y2="${H / 2}" stroke="#c0392b" stroke-dasharray="4 4" opacity=".7"/>${marks}</svg>
<div class="grid"><div class="card"><h2>${t('white')} · ${esc(h.White)}</h2>${summary('white')}</div><div class="card"><h2>${t('black')} · ${esc(h.Black)}</h2>${summary('black')}</div></div>
<div class="card"><div class="tbl"><table class="moves">${rows}</table></div></div>`;
}
