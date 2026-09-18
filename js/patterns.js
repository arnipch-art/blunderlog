// Återkommande misstagsmönster – räknas på spelarens egna drag. Port av stats.py.
import { Chess } from '../vendor/chess.js';
import { PIECE_VALUE, see } from './review.js';
import { getLang } from './i18n.js';

const PATTERN_TEXT = {
  sv: {
    hung_piece: { title: 'Hängde en pjäs', what: 'Du gjorde ett drag som lät motståndaren ta en pjäs gratis (eller vinna klart material) med sitt bästa svar.', fix: 'Innan du släpper pjäsen: kolla varje pjäs som motståndaren kan slå – är den skyddad? Fråga särskilt "vad kan slå den ruta jag just flyttade till, och vad lämnade jag oskyddat?" Gör det till en fast rutin, även när draget känns självklart.', drill: 'Chess.com: Puzzles → "Hanging pieces". 10 min/dag i en vecka.' },
    fork_check: { title: 'Gick in i schack/gaffel', what: 'Motståndarens bästa svar var ett schack (ofta en gaffel) som kostade dig material eller ställningen.', fix: 'Innan varje drag: kan motståndaren ge schack efter det? Om ja – vad händer efter schacken? Springargafflar mot kung+dam och kung+torn är det vanligaste mönstret.', drill: 'Puzzles-teman "Fork" och "Discovered attack".' },
    missed_free_piece: { title: 'Missade att ta en pjäs', what: 'Bästa draget var att slå en pjäs som stod oskyddad (eller vinna material direkt), men du spelade något annat.', fix: 'Börja varje drag med att titta på alla slag du kan göra – innan du tänker på planer. "Checks, captures, threats" i den ordningen.', drill: 'Puzzles "Hanging piece" + spela långsammare i ställningar med spänning.' },
    missed_mate: { title: 'Missade forcerad matt', what: 'Du hade en forcerad matt men spelade ett drag som släppte den.', fix: 'När motståndarens kung är öppen: leta schackar först. Räkna en schack-sekvens till slut innan du väljer ett lugnt drag.', drill: 'Puzzles "Mate in 2" / "Mate in 3".' },
    missed_punish: { title: 'Straffade inte motståndarens blunder', what: 'Motståndaren gjorde precis ett stort misstag, men ditt svar tog inte vara på det.', fix: 'När motståndaren gör ett drag som ser konstigt ut: stanna upp. Fråga "vad slutade den pjäsen skydda?" och "vilken ruta lämnade den?"', drill: 'Efter varje parti: klicka igenom motståndarens blunders och se vad motorn ville.' },
    threw_won: { title: 'Tappade en vunnen ställning', what: 'Du hade ≥80 % vinstchans och ett enda drag tog dig ner till jämnt eller sämre.', fix: 'När du leder: förenkla. Byt av pjäser, undvik komplikationer, håll kungen säker. Ett tråkigt drag som behåller +5 är bättre än ett spännande som riskerar allt.', drill: 'Öva att vinna vunna slutspel mot en dator (torn+kung mot kung, en extra pjäs).' },
    time_trouble: { title: 'Misstag i tidsnöd', what: 'Misstag/blunder gjorda med under 30 sekunder kvar på klockan.', fix: 'Använd tiden jämnare: de flesta 10-minutersspelare bränner för mycket i öppningen. Ha ett par öppningar du kan utantill så de första 8–10 dragen går fort.', drill: 'Lär dig 1 öppning som vit och 1 svar mot e4 + 1 mot d4 till drag 8.' },
    rushed: { title: 'Spelade för snabbt med tid kvar', what: 'Misstag/blunder där du tänkte ≤3 sekunder trots att du hade gott om tid.', fix: 'Om ett drag är ett slag, ett schack eller flyttar en pjäs till motståndarens halva: ta alltid minst 10 sekunder. Snabba drag är okej i lugna ställningar – inte när det finns kontakt mellan pjäserna.', drill: 'Spela några partier där du tvingar dig att sitta på händerna 5 sekunder varje drag.' },
    opening_trouble: { title: 'Dålig ställning redan efter öppningen', what: 'Vid drag 10 hade du ≤35 % vinstchans – partiet var redan i uppförsbacke.', fix: 'Se öppningstabellen: de öppningar där det går sämst är där du bör lära dig de första 8 dragen ordentligt, eller byta.', drill: 'Chess.com Lessons/Openings för den öppning du oftast hamnar i.' },
  },
  en: {
    hung_piece: { title: 'Hung a piece', what: 'You made a move that let your opponent take a piece for free (or win clear material) with their best reply.', fix: 'Before you let go of the piece: check every piece your opponent can capture – is it defended? Ask especially "what can capture the square I just moved to, and what did I leave undefended?" Make it a fixed routine, even when the move feels obvious.', drill: 'Chess.com: Puzzles → "Hanging pieces". 10 min/day for a week.' },
    fork_check: { title: 'Walked into a check/fork', what: 'Your opponent\'s best reply was a check (often a fork) that cost you material or the position.', fix: 'Before every move: can the opponent give check after it? If yes – what happens after the check? Knight forks on king+queen and king+rook are the most common pattern.', drill: 'Puzzle themes "Fork" and "Discovered attack".' },
    missed_free_piece: { title: 'Missed a free piece', what: 'The best move was to capture an undefended piece (or win material directly), but you played something else.', fix: 'Start every move by looking at all your captures – before thinking about plans. "Checks, captures, threats", in that order.', drill: 'Puzzles "Hanging piece" + play slower in positions with tension.' },
    missed_mate: { title: 'Missed a forced mate', what: 'You had a forced mate but played a move that let it go.', fix: 'When the opponent\'s king is exposed: look for checks first. Calculate a checking sequence to the end before choosing a quiet move.', drill: 'Puzzles "Mate in 2" / "Mate in 3".' },
    missed_punish: { title: 'Didn\'t punish the opponent\'s blunder', what: 'Your opponent just made a big mistake, but your reply didn\'t take advantage of it.', fix: 'When the opponent plays a move that looks odd: stop. Ask "what did that piece stop defending?" and "which square did it leave?"', drill: 'After every game: click through your opponent\'s blunders and see what the engine wanted.' },
    threw_won: { title: 'Threw away a winning position', what: 'You had a ≥80 % win chance and a single move took you down to equal or worse.', fix: 'When you\'re ahead: simplify. Trade pieces, avoid complications, keep your king safe. A boring move that keeps +5 beats an exciting one that risks everything.', drill: 'Practise winning won endgames against a computer (rook+king vs king, an extra piece).' },
    time_trouble: { title: 'Mistakes in time trouble', what: 'Mistakes/blunders made with under 30 seconds left on the clock.', fix: 'Spend time more evenly: most 10-minute players burn too much in the opening. Have a couple of openings you know by heart so the first 8–10 moves go fast.', drill: 'Learn 1 opening as White and 1 reply to e4 + 1 to d4 up to move 8.' },
    rushed: { title: 'Played too fast with time to spare', what: 'Mistakes/blunders where you thought for ≤3 seconds despite having plenty of time.', fix: 'If a move is a capture, a check or moves a piece into the opponent\'s half: always take at least 10 seconds. Fast moves are fine in quiet positions – not when pieces are in contact.', drill: 'Play a few games where you force yourself to sit on your hands for 5 seconds every move.' },
    opening_trouble: { title: 'Bad position straight out of the opening', what: 'At move 10 you had a ≤35 % win chance – the game was already uphill.', fix: 'See the openings table: the openings where it goes worst are the ones to learn the first 8 moves of properly, or drop.', drill: 'Chess.com Lessons/Openings for the opening you most often end up in.' },
  },
};
export const PATTERN_KEYS = Object.keys(PATTERN_TEXT.sv);
export const patternInfo = (key) => PATTERN_TEXT[getLang()][key] || PATTERN_TEXT.sv[key];

export const PHASES = ['opening', 'middlegame', 'endgame'];

export function phaseOf(fen, moveNo) {
  const placement = fen.split(' ')[0];
  let material = 0;
  for (const ch of placement) {
    const t = ch.toLowerCase();
    if (t === 'n' || t === 'b' || t === 'r' || t === 'q') material += PIECE_VALUE[t];
  }
  if (material <= 14) return 'endgame';
  return moveNo <= 10 ? 'opening' : 'middlegame';
}

export const incrementOf = (tc) => (tc && tc.includes('+') ? Number(tc.split('+')[1]) : 0);

const uciToMove = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

export function detectPatterns(rec) {
  const hits = [];
  const moves = rec.moves;
  const inc = incrementOf(rec.meta.timeControl);
  let prevClock = null;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (!m.mine) continue;
    const moveNo = Math.floor((m.ply + 1) / 2);
    let spent = null;
    if (m.clock != null && prevClock != null) spent = Math.max(0, prevClock + inc - m.clock);
    prevClock = m.clock;
    const base = {
      ply: m.ply, san: m.san, bestSan: m.bestSan, loss: m.loss, fen: m.fen, uci: m.uci, best: m.best,
      label: m.label, phase: phaseOf(m.fen, moveNo), moveNo, spent, clock: m.clock, game: rec,
    };
    const bad = m.label === 'Mistake' || m.label === 'Blunder';
    const sign = m.color === 'white' ? 1 : -1;

    if (m.cpBefore * sign >= 9000 && m.cpAfter * sign < 9000 && m.uci !== m.best) hits.push({ ...base, pattern: 'missed_mate' });

    if (m.loss >= 5 && m.best && m.uci !== m.best) {
      const c = new Chess(m.fen);
      const bm = c.moves({ verbose: true }).find((x) => x.lan === m.best || x.from + x.to + (x.promotion || '') === m.best);
      if (bm && bm.flags.includes('c') && see(m.fen, bm) >= 3) hits.push({ ...base, pattern: 'missed_free_piece' });
    }

    let ownTactic = false;
    if (bad && m.replyBest) {
      const c = new Chess(m.fen);
      c.move(uciToMove(m.uci));
      const afterFen = c.fen();
      const reply = c.moves({ verbose: true }).find((x) => x.from + x.to + (x.promotion || '') === m.replyBest);
      if (reply) {
        if (reply.flags.includes('c') && see(afterFen, reply) >= 3) {
          hits.push({ ...base, pattern: 'hung_piece', victim: reply.captured }); ownTactic = true;
        } else {
          c.move(reply);
          if (c.isCheck()) { hits.push({ ...base, pattern: 'fork_check' }); ownTactic = true; }
        }
      }
    }

    // straffade inte: bara när det inte samtidigt var en egen hängning/gaffel (då är det den diagnosen som gäller)
    if (bad && !ownTactic && i > 0 && (moves[i - 1].label === 'Mistake' || moves[i - 1].label === 'Blunder') && m.loss >= 10) {
      hits.push({ ...base, pattern: 'missed_punish' });
    }
    if (m.wpBefore >= 80 && m.wpAfter <= 55) hits.push({ ...base, pattern: 'threw_won' });
    if (bad && m.clock != null && m.clock < 30) hits.push({ ...base, pattern: 'time_trouble' });
    else if (bad && spent != null && spent <= 3 && m.clock != null && m.clock >= 60) hits.push({ ...base, pattern: 'rushed' });
    if (moveNo === 10 && m.wpAfter <= 35) hits.push({ ...base, pattern: 'opening_trouble' });
  }
  return hits;
}
