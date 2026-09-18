// Flöde: användarnamn -> hämta partier från chess.com -> analysera i webbläsaren -> dashboard.
import { Engine } from './engine.js';
import { loadBook, parsePgn, analyseGame, reviewMoves, openingName, accuracyParts, ACC_BLEND } from './review.js';
import { loadReviews, saveReview, clearUser } from './storage.js';
import { renderDashboard, renderGame, calibrate } from './dashboard.js';

const $ = (s) => document.querySelector(s);
const UA_NOTE = 'schackstat (github pages, personal analysis)';
const PROFILES = { fast: { depth: 10, movetime: 400 }, normal: { depth: 14, movetime: 1000 }, deep: { depth: 18, movetime: 3000 } };
const DRAW_RESULTS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

const state = { user: null, recs: [], engine: null, running: false, stop: false, blend: ACC_BLEND };

async function api(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (r.status === 404) throw new Error('Hittar ingen chess.com-användare med det namnet.');
  if (!r.ok) throw new Error(`chess.com svarade ${r.status}`);
  return r.json();
}

function metaFor(g, user) {
  const me = g.white.username.toLowerCase() === user.toLowerCase() ? 'white' : 'black';
  const opp = me === 'white' ? 'black' : 'white';
  const res = g[me].result;
  return {
    url: g.url, endTime: g.end_time, timeClass: g.time_class, timeControl: g.time_control, rated: g.rated,
    color: me, myRating: g[me].rating, oppRating: g[opp].rating, opponent: g[opp].username, result: res,
    outcome: res === 'win' ? 'win' : DRAW_RESULTS.has(res) ? 'draw' : 'loss',
    ccAccuracy: g.accuracies ? g.accuracies[me] : null,
  };
}

// Hämtar partier nyast först tills vi har `limit` oanalyserade i valda tidsklasser.
async function fetchCandidates(user, classes, limit, have) {
  const { archives } = await api(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
  const out = [];
  for (const url of archives.slice().reverse()) {
    const { games } = await api(url);
    for (const g of games.slice().reverse()) {
      if (g.rules !== 'chess' || !g.pgn) continue;
      const id = g.url.split('/').pop();
      if (!classes.has(g.time_class) || have.has(id)) continue;
      out.push({ id, pgn: g.pgn, meta: metaFor(g, user) });
      if (limit && out.length >= limit) return out;
    }
  }
  return out;
}

function setProgress(text, frac) {
  $('#progress').hidden = false;
  $('#progress-text').textContent = text;
  $('#progress-bar').style.width = `${Math.round((frac || 0) * 100)}%`;
}

function render() {
  const recs = [...state.recs].sort((a, b) => a.meta.endTime - b.meta.endTime);
  const calib = calibrate(recs);
  state.blend = calib ? calib.blend : ACC_BLEND;
  $('#dashboard').innerHTML = recs.length ? renderDashboard(recs, state.user, state.blend, calib) : '';
  $('#empty').hidden = recs.length > 0;
  $('#clear').hidden = recs.length === 0;
}

async function analyseOne(cand, book, limit) {
  const { header, history, clocks } = parsePgn(cand.pgn);
  const res = await analyseGame(history, state.engine, limit,
    (i, n) => setProgress(`${cand.meta.opponent} · drag ${i}/${n}`, i / n), () => state.stop);
  if (!res) return null;
  const { infos, fens } = res;
  const reviews = reviewMoves(history, fens, infos, book);
  const myColor = cand.meta.color;
  return {
    id: cand.id, meta: cand.meta, opening: openingName(fens, book), headers: header, plies: history.length,
    accuracy: { white: accuracyParts(reviews, infos, 'white'), black: accuracyParts(reviews, infos, 'black') },
    moves: reviews.map((r, i) => ({ ...r, mine: r.color === myColor, clock: clocks[i] ?? null })),
  };
}

async function run() {
  const user = $('#user').value.trim();
  if (!user) return;
  const classes = new Set([...document.querySelectorAll('input[name=cls]:checked')].map((e) => e.value));
  const limit = Number($('#count').value);
  const profile = PROFILES[$('#profile').value];
  history.replaceState(null, '', `?user=${encodeURIComponent(user)}`);

  state.user = user; state.running = true; state.stop = false;
  $('#run').hidden = true; $('#stop').hidden = false; $('#error').hidden = true;
  try {
    setProgress('Laddar sparad analys …', 0);
    state.recs = await loadReviews(user);
    render();
    setProgress('Hämtar partier från chess.com …', 0);
    const have = new Set(state.recs.map((r) => r.id));
    const cands = await fetchCandidates(user, classes, limit, have);
    if (!cands.length) { setProgress('Inga nya partier att analysera.', 1); return; }
    setProgress('Startar Stockfish …', 0);
    const book = await loadBook();
    if (!state.engine) { state.engine = new Engine(); await state.engine.init(); }
    for (let k = 0; k < cands.length; k++) {
      if (state.stop) break;
      $('#progress-game').textContent = `Parti ${k + 1} av ${cands.length}`;
      const rec = await analyseOne(cands[k], book, profile);
      if (!rec) break;
      state.recs.push(rec);
      await saveReview(user, rec);
      render();
    }
    setProgress(state.stop ? 'Stoppad – det som hann analyseras är sparat.' : 'Klart. Kör igen senare för att lägga till nya partier.', 1);
    $('#progress-game').textContent = '';
  } catch (e) {
    $('#error').textContent = e.message; $('#error').hidden = false;
    $('#progress').hidden = true;
  } finally {
    state.running = false; $('#run').hidden = false; $('#stop').hidden = true;
  }
}

function showGame(id) {
  const rec = state.recs.find((r) => r.id === id);
  if (!rec) return;
  const panel = $('#game');
  panel.innerHTML = renderGame(rec, state.blend);
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a.show-game');
  if (a) { e.preventDefault(); showGame(a.dataset.game); }
  if (e.target.closest('.close-game')) { $('#game').hidden = true; $('#game').innerHTML = ''; }
});
$('#run').addEventListener('click', run);
$('#stop').addEventListener('click', () => { state.stop = true; state.engine?.stop(); });
$('#form').addEventListener('submit', (e) => { e.preventDefault(); if (!state.running) run(); });
$('#clear').addEventListener('click', async () => {
  if (!state.user || !confirm(`Ta bort sparad analys för ${state.user} i den här webbläsaren?`)) return;
  await clearUser(state.user); state.recs = []; render();
});

// ?user=namn förifyller och visar sparad analys direkt
const initial = new URLSearchParams(location.search).get('user');
if (initial) {
  $('#user').value = initial;
  state.user = initial;
  loadReviews(initial).then((recs) => { state.recs = recs; render(); });
}
