import { useEffect, useId, useRef, useState } from "react";
import { fmtShort } from "@/lib/utils/format";

// Kept in practice component memory only; never part of a solve history entry.
export type SolveTimelineRecord = {
  durationMs: number;
  moves: Array<{ notation: string; elapsedMs: number }>;
  cfop: Record<"cross" | "f2l" | "oll" | "pll", number | null>;
  cfopMoves: Record<"cross" | "f2l" | "oll" | "pll", number | null>;
  moveCount: number;
  f2l: Record<"one" | "two" | "three" | "four", number | null>;
};

const PHASE_COLORS = ["#F2C744", "#1F6B3A", "#1F6B3A", "#1F6B3A", "#1F6B3A", "#1F4FB6", "#C9352A"];
const PHASE_NAMES = ["Cross", "F2L 1", "F2L 2", "F2L 3", "F2L 4", "OLL", "PLL"];

const AXIS_HEIGHT = 72;
const AXIS_PADDING = 32;

export function SolveTimeline({ record, label, moveUnit, placementKey }: {
  record: SolveTimelineRecord;
  label: string;
  moveUnit: string;
  placementKey: string;
}) {
  const clipId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [axisWidth, setAxisWidth] = useState(600);
  useEffect(() => {
    const popover = popoverRef.current;
    const trigger = popover?.closest(".practice-score-panel") ?? popover?.parentElement;
    if (!popover || !trigger) return;
    const stage = trigger.closest(".practice-layout")?.querySelector<HTMLElement>(".practice-stage");
    const controls = stage?.querySelector<HTMLElement>(".stage-bottom-stack") ?? stage?.querySelector<HTMLElement>(".stage-timer-stack");
    if (!stage || !controls) return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelHide = () => clearTimeout(hideTimer);
    const hide = () => {
      cancelHide();
      popover.hidePopover();
    };
    const show = () => {
      cancelHide();
      const area = stage.getBoundingClientRect();
      const anchor = controls.getBoundingClientRect();
      const width = Math.max(1, Math.min(area.width - 24, window.innerWidth - 24));
      const left = Math.max(12, Math.min(area.left + (area.width - width) / 2, window.innerWidth - width - 12));
      popover.showPopover();
      popover.style.width = `${width}px`;
      setAxisWidth(width);
      popover.style.left = `${left}px`;
      popover.style.top = `${Math.max(12, anchor.top - AXIS_HEIGHT - 12)}px`;
    };
    const scheduleHide = () => {
      cancelHide();
      hideTimer = setTimeout(() => {
        if (!trigger.matches(":hover, :focus-within")) hide();
      }, 120);
    };
    trigger.addEventListener("mouseenter", show);
    trigger.addEventListener("mouseleave", scheduleHide);
    trigger.addEventListener("focusin", show);
    trigger.addEventListener("focusout", scheduleHide);
    popover.addEventListener("mouseenter", cancelHide);
    popover.addEventListener("mouseleave", scheduleHide);
    window.addEventListener("resize", hide);
    document.addEventListener("scroll", hide, true);
    const initialHoverFrame = requestAnimationFrame(() => {
      if (trigger.matches(":hover, :focus-within")) show();
    });
    return () => {
      cancelAnimationFrame(initialHoverFrame);
      cancelHide();
      trigger.removeEventListener("mouseenter", show);
      trigger.removeEventListener("mouseleave", scheduleHide);
      trigger.removeEventListener("focusin", show);
      trigger.removeEventListener("focusout", scheduleHide);
      popover.removeEventListener("mouseenter", cancelHide);
      popover.removeEventListener("mouseleave", scheduleHide);
      window.removeEventListener("resize", hide);
      document.removeEventListener("scroll", hide, true);
      if (popover.isConnected && popover.matches(":popover-open")) hide();
    };
  }, [placementKey]);
  const total = Math.max(1, record.durationMs);
  const axisLength = Math.max(1, axisWidth - AXIS_PADDING * 2);
  const x = (ms: number) => AXIS_PADDING + Math.min(total, Math.max(0, ms)) / total * axisLength;
  const ends = [record.cfop.cross, record.f2l.one, record.f2l.two, record.f2l.three, record.cfop.f2l, record.cfop.oll, record.cfop.pll];
  let previous = 0;
  let previousKnown = true;
  const segments = ends.map((end, index) => {
    // Missing milestones remain uncoloured rather than inventing stage timings.
    const start = previous;
    const known = previousKnown && end !== null;
    previous = Math.min(total, Math.max(start, end ?? start));
    previousKnown = end !== null;
    return { start, end: previous, known, name: PHASE_NAMES[index], color: PHASE_COLORS[index] };
  });
  const tickMoves = new Map<number, number | null>();
  tickMoves.set(0, 0);
  for (const phase of ["cross", "f2l", "oll"] as const) {
    const ms = record.cfop[phase];
    if (ms !== null) tickMoves.set(Math.min(record.durationMs, Math.max(0, ms)), record.cfopMoves[phase]);
  }
  tickMoves.set(record.durationMs, record.moveCount);
  const ticks = Array.from(tickMoves.keys()).sort((a, b) => a - b);
  const boundaries = new Map<number, string>([[0, "Cross start"]]);
  ends.forEach((ms, index) => {
    if (ms !== null) boundaries.set(ms, PHASE_NAMES[index]);
  });
  if (record.f2l.four !== null) boundaries.set(record.f2l.four, "F2L 4");
  if (!boundaries.has(record.durationMs)) boundaries.set(record.durationMs, "Finish");
  const moveLabel = (ms: number) => tickMoves.get(ms) == null ? "—" : `${tickMoves.get(ms)}${moveUnit}`;
  const labelWidth = (ms: number) => Math.max(moveLabel(ms).length, fmtShort(ms).length) * 7;
  const labelTicks: number[] = [];
  // Keep the final result readable when several short phases end close together.
  for (const ms of ticks) {
    if (ms === record.durationMs) {
      while (labelTicks.length > 0) {
        const last = labelTicks.at(-1)!;
        if (x(ms) - x(last) >= (labelWidth(ms) + labelWidth(last)) / 2 + 12) break;
        labelTicks.pop();
      }
      labelTicks.push(ms);
      continue;
    }
    const previousTick = labelTicks.at(-1);
    if (previousTick !== undefined && x(ms) - x(previousTick) < (labelWidth(ms) + labelWidth(previousTick)) / 2 + 12) {
      continue;
    }
    labelTicks.push(ms);
  }

  return (
    <div ref={popoverRef} popover="manual" id="current-solve-timeline" className="solve-timeline-popover" role="tooltip" aria-label={label}>
      <svg viewBox={`0 0 ${axisWidth} ${AXIS_HEIGHT}`} role="img" aria-label={label}>
        <defs><clipPath id={clipId}><rect x={AXIS_PADDING} y="32" width={axisLength} height="8" /></clipPath></defs>
        <rect x={AXIS_PADDING} y="32" width={axisLength} height="8" fill="#d6dfef" />
        <g clipPath={`url(#${clipId})`}>
          {segments.filter((segment) => segment.known).map((segment) => (
            <rect key={segment.name} x={x(segment.start)} y="32" width={x(segment.end) - x(segment.start)} height="8" fill={segment.color}>
              <title>{`${segment.name}: ${fmtShort(segment.start)} – ${fmtShort(segment.end)}`}</title>
            </rect>
          ))}
        </g>
        {Array.from(boundaries, ([ms, name]) => (
          <path
            key={`boundary-${ms}`}
            className="solve-timeline-boundary-marker"
            d={`M ${x(ms)} 44 v 5`}
            stroke="#91a2bd"
          >
            <title>{name}</title>
          </path>
        ))}
        {ticks.map((ms) => (
          <path key={ms} d={`M ${x(ms)} 28 v -5`} stroke="#91a2bd" />
        ))}
        {record.moves.map((move, index) => (
          <circle key={index} cx={x(move.elapsedMs)} cy="36" r="3" fill="#19386f" stroke="white" strokeWidth="0.8">
            <title>{`${move.notation} · ${move.elapsedMs} ms`}</title>
          </circle>
        ))}
        {labelTicks.map((ms) => (
          <text key={`moves-${ms}`} x={x(ms)} y="14" textAnchor="middle" dominantBaseline="middle">
            {moveLabel(ms)}
          </text>
        ))}
        {labelTicks.map((ms) => (
          <text key={`label-${ms}`} x={x(ms)} y="60" textAnchor="middle" dominantBaseline="middle">{fmtShort(ms)}</text>
        ))}
      </svg>
    </div>
  );
}
