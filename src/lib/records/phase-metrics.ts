import type { CfopPhaseMetrics,F2lSubphaseMetrics } from "@/lib/records/solve-history";

// Metrics are cumulative. Missing or invalid endpoints cannot form a phase value.
export function metricDelta(current: unknown, previous: unknown): number | null {
  if (typeof current !== "number" || typeof previous !== "number"
    || !Number.isFinite(current) || !Number.isFinite(previous)
    || previous < 0 || current < previous) return null;
  return current - previous;
}

export function phaseMetricDelta(metrics: CfopPhaseMetrics | undefined, phase: keyof CfopPhaseMetrics) {
  const previous = phase === "cross" ? 0
    : metrics?.[phase === "f2l" ? "cross" : phase === "oll" ? "f2l" : "oll"];
  return metricDelta(metrics?.[phase], previous);
}

export function f2lSubphaseMetricDelta(
  cfop: CfopPhaseMetrics | undefined,
  f2l: F2lSubphaseMetrics | undefined,
  phase: keyof F2lSubphaseMetrics,
) {
  const previous = phase === "one" ? cfop?.cross
    : f2l?.[phase === "two" ? "one" : phase === "three" ? "two" : "three"];
  return metricDelta(f2l?.[phase], previous);
}
