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
  return {
    path,
    yAt(x: number) {
      const segment = segments.find(({ end }) => end.x >= x) ?? segments[segments.length - 1];
      const { start, end, c1, c2 } = segment;
      const t = Math.max(0, Math.min(1, (x - start.x) / (end.x - start.x)));
      return (1 - t) ** 3 * start.y + 3 * (1 - t) ** 2 * t * c1.y + 3 * (1 - t) * t ** 2 * c2.y + t ** 3 * end.y;
    },
  };
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
  binWidthMs: number;
  shrinkStreak: number;
};

function fitRange(min: number, max: number, tickStepMs: number) {
  return {
    minMs: Math.max(0, Math.floor(min / tickStepMs) * tickStepMs),
    maxMs: Math.ceil(max / tickStepMs) * tickStepMs,
  };
}

/** Retain the previous grid until data exceeds it or five new results justify shrinking. */
export function getFormulaDistributionRange(samples: readonly number[], previous?: FormulaDistributionRange, newResult = true): FormulaDistributionRange {
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const span = Math.max(500, max - min);
  const center = (min + max) / 2;
  const paddedMin = Math.max(0, center - span * 0.6);
  const paddedMax = center + span * 0.6;
  const tickStepMs = Math.max(100, niceStep((paddedMax - paddedMin) / 6));
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
        ? previous.tickStepMs : Math.max(100, niceStep((upper - lower) / 6));
      range = { ...fitRange(lower, upper, step), tickStepMs: step };
    } else if (shrinkStreak < 5) {
      range = previous;
    } else {
      shrinkStreak = 0;
    }
  }

  const width = range.maxMs - range.minMs;
  const previousBins = previous ? width / previous.binWidthMs : 0;
  const binWidthMs = previous && previousBins >= 4 && previousBins <= 32
    ? previous.binWidthMs : Math.max(50, niceStep(width / 12));
  return { ...range, binWidthMs, shrinkStreak };
}

/** Equal-width bins anchored to zero, independently of axis ticks. */
export function buildFormulaTimeDistribution(times: readonly number[], previous?: FormulaDistributionRange, newResult = true) {
  const samples = times.filter((time) => Number.isFinite(time) && time > 0).slice(-FORMULA_STATS_LIMIT);
  if (samples.length === 0) return null;

  const range = getFormulaDistributionRange(samples, previous, newResult);
  const { minMs, maxMs, binWidthMs, tickStepMs } = range;
  const binStartMs = Math.floor(minMs / binWidthMs) * binWidthMs;
  const binCount = Math.ceil((maxMs - binStartMs) / binWidthMs);
  const counts = Array<number>(binCount).fill(0);
  for (const time of samples) {
    // Include the right endpoint in the last bin.
    counts[Math.min(binCount - 1, Math.floor((time - binStartMs) / binWidthMs))] += 1;
  }
  const bins = counts.map((count, index) => ({
    startMs: binStartMs + index * binWidthMs,
    endMs: binStartMs + (index + 1) * binWidthMs,
    centerMs: binStartMs + (index + 0.5) * binWidthMs,
    count,
    frequency: count / samples.length * 100,
  }));
  const yStep = niceStep(Math.max(...bins.map((bin) => bin.frequency)) / 3);
  const maxFrequency = Math.min(100, Math.ceil(Math.max(...bins.map((bin) => bin.frequency)) / yStep) * yStep);
  const yTicks = Array.from({ length: Math.floor(maxFrequency / yStep) + 1 }, (_, index) => index * yStep);
  if (yTicks.at(-1) !== maxFrequency) yTicks.push(maxFrequency);
  const xTicks = Array.from({ length: Math.round((maxMs - minMs) / tickStepMs) + 1 }, (_, index) => minMs + index * tickStepMs);

  return { ...range, samples, bins, maxFrequency, yTicks, xTicks };
}

export type FormulaTimeDistribution = NonNullable<ReturnType<typeof buildFormulaTimeDistribution>>;
