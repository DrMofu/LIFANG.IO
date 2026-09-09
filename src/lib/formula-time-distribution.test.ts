import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFormulaTimeDistribution, buildSmoothDistributionCurve, FORMULA_STATS_LIMIT } from "./formula-time-distribution";

test("keeps the newest 100 valid samples without changing input", () => {
  const times = Array.from({ length: 128 }, (_, index) => (index + 1) * 100);
  const result = buildFormulaTimeDistribution([...times, NaN, 0, -1, Infinity]);
  assert.equal(FORMULA_STATS_LIMIT, 100);
  assert.deepEqual(result?.samples, times.slice(-100));
  assert.equal(times.length, 128);
  assert.equal(result?.bins.reduce((sum, bin) => sum + bin.count, 0), 100);
});

test("small sample frequencies use the actual count", () => {
  const result = buildFormulaTimeDistribution([1000, 1000, 2000, 3000]);
  assert.ok(result);
  assert.equal(result.bins.find((bin) => bin.count === 2)?.frequency, 50);
  assert.equal(result.bins.reduce((sum, bin) => sum + bin.frequency, 0), 100);
});

test("bin boundaries count every sample once, including the right axis endpoint", () => {
  const previous = { minMs: 0, maxMs: 5000, tickStepMs: 1000, binWidthMs: 500, shrinkStreak: 0 };
  const result = buildFormulaTimeDistribution([1, 499, 500, 999, 1000, 5000], previous);
  assert.ok(result);
  assert.equal(result.binWidthMs, 500);
  assert.equal(result.maxMs, 5000);
  assert.deepEqual(result.bins.map((bin) => bin.count), [2, 2, 1, 0, 0, 0, 0, 0, 0, 1]);
});

test("empty data has no distribution; a single solve reaches 100 percent", () => {
  assert.equal(buildFormulaTimeDistribution([]), null);
  assert.equal(buildFormulaTimeDistribution([NaN, -10, 0]), null);
  const result = buildFormulaTimeDistribution([1820]);
  assert.ok(result);
  assert.equal(result.bins.find((bin) => bin.count === 1)?.frequency, 100);
  assert.equal(result.maxFrequency, 100);
  assert.equal(result.yTicks.at(-1), 100);
});

test("axes include both very fast solves and slow outliers without discarding them", () => {
  for (const times of [[1, 2, 3], [1820, 2500, 123456], [5000, 5000, 5000]]) {
    const result = buildFormulaTimeDistribution(times);
    assert.ok(result);
    assert.ok(result.minMs >= 0 && result.minMs <= Math.min(...times));
    assert.ok(result.maxMs >= Math.max(...times));
    assert.ok(result.maxFrequency >= Math.max(...result.bins.map((bin) => bin.frequency)));
    assert.equal(result.bins.reduce((sum, bin) => sum + bin.count, 0), times.length);
  }
});

test("smooth curves pass through measured values without overshoot or negative frequencies", () => {
  const points = [0, 0, 10, 70, 0, 0, 10, 0, 5, 5, 0].map((y, x) => ({ x, y }));
  const curve = buildSmoothDistributionCurve(points);
  assert.match(curve.path, /C/);
  assert.doesNotMatch(curve.path, /L/);
  for (let index = 0; index < points.length - 1; index++) {
    assert.equal(curve.yAt(index), points[index].y);
    for (let fraction = 0; fraction <= 1; fraction += 0.01) {
      const value = curve.yAt(index + fraction);
      assert.ok(value >= Math.min(points[index].y, points[index + 1].y) - 1e-9);
      assert.ok(value <= Math.max(points[index].y, points[index + 1].y) + 1e-9);
    }
  }
  assert.equal(curve.yAt(3), 70);
});


test("fits clustered data with padding and readable ticks instead of starting at zero", () => {
  const result = buildFormulaTimeDistribution([1120, 1400, 1600, 1860]);
  assert.ok(result);
  assert.deepEqual(result.xTicks, [1000, 1200, 1400, 1600, 1800, 2000]);
});

test("crossing five seconds does not double the axis or reassign existing bins", () => {
  const previous = { minMs: 1000, maxMs: 5000, tickStepMs: 1000, binWidthMs: 500, shrinkStreak: 0 };
  const before = buildFormulaTimeDistribution([1500, 3000, 4990], previous)!;
  const after = buildFormulaTimeDistribution([...before.samples, 5010], before)!;
  assert.equal(after.minMs, before.minMs);
  assert.equal(after.maxMs, 6000);
  assert.equal(after.tickStepMs, before.tickStepMs);
  assert.equal(after.binWidthMs, before.binWidthMs);
  for (const bin of before.bins) {
    assert.equal(after.bins.find((next) => next.startMs === bin.startMs)?.count, bin.count);
  }
});

test("shrinks only after five new results, not five renders, when a rolling extreme expires", () => {
  const clustered = Array.from({ length: 99 }, (_, index) => 1120 + index * 7);
  let state = buildFormulaTimeDistribution([20000, ...clustered])!;
  const oldMax = state.maxMs;
  for (let index = 1; index <= 4; index++) {
    state = buildFormulaTimeDistribution([...clustered, 1500], state)!;
    assert.equal(state.maxMs, oldMax);
    assert.equal(state.shrinkStreak, index);
  }
  for (let index = 0; index < 10; index++) state = buildFormulaTimeDistribution(state.samples, state, false)!;
  assert.equal(state.shrinkStreak, 4);
  state = buildFormulaTimeDistribution([...clustered, 1500], state)!;
  assert.ok(state.maxMs < oldMax * 0.75);
  assert.equal(state.shrinkStreak, 0);
});

test("ordinary results preserve the range, and extreme results remain counted", () => {
  const initial = buildFormulaTimeDistribution([1120, 1400, 1860])!;
  const next = buildFormulaTimeDistribution([...initial.samples, 1500], initial)!;
  assert.deepEqual(next.xTicks, initial.xTicks);
  assert.equal(next.binWidthMs, initial.binWidthMs);
  const extreme = buildFormulaTimeDistribution([...next.samples, 20000], next)!;
  assert.ok(extreme.maxMs >= 20000);
  assert.equal(extreme.bins.reduce((sum, bin) => sum + bin.count, 0), 5);
  assert.ok(extreme.bins.length <= 32);
  const otherFormula = buildFormulaTimeDistribution([1200, 1300])!;
  assert.ok(otherFormula.maxMs < 2000);
});
