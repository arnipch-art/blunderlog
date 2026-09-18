// Två språk. t(key, vars) slår upp i aktuellt språk; {x} i strängen byts mot vars.x.
const STRINGS = {
  sv: {
    tagline: 'Stockfish går igenom dina chess.com-partier och visar vilka misstag du gör om och om igen – och vad du ska göra åt dem. Allt körs i din webbläsare, inget skickas någonstans.',
    user: 'chess.com-användarnamn', games: 'Partier', last: '{n} senaste', all: 'alla',
    accuracyLevel: 'Noggrannhet', fast: 'snabb (djup 10)', normal: 'normal (djup 14)', deep: 'noggrann (djup 18)',
    timeClass: 'Tidsklass', analyse: 'Analysera', stop: 'Stoppa', clear: 'Rensa sparat',
    autoCheck: 'Kolla efter nya partier automatiskt när sidan öppnas',
    empty: 'Ett parti tar några sekunder upp till en halv minut att analysera beroende på dator och noggrannhet. Resultaten sparas i webbläsaren, så nästa gång analyseras bara nya partier. Bullet är avstängt som standard – det säger mindre om hur du tänker.',
    footer: 'Motor: {sf} (GPLv3) · dragregler: {cj} · öppningsnamn: {lo} · partier via {cc}. Etiketter och accuracy följer chess.com:s publika beskrivning (win%-tapp per drag) men är en egen implementation och skiljer sig något från chess.com:s siffror. Öppen källkod: {gh}.',
    loadingSaved: 'Laddar sparad analys …', fetching: 'Hämtar partier från chess.com …', noNew: 'Inga nya partier att analysera.',
    starting: 'Startar Stockfish …', gameOf: 'Parti {k} av {n}', moveOf: '{opp} · drag {i}/{n}',
    stopped: 'Stoppad – det som hann analyseras är sparat.', done: 'Klart. Kör igen senare för att lägga till nya partier.',
    notFound: 'Hittar ingen chess.com-användare med det namnet.', apiError: 'chess.com svarade {status}',
    confirmClear: 'Ta bort sparad analys för {user} i den här webbläsaren?',
    gamesN: '{n} partier', wins: 'vinster', losses: 'förluster', draws: 'remier', lostBy: 'förluster genom',
    checkmated: 'matt', resigned: 'gav upp', timeout: 'tiden', abandoned: 'lämnade',
    calibNote: 'accuracy kalibrerad mot {n} chess.com-siffror (medelfel {err} %)',
    accAvg: 'Accuracy (snitt)', last10: 'senaste 10', ratingNow: 'rating nu', asWhite: 'Som vit', asBlack: 'Som svart', winPct: '% vinster',
    time: 'Tid', avgPerMove: 'Snitt-tid per drag', avgOnBad: 'Snitt-tid på misstag/blunders', badFast: 'Misstag gjorda på ≤3 s', of: 'av', noClocks: 'inga klocktider',
    accChart: 'Accuracy per parti (linje = glidande medel 5)', rating: 'Rating', yourMoves: 'Dina drag', badPerPhase: 'Misstag+blunders per fas', moves: 'drag',
    patternsHead: 'Det här går igen – jobba på det i den här ordningen', noPatterns: 'Inga mönster hittade.',
    times: 'ggr', perGame: '/parti', opening: 'öppning', middlegame: 'mittspel', endgame: 'slutspel',
    hungPieces: 'Pjäser du hängt', queen: 'dam', rook: 'torn', bishop: 'löpare', knight: 'springare', pawn: 'bonde', king: 'kung',
    doThis: 'Gör så här', drill: 'Övning', best: 'bäst', thought: 'tänkte {s}s', left: '{s}s kvar', report: 'rapport', close: 'Stäng',
    openings: 'Öppningar (minst 2 partier)', color: 'Färg', openingCol: 'Öppning', winCol: 'Vinst', accCol: 'Accuracy', wp10: 'Vinstchans vid drag 10',
    allGames: 'Alla partier', date: 'Datum', opponent: 'Motståndare', result: 'Resultat', white: 'Vit', black: 'Svart', W: 'V', B: 'S',
    win: 'vinst', loss: 'förlust', draw: 'remi', tooltip: 'win% {a} → {b} · bäst: {best}',
    eloHead: 'Uppskattad spelstyrka', eloNote: 'senaste {n} partier · accuracy säger {a} · resultat mot motstånd säger {p} · chess.com-rating {r}',
    eloFew: 'behöver minst 3 partier', eloCol: 'Est.',
  },
  en: {
    tagline: 'Stockfish goes through your chess.com games and shows which mistakes you keep making – and what to do about them. Everything runs in your browser; nothing is sent anywhere.',
    user: 'chess.com username', games: 'Games', last: 'last {n}', all: 'all',
    accuracyLevel: 'Precision', fast: 'fast (depth 10)', normal: 'normal (depth 14)', deep: 'thorough (depth 18)',
    timeClass: 'Time class', analyse: 'Analyse', stop: 'Stop', clear: 'Clear saved',
    autoCheck: 'Check for new games automatically when the page opens',
    empty: 'A game takes a few seconds up to half a minute to analyse depending on your computer and the precision setting. Results are saved in your browser, so next time only new games are analysed. Bullet is off by default – it says less about how you think.',
    footer: 'Engine: {sf} (GPLv3) · move rules: {cj} · opening names: {lo} · games via {cc}. Labels and accuracy follow chess.com\'s public description (win% loss per move) but are an independent implementation and differ somewhat from chess.com\'s numbers. Open source: {gh}.',
    loadingSaved: 'Loading saved analysis …', fetching: 'Fetching games from chess.com …', noNew: 'No new games to analyse.',
    starting: 'Starting Stockfish …', gameOf: 'Game {k} of {n}', moveOf: '{opp} · move {i}/{n}',
    stopped: 'Stopped – everything analysed so far is saved.', done: 'Done. Run again later to add new games.',
    notFound: 'No chess.com user with that name.', apiError: 'chess.com replied {status}',
    confirmClear: 'Remove saved analysis for {user} in this browser?',
    gamesN: '{n} games', wins: 'wins', losses: 'losses', draws: 'draws', lostBy: 'losses by',
    checkmated: 'checkmate', resigned: 'resignation', timeout: 'time', abandoned: 'abandoned',
    calibNote: 'accuracy calibrated against {n} chess.com figures (mean error {err} %)',
    accAvg: 'Accuracy (average)', last10: 'last 10', ratingNow: 'rating now', asWhite: 'As White', asBlack: 'As Black', winPct: '% wins',
    time: 'Time', avgPerMove: 'Average time per move', avgOnBad: 'Average time on mistakes/blunders', badFast: 'Mistakes made in ≤3 s', of: 'of', noClocks: 'no clock data',
    accChart: 'Accuracy per game (line = 5-game moving average)', rating: 'Rating', yourMoves: 'Your moves', badPerPhase: 'Mistakes+blunders per phase', moves: 'moves',
    patternsHead: 'What keeps happening – work on these in this order', noPatterns: 'No patterns found.',
    times: 'times', perGame: '/game', opening: 'opening', middlegame: 'middlegame', endgame: 'endgame',
    hungPieces: 'Pieces you hung', queen: 'queen', rook: 'rook', bishop: 'bishop', knight: 'knight', pawn: 'pawn', king: 'king',
    doThis: 'Do this', drill: 'Drill', best: 'best', thought: 'thought {s}s', left: '{s}s left', report: 'report', close: 'Close',
    openings: 'Openings (at least 2 games)', color: 'Color', openingCol: 'Opening', winCol: 'Win', accCol: 'Accuracy', wp10: 'Win chance at move 10',
    allGames: 'All games', date: 'Date', opponent: 'Opponent', result: 'Result', white: 'White', black: 'Black', W: 'W', B: 'B',
    win: 'win', loss: 'loss', draw: 'draw', tooltip: 'win% {a} → {b} · best: {best}',
    eloHead: 'Estimated strength', eloNote: 'last {n} games · accuracy suggests {a} · results vs opposition suggest {p} · chess.com rating {r}',
    eloFew: 'needs at least 3 games', eloCol: 'Est.',
  },
};

let lang = 'sv';
try { lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('lang') || (navigator.language.startsWith('sv') ? 'sv' : 'en'); } catch { /* ignore */ }
if (!STRINGS[lang]) lang = 'sv';

export const getLang = () => lang;
export function setLang(l) {
  if (!STRINGS[l]) return;
  lang = l;
  try { localStorage.setItem('lang', l); } catch { /* ignore */ }
  document.documentElement.lang = l;
}
export function t(key, vars) {
  let s = STRINGS[lang][key] ?? STRINGS.sv[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
