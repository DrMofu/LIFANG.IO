"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { fmtShort } from "@/lib/format";
import { calculateTps, formatTps } from "@/lib/tps";
import type { SolveHistoryEntry } from "@/lib/solve-history";

const PAGE_SIZE = 20;
const PHASES = ["cross", "f2l", "oll", "pll"] as const;
const PHASE_LABELS = ["Cross", "F2L", "OLL", "PLL"];

function phaseTimes(entry: SolveHistoryEntry) {
  return PHASES.map((phase, index) => {
    const end = entry.cfop?.[phase];
    const start = index === 0 ? 0 : entry.cfop?.[PHASES[index - 1]];
    return entry.source !== "timer" && typeof end === "number" && typeof start === "number"
      && Number.isFinite(end) && Number.isFinite(start) && start >= 0 && end >= start
      ? fmtShort(end - start) : "—";
  });
}

export function SolveHistoryDialog({ history, onClose, onDelete }: {
  history: SolveHistoryEntry[];
  onClose: () => void;
  onDelete: (index: number, entry: SolveHistoryEntry) => void;
}) {
  const { locale, t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Omit timeZone so both formatters use the user's current device time zone.
  const { dateFormat, timeFormat } = useMemo(() => ({
    dateFormat: new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }),
    timeFormat: new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }),
  }), [locale]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dl-history-dialog solve-history-dialog"
      aria-labelledby="solve-history-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
    >
      <div className="dl-history-dialog-head">
        <h2 className="ui-section-title" id="solve-history-title">{t("历史成绩")}</h2>
        <button type="button" className="dl-history-close" aria-label={t("关闭")} onClick={onClose}>×</button>
      </div>
      {history.length === 0 ? <div className="dl-history-empty">{t("尚无记录")}</div> : (
        <div className="dl-history-table-wrap">
          <table className="dl-history-table solve-history-table">
            <thead>
              <tr>
                <th scope="col">{t("编号")}</th>
                <th scope="col">{t("日期")}</th>
                <th scope="col">{t("步数")}</th>
                <th scope="col">TPS</th>
                <th scope="col" className="solve-history-cfop-column">CFOP</th>
                {PHASE_LABELS.map((label) => <th scope="col" className="solve-history-phase-column" key={label}>{label}</th>)}
                <th scope="col">{t("用时")}</th>
                <th scope="col" aria-label={t("删除")}></th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, visibleCount).map((entry, index) => {
                const number = history.length - index;
                const times = phaseTimes(entry);
                const moves = entry.source === "timer" ? null : entry.moves;
                const speed = calculateTps(moves, entry.ms);
                return (
                  <tr key={`${entry.ts}-${index}`}>
                    <td className="solve-history-number">#{number}</td>
                    <td className="dl-history-date"><time dateTime={new Date(entry.ts).toISOString()}>{dateFormat.format(entry.ts)}<small>{timeFormat.format(entry.ts)}</small></time></td>
                    <td className="solve-history-moves" data-missing={moves == null}>{moves ?? "—"}</td>
                    <td className="solve-history-tps" data-missing={speed === null}>{formatTps(speed)}</td>
                    <td className="solve-history-cfop-column">
                      <div className="solve-history-cfop-grid">
                        {times.map((time, phaseIndex) => <span key={PHASES[phaseIndex]}><span>{PHASE_LABELS[phaseIndex]}</span><b className="solve-history-phase-value" data-missing={time === "—"}>{time}</b></span>)}
                      </div>
                    </td>
                    {times.map((time, phaseIndex) => <td className="solve-history-phase-column" key={PHASES[phaseIndex]}><span className="solve-history-phase-value" data-missing={time === "—"}>{time}</span></td>)}
                    <td className="dl-history-score">{fmtShort(entry.ms)}</td>
                    <td><button type="button" className="solve-history-delete" aria-label={t(`删除历史记录 #${number}`)} onClick={() => onDelete(index, entry)}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleCount < history.length && (
            <div className="solve-history-load-more">
              <button type="button" className="dl-history-open" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                {t("显示更多")}
              </button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
