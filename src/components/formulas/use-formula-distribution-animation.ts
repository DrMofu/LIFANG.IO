"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormulaTimeDistribution } from "@/lib/formulas/formula-time-distribution";

type Tick = { value: number; opacity: number };
type Frame = {
  minMs: number;
  maxMs: number;
  medianMs: number;
  latestMs: number;
  heights: number[];
  xTicks: Tick[];
};

function makeFrame(distribution: FormulaTimeDistribution): Frame {
  const { minMs, maxMs, medianMs, heights, samples } = distribution;
  return {
    minMs, maxMs, medianMs, latestMs: samples[samples.length - 1], heights,
    xTicks: distribution.xTicks.map((value) => ({ value, opacity: 1 })),
  };
}

function blendTicks(from: Tick[], to: Tick[], progress: number): Tick[] {
  const old = new Map(from.map((tick) => [tick.value, tick.opacity]));
  const next = new Map(to.map((tick) => [tick.value, tick.opacity]));
  return [...new Set([...old.keys(), ...next.keys()])].map((value) => ({
    value, opacity: (old.get(value) ?? 0) * (1 - progress) + (next.get(value) ?? 0) * progress,
  }));
}

/** Fixed screen samples keep the path continuous even when the density or axis range changes. */
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
        medianMs: mix(from.medianMs, target.medianMs),
        latestMs: mix(from.latestMs, target.latestMs),
        heights: target.heights.map((height, index) => mix(from.heights[index], height)),
        xTicks: blendTicks(from.xTicks, target.xTicks, progress),
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
