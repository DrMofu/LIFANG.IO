"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import { buildFormulaTimeDistribution, buildSmoothDistributionCurve } from "@/lib/formulas/formula-time-distribution";
import { useFormulaDistributionAnimation } from "@/components/formulas/use-formula-distribution-animation";
import { calculateTps, formatTps } from "@/lib/records/tps";
import { fmtShort } from "@/lib/utils/format";

type Props = {
  times: readonly number[];
  count: number;
  moves: number;
  bestMs?: number;
  todayPracticeCount: number;
  todayPracticeTone: string;
  compact?: boolean;
  t: (key: string) => string;
};

const WIDTH = 348;
const LEFT = 14;
export const FormulaPracticeStats = memo(function FormulaPracticeStats({ times, count, moves, bestMs, todayPracticeCount, todayPracticeTone, compact = false, t }: Props) {
  const chartId = useId().replaceAll(":", "");
  const [history, setHistory] = useState(() => ({ times, count, distribution: buildFormulaTimeDistribution(times) }));
  if (history.times !== times || history.count !== count) {
    const unchanged = history.count === count && history.times.length === times.length
      && history.times.every((time, index) => time === times[index]);
    setHistory({ times, count, distribution: unchanged ? history.distribution
      : buildFormulaTimeDistribution(times, count >= history.count ? history.distribution ?? undefined : undefined, count > history.count) });
  }
  const distribution = history.distribution;
  const frame = useFormulaDistributionAnimation(distribution);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(WIDTH);
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;
    const updateWidth = () => setChartWidth(Math.max(160, container.clientWidth));
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    updateWidth();
    return () => observer.disconnect();
  }, []);

  const recentListRef = useRef<HTMLOListElement>(null);
  const [recentLimit, setRecentLimit] = useState(1);

  useEffect(() => {
    const list = recentListRef.current;
    const side = list?.closest<HTMLElement>(".practice-mobile-slide, .fm-side");
    const row = list?.firstElementChild;
    if (!list || !side || !row) return;

    const updateLimit = () => {
      const rowHeight = row.getBoundingClientRect().height;
      if (!rowHeight) return;
      // Use unscrolled panel coordinates so scrolling cannot change the row count.
      const listTop = list.getBoundingClientRect().top - side.getBoundingClientRect().top + side.scrollTop;
      const availableHeight = !side.classList.contains("practice-mobile-slide") && getComputedStyle(side).overflowY === "visible"
        ? window.visualViewport?.height ?? window.innerHeight
        : side.clientHeight;
      let bottomInset = parseFloat(getComputedStyle(side).paddingBottom);
      for (let element = list.parentElement; element && element !== side; element = element.parentElement) {
        const style = getComputedStyle(element);
        bottomInset += parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
      }
      const available = Math.max(0, availableHeight - listTop - bottomInset);
      const limit = Math.max(1, Math.floor(available / 42));
      list.style.setProperty("--fm-row-height", `${Math.max(42, Math.min(44, available / limit))}px`);
      setRecentLimit(limit);
    };

    const observer = new ResizeObserver(updateLimit);
    for (let element: Element | null = list; element; element = element.parentElement) {
      observer.observe(element);
      if (element === side) break;
    }
    for (const child of side.children) observer.observe(child);
    observer.observe(row);
    window.addEventListener("resize", updateLimit);
    window.visualViewport?.addEventListener("resize", updateLimit);
    updateLimit();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLimit);
      window.visualViewport?.removeEventListener("resize", updateLimit);
    };
  }, [times, chartWidth, compact]);

  const recentHeader = (
    <div className="practice-card-head fm-stats-head">
      <div className="practice-title-line">
        <h3 className="practice-card-title">{t("最近记录")}</h3>
        <span className="practice-kicker" aria-hidden="true">RECENT</span>
      </div>
      <span className={`formula-hero-tag formula-today-stat tone-${todayPracticeTone}`}>{t("今日")} {todayPracticeCount} {t("次")}</span>
    </div>
  );
  if (!distribution || !frame) {
    return (
      <div ref={chartContainerRef} className="fm-stats-dashboard">
        {recentHeader}
        <section className="fm-stats-recent" aria-label={t("最近记录")}>
          <div className="fm-stats-empty">{t("暂无记录")}</div>
        </section>
      </div>
    );
  }
  const { samples, bins } = distribution;
  const width = chartWidth;
  const right = width - 22;
  const top = 22;
  const bottom = compact ? 100 : 154;
  const chartHeight = compact ? 128 : 182;
  const { minMs, maxMs, xTicks } = frame;
  const latest = samples[samples.length - 1];
  const latestIsBest = latest === bestMs;
  const showCurve = samples.length >= 5;
  const x = (ms: number) => LEFT + (ms - minMs) / (maxMs - minMs) * (right - LEFT);
  const curve = buildSmoothDistributionCurve(frame.heights.map((height, index) => ({
    x: LEFT + index / (frame.heights.length - 1) * (right - LEFT),
    y: bottom - height * (bottom - top),
  })));
  const area = `${curve.path} L${right},${bottom} L${LEFT},${bottom} Z`;
  const latestX = x(frame.latestMs);
  const latestLabel = `${fmtShort(latest)}${latestIsBest ? ` ${t("最佳")}` : ""}`;
  const rangeLabel = `${t("中位数")} ${(distribution.medianMs / 1000).toFixed(2)}s`;
  const labelWidth = Array.from(latestLabel).reduce((sum, character) => sum + (character.charCodeAt(0) > 255 ? 11 : 7), 0);
  const labelX = latestX + labelWidth + 8 <= right ? latestX + 8 : Math.max(LEFT, latestX - labelWidth - 8);
  const medianX = x(frame.medianMs);
  // Leave room for the unit at the right and keep labels readable in narrow sidebars.
  const tickStride = Math.max(1, Math.ceil((xTicks.length - 1) / Math.max(2, Math.floor((right - LEFT) / 56))));
  const recent = samples.slice(-recentLimit).toReversed();
  const slowestRecent = Math.max(...recent);

  return (
    <div ref={chartContainerRef} className="fm-stats-dashboard">
      {recentHeader}
      <section className={`fm-distribution${latestIsBest ? " is-best" : ""}`} aria-label={t("用时分布")}>
        <svg className="fm-distribution-chart" viewBox={`0 0 ${width} ${chartHeight}`} role="img" aria-label={`${t("用时分布")}，${latestLabel}${showCurve ? `，${rangeLabel}` : ""}`}>
          <desc>{t(showCurve ? "横轴为用时，曲线表示成绩集中程度，竖线表示上次成绩。中位数左侧的曲线区域加深。" : "横轴为用时，圆点表示每次成绩，竖线表示上次成绩。")}</desc>
          <defs>
            <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--tech-blue)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--tech-blue)" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id={`${chartId}-range`}>
              <rect x={LEFT} y={top} width={Math.max(0, medianX - LEFT)} height={bottom - top} />
            </clipPath>
          </defs>
          {[1 / 3, 2 / 3].map((ratio) => (
            <line key={ratio} className="fm-chart-grid" x1={LEFT} x2={right} y1={bottom - ratio * (bottom - top)} y2={bottom - ratio * (bottom - top)} />
          ))}
          {showCurve && <>
            <path fill={`url(#${chartId}-fill)`} d={area} />
            <path className="fm-chart-range" clipPath={`url(#${chartId}-range)`} d={area} />
            <path className="fm-chart-line" d={curve.path} />
          </>}
          {bins.map((bin) => (
            <rect className="fm-chart-bin-target" key={bin.startMs} x={x(bin.startMs)} y={top} width={x(bin.endMs) - x(bin.startMs)} height={bottom - top}>
              <title>{`${(bin.startMs / 1000).toFixed(2)}–${(bin.endMs / 1000).toFixed(2)} s: ${bin.count}/${samples.length} (${Number((bin.count / samples.length * 100).toFixed(1))}%)`}</title>
            </rect>
          ))}
          <line className="fm-chart-axis" x1={LEFT} x2={right} y1={bottom} y2={bottom} />
          {samples.length < 15 && samples.map((time, index) => showCurve ? (
            <line key={index} className="fm-chart-rug" x1={x(time)} x2={x(time)} y1={bottom + 2} y2={bottom + 6} />
          ) : (
            <circle key={index} className="fm-chart-sample" cx={x(time)} cy={bottom} r={3} />
          ))}
          {xTicks.map(({ value: tick, opacity }, index) => index % tickStride === 0 && (
            <g key={tick} opacity={tick < minMs || tick > maxMs ? 0 : opacity}>
              <line className="fm-chart-axis" x1={x(tick)} x2={x(tick)} y1={bottom} y2={bottom + 4} />
              <text className="fm-chart-label" x={x(tick)} y={bottom + 20} textAnchor="middle">{Number((tick / 1000).toFixed(2))}</text>
            </g>
          ))}
          <text className="fm-chart-label" x={width - 1} y={bottom + 20} textAnchor="end">s</text>
          <text className="fm-chart-result" x={labelX} y={16}>{latestLabel}</text>
          <g className="fm-chart-latest">
            <line x1={latestX} x2={latestX} y1={4} y2={bottom} />
            <circle cx={latestX} cy={bottom} r={4.5} />
          </g>
        </svg>
      </section>
      <section className="fm-stats-recent" aria-label={t("最近记录")}>
        <ol ref={recentListRef} className="hist-list-no-moves">
          {recent.map((time, index) => {
            const isBest = time === bestMs;
            const number = count - index;
            return (
              <li key={`${number}-${time}`} className={`hist-row fm-stat-row${isBest ? " best" : ""}`}>
                <span className="hr-i">#{String(number).padStart(3, "0")}</span>
                <span className="hr-track" aria-hidden="true">
                  <span className="hr-bar" style={{ width: `${Math.max(12, time / slowestRecent * 100)}%` }} />
                </span>
                <span className="hr-tps">{formatTps(calculateTps(moves, time))} <small>TPS</small></span>
                <span className="hr-t" aria-label={isBest ? `${t("最佳")} ${(time / 1000).toFixed(2)}s` : undefined}>{fmtShort(time)}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
});
