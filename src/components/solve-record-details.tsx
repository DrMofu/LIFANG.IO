"use client";

import { Fragment } from "react";
import { useLanguage } from "@/components/language-provider";
import { fmtShort } from "@/lib/format";
import { calculateTps, formatTps } from "@/lib/tps";
import type { HistoryMetricValue, SolveHistoryEntry } from "@/lib/solve-history";

export const SOLVE_RECORD_TIP_WIDTH = 286;
export const SOLVE_RECORD_TIP_HEIGHT = 360;
const PHASES = ["cross", "f2l", "oll", "pll"] as const;
const PHASE_NAMES = ["Cross", "F2L", "OLL", "PLL"];
const SUBPHASES = ["one", "two", "three", "four"] as const;

function delta(current: HistoryMetricValue | undefined, previous: HistoryMetricValue | undefined) {
  if (typeof current !== "number" || typeof previous !== "number" || !Number.isFinite(current) || !Number.isFinite(previous) || previous < 0 || current < previous) return null;
  return current - previous;
}

function RecordRow({ label, ms, moves, className = "" }: {
  label: string;
  ms: number | null;
  moves: number | null | undefined;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className={`hcf-row ${className}`}>
      <span>{label}</span>
      <em>{fmtShort(ms)}</em>
      <b>{moves == null ? "—" : `${moves} ${t("步")}`}</b>
      <strong className="hcf-tps">{formatTps(calculateTps(moves, ms ?? 0))}</strong>
    </div>
  );
}

export function SolveRecordDetails({ entry }: { entry: SolveHistoryEntry }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="hcf-row hcf-columns">
        <span>{t("阶段")}</span>
        <em>{t("用时")}</em>
        <b>{t("步数")}</b>
        <strong>TPS</strong>
      </div>
      {entry.source === "timer" ? (
        <div className="manual-history-tip">
          <strong>{t("纯计时器成绩")}</strong>
          <span>{t("本次仅记录总用时，没有步数和 CFOP 阶段数据。")}</span>
        </div>
      ) : PHASES.map((phase, index) => {
        const previous = index > 0 ? PHASES[index - 1] : null;
        return (
          <Fragment key={phase}>
            <RecordRow
              label={PHASE_NAMES[index]}
              ms={delta(entry.cfop?.[phase], previous ? entry.cfop?.[previous] : 0)}
              moves={delta(entry.cfopMoves?.[phase], previous ? entry.cfopMoves?.[previous] : 0)}
              className={index % 2 === 0 ? "hcf-row-alt" : ""}
            />
            {phase === "f2l" && (
              <div className="hcf-f2l-subline" aria-label={t("F2L 子阶段用时和步数")}>
                {SUBPHASES.map((subphase, index) => (
                  <RecordRow
                    key={subphase}
                    label={`${index + 1}/4`}
                    ms={delta(entry.cfopF2l?.[subphase], index === 0 ? entry.cfop?.cross : entry.cfopF2l?.[SUBPHASES[index - 1]])}
                    moves={delta(entry.cfopF2lMoves?.[subphase], index === 0 ? entry.cfopMoves?.cross : entry.cfopF2lMoves?.[SUBPHASES[index - 1]])}
                    className="hcf-subrow"
                  />
                ))}
              </div>
            )}
          </Fragment>
        );
      })}
      <RecordRow label={t("总计")} ms={entry.ms} moves={entry.source === "timer" ? null : entry.moves} className="hcf-total" />
    </>
  );
}
