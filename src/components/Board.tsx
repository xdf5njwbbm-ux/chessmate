import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, defaultPieces, type PieceDropHandlerArgs, type PieceHandlerArgs, type SquareHandlerArgs } from "react-chessboard";
import { pref } from "../lib/format";

export const BOARD_THEMES = {
  green: { light: "#ebecd0", dark: "#739552", name: "Classic green" },
  walnut: { light: "#ecd6b4", dark: "#a8774f", name: "Walnut" },
  slate: { light: "#dfe3e8", dark: "#7b8794", name: "Slate" },
} as const;
export type BoardTheme = keyof typeof BOARD_THEMES;

type Props = {
  fen: string;
  orientation: "white" | "black";
  /** Color the user may move, or null for a read-only board. */
  movable: "w" | "b" | null;
  lastMove?: string | null; // uci
  onMove?: (from: string, to: string, promotion?: string) => void;
  arrows?: { from: string; to: string; color?: string }[];
  id: string;
};

/** The shared chessboard: drag or tap to move, legal-move hints, check and last-move highlights, promotion picker. */
export function Board({ fen, orientation, movable, lastMove, onMove, arrows, id }: Props) {
  const theme = BOARD_THEMES[pref<BoardTheme>("boardTheme", "green")] ?? BOARD_THEMES.green;
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const myTurn = !!movable && chess.turn() === movable && !chess.isGameOver();

  const legal = (from: string, to: string) => chess.moves({ square: from as Square, verbose: true }).filter((m) => m.to === to);

  const attempt = (from: string, to: string): boolean => {
    if (!myTurn) return false;
    const ms = legal(from, to);
    if (!ms.length) return false;
    if (ms.some((m) => m.promotion)) {
      setPromo({ from, to });
      return false;
    }
    setSelected(null);
    onMove?.(from, to);
    return true;
  };

  const onPieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => (targetSquare ? attempt(sourceSquare, targetSquare) : false);
  const onSquareClick = ({ square, piece }: SquareHandlerArgs) => {
    if (!myTurn) return;
    if (selected && selected !== square && legal(selected, square).length) {
      attempt(selected, square);
      setSelected(null);
      return;
    }
    if (piece && piece.pieceType[0] === movable) setSelected(selected === square ? null : square);
    else setSelected(null);
  };
  const canDragPiece = ({ piece }: PieceHandlerArgs) => myTurn && piece.pieceType[0] === movable;

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      s[lastMove.slice(0, 2)] = { backgroundColor: "rgba(255, 214, 102, 0.42)" };
      s[lastMove.slice(2, 4)] = { backgroundColor: "rgba(255, 214, 102, 0.55)" };
    }
    if (chess.inCheck()) {
      for (const row of chess.board())
        for (const sq of row)
          if (sq && sq.type === "k" && sq.color === chess.turn())
            s[sq.square] = { background: "radial-gradient(circle, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.45) 45%, transparent 75%)" };
    }
    if (selected) {
      s[selected] = { ...(s[selected] ?? {}), backgroundColor: "rgba(63,191,127,0.45)" };
      for (const m of chess.moves({ square: selected as Square, verbose: true })) {
        s[m.to] = {
          ...(s[m.to] ?? {}),
          background: chess.get(m.to as Square)
            ? "radial-gradient(circle, transparent 56%, rgba(0,0,0,0.28) 58%)"
            : "radial-gradient(circle, rgba(0,0,0,0.25) 21%, transparent 23%)",
        };
      }
    }
    return s;
  }, [lastMove, chess, selected]);

  return (
    <div className="relative w-full select-none">
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          onPieceDrop,
          onSquareClick,
          canDragPiece,
          squareStyles,
          lightSquareStyle: { backgroundColor: theme.light },
          darkSquareStyle: { backgroundColor: theme.dark },
          boardStyle: { borderRadius: 10, overflow: "hidden", boxShadow: "0 24px 60px -24px rgba(0,0,0,0.9)" },
          lightSquareNotationStyle: { color: theme.dark, fontWeight: 600, fontSize: 11 },
          darkSquareNotationStyle: { color: theme.light, fontWeight: 600, fontSize: 11 },
          dropSquareStyle: { boxShadow: "inset 0 0 0 3px rgba(63,191,127,0.9)" },
          animationDurationInMs: 160,
          allowDrawingArrows: true,
          arrows: arrows?.map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color ?? "rgba(63,191,127,0.85)" })),
        }}
      />
      {promo && movable && (
        <div className="absolute inset-0 z-10 grid animate-fade-in place-items-center rounded-[10px] bg-ink-950/70 backdrop-blur-sm">
          <div className="card p-4 text-center">
            <div className="mb-3 text-sm font-semibold text-fog">Promote to</div>
            <div className="flex gap-2">
              {(["q", "r", "b", "n"] as const).map((p) => {
                const Piece = defaultPieces[`${movable}${p.toUpperCase()}`];
                return (
                  <button
                    key={p}
                    aria-label={`Promote to ${p}`}
                    onClick={() => {
                      const { from, to } = promo;
                      setPromo(null);
                      setSelected(null);
                      onMove?.(from, to, p);
                    }}
                    className="grid size-16 place-items-center rounded-2xl bg-white/10 hover:bg-accent/30"
                  >
                    <div className="size-12">{Piece?.()}</div>
                  </button>
                );
              })}
            </div>
            <button className="mt-3 text-sm text-mist" onClick={() => setPromo(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const GLYPH: Record<string, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" };

/** Pieces each side has captured, and the material balance from white's view. */
export function capturedPieces(fen: string) {
  const counts: Record<string, number> = {};
  for (const ch of fen.split(" ")[0]) if (/[a-z]/i.test(ch)) counts[ch] = (counts[ch] ?? 0) + 1;
  const byWhite: string[] = []; // black pieces white has captured
  const byBlack: string[] = [];
  for (const t of ["q", "r", "b", "n", "p"]) {
    for (let i = 0; i < Math.max(0, START[t] - (counts[t] ?? 0)); i++) byWhite.push(t);
    for (let i = 0; i < Math.max(0, START[t] - (counts[t.toUpperCase()] ?? 0)); i++) byBlack.push(t);
  }
  let diff = 0;
  for (const [ch, n] of Object.entries(counts)) diff += (ch === ch.toUpperCase() ? 1 : -1) * (VALUES[ch.toLowerCase()] ?? 0) * n;
  return { byWhite, byBlack, diff };
}

export function CapturedRow({ pieces, plus, color }: { pieces: string[]; plus: number; color: "w" | "b" }) {
  if (!pieces.length && plus <= 0) return <div className="h-5" />;
  return (
    <div className="flex h-5 items-center gap-0.5 text-[15px] leading-none text-mist" aria-label="Captured pieces">
      {pieces.map((p, i) => (
        <span key={i} className={color === "w" ? "text-fog" : "text-faint"}>{GLYPH[p]}</span>
      ))}
      {plus > 0 && <span className="ml-1 text-xs font-semibold text-mist">+{plus}</span>}
    </div>
  );
}
