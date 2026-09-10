"use client";

import { memo, useEffect, useRef, useState } from "react";
import { buildFormulaTimeDistribution, buildSmoothDistributionCurve } from "@/lib/formula-time-distribution";
import { useFormulaDistributionAnimation } from "@/components/use-formula-distribution-animation";
import { fmtShort } from "@/lib/format";

type Props = {
  times: readonly number[];
  count: number;
  bestMs?: number;
  todayPracticeCount: number;
  todayPracticeTone: string;
  t: (key: string) => string;
};

const WIDTH = 348;
const LEFT = 35;
const RIGHT = WIDTH - 12;
const TOP = 34;
const BOTTOM = 172;

export const FormulaPracticeStats = memo(function FormulaPracticeStats({ times, count, bestMs, todayPracticeCount, todayPracticeTone, t }: Props) {
  const [history, setHistory] = useState(() => ({ times, count, distribution: buildFormulaTimeDistribution(times) }));
  if (history.times !== times || history.count !== count) {
    const unchanged = history.count === count && history.times.length === times.length
      && history.times.every((time, index) => time === times[index]);
    setHistory({ times, count, distribution: unchanged ? history.distribution
      : buildFormulaTimeDistribution(times, count >= history.count ? history.distribution ?? undefined : undefined, count > history.count) });
  }
  const distribution = history.distribution;
  const frame = useFormulaDistributionAnimation(distribution);
  const recentListRef = useRef<HTMLOListElement>(null);
  const [recentLimit, setRecentLimit] = useState(1);

  useEffect(() => {
    const list = recentListRef.current;
    const side = list?.closest<HTMLElement>(".fm-side");
    const row = list?.firstElementChild;
    if (!list || !side || !row) return;

    const updateLimit = () => {
      const rowHeight = row.getBoundingClientRect().height;
      if (!rowHeight) return;
      // Use unscrolled panel coordinates so scrolling cannot change the row count.
      const listTop = list.getBoundingClientRect().top - side.getBoundingClientRect().top + side.scrollTop;
      const availableHeight = getComputedStyle(side).overflowY === "visible"
        ? window.visualViewport?.height ?? window.innerHeight
        : side.clientHeight;
      let bottomInset = 0;
      for (let element = list.parentElement; element && element !== side; element = element.parentElement) {
        const style = getComputedStyle(element);
        bottomInset += parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
      }
      setRecentLimit(Math.max(1, Math.floor((availableHeight - listTop - bottomInset) / rowHeight)));
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
  }, [times]);

  const recentHeader = (
    <div className="practice-card-head fm-stats-head">
      <div className="practice-title-line">
        <h3 className="practice-card-title">{t("最近记录")}</h3>
        <span className="practice-kicker">RECENT</span>
      </div>
      <span className={`formula-hero-tag formula-today-stat tone-${todayPracticeTone}`}>{t("今日")} {todayPracticeCount} {t("次")}</span>
    </div>
  );
  if (!distribution || !frame) {
    return (
      <div className="fm-stats-dashboard">
        {recentHeader}
        <section className="fm-stats-recent" aria-label={t("最近记录")}>
          <div className="fm-stats-empty">{t("暂无记录，开始练习后自动统计。")}</div>
        </section>
      </div>
    );
  }
  const { samples, bins } = distribution;
  const { minMs, maxMs, maxFrequency, xTicks, yTicks } = frame;
  const latest = samples[samples.length - 1];
  const latestIsBest = latest === bestMs;
  const x = (ms: number) => LEFT + (ms - minMs) / (maxMs - minMs) * (RIGHT - LEFT);
  const y = (frequency: number) => BOTTOM - frequency / maxFrequency * (BOTTOM - TOP);
  const curve = buildSmoothDistributionCurve(frame.heights.map((height, index) => ({
    x: LEFT + index / (frame.heights.length - 1) * (RIGHT - LEFT),
    y: BOTTOM - height * (BOTTOM - TOP),
  })));
  const latestX = x(frame.latestMs);
  const latestLabel = `${t("上次")} ${fmtShort(latest)}`;
  const labelWidth = Math.max(94, latestLabel.length * 7 + 16);
  const labelX = Math.max(LEFT, Math.min(RIGHT - labelWidth, latestX - labelWidth / 2));
  const recent = samples.slice(-recentLimit).toReversed();
  const slowestRecent = Math.max(...recent);

  return (
    <div className="fm-stats-dashboard">
      {recentHeader}
      <section className="fm-distribution" aria-label={t("用时分布")}>
        <div className="fm-chart-caption"><span>{t("频率")}</span></div>
        <svg className={`fm-distribution-chart${latestIsBest ? " is-best" : ""}`} viewBox={`0 0 ${WIDTH} 204`} role="img" aria-label={`${t("用时分布")} · ${latestLabel}`}>
          <desc>{t("横轴为用时，纵轴为各用时区间的次数占比，竖线表示上次成绩。")}</desc>
          {yTicks.map(({ value: tick, opacity }) => (
            <g key={tick} opacity={opacity}>
              <line className="fm-chart-grid" x1={LEFT} x2={RIGHT} y1={y(tick)} y2={y(tick)} />
              <text className="fm-chart-label" x={LEFT - 7} y={y(tick) + 4} textAnchor="end">{tick}%</text>
            </g>
          ))}
          <path className="fm-chart-area" d={`${curve.path} L${RIGHT},${BOTTOM} L${LEFT},${BOTTOM} Z`} />
          <path className="fm-chart-line" d={curve.path} />
          {bins.map((bin) => (
            <rect className="fm-chart-bin-target" key={bin.startMs} x={Math.max(LEFT, x(bin.startMs))} y={TOP} width={Math.max(0, Math.min(RIGHT, x(bin.endMs)) - Math.max(LEFT, x(bin.startMs)))} height={BOTTOM - TOP}>
              <title>{`${bin.startMs / 1000}–${bin.endMs / 1000} s: ${bin.count}/${samples.length} (${Number(bin.frequency.toFixed(1))}%)`}</title>
            </rect>
          ))}
          <line className="fm-chart-axis" x1={LEFT} x2={RIGHT} y1={BOTTOM} y2={BOTTOM} />
          {xTicks.map(({ value: tick, opacity }) => (
            <g key={tick} opacity={tick < minMs || tick > maxMs ? 0 : opacity}>
              <line className="fm-chart-axis" x1={x(tick)} x2={x(tick)} y1={BOTTOM} y2={BOTTOM + 4} />
              <text className="fm-chart-label" x={x(tick)} y={BOTTOM + 19} textAnchor="middle">{Number((tick / 1000).toFixed(2))}</text>
            </g>
          ))}
          <g className="fm-chart-latest">
            <line x1={latestX} x2={latestX} y1={TOP - 4} y2={BOTTOM} />
            <circle cx={latestX} cy={curve.yAt(latestX)} r={4.5} />
            <rect x={labelX} y={3} width={labelWidth} height={24} rx={6} />
            <text x={labelX + labelWidth / 2} y={19} textAnchor="middle">{latestLabel}</text>
          </g>
        </svg>
        <div className="fm-chart-caption">
          <span style={{ marginInlineStart: "auto" }}>{t("用时 / 秒")}</span>
        </div>
      </section>
      <section className="fm-stats-recent" aria-label={t("最近记录")}>
        <ol ref={recentListRef}>
          {recent.map((time, index) => {
            const isBest = time === bestMs;
            const number = count - index;
            return (
              <li key={`${number}-${time}`} className={`hist-row fm-stat-row${isBest ? " best" : ""}`}>
                <span className="hr-i">#{String(number).padStart(3, "0")}</span>
                <span className="hr-track" aria-hidden="true">
                  <span className="hr-bar" style={{ width: `${time / slowestRecent * 100}%` }} />
                </span>
                <span className="hr-t">{(time / 1000).toFixed(2)}<small>s</small></span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
});
