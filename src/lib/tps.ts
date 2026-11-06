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

export const LIVE_TPS_WINDOW_MS = 3000;

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
    return this.turns.reduce((sum, turn) => sum + turn.moves, 0) * 1000 / LIVE_TPS_WINDOW_MS;
  }

  private prune(now: number) {
    this.turns = this.turns.filter((turn) => now - turn.at < LIVE_TPS_WINDOW_MS);
  }
}

export function calculateTps(moves: number | null | undefined, durationMs: number): number | null {
  if (moves == null || !Number.isFinite(moves) || moves <= 0 || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  return moves * 1000 / durationMs;
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
