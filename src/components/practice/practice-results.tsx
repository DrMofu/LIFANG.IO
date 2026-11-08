"use client";
import { FormulaTopViewImage } from "@/components/cube/formula-cube-image";
import { useLanguage } from "@/components/i18n/language-provider";
import { SolveTimeline } from "@/components/practice/solve-timeline";
import { SolveRecordDetails } from "@/components/records/solve-record-details";
import { type CubeFace } from "@/lib/cube/smart-cube";
import type { FormulaRecognitionResult } from "@/lib/formulas/formula-recognition";
import { type SolveHistoryEntry } from "@/lib/records/solve-history";
import { calculateTps,formatTps } from "@/lib/records/tps";
import type { SolveTimelineRecord } from "@/lib/training/practice-model";
import { F2L_SUBPHASES,fmtSolveDate,formatF2lSubphaseMoveDelta,formatF2lSubphaseTimeDelta,formatPhaseMoveDelta,formatPhaseTimeDelta,toHistoryCfopMetrics,toHistoryF2lSubphaseMetrics,type DailyTestRun,type LiveCfopMetrics,type LiveF2lSubphaseMetrics,type Phase,} from "@/lib/training/practice-model";
import { fmtShort } from "@/lib/utils/format";
import type { RefObject } from "react";
import { type CSSProperties } from "react";
import { createPortal } from "react-dom";

type PracticeHistoryPanelProps = {
  dailyTest: DailyTestRun | null;
  stats: { best: null; avg5: null; avg20: null; count: number; } | { best: number; avg5: number | null; avg20: number | null; count: number; };
  stableScoreDescription: string;
  history: SolveHistoryEntry[];
  historyListRef: RefObject<HTMLDivElement | null>;
  historyRowSize: number;
  recentHistory: SolveHistoryEntry[];
  recentSlowest: number;
  onCloseHistoryTip(): void;
  showHistoryCfopTip: (target: HTMLElement, entry: SolveHistoryEntry, historyNumber: number, pointer?: { x: number; y: number; }) => void;
  historyDialogOpen: boolean;
  onOpenHistory(): void;
  portalReady: boolean;
  historyCfopTip: HistoryCfopTip | null;
};

export function PracticeHistoryPanel({
  dailyTest,
  stats,
  stableScoreDescription,
  history,
  historyListRef,
  historyRowSize,
  recentHistory,
  recentSlowest,
  onCloseHistoryTip,
  showHistoryCfopTip,
  historyDialogOpen,
  onOpenHistory,
  portalReady,
  historyCfopTip, }: PracticeHistoryPanelProps) {
  const { t } = useLanguage();
  return (
    <div className="stats ui-info-panel" inert={!!dailyTest}>
      <div className="practice-card-head">
        <div className="practice-title-line">
          <div className="practice-card-title">{t("数据统计")}</div>
          <span className="practice-kicker" aria-hidden="true">STATISTICS</span>
        </div>
      </div>
      <div className="stat-grid">
        <div className="st st-primary"><div className="st-l">{t("总次数")}</div><div className="st-v">{stats.count}</div></div>
        <div className="st"><div className="st-l">{t("最佳")}</div><div className="st-v">{fmtShort(stats.best)}</div></div>
        <div className="st"><div className="st-l">AO5</div><div className="st-v">{fmtShort(stats.avg5)}</div></div>
        <div className="st st-stable-score" tabIndex={0}>
          <div className="st-l">{t("稳定成绩")}</div>
          <div className="st-v">{fmtShort(stats.avg20)}</div>
          <span className="stable-score-popover" role="tooltip">
            {stableScoreDescription}
          </span>
        </div>
      </div>
      <div className="practice-summary-history" aria-label={t("历史成绩")}>
        {history.length === 0 ? (
          <div className="hist-empty">{t("尚无记录")}</div>
        ) : (
          <div
            className="hist-list"
            ref={historyListRef}
            style={{ "--history-row-size": `${historyRowSize}px` } as CSSProperties}
          >
            {recentHistory.map((entry, index) => {
              const barWidth = recentSlowest > 0 ? `${Math.max(12, (entry.ms / recentSlowest) * 100)}%` : "0%";
              const isBest = stats.best === entry.ms;
              const historyNumber = history.length - index;
              return (
                <div
                  key={`${entry.ts}-${index}`}
                  className={`hist-row${isBest ? " best" : ""}`}
                  tabIndex={0}
                  aria-label={t(`历史记录 #${historyNumber}，${fmtShort(entry.ms)
                    }，${entry.source === "timer" ? t("纯计时器") : entry.moves == null ? t("步数未知") : t(`${entry.moves}步`)}`)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) onCloseHistoryTip();
                  }}
                  onFocus={(event) => {
                    if (event.target === event.currentTarget) showHistoryCfopTip(event.currentTarget, entry, historyNumber);
                  }}
                  onMouseEnter={(event) => showHistoryCfopTip(event.currentTarget, entry, historyNumber, { x: event.clientX, y: event.clientY })}
                  onMouseLeave={() => onCloseHistoryTip()}
                >
                  <span className="hr-i">#{String(historyNumber).padStart(3, "0")}</span>
                  <span className="hr-track" aria-hidden="true">
                    <span className="hr-bar" style={{ width: barWidth }}></span>
                  </span>
                  <span className={`hr-m${entry.source === "timer" ? " source-timer" : ""}`}>
                    {entry.source === "timer" ? t("计时") : entry.moves == null ? "—" : t(`${entry.moves}步`)}
                  </span>
                  {entry.source !== "timer" && <span className="hr-tps">{formatTps(calculateTps(entry.moves, entry.ms))} <small>TPS</small></span>}
                  <span className="hr-t">{fmtShort(entry.ms)}</span>
                </div>
              );
            })}
          </div>
        )}
        <button
          className="hist-more-btn"
          type="button"
          aria-label={t("查看更多")}
          aria-haspopup="dialog"
          aria-expanded={historyDialogOpen}
          onClick={() => {
            onCloseHistoryTip();
            onOpenHistory();
          }}
        >
          {t("更多")}
        </button>
        {portalReady && historyCfopTip && createPortal((
          <div
            className={`stats-cfop-floating-tip practice-cfop-floating-tip tip-${historyCfopTip.placement}`}
            role="tooltip"
            style={{
              left: historyCfopTip.left,
              top: historyCfopTip.top,
              "--tip-arrow-left": `${historyCfopTip.arrowLeft}px`,
              "--tip-arrow-top": `${historyCfopTip.arrowTop ?? 22}px`,
            } as CSSProperties}
          >
            <div className="hcf-head">
              <span>#{String(historyCfopTip.historyNumber).padStart(3, "0")}</span>
              <b>{fmtSolveDate(historyCfopTip.entry.ts)}</b>
            </div>
            <SolveRecordDetails entry={historyCfopTip.entry} />
          </div>
        ), document.body)}

      </div>
    </div>
  );
}

type PracticeScorePanelProps = {
  isManualTimer: boolean;
  solveMs: number;
  solveMoveCount: number;
  currentSolveTimeline: SolveTimelineRecord | null;
  phase: Phase;
  stageGuidanceVisible: boolean;
  cfopTimes: LiveCfopMetrics;
  cfopMoves: LiveCfopMetrics;
  f2lSubTimes: LiveF2lSubphaseMetrics;
  f2lSubMoves: LiveF2lSubphaseMetrics;
  solveFormulas: Partial<Record<"oll" | "pll", FormulaRecognitionResult>>;
  formulaTopViewFaceColors: Record<CubeFace, string>;
};

export function PracticeScorePanel({
  isManualTimer,
  solveMs,
  solveMoveCount,
  currentSolveTimeline,
  phase,
  stageGuidanceVisible,
  cfopTimes,
  cfopMoves,
  f2lSubTimes,
  f2lSubMoves,
  solveFormulas,
  formulaTopViewFaceColors, }: PracticeScorePanelProps) {
  const { t } = useLanguage();
  return (
    <div className="practice-live-panel practice-score-panel ui-info-panel">
      <div className="solve-metrics">
        <div className="practice-card-head">
          <div className="practice-title-line">
            <div className="practice-card-title">{t("当前成绩")}</div>
            <span className="practice-kicker" aria-hidden="true">SCORE</span>
          </div>
        </div>
        <div className={`solve-current-grid${isManualTimer ? " timer-only" : ""}`}>
          <div
            className="solve-metric-main"
            aria-label={isManualTimer ? fmtShort(solveMs) : `${fmtShort(solveMs)}, ${solveMoveCount} ${t("步")}, ${formatTps(calculateTps(solveMoveCount, solveMs))} TPS`}
          >
            <span
              className="solve-timeline-trigger"
              tabIndex={currentSolveTimeline ? 0 : undefined}
              aria-describedby={currentSolveTimeline ? "current-solve-timeline" : undefined}
            >
              <em>{fmtShort(solveMs)}</em>
              {currentSolveTimeline && (
                <SolveTimeline record={currentSolveTimeline} label={t("CFOP 阶段用时")} moveUnit={t("步")} placementKey={`${phase}:${stageGuidanceVisible}`} />
              )}
            </span>
            {isManualTimer ? (
              <b className="solve-source-label">{t("纯计时器")}</b>
            ) : (
              <div className="solve-metric-secondary">
                <b className="score-moves">{solveMoveCount} <small>{t("步")}</small></b>
                <b className="score-tps">{formatTps(calculateTps(solveMoveCount, solveMs))} <small>TPS</small></b>
              </div>
            )}
          </div>
          {!isManualTimer && <div className="solve-phase-grid" aria-label={t("CFOP 阶段用时")}>
            <div className={`solve-phase-card solve-phase-card-cross${cfopTimes.cross !== null ? " completed" : phase === "solving" ? " active" : ""}`}>
              <span>Cross</span>
              <b>
                {formatPhaseTimeDelta(toHistoryCfopMetrics(cfopTimes), "cross")}
                <small className="solve-phase-moves"> / {formatPhaseMoveDelta(toHistoryCfopMetrics(cfopMoves), "cross")}</small>
              </b>
            </div>
            <div
              className={`solve-phase-card solve-phase-card-f2l${cfopTimes.f2l !== null ? " completed" : phase === "solving" && cfopTimes.cross !== null ? " active" : ""}`}
              tabIndex={0}
              aria-describedby="current-f2l-subphase-tooltip"
            >
              <span>F2L</span>
              <b>
                {formatPhaseTimeDelta(toHistoryCfopMetrics(cfopTimes), "f2l")}
                <small className="solve-phase-moves"> / {formatPhaseMoveDelta(toHistoryCfopMetrics(cfopMoves), "f2l")}</small>
              </b>
              <div
                id="current-f2l-subphase-tooltip"
                className="f2l-subphase-popover"
                role="tooltip"
                aria-label={t("F2L 子阶段用时和步数")}
              >
                {F2L_SUBPHASES.map((subphase, index) => (
                  <span key={subphase.key}>
                    <strong>{index + 1}/4</strong>
                    <em>{formatF2lSubphaseTimeDelta(toHistoryCfopMetrics(cfopTimes), toHistoryF2lSubphaseMetrics(f2lSubTimes), subphase.key)}</em>
                    <b>{formatF2lSubphaseMoveDelta(toHistoryCfopMetrics(cfopMoves), toHistoryF2lSubphaseMetrics(f2lSubMoves), subphase.key)}</b>
                  </span>
                ))}
              </div>
            </div>
            {(["oll", "pll"] as const).map((key) => {
              const formula = solveFormulas[key];
              const previousPhase = key === "oll" ? "f2l" : "oll";
              return (
                <div
                  key={key}
                  className={`solve-phase-card solve-phase-card-${key}${cfopTimes[key] !== null ? " completed" : phase === "solving" && cfopTimes[previousPhase] !== null ? " active" : ""}`}
                  tabIndex={formula ? 0 : undefined}
                  aria-describedby={formula ? `current-${key}-formula-tooltip` : undefined}
                >
                  <span>{key.toUpperCase()}</span>
                  <b>
                    {formatPhaseTimeDelta(toHistoryCfopMetrics(cfopTimes), key)}
                    <small className="solve-phase-moves"> / {formatPhaseMoveDelta(toHistoryCfopMetrics(cfopMoves), key)}</small>
                  </b>
                  {formula && (
                    <div id={`current-${key}-formula-tooltip`} className="solve-formula-popover" role="tooltip">
                      <strong>{t(formula.name)}</strong>
                      <FormulaTopViewImage
                        facelets={formula.facelets}
                        faceColors={formulaTopViewFaceColors}
                        arrows={formula.arrows}
                        className="solve-formula-preview"
                        title={t(formula.name)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>}
        </div>
      </div>
    </div>
  );
}

export const HISTORY_ROW_SIZE = 44;

export const HISTORY_PREVIEW_LIMIT = 5;

export type HistoryCfopTip = {
  entry: SolveHistoryEntry;
  historyNumber: number;
  left: number;
  top: number;
  arrowLeft: number;
  arrowTop?: number;
  placement: "above" | "below" | "right";
};
