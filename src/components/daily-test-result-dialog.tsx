"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/language-provider";
import { fmtShort } from "@/lib/format";
import { getDailyLevelExcludedSolveIndexes, type DailyLevelEntry } from "@/lib/solve-history";

export function DailyTestResultDialog({ entry, onClose }: { entry: DailyLevelEntry; onClose: () => void }) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const excluded = getDailyLevelExcludedSolveIndexes(entry.solves);

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
      className="daily-result-dialog"
      aria-labelledby="daily-result-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom
        ) onClose();
      }}
    >
      <header className="daily-result-head">
        <div>
          <h2 id="daily-result-title" className="ui-section-title">{t("dailyResult.title")}</h2>
          <time dateTime={entry.localDate}>{entry.localDate}</time>
        </div>
      </header>
      <div className="daily-result-score">
        <span>{t("dailyResult.average")} <span className="daily-result-ao5">Ao5</span></span>
        <strong>{(entry.averageMs / 1000).toFixed(2)}<small>s</small></strong>
      </div>
      <ol className="daily-result-solves" aria-label={t("dailyResult.details")}>
        {entry.solves.map((solve, index) => (
          <li key={index} className={excluded.has(index) ? "is-excluded" : undefined}>
            {excluded.has(index) ? <s>{fmtShort(solve.ms)}</s> : fmtShort(solve.ms)}
          </li>
        ))}
      </ol>
      <button type="button" className="practice-btn practice-btn-primary" onClick={onClose}>{t("dailyResult.continue")}</button>
    </dialog>
  );
}
