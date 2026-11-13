"use client";
import { useCubeConnection,type CubeFaceletsSignal,type CubeMoveSignal,type CubeVisualState,} from "@/components/connection/cube-connection-provider";
import { useCubeAppearance } from "@/components/cube/cube-appearance-provider";
import { CubeColorLegend } from "@/components/cube/cube-color-legend";
import { TurnSpeed } from "@/components/cube/turn-speed";
import { useLanguage } from "@/components/i18n/language-provider";
import { useGyroPowerNotice } from "@/components/notifications/gyro-power-notice";
import { useNotification } from "@/components/notifications/notification-provider";
import { DailyTestResultDialog } from "@/components/practice/daily-test-result-dialog";
import { PracticeMobileDialog,PracticeMobilePanels,PracticeSettingsButton } from "@/components/practice/practice-mobile-panels";
import { PracticeDailyTestPanel,PracticeRecognitionPanel,PracticeSettingsPanel } from "@/components/practice/practice-panels";
import { HISTORY_PREVIEW_LIMIT,HISTORY_ROW_SIZE,PracticeHistoryPanel,PracticeScorePanel,type HistoryCfopTip } from "@/components/practice/practice-results";
import { PracticeScramblePanel } from "@/components/practice/practice-scramble-panel";
import { useInspectionAudio } from "@/components/practice/use-inspection-audio";
import { SolveHistoryDialog } from "@/components/records/solve-history-dialog";
import { SolveRecordDetails,SOLVE_RECORD_TIP_HEIGHT as HISTORY_CFOP_TIP_HEIGHT,SOLVE_RECORD_TIP_WIDTH as HISTORY_CFOP_TIP_WIDTH,} from "@/components/records/solve-record-details";
import { AppFooter,AppTopbar } from "@/components/shell/app-shell";
import { AlgorithmStepToken,type AlgorithmStepStatus } from "@/components/ui/algorithm-step-token";
import { MoveToken } from "@/components/ui/move-token";
import { touchLocalUserDataPackageUpdatedAt } from "@/lib/account/user-data-package";
import { useClientReady } from "@/lib/browser/client-ready";
import { isTextEntryTarget } from "@/lib/browser/keyboard-shortcuts";
import { useKeyboardHints } from "@/lib/browser/use-keyboard-hints";
import { isCubeSerialAfter,normalizeCubeSerial } from "@/lib/connection/cube-serial";
import { expandMoveNotation,hintMoveForDoubleTurnProgress,moveCanStillMatchExpected,movePartiallyMatchesExpectedDoubleTurn,movesMatchExpected,parseMoveNotation,} from "@/lib/cube/algorithms";
import { getFaceHexColors,loadPracticeGyroDisabled,mapMoveToOrientation,savePracticeGyroDisabled } from "@/lib/cube/cube-appearance";
import { detectCfopMilestones,detectF2lSolvedSlotCount,isSolvedFacelets } from "@/lib/cube/cube-state";
import { getInitialCubeVisualState } from "@/lib/cube/cube-visual-state";
import { solveFacelets } from "@/lib/cube/cubing-solver";
import { appendUndoStackMoves,buildUndoStack,getRemainingUndoStack,normalizeMove,splitInvalidPendingMoves,} from "@/lib/cube/move-sequence";
import { PendingMoveQueue } from "@/lib/cube/pending-move-queue";
import { mountSmartCube,type CubeFace,type CubeQuaternion,type SmartCubeApi } from "@/lib/cube/smart-cube";
import { readFormulaLearningStatuses,type FormulaLearningStatus } from "@/lib/formulas/formula-learning-status";
import type { FormulaRecognitionResult } from "@/lib/formulas/formula-recognition";
import { DEFAULT_AVERAGE_TIME_SETTINGS,calculateAverageTime,describeAverageTimeSettings,loadAverageTimeSettings,type AverageTimeSettings,} from "@/lib/records/average-time";
import { addDailyPracticeDuration,calculateDailyLevelAverage,getArchiveScopedStorageKey,getDailyTestDateKey,loadDailyLevels,loadSolveHistory,prependSolveHistoryEntry,saveDailyLevels,saveSolveHistory,subscribeStatisticsArchiveChange,type DailyLevelEntry,type SolveHistoryEntry,type SolveSource,} from "@/lib/records/solve-history";
import { TurnCounter } from "@/lib/records/tps";
import { DEFAULT_PRACTICE_INSPECTION_SETTINGS,getPracticeInspectionDurationMs,loadPracticeInspectionSettings,type PracticeInspectionSettings,} from "@/lib/training/practice-inspection";
import type { SolveTimelineRecord } from "@/lib/training/practice-model";
import { DAILY_TEST_TARGET,F2L_SUBPHASES,toHistoryCfopMetrics,toHistoryF2lSubphaseMetrics,type CfopPhaseKey,type CurrentPracticeResult,type DailyTestRun,type FreePracticeState,type LiveCfopMetrics,type LiveF2lSubphaseMetrics,type ManualTimerArmState,type Phase,type ScrambleStepStatus,type SmartSolveStatus,type SmartSolveStepStatus } from "@/lib/training/practice-model";
import { PRACTICE_CUBE_CAMERA_PRESET,PRACTICE_UI_PREFERENCES_KEY,isDefaultDisplayState,loadPracticeDisplayState,loadPracticeFormulaRecognitionEnabled,loadPracticeUiPreferences,savePracticeDisplayState,savePracticeFormulaRecognitionEnabled,savePracticeUiPreferences,type PracticeMode,type TimingMode,} from "@/lib/training/practice-preferences";
import { fmtShort,fmtTime } from "@/lib/utils/format";
import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent } from "react";

const SCRAMBLE_MOVES: CubeFace[] = ["U", "D", "L", "R", "F", "B"];

const SCRAMBLE_AXES: Record<CubeFace, "ud" | "lr" | "fb"> = {
  U: "ud",
  D: "ud",
  L: "lr",
  R: "lr",
  F: "fb",
  B: "fb",
};

const FREE_SCRAMBLE_IDLE_MS = 6000;

const FREE_SCRAMBLE_FILL_DELAY_MS = 1000;

const FREE_SCRAMBLE_FILL_MS = FREE_SCRAMBLE_IDLE_MS - FREE_SCRAMBLE_FILL_DELAY_MS;

const SCRAMBLE_LENGTH = 20;

const AUTO_NEXT_SCRAMBLE_DELAY_MS = 350;

const SOLVED_TRAILING_MOVE_SUPPRESS_MS = 900;

const CUBE_MOVE_ANIMATION_MS = 150;

const MAX_UNDO_HINT_QUEUE_LENGTH = 20;

const HISTORY_CFOP_TIP_GAP = 12;

const HISTORY_CFOP_TIP_MARGIN = 14;

const INSPECTION_END_CUE_PRESERVE_MS = 320;

const SMART_SOLVE_FACELETS_TIMEOUT_MS = 1300;

const MANUAL_TIMER_ARM_MS = 350;

let lastCompletedPracticeResult: CurrentPracticeResult | null = null;

type FormulaRecognitionModule = typeof import("@/lib/formulas/formula-recognition");

const EMPTY_CFOP: LiveCfopMetrics = {
  cross: null,
  f2l: null,
  oll: null,
  pll: null,
};

const EMPTY_F2L_SUBPHASES: LiveF2lSubphaseMetrics = {
  one: null,
  two: null,
  three: null,
  four: null,
};

function getYesterdayDailyTestDateKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return getDailyTestDateKey(date);
}

const INITIAL_SCRAMBLE = [
  "R",
  "U'",
  "F",
  "L'",
  "D",
  "R'",
  "U",
  "F",
  "U",
  "L",
  "F'",
  "D'",
  "F'",
  "R",
  "U'",
  "D",
  "L'",
  "D",
  "R'",
  "F",
];

function randomMove(prev: string | null) {
  let face: CubeFace;
  do {
    face = SCRAMBLE_MOVES[Math.floor(Math.random() * SCRAMBLE_MOVES.length)];
  } while (prev && SCRAMBLE_AXES[prev[0] as CubeFace] === SCRAMBLE_AXES[face]);
  const dir = ["", "'", "2"][Math.floor(Math.random() * 3)];
  return face + dir;
}

function generateScramble(len = SCRAMBLE_LENGTH) {
  const out: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < len; i++) {
    const move = randomMove(prev);
    out.push(move);
    prev = move;
  }
  return out;
}

function solveHistoryEntryKey(entry: SolveHistoryEntry) {
  return `${entry.ts}:${entry.ms}:${entry.mode ?? ""}:${entry.dailyTest?.id ?? ""}:${entry.dailyTest?.index ?? ""}`;
}

function mergeSolveHistories(...histories: SolveHistoryEntry[][]) {
  const byKey = new Map<string, SolveHistoryEntry>();
  histories.flat().forEach((entry) => {
    byKey.set(solveHistoryEntryKey(entry), entry);
  });
  return Array.from(byKey.values()).sort((left, right) => right.ts - left.ts);
}

function freshScrambleStatus() {
  return Array.from({ length: SCRAMBLE_LENGTH }, () => "pending" as ScrambleStepStatus);
}

function freshSmartSolveStatus(length: number) {
  return Array.from({ length }, () => "pending" as SmartSolveStepStatus);
}

export function CubePracticeApp() {
  const { t } = useLanguage();
  const keyboardHints = useKeyboardHints();
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [mobileDialog, setMobileDialog] = useState<"settings" | null>(null);
  const showKeyboardHints = keyboardHints && !isSmallScreen;
  useEffect(() => {
    const query = window.matchMedia("(width <= 700px)");
    const update = () => {
      setIsSmallScreen(query.matches);
      if (!query.matches) setMobileDialog(null);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const cubeMountRef = useRef<HTMLDivElement | null>(null);
  const cubeApiRef = useRef<SmartCubeApi | null>(null);
  const historyListRef = useRef<HTMLDivElement | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoNextScrambleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beginAutoNextScrambleRef = useRef<() => void>(() => undefined);
  const inspectionEndCueUntilRef = useRef(0);
  const freeIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freeCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const freeFaceletsFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualTimerArmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const { warmInspectionAudio, cancelInspectionAudio, playInspectionBeep, scheduleInspectionAudio } = useInspectionAudio(phaseRef);
  const practiceModeRef = useRef<PracticeMode>("scramble");
  const timingModeRef = useRef<TimingMode>("smart-cube");
  const solveSourceRef = useRef<SolveSource>("timer");
  const manualTimerArmStateRef = useRef<ManualTimerArmState>("idle");
  const manualTimerOverrideRef = useRef(false);
  const pendingSmartModeRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const freeStateRef = useRef<FreePracticeState>("waitingSolved");
  const solveStartRef = useRef(0);
  const solveStartedAtEpochRef = useRef(0);
  const solveMsRef = useRef(0);
  const solveMoveCountRef = useRef(0);
  const solveTimelineMovesRef = useRef<SolveTimelineRecord["moves"]>([]);
  const timelineArchiveStorageKeyRef = useRef<string | null>(null);
  const [completedSolveTimeline, setCompletedSolveTimeline] = useState<SolveTimelineRecord | null>(null);
  const turnCounterRef = useRef(new TurnCounter());
  const freeScrambleMoveCountRef = useRef(0);
  const freeAwaitingIdleFaceletsRef = useRef(false);
  const lastFreeMoveAtRef = useRef(0);
  const gyroDisabledRef = useRef(false);
  const scrambleIndexRef = useRef(0);
  const scrambleRef = useRef<string[]>(INITIAL_SCRAMBLE);
  const pendingScrambleMovesRef = useRef<string[]>([]);
  const pendingScrambleAnimatedCountRef = useRef(0);
  const pendingUndoMovesRef = useRef<string[]>([]);
  const pendingUndoAnimatedCountRef = useRef(0);
  const pendingAutoNextScrambleMovesRef = useRef<string[]>([]);
  const undoStackRef = useRef<string[]>([]);
  const smartSolveStatusRef = useRef<SmartSolveStatus>("idle");
  const smartSolveStepsRef = useRef<string[]>([]);
  const smartSolveIndexRef = useRef(0);
  const smartSolvePendingMovesRef = useRef<string[]>([]);
  const smartSolvePendingAnimatedCountRef = useRef(0);
  const smartSolvePendingUndoMovesRef = useRef<string[]>([]);
  const smartSolvePendingUndoAnimatedCountRef = useRef(0);
  const smartSolveUndoStackRef = useRef<string[]>([]);
  const smartSolveFaceletsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smartSolveFaceletsResolverRef = useRef<((facelets: string | null) => void) | null>(null);
  const solveFormulasRef = useRef<Partial<Record<"oll" | "pll", FormulaRecognitionResult>>>({});
  const [solveFormulas, setSolveFormulas] = useState<Partial<Record<"oll" | "pll", FormulaRecognitionResult>>>({});
  const cfopTimesRef = useRef<LiveCfopMetrics>(EMPTY_CFOP);
  const cfopMovesRef = useRef<LiveCfopMetrics>(EMPTY_CFOP);
  const f2lSubTimesRef = useRef<LiveF2lSubphaseMetrics>(EMPTY_F2L_SUBPHASES);
  const f2lSubMovesRef = useRef<LiveF2lSubphaseMetrics>(EMPTY_F2L_SUBPHASES);
  const highestF2lSolvedSlotCountRef = useRef(0);
  const historyRef = useRef<SolveHistoryEntry[]>([]);
  const dailyTestRef = useRef<DailyTestRun | null>(null);
  const lastFaceletsRequestRef = useRef(0);
  const faceletsRef = useRef<string | null>(null);
  const isConnectedRef = useRef(false);
  const visualStateRef = useRef<CubeVisualState>({ baseFacelets: null, moves: [] });
  const lastAppliedFaceletsRef = useRef<string | null>(null);
  const forceNextVisualFaceletsSyncRef = useRef(false);
  const hasRealtimeMovesRef = useRef(false);
  const suppressSolvedTrailingMoveUntilRef = useRef(0);
  const postSolveMoveGateRef = useRef<{ faceletsSerial: number } | null>(null);
  const formulaRecognitionEnabledRef = useRef(false);
  const formulaRecognitionModuleRef = useRef<FormulaRecognitionModule | null>(null);
  const formulaRecognitionLoadRef = useRef<Promise<FormulaRecognitionModule> | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("scramble");
  const [timingMode, setTimingMode] = useState<TimingMode>("smart-cube");
  const [manualTimerArmState, setManualTimerArmState] = useState<ManualTimerArmState>("idle");
  const [manualFallbackNotice, setManualFallbackNotice] = useState(false);
  const [freeState, setFreeState] = useState<FreePracticeState>("waitingSolved");
  const [freeIdleMsLeft, setFreeIdleMsLeft] = useState(FREE_SCRAMBLE_IDLE_MS);
  const [, setFreeScrambleMoveCount] = useState(0);
  const [freeNotice, setFreeNotice] = useState<string | null>(null);
  const [gyroDisabled, setGyroDisabled] = useState(false);
  const { notifyGyroEnabled } = useGyroPowerNotice();
  const { notify, dismiss } = useNotification();
  const smartSolveRunRef = useRef(0);
  const [formulaRecognitionEnabled, setFormulaRecognitionEnabled] = useState(false);
  const [recognizedFormula, setRecognizedFormula] = useState<FormulaRecognitionResult | null>(null);
  const [formulaLearningStatuses, setFormulaLearningStatuses] = useState<Record<string, FormulaLearningStatus>>({});
  const [viewResetEnabled, setViewResetEnabled] = useState(false);
  const [inspectionSettings, setInspectionSettings] = useState<PracticeInspectionSettings>(
    DEFAULT_PRACTICE_INSPECTION_SETTINGS,
  );
  const [inspectMs, setInspectMs] = useState(DEFAULT_PRACTICE_INSPECTION_SETTINGS.seconds * 1000);
  const [solveMs, setSolveMs] = useState(0);
  const [solveMoveCount, setSolveMoveCount] = useState(0);
  const [history, setHistory] = useState<SolveHistoryEntry[]>([]);
  const [dailyTestResult, setDailyTestResult] = useState<DailyLevelEntry | null>(null);
  const [dailyLevels, setDailyLevels] = useState<DailyLevelEntry[]>([]);
  const [dailyTest, setDailyTest] = useState<DailyTestRun | null>(null);
  const [averageSettings, setAverageSettings] = useState<AverageTimeSettings>(DEFAULT_AVERAGE_TIME_SETTINGS);
  const [scramble, setScramble] = useState(INITIAL_SCRAMBLE);
  const [scrambleIndex, setScrambleIndex] = useState(0);
  const [scrambleStatus, setScrambleStatus] = useState<ScrambleStepStatus[]>(() => freshScrambleStatus());
  const [, setScrambleNotice] = useState(t("点击开始打乱后，按公式转动真实魔方。"));
  const [scrambleWrong, setScrambleWrong] = useState(false);
  const [undoDisplay, setUndoDisplay] = useState<string[]>([]);
  const [smartSolveStatus, setSmartSolveStatus] = useState<SmartSolveStatus>("idle");
  const [smartSolveSteps, setSmartSolveSteps] = useState<string[]>([]);
  const [smartSolveIndex, setSmartSolveIndex] = useState(0);
  const [smartSolveStepStatus, setSmartSolveStepStatus] = useState<SmartSolveStepStatus[]>([]);
  const [smartSolveNotice, setSmartSolveNotice] = useState("");
  const [smartSolveWrong, setSmartSolveWrong] = useState(false);
  const [smartSolveUndoDisplay, setSmartSolveUndoDisplay] = useState<string[]>([]);
  const [cfopTimes, setCfopTimes] = useState<LiveCfopMetrics>(EMPTY_CFOP);
  const [f2lSubTimes, setF2lSubTimes] = useState<LiveF2lSubphaseMetrics>(EMPTY_F2L_SUBPHASES);
  const [f2lSubMoves, setF2lSubMoves] = useState<LiveF2lSubphaseMetrics>(EMPTY_F2L_SUBPHASES);
  const [historyCfopTip, setHistoryCfopTip] = useState<HistoryCfopTip | null>(null);
  const portalReady = useClientReady();
  const canResetDisplayOrientation = viewResetEnabled || !gyroDisabled;
  const [historyRows, setHistoryRows] = useState(HISTORY_PREVIEW_LIMIT);
  const [historyRowSize, setHistoryRowSize] = useState(HISTORY_ROW_SIZE);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [dailySolveDetails, setDailySolveDetails] = useState<{ entry: SolveHistoryEntry; index: number } | null>(null);

  const {
    connectionState,
    facelets,
    connectRealCube,
    requestBattery,
    requestFacelets,
    getLatestGyro,
    subscribeMove,
    subscribeGyro,
    subscribeFacelets,
    visualState,
  } = useCubeConnection();
  const { orientation, faceColors, renderMaxFps, backFaceProjectionEnabled, backFaceProjectionDistance } = useCubeAppearance();
  const formulaTopViewFaceColors = useMemo(() => getFaceHexColors(orientation, "cubing-js"), [orientation]);
  isConnectedRef.current = connectionState === "connected";
  visualStateRef.current = visualState;
  const inspectionDurationMs = useMemo(
    () => getPracticeInspectionDurationMs(inspectionSettings),
    [inspectionSettings],
  );
  const inspectionNoticeLabel = inspectionDurationMs === null ? t("无限观察") : t(`${inspectionSettings.seconds} 秒观察`);


  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    practiceModeRef.current = practiceMode;
  }, [practiceMode]);

  useEffect(() => {
    timingModeRef.current = timingMode;
  }, [timingMode]);

  useEffect(() => {
    manualTimerArmStateRef.current = manualTimerArmState;
  }, [manualTimerArmState]);

  useEffect(() => {
    freeStateRef.current = freeState;
  }, [freeState]);

  useEffect(() => {
    faceletsRef.current = facelets;
  }, [facelets]);

  useEffect(() => {
    function refreshArchiveData() {
      const archiveStorageKey = getArchiveScopedStorageKey(PRACTICE_UI_PREFERENCES_KEY);
      // Saving a solve also refreshes statistics; discard transient moves only on an archive switch.
      if (timelineArchiveStorageKeyRef.current !== archiveStorageKey) {
        solveTimelineMovesRef.current = [];
        if (lastCompletedPracticeResult?.archiveStorageKey !== archiveStorageKey) lastCompletedPracticeResult = null;
        const result = lastCompletedPracticeResult;
        solveMsRef.current = result?.ms ?? 0;
        solveMoveCountRef.current = result?.moveCount ?? 0;
        solveSourceRef.current = result?.source ?? "timer";
        cfopTimesRef.current = result?.cfop ?? EMPTY_CFOP;
        cfopMovesRef.current = result?.cfopMoves ?? EMPTY_CFOP;
        f2lSubTimesRef.current = result?.f2l ?? EMPTY_F2L_SUBPHASES;
        f2lSubMovesRef.current = result?.f2lMoves ?? EMPTY_F2L_SUBPHASES;
        solveFormulasRef.current = result?.formulas ?? {};
        setSolveMs(solveMsRef.current);
        setSolveMoveCount(solveMoveCountRef.current);
        setCfopTimes(cfopTimesRef.current);
        setF2lSubTimes(f2lSubTimesRef.current);
        setF2lSubMoves(f2lSubMovesRef.current);
        setSolveFormulas(solveFormulasRef.current);
        setCompletedSolveTimeline(result?.timeline ?? null);
        phaseRef.current = result ? "done" : "idle";
        setPhase(phaseRef.current);
        timelineArchiveStorageKeyRef.current = archiveStorageKey;
      }
      const disabled = loadPracticeGyroDisabled();
      const recognitionEnabled = loadPracticeFormulaRecognitionEnabled();
      const uiPreferences = loadPracticeUiPreferences();
      const nextHistory = loadSolveHistory();
      gyroDisabledRef.current = disabled;
      formulaRecognitionEnabledRef.current = recognitionEnabled;
      historyRef.current = nextHistory;
      if (uiPreferences) {
        practiceModeRef.current = uiPreferences.practiceMode;
        timingModeRef.current = uiPreferences.timingMode;
        manualTimerOverrideRef.current = uiPreferences.timingMode === "timer";
        setPracticeMode(uiPreferences.practiceMode);
        setTimingMode(uiPreferences.timingMode);
      }
      setGyroDisabled(disabled);
      setFormulaRecognitionEnabled(recognitionEnabled);
      setFormulaLearningStatuses(readFormulaLearningStatuses());
      if (!recognitionEnabled) setRecognizedFormula(null);
      setHistory(nextHistory);
      setDailyLevels(loadDailyLevels());
      setAverageSettings(loadAverageTimeSettings());
      setInspectionSettings(loadPracticeInspectionSettings());
    }

    refreshArchiveData();
    return subscribeStatisticsArchiveChange(refreshArchiveData);
  }, []);

  useEffect(() => {
    scrambleRef.current = scramble;
  }, [scramble]);

  useEffect(() => {
    smartSolveStatusRef.current = smartSolveStatus;
  }, [smartSolveStatus]);

  useEffect(() => {
    smartSolveStepsRef.current = smartSolveSteps;
  }, [smartSolveSteps]);

  useEffect(() => {
    smartSolveIndexRef.current = smartSolveIndex;
  }, [smartSolveIndex]);

  useLayoutEffect(() => {
    const list = historyListRef.current;
    const summary = list?.closest<HTMLElement>(".stats");
    const sidebar = summary?.closest<HTMLElement>(".practice-right");
    const more = summary?.querySelector<HTMLElement>(".hist-more-btn");
    if (!list || !summary || !more) return;
    const desktop = window.matchMedia("(width > 1240px)");

    const updateRows = () => {
      if (!desktop.matches) {
        setHistoryRows(HISTORY_PREVIEW_LIMIT);
        setHistoryRowSize(HISTORY_ROW_SIZE);
        return;
      }
      if (!sidebar) return;
      const sidebarStyle = window.getComputedStyle(sidebar);
      const summaryStyle = window.getComputedStyle(summary);
      const moreStyle = window.getComputedStyle(more);
      const available = sidebar.getBoundingClientRect().bottom
        - parseFloat(sidebarStyle.paddingBottom)
        - parseFloat(summaryStyle.paddingBottom)
        - parseFloat(summaryStyle.borderBottomWidth)
        - list.getBoundingClientRect().top
        - more.getBoundingClientRect().height
        - parseFloat(moreStyle.marginTop);
      const space = Math.max(0, available);
      const rows = Math.min(HISTORY_PREVIEW_LIMIT, Math.floor(space / (HISTORY_ROW_SIZE - 2)));
      setHistoryRows(rows);
      setHistoryRowSize(rows > 0 ? Math.min(HISTORY_ROW_SIZE, Math.floor(space / rows * 64) / 64) : HISTORY_ROW_SIZE);
    };

    updateRows();
    if (!sidebar) return;
    const observer = new ResizeObserver(updateRows);
    observer.observe(sidebar);
    observer.observe(summary);
    const score = sidebar.querySelector<HTMLElement>(".practice-score-panel");
    if (score) observer.observe(score);
    desktop.addEventListener("change", updateRows);
    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", updateRows);
    };
  }, [history.length, isSmallScreen]);

  const clearSolveTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const clearManualTimerArm = useCallback(() => {
    if (manualTimerArmRef.current) {
      clearTimeout(manualTimerArmRef.current);
      manualTimerArmRef.current = null;
    }
    manualTimerArmStateRef.current = "idle";
    setManualTimerArmState("idle");
  }, []);

  const updateSolveMs = useCallback((value: number) => {
    solveMsRef.current = value;
    setSolveMs(value);
  }, []);

  const requestFaceletsThrottled = useCallback(() => {
    const now = performance.now();
    if (now - lastFaceletsRequestRef.current < 350) return;
    lastFaceletsRequestRef.current = now;
    void requestFacelets();
  }, [requestFacelets]);

  const loadFormulaRecognitionModule = useCallback(() => {
    if (formulaRecognitionModuleRef.current) return Promise.resolve(formulaRecognitionModuleRef.current);
    if (!formulaRecognitionLoadRef.current) {
      formulaRecognitionLoadRef.current = import("@/lib/formulas/formula-recognition").then((recognitionModule) => {
        formulaRecognitionModuleRef.current = recognitionModule;
        return recognitionModule;
      });
    }
    return formulaRecognitionLoadRef.current;
  }, []);

  const detectFormulaRecognition = useCallback(
    (nextFacelets: string) => {
      const recording = phaseRef.current === "solving" && solveSourceRef.current === "smart-cube";
      if (!formulaRecognitionEnabledRef.current && !recording) return;
      const recognitionModule = formulaRecognitionModuleRef.current;
      if (!recognitionModule) return;
      const match = recognitionModule.recognizeLastLayerFormula(nextFacelets, orientation);
      if (!match) return;
      if (recording && !solveFormulasRef.current[match.phase]
        && (match.phase !== "oll" || (!solveFormulasRef.current.pll && cfopTimesRef.current.oll === null))) {
        solveFormulasRef.current = { ...solveFormulasRef.current, [match.phase]: match };
        setSolveFormulas(solveFormulasRef.current);
      }
      if (!formulaRecognitionEnabledRef.current) return;
      setRecognizedFormula((current) => (
        current?.phase === match.phase && current.id === match.id ? current : match
      ));
    },
    [orientation],
  );

  useEffect(() => {
    if (!formulaRecognitionEnabled && connectionState !== "connected") return;
    let cancelled = false;
    void loadFormulaRecognitionModule().then(() => {
      if (cancelled || !faceletsRef.current) return;
      detectFormulaRecognition(faceletsRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [connectionState, detectFormulaRecognition, formulaRecognitionEnabled, loadFormulaRecognitionModule]);

  const armPostSolveMoveGate = useCallback((faceletsSerial: number) => {
    postSolveMoveGateRef.current = { faceletsSerial: normalizeCubeSerial(faceletsSerial) };
  }, []);

  const clearPostSolveMoveGate = useCallback(() => {
    postSolveMoveGateRef.current = null;
  }, []);

  const shouldIgnoreInitialPostSolveMove = useCallback((signal?: CubeMoveSignal) => {
    const gate = postSolveMoveGateRef.current;
    if (!gate) return false;

    if (!signal || !Number.isFinite(signal.serial)) {
      postSolveMoveGateRef.current = null;
      return false;
    }

    if (!isCubeSerialAfter(gate.faceletsSerial, signal.serial)) {
      return true;
    }

    postSolveMoveGateRef.current = null;
    return false;
  }, []);

  const setFreePracticeState = useCallback((next: FreePracticeState) => {
    freeStateRef.current = next;
    setFreeState(next);
  }, []);

  const clearFreeTimers = useCallback(() => {
    if (freeIdleTimerRef.current) {
      clearTimeout(freeIdleTimerRef.current);
      freeIdleTimerRef.current = null;
    }
    if (freeCountdownTimerRef.current) {
      clearInterval(freeCountdownTimerRef.current);
      freeCountdownTimerRef.current = null;
    }
    if (freeFaceletsFallbackTimerRef.current) {
      clearTimeout(freeFaceletsFallbackTimerRef.current);
      freeFaceletsFallbackTimerRef.current = null;
    }
    freeAwaitingIdleFaceletsRef.current = false;
  }, []);

  const clearAutoNextScrambleTimer = useCallback(() => {
    if (autoNextScrambleTimerRef.current === null) return;
    clearTimeout(autoNextScrambleTimerRef.current);
    autoNextScrambleTimerRef.current = null;
  }, []);

  const clearPendingAutoNextScrambleMoves = useCallback(() => {
    pendingAutoNextScrambleMovesRef.current = [];
  }, []);

  const confirmFreeScrambleIdle = useCallback(
    (nextFacelets: string | null) => {
      if (practiceModeRef.current !== "free" || freeStateRef.current !== "scrambling") return false;
      if (!freeAwaitingIdleFaceletsRef.current) return false;

      freeAwaitingIdleFaceletsRef.current = false;
      if (freeFaceletsFallbackTimerRef.current) {
        clearTimeout(freeFaceletsFallbackTimerRef.current);
        freeFaceletsFallbackTimerRef.current = null;
      }

      if (!nextFacelets) {
        setFreeIdleMsLeft(0);
        setFreeNotice(t("未能同步魔方状态，请转动一下面或重新连接。"));
        return true;
      }

      if (isSolvedFacelets(nextFacelets)) {
        freeScrambleMoveCountRef.current = 0;
        setFreeScrambleMoveCount(0);
        setFreeIdleMsLeft(FREE_SCRAMBLE_IDLE_MS);
        setFreePracticeState("ready");
        setFreeNotice(null);
        return true;
      }

      setFreePracticeState("armed");
      setFreeIdleMsLeft(0);
      setFreeNotice(null);
      return true;
    },
    [setFreePracticeState, t],
  );

  const scheduleFreeIdleCheck = useCallback(() => {
    if (freeIdleTimerRef.current) clearTimeout(freeIdleTimerRef.current);
    if (freeCountdownTimerRef.current) clearInterval(freeCountdownTimerRef.current);
    if (freeFaceletsFallbackTimerRef.current) {
      clearTimeout(freeFaceletsFallbackTimerRef.current);
      freeFaceletsFallbackTimerRef.current = null;
    }

    freeAwaitingIdleFaceletsRef.current = false;
    lastFreeMoveAtRef.current = performance.now();
    setFreeIdleMsLeft(FREE_SCRAMBLE_IDLE_MS);

    freeCountdownTimerRef.current = setInterval(() => {
      const left = Math.max(0, FREE_SCRAMBLE_IDLE_MS - (performance.now() - lastFreeMoveAtRef.current));
      setFreeIdleMsLeft(left);
    }, 100);

    freeIdleTimerRef.current = setTimeout(() => {
      if (freeCountdownTimerRef.current) {
        clearInterval(freeCountdownTimerRef.current);
        freeCountdownTimerRef.current = null;
      }
      freeIdleTimerRef.current = null;
      setFreeIdleMsLeft(0);
      freeAwaitingIdleFaceletsRef.current = true;
      setFreeNotice(null);
      void requestFacelets();
      freeFaceletsFallbackTimerRef.current = setTimeout(() => {
        confirmFreeScrambleIdle(faceletsRef.current);
      }, 700);
    }, FREE_SCRAMBLE_IDLE_MS);
  }, [confirmFreeScrambleIdle, requestFacelets]);

  const resetFreeReadiness = useCallback(
    (nextFacelets = faceletsRef.current) => {
      clearPostSolveMoveGate();
      clearFreeTimers();
      freeScrambleMoveCountRef.current = 0;
      setFreeScrambleMoveCount(0);
      setFreeIdleMsLeft(FREE_SCRAMBLE_IDLE_MS);

      if (isSolvedFacelets(nextFacelets)) {
        setFreePracticeState("ready");
        setFreeNotice(null);
      } else if (nextFacelets) {
        setFreeIdleMsLeft(0);
        setFreePracticeState("armed");
        setFreeNotice(null);
      } else {
        setFreePracticeState("waitingSolved");
        setFreeNotice(t("请连接魔方并复原。"));
      }
    },
    [clearFreeTimers, clearPostSolveMoveGate, setFreePracticeState, t],
  );

  const beginSolveTimer = useCallback(
    (initialMove: string | null = null) => {
      solveSourceRef.current = timingModeRef.current;
      turnCounterRef.current.reset();
      suppressSolvedTrailingMoveUntilRef.current = 0;
      const start = performance.now();
      solveStartRef.current = start;
      solveStartedAtEpochRef.current = Date.now();
      solveMsRef.current = 0;
      solveMoveCountRef.current = initialMove ? turnCounterRef.current.push(initialMove) : 0;
      solveTimelineMovesRef.current = solveSourceRef.current === "smart-cube" && initialMove
        ? [{ notation: initialMove, elapsedMs: 0 }]
        : [];
      solveFormulasRef.current = {};
      setSolveFormulas({});
      cfopTimesRef.current = EMPTY_CFOP;
      cfopMovesRef.current = EMPTY_CFOP;
      f2lSubTimesRef.current = EMPTY_F2L_SUBPHASES;
      f2lSubMovesRef.current = EMPTY_F2L_SUBPHASES;
      highestF2lSolvedSlotCountRef.current = 0;
      setCfopTimes(EMPTY_CFOP);
      setF2lSubTimes(EMPTY_F2L_SUBPHASES);
      setF2lSubMoves(EMPTY_F2L_SUBPHASES);
      setSolveMoveCount(solveMoveCountRef.current);
      updateSolveMs(0);
      clearSolveTick();
      tickRef.current = setInterval(() => {
        updateSolveMs(performance.now() - start);
      }, 17);
      phaseRef.current = "solving";
      setPhase("solving");
      if (timingModeRef.current === "smart-cube") {
        if (faceletsRef.current) detectFormulaRecognition(faceletsRef.current);
        requestFaceletsThrottled();
      }
    },
    [clearSolveTick, detectFormulaRecognition, requestFaceletsThrottled, updateSolveMs],
  );

  const recordSolveMove = useCallback((move: string) => {
    if (solveSourceRef.current === "smart-cube") {
      solveTimelineMovesRef.current.push({
        notation: move,
        elapsedMs: Math.max(0, Math.round(performance.now() - solveStartRef.current)),
      });
    }
    solveMoveCountRef.current = turnCounterRef.current.push(move);
    setSolveMoveCount(solveMoveCountRef.current);
  }, []);

  const commitSolveHistory = useCallback((next: SolveHistoryEntry[]) => {
    historyRef.current = next;
    touchLocalUserDataPackageUpdatedAt();
    saveSolveHistory(next);
    setHistory(next);
  }, []);

  const appendAndCommitSolveHistory = useCallback((entry: SolveHistoryEntry, completedDailyTestId: string | null = null) => {
    const current = mergeSolveHistories(historyRef.current, loadSolveHistory());
    const entryKey = solveHistoryEntryKey(entry);
    const appended = prependSolveHistoryEntry(
      current.filter((candidate) => solveHistoryEntryKey(candidate) !== entryKey),
      entry,
    );
    const next = completedDailyTestId
      ? appended.map((candidate) =>
          candidate.dailyTest?.id === completedDailyTestId
            ? { ...candidate, dailyTest: { ...candidate.dailyTest, completed: true } }
            : candidate,
        )
      : appended;
    commitSolveHistory(next);
  }, [commitSolveHistory]);

  const markCfopTimes = useCallback((nextFacelets: string, forceSolved = false) => {
    if (phaseRef.current !== "solving") return cfopTimesRef.current;
    const elapsed = Math.max(0, performance.now() - solveStartRef.current);
    const milestones = detectCfopMilestones(nextFacelets);
    const f2lSolvedSlotCount = detectF2lSolvedSlotCount(nextFacelets);
    const next = { ...cfopTimesRef.current };
    const nextMoves = { ...cfopMovesRef.current };
    const nextF2lSubTimes = { ...f2lSubTimesRef.current };
    const nextF2lSubMoves = { ...f2lSubMovesRef.current };

    function markPhase(key: CfopPhaseKey, solved: boolean) {
      if (!solved || next[key] != null) return;
      next[key] = elapsed;
      nextMoves[key] = solveMoveCountRef.current;
    }

    markPhase("cross", milestones.cross || forceSolved);
    markPhase("f2l", milestones.f2l || forceSolved);
    markPhase("oll", milestones.oll || forceSolved);
    markPhase("pll", milestones.pll || forceSolved);

    const cappedF2lSolvedSlotCount = Math.min(F2L_SUBPHASES.length, f2lSolvedSlotCount);
    if (cappedF2lSolvedSlotCount > highestF2lSolvedSlotCountRef.current) {
      for (let index = highestF2lSolvedSlotCountRef.current; index < cappedF2lSolvedSlotCount; index += 1) {
        const subphase = F2L_SUBPHASES[index];
        if (subphase && nextF2lSubTimes[subphase.key] == null) {
          nextF2lSubTimes[subphase.key] = elapsed;
          nextF2lSubMoves[subphase.key] = solveMoveCountRef.current;
        }
      }
      highestF2lSolvedSlotCountRef.current = cappedF2lSolvedSlotCount;
    }

    cfopTimesRef.current = next;
    cfopMovesRef.current = nextMoves;
    f2lSubTimesRef.current = nextF2lSubTimes;
    f2lSubMovesRef.current = nextF2lSubMoves;
    setCfopTimes(next);
    setF2lSubTimes(nextF2lSubTimes);
    setF2lSubMoves(nextF2lSubMoves);
    return next;
  }, []);

  const finishSolve = useCallback(
    (source: "auto" | "manual") => {
      if (phaseRef.current !== "solving") return;
      const elapsed = solveSourceRef.current === "smart-cube"
        ? Math.max(0, performance.now() - solveStartRef.current)
        : solveMsRef.current || Math.max(0, performance.now() - solveStartRef.current);
      const recordingSource = solveSourceRef.current;
      const activeDailyTest = dailyTestRef.current;
      const dailyIndex = activeDailyTest ? activeDailyTest.solves.length + 1 : null;
      const entryMode: PracticeMode = activeDailyTest ? "scramble" : practiceModeRef.current;
      const entryTs = Date.now();
      clearSolveTick();
      updateSolveMs(elapsed);
      phaseRef.current = "done";
      setPhase("done");
      if (recordingSource === "smart-cube") void requestBattery({ minIntervalMs: 60_000 });
      const finalCfop = source === "auto" && recordingSource === "smart-cube"
        ? { ...cfopTimesRef.current, pll: cfopTimesRef.current.pll ?? elapsed }
        : cfopTimesRef.current;
      const finalCfopMoves = source === "auto" && recordingSource === "smart-cube"
        ? { ...cfopMovesRef.current, pll: cfopMovesRef.current.pll ?? solveMoveCountRef.current }
        : cfopMovesRef.current;
      cfopTimesRef.current = finalCfop;
      cfopMovesRef.current = finalCfopMoves;
      setCfopTimes(finalCfop);
      const timeline: SolveTimelineRecord | null = recordingSource === "smart-cube" ? {
        durationMs: Math.round(elapsed),
        moves: solveTimelineMovesRef.current,
        cfop: { ...finalCfop },
        cfopMoves: { ...finalCfopMoves },
        moveCount: solveMoveCountRef.current,
        f2l: { ...f2lSubTimesRef.current },
      } : null;
      setCompletedSolveTimeline(timeline);
      lastCompletedPracticeResult = {
        archiveStorageKey: getArchiveScopedStorageKey(PRACTICE_UI_PREFERENCES_KEY),
        ms: elapsed,
        source: recordingSource,
        moveCount: solveMoveCountRef.current,
        cfop: { ...finalCfop },
        cfopMoves: { ...finalCfopMoves },
        f2l: { ...f2lSubTimesRef.current },
        f2lMoves: { ...f2lSubMovesRef.current },
        formulas: { ...solveFormulasRef.current },
        timeline,
      };
      solveTimelineMovesRef.current = [];
      const historyEntry: SolveHistoryEntry = {
        ms: elapsed,
        ts: entryTs,
        mode: entryMode,
        source: recordingSource,
        ...(recordingSource === "smart-cube"
          ? {
              ollCase: solveFormulasRef.current.oll?.id,
              pllCase: solveFormulasRef.current.pll?.id,
              moves: solveMoveCountRef.current,
              moveMetric: "HTM",
              cfop: toHistoryCfopMetrics(finalCfop),
              cfopMoves: toHistoryCfopMetrics(finalCfopMoves),
              cfopF2l: toHistoryF2lSubphaseMetrics(f2lSubTimesRef.current),
              cfopF2lMoves: toHistoryF2lSubphaseMetrics(f2lSubMovesRef.current),
            }
          : {}),
        ...(activeDailyTest && dailyIndex
          ? {
              dailyTest: {
                id: activeDailyTest.id,
                localDate: activeDailyTest.localDate,
                index: dailyIndex,
                completed: false,
              },
            }
          : {}),
      };
      const nextDailySolves = activeDailyTest
        ? [
            ...activeDailyTest.solves,
            {
              ms: elapsed,
              ts: entryTs,
              source: recordingSource,
              ...(recordingSource === "smart-cube" ? { moves: solveMoveCountRef.current } : {}),
            },
          ]
        : [];
      const dailyTestComplete = Boolean(activeDailyTest && nextDailySolves.length >= DAILY_TEST_TARGET);

      appendAndCommitSolveHistory(historyEntry, dailyTestComplete && activeDailyTest ? activeDailyTest.id : null);
      if (recordingSource === "timer" && solveStartedAtEpochRef.current > 0) {
        addDailyPracticeDuration(solveStartedAtEpochRef.current, entryTs);
      }

      if (entryMode === "free") {
        clearFreeTimers();
        freeScrambleMoveCountRef.current = 0;
        setFreeScrambleMoveCount(0);
        setFreeIdleMsLeft(FREE_SCRAMBLE_IDLE_MS);
        setFreePracticeState("ready");
        setFreeNotice(null);
      }

      if (source === "auto" && recordingSource === "smart-cube") {
        forceNextVisualFaceletsSyncRef.current = true;
        hasRealtimeMovesRef.current = false;
        void requestFacelets();
      }

      if (!activeDailyTest) {
        if (recordingSource === "smart-cube" && entryMode === "scramble" && practiceModeRef.current === "scramble") {
          setScrambleNotice(t("复原完成，自动进入下一次打乱。"));
          clearAutoNextScrambleTimer();
          clearPendingAutoNextScrambleMoves();
          autoNextScrambleTimerRef.current = setTimeout(() => {
            autoNextScrambleTimerRef.current = null;
            if (dailyTestRef.current || practiceModeRef.current !== "scramble" || phaseRef.current !== "done") return;
            beginAutoNextScrambleRef.current();
          }, AUTO_NEXT_SCRAMBLE_DELAY_MS);
        }
        if (recordingSource === "timer" && entryMode === "scramble") {
          const nextScramble = generateScramble(SCRAMBLE_LENGTH);
          scrambleRef.current = nextScramble;
          setScramble(nextScramble);
        }
        return;
      }

      if (dailyTestComplete) {
        const completedAt = entryTs;
        const averageMs = calculateDailyLevelAverage(nextDailySolves) ?? elapsed;
        const completedLevel: DailyLevelEntry = {
          id: activeDailyTest.id,
          localDate: activeDailyTest.localDate,
          completedAt,
          averageMs,
          solves: nextDailySolves,
        };
        setDailyLevels((prev) => {
          const next = [completedLevel, ...prev.filter((entry) => entry.localDate !== completedLevel.localDate)];
          touchLocalUserDataPackageUpdatedAt();
          saveDailyLevels(next);
          return next;
        });
        dailyTestRef.current = null;
        setDailyTest(null);
        setDailyTestResult(completedLevel);
        const completedLabel = activeDailyTest.localDate === getDailyTestDateKey() ? t("今日测试") : t("补测成绩");
        setScrambleNotice(t(`${completedLabel}完成，平均 ${fmtShort(averageMs)}。`));
      } else {
        const nextRun = { ...activeDailyTest, solves: nextDailySolves };
        dailyTestRef.current = nextRun;
        setDailyTest(nextRun);
        setScrambleNotice(t(`第 ${nextDailySolves.length} 次完成，自动进入第 ${nextDailySolves.length + 1} 次打乱。`));
        if (recordingSource === "smart-cube") {
          clearAutoNextScrambleTimer();
          clearPendingAutoNextScrambleMoves();
          autoNextScrambleTimerRef.current = setTimeout(() => {
            autoNextScrambleTimerRef.current = null;
            const currentDailyTest = dailyTestRef.current;
            if (
              !currentDailyTest ||
              currentDailyTest.id !== activeDailyTest.id ||
              currentDailyTest.solves.length !== nextDailySolves.length ||
              phaseRef.current !== "done"
            ) {
              return;
            }
            beginAutoNextScrambleRef.current();
          }, AUTO_NEXT_SCRAMBLE_DELAY_MS);
        } else {
          const nextScramble = generateScramble(SCRAMBLE_LENGTH);
          scrambleRef.current = nextScramble;
          setScramble(nextScramble);
        }
      }
    },
    [appendAndCommitSolveHistory, clearAutoNextScrambleTimer, clearFreeTimers, clearPendingAutoNextScrambleMoves, clearSolveTick, requestBattery, requestFacelets, setFreePracticeState, updateSolveMs, t],
  );

  const startSolving = useCallback(
    (initialMove: string | null = null, preserveActiveInspectionAudio = false) => {
      if (phaseRef.current !== "inspect") return;
      cancelInspectionAudio(preserveActiveInspectionAudio);
      beginSolveTimer(initialMove);
    },
    [beginSolveTimer, cancelInspectionAudio],
  );

  const animateCubeMoves = useCallback((moves: string[]) => {
    moves.forEach((move) => {
      expandMoveNotation(move).forEach((turn) => {
        cubeApiRef.current?.applyMove(turn.layer, turn.dir, CUBE_MOVE_ANIMATION_MS);
      });
    });
  }, []);

  const visualMoveQueue = useMemo(() => new PendingMoveQueue(), []);
  const { flush: flushVisualPendingMove, discard: discardVisualPendingMoves } = visualMoveQueue;
  const queueVisualMove = useCallback((move: string) => {
    visualMoveQueue.push(move, (pending) => animateCubeMoves([pending]));
  }, [animateCubeMoves, visualMoveQueue]);

  const animateUnplayedPendingMoves = useCallback(
    (moves: string[], animatedCountRef: { current: number }, fallbackMove?: string) => {
      const unplayed = moves.slice(animatedCountRef.current);
      if (unplayed.length > 0) {
        animateCubeMoves(unplayed);
      } else if (fallbackMove) {
        animateCubeMoves([fallbackMove]);
      }
      animatedCountRef.current = 0;
    },
    [animateCubeMoves],
  );

  const clearSmartSolveFaceletsWait = useCallback((value: string | null = null) => {
    if (smartSolveFaceletsTimerRef.current) {
      clearTimeout(smartSolveFaceletsTimerRef.current);
      smartSolveFaceletsTimerRef.current = null;
    }
    const resolver = smartSolveFaceletsResolverRef.current;
    smartSolveFaceletsResolverRef.current = null;
    resolver?.(value);
  }, []);

  const waitForSmartSolveFacelets = useCallback(() => {
    clearSmartSolveFaceletsWait();
    return new Promise<string | null>((resolve) => {
      smartSolveFaceletsResolverRef.current = resolve;
      smartSolveFaceletsTimerRef.current = setTimeout(() => {
        clearSmartSolveFaceletsWait(null);
      }, SMART_SOLVE_FACELETS_TIMEOUT_MS);
    });
  }, [clearSmartSolveFaceletsWait]);

  const resetSmartSolveState = useCallback(() => {
    clearSmartSolveFaceletsWait();
    smartSolveRunRef.current += 1;
    smartSolveStatusRef.current = "idle";
    smartSolveStepsRef.current = [];
    smartSolveIndexRef.current = 0;
    smartSolvePendingMovesRef.current = [];
    smartSolvePendingAnimatedCountRef.current = 0;
    smartSolvePendingUndoMovesRef.current = [];
    smartSolvePendingUndoAnimatedCountRef.current = 0;
    smartSolveUndoStackRef.current = [];
    setSmartSolveStatus("idle");
    setSmartSolveSteps([]);
    setSmartSolveIndex(0);
    setSmartSolveStepStatus([]);
    setSmartSolveNotice("");
    setSmartSolveWrong(false);
    setSmartSolveUndoDisplay([]);
  }, [clearSmartSolveFaceletsWait]);

  const resetAttempt = useCallback((
    nextScramble = scramble,
    options: { preservePostSolveMoveGate?: boolean; preserveAutoNextScrambleMoves?: boolean } = {},
  ) => {
    resetSmartSolveState();
    clearManualTimerArm();
    cancelInspectionAudio();
    clearSolveTick();
    clearFreeTimers();
    clearAutoNextScrambleTimer();
    flushVisualPendingMove();
    if (!options.preservePostSolveMoveGate) clearPostSolveMoveGate();
    if (!options.preserveAutoNextScrambleMoves) clearPendingAutoNextScrambleMoves();
    phaseRef.current = "idle";
    scrambleIndexRef.current = 0;
    scrambleRef.current = nextScramble;
    pendingScrambleMovesRef.current = [];
    pendingScrambleAnimatedCountRef.current = 0;
    pendingUndoMovesRef.current = [];
    pendingUndoAnimatedCountRef.current = 0;
    forceNextVisualFaceletsSyncRef.current = false;
    suppressSolvedTrailingMoveUntilRef.current = 0;
    undoStackRef.current = [];
    setUndoDisplay([]);
    solveStartRef.current = 0;
    solveTimelineMovesRef.current = [];
    solveStartedAtEpochRef.current = 0;
    setManualFallbackNotice(false);
    setPhase("idle");
    setScramble(nextScramble);
    setScrambleIndex(0);
    setScrambleStatus(freshScrambleStatus());
    setScrambleWrong(false);
    setScrambleNotice(t("点击开始打乱后，按公式转动真实魔方。"));
    setInspectMs(inspectionDurationMs ?? 0);
    if (practiceModeRef.current === "free") {
      resetFreeReadiness();
    }
  }, [
    cancelInspectionAudio,
    clearManualTimerArm,
    clearAutoNextScrambleTimer,
    clearFreeTimers,
    clearPendingAutoNextScrambleMoves,
    clearPostSolveMoveGate,
    clearSolveTick,
    flushVisualPendingMove,
    inspectionDurationMs,
    resetFreeReadiness,
    resetSmartSolveState,
    scramble,
    t,
  ]);

  const cancelCurrentAttempt = useCallback(() => {
    if (!dailyTestRef.current) {
      resetAttempt();
      return;
    }
    const completedCount = dailyTestRef.current.solves.length;
    dailyTestRef.current = null;
    setDailyTest(null);
    resetAttempt();
    setScrambleNotice(
      completedCount > 0
        ? t(`已取消每日五次测试，已完成的 ${completedCount} 次已保留在历史中。`)
        : t("已取消每日五次测试。"),
    );
  }, [resetAttempt, t]);

  const autoCancelIfUndoHintQueueTooLong = useCallback((undoQueue: string[]) => {
    if (undoQueue.length <= MAX_UNDO_HINT_QUEUE_LENGTH) return false;
    cancelCurrentAttempt();
    setScrambleNotice(t("撤销提示过长，已自动取消当前练习，请重新尝试。"));
    return true;
  }, [cancelCurrentAttempt, t]);

  const failSmartSolve = useCallback((message: string) => {
    clearSmartSolveFaceletsWait();
    smartSolveStatusRef.current = "idle";
    smartSolveStepsRef.current = [];
    smartSolveIndexRef.current = 0;
    smartSolvePendingMovesRef.current = [];
    smartSolvePendingAnimatedCountRef.current = 0;
    smartSolvePendingUndoMovesRef.current = [];
    smartSolvePendingUndoAnimatedCountRef.current = 0;
    smartSolveUndoStackRef.current = [];
    setSmartSolveStatus("idle");
    setSmartSolveSteps([]);
    setSmartSolveIndex(0);
    setSmartSolveStepStatus([]);
    setSmartSolveWrong(false);
    setSmartSolveUndoDisplay([]);
    cubeApiRef.current?.setHintMove(null);
    notify("error", message, "smart-solve");
    smartSolveRunRef.current += 1;
  }, [clearSmartSolveFaceletsWait, notify]);

  const handleSmartSolveMove = useCallback(
    (move: string) => {
      const actual = normalizeMove(move);
      const steps = smartSolveStepsRef.current;
      const undoStack = smartSolveUndoStackRef.current;

      if (smartSolveStatusRef.current !== "active" || steps.length === 0) return;

      if (undoStack.length > 0) {
        const expectedUndo = undoStack[undoStack.length - 1];
        smartSolvePendingUndoMovesRef.current = [...smartSolvePendingUndoMovesRef.current, actual];
        if (movesMatchExpected(smartSolvePendingUndoMovesRef.current, expectedUndo)) {
          animateUnplayedPendingMoves(
            smartSolvePendingUndoMovesRef.current,
            smartSolvePendingUndoAnimatedCountRef,
            expectedUndo,
          );
          smartSolvePendingUndoMovesRef.current = [];
          smartSolveUndoStackRef.current = undoStack.slice(0, -1);
          setSmartSolveUndoDisplay(smartSolveUndoStackRef.current);
          setSmartSolveNotice(
            smartSolveUndoStackRef.current.length === 0
              ? t(`已撤销，继续第 ${smartSolveIndexRef.current + 1} 步。`)
              : t(`继续撤销 ${smartSolveUndoStackRef.current[smartSolveUndoStackRef.current.length - 1]}。`),
          );
          if (smartSolveUndoStackRef.current.length === 0) setSmartSolveWrong(false);
        } else if (moveCanStillMatchExpected(smartSolvePendingUndoMovesRef.current, expectedUndo)) {
          animateCubeMoves([actual]);
          smartSolvePendingUndoAnimatedCountRef.current = smartSolvePendingUndoMovesRef.current.length;
          const remainingUndoStack = getRemainingUndoStack(undoStack, smartSolvePendingUndoMovesRef.current);
          if (autoCancelIfUndoHintQueueTooLong(remainingUndoStack)) return;
          setSmartSolveUndoDisplay(remainingUndoStack);
          setSmartSolveNotice(t(`继续撤销 ${remainingUndoStack[remainingUndoStack.length - 1] ?? expectedUndo}。`));
        } else {
          const pendingUndo = smartSolvePendingUndoMovesRef.current;
          animateUnplayedPendingMoves(pendingUndo, smartSolvePendingUndoAnimatedCountRef);
          smartSolvePendingUndoMovesRef.current = [];
          const nextUndoStack = appendUndoStackMoves(undoStack, pendingUndo);
          if (autoCancelIfUndoHintQueueTooLong(nextUndoStack)) return;
          smartSolveUndoStackRef.current = nextUndoStack;
          setSmartSolveUndoDisplay(smartSolveUndoStackRef.current);
          setSmartSolveNotice(
            smartSolveUndoStackRef.current.length === 0
              ? t(`已抵消，继续第 ${smartSolveIndexRef.current + 1} 步。`)
              : t(`仍需撤销：请转 ${smartSolveUndoStackRef.current[smartSolveUndoStackRef.current.length - 1]}。`),
          );
          if (smartSolveUndoStackRef.current.length === 0) setSmartSolveWrong(false);
        }
        return;
      }

      const currentIndex = smartSolveIndexRef.current;
      const expected = steps[currentIndex];
      if (!expected) return;

      smartSolvePendingMovesRef.current = [...smartSolvePendingMovesRef.current, actual];
      if (movesMatchExpected(smartSolvePendingMovesRef.current, expected)) {
        const nextIndex = currentIndex + 1;
        animateUnplayedPendingMoves(smartSolvePendingMovesRef.current, smartSolvePendingAnimatedCountRef, expected);
        smartSolvePendingMovesRef.current = [];
        setSmartSolveStepStatus((prev) => prev.map((status, index) => (index === currentIndex ? "correct" : status)));
        setSmartSolveWrong(false);
        smartSolveIndexRef.current = nextIndex;
        setSmartSolveIndex(nextIndex);

        if (nextIndex >= steps.length) {
          smartSolveStatusRef.current = "done";
          setSmartSolveStatus("done");
          setSmartSolveNotice(t("智能求解完成，正在确认真实魔方复原状态。"));
          void requestFacelets();
        } else {
          setSmartSolveNotice(t(`正确，下一步 ${nextIndex + 1}: ${steps[nextIndex]}`));
        }
      } else if (moveCanStillMatchExpected(smartSolvePendingMovesRef.current, expected)) {
        animateCubeMoves([actual]);
        smartSolvePendingAnimatedCountRef.current = smartSolvePendingMovesRef.current.length;
        setSmartSolveWrong(false);
        setSmartSolveStepStatus((prev) => prev.map((status, index) => (
          index === currentIndex
            ? movePartiallyMatchesExpectedDoubleTurn(smartSolvePendingMovesRef.current, expected)
              ? "partial"
              : "pending"
            : status
        )));
        setSmartSolveNotice(t(`继续完成第 ${currentIndex + 1} 步：${expected}`));
      } else {
        const pendingWrong = smartSolvePendingMovesRef.current;
        const { retainedMoves, wrongMoves } = splitInvalidPendingMoves(pendingWrong, expected);
        if (wrongMoves.length > 0) animateCubeMoves(wrongMoves);
        smartSolvePendingMovesRef.current = retainedMoves;
        smartSolvePendingAnimatedCountRef.current = retainedMoves.length;
        smartSolvePendingUndoMovesRef.current = [];
        smartSolvePendingUndoAnimatedCountRef.current = 0;
        setSmartSolveWrong(true);
        setSmartSolveStepStatus((prev) => prev.map((status, index) => (
          index === currentIndex
            ? movePartiallyMatchesExpectedDoubleTurn(retainedMoves, expected)
              ? "partial"
              : "pending"
            : status
        )));
        const nextUndoStack = buildUndoStack(wrongMoves);
        if (autoCancelIfUndoHintQueueTooLong(nextUndoStack)) return;
        smartSolveUndoStackRef.current = nextUndoStack;
        setSmartSolveUndoDisplay(smartSolveUndoStackRef.current);
        setSmartSolveNotice(
          smartSolveUndoStackRef.current.length === 0
            ? t(`已抵消，继续第 ${currentIndex + 1} 步。`)
            : t(`转错了：请撤销 ${smartSolveUndoStackRef.current[smartSolveUndoStackRef.current.length - 1]}，再继续第 ${currentIndex + 1} 步。`),
        );
        if (smartSolveUndoStackRef.current.length === 0) setSmartSolveWrong(false);
      }
    },
    [animateCubeMoves, animateUnplayedPendingMoves, autoCancelIfUndoHintQueueTooLong, requestFacelets, t],
  );

  const syncVisualFacelets = useCallback(
    (nextFacelets: string) => {
      discardVisualPendingMoves();
      if (cubeApiRef.current?.setFacelets(nextFacelets)) {
        lastAppliedFaceletsRef.current = nextFacelets;
      }
    },
    [discardVisualPendingMoves],
  );

  const handleScrambleMove = useCallback(
    (move: string, options: { animate?: boolean } = {}) => {
      const actual = normalizeMove(move);
      const undoStack = undoStackRef.current;
      const shouldAnimate = options.animate ?? true;

      if (undoStack.length > 0) {
        const expectedUndo = undoStack[undoStack.length - 1];
        pendingUndoMovesRef.current = [...pendingUndoMovesRef.current, actual];
        if (movesMatchExpected(pendingUndoMovesRef.current, expectedUndo)) {
          if (shouldAnimate) {
            animateUnplayedPendingMoves(pendingUndoMovesRef.current, pendingUndoAnimatedCountRef, expectedUndo);
          } else {
            pendingUndoAnimatedCountRef.current = 0;
          }
          pendingUndoMovesRef.current = [];
          undoStackRef.current = undoStack.slice(0, -1);
          setUndoDisplay(undoStackRef.current);
          setScrambleNotice(
            undoStackRef.current.length === 0
              ? t(`已撤销，继续第 ${scrambleIndexRef.current + 1} 步。`)
              : t(`继续撤销 ${undoStackRef.current[undoStackRef.current.length - 1]}。`),
          );
          if (undoStackRef.current.length === 0) setScrambleWrong(false);
        } else if (moveCanStillMatchExpected(pendingUndoMovesRef.current, expectedUndo)) {
          if (shouldAnimate) animateCubeMoves([actual]);
          pendingUndoAnimatedCountRef.current = pendingUndoMovesRef.current.length;
          const remainingUndoStack = getRemainingUndoStack(undoStack, pendingUndoMovesRef.current);
          if (autoCancelIfUndoHintQueueTooLong(remainingUndoStack)) return;
          setUndoDisplay(remainingUndoStack);
          setScrambleNotice(t(`继续撤销 ${remainingUndoStack[remainingUndoStack.length - 1] ?? expectedUndo}。`));
        } else {
          const pendingUndo = pendingUndoMovesRef.current;
          if (shouldAnimate) {
            animateUnplayedPendingMoves(pendingUndo, pendingUndoAnimatedCountRef);
          } else {
            pendingUndoAnimatedCountRef.current = 0;
          }
          pendingUndoMovesRef.current = [];
          const nextUndoStack = appendUndoStackMoves(undoStack, pendingUndo);
          if (autoCancelIfUndoHintQueueTooLong(nextUndoStack)) return;
          undoStackRef.current = nextUndoStack;
          setUndoDisplay(undoStackRef.current);
          setScrambleNotice(
            undoStackRef.current.length === 0
              ? t(`已抵消，继续第 ${scrambleIndexRef.current + 1} 步。`)
              : t(`仍需撤销：请转 ${undoStackRef.current[undoStackRef.current.length - 1]}。`),
          );
          if (undoStackRef.current.length === 0) setScrambleWrong(false);
        }
        return;
      }

      const currentIndex = scrambleIndexRef.current;
      const activeScramble = scrambleRef.current;
      const expected = activeScramble[currentIndex];
      pendingScrambleMovesRef.current = [...pendingScrambleMovesRef.current, actual];
      if (movesMatchExpected(pendingScrambleMovesRef.current, expected)) {
        const nextIndex = currentIndex + 1;
        if (shouldAnimate) {
          animateUnplayedPendingMoves(pendingScrambleMovesRef.current, pendingScrambleAnimatedCountRef, expected);
        } else {
          pendingScrambleAnimatedCountRef.current = 0;
        }
        pendingScrambleMovesRef.current = [];
        setScrambleStatus((prev) => prev.map((status, index) => (index === currentIndex ? "correct" : status)));
        setScrambleWrong(false);
        scrambleIndexRef.current = nextIndex;
        setScrambleIndex(nextIndex);

        if (nextIndex >= activeScramble.length) {
          setScrambleNotice(
            inspectionDurationMs === null
              ? t("打乱完成，进入无限观察；转第一下开始复原计时。")
              : t(`打乱完成，进入 ${inspectionNoticeLabel}。`),
          );
          setInspectMs(inspectionDurationMs ?? 0);
          phaseRef.current = "inspect";
          setPhase("inspect");
          void requestFacelets();
        } else {
          setScrambleNotice(t(`正确，下一步 ${nextIndex + 1}: ${activeScramble[nextIndex]}`));
        }
      } else if (moveCanStillMatchExpected(pendingScrambleMovesRef.current, expected)) {
        if (shouldAnimate) animateCubeMoves([actual]);
        pendingScrambleAnimatedCountRef.current = pendingScrambleMovesRef.current.length;
        setScrambleWrong(false);
        setScrambleStatus((prev) => prev.map((status, index) => (
          index === currentIndex
            ? movePartiallyMatchesExpectedDoubleTurn(pendingScrambleMovesRef.current, expected)
              ? "partial"
              : "pending"
            : status
        )));
        setScrambleNotice(t(`继续完成第 ${currentIndex + 1} 步：${expected}`));
      } else {
        const pendingWrong = pendingScrambleMovesRef.current;
        const { retainedMoves, wrongMoves } = splitInvalidPendingMoves(pendingWrong, expected);
        if (shouldAnimate && wrongMoves.length > 0) animateCubeMoves(wrongMoves);
        pendingScrambleMovesRef.current = retainedMoves;
        pendingScrambleAnimatedCountRef.current = retainedMoves.length;
        pendingUndoMovesRef.current = [];
        pendingUndoAnimatedCountRef.current = 0;
        setScrambleWrong(true);
        setScrambleStatus((prev) => prev.map((status, index) => (
          index === currentIndex
            ? movePartiallyMatchesExpectedDoubleTurn(retainedMoves, expected)
              ? "partial"
              : "pending"
            : status
        )));
        const nextUndoStack = buildUndoStack(wrongMoves);
        if (autoCancelIfUndoHintQueueTooLong(nextUndoStack)) return;
        undoStackRef.current = nextUndoStack;
        setUndoDisplay(undoStackRef.current);
        setScrambleNotice(
          undoStackRef.current.length === 0
            ? t(`已抵消，继续第 ${currentIndex + 1} 步。`)
            : t(`转错了：请撤销 ${undoStackRef.current[undoStackRef.current.length - 1]}，再继续第 ${currentIndex + 1} 步。`),
        );
        if (undoStackRef.current.length === 0) setScrambleWrong(false);
      }
    },
    [animateCubeMoves, animateUnplayedPendingMoves, autoCancelIfUndoHintQueueTooLong, inspectionDurationMs, inspectionNoticeLabel, requestFacelets, t],
  );

  const handleFreePracticeMove = useCallback(
    (notation: string) => {
      const parsed = parseMoveNotation(notation);
      if (!parsed) return;

      if (freeStateRef.current === "waitingSolved") {
        queueVisualMove(parsed.notation);
        requestFaceletsThrottled();
        setFreeNotice(t("请先复原魔方，等待状态同步。"));
        return;
      }

      if (freeStateRef.current === "ready") {
        updateSolveMs(0);
        phaseRef.current = "idle";
        setPhase("idle");
        freeScrambleMoveCountRef.current = 1;
        setFreeScrambleMoveCount(1);
        setFreePracticeState("scrambling");
        setFreeNotice(null);
        queueVisualMove(parsed.notation);
        requestFaceletsThrottled();
        scheduleFreeIdleCheck();
        return;
      }

      if (freeStateRef.current === "scrambling") {
        freeScrambleMoveCountRef.current += 1;
        setFreeScrambleMoveCount(freeScrambleMoveCountRef.current);
        setFreePracticeState("scrambling");
        setFreeNotice(null);
        queueVisualMove(parsed.notation);
        requestFaceletsThrottled();
        scheduleFreeIdleCheck();
        return;
      }

      flushVisualPendingMove();
      queueVisualMove(parsed.notation);
      clearFreeTimers();
      setFreeNotice(null);
      beginSolveTimer(parsed.notation);
    },
    [
      beginSolveTimer,
      clearFreeTimers,
      flushVisualPendingMove,
      queueVisualMove,
      requestFaceletsThrottled,
      scheduleFreeIdleCheck,
      setFreePracticeState,
      updateSolveMs,, t
    ],
  );

  const ingestMove = useCallback(
    (notation: string, signal?: CubeMoveSignal) => {
      if (timingModeRef.current !== "smart-cube") return;
      const parsed = parseMoveNotation(notation);
      if (!parsed || !cubeApiRef.current) return;

      if (shouldIgnoreInitialPostSolveMove(signal)) return false;

      if (
        phaseRef.current === "done" &&
        autoNextScrambleTimerRef.current === null &&
        performance.now() < suppressSolvedTrailingMoveUntilRef.current &&
        isSolvedFacelets(faceletsRef.current)
      ) {
        requestFaceletsThrottled();
        return false;
      }

      hasRealtimeMovesRef.current = true;

      if (smartSolveStatusRef.current === "active") {
        flushVisualPendingMove();
        handleSmartSolveMove(parsed.notation);
        return;
      }

      if (smartSolveStatusRef.current === "loading") {
        queueVisualMove(parsed.notation);
        requestFaceletsThrottled();
        return;
      }

      if (
        phaseRef.current === "done" &&
        practiceModeRef.current === "scramble" &&
        autoNextScrambleTimerRef.current !== null
      ) {
        pendingAutoNextScrambleMovesRef.current = [...pendingAutoNextScrambleMovesRef.current, parsed.notation];
        queueVisualMove(parsed.notation);
        requestFaceletsThrottled();
        return;
      }

      if (practiceModeRef.current === "free" && phaseRef.current !== "solving") {
        handleFreePracticeMove(notation);
        return;
      }

      if (phaseRef.current === "scrambling") {
        flushVisualPendingMove();
        handleScrambleMove(notation);
      } else if (phaseRef.current === "inspect") {
        flushVisualPendingMove();
        queueVisualMove(parsed.notation);
        startSolving(parsed.notation);
      } else if (phaseRef.current === "solving") {
        queueVisualMove(parsed.notation);
        recordSolveMove(parsed.notation);
        requestFaceletsThrottled();
      } else {
        queueVisualMove(parsed.notation);
      }
    },
    [
      flushVisualPendingMove,
      handleFreePracticeMove,
      handleScrambleMove,
      handleSmartSolveMove,
      queueVisualMove,
      requestFaceletsThrottled,
      recordSolveMove,
      shouldIgnoreInitialPostSolveMove,
      startSolving,
    ],
  );

  const handleFacelets = useCallback(
    (nextFacelets: string, signal?: CubeFaceletsSignal) => {
      faceletsRef.current = nextFacelets;
      if (timingModeRef.current !== "smart-cube") return;
      detectFormulaRecognition(nextFacelets);
      if (signal?.source !== "local") {
        clearSmartSolveFaceletsWait(nextFacelets);
      }

      if (forceNextVisualFaceletsSyncRef.current) {
        forceNextVisualFaceletsSyncRef.current = false;
        syncVisualFacelets(nextFacelets);
      }

      if (smartSolveStatusRef.current !== "idle") {
        if (smartSolveStatusRef.current === "done") {
          setSmartSolveNotice(
            isSolvedFacelets(nextFacelets)
              ? t("智能求解完成，真实魔方已复原。")
              : t("公式已走完，但真实魔方仍未确认复原；请重新同步后再次求解。"),
          );
        }
        return;
      }

      if (practiceModeRef.current === "free" && phaseRef.current !== "solving") {
        if (confirmFreeScrambleIdle(nextFacelets)) return;
        const solved = isSolvedFacelets(nextFacelets);
        if (freeStateRef.current === "waitingSolved") {
          freeScrambleMoveCountRef.current = 0;
          setFreeScrambleMoveCount(0);
          if (solved) {
            setFreeIdleMsLeft(FREE_SCRAMBLE_IDLE_MS);
            setFreePracticeState("ready");
            setFreeNotice(null);
          } else {
            setFreeIdleMsLeft(0);
            setFreePracticeState("armed");
            setFreeNotice(null);
          }
        } else if (freeStateRef.current === "ready" && !solved) {
          if (freeScrambleMoveCountRef.current > 0) {
            setFreePracticeState("armed");
            setFreeIdleMsLeft(0);
            setFreeNotice(null);
          } else {
            setFreePracticeState("armed");
            setFreeIdleMsLeft(0);
            setFreeNotice(null);
          }
        } else if (freeStateRef.current === "armed" && solved) {
          freeScrambleMoveCountRef.current = 0;
          setFreeScrambleMoveCount(0);
          setFreeIdleMsLeft(FREE_SCRAMBLE_IDLE_MS);
          setFreePracticeState("ready");
          setFreeNotice(null);
        }
        return;
      }

      if (phaseRef.current !== "solving") return;
      const solved = isSolvedFacelets(nextFacelets);
      markCfopTimes(nextFacelets, solved);
      if (solved) {
        syncVisualFacelets(nextFacelets);
        suppressSolvedTrailingMoveUntilRef.current = performance.now() + SOLVED_TRAILING_MOVE_SUPPRESS_MS;
        if (signal && Number.isFinite(signal.serial)) armPostSolveMoveGate(signal.serial);
        finishSolve("auto");
      }
    },
    [
      armPostSolveMoveGate,
      clearSmartSolveFaceletsWait,
      confirmFreeScrambleIdle,
      detectFormulaRecognition,
      finishSolve,
      markCfopTimes,
      setFreePracticeState,
      syncVisualFacelets,, t
    ],
  );

  const applyGyroOrientation = useCallback((quaternion: CubeQuaternion) => {
    if (gyroDisabledRef.current) return;
    cubeApiRef.current?.setGyroOrientation(quaternion);
  }, []);

  const getInitialVisualCubeState = useCallback(() => {
    const initialState = getInitialCubeVisualState(visualStateRef.current, faceletsRef.current);
    if (initialState.facelets) lastAppliedFaceletsRef.current = initialState.facelets;
    return initialState;
  }, []);

  useEffect(() => {
    if (timingMode !== "smart-cube") return;
    if (!cubeMountRef.current) return;
    const initialDisplayState = loadPracticeDisplayState();
    setViewResetEnabled(initialDisplayState ? !isDefaultDisplayState(initialDisplayState) : false);
    const initialVisualState = getInitialVisualCubeState();
    const initialGyroQuaternion = loadPracticeGyroDisabled() ? null : getLatestGyro();
    const api = mountSmartCube(cubeMountRef.current, {
      faceColors,
      orientation,
      maxFps: renderMaxFps,
      compactGestureRegion: true,
      showBackFaceProjection: backFaceProjectionEnabled,
      backFaceProjectionDistance,
      cameraDistanceRange: PRACTICE_CUBE_CAMERA_PRESET.distanceRange,
      compensateInitialGyroOffset: false,
      preserveDrawingBuffer: true,
      defaultDisplayState: PRACTICE_CUBE_CAMERA_PRESET.displayState,
      sceneOffset: PRACTICE_CUBE_CAMERA_PRESET.sceneOffset,
      initialFacelets: initialVisualState.facelets,
      initialMoves: initialVisualState.moves,
      initialGyroQuaternion,
      initialDisplayState,
      onDisplayOrientationChange: () => {
        const displayState = cubeApiRef.current?.getDisplayState();
        savePracticeDisplayState(displayState ?? null);
        setViewResetEnabled(displayState ? !isDefaultDisplayState(displayState) : false);
      },
    });
    cubeApiRef.current = api;
    if (smartSolveStatusRef.current === "active") {
      api.setHintMove(getSmartSolveHintMove());
    } else if (phaseRef.current === "scrambling") {
      api.setHintMove(getScrambleHintMove());
    }

    return () => {
      savePracticeDisplayState(api.getDisplayState());
      api.dispose();
      if (cubeApiRef.current === api) cubeApiRef.current = null;
    };
  }, [faceColors, orientation, renderMaxFps, backFaceProjectionEnabled, backFaceProjectionDistance, getInitialVisualCubeState, getLatestGyro, timingMode]);

  useEffect(() => {
    cubeApiRef.current?.setBackFaceProjectionDistance(backFaceProjectionDistance);
  }, [backFaceProjectionDistance]);

  useEffect(() => {
    if (!facelets || phaseRef.current === "solving") return;
    if (facelets === lastAppliedFaceletsRef.current) return;
    if (hasRealtimeMovesRef.current) return;
    if (cubeApiRef.current?.setFacelets(facelets)) {
      lastAppliedFaceletsRef.current = facelets;
    }
  }, [facelets]);

  useEffect(() => subscribeMove(ingestMove), [ingestMove, subscribeMove]);

  useEffect(() => {
    if (connectionState === "connected") {
      const justConnected = !wasConnectedRef.current;
      wasConnectedRef.current = true;
      if (justConnected && timingModeRef.current === "timer" && !manualTimerOverrideRef.current) {
        if (phaseRef.current === "solving" || manualTimerArmStateRef.current !== "idle") {
          pendingSmartModeRef.current = true;
        } else {
          timingModeRef.current = "smart-cube";
          setTimingMode("smart-cube");
          setManualFallbackNotice(false);
          resetAttempt();
        }
      }
      return;
    }
    if (connectionState === "connecting") return;
    const lostConnection = wasConnectedRef.current;
    wasConnectedRef.current = false;
    if (smartSolveStatusRef.current === "loading" || smartSolveStatusRef.current === "active") {
      failSmartSolve(t("智能魔方连接已断开，智能求解已停止。"));
    }
    if (lostConnection && timingModeRef.current === "smart-cube") {
      timingModeRef.current = "timer";
      solveSourceRef.current = "timer";
      setTimingMode("timer");
      manualTimerOverrideRef.current = false;
      if (phaseRef.current === "solving") {
        setManualFallbackNotice(true);
      } else {
        resetAttempt();
      }
    } else if (practiceModeRef.current === "free" && timingModeRef.current === "smart-cube") {
      resetFreeReadiness(null);
    }
  }, [connectionState, failSmartSolve, resetAttempt, resetFreeReadiness, t]);

  useEffect(() => {
    if (!pendingSmartModeRef.current || phase !== "done" || connectionState !== "connected") return;
    pendingSmartModeRef.current = false;
    timingModeRef.current = "smart-cube";
    setTimingMode("smart-cube");
    setManualFallbackNotice(false);
  }, [connectionState, phase]);

  useEffect(() => {
    if (gyroDisabled) return;
    return subscribeGyro(applyGyroOrientation);
  }, [applyGyroOrientation, subscribeGyro, gyroDisabled]);

  useEffect(() => subscribeFacelets(handleFacelets), [handleFacelets, subscribeFacelets]);

  useEffect(() => {
    if (phase !== "inspect") return;
    if (inspectionDurationMs === null) {
      cancelInspectionAudio();
      return () => cancelInspectionAudio();
    }
    const start = performance.now();
    scheduleInspectionAudio(start, inspectionDurationMs);
    const id = setInterval(() => {
      const left = inspectionDurationMs - (performance.now() - start);
      if (left <= 0) {
        clearInterval(id);
        setInspectMs(0);
        inspectionEndCueUntilRef.current = performance.now() + INSPECTION_END_CUE_PRESERVE_MS;
        playInspectionBeep("bright");
        startSolving(null, true);
      } else {
        setInspectMs(left);
      }
    }, 50);
    return () => {
      clearInterval(id);
      cancelInspectionAudio(performance.now() < inspectionEndCueUntilRef.current);
    };
  }, [cancelInspectionAudio, inspectionDurationMs, phase, playInspectionBeep, scheduleInspectionAudio, startSolving]);

  function getSmartSolveHintMove() {
    const undoNext = smartSolveUndoStackRef.current[smartSolveUndoStackRef.current.length - 1];
    if (undoNext) return hintMoveForDoubleTurnProgress(smartSolvePendingUndoMovesRef.current, undoNext);
    const expected = smartSolveStepsRef.current[smartSolveIndexRef.current];
    return expected ? hintMoveForDoubleTurnProgress(smartSolvePendingMovesRef.current, expected) : null;
  }

  function getScrambleHintMove() {
    const undoNext = undoStackRef.current[undoStackRef.current.length - 1];
    if (undoNext) return hintMoveForDoubleTurnProgress(pendingUndoMovesRef.current, undoNext);
    const expected = scrambleRef.current[scrambleIndexRef.current];
    return expected ? hintMoveForDoubleTurnProgress(pendingScrambleMovesRef.current, expected) : null;
  }

  useEffect(() => {
    const smartSolveNext = smartSolveStatus === "active"
      ? getSmartSolveHintMove()
      : null;
    const scrambleNext = phase === "scrambling"
      ? getScrambleHintMove()
      : null;
    const next = smartSolveNext ?? scrambleNext;
    cubeApiRef.current?.setHintMove(next);
  }, [phase, scrambleIndex, scrambleStatus, smartSolveIndex, smartSolveStatus, smartSolveStepStatus, smartSolveUndoDisplay, undoDisplay]);

  const beginManualTimerHold = useCallback(() => {
    if (timingModeRef.current !== "timer") return;
    if (phaseRef.current === "solving") {
      clearManualTimerArm();
      finishSolve("manual");
      return;
    }
    if (
      (phaseRef.current !== "idle" && phaseRef.current !== "done") ||
      manualTimerArmStateRef.current !== "idle"
    ) {
      return;
    }
    manualTimerArmStateRef.current = "holding";
    setManualTimerArmState("holding");
    manualTimerArmRef.current = setTimeout(() => {
      manualTimerArmRef.current = null;
      if (timingModeRef.current !== "timer" || manualTimerArmStateRef.current !== "holding") return;
      manualTimerArmStateRef.current = "ready";
      setManualTimerArmState("ready");
    }, MANUAL_TIMER_ARM_MS);
  }, [clearManualTimerArm, finishSolve]);

  const releaseManualTimerHold = useCallback(() => {
    if (timingModeRef.current !== "timer") return;
    if (manualTimerArmStateRef.current === "ready") {
      clearManualTimerArm();
      setManualFallbackNotice(false);
      beginSolveTimer();
      return;
    }
    if (manualTimerArmStateRef.current === "holding") clearManualTimerArm();
  }, [beginSolveTimer, clearManualTimerArm]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== " " && key !== "f" && key !== "q" && key !== "r" && key !== "l") return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector("dialog[open]") || dailyTestResult || historyDialogOpen || isTextEntryTarget(event.target)) return;

      event.preventDefault();
      if (event.repeat) return;
      if (key === " " && timingModeRef.current === "timer") {
        beginManualTimerHold();
        return;
      }
      if (timingModeRef.current !== "smart-cube") return;
      if (key === "r") {
        if (canResetDisplayOrientation) resetDisplayOrientation();
        return;
      }
      if (key === "l") {
        toggleGyroDisabled();
        return;
      }
      if (key === "f") {
        toggleFormulaRecognition();
        return;
      }
      if (key === "q") {
        if (smartSolveStatusRef.current !== "loading") void beginSmartSolve();
        return;
      }

      if (smartSolveStatusRef.current === "loading" || smartSolveStatusRef.current === "active") return;
      if (phase === "idle" || phase === "done") {
        if (practiceModeRef.current === "scramble") {
          beginScramble();
        } else {
          void requestFacelets();
        }
      } else if (phase === "scrambling" || phase === "inspect") {
        cancelCurrentAttempt();
      } else if (phase === "solving") {
        cancelCurrentAttempt();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]") || dailyTestResult || historyDialogOpen || event.key !== " " || timingModeRef.current !== "timer" || isTextEntryTarget(event.target)) return;
      event.preventDefault();
      releaseManualTimerHold();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  useEffect(() => {
    return () => {
      clearManualTimerArm();
      clearSolveTick();
      clearFreeTimers();
      discardVisualPendingMoves();
      clearAutoNextScrambleTimer();
      clearPendingAutoNextScrambleMoves();
      smartSolveRunRef.current += 1;
      clearSmartSolveFaceletsWait();
    };
  }, [
    cancelInspectionAudio,
    clearManualTimerArm,
    clearAutoNextScrambleTimer,
    clearPendingAutoNextScrambleMoves,
    clearFreeTimers,
    clearSolveTick,
    clearSmartSolveFaceletsWait,
    discardVisualPendingMoves,
  ]);

  async function startConnection() {
    await connectRealCube();
  }

  function deleteHistoryEntry(historyIndex: number, entry: SolveHistoryEntry) {
    const currentHistory = historyRef.current;
    if (currentHistory[historyIndex] !== entry) return;
    setHistoryCfopTip(null);
    commitSolveHistory(currentHistory.filter((_, index) => index !== historyIndex));
  }

  function resetDisplayOrientation() {
    cubeApiRef.current?.resetDisplayOrientation();
    savePracticeDisplayState(null);
    setViewResetEnabled(false);
  }

  function toggleGyroDisabled() {
    const next = !gyroDisabledRef.current;
    gyroDisabledRef.current = next;
    setGyroDisabled(next);
    notifyGyroEnabled(!next);
    if (next) {
      const displayState = cubeApiRef.current?.getDisplayState();
      cubeApiRef.current?.resetGyroOrientation();
      setViewResetEnabled(displayState ? !isDefaultDisplayState(displayState) : false);
    }
    savePracticeGyroDisabled(next);
  }

  function toggleFormulaRecognition() {
    const next = !formulaRecognitionEnabledRef.current;
    formulaRecognitionEnabledRef.current = next;
    setFormulaRecognitionEnabled(next);
    savePracticeFormulaRecognitionEnabled(next);
    if (!next) {
      setRecognizedFormula(null);
    }
  }

  function cancelSmartSolve() {
    resetSmartSolveState();
    cubeApiRef.current?.setHintMove(null);
    if (practiceModeRef.current === "free") {
      resetFreeReadiness();
    }
  }

  async function beginSmartSolve() {
    if (!isConnected) {
      notify("warning", t("请先连接智能魔方，再使用智能求解。"), "smart-solve");
      return;
    }

    dailyTestRef.current = null;
    setDailyTest(null);
    resetAttempt();
    dismiss("smart-solve");
    const run = ++smartSolveRunRef.current;
    smartSolveStatusRef.current = "loading";
    smartSolveStepsRef.current = [];
    smartSolveIndexRef.current = 0;
    setSmartSolveStatus("loading");
    setSmartSolveSteps([]);
    setSmartSolveIndex(0);
    setSmartSolveStepStatus([]);
    setSmartSolveWrong(false);
    setSmartSolveUndoDisplay([]);

    try {
      const faceletsPromise = waitForSmartSolveFacelets();
      await requestFacelets();
      const latestFacelets = (await faceletsPromise) ?? faceletsRef.current;

      if (smartSolveRunRef.current !== run || smartSolveStatusRef.current !== "loading") return;
      if (!latestFacelets) {
        failSmartSolve(t("未收到真实魔方状态，请确认连接稳定后再试。"));
        return;
      }

      const steps = (await solveFacelets(latestFacelets)).map((move) => mapMoveToOrientation(move, orientation));
      if (smartSolveRunRef.current !== run || smartSolveStatusRef.current !== "loading") return;
      smartSolveStatusRef.current = steps.length ? "active" : "done";
      smartSolveStepsRef.current = steps;
      smartSolveIndexRef.current = 0;
      smartSolvePendingMovesRef.current = [];
      smartSolvePendingAnimatedCountRef.current = 0;
      smartSolvePendingUndoMovesRef.current = [];
      smartSolvePendingUndoAnimatedCountRef.current = 0;
      smartSolveUndoStackRef.current = [];
      setSmartSolveStatus(steps.length ? "active" : "done");
      setSmartSolveSteps(steps);
      setSmartSolveIndex(0);
      setSmartSolveStepStatus(freshSmartSolveStatus(steps.length));
      setSmartSolveWrong(false);
      setSmartSolveUndoDisplay([]);
      setSmartSolveNotice(steps.length
        ? t(`已生成 ${steps.length} 步复原公式，请转第 1 步：${steps[0]}`)
        : t("智能求解完成，真实魔方已复原。"));
      if (cubeApiRef.current?.setFacelets(latestFacelets)) {
        lastAppliedFaceletsRef.current = latestFacelets;
        hasRealtimeMovesRef.current = false;
      }
    } catch {
      if (smartSolveRunRef.current === run) failSmartSolve(t("求解失败，请重新同步魔方状态后再试。"));
    }
  }

  function cancelFreePractice() {
    if (practiceModeRef.current !== "free") return;
    clearFreeTimers();
    practiceModeRef.current = "scramble";
    setPracticeMode("scramble");
    resetAttempt();
  }

  function startScrambleAttempt(preservePostSolveMoveGate: boolean) {
    if (!isConnectedRef.current) {
      setScrambleNotice(t("请先连接智能魔方。"));
      return;
    }
    warmInspectionAudio();
    const nextScramble = generateScramble(SCRAMBLE_LENGTH);
    resetAttempt(nextScramble, {
      preservePostSolveMoveGate,
      preserveAutoNextScrambleMoves: preservePostSolveMoveGate,
    });
    setPhase("scrambling");
    phaseRef.current = "scrambling";
    const activeDailyTest = dailyTestRef.current;
    const prefix = activeDailyTest ? t(`每日五次测试 ${activeDailyTest.solves.length + 1}/${DAILY_TEST_TARGET}：`) : "";
    setScrambleNotice(t(`${prefix}请转第 1 步：${nextScramble[0]}`));
    void requestFacelets();
    if (preservePostSolveMoveGate && pendingAutoNextScrambleMovesRef.current.length > 0) {
      const pendingMoves = pendingAutoNextScrambleMovesRef.current;
      pendingAutoNextScrambleMovesRef.current = [];
      pendingMoves.forEach((move) => handleScrambleMove(move, { animate: false }));
    }
  }

  function beginScramble() {
    startScrambleAttempt(false);
  }

  function beginAutoNextScramble() {
    startScrambleAttempt(true);
  }

  useEffect(() => {
    beginAutoNextScrambleRef.current = beginAutoNextScramble;
  });

  function startDailyLevelTest(localDate = getDailyTestDateKey()) {
    if (timingModeRef.current === "smart-cube" && !isConnected) {
      setScrambleNotice(t("请先连接智能魔方。"));
      return;
    }
    if (dailyLevels.some((entry) => entry.localDate === localDate)) {
      setScrambleNotice(localDate === getDailyTestDateKey() ? t("今日测试已完成，明天再来。") : t("该日期测试已完成。"));
      return;
    }
    const canStartFromScramble =
      practiceModeRef.current === "scramble" &&
      (phaseRef.current === "idle" || phaseRef.current === "done" || phaseRef.current === "scrambling" || phaseRef.current === "inspect");
    const canStartFromFree = practiceModeRef.current === "free" && phaseRef.current !== "solving";
    if (dailyTestRef.current || smartSolveBusy || (!canStartFromScramble && !canStartFromFree)) return;
    const run: DailyTestRun = {
      id: `daily-${localDate}-${Date.now()}`,
      localDate,
      solves: [],
    };
    clearFreeTimers();
    lastCompletedPracticeResult = null;
    turnCounterRef.current.reset();
    updateSolveMs(0);
    solveMoveCountRef.current = 0;
    setSolveMoveCount(0);
    solveTimelineMovesRef.current = [];
    setCompletedSolveTimeline(null);
    cfopTimesRef.current = EMPTY_CFOP;
    cfopMovesRef.current = EMPTY_CFOP;
    f2lSubTimesRef.current = EMPTY_F2L_SUBPHASES;
    f2lSubMovesRef.current = EMPTY_F2L_SUBPHASES;
    highestF2lSolvedSlotCountRef.current = 0;
    setCfopTimes(EMPTY_CFOP);
    setF2lSubTimes(EMPTY_F2L_SUBPHASES);
    setF2lSubMoves(EMPTY_F2L_SUBPHASES);
    solveFormulasRef.current = {};
    setSolveFormulas({});
    practiceModeRef.current = "scramble";
    setPracticeMode("scramble");
    dailyTestRef.current = run;
    setDailyTest(run);
    if (timingModeRef.current === "smart-cube") {
      beginScramble();
    } else {
      const nextScramble = generateScramble(SCRAMBLE_LENGTH);
      resetAttempt(nextScramble);
      setScrambleNotice(t(showKeyboardHints
        ? "按照公式自行完成打乱，准备复原时长按空格或界面。"
        : "按照公式自行完成打乱，准备复原时长按界面。"));
    }
  }

  function changePracticeMode(nextMode: PracticeMode) {
    if (practiceMode === nextMode || dailyTest || smartSolveBusy || phase === "solving") return;

    clearFreeTimers();
    practiceModeRef.current = nextMode;
    setPracticeMode(nextMode);
    savePracticeUiPreferences(nextMode, timingModeRef.current);
    resetAttempt();
    if (nextMode === "free" && isConnected && timingModeRef.current === "smart-cube") {
      void requestFacelets();
    }
  }

  function changeTimingMode(nextMode: TimingMode) {
    if (
      dailyTestRef.current ||
      timingModeRef.current === nextMode ||
      phaseRef.current === "solving" ||
      manualTimerArmStateRef.current !== "idle" ||
      smartSolveBusy
    ) {
      return;
    }

    pendingSmartModeRef.current = false;
    if (nextMode === "timer") {
      manualTimerOverrideRef.current = true;
      timingModeRef.current = "timer";
      setTimingMode("timer");
      savePracticeUiPreferences(practiceModeRef.current, "timer");
      resetAttempt(practiceModeRef.current === "scramble" ? generateScramble(SCRAMBLE_LENGTH) : scrambleRef.current);
      return;
    }

    manualTimerOverrideRef.current = false;
    timingModeRef.current = "smart-cube";
    setTimingMode("smart-cube");
    savePracticeUiPreferences(practiceModeRef.current, "smart-cube");
    resetAttempt();
    if (practiceModeRef.current === "free" && isConnected) void requestFacelets();
  }

  function refreshManualScramble() {
    if (timingModeRef.current !== "timer" || phaseRef.current === "solving" || manualTimerArmStateRef.current !== "idle") return;
    const nextScramble = generateScramble(SCRAMBLE_LENGTH);
    resetAttempt(nextScramble);
  }

  function handleManualTimerPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    beginManualTimerHold();
  }

  function handleManualTimerPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    releaseManualTimerHold();
  }

  function handleManualTimerPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearManualTimerArm();
  }

  function showHistoryCfopTip(
    target: HTMLElement,
    entry: SolveHistoryEntry,
    historyNumber: number,
    pointer?: { x: number; y: number },
  ) {
    const rect = target.getBoundingClientRect();
    const anchorX = pointer?.x ?? rect.left + rect.width / 2;
    const anchorY = pointer?.y ?? rect.top + rect.height / 2;
    const fixedRightLeft = Math.max(HISTORY_CFOP_TIP_MARGIN, window.innerWidth - HISTORY_CFOP_TIP_WIDTH - HISTORY_CFOP_TIP_MARGIN);
    const maxTop = Math.max(HISTORY_CFOP_TIP_MARGIN, window.innerHeight - HISTORY_CFOP_TIP_HEIGHT - HISTORY_CFOP_TIP_MARGIN);
    if (window.matchMedia("(width > 700px) and (width <= 1240px)").matches) {
      const panel = target.closest(".stats")?.getBoundingClientRect() ?? rect;
      const top = Math.min(maxTop, Math.max(HISTORY_CFOP_TIP_MARGIN, anchorY - HISTORY_CFOP_TIP_HEIGHT / 2));
      setHistoryCfopTip({
        entry,
        historyNumber,
        left: Math.min(fixedRightLeft, panel.right + HISTORY_CFOP_TIP_GAP),
        top,
        arrowLeft: 0,
        arrowTop: Math.min(HISTORY_CFOP_TIP_HEIGHT - 22, Math.max(22, anchorY - top)),
        placement: "right",
      });
      return;
    }
    const placement =
      anchorY > HISTORY_CFOP_TIP_HEIGHT + HISTORY_CFOP_TIP_GAP + HISTORY_CFOP_TIP_MARGIN ? "above" : "below";
    const left = fixedRightLeft;
    const idealTop = placement === "above"
      ? anchorY - HISTORY_CFOP_TIP_HEIGHT - HISTORY_CFOP_TIP_GAP
      : anchorY + HISTORY_CFOP_TIP_GAP;
    const top = Math.min(maxTop, Math.max(HISTORY_CFOP_TIP_MARGIN, idealTop));
    const arrowLeft = Math.min(HISTORY_CFOP_TIP_WIDTH - 22, Math.max(22, anchorX - left));
    setHistoryCfopTip({
      entry,
      historyNumber,
      left,
      top,
      arrowLeft,
      placement,
    });
  }

  const stats = useMemo(() => {
    if (history.length === 0) return { best: null, avg5: null, avg20: null, count: 0 };
    const ms = history.map((entry) => entry.ms);
    const avg = (arr: number[]) => {
      if (arr.length < 3) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const trimmed = sorted.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    };
    const avg20 = history.length >= averageSettings.sampleSize
      ? calculateAverageTime(history.slice(0, averageSettings.sampleSize).toReversed().map((entry) => entry.ms), averageSettings)?.valueMs ?? null
      : null;
    return {
      best: Math.min(...ms),
      avg5: history.length >= 5 ? avg(ms.slice(0, 5)) : null,
      avg20,
      count: history.length,
    };
  }, [averageSettings, history]);
  const recentHistory = useMemo(() => history.slice(0, historyRows), [history, historyRows]);
  const recentSlowest = useMemo(
    () => (recentHistory.length === 0 ? 0 : Math.max(...recentHistory.map((entry) => entry.ms))),
    [recentHistory],
  );
  const isConnected = connectionState === "connected";
  const isManualTimer = timingMode === "timer";
  const isManualTimerFocused = isManualTimer && (manualTimerArmState === "ready" || phase === "solving");
  const todayLocalDate = getDailyTestDateKey();
  const yesterdayLocalDate = getYesterdayDailyTestDateKey();
  const todayDailyLevel = useMemo(
    () => dailyLevels.find((entry) => entry.localDate === todayLocalDate) ?? null,
    [dailyLevels, todayLocalDate],
  );
  const yesterdayDailyLevel = useMemo(
    () => dailyLevels.find((entry) => entry.localDate === yesterdayLocalDate) ?? null,
    [dailyLevels, yesterdayLocalDate],
  );
  const dailyTestProgress = dailyTest?.solves.length ?? 0;
  const dailyTestDisplayDate = dailyTest?.localDate ?? todayLocalDate;
  const dailyTestDisplaySolves = dailyTest?.solves ?? todayDailyLevel?.solves ?? [];
  const smartSolveVisible = smartSolveStatus === "active" || smartSolveStatus === "done";
  const smartSolveBusy = smartSolveStatus === "loading" || smartSolveStatus === "active";
  const freePracticeVisible = !isManualTimer && practiceMode === "free" && isConnected && smartSolveStatus === "idle" && phase !== "solving";
  const stageGuidanceVisible = !isManualTimer && (smartSolveVisible || phase === "scrambling" || freePracticeVisible);
  const canInterruptScrambleAttempt = practiceMode === "scramble" && (phase === "scrambling" || phase === "inspect");
  const canStartDailyTestFromScramble = practiceMode === "scramble" && (phase === "idle" || phase === "done" || canInterruptScrambleAttempt);
  const canStartDailyTestFromFree = practiceMode === "free" && phase !== "solving";
  const canSwitchMode = !dailyTest && !smartSolveBusy && phase !== "solving";
  const canSwitchTimingMode = !dailyTest && !smartSolveBusy && phase !== "solving" && manualTimerArmState === "idle";
  const manualScrambleVisible = isManualTimer && practiceMode === "scramble";
  const mobileScrambleVisible = isSmallScreen && !isManualTimer && phase === "scrambling";
  const canStartDailyTestSession = (isManualTimer || isConnected) && !dailyTest && !smartSolveBusy && (canStartDailyTestFromScramble || canStartDailyTestFromFree);
  const canStartTodayDailyTest = !todayDailyLevel && canStartDailyTestSession;
  const showYesterdayMakeupTest = !todayDailyLevel && !yesterdayDailyLevel;
  const canStartYesterdayMakeupTest = showYesterdayMakeupTest && canStartDailyTestSession;
  const freeIdleProgress = freeState === "armed"
    ? 1
    : freeState === "scrambling"
      ? Math.min(
          1,
          Math.max(
            0,
            (FREE_SCRAMBLE_IDLE_MS - freeIdleMsLeft - FREE_SCRAMBLE_FILL_DELAY_MS) / FREE_SCRAMBLE_FILL_MS,
          ),
        )
      : 0;
  const manualTimerPhaseLabel = manualFallbackNotice && phase === "solving"
    ? t(showKeyboardHints ? "连接已断开 · 按空格或点击界面结束并仅保存总用时" : "连接已断开 · 点击界面结束并仅保存总用时")
    : phase === "solving"
      ? t(showKeyboardHints ? "按空格或点击界面结束" : "点击界面结束")
      : manualTimerArmState === "ready"
        ? t("松开开始")
        : manualTimerArmState === "holding"
          ? t("继续按住")
          : phase === "done"
            ? t(showKeyboardHints ? "长按空格或界面以开始下一次" : "长按界面以开始下一次")
            : t(showKeyboardHints ? "长按空格或界面以准备" : "长按界面以准备");
  const manualTimerDisplayMs = manualTimerArmState === "idle" && (phase === "solving" || phase === "done") ? solveMs : 0;
  const currentSolveTimeline = !isManualTimer && phase !== "solving" && completedSolveTimeline?.durationMs === Math.round(solveMs)
    ? completedSolveTimeline
    : null;

  const undoExpected = undoStackRef.current[undoStackRef.current.length - 1];
  const smartSolveUndoExpected = smartSolveUndoDisplay[smartSolveUndoDisplay.length - 1];
  const smartSolveCounterValue = smartSolveSteps.length === 0
    ? 0
    : Math.min(smartSolveSteps.length, smartSolveIndex + (smartSolveStatus === "done" ? 0 : 1));
  const stableScoreDescription = t(describeAverageTimeSettings(averageSettings));

  const dailyTestAverageLabel = todayDailyLevel ? fmtShort(todayDailyLevel.averageMs) : null;
  const recognitionPanel = !isManualTimer && formulaRecognitionEnabled ? (
<PracticeRecognitionPanel
    dailyTest={dailyTest}
    recognizedFormula={recognizedFormula}
    formulaTopViewFaceColors={formulaTopViewFaceColors}
    formulaLearningStatuses={formulaLearningStatuses}
    connectionState={connectionState}
  />
  ) : null;
  const settingsPanel = (
    <PracticeSettingsPanel
    dailyTest={dailyTest}
    practiceMode={practiceMode}
    changePracticeMode={changePracticeMode}
    canSwitchMode={canSwitchMode}
    isManualTimer={isManualTimer}
    changeTimingMode={changeTimingMode}
    canSwitchTimingMode={canSwitchTimingMode}
    connectionState={connectionState}
    gyroDisabled={gyroDisabled}
    toggleGyroDisabled={toggleGyroDisabled}
    formulaRecognitionEnabled={formulaRecognitionEnabled}
    toggleFormulaRecognition={toggleFormulaRecognition}
    resetDisplayOrientation={resetDisplayOrientation}
    canResetDisplayOrientation={canResetDisplayOrientation}
    onSmartSolve={() => { setMobileDialog(null); void beginSmartSolve(); }}
    smartSolveStatus={smartSolveStatus}
  />
  );
  const dailyPanel = (
    <PracticeDailyTestPanel
    isSmallScreen={isSmallScreen}
    dailyTestDisplayDate={dailyTestDisplayDate}
    dailyTestDisplaySolves={dailyTestDisplaySolves}
    dailyTest={dailyTest}
    showYesterdayMakeupTest={showYesterdayMakeupTest}
    startDailyLevelTest={startDailyLevelTest}
    yesterdayLocalDate={yesterdayLocalDate}
    canStartYesterdayMakeupTest={canStartYesterdayMakeupTest}
    todayLocalDate={todayLocalDate}
    canStartTodayDailyTest={canStartTodayDailyTest}
    todayDailyLevel={todayDailyLevel}
    onShowDailyResult={(entry) => setDailyTestResult(entry)}
    onShowSolve={(solve, index) => setDailySolveDetails({
      entry: history.find((entry) => entry.ts === solve.ts && entry.dailyTest?.id === (dailyTest?.id ?? todayDailyLevel?.id)) ?? solve,
      index,
    })}
    dailyTestAverageLabel={dailyTestAverageLabel}
    cancelCurrentAttempt={cancelCurrentAttempt}
  />
  );
  const statsPanel = (
    <PracticeHistoryPanel
    dailyTest={dailyTest}
    stats={stats}
    stableScoreDescription={stableScoreDescription}
    history={history}
    historyListRef={historyListRef}
    historyRowSize={historyRowSize}
    recentHistory={recentHistory}
    recentSlowest={recentSlowest}
    onCloseHistoryTip={() => setHistoryCfopTip(null)}
    showHistoryCfopTip={showHistoryCfopTip}
    historyDialogOpen={historyDialogOpen}
    onOpenHistory={() => setHistoryDialogOpen(true)}
    portalReady={portalReady}
    historyCfopTip={historyCfopTip}
  />
  );
  const scorePanel = (
    <PracticeScorePanel
    isManualTimer={isManualTimer}
    solveMs={solveMs}
    solveMoveCount={solveMoveCount}
    currentSolveTimeline={currentSolveTimeline}
    phase={phase}
    stageGuidanceVisible={stageGuidanceVisible}
    cfopTimes={cfopTimes}
    cfopMoves={cfopMovesRef.current}
    f2lSubTimes={f2lSubTimes}
    f2lSubMoves={f2lSubMoves}
    solveFormulas={solveFormulas}
    formulaTopViewFaceColors={formulaTopViewFaceColors}
  />
  );
  const scramblePanel = phase === "scrambling" ? (
<PracticeScramblePanel
    mode="guided"
    moves={scramble}
    index={scrambleIndex}
    statuses={scrambleStatus}
    wrong={scrambleWrong}
    undoDisplay={undoDisplay}
    undoExpected={undoExpected}
    onCancel={cancelCurrentAttempt}
  />
  ) : null;
  return (
    <div className={`app lf-practice-app practice-focus-app${isManualTimer ? " manual-timer-mode" : ""}${isManualTimerFocused ? " manual-timer-focused" : ""}${dailyTest ? " daily-test-focused" : ""}`}>
      <AppTopbar />

      <main className="practice-layout">
        <div className="practice-info" inert={isManualTimerFocused}>
        <section className="practice-left">
          {!isSmallScreen && dailyPanel}

          {!isSmallScreen && settingsPanel}

          {!isSmallScreen && recognitionPanel}

          {!isManualTimer && <div className="practice-card legend ui-info-panel" inert={!!dailyTest}>
            <div className="practice-card-head">
              <div className="practice-title-line">
                <div className="practice-card-title">{t("色彩对照")}</div>
                <span className="practice-kicker" aria-hidden="true">COLORS</span>
              </div>
            </div>
            <CubeColorLegend faceColors={faceColors} />
          </div>}

        </section>

        <section className="practice-right">
          {!isSmallScreen && statsPanel}

          {!isSmallScreen && scorePanel}

        </section>
        </div>

        {isSmallScreen && <PracticeMobilePanels key={`${timingMode}-${formulaRecognitionEnabled}`} panels={isManualTimer ? [statsPanel, dailyPanel] : [...(recognitionPanel ? [recognitionPanel] : []), scorePanel, dailyPanel, statsPanel]}
          overlay={mobileScrambleVisible ? scramblePanel : undefined} disabled={isManualTimerFocused}
          onChange={() => setHistoryCfopTip(null)} />}

        <section className="practice-center">
          <div className="practice-stage">

            {!isManualTimer && <div className="cube-mount" ref={cubeMountRef}></div>}
            {!isManualTimer && (
              <TurnSpeed />
            )}

            {isManualTimer && (
              <div className={`manual-timer-stage${manualScrambleVisible ? " with-scramble" : ""}`}>
                <div
                  className={`manual-timer-surface arm-${manualTimerArmState} phase-${phase}${manualFallbackNotice ? " fallback" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={manualTimerPhaseLabel}
                  onPointerDown={handleManualTimerPointerDown}
                  onPointerUp={handleManualTimerPointerUp}
                  onPointerCancel={handleManualTimerPointerCancel}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div className="manual-timer-content">
                    <div className="manual-timer-value">{fmtTime(manualTimerDisplayMs)}</div>
                    <div className="manual-timer-status" aria-live="polite">{manualTimerPhaseLabel}</div>
                  </div>
                </div>
                {phase === "solving" && (
                  <button
                    type="button"
                    className="practice-btn practice-btn-ghost manual-timer-cancel"
                    onClick={() => resetAttempt()}
                    onKeyDown={(event) => event.stopPropagation()}
                    onKeyUp={(event) => event.stopPropagation()}
                  >{t("取消")}</button>
                )}
              </div>
            )}

            {!isManualTimer && (!stageGuidanceVisible || (isSmallScreen && phase === "scrambling")) && (
              <div className="stage-timer-stack">
                <div className={`timer timer-${phase}${practiceMode === "free" ? ` timer-free timer-free-${freeState}` : ""}`}>
                  {(phase === "idle" || phase === "scrambling") && <div className="t-display">{fmtTime(0)}</div>}
                  {phase === "inspect" && (
                    <div className="t-display t-warn">
                      {inspectionDurationMs === null ? (
                        <svg
                          className="practice-infinity-symbol"
                          viewBox="0 0 72 40"
                          role="img"
                          aria-label={t("无限观察")}
                        >
                          <path d="M36 20C29 10 24 6 17 6C9 6 4 12 4 20C4 28 9 34 17 34C24 34 29 30 36 20C43 10 48 6 55 6C63 6 68 12 68 20C68 28 63 34 55 34C48 34 43 30 36 20Z" />
                        </svg>
                      ) : Math.ceil(inspectMs / 1000)}
                      {inspectionDurationMs !== null && <span className="t-unit">s</span>}
                    </div>
                  )}
                  {(phase === "solving" || phase === "done") && <div className="t-display t-active">{fmtTime(solveMs)}</div>}
                </div>

                <div className="timer-controls">
                  {!isConnected && phase !== "solving" && phase !== "scrambling" && (
                    <button className="practice-btn practice-btn-primary" onClick={startConnection} disabled={connectionState === "connecting" || smartSolveBusy}>
                      <span>
                        {connectionState === "connecting" ? t("等待浏览器选择器") : t("连接智能魔方")}
                      </span>
                    </button>
                  )}
                  {isConnected && practiceMode === "scramble" && (phase === "idle" || phase === "done") && (
                    <button className="practice-btn practice-btn-primary" onClick={beginScramble} disabled={smartSolveBusy}>
                      <span>
                        {t(showKeyboardHints ? "开始打乱 · 按 SPACE" : "开始打乱")}
                      </span>
                    </button>
                  )}
                  {isSmallScreen && phase === "scrambling" && (
                    <button className="practice-btn practice-btn-primary" onClick={cancelCurrentAttempt}>
                      <span>{t("取消")}</span>
                    </button>
                  )}
                  {practiceMode === "scramble" && phase === "inspect" && (
                    <button className="practice-btn practice-btn-primary" onClick={cancelCurrentAttempt}>
                      <span>{t(showKeyboardHints ? "取消本次复原 · 按 SPACE" : "取消本次复原")}</span>
                    </button>
                  )}
                  {phase === "solving" && (
                    <button className="practice-btn practice-btn-primary" onClick={cancelCurrentAttempt}>
                      <span>{t(showKeyboardHints ? "取消 · 按 SPACE" : "取消")}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="practice-mobile-actions">
              {((stageGuidanceVisible && !(isSmallScreen && phase === "scrambling")) || (isManualTimer && !isSmallScreen)) && (
                <div className="timer-controls">
                <button type="button" className="practice-btn practice-btn-primary" disabled={isManualTimerFocused}
                  onClick={() => isManualTimer ? resetAttempt() : cancelCurrentAttempt()}>
                  {t(isManualTimer ? "重置" : "取消")}
                </button>
                </div>
              )}
              <PracticeSettingsButton onClick={() => setMobileDialog("settings")} expanded={mobileDialog === "settings"}
                disabled={!!dailyTest || isManualTimerFocused || phase === "solving"} />
            </div>

            {((stageGuidanceVisible && !mobileScrambleVisible) || manualScrambleVisible) && (
              <div className="stage-bottom-stack" inert={isManualTimerFocused}>
                {manualScrambleVisible && (
<PracticeScramblePanel
    mode="manual"
    moves={scramble}
    dailyProgress={dailyTest ? dailyTestProgress : null}
    dailyTarget={DAILY_TEST_TARGET}
    changeDisabled={manualTimerArmState !== "idle"}
    onChange={refreshManualScramble}
  />

                )}
                {!isSmallScreen && scramblePanel}
                {smartSolveVisible && (
                <div className="stage-hint solve-stage-hint" role="status" aria-label={t("智能求解")}>
                  <div className="sh-head">
                    <div className="sh-kicker">{t("智能求解")}</div>
                    {smartSolveSteps.length > 0 && (
                      <div className="sh-counter">
                        <span className="sh-counter-num">{smartSolveCounterValue}</span>
                        <span className="sh-counter-sep">/</span>
                        <span className="sh-counter-total">{smartSolveSteps.length}</span>
                      </div>
                    )}
                    <button className="sh-cancel" onClick={cancelSmartSolve} aria-label={t("关闭智能求解")}>
                      {smartSolveStatus === "active" ? t("取消") : t("关闭")}
                    </button>
                  </div>
                  {smartSolveSteps.length > 0 && (
                    <div className="sh-grid">
                      {smartSolveSteps.map((move, index) => {
                        const stepStatus: AlgorithmStepStatus =
                          index === smartSolveIndex && (smartSolveWrong || smartSolveUndoExpected)
                            ? "wrong"
                            : smartSolveStepStatus[index] === "correct"
                              ? "correct"
                              : smartSolveStepStatus[index] === "partial"
                                ? "partial"
                                : "pending";
                        return (
                          <AlgorithmStepToken
                            key={`${move}-${index}`}
                            move={move}
                            index={index}
                            status={stepStatus}
                            active={smartSolveStatus === "active" && index === smartSolveIndex}
                          />
                        );
                      })}
                    </div>
                  )}
                  {(smartSolveUndoDisplay.length > 0 || smartSolveStatus === "done") && (
                    <div className={`sh-notice${smartSolveUndoExpected ? " error" : ""}`}>
                      {smartSolveUndoDisplay.length > 0 ? (
                        <>
                          <span className="sh-notice-label">{t("撤销提示：请依次转")}</span>
                          <span className="sh-undo-list">
                            {[...smartSolveUndoDisplay].reverse().map((move, index) => (
                              <MoveToken key={`${move}-${index}`} move={move} />
                            ))}
                          </span>
                        </>
                      ) : (
                        smartSolveNotice
                      )}
                    </div>
                  )}
                </div>
                )}

                {freePracticeVisible && (
                <div className="stage-hint free-stage-hint" role="status" aria-label={t("自由练习状态")}>
                  <div className="sh-head">
                    <div className="sh-kicker">{t("自由练习")}</div>
                    <div className="sh-actions">
                      <button className="sh-cancel" onClick={cancelFreePractice} aria-label={t("取消自由练习")}>{t("取消")}</button>
                      {(freeState === "scrambling" || freeState === "armed" || phase === "done") && (
                        <button className="sh-cancel" onClick={cancelCurrentAttempt} aria-label={t("重置自由练习")}>{t("重置")}</button>
                      )}
                    </div>
                  </div>
                  <div className="free-state-grid">
                    {[
                      [t("状态同步"), freeState === "waitingSolved" ? "active" : freeState === "ready" || freeState === "scrambling" || freeState === "armed" ? "done" : ""],
                      [t("自由打乱"), freeState === "scrambling" || freeState === "armed" ? "done" : ""],
                      [t("静止 5 秒"), freeState === "scrambling" ? "filling" : freeState === "armed" ? "done" : ""],
                      [t("开始复原"), freeState === "armed" ? "active" : ""],
                    ].map(([label, status]) => (
                      <span key={label} className={`free-state-cell ${status}`}>
                        {label === t("静止 5 秒") && status === "filling" && (
                          <span
                            className="free-state-fill"
                            style={{ width: `${freeIdleProgress * 100}%` }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="free-state-label">{label}</span>
                      </span>
                    ))}
                  </div>
                  {freeNotice && <div className="sh-notice">{freeNotice}</div>}
                </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

              {historyDialogOpen && (
                <SolveHistoryDialog
                  history={history}
                  onClose={() => setHistoryDialogOpen(false)}
                  onDelete={deleteHistoryEntry}
                />
              )}
      {isSmallScreen && mobileDialog && (
        <PracticeMobileDialog title={t("练习设置")} onClose={() => setMobileDialog(null)}>
          {settingsPanel}
        </PracticeMobileDialog>
      )}
      {dailyTestResult && <DailyTestResultDialog entry={dailyTestResult} onClose={() => setDailyTestResult(null)} />}
      {isSmallScreen && dailySolveDetails && (
        <PracticeMobileDialog title={`${t("单次成绩")} #${dailySolveDetails.index + 1}`} onClose={() => setDailySolveDetails(null)}>
          <div className="stats-cfop-floating-tip daily-solve-details">
            <SolveRecordDetails entry={dailySolveDetails.entry} />
          </div>
        </PracticeMobileDialog>
      )}
      <AppFooter />
    </div>
  );
}
