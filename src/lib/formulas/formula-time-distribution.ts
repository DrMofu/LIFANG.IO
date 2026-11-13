export const FORMULA_STATS_LIMIT = 100;

type CurvePoint = { x: number; y: number };

/** Monotone cubic interpolation rounds the curve without inventing peaks or negative frequencies. */
export function buildSmoothDistributionCurve(points: readonly CurvePoint[]) {
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / (point.x - points[index].x));
  const tangents = points.map((_, index) => index === 0 ? slopes[0] : index === points.length - 1 ? slopes[index - 1] : (slopes[index - 1] + slopes[index]) / 2);
  slopes.forEach((slope, index) => {
    if (slope === 0) {
      tangents[index] = tangents[index + 1] = 0;
      return;
    }
    if (tangents[index] / slope < 0) tangents[index] = 0;
    if (tangents[index + 1] / slope < 0) tangents[index + 1] = 0;
    const length = Math.hypot(tangents[index] / slope, tangents[index + 1] / slope);
    if (length > 3) {
      tangents[index] *= 3 / length;
      tangents[index + 1] *= 3 / length;
    }
  });
  const segments = points.slice(1).map((end, index) => {
    const start = points[index];
    const third = (end.x - start.x) / 3;
    return { start, end, c1: { x: start.x + third, y: start.y + tangents[index] * third }, c2: { x: end.x - third, y: end.y - tangents[index + 1] * third } };
  });
  const path = `M${points[0].x},${points[0].y} ` + segments.map(({ c1, c2, end }) => `C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`).join(" ");
  return { path };
}

function niceStep(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
}

export type FormulaDistributionRange = {
  minMs: number;
  maxMs: number;
  tickStepMs: number;
  shrinkStreak: number;
};

function fitRange(min: number, max: number, tickStepMs: number) {
  return {
    minMs: Math.max(0, Math.floor(min / tickStepMs) * tickStepMs),
    maxMs: Math.ceil(max / tickStepMs) * tickStepMs,
  };
}

/** Retain the previous grid until data exceeds it or five new results justify shrinking. */
export function getFormulaDistributionRange(samples: readonly number[], previous?: FormulaDistributionRange, newResult = true, paddingMs = 0): FormulaDistributionRange {
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const span = Math.max(500, max - min);
  const padding = Math.max(span * 0.1, paddingMs);
  const center = (min + max) / 2;
  const paddedMin = Math.max(0, center - span / 2 - padding);
  const paddedMax = center + span / 2 + padding;
  const tickStepMs = Math.max(100, niceStep((paddedMax - paddedMin) / 5));
  const desired = fitRange(paddedMin, paddedMax, tickStepMs);
  let range = { ...desired, tickStepMs };
  let shrinkStreak = 0;

  if (previous) {
    const outside = min < previous.minMs || max > previous.maxMs;
    const canShrink = desired.minMs >= previous.minMs && desired.maxMs <= previous.maxMs
      && desired.maxMs - desired.minMs <= (previous.maxMs - previous.minMs) * 0.75;
    shrinkStreak = canShrink ? previous.shrinkStreak + Number(newResult) : 0;
    if (outside) {
      const lower = min < previous.minMs ? paddedMin : previous.minMs;
      const upper = max > previous.maxMs ? paddedMax : previous.maxMs;
      const step = (upper - lower) / previous.tickStepMs <= 8
        ? previous.tickStepMs : Math.max(100, niceStep((upper - lower) / 5));
      range = { ...fitRange(lower, upper, step), tickStepMs: step };
    } else if (shrinkStreak < 5) {
      range = previous;
    } else {
      shrinkStreak = 0;
    }
  }

  return { ...range, shrinkStreak };
}

function quantile(sorted: readonly number[], fraction: number) {
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
}

/** Reflected Gaussian KDE keeps all probability on the nonnegative time axis. */
export function buildFormulaTimeDistribution(times: readonly number[], previous?: FormulaDistributionRange, newResult = true) {
  const samples = times.filter((time) => Number.isFinite(time) && time > 0).slice(-FORMULA_STATS_LIMIT);
  if (samples.length === 0) return null;

  const sorted = samples.toSorted((a, b) => a - b);
  const q1Ms = quantile(sorted, 0.25);
  const q3Ms = quantile(sorted, 0.75);
  const median = quantile(sorted, 0.5);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const deviation = Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, samples.length - 1));
  // When the IQR collapses, repeated results should remain a compact peak even with outliers.
  const scale = q3Ms > q1Ms ? Math.min(deviation, (q3Ms - q1Ms) / 1.34) : median * 0.05;
  const bandwidthMs = Math.max(35, 0.9 * scale * samples.length ** -0.2 * (samples.length < 15 ? 1.25 : 1));
  const range = getFormulaDistributionRange(samples, previous, newResult, bandwidthMs * 3);
  const { minMs, maxMs, tickStepMs } = range;
  const densityAt = (ms: number) => samples.reduce((sum, time) => sum
    + Math.exp(-0.5 * ((ms - time) / bandwidthMs) ** 2)
    + Math.exp(-0.5 * ((ms + time) / bandwidthMs) ** 2), 0) / (samples.length * bandwidthMs * Math.sqrt(2 * Math.PI));
  const densities = Array.from({ length: 257 }, (_, index) => densityAt(minMs + (maxMs - minMs) * index / 256));
  const peak = Math.max(...densities, ...samples.map(densityAt));
  const heights = densities.map((density) => density / (peak * 1.12));
  const binWidthMs = tickStepMs / 2;
  const binCount = Math.ceil((maxMs - minMs) / binWidthMs);
  const counts = Array<number>(binCount).fill(0);
  for (const time of samples) {
    counts[Math.min(binCount - 1, Math.floor((time - minMs) / binWidthMs))] += 1;
  }
  const bins = counts.map((count, index) => ({
    startMs: minMs + index * binWidthMs,
    endMs: minMs + (index + 1) * binWidthMs,
    count,
  }));
  const xTicks = Array.from({ length: Math.round((maxMs - minMs) / tickStepMs) + 1 }, (_, index) => minMs + index * tickStepMs);

  return { ...range, samples, bins, heights, medianMs: median, bandwidthMs, xTicks };
}

export type FormulaTimeDistribution = NonNullable<ReturnType<typeof buildFormulaTimeDistribution>>;
