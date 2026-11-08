import type { FormulaRecognitionResult } from "@/lib/formulas/formula-recognition";
import { f2lSubphaseMetricDelta,phaseMetricDelta } from "@/lib/records/phase-metrics";
import { MISSING_HISTORY_VALUE,type CfopPhaseMetrics,type DailyLevelSolve,type F2lSubphaseMetrics,type HistoryMetricValue,type SolveSource } from "@/lib/records/solve-history";
import { fmtShort } from "@/lib/utils/format";

export const DAILY_TEST_TARGET = 5;

export type CfopPhaseKey = "cross" | "f2l" | "oll" | "pll";

export type F2lSubphaseKey = "one" | "two" | "three" | "four";

export type LiveCfopMetrics = Record<CfopPhaseKey, number | null>;

export type LiveF2lSubphaseMetrics = Record<F2lSubphaseKey, number | null>;

export type CurrentPracticeResult = {
  archiveStorageKey: string;
  ms: number;
  source: SolveSource;
  moveCount: number;
  cfop: LiveCfopMetrics;
  cfopMoves: LiveCfopMetrics;
  f2l: LiveF2lSubphaseMetrics;
  f2lMoves: LiveF2lSubphaseMetrics;
  formulas: Partial<Record<"oll" | "pll", FormulaRecognitionResult>>;
  timeline: SolveTimelineRecord | null;
};

export const F2L_SUBPHASES: Array<{ key: F2lSubphaseKey; name: string }> = [
  { key: "one", name: "F2L 1/4" },
  { key: "two", name: "F2L 2/4" },
  { key: "three", name: "F2L 3/4" },
  { key: "four", name: "F2L 4/4" },
];

export function toHistoryMetric(value: number | null): HistoryMetricValue {
  return typeof value === "number" && Number.isFinite(value) ? value : MISSING_HISTORY_VALUE;
}

export function toHistoryCfopMetrics(metrics: LiveCfopMetrics): CfopPhaseMetrics {
  return {
    cross: toHistoryMetric(metrics.cross),
    f2l: toHistoryMetric(metrics.f2l),
    oll: toHistoryMetric(metrics.oll),
    pll: toHistoryMetric(metrics.pll),
  };
}

export function toHistoryF2lSubphaseMetrics(metrics: LiveF2lSubphaseMetrics): F2lSubphaseMetrics {
  return {
    one: toHistoryMetric(metrics.one),
    two: toHistoryMetric(metrics.two),
    three: toHistoryMetric(metrics.three),
    four: toHistoryMetric(metrics.four),
  };
}

export function fmtSolveDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type Phase = "idle" | "scrambling" | "inspect" | "solving" | "done";

export type ManualTimerArmState = "idle" | "holding" | "ready";

export type FreePracticeState = "waitingSolved" | "ready" | "scrambling" | "armed";

export type ScrambleStepStatus = "pending" | "partial" | "correct";

export type SmartSolveStatus = "idle" | "loading" | "active" | "done";

export type SmartSolveStepStatus = "pending" | "partial" | "correct";

export type DailyTestRun = {
  id: string;
  localDate: string;
  solves: DailyLevelSolve[];
};

// Transient practice data; never persisted in solve history.
export type SolveTimelineRecord = {
  durationMs: number;
  moves: Array<{ notation: string; elapsedMs: number }>;
  cfop: Record<"cross" | "f2l" | "oll" | "pll", number | null>;
  cfopMoves: Record<"cross" | "f2l" | "oll" | "pll", number | null>;
  moveCount: number;
  f2l: Record<"one" | "two" | "three" | "four", number | null>;
};

export function formatPhaseTimeDelta(metrics: CfopPhaseMetrics | undefined, key: CfopPhaseKey) {
  return fmtShort(phaseMetricDelta(metrics, key));
}

export function formatPhaseMoveDelta(metrics: CfopPhaseMetrics | undefined, key: CfopPhaseKey) {
  const value = phaseMetricDelta(metrics, key);
  return value === null ? MISSING_HISTORY_VALUE : `${value}步`;
}

export function formatF2lSubphaseTimeDelta(cfop: CfopPhaseMetrics | undefined, f2l: F2lSubphaseMetrics | undefined, key: F2lSubphaseKey) {
  return fmtShort(f2lSubphaseMetricDelta(cfop, f2l, key));
}

export function formatF2lSubphaseMoveDelta(cfop: CfopPhaseMetrics | undefined, f2l: F2lSubphaseMetrics | undefined, key: F2lSubphaseKey) {
  const value = f2lSubphaseMetricDelta(cfop, f2l, key);
  return value === null ? MISSING_HISTORY_VALUE : `${value}步`;
}
