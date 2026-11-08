"use client";
import { f2lSubphaseMetricDelta,phaseMetricDelta } from "@/lib/records/phase-metrics";
import { useLanguage } from "@/components/i18n/language-provider";
import type { CfopPhaseMetrics,SolveHistoryEntry } from "@/lib/records/solve-history";
import { calculatePhaseTps,calculateTps,formatTps } from "@/lib/records/tps";
import { fmtShort } from "@/lib/utils/format";
import { Fragment } from "react";

export const SOLVE_RECORD_TIP_WIDTH = 286;
export const SOLVE_RECORD_TIP_HEIGHT = 376;
const PHASES = ["cross", "f2l", "oll", "pll"] as const;
const PHASE_NAMES = ["Cross", "F2L", "OLL", "PLL"];
const SUBPHASES = ["one", "two", "three", "four"] as const;

function RecordRow({ label, ms, moves, className = "", phase }: {
  label: string;
  ms: number | null;
  moves: number | null | undefined;
  className?: string;
  phase?: keyof CfopPhaseMetrics;
}) {
  const { t } = useLanguage();
  const speed = formatTps(phase ? calculatePhaseTps(moves, ms ?? 0, phase) : calculateTps(moves, ms ?? 0));
  const moveValue = <b>{moves == null ? "—" : `${moves}${t("步")}`}</b>;
  const tpsValue = <strong className="hcf-tps" aria-label={`${speed} TPS`}>{speed}</strong>;
  return (
    <div className={`hcf-row ${className}`}>
      <span>{label}</span>
      {moveValue}
      {tpsValue}
      <em>{fmtShort(ms)}</em>
    </div>
  );
}

export function SolveRecordDetails({ entry }: { entry: SolveHistoryEntry }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="hcf-row hcf-columns">
        <span>{t("阶段")}</span>
        <b>{t("步数")}</b>
        <strong>TPS</strong>
        <em>{t("用时")}</em>
      </div>
      {entry.source === "timer" ? (
        <div className="manual-history-tip">
          <strong>{t("纯计时器成绩")}</strong>
          <span>{t("本次仅记录总用时，没有步数和 CFOP 阶段数据。")}</span>
        </div>
      ) : PHASES.map((phase, index) => {
        return (
          <Fragment key={phase}>
            <RecordRow
              label={PHASE_NAMES[index]}
              phase={phase}
              ms={phaseMetricDelta(entry.cfop, phase)}
              moves={phaseMetricDelta(entry.cfopMoves, phase)}
              className={index % 2 === 0 ? "hcf-row-alt" : ""}
            />
            {phase === "f2l" && (
              <div className="hcf-f2l-subline" aria-label={t("F2L 子阶段用时和步数")}>
                {SUBPHASES.map((subphase, index) => (
                  <RecordRow
                    key={subphase}
                    label={`${index + 1}/4`}
                    ms={f2lSubphaseMetricDelta(entry.cfop, entry.cfopF2l, subphase)}
                    moves={f2lSubphaseMetricDelta(entry.cfopMoves, entry.cfopF2lMoves, subphase)}
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
