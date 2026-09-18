# Blunderlog

Skriv in ditt chess.com-användarnamn och få en Stockfish-granskning av dina partier – accuracy, uppskattad spelstyrka, öppningar och de misstag du upprepar, med konkreta råd. Svenska och engelska. Allt körs i din webbläsare (Stockfish som WebAssembly); inget skickas till någon server och resultaten sparas lokalt i webbläsaren så att bara nya partier analyseras nästa gång.

**Sidan:** https://arnipch-art.github.io/blunderlog/ — dela din egen vy med `?user=ditt_namn`.

## Hur det funkar

1. Partierna hämtas från [chess.com:s öppna API](https://www.chess.com/news/view/published-data-api) (ingen inloggning, klocktider ingår).
2. Varje ställning analyseras av Stockfish 19 lite (MultiPV 2) med djup + tidstak.
3. Formlerna för win% och accuracy är Lichess publika (chess.com bygger på samma); etikett-trösklarna är egna. Eval → vinstprocent via `50 + 50·(2/(1+e^(−0.00368208·cp)) − 1)`; tappet i vinstprocent per drag ger etiketten (Best/Excellent/Good/Inaccuracy/Mistake/Blunder). Book slås upp i lichess öppningsdatabas, Great = enda bra draget, Brilliant = bästa draget som offrar material.
4. Accuracy per drag `103.1668·e^(−0.04354·tapp) − 3.1669`, viktat med ställningens volatilitet; blandningen viktat/harmoniskt medel kalibreras mot chess.com:s egna accuracy-siffror när sådana finns.
5. Uppskattad spelstyrka visas som ett intervall mellan två skattningar över de senaste 20 partierna i din vanligaste tidsklass: accuracy→rating (handvalda ankarpunkter i `js/elo.js` – grova, inte fittade mot data) och prestationsrating mot motståndarnas rating (som på chess.com ≈ din egen rating ± form). En uppskattning, inte en rating.
6. Mönster (hängd pjäs, gaffel, missad fri pjäs, missad matt, ostraffad blunder, tappad vinst, tidsnöd, för snabba drag, öppningsproblem) räknas på dina drag och rangordnas.

## Köra lokalt

Öppna sidan med `?user=namn` så visas sparad analys direkt och nya partier hämtas automatiskt (kan stängas av). Vilken statisk server som helst, t.ex. `python3 -m http.server 8765` i mappen. (Måste serveras över http – `file://` blockerar workers/fetch.)

## Licens

GPL-3.0 (se `LICENSE`) – projektet distribuerar [Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPLv3). Dragregler: [chess.js](https://github.com/jhlywa/chess.js) (BSD-2). Öppningsnamn: [lichess chess-openings](https://github.com/lichess-org/chess-openings) (CC0).
