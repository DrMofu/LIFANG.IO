"use client";

import { PracticeMobileDialog, PracticeMobilePanels, PracticeSettingsButton } from "@/components/practice-mobile-panels";
import { SettingChoice, SettingToggle } from "@/components/setting-controls";

import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlgorithmStepToken, type AlgorithmStepStatus } from "@/components/algorithm-step-token";
import { SolveHistoryDialog } from "@/components/solve-history-dialog";
import { DailyTestResultDialog } from "@/components/daily-test-result-dialog";
import { AppFooter, AppTopbar } from "@/components/app-shell";
import { SolveRecordDetails, SOLVE_RECORD_TIP_WIDTH as HISTORY_CFOP_TIP_WIDTH, SOLVE_RECORD_TIP_HEIGHT as HISTORY_CFOP_TIP_HEIGHT } from "@/components/solve-record-details";
import { useLanguage } from "@/components/language-provider";
import { useNotification } from "@/components/notification-provider";
import { useGyroPowerNotice } from "@/components/gyro-power-notice";
import { isTextEntryTarget } from "@/lib/keyboard-shortcuts";
import {
  useCubeConnection,
  type CubeFaceletsSignal,
  type CubeMoveSignal,
  type CubeVisualState,
} from "@/components/cube-connection-provider";
import { CubeColorLegend } from "@/components/cube-color-legend";
import { FormulaTopViewImage } from "@/components/formula-cube-image";
import { MoveToken } from "@/components/move-token";
import { SolveTimeline, type SolveTimelineRecord } from "@/components/solve-timeline";
import { getFaceHexColors, mapMoveToOrientation } from "@/lib/cube-appearance";
import { useClientReady } from "@/lib/client-ready";
import { useKeyboardHints } from "@/lib/use-keyboard-hints";
import {
  expandMoveNotation,
  hintMoveForDoubleTurnProgress,
  invertMoveNotation,
  movePartiallyMatchesExpectedDoubleTurn,
  moveCanStillMatchExpected,
  movesMatchExpected,
  parseMoveNotation,
} from "@/lib/algorithms";
import { getInitialCubeVisualState } from "@/lib/cube-visual-state";
import { detectCfopMilestones, detectF2lSolvedSlotCount, isSolvedFacelets } from "@/lib/cube-state";
import { solveFacelets } from "@/lib/cubing-solver";
import { fmtShort, fmtTime } from "@/lib/format";
import { TurnCounter, calculateTps, formatTps } from "@/lib/tps";
import { TurnSpeed } from "@/components/turn-speed";
import {
  DEFAULT_AVERAGE_TIME_SETTINGS,
  calculateAverageTime,
  describeAverageTimeSettings,
  loadAverageTimeSettings,
  type AverageTimeSettings,
} from "@/lib/average-time";
import { useCubeAppearance } from "@/components/cube-appearance-provider";
import { CUBE_CAMERA_PRESETS } from "@/lib/cube-camera-presets";
import {
  FORMULA_LEARNING_STATUSES,
  getFormulaLearningStatus,
  readFormulaLearningStatuses,
  type FormulaLearningStatus,
} from "@/lib/formula-learning-status";
import {
  type CubeDisplayState,
  type CubeFace,
  type CubeQuaternion,
  type SmartCubeApi,
  mountSmartCube,
} from "@/lib/smart-cube";
import {
  getDailyTestDateKey,
  getArchiveScopedStorageKey,
  MISSING_HISTORY_VALUE,
  addDailyPracticeDuration,
  calculateDailyLevelAverage,
  loadDailyLevels,
  loadSolveHistory,
  prependSolveHistoryEntry,
  saveDailyLevels,
  saveSolveHistory,
  subscribeStatisticsArchiveChange,
  type DailyLevelEntry,
  type DailyLevelSolve,
  type CfopPhaseMetrics,
  type F2lSubphaseMetrics,
  type HistoryMetricValue,
  type SolveHistoryEntry,
  type SolveSource,
} from "@/lib/solve-history";
import { isCubeSerialAfter, normalizeCubeSerial } from "@/lib/cube-serial";
import {
  DEFAULT_PRACTICE_INSPECTION_SETTINGS,
  getPracticeInspectionDurationMs,
  loadPracticeInspectionSettings,
  type PracticeInspectionSettings,
} from "@/lib/practice-inspection";
import { touchLocalUserDataPackageUpdatedAt } from "@/lib/user-data-package";
import type { FormulaRecognitionResult } from "@/lib/formula-recognition";

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
const DAILY_TEST_TARGET = 5;
const SOLVED_TRAILING_MOVE_SUPPRESS_MS = 900;
const DISPLAY_STATE_EPSILON = 0.001;
const CUBE_MOVE_ANIMATION_MS = 150;
const HISTORY_ROW_SIZE = 44;
const HISTORY_PREVIEW_LIMIT = 5;
const MAX_UNDO_HINT_QUEUE_LENGTH = 20;
const HISTORY_CFOP_TIP_GAP = 12;
const HISTORY_CFOP_TIP_MARGIN = 14;
const INSPECTION_AUDIO_CUE_SECONDS = [5, 4, 3, 2, 1] as const;
const INSPECTION_END_CUE_PRESERVE_MS = 320;
const SMART_SOLVE_FACELETS_TIMEOUT_MS = 1300;
const MANUAL_TIMER_ARM_MS = 350;
const PRACTICE_GYRO_DISABLED_KEY = "cube-practice-gyro-disabled";
const PRACTICE_FORMULA_RECOGNITION_ENABLED_KEY = "cube-practice-formula-recognition-enabled";
const PRACTICE_DISPLAY_STATE_KEY = "cube-practice-display-state";
const PRACTICE_UI_PREFERENCES_KEY = "cube-practice-ui-preferences-v1";
const PRACTICE_CUBE_CAMERA_PRESET = CUBE_CAMERA_PRESETS.practice;
const LEGACY_PRACTICE_CAMERA_DISTANCES = [6.4, 8] as const;

function loadPracticeGyroDisabled() {
  if (typeof window === "undefined") return false;
  try {
    return JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(PRACTICE_GYRO_DISABLED_KEY)) || "false") === true;
  } catch {
    return false;
  }
}

function savePracticeGyroDisabled(disabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(PRACTICE_GYRO_DISABLED_KEY), JSON.stringify(disabled));
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

function loadPracticeFormulaRecognitionEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return JSON.parse(
      window.localStorage.getItem(getArchiveScopedStorageKey(PRACTICE_FORMULA_RECOGNITION_ENABLED_KEY)) || "false",
    ) === true;
  } catch {
    return false;
  }
}

function savePracticeFormulaRecognitionEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getArchiveScopedStorageKey(PRACTICE_FORMULA_RECOGNITION_ENABLED_KEY),
      JSON.stringify(enabled),
    );
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

function isDefaultDisplayState(state: CubeDisplayState) {
  const defaultState = PRACTICE_CUBE_CAMERA_PRESET.displayState;
  return (
    Math.abs(state.cameraDistance - defaultState.cameraDistance) <= DISPLAY_STATE_EPSILON &&
    Math.abs(state.cameraLatitude - defaultState.cameraLatitude) <= DISPLAY_STATE_EPSILON &&
    Math.abs(state.cameraLongitude - defaultState.cameraLongitude) <= DISPLAY_STATE_EPSILON
  );
}

function isStoredDisplayState(value: unknown): value is CubeDisplayState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Record<keyof CubeDisplayState, unknown>>;
  return (
    typeof candidate.cameraDistance === "number" &&
    Number.isFinite(candidate.cameraDistance) &&
    typeof candidate.cameraLatitude === "number" &&
    Number.isFinite(candidate.cameraLatitude) &&
    typeof candidate.cameraLongitude === "number" &&
    Number.isFinite(candidate.cameraLongitude)
  );
}

function loadPracticeDisplayState() {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(PRACTICE_DISPLAY_STATE_KEY)) || "null");
    if (!isStoredDisplayState(parsed)) return null;
    if (LEGACY_PRACTICE_CAMERA_DISTANCES.some(
      (distance) => Math.abs(parsed.cameraDistance - distance) <= DISPLAY_STATE_EPSILON,
    )) {
      return {
        ...parsed,
        cameraDistance: PRACTICE_CUBE_CAMERA_PRESET.displayState.cameraDistance,
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePracticeDisplayState(state: CubeDisplayState | null) {
  if (typeof window === "undefined") return;
  try {
    const key = getArchiveScopedStorageKey(PRACTICE_DISPLAY_STATE_KEY);
    if (!state || isDefaultDisplayState(state)) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

type Phase = "idle" | "scrambling" | "inspect" | "solving" | "done";
type PracticeMode = "scramble" | "free";
type TimingMode = SolveSource;
type PracticeUiPreferences = {
  version: 1;
  practiceMode: PracticeMode;
  timingMode: TimingMode;
};
type ManualTimerArmState = "idle" | "holding" | "ready";
type FreePracticeState = "waitingSolved" | "ready" | "scrambling" | "armed";
type ScrambleStepStatus = "pending" | "partial" | "correct";
type SmartSolveStatus = "idle" | "loading" | "active" | "done";
type SmartSolveStepStatus = "pending" | "partial" | "correct";
type CfopPhaseKey = "cross" | "f2l" | "oll" | "pll";
type F2lSubphaseKey = "one" | "two" | "three" | "four";
type LiveCfopMetrics = Record<CfopPhaseKey, number | null>;
type LiveF2lSubphaseMetrics = Record<F2lSubphaseKey, number | null>;
type CurrentPracticeResult = {
  archiveStorageKey: string;
  ms: number;
  source: SolveSource;
  moveCount: number;
  cfop: LiveCfopMetrics;
  cfopMoves: LiveCfopMetrics;
  f2l: LiveF2lSubphaseMetrics;
  f2lMoves: LiveF2lSubphaseMetrics;
  formulas: Partial<Record<"oll" | "pll", FormulaRecognitionResult>>;
  timeline: SolveTimelineRecord | null;
};

// Client navigation keeps this module alive; a page reload clears the temporary result.
let lastCompletedPracticeResult: CurrentPracticeResult | null = null;

type InspectionAudioVoice = {
  gain: GainNode;
  oscillators: OscillatorNode[];
};

function loadPracticeUiPreferences(): PracticeUiPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(getArchiveScopedStorageKey(PRACTICE_UI_PREFERENCES_KEY)) || "null",
    ) as Partial<PracticeUiPreferences> | null;
    if (
      parsed?.version !== 1 ||
      (parsed.practiceMode !== "scramble" && parsed.practiceMode !== "free") ||
      (parsed.timingMode !== "timer" && parsed.timingMode !== "smart-cube")
    ) {
      return null;
    }
    return parsed as PracticeUiPreferences;
  } catch {
    return null;
  }
}

function savePracticeUiPreferences(practiceMode: PracticeMode, timingMode: TimingMode) {
  if (typeof window === "undefined") return;
  try {
    const preferences: PracticeUiPreferences = { version: 1, practiceMode, timingMode };
    window.localStorage.setItem(
      getArchiveScopedStorageKey(PRACTICE_UI_PREFERENCES_KEY),
      JSON.stringify(preferences),
    );
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

type HistoryCfopTip = {
  entry: SolveHistoryEntry;
  historyNumber: number;
  left: number;
  top: number;
  arrowLeft: number;
  arrowTop?: number;
  placement: "above" | "below" | "right";
};
type FormulaRecognitionModule = typeof import("@/lib/formula-recognition");

type DailyTestRun = {
  id: string;
  localDate: string;
  solves: DailyLevelSolve[];
};

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

const F2L_SUBPHASES: Array<{ key: F2lSubphaseKey; name: string }> = [
  { key: "one", name: "F2L 1/4" },
  { key: "two", name: "F2L 2/4" },
  { key: "three", name: "F2L 3/4" },
  { key: "four", name: "F2L 4/4" },
];

function toHistoryMetric(value: number | null): HistoryMetricValue {
  return typeof value === "number" && Number.isFinite(value) ? value : MISSING_HISTORY_VALUE;
}

function toHistoryCfopMetrics(metrics: LiveCfopMetrics): CfopPhaseMetrics {
  return {
    cross: toHistoryMetric(metrics.cross),
    f2l: toHistoryMetric(metrics.f2l),
    oll: toHistoryMetric(metrics.oll),
    pll: toHistoryMetric(metrics.pll),
  };
}

function toHistoryF2lSubphaseMetrics(metrics: LiveF2lSubphaseMetrics): F2lSubphaseMetrics {
  return {
    one: toHistoryMetric(metrics.one),
    two: toHistoryMetric(metrics.two),
    three: toHistoryMetric(metrics.three),
    four: toHistoryMetric(metrics.four),
  };
}

function fmtSolveDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getYesterdayDailyTestDateKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return getDailyTestDateKey(date);
}

function formatPhaseTimeDelta(metrics: CfopPhaseMetrics | undefined, key: CfopPhaseKey) {
  if (!metrics) return MISSING_HISTORY_VALUE;
  const current = metrics[key];
  if (typeof current !== "number") return MISSING_HISTORY_VALUE;
  if (key === "cross") return fmtShort(current);
  const previousKey = key === "f2l" ? "cross" : key === "oll" ? "f2l" : "oll";
  const previous = metrics[previousKey];
  if (typeof previous !== "number" || current < previous) return MISSING_HISTORY_VALUE;
  return fmtShort(current - previous);
}

function formatPhaseMoveDelta(metrics: CfopPhaseMetrics | undefined, key: CfopPhaseKey) {
  if (!metrics) return MISSING_HISTORY_VALUE;
  const current = metrics[key];
  if (typeof current !== "number") return MISSING_HISTORY_VALUE;
  if (key === "cross") return `${current}步`;
  const previousKey = key === "f2l" ? "cross" : key === "oll" ? "f2l" : "oll";
  const previous = metrics[previousKey];
  if (typeof previous !== "number" || current < previous) return MISSING_HISTORY_VALUE;
  return `${current - previous}步`;
}

function getF2lSubphasePrevious(
  cfopMetrics: CfopPhaseMetrics | undefined,
  f2lMetrics: F2lSubphaseMetrics | undefined,
  key: F2lSubphaseKey,
) {
  if (key === "one") return cfopMetrics?.cross;
  const previousKey = key === "two" ? "one" : key === "three" ? "two" : "three";
  return f2lMetrics?.[previousKey];
}

function formatF2lSubphaseTimeDelta(
  cfopMetrics: CfopPhaseMetrics | undefined,
  f2lMetrics: F2lSubphaseMetrics | undefined,
  key: F2lSubphaseKey,
) {
  const current = f2lMetrics?.[key];
  const previous = getF2lSubphasePrevious(cfopMetrics, f2lMetrics, key);
  if (typeof current !== "number" || typeof previous !== "number" || current < previous) return MISSING_HISTORY_VALUE;
  return fmtShort(current - previous);
}

function formatF2lSubphaseMoveDelta(
  cfopMoves: CfopPhaseMetrics | undefined,
  f2lMoves: F2lSubphaseMetrics | undefined,
  key: F2lSubphaseKey,
) {
  const current = f2lMoves?.[key];
  const previous = getF2lSubphasePrevious(cfopMoves, f2lMoves, key);
  if (typeof current !== "number" || typeof previous !== "number" || current < previous) return MISSING_HISTORY_VALUE;
  return `${current - previous}步`;
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

function normalizeMove(move: string) {
  return parseMoveNotation(move)?.notation ?? move;
}

function invertMove(move: string) {
  return invertMoveNotation(move);
}

function moveAmount(move: string) {
  const parsed = parseMoveNotation(move);
  if (!parsed) return null;
  const amount: 1 | 2 | 3 = parsed.turns === 2 ? 2 : parsed.dir === -1 ? 3 : 1;
  return {
    layer: parsed.layer,
    amount,
  };
}

function formatUndoMove(layer: string, amount: 1 | 2 | 3) {
  if (amount === 2) return `${layer}2`;
  if (amount === 3) return `${layer}'`;
  return layer;
}

function compressUndoMoveSequence(moves: string[]) {
  return moves.reduce<string[]>((history, move) => {
    const nextMove = moveAmount(move);
    if (!nextMove) return history;
    const next = [...history];
    const lastMove = moveAmount(next[next.length - 1]);
    if (lastMove && lastMove.layer === nextMove.layer) {
      next.pop();
      const combined = (lastMove.amount + nextMove.amount) % 4;
      if (combined !== 0) next.push(formatUndoMove(nextMove.layer, combined as 1 | 2 | 3));
      return next;
    }
    next.push(formatUndoMove(nextMove.layer, nextMove.amount));
    return next;
  }, []);
}

function buildUndoStack(moves: string[]) {
  return compressUndoMoveSequence(moves.map(invertMove));
}

function appendUndoStackMoves(undoStack: string[], moves: string[]) {
  return compressUndoMoveSequence([...undoStack, ...moves.map(invertMove)]);
}

function getRemainingUndoStack(undoStack: string[], pendingMoves: string[]) {
  const expectedUndo = undoStack[undoStack.length - 1];
  if (!expectedUndo || pendingMoves.length === 0) return undoStack;
  const remainingTop = compressUndoMoveSequence([...pendingMoves.toReversed().map(invertMove), expectedUndo]);
  return compressUndoMoveSequence([...undoStack.slice(0, -1), ...remainingTop]);
}

function splitInvalidPendingMoves(pendingMoves: string[], expectedMove: string) {
  for (let split = pendingMoves.length - 1; split >= 0; split -= 1) {
    const retainedMoves = pendingMoves.slice(0, split);
    if (retainedMoves.length === 0 || moveCanStillMatchExpected(retainedMoves, expectedMove)) {
      return {
        retainedMoves,
        wrongMoves: pendingMoves.slice(split),
      };
    }
  }
  return { retainedMoves: [], wrongMoves: pendingMoves };
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
  const visualPendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visualPendingMoveRef = useRef<string | null>(null);
  const autoNextScrambleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beginAutoNextScrambleRef = useRef<() => void>(() => undefined);
  const inspectionAudioContextRef = useRef<AudioContext | null>(null);
  const inspectionAudioTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const inspectionAudioVoicesRef = useRef<InspectionAudioVoice[]>([]);
  const inspectionEndCueUntilRef = useRef(0);
  const freeIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freeCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const freeFaceletsFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualTimerArmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("idle");
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
      formulaRecognitionLoadRef.current = import("@/lib/formula-recognition").then((recognitionModule) => {
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

  const getInspectionAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (inspectionAudioContextRef.current) return inspectionAudioContextRef.current;

    const AudioContextCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    try {
      const context = new AudioContextCtor();
      inspectionAudioContextRef.current = context;
      return context;
    } catch {
      return null;
    }
  }, []);

  const warmInspectionAudio = useCallback(() => {
    const context = getInspectionAudioContext();
    if (!context || context.state !== "suspended") return;
    void context.resume().catch(() => {
      // Audio is optional; timing should continue if the browser blocks it.
    });
  }, [getInspectionAudioContext]);

  const forgetInspectionVoice = useCallback((voice: InspectionAudioVoice) => {
    inspectionAudioVoicesRef.current = inspectionAudioVoicesRef.current.filter((candidate) => candidate !== voice);
  }, []);

  const stopInspectionVoice = useCallback(
    (voice: InspectionAudioVoice) => {
      const context = inspectionAudioContextRef.current;
      if (!context) {
        forgetInspectionVoice(voice);
        return;
      }

      const now = context.currentTime;
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setTargetAtTime(0, now, 0.012);
        voice.oscillators.forEach((oscillator) => oscillator.stop(now + 0.05));
      } catch {
        // Stopping an already-stopped oscillator throws in some browsers.
      }
      forgetInspectionVoice(voice);
    },
    [forgetInspectionVoice],
  );

  const cancelInspectionAudio = useCallback((preserveActiveVoices = false) => {
    inspectionAudioTimersRef.current.forEach((timer) => clearTimeout(timer));
    inspectionAudioTimersRef.current = [];
    if (preserveActiveVoices) return;
    inspectionAudioVoicesRef.current.forEach(stopInspectionVoice);
    inspectionAudioVoicesRef.current = [];
  }, [stopInspectionVoice]);

  const playInspectionBeep = useCallback(
    (variant: "soft" | "bright") => {
      if (phaseRef.current !== "inspect") return;
      const context = getInspectionAudioContext();
      if (!context) return;

      if (context.state === "suspended") {
        void context.resume().then(() => {
          if (phaseRef.current === "inspect") playInspectionBeep(variant);
        }).catch(() => {
          // Audio is optional; ignore blocked playback.
        });
        return;
      }

      const now = context.currentTime;
      const duration = variant === "bright" ? 0.22 : 0.13;
      const peakGain = 0.30;
      const releaseAt = now + duration - 0.04;
      const stopAt = now + duration + 0.04;
      const gain = context.createGain();
      const frequencies = variant === "bright" ? [1120, 1680] : [680];
      const oscillators = frequencies.map((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = variant === "bright" && index === 1 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.connect(gain);
        return oscillator;
      });
      const voice: InspectionAudioVoice = { gain, oscillators };

      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.012);
      gain.gain.setValueAtTime(peakGain, releaseAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      inspectionAudioVoicesRef.current = [...inspectionAudioVoicesRef.current, voice];
      oscillators.forEach((oscillator) => {
        oscillator.onended = () => forgetInspectionVoice(voice);
        oscillator.start(now);
        oscillator.stop(stopAt);
      });
    },
    [forgetInspectionVoice, getInspectionAudioContext],
  );

  const scheduleInspectionAudio = useCallback(
    (startedAt: number, durationMs: number) => {
      cancelInspectionAudio();
      warmInspectionAudio();

      inspectionAudioTimersRef.current = INSPECTION_AUDIO_CUE_SECONDS.flatMap((secondsLeft) => {
        const delay = durationMs - secondsLeft * 1000 - (performance.now() - startedAt);
        if (delay <= 0) return [];
        const timeout = setTimeout(() => {
          inspectionAudioTimersRef.current = inspectionAudioTimersRef.current.filter((timer) => timer !== timeout);
          if (phaseRef.current !== "inspect") return;
          playInspectionBeep("soft");
        }, delay);
        return [timeout];
      });
    },
    [cancelInspectionAudio, playInspectionBeep, warmInspectionAudio],
  );

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

  const clearVisualPendingTimer = useCallback(() => {
    if (visualPendingTimerRef.current === null) return;
    clearTimeout(visualPendingTimerRef.current);
    visualPendingTimerRef.current = null;
  }, []);

  const flushVisualPendingMove = useCallback(() => {
    const pending = visualPendingMoveRef.current;
    clearVisualPendingTimer();
    visualPendingMoveRef.current = null;
    if (pending) animateCubeMoves([pending]);
  }, [animateCubeMoves, clearVisualPendingTimer]);

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
      clearVisualPendingTimer();
      visualPendingMoveRef.current = null;
      if (cubeApiRef.current?.setFacelets(nextFacelets)) {
        lastAppliedFaceletsRef.current = nextFacelets;
      }
    },
    [clearVisualPendingTimer],
  );

  const queueVisualMove = useCallback(
    (move: string) => {
      const pending = visualPendingMoveRef.current;
      if (!pending) {
        visualPendingMoveRef.current = move;
        clearVisualPendingTimer();
        visualPendingTimerRef.current = setTimeout(flushVisualPendingMove, 45);
        return;
      }

      clearVisualPendingTimer();
      animateCubeMoves([pending]);
      visualPendingMoveRef.current = move;
      visualPendingTimerRef.current = setTimeout(flushVisualPendingMove, 45);
    },
    [animateCubeMoves, clearVisualPendingTimer, flushVisualPendingMove],
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
      cancelInspectionAudio();
      clearManualTimerArm();
      clearSolveTick();
      clearFreeTimers();
      clearVisualPendingTimer();
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
    clearVisualPendingTimer,
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
  ) : null;
  const settingsPanel = (
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
                <button type="button" className="ui-setting-action" onClick={() => { setMobileDialog(null); void beginSmartSolve(); }} disabled={smartSolveStatus === "loading"} aria-keyshortcuts="Q">{smartSolveStatus === "loading" ? t("求解中") : t("智能求解")}</button>
              </div>
            </>}
          </div>
  );
  const dailyPanel = (
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
                    onClick={() => todayDailyLevel ? setDailyTestResult(todayDailyLevel) : startDailyLevelTest(todayLocalDate)}
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
          </div>
  );
  const statsPanel = (
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
                        aria-label={t(`历史记录 #${historyNumber}，${
                          fmtShort(entry.ms)
                        }，${entry.source === "timer" ? t("纯计时器") : entry.moves == null ? t("步数未知") : t(`${entry.moves}步`)}`)}
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) setHistoryCfopTip(null);
                        }}
                        onFocus={(event) => {
                          if (event.target === event.currentTarget) showHistoryCfopTip(event.currentTarget, entry, historyNumber);
                        }}
                        onMouseEnter={(event) => showHistoryCfopTip(event.currentTarget, entry, historyNumber, { x: event.clientX, y: event.clientY })}
                        onMouseLeave={() => setHistoryCfopTip(null)}
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
                  setHistoryCfopTip(null);
                  setHistoryDialogOpen(true);
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
  const scorePanel = (
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
                    <small className="solve-phase-moves"> / {formatPhaseMoveDelta(toHistoryCfopMetrics(cfopMovesRef.current), "cross")}</small>
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
                    <small className="solve-phase-moves"> / {formatPhaseMoveDelta(toHistoryCfopMetrics(cfopMovesRef.current), "f2l")}</small>
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
                        <b>{formatF2lSubphaseMoveDelta(toHistoryCfopMetrics(cfopMovesRef.current), toHistoryF2lSubphaseMetrics(f2lSubMoves), subphase.key)}</b>
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
                        <small className="solve-phase-moves"> / {formatPhaseMoveDelta(toHistoryCfopMetrics(cfopMovesRef.current), key)}</small>
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
  const scramblePanel = phase === "scrambling" ? (
<div className="stage-hint scramble-stage-hint ui-info-panel" role="status" aria-label={t("打乱公式")}>
                  <div className="ui-section-head sh-head-scramble">
                    <div className="ui-section-title-line">
                      <div className="ui-section-title">{t("打乱公式")}</div>
                      <span className="ui-section-kicker" aria-hidden="true">SCRAMBLE</span>
                    </div>
                    {undoDisplay.length > 0 && (
                      <div className={`sh-notice sh-notice-inline${undoExpected ? " error" : ""}`}>
                        <span className="sh-notice-label">{t("撤销提示：请依次转")}</span>
                        <span className="sh-undo-list">
                          {[...undoDisplay].reverse().map((move, index) => (
                            <MoveToken key={`${move}-${index}`} move={move} />
                          ))}
                        </span>
                      </div>
                    )}
                    <div className="sh-actions">
                      <div className="sh-counter">
                        <span className="sh-counter-num">{scrambleIndex + 1}</span>
                        <span className="sh-counter-sep">/</span>
                        <span className="sh-counter-total">{scramble.length}</span>
                      </div>
                      <button className="sh-cancel" onClick={cancelCurrentAttempt} aria-label={t("取消打乱")}>{t("取消")}</button>
                    </div>
                  </div>
                  <div className="sh-grid">
                    {scramble.map((move, index) => {
                      const stepStatus: AlgorithmStepStatus =
                        index === scrambleIndex && (scrambleWrong || undoExpected)
                          ? "wrong"
                          : scrambleStatus[index] === "correct"
                            ? "correct"
                            : scrambleStatus[index] === "partial"
                              ? "partial"
                              : "pending";
                      return (
                        <AlgorithmStepToken
                          key={`${move}-${index}`}
                          move={move}
                          index={index}
                          status={stepStatus}
                          active={index === scrambleIndex}
                        />
                      );
                    })}
                  </div>
                </div>
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

        {isSmallScreen && <PracticeMobilePanels panels={[scorePanel, dailyPanel, statsPanel]}
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
              {((stageGuidanceVisible && !(isSmallScreen && phase === "scrambling")) || isManualTimer) && (
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
<div className="stage-hint scramble-stage-hint ui-info-panel" role="status" aria-label={t("打乱公式")}>
                  <div className="ui-section-head sh-head-scramble">
                    <div className="ui-section-title-line">
                      <div className="ui-section-title">{t("打乱公式")}</div>
                      <span className="ui-section-kicker" aria-hidden="true">SCRAMBLE</span>
                    </div>
                    <div className="sh-actions">
                      {dailyTest && (
                        <div className="sh-counter">
                          <span className="sh-counter-num">{dailyTestProgress + 1}</span>
                          <span className="sh-counter-sep">/</span>
                          <span className="sh-counter-total">{DAILY_TEST_TARGET}</span>
                        </div>
                      )}
                      <button
                        className="sh-cancel"
                        onClick={refreshManualScramble}
                        disabled={manualTimerArmState !== "idle"}
                        aria-label={t("更换打乱公式")}
                      >{t("换一条")}</button>
                    </div>
                  </div>
                  <div className="sh-grid">
                    {scramble.map((move, index) => (
                      <AlgorithmStepToken
                        key={`${move}-${index}`}
                        move={move}
                        index={index}
                        status="pending"
                        active={false}
                      />
                    ))}
                  </div>
                </div>

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
          {settingsPanel}{recognitionPanel}
        </PracticeMobileDialog>
      )}
      {dailyTestResult && <DailyTestResultDialog entry={dailyTestResult} onClose={() => setDailyTestResult(null)} />}
      <AppFooter />
    </div>
  );
}
