// Stockfish i en Web Worker, pratar UCI. analyse() returnerar eval ur vits
// perspektiv i centipawns (matt -> ±(10000 - n)), bästa drag och näst bästa.

export class Engine {
  constructor(path = 'vendor/stockfish-19-lite-single.js') {
    this.worker = new Worker(path);
    this.listeners = [];
    this.worker.onerror = (e) => { for (const fn of this.listeners) fn(`error ${e.message || 'worker'}`); };
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      for (const fn of this.listeners) fn(line);
    };
  }

  send(cmd) { this.worker.postMessage(cmd); }

  waitFor(pred, ms = 20000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.listeners = this.listeners.filter((f) => f !== fn); reject(new Error('Stockfish svarade inte (blockerad wasm?)')); }, ms);
      const fn = (line) => {
        if (line.startsWith('error ')) { clearTimeout(timer); reject(new Error(line)); }
        if (pred(line)) { clearTimeout(timer); this.listeners = this.listeners.filter((f) => f !== fn); resolve(line); }
      };
      this.listeners.push(fn);
    });
  }

  async init({ hashMb = 32 } = {}) {
    this.send('uci');
    await this.waitFor((l) => l === 'uciok');
    this.send(`setoption name Hash value ${hashMb}`);
    this.send('setoption name MultiPV value 2');
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
  }

  // limit: {depth, movetime} – stoppar när endera nås
  analyse(fen, { depth = 12, movetime = 800 } = {}) {
    return new Promise((resolve) => {
      const whiteToMove = fen.split(' ')[1] === 'w';
      const lines = {}; // multipv -> {cp, pv, depth}
      const fn = (line) => {
        if (line.startsWith('info ') && line.includes(' pv ') && line.includes(' multipv ')) {
          const t = line.split(' ');
          const get = (k) => { const i = t.indexOf(k); return i >= 0 ? t[i + 1] : null; };
          const mpv = Number(get('multipv'));
          const d = Number(get('depth'));
          const si = t.indexOf('score');
          let cp;
          if (t[si + 1] === 'cp') cp = Number(t[si + 2]);
          else { const n = Number(t[si + 2]); cp = n > 0 ? 10000 - n : -10000 - n; }
          if (!whiteToMove) cp = -cp;
          const pv = t.slice(t.indexOf('pv') + 1, t.indexOf('pv') + 7);
          if (!lines[mpv] || lines[mpv].depth <= d) lines[mpv] = { cp, pv, depth: d };
        } else if (line.startsWith('bestmove')) {
          this.listeners = this.listeners.filter((f) => f !== fn);
          const top = lines[1] || { cp: 0, pv: [line.split(' ')[1]] };
          resolve({
            cp: top.cp,
            best: top.pv[0] && top.pv[0] !== '(none)' ? top.pv[0] : null,
            secondCp: lines[2] ? lines[2].cp : null,
            pv: top.pv,
          });
        }
      };
      this.listeners.push(fn);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth} movetime ${movetime}`);
    });
  }

  stop() { this.send('stop'); }
  terminate() { this.worker.terminate(); }
}
