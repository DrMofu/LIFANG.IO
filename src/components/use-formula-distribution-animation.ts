"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildSmoothDistributionCurve, type FormulaTimeDistribution } from "@/lib/formula-time-distribution";

type Tick = { value: number; opacity: number };
type Frame = {
  minMs: number;
  maxMs: number;
  maxFrequency: number;
  latestMs: number;
  heights: number[];
  xTicks: Tick[];
  yTicks: Tick[];
};

function makeFrame(distribution: FormulaTimeDistribution): Frame {
  const { minMs, maxMs, bins, maxFrequency, samples } = distribution;
  const points = [
    { x: bins[0].startMs, y: bins[0].frequency },
    ...bins.map((bin) => ({ x: bin.centerMs, y: bin.frequency })),
    { x: bins[bins.length - 1].endMs, y: bins[bins.length - 1].frequency },
  ];
  const curve = buildSmoothDistributionCurve(points);
  return {
    minMs, maxMs, maxFrequency, latestMs: samples[samples.length - 1],
    heights: Array.from({ length: 97 }, (_, index) => curve.yAt(minMs + (maxMs - minMs) * index / 96) / maxFrequency),
    xTicks: distribution.xTicks.map((value) => ({ value, opacity: 1 })),
    yTicks: distribution.yTicks.map((value) => ({ value, opacity: 1 })),
  };
}

function blendTicks(from: Tick[], to: Tick[], progress: number): Tick[] {
  const old = new Map(from.map((tick) => [tick.value, tick.opacity]));
  const next = new Map(to.map((tick) => [tick.value, tick.opacity]));
  return [...new Set([...old.keys(), ...next.keys()])].map((value) => ({
    value, opacity: (old.get(value) ?? 0) * (1 - progress) + (next.get(value) ?? 0) * progress,
  }));
}

/** Fixed screen samples keep the path continuous even when the bin count changes. */
export function useFormulaDistributionAnimation(distribution: FormulaTimeDistribution | null) {
  const target = useMemo(() => distribution ? makeFrame(distribution) : null, [distribution]);
  const [frame, setFrame] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    if (!target) {
      current.current = null;
      return;
    }
    const from = current.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let request = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = Math.min(1, (now - start) / 300);
      const progress = 1 - (1 - elapsed) ** 3;
      if (!from || reducedMotion || elapsed === 1) {
        current.current = target;
        setFrame(target);
        return;
      }
      const mix = (a: number, b: number) => a + (b - a) * progress;
      const next: Frame = {
        minMs: mix(from.minMs, target.minMs),
        maxMs: mix(from.maxMs, target.maxMs),
        maxFrequency: mix(from.maxFrequency, target.maxFrequency),
        latestMs: mix(from.latestMs, target.latestMs),
        heights: target.heights.map((height, index) => mix(from.heights[index], height)),
        xTicks: blendTicks(from.xTicks, target.xTicks, progress),
        yTicks: blendTicks(from.yTicks, target.yTicks, progress),
      };
      current.current = next;
      setFrame(next);
      request = requestAnimationFrame(animate);
    };
    request = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(request);
  }, [target]);

  return frame ?? target;
}
