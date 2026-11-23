// Stockfish 18 (lite, single-threaded WASM) running in a Web Worker.
// Used for the practice bot and for post-game analysis. Engine games never
// affect Elo.
import { Chess } from "chess.js";

export type Line = { multipv: number; depth: number; cp: number; mate: number | null; pv: string[] };
export type Search = { bestmove: string | null; lines: Line[] };

const MATE = 100000;
/** Score in centipawns from the side to move (mate mapped to a large value). */
export const lineScore = (l: Line) => (l.mate != null ? (l.mate > 0 ? MATE - l.mate * 100 : -MATE - l.mate * 100) : l.cp);

export class Engine {
  private worker: Worker;
  private listeners = new Set<(line: string) => void>();
  private chain: Promise<unknown> = Promise.resolve();
  readonly ready: Promise<void>;
  private dead = false;

  constructor() {
    this.worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`);
    this.worker.onmessage = (e) => {
      const line = typeof e.data === "string" ? e.data : String(e.data);
      this.listeners.forEach((l) => l(line));
    };
    this.ready = this.until("uciok", () => this.send("uci")).then(() => this.isReady());
  }

  private send(cmd: string) {
    if (!this.dead) this.worker.postMessage(cmd);
  }

  private until(prefix: string, start: () => void, onLine?: (l: string) => void, timeoutMs = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.listeners.delete(fn);
        reject(new Error("The chess engine didn't respond."));
      }, timeoutMs);
      const fn = (l: string) => {
        onLine?.(l);
        if (l.startsWith(prefix)) {
          clearTimeout(t);
          this.listeners.delete(fn);
          resolve(l);
        }
      };
      this.listeners.add(fn);
      start();
    });
  }

  private isReady() {
    return this.until("readyok", () => this.send("isready")).then(() => undefined);
  }

  /** Serializes engine jobs so analysis and play never overlap. */
  private job<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(() => this.ready).then(fn);
    this.chain = next.catch(() => undefined);
    return next;
  }

  search(fen: string, opts: { depth?: number; movetime?: number; multipv?: number; elo?: number | null; skill?: number }): Promise<Search> {
    return this.job(async () => {
      const multipv = opts.multipv ?? 1;
      if (opts.elo) {
        this.send("setoption name UCI_LimitStrength value true");
        this.send(`setoption name UCI_Elo value ${Math.max(1320, Math.min(3190, Math.round(opts.elo)))}`);
      } else {
        this.send("setoption name UCI_LimitStrength value false");
      }
      this.send(`setoption name Skill Level value ${opts.skill ?? 20}`);
      this.send(`setoption name MultiPV value ${multipv}`);
      await this.isReady();
      this.send(`position fen ${fen}`);
      const lines = new Map<number, Line>();
      const go = opts.depth ? `go depth ${opts.depth}` : `go movetime ${opts.movetime ?? 500}`;
      const best = await this.until("bestmove", () => this.send(go), (l) => {
        if (!l.startsWith("info") || !l.includes(" pv ")) return;
        const m = l.match(/ depth (\d+).* multipv (\d+).* score (cp|mate) (-?\d+).* pv (.+)$/) ?? l.match(/ depth (\d+)().* score (cp|mate) (-?\d+).* pv (.+)$/);
        if (!m) return;
        const mpv = Number(m[2] || 1);
        lines.set(mpv, {
          multipv: mpv,
          depth: Number(m[1]),
          cp: m[3] === "cp" ? Number(m[4]) : 0,
          mate: m[3] === "mate" ? Number(m[4]) : null,
          pv: m[5].trim().split(/\s+/),
        });
      });
      const bm = best.split(/\s+/)[1];
      return { bestmove: bm && bm !== "(none)" ? bm : null, lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) };
    });
  }

  /** Full-strength evaluation from the side to move. */
  async evaluate(fen: string, depth = 10): Promise<{ score: number; best: string | null; pv: string[] }> {
    const r = await this.search(fen, { depth, multipv: 1 });
    const top = r.lines[0];
    return { score: top ? lineScore(top) : 0, best: r.bestmove, pv: top?.pv ?? [] };
  }

  /**
   * Picks the bot's move at a target strength. From about 1320 up, Stockfish's
   * own UCI_Elo limiter is used. Below that, the bot looks at several candidate
   * moves and deliberately picks worse ones more often the lower the target;
   * those low levels are approximate.
   */
  async botMove(fen: string, elo: number): Promise<string | null> {
    if (elo >= 1320) {
      const r = await this.search(fen, { movetime: 700, elo });
      return r.bestmove;
    }
    const chess = new Chess(fen);
    const legal = chess.moves({ verbose: true });
    if (!legal.length) return null;
    const blunderChance = 0.3 - (elo - 100) * (0.27 / 1220); // 30% at 100 → 3% at 1320
    if (Math.random() < blunderChance) {
      const m = legal[Math.floor(Math.random() * legal.length)];
      return m.from + m.to + (m.promotion ?? "");
    }
    const r = await this.search(fen, { depth: elo < 700 ? 4 : 6, multipv: Math.min(6, legal.length), skill: 0 });
    if (!r.lines.length) return r.bestmove;
    const best = lineScore(r.lines[0]);
    const temp = 260 - (elo - 100) * (220 / 1220); // centipawns of "noise"
    const weights = r.lines.map((l) => Math.exp((lineScore(l) - best) / Math.max(30, temp)));
    let x = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < r.lines.length; i++) {
      x -= weights[i];
      if (x <= 0) return r.lines[i].pv[0];
    }
    return r.lines[0].pv[0];
  }

  stop() {
    this.send("stop");
  }

  destroy() {
    this.dead = true;
    this.worker.terminate();
    this.listeners.clear();
  }
}

/** Centipawn loss of a move given evaluations before (mover to move) and after (opponent to move). */
export function cpLoss(beforeForMover: number, afterForOpponent: number): number {
  const clamp = (v: number) => Math.max(-1500, Math.min(1500, v));
  return Math.max(0, clamp(beforeForMover) - clamp(-afterForOpponent));
}
