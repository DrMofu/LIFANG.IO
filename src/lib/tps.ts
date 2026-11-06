import { parseMoveNotation, type ParsedMove } from "@/lib/algorithms";

export type TurnMetric = "HTM" | "STM";

// Bluetooth cubes can report a half turn as two quarter turns. Pair only two
// consecutive quarters; never cancel reversals or collapse a full revolution.
export class TurnCounter {
  count = 0;
  constructor(private metric: TurnMetric = "HTM") {}
  private pending: ParsedMove | null = null;

  reset() {
    this.count = 0;
    this.pending = null;
  }

  push(notation: string) {
    const move = parseMoveNotation(notation);
    if (!move) return this.count;
    if ("xyz".includes(move.layer)) {
      this.pending = null;
      return this.count;
    }
    if (move.turns === 1 && this.pending?.layer === move.layer && this.pending.dir === move.dir) {
      this.pending = null;
    } else {
      this.count += this.metric === "HTM" && "MES".includes(move.layer) ? 2 : 1;
      this.pending = move.turns === 1 ? move : null;
    }
    return this.count;
  }
}

export const LIVE_TPS_WINDOW_MS = 2000;

export class RollingTps {
  private counter = new TurnCounter();
  private turns: Array<{ at: number; moves: number }> = [];
  private lastMoveAt: number | null = null;

  reset() {
    this.counter.reset();
    this.turns = [];
    this.lastMoveAt = null;
  }

  record(notation: string, now: number) {
    const move = parseMoveNotation(notation);
    if (!move) return;
    if (this.lastMoveAt !== null && now - this.lastMoveAt >= LIVE_TPS_WINDOW_MS) this.counter.reset();
    const before = this.counter.count;
    const after = this.counter.push(notation);
    if ("xyz".includes(move.layer)) return;
    this.lastMoveAt = now;
    if (after > before) {
      this.turns.push({ at: now, moves: after - before });
    } else {
      // The second quarter completes the existing half turn at this timestamp.
      const last = this.turns.at(-1);
      if (last) last.at = now;
    }
    this.prune(now);
  }

  value(now: number) {
    this.prune(now);
    const first = this.turns[0];
    if (!first || this.turns.length < 2 || now <= first.at) return 0;
    // The first turn anchors the measured interval; its own duration is unknown.
    // Include time since the latest turn so the rate also falls while idle.
    const moves = this.turns.reduce((sum, turn) => sum + turn.moves, 0) - first.moves;
    return moves * 1000 / (now - first.at);
  }

  private prune(now: number) {
    this.turns = this.turns.filter((turn) => now - turn.at < LIVE_TPS_WINDOW_MS);
  }
}

export function calculateTps(moves: number | null | undefined, durationMs: number): number | null {
  if (moves == null || !Number.isFinite(moves) || moves <= 0 || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  return moves * 1000 / durationMs;
}

export function calculatePhaseTps(
  moves: number | null | undefined,
  durationMs: number,
  phase: "cross" | "f2l" | "oll" | "pll",
) {
  // The solve clock starts on receipt of the first move. A Cross completed by
  // that move has no measured turning interval; its timestamp is dispatch delay.
  if (phase === "cross" && moves === 1) return null;
  return calculateTps(moves, durationMs);
}

export function formatTps(value: number | null) {
  return value === null ? "—" : value.toFixed(1);
}

export function countStmMoves(moves: readonly string[]) {
  return moves.filter((move) => {
    const parsed = parseMoveNotation(move);
    return parsed && !"xyz".includes(parsed.layer);
  }).length;
}
