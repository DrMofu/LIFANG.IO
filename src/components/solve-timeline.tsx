import { useEffect, useId, useRef, useState } from "react";
import { fmtShort } from "@/lib/format";

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

export function SolveTimeline({ record, label, moveUnit }: { record: SolveTimelineRecord; label: string; moveUnit: string }) {
  const clipId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [axisHeight, setAxisHeight] = useState(400);
  useEffect(() => {
    const popover = popoverRef.current;
    const trigger = popover?.closest(".practice-score-panel") ?? popover?.parentElement;
    if (!popover || !trigger) return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelHide = () => clearTimeout(hideTimer);
    const hide = () => {
      cancelHide();
      popover.hidePopover();
    };
    const show = () => {
      cancelHide();
      const anchor = trigger.getBoundingClientRect();
      popover.showPopover();
      const score = trigger.closest(".practice-score-panel")?.getBoundingClientRect() ?? anchor;
      const summary = trigger.closest(".practice-right")?.querySelector(":scope > .stats")?.getBoundingClientRect();
      const top = Math.max(14, score.top + 12);
      const bottom = Math.min(window.innerHeight - 14, (summary?.bottom ?? score.bottom) - 12);
      const height = Math.max(80, bottom - top);
      const width = popover.offsetWidth;
      const left = score.left >= width + 18
        ? score.left - width + 12
        : Math.max(14, window.innerWidth - width - 14);
      popover.style.height = `${height}px`;
      setAxisHeight(Math.max(1, popover.clientHeight));
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
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
    };
  }, []);
  const total = Math.max(1, record.durationMs);
  const y = (ms: number) => Math.min(total, Math.max(0, ms)) / total * axisHeight;
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
  for (const phase of ["cross", "f2l", "oll"] as const) {
    const ms = record.cfop[phase];
    if (ms !== null) tickMoves.set(Math.min(record.durationMs, Math.max(0, ms)), record.cfopMoves[phase]);
  }
  tickMoves.set(record.durationMs, record.moveCount);
  const ticks = Array.from(tickMoves.keys()).filter((ms) => ms > 0).sort((a, b) => a - b);

  return (
    <div ref={popoverRef} popover="manual" id="current-solve-timeline" className="solve-timeline-popover" role="tooltip" aria-label={label}>
      <svg viewBox={`0 0 142 ${axisHeight}`} role="img" aria-label={label}>
        <defs><clipPath id={clipId}><rect x="68" y="0" width="8" height={axisHeight} /></clipPath></defs>
        <rect x="68" y="0" width="8" height={axisHeight} fill="#d6dfef" />
        <g clipPath={`url(#${clipId})`}>
          {segments.filter((segment) => segment.known).map((segment) => (
            <rect key={segment.name} x="68" y={y(segment.start)} width="8" height={y(segment.end) - y(segment.start)} fill={segment.color}>
              <title>{`${segment.name}: ${fmtShort(segment.start)} – ${fmtShort(segment.end)}`}</title>
            </rect>
          ))}
        </g>
        {[record.f2l.one, record.f2l.two, record.f2l.three, record.f2l.four].map((ms, index) => ms === null ? null : (
          <path
            key={`f2l-${index}`}
            className="solve-timeline-f2l-marker"
            d={`M 64 ${y(ms)} h -5`}
            stroke="#91a2bd"
          >
            <title>{`F2L ${index + 1}`}</title>
          </path>
        ))}
        {ticks.map((ms) => (
          <path key={ms} d={`M 64 ${y(ms)} h -5`} stroke="#91a2bd" />
        ))}
        {record.moves.map((move, index) => (
          <circle key={index} cx="72" cy={y(move.elapsedMs)} r="3" fill="#19386f" stroke="white" strokeWidth="0.8">
            <title>{`${move.notation} · ${move.elapsedMs} ms`}</title>
          </circle>
        ))}
        {ticks.map((ms) => (
          <text key={`label-${ms}`} x="54" y={y(ms)} textAnchor="end" dominantBaseline="middle">{fmtShort(ms)}</text>
        ))}
        {ticks.map((ms) => (
          <text key={`moves-${ms}`} x="88" y={y(ms)} textAnchor="start" dominantBaseline="middle">
            {tickMoves.get(ms) == null ? "—" : `${tickMoves.get(ms)}${moveUnit}`}
          </text>
        ))}
      </svg>
    </div>
  );
}
