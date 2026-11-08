"use client";
import { useLanguage } from "@/components/i18n/language-provider";
import { AlgorithmStepToken,type AlgorithmStepStatus } from "@/components/ui/algorithm-step-token";
import { MoveToken } from "@/components/ui/move-token";
import { SettingNumber,SettingToggle } from "@/components/ui/setting-controls";
import { FORMULAS } from "@/lib/formulas/formulas-data";
import { isFormulaTrainerPhase,MAX_TRAINER_SESSION_ROUNDS,MIN_TRAINER_SESSION_ROUNDS } from "@/lib/training/trainer-preferences";
import type { TrainerSpecialty } from "@/lib/training/trainer-session-model";
import { TRAINER_SPECIALTIES,type FormulaHintStepStatus } from "@/lib/training/trainer-session-model";

type TrainerSettingsPanelProps = {
  sessionRoundLimit: number;
  settingsLocked: boolean;
  updateSessionRoundLimit: (value: string) => void;
  isRecognitionSpecialty: boolean;
  recognitionIncludeSlices: boolean;
  changeRecognitionIncludeSlices: (next: boolean) => void;
  recognitionIncludeWideMoves: boolean;
  changeRecognitionIncludeWideMoves: (next: boolean) => void;
  recognitionHintEnabled: boolean;
  changeRecognitionHintEnabled: (next: boolean) => void;
  selectedPhase: TrainerSpecialty;
  onOpenFormulaLibrary(): void;
  selectedCaseIds: { f2l: string[]; oll: string[]; pll: string[]; };
  f2lEdgeOnly: boolean;
  changeF2lEdgeOnly: (next: boolean) => void;
  formulaHintEnabled: boolean;
  changeFormulaHintEnabled: (next: boolean) => void;
  formulaArrowEnabled: boolean;
  changeFormulaArrowEnabled: (next: boolean) => void;
  canUseFocusMode: boolean;
  f2lFocusMode: boolean;
  toggleF2lFocusMode: () => void;
  gyroDisabled: boolean;
  toggleGyroDisabled: () => void;
  resetDisplayOrientation: () => void;
  canResetDisplayOrientation: boolean;
};

export function TrainerSettingsPanel({ sessionRoundLimit, settingsLocked, updateSessionRoundLimit, isRecognitionSpecialty, recognitionIncludeSlices, changeRecognitionIncludeSlices, recognitionIncludeWideMoves, changeRecognitionIncludeWideMoves, recognitionHintEnabled, changeRecognitionHintEnabled, selectedPhase, onOpenFormulaLibrary, selectedCaseIds, f2lEdgeOnly, changeF2lEdgeOnly, formulaHintEnabled, changeFormulaHintEnabled, formulaArrowEnabled, changeFormulaArrowEnabled, canUseFocusMode, f2lFocusMode, toggleF2lFocusMode, gyroDisabled, toggleGyroDisabled, resetDisplayOrientation, canResetDisplayOrientation }: TrainerSettingsPanelProps) {
  const { t } = useLanguage();
  return (
<div className="practice-control-panel trainer-settings-panel ui-info-panel">
              <div className="practice-card-head practice-control-head">
                <div className="practice-title-line">
                  <div className="practice-card-title">{t("专项设置")}</div>
                <span className="practice-kicker" aria-hidden="true">SETTINGS</span>
                </div>
              </div>
              <label className="ui-setting-row trainer-round-setting">
                <span>
                  <b>{t("每组测试轮数")}</b>
                </span>
                <SettingNumber data-testid="trainer-round-limit" min={MIN_TRAINER_SESSION_ROUNDS} max={MAX_TRAINER_SESSION_ROUNDS} value={sessionRoundLimit} disabled={settingsLocked} aria-label={t("每组测试轮数")} onCommit={(value) => updateSessionRoundLimit(String(value))} />
              </label>
              {isRecognitionSpecialty ? (
                <div className="trainer-option-list">
                  <SettingToggle label={t("加入中层转动")} checked={recognitionIncludeSlices} disabled={settingsLocked} onChange={changeRecognitionIncludeSlices} />
                  <SettingToggle label={t("加入宽层转动")} checked={recognitionIncludeWideMoves} disabled={settingsLocked} onChange={changeRecognitionIncludeWideMoves} />
                  <SettingToggle label={t("显示旋转箭头")} checked={recognitionHintEnabled} disabled={settingsLocked} onChange={changeRecognitionHintEnabled} />
                </div>
              ) : (
                <>
                  <div className="trainer-option-list">
                    {isFormulaTrainerPhase(selectedPhase) && (
                      <button type="button" className="ui-setting-row trainer-library-button" disabled={settingsLocked} onClick={onOpenFormulaLibrary} aria-haspopup="dialog">
                        <span><b>{t("formulaLibrary.title")}</b><small>{t("formulaLibrary.selected").replace("{count}", String(selectedCaseIds[selectedPhase].length)).replace("{total}", String(FORMULAS[selectedPhase].items.length))}</small></span>
                        <span aria-hidden="true">›</span>
                      </button>
                    )}
                    {selectedPhase === "f2l" && (
                      <SettingToggle label={t("仅判定目标棱")} checked={f2lEdgeOnly} disabled={settingsLocked} onChange={changeF2lEdgeOnly} />
                    )}
                    <SettingToggle label={t("公式提示")} checked={formulaHintEnabled} disabled={settingsLocked} onChange={changeFormulaHintEnabled} />
                    <SettingToggle label={t("显示旋转箭头")} checked={formulaArrowEnabled} disabled={settingsLocked || !formulaHintEnabled} onChange={changeFormulaArrowEnabled} />
                  </div>
                </>
              )}

              <div className="ui-setting-stack ui-setting-divider">
                {canUseFocusMode && <SettingToggle label={t("专注模式")} checked={f2lFocusMode} onChange={toggleF2lFocusMode} disabled={settingsLocked} shortcut="H" />}
                <SettingToggle label={t("connection.field.gyro")} checked={!gyroDisabled} onChange={toggleGyroDisabled} shortcut="L" />
              </div>
              <div className="ui-setting-actions ui-setting-divider">
                <button className="ui-setting-action trainer-reset-action" type="button" onClick={resetDisplayOrientation} disabled={!canResetDisplayOrientation} aria-keyshortcuts="R">{t("视角归位")}</button>
              </div>
            </div>
  );
}

type TrainerCatalogPanelProps = {
  selectedPhase: TrainerSpecialty;
  selectPhase: (phase: TrainerSpecialty) => void;
  settingsLocked: boolean;
};

export function TrainerCatalogPanel({ selectedPhase, selectPhase, settingsLocked }: TrainerCatalogPanelProps) {
  const { t } = useLanguage();
  return (
<div className="practice-control-panel trainer-catalog-panel ui-info-panel">
            <div className="practice-card-head practice-control-head">
              <div className="practice-title-line">
                <div className="practice-card-title">{t("专项列表")}</div>
                <span className="practice-kicker" aria-hidden="true">LIST</span>
              </div>
            </div>
            <div className="stage-tools trainer-phase-list" aria-label={t("专项阶段选择")}>
              {TRAINER_SPECIALTIES.map((phase) => (
                <button
                  key={phase.key}
                  type="button"
                  className={`tag tag-btn${selectedPhase === phase.key ? " active" : ""}`}
                  onClick={() => selectPhase(phase.key)}
                  disabled={settingsLocked}
                  aria-pressed={selectedPhase === phase.key}
                >
                  <span className="trainer-phase-copy">
                    <strong>{t(phase.name)}</strong>
                  </span>
                </button>
              ))}
            </div>
          </div>
  );
}

type TrainerHintPanelProps = {
  formulaHintCounter: number;
  formulaHintMoves: string[];
  formulaHintUndoDisplay: string[];
  formulaHintRows: { moves: Array<{ move: string; index: number; }>; }[];
  formulaHintIndex: number;
  formulaHintWrong: boolean;
  formulaHintStatus: FormulaHintStepStatus[];
};

export function TrainerHintPanel({ formulaHintCounter, formulaHintMoves, formulaHintUndoDisplay, formulaHintRows, formulaHintIndex, formulaHintWrong, formulaHintStatus }: TrainerHintPanelProps) {
  const { t } = useLanguage();
  return (
<div className="trainer-formula-panel ui-info-panel" role="status" aria-label={t("公式提示")}>
              <div className="ui-section-head">
                <div className="ui-section-title-line"><div className="ui-section-title">{t("公式提示")}</div><span className="ui-section-kicker" aria-hidden="true">HINT</span></div>
                <div className="sh-actions">
                  <div className="sh-counter">
                    <span className="sh-counter-num">{formulaHintCounter}</span>
                    <span className="sh-counter-sep">/</span>
                    <span className="sh-counter-total">{formulaHintMoves.length}</span>
                  </div>
                </div>
              </div>
              {formulaHintUndoDisplay.length > 0 && (
                <div className="sh-notice error">
                  <span className="sh-notice-label">{t("撤销提示：请依次转")}</span>
                  <span className="sh-undo-list">
                    {[...formulaHintUndoDisplay].reverse().map((move, index) => (
                      <MoveToken key={`${move}-${index}`} move={move} />
                    ))}
                  </span>
                </div>
              )}
              <div className="algo-display">
                {formulaHintRows.map((row, rowIndex) => (
                  <div className="algo-row" key={rowIndex}>
                    {row.moves.map(({ move, index }) => {
                      const stepStatus: AlgorithmStepStatus =
                        index === formulaHintIndex && (formulaHintWrong || formulaHintUndoDisplay.length > 0)
                          ? "wrong"
                          : formulaHintStatus[index] === "correct"
                            ? "correct"
                            : formulaHintStatus[index] === "partial"
                              ? "partial"
                              : "pending";
                      return (
                        <AlgorithmStepToken
                          key={`${move}-${index}`}
                          move={move}
                          index={index}
                          status={stepStatus}
                          active={index === formulaHintIndex && formulaHintIndex < formulaHintMoves.length}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
  );
}

type TrainerRecognitionPanelProps = {
  recognitionIndex: number;
  recognitionMoves: string[];
  recognitionStatuses: AlgorithmStepStatus[];
};

export function TrainerRecognitionPanel({ recognitionIndex, recognitionMoves, recognitionStatuses }: TrainerRecognitionPanelProps) {
  const { t } = useLanguage();
  return (
<div className="stage-hint trainer-recognition-sequence ui-info-panel" role="status" aria-live="polite" aria-label={t("转动序列")}>
                  <div className="ui-section-head">
                    <div className="ui-section-title-line">
                      <div className="ui-section-title">{t("转动序列")}</div>
                      <span className="ui-section-kicker" aria-hidden="true">SEQUENCE</span>
                    </div>
                  </div>
                  <div className="sh-grid trainer-recognition-viewport">
                    <div
                      className="trainer-recognition-track"
                      style={{ transform: `translateX(calc(var(--recognition-token-size) / -2 - ${recognitionIndex} * (var(--recognition-token-size) + var(--recognition-token-gap))))` }}
                    >
                      {recognitionMoves.map((move, index) => (
                        <AlgorithmStepToken
                          key={`${move}-${index}`}
                          move={move}
                          index={index}
                          status={recognitionStatuses[index] ?? "pending"}
                          active={index === recognitionIndex}
                          showIndex={false}
                        />
                      ))}
                    </div>
                  </div>
                </div>
  );
}



import { formatTps } from "@/lib/records/tps";
import { fmtShort } from "@/lib/utils/format";
import type { ReactNode } from "react";

export type TrainerScoreSummary = {
  kind: "recognition";
  recognitionCorrect: number;
  recognitionWrong: number;
  recognitionAccuracy: number;
  recognitionAverageResponseMs: number | null;
} | {
  kind: "cfop";
  sessionAverageObserveMs: number | null;
  sessionAverageSolveMs: number | null;
  sessionTps: number | null;
  sessionSuccessRate: number | null;
  sessionDnfCount: number;
  sessionRoundCount: number;
  sessionRoundLimit: number;
};

type TrainerScorePanelProps = {
  summary: TrainerScoreSummary;
  isSmallScreen: boolean;
  historyList: ReactNode;
};

export function TrainerScorePanel({ summary, isSmallScreen, historyList }: TrainerScorePanelProps) {
  const { t } = useLanguage();
  return (
    <div className="stats trainer-results-panel ui-info-panel" aria-live="polite">
      <div className="practice-card-head">
        <div className="practice-title-line">
          <div className="practice-card-title">{t("当前成绩")}</div>
          <span className="practice-kicker" aria-hidden="true">SCORE</span>
        </div>
      </div>
      {summary.kind === "recognition" ? (
        <div className="stat-grid">
          <div className="st st-primary">
            <div className="st-l">{t("正确")}</div>
            <div className="st-v">{summary.recognitionCorrect}</div>
          </div>
          <div className="st">
            <div className="st-l">{t("错误")}</div>
            <div className="st-v">{summary.recognitionWrong}</div>
          </div>
          <div className="st">
            <div className="st-l">{t("正确率")}</div>
            <div className="st-v">{summary.recognitionAccuracy}%</div>
          </div>
          <div className="st">
            <div className="st-l">{t("平均反应")}</div>
            <div className="st-v">{fmtShort(summary.recognitionAverageResponseMs)}</div>
          </div>
        </div>
      ) : (
        <div className="stat-grid">
          <div className="st st-primary">
            <div className="st-l">{t("平均观察")}</div>
            <div className="st-v">{fmtShort(summary.sessionAverageObserveMs)}</div>
          </div>
          <div className="st">
            <div className="st-l">{t("平均复原")}</div>
            <div className="st-v">{fmtShort(summary.sessionAverageSolveMs)}</div>
          </div>
          <div className="st">
            <div className="st-l">{t("平均 TPS")}</div>
            <div className="st-v">{formatTps(summary.sessionTps)}</div>
          </div>
          <div className="st">
            <div className="st-l">{t("复原成功率")}</div>
            <div className="st-v">{summary.sessionSuccessRate === null ? "—" : `${summary.sessionSuccessRate}%`}</div>
          </div>
          <div className="st">
            <div className="st-l">{t("本组进度")}{summary.sessionDnfCount > 0 ? ` · DNF ${summary.sessionDnfCount}` : ""}</div>
            <div className="st-v">{summary.sessionRoundCount}/{summary.sessionRoundLimit}</div>
          </div>
        </div>
      )}
      {!isSmallScreen && historyList}
    </div>
  );
}
