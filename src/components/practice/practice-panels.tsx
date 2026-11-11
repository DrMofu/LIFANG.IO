"use client";
import type { ConnectionState } from "@/components/connection/cube-connection-provider";
import { FormulaTopViewImage } from "@/components/cube/formula-cube-image";
import { useLanguage } from "@/components/i18n/language-provider";
import { SettingChoice,SettingToggle } from "@/components/ui/setting-controls";
import { type CubeFace } from "@/lib/cube/smart-cube";
import { FORMULA_LEARNING_STATUSES,getFormulaLearningStatus,type FormulaLearningStatus } from "@/lib/formulas/formula-learning-status";
import type { FormulaRecognitionResult } from "@/lib/formulas/formula-recognition";
import type { DailyLevelSolve } from "@/lib/records/solve-history";
import { type DailyLevelEntry } from "@/lib/records/solve-history";
import { calculateTps,formatTps } from "@/lib/records/tps";
import { DAILY_TEST_TARGET,type DailyTestRun,type SmartSolveStatus } from "@/lib/training/practice-model";
import { type PracticeMode,type TimingMode } from "@/lib/training/practice-preferences";
import { fmtShort } from "@/lib/utils/format";

type PracticeSettingsPanelProps = {
  dailyTest: DailyTestRun | null;
  practiceMode: PracticeMode;
  changePracticeMode: (nextMode: PracticeMode) => void;
  canSwitchMode: boolean;
  isManualTimer: boolean;
  changeTimingMode: (nextMode: TimingMode) => void;
  canSwitchTimingMode: boolean;
  connectionState: ConnectionState;
  gyroDisabled: boolean;
  toggleGyroDisabled: () => void;
  formulaRecognitionEnabled: boolean;
  toggleFormulaRecognition: () => void;
  resetDisplayOrientation: () => void;
  canResetDisplayOrientation: boolean;
  onSmartSolve(): void;
  smartSolveStatus: SmartSolveStatus;
};

export function PracticeSettingsPanel({
  dailyTest,
  practiceMode,
  changePracticeMode,
  canSwitchMode,
  isManualTimer,
  changeTimingMode,
  canSwitchTimingMode,
  connectionState,
  gyroDisabled,
  toggleGyroDisabled,
  formulaRecognitionEnabled,
  toggleFormulaRecognition,
  resetDisplayOrientation,
  canResetDisplayOrientation,
  onSmartSolve,
  smartSolveStatus, }: PracticeSettingsPanelProps) {
  const { t } = useLanguage();
  return (
    <div className="practice-control-panel practice-settings-panel ui-info-panel" inert={!!dailyTest}>
      <div className="practice-card-head practice-control-head">
        <div className="practice-title-line">
          <div className="practice-card-title">{t("练习设置")}</div>
          <span className="practice-kicker" aria-hidden="true">SETTINGS</span>
        </div>
      </div>
      <SettingChoice label={t("练习模式")}><div className="ui-setting-segments" role="group" aria-label={t("练习模式")}>
        <button
          type="button"
          aria-pressed={practiceMode === "scramble"} className={practiceMode === "scramble" ? "active" : ""}
          onClick={() => changePracticeMode("scramble")}
          disabled={!canSwitchMode}
        >{t("打乱练习")}</button>
        <button
          type="button"
          aria-pressed={practiceMode === "free"} className={practiceMode === "free" ? "active" : ""}
          onClick={() => changePracticeMode("free")}
          disabled={!canSwitchMode}
        >{t("自由练习")}</button>
      </div></SettingChoice>

      <SettingChoice label={t("计时方式")}><div className="ui-setting-segments" role="group" aria-label={t("计时方式")}>
        <button
          type="button"
          aria-pressed={!isManualTimer} className={!isManualTimer ? "active" : ""}
          onClick={() => changeTimingMode("smart-cube")}
          disabled={!!dailyTest}
          aria-disabled={!canSwitchTimingMode}
        >{connectionState === "connecting" ? t("连接中") : t("智能魔方")}</button>
        <button
          type="button"
          aria-pressed={isManualTimer} className={isManualTimer ? "active" : ""}
          onClick={() => changeTimingMode("timer")}
          disabled={!!dailyTest}
          aria-disabled={!canSwitchTimingMode}
        >{t("纯计时器")}</button>
      </div></SettingChoice>

      {!isManualTimer && <>
        <div className="ui-setting-stack ui-setting-divider">
          <SettingToggle label={t("connection.field.gyro")} checked={!gyroDisabled} onChange={toggleGyroDisabled} shortcut="L" />
          <SettingToggle label={t("公式识别")} checked={formulaRecognitionEnabled} onChange={toggleFormulaRecognition} shortcut="F" />
        </div>
        <div className="ui-setting-actions practice-settings-actions ui-setting-divider">
          <button type="button" className="ui-setting-action" onClick={resetDisplayOrientation} disabled={!canResetDisplayOrientation} aria-keyshortcuts="R">{t("视角归位")}</button>
          <button type="button" className="ui-setting-action" onClick={onSmartSolve} disabled={smartSolveStatus === "loading"} aria-keyshortcuts="Q">{smartSolveStatus === "loading" ? t("求解中") : t("智能求解")}</button>
        </div>
      </>}
    </div>
  );
}

type PracticeDailyTestPanelProps = {
  isSmallScreen: boolean;
  dailyTestDisplayDate: string;
  dailyTestDisplaySolves: DailyLevelSolve[];
  dailyTest: DailyTestRun | null;
  showYesterdayMakeupTest: boolean;
  startDailyLevelTest: (localDate?: string) => void;
  yesterdayLocalDate: string;
  canStartYesterdayMakeupTest: boolean;
  todayLocalDate: string;
  canStartTodayDailyTest: boolean;
  todayDailyLevel: DailyLevelEntry | null;
  onShowDailyResult(entry: DailyLevelEntry): void;
  onShowSolve(solve: DailyLevelSolve, index: number): void;
  dailyTestAverageLabel: string | null;
  cancelCurrentAttempt: () => void;
};

export function PracticeDailyTestPanel({
  isSmallScreen,
  dailyTestDisplayDate,
  dailyTestDisplaySolves,
  dailyTest,
  showYesterdayMakeupTest,
  startDailyLevelTest,
  yesterdayLocalDate,
  canStartYesterdayMakeupTest,
  todayLocalDate,
  canStartTodayDailyTest,
  todayDailyLevel,
  onShowDailyResult,
  onShowSolve,
  dailyTestAverageLabel,
  cancelCurrentAttempt, }: PracticeDailyTestPanelProps) {
  const { t } = useLanguage();
  const slowestSolve = Math.max(0, ...dailyTestDisplaySolves.map((solve) => solve.ms));
  return (
    <div className={`practice-card daily-test-card${isSmallScreen ? " ui-info-panel" : ""}`}>
      <div className="practice-card-head">
        <div className="practice-title-line">
          <div className="practice-card-title">{t("每日测试")}</div>
          <span className="practice-kicker" aria-hidden="true">DAILY TEST</span>
        </div>
        <div className="dt-date" tabIndex={0} aria-label={t(`${dailyTestDisplayDate}，每日 00:00 更新`)}>
          {dailyTestDisplayDate}
        </div>
      </div>
      <div className="dt-progress-copy">
        <strong>{dailyTestDisplaySolves.length}</strong>
        <span>/ {DAILY_TEST_TARGET}</span>
      </div>
      <div className="dt-progress" aria-label={t("每日五次测试进度")}>
        {Array.from({ length: DAILY_TEST_TARGET }, (_, index) => {
          const solve = dailyTestDisplaySolves[index];
          if (isSmallScreen && solve) return (
            <button key={index} type="button" className="dt-step done" aria-label={`${t("单次成绩")} #${index + 1}，${fmtShort(solve.ms)}`}
              aria-haspopup="dialog" onClick={() => onShowSolve(solve, index)}>
              <span className="dt-step-time">{fmtShort(solve.ms)}</span>
            </button>
          );
          return (
            <span key={index} className={`dt-step${solve ? " done" : ""}`}>
              <span className="dt-step-time">{solve ? fmtShort(solve.ms) : t("待测")}</span>
            </span>
          );
        })}
      </div>
      <div className={`dt-actions${!dailyTest && showYesterdayMakeupTest ? " dt-actions-split" : ""}`}>
        {!dailyTest && (
          showYesterdayMakeupTest ? (
            <>
              <button
                className="practice-btn practice-btn-ghost"
                onClick={() => startDailyLevelTest(yesterdayLocalDate)}
                disabled={!canStartYesterdayMakeupTest}
              >{t("补测昨日成绩")}</button>
              <button
                className="practice-btn practice-btn-primary"
                onClick={() => startDailyLevelTest(todayLocalDate)}
                disabled={!canStartTodayDailyTest}
              >{t("开始今日测试")}</button>
            </>
          ) : (
            <button
              className="practice-btn practice-btn-primary"
              onClick={() => todayDailyLevel ? onShowDailyResult(todayDailyLevel) : startDailyLevelTest(todayLocalDate)}
              disabled={!todayDailyLevel && !canStartTodayDailyTest}
            >
              {todayDailyLevel && dailyTestAverageLabel ? t(`今日平均用时 ${dailyTestAverageLabel}`) : t("开始今日测试")}
            </button>
          )
        )}
        {dailyTest && (
          <button className="practice-btn practice-btn-ghost" onClick={cancelCurrentAttempt}>{t("取消测试")}</button>
        )}
      </div>
      {!isSmallScreen && dailyTest && dailyTestDisplaySolves.length > 0 && (
        <ol className="hist-list dt-records" aria-label={t("每日测试")} aria-live="polite">
          {dailyTestDisplaySolves.toReversed().map((solve, index) => (
            <li key={`${solve.ts}-${dailyTestDisplaySolves.length - index}`} className="hist-row">
              <span className="hr-i">#{dailyTestDisplaySolves.length - index}</span>
              <span className="hr-track" aria-hidden="true">
                <span className="hr-bar" style={{ width: `${slowestSolve > 0 ? Math.max(12, solve.ms / slowestSolve * 100) : 0}%` }} />
              </span>
              <span className={`hr-m${solve.source === "timer" ? " source-timer" : ""}`}>
                {solve.source === "timer" ? t("计时") : solve.moves == null ? "—" : t(`${solve.moves}步`)}
              </span>
              {solve.source !== "timer" && <span className="hr-tps">{formatTps(calculateTps(solve.moves, solve.ms))} <small>TPS</small></span>}
              <span className="hr-t">{fmtShort(solve.ms)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type PracticeRecognitionPanelProps = {
  dailyTest: DailyTestRun | null;
  recognizedFormula: FormulaRecognitionResult | null;
  formulaTopViewFaceColors: Record<CubeFace, string>;
  formulaLearningStatuses: Record<string, FormulaLearningStatus>;
  connectionState: ConnectionState;
};

export function PracticeRecognitionPanel({ dailyTest, recognizedFormula, formulaTopViewFaceColors, formulaLearningStatuses, connectionState }: PracticeRecognitionPanelProps) {
  const { t } = useLanguage();
  return (
    <div className="practice-card formula-recognition-panel ui-info-panel" aria-live="polite" inert={!!dailyTest}>
      <div className="practice-card-head">
        <div className="practice-title-line">
          <div className="practice-card-title">{t("公式识别")}</div>
          <span className="practice-kicker" aria-hidden="true">OLL · PLL</span>
        </div>
      </div>
      {recognizedFormula ? (
        <div className="formula-recognition-result">
          <div className="formula-recognition-summary">
            <FormulaTopViewImage
              facelets={recognizedFormula.facelets}
              faceColors={formulaTopViewFaceColors}
              arrows={recognizedFormula.arrows}
              className="formula-recognition-image"
              title={t(recognizedFormula.name)}
            />
            <div className="formula-recognition-info">
              <div className="formula-recognition-name">
                <strong>{t(recognizedFormula.name)}</strong>
              </div>
              <div className="formula-recognition-meta">
                <span>{recognizedFormula.phase.toUpperCase()}</span>
                <div className="formula-recognition-count">
                  {recognizedFormula.formulas.length} {t("个公式")}
                </div>
              </div>
            </div>
          </div>
          <div className="formula-recognition-list">
            {recognizedFormula.formulas.map((formula) => {
              const status = getFormulaLearningStatus(
                formulaLearningStatuses,
                `${recognizedFormula.id}:${formula.id}`,
              );
              const statusLabel = FORMULA_LEARNING_STATUSES.find((item) => item.key === status)?.shortLabel ?? "未学习";
              return (
                <div className="formula-recognition-formula-row" key={formula.id}>
                  <div className="formula-recognition-formula-name">
                    <span>{t(formula.name)}</span>
                    <span className={`formula-status-badge status-${status}`}>{t(statusLabel)}</span>
                  </div>
                  <div className="formula-recognition-algorithm">{formula.algorithm}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`formula-recognition-empty${connectionState === "connected" ? "" : " disconnected"}`}>
          {connectionState === "connected" ? t("等待 OLL 或 PLL 状态") : t("连接智能魔方后开始识别")}
        </div>
      )}
    </div>
  );
}
