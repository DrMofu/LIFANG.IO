"use client";

import { SettingNumber, SettingToggle } from "@/components/setting-controls";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { AlgorithmStepToken, type AlgorithmStepStatus } from "@/components/algorithm-step-token";
import { AppFooter, AppTopbar } from "@/components/app-shell";
import { useLanguage } from "@/components/language-provider";
import { useGyroPowerNotice } from "@/components/gyro-power-notice";
import { isTextEntryTarget } from "@/lib/keyboard-shortcuts";
import { useKeyboardHints } from "@/lib/use-keyboard-hints";
import { useCubeAppearance } from "@/components/cube-appearance-provider";
import { useCubeConnection } from "@/components/cube-connection-provider";
import { CubeIdleFaceletsSync } from "@/lib/cube-idle-facelets-sync";
import { getInitialCubeVisualState } from "@/lib/cube-visual-state";
import { FormulaLibraryDialog } from "@/components/formula-library-dialog";
import { FORMULAS } from "@/lib/formulas-data";
import { MoveToken } from "@/components/move-token";
import {
  expandMoveNotation,
  flushFormulaMoveAnimation,
  compressMoveSequence,
  advanceFormulaRotationSteps,
  createMoveCoordinateState,
  hintMoveForDoubleTurnProgress,
  invertMoveNotation,
  moveCanStillMatchExpected,
  movePartiallyMatchesExpectedDoubleTurn,
  movesMatchExpected,
  normalizeMoveCoordinate,
  groupAlgorithmMoves,
  parseAlgorithm,
  parseMoveNotation,
  planFormulaMoveAnimation,
  updateMoveCoordinateStateAfterMatch,
  updateMoveCoordinateStateAfterMove,
  type MoveCoordinateState,
  type FormulaMoveAnimationState,
} from "@/lib/algorithms";
import {
  CFOP_TRAINER_PHASES,
  SOLVED_FACELETS,
  createFormulaTrainerScenario,
  displayFaceletsToHardwareFacelets,
  type CfopTrainerPhase,
} from "@/lib/cfop-trainer";
import { detectCfopMilestones, detectF2lTargetEdgeSolved, isSolvedFacelets, type F2lTargetSlot } from "@/lib/cube-state";
import {
  applyMoveToFacelets,
  applyMoveToFormulaFacelets,
  applyMovesToFormulaFacelets,
} from "@/lib/facelets-pattern";
import { fmtShort, fmtTime } from "@/lib/format";
import { TurnCounter, calculateTps, formatTps } from "@/lib/tps";
import { TurnSpeed } from "@/components/turn-speed";
import { getArchiveScopedStorageKey } from "@/lib/solve-history";
import { useClientReady } from "@/lib/client-ready";
import { CUBE_CAMERA_PRESETS } from "@/lib/cube-camera-presets";
import { createTurnRecognitionSequence } from "@/lib/turn-recognition-trainer";
import {
  type CubeQuaternion,
  type CubeDisplayState,
  type SmartCubeApi,
  mountSmartCube,
} from "@/lib/smart-cube";

type TrainerState = "idle" | "loading" | "observe" | "solving" | "cancelled" | "ended" | "done" | "error";
type FormulaHintStepStatus = "pending" | "partial" | "correct";
type TrainerSpecialty = CfopTrainerPhase | "turn-recognition";

const TRAINER_SPECIALTIES: Array<{
  key: TrainerSpecialty;
  name: string;
}> = [
  ...CFOP_TRAINER_PHASES.map((phase) => ({
    key: phase.key,
    name: `${phase.label}专项`,
  })),
  { key: "turn-recognition", name: "转动专项" },
];

const TRAINER_MOVE_ANIMATION_MS = 100;
const DISPLAY_STATE_EPSILON = 0.001;
const DEFAULT_TRAINER_SESSION_ROUNDS = 20;
const MIN_TRAINER_SESSION_ROUNDS = 1;
const MAX_TRAINER_SESSION_ROUNDS = 100;
const PRACTICE_GYRO_DISABLED_KEY = "cube-practice-gyro-disabled";
const F2L_FOCUS_MODE_KEY = "cfop-trainer-f2l-focus-mode";
const TRAINER_SELECTED_PHASE_KEY = "cfop-trainer-selected-phase";
const TRAINER_SESSION_ROUNDS_KEY = "cfop-trainer-session-rounds-v2";
const LEGACY_TRAINER_SESSION_ROUNDS_KEY = "cfop-trainer-session-rounds";
const TRAINER_ROTATION_VARIANTS_KEY = "cfop-trainer-rotation-variants";
function trainerLibraryKey(phase: CfopTrainerPhase) {
  return `cfop-trainer-${phase}-library-v1`;
}

function readStoredFormulaCases(phase: CfopTrainerPhase): string[] {
  const allCaseIds = FORMULAS[phase].items.map((item) => item.id);
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(trainerLibraryKey(phase))) || "null");
    if (Array.isArray(stored)) {
      const valid = allCaseIds.filter((id) => stored.includes(id));
      if (valid.length) return valid;
    }
  } catch {
    // Use the full library when storage is unavailable or invalid.
  }
  return allCaseIds;
}

const TRAINER_FORMULA_HINT_KEY = "cfop-trainer-formula-hint";
const TRAINER_ROTATION_ARROW_KEY = "cfop-trainer-rotation-arrow";
const TRAINER_F2L_EDGE_ONLY_KEY = "cfop-trainer-f2l-edge-only";
const TRAINER_RECOGNITION_SLICES_KEY = "cfop-trainer-recognition-slices";
const TRAINER_RECOGNITION_WIDE_KEY = "cfop-trainer-recognition-wide";
const TRAINER_RECOGNITION_HINT_KEY = "cfop-trainer-recognition-hint";
const TRAINER_CUBE_CAMERA_PRESET = CUBE_CAMERA_PRESETS.trainer;
const F2L_FOCUS_SOLVED_FACELETS = [
  "XXXXXXXXX",
  "XXXRRRRRR",
  "XXXFFFFFF",
  "DDDDDDDDD",
  "XXXLLLLLL",
  "XXXBBBBBB",
].join("");
const OLL_FOCUS_SOLVED_FACELETS = [
  "UUUUUUUUU",
  "XXXXXXXXX",
  "XXXXXXXXX",
  "XXXXXXXXX",
  "XXXXXXXXX",
  "XXXXXXXXX",
].join("");

type TrainerRoundResult = {
  observeMs: number;
  solveMs: number;
  moves: number;
  dnf: boolean;
};

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

function readF2lFocusModeEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(F2L_FOCUS_MODE_KEY)) || "false") === true;
  } catch {
    return false;
  }
}

function saveF2lFocusModeEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(F2L_FOCUS_MODE_KEY), JSON.stringify(enabled));
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

function readStoredTrainerPhase() {
  if (typeof window === "undefined") return "f2l" as TrainerSpecialty;
  try {
    const stored = window.localStorage.getItem(getArchiveScopedStorageKey(TRAINER_SELECTED_PHASE_KEY));
    return TRAINER_SPECIALTIES.some((phase) => phase.key === stored)
      ? stored as TrainerSpecialty
      : "f2l";
  } catch {
    return "f2l";
  }
}

function saveStoredTrainerPhase(phase: TrainerSpecialty) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(TRAINER_SELECTED_PHASE_KEY), phase);
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

function isFormulaTrainerPhase(phase: TrainerSpecialty): phase is CfopTrainerPhase {
  return phase === "f2l" || phase === "oll" || phase === "pll";
}

function readStoredTrainerBoolean(key: string) {
  if (typeof window === "undefined") return false;
  try {
    return JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(key)) || "false") === true;
  } catch {
    return false;
  }
}

function saveStoredTrainerBoolean(key: string, enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(key), JSON.stringify(enabled));
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

function normalizeTrainerSessionRounds(value: number) {
  return Math.min(MAX_TRAINER_SESSION_ROUNDS, Math.max(MIN_TRAINER_SESSION_ROUNDS, Math.round(value)));
}

function readStoredTrainerSessionRounds() {
  if (typeof window === "undefined") return DEFAULT_TRAINER_SESSION_ROUNDS;
  try {
    const current = window.localStorage.getItem(getArchiveScopedStorageKey(TRAINER_SESSION_ROUNDS_KEY));
    const stored = Number.parseInt(
      current ?? window.localStorage.getItem(getArchiveScopedStorageKey(LEGACY_TRAINER_SESSION_ROUNDS_KEY)) ?? "",
      10,
    );
    // Migrate the previous default while allowing newly saved custom values of 10.
    if (current === null && stored === 10) return DEFAULT_TRAINER_SESSION_ROUNDS;
    return Number.isFinite(stored) ? normalizeTrainerSessionRounds(stored) : DEFAULT_TRAINER_SESSION_ROUNDS;
  } catch {
    return DEFAULT_TRAINER_SESSION_ROUNDS;
  }
}

function saveStoredTrainerSessionRounds(rounds: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getArchiveScopedStorageKey(TRAINER_SESSION_ROUNDS_KEY),
      String(normalizeTrainerSessionRounds(rounds)),
    );
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

function f2lTargetSlotForRotation(rotation: number): F2lTargetSlot {
  if (rotation === 1) return "br";
  if (rotation === 2) return "bl";
  if (rotation === 3) return "fl";
  return "fr";
}

function phaseComplete(
  phase: CfopTrainerPhase,
  facelets: string,
  options: { f2lEdgeOnly?: boolean; f2lRotation?: number } = {},
) {
  const milestones = detectCfopMilestones(facelets);
  if (phase === "f2l") {
    return options.f2lEdgeOnly
      ? detectF2lTargetEdgeSolved(facelets, f2lTargetSlotForRotation(options.f2lRotation ?? 0))
      : milestones.f2l;
  }
  if (phase === "oll") return milestones.oll;
  return milestones.pll || isSolvedFacelets(facelets);
}

function canUseFocusModeForPhase(phase: CfopTrainerPhase) {
  return phase === "f2l" || phase === "oll";
}

function focusSolvedFaceletsForPhase(phase: CfopTrainerPhase) {
  if (phase === "f2l") return F2L_FOCUS_SOLVED_FACELETS;
  if (phase === "oll") return OLL_FOCUS_SOLVED_FACELETS;
  return null;
}

function isDefaultDisplayState(state: CubeDisplayState) {
  const defaultState = TRAINER_CUBE_CAMERA_PRESET.displayState;
  return (
    Math.abs(state.cameraDistance - defaultState.cameraDistance) <= DISPLAY_STATE_EPSILON &&
    Math.abs(state.cameraLatitude - defaultState.cameraLatitude) <= DISPLAY_STATE_EPSILON &&
    Math.abs(state.cameraLongitude - defaultState.cameraLongitude) <= DISPLAY_STATE_EPSILON
  );
}

function normalizeMove(move: string) {
  return parseMoveNotation(move)?.notation ?? move;
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
  return compressUndoMoveSequence(moves.map(invertMoveNotation));
}

function appendUndoStackMoves(undoStack: string[], moves: string[]) {
  return compressUndoMoveSequence([...undoStack, ...moves.map(invertMoveNotation)]);
}

function getRemainingUndoStack(undoStack: string[], pendingMoves: string[]) {
  const expectedUndo = undoStack[undoStack.length - 1];
  if (!expectedUndo || pendingMoves.length === 0) return undoStack;
  const remainingTop = compressUndoMoveSequence([...pendingMoves.toReversed().map(invertMoveNotation), expectedUndo]);
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

function freshFormulaHintStatus(moves: string[]) {
  return moves.map(() => "pending" as FormulaHintStepStatus);
}

function averageTime(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function CfopTrainerClient() {
  const { t } = useLanguage();
  const showKeyboardHints = useKeyboardHints();
  const cubeMountRef = useRef<HTMLDivElement | null>(null);
  const cubeApiRef = useRef<SmartCubeApi | null>(null);
  const stateRef = useRef<TrainerState>("idle");
  const selectedPhaseRef = useRef<TrainerSpecialty>(readStoredTrainerPhase());
  const scenarioRotationRef = useRef(0);
  const currentFaceletsRef = useRef(SOLVED_FACELETS);
  const focusFaceletsRef = useRef<string | null>(null);
  const f2lFocusModeRef = useRef(readF2lFocusModeEnabled());
  const observeStartRef = useRef(0);
  const solveStartRef = useRef(0);
  const solveMoveCountRef = useRef(0);
  const turnCounterRef = useRef(new TurnCounter());
  const formulaHintMovesRef = useRef<string[]>([]);
  const formulaHintIndexRef = useRef(0);
  const formulaHintPendingMovesRef = useRef<string[]>([]);
  const formulaHintUndoStackRef = useRef<string[]>([]);
  const formulaHintPendingUndoMovesRef = useRef<string[]>([]);
  const formulaHintCoordinateRef = useRef<MoveCoordinateState>(createMoveCoordinateState());
  const formulaHintAnimationRef = useRef<FormulaMoveAnimationState>({ animatedCount: 0, animatedPartialMove: null });
  const formulaHintUndoAnimationRef = useRef<FormulaMoveAnimationState>({ animatedCount: 0, animatedPartialMove: null });
  const gyroDisabledRef = useRef(loadPracticeGyroDisabled());
  const visualPendingMoveRef = useRef<string | null>(null);
  const visualPendingTimerRef = useRef<number | null>(null);
  const autoNextTimerRef = useRef<number | null>(null);
  const moveQueueRef = useRef(Promise.resolve());
  const mountedRef = useRef(false);
  const runIdRef = useRef(0);
  const sessionResultsRef = useRef<TrainerRoundResult[]>([]);
  const recognitionExpectedMoveRef = useRef<string | null>(null);
  const recognitionPendingMovesRef = useRef<string[]>([]);
  const recognitionCoordinateRef = useRef<MoveCoordinateState>(createMoveCoordinateState());
  const recognitionPromptStartRef = useRef(0);
  const recognitionCorrectRef = useRef(0);
  const recognitionWrongRef = useRef(0);
  const recognitionResponseTotalRef = useRef(0);
  const recognitionMovesRef = useRef<string[]>([]);
  const recognitionStatusesRef = useRef<AlgorithmStepStatus[]>([]);
  const recognitionIndexRef = useRef(0);

  const [selectedPhase, setSelectedPhase] = useState<TrainerSpecialty>(readStoredTrainerPhase);
  const [state, setState] = useState<TrainerState>("idle");
  const [trainerError, setTrainerError] = useState<string | null>(null);
  const [observeMs, setObserveMs] = useState(0);
  const [solveMs, setSolveMs] = useState(0);
  const [timerKind, setTimerKind] = useState<"observe" | "solve">("solve");
  const [sessionResults, setSessionResults] = useState<TrainerRoundResult[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState(() => ({
    f2l: readStoredFormulaCases("f2l"),
    oll: readStoredFormulaCases("oll"),
    pll: readStoredFormulaCases("pll"),
  }));
  const [formulaLibraryOpen, setFormulaLibraryOpen] = useState(false);
  const [formulaRotationVariants, setFormulaRotationVariants] = useState(() => readStoredTrainerBoolean(TRAINER_ROTATION_VARIANTS_KEY));
  const [formulaHintEnabled, setFormulaHintEnabled] = useState(() => readStoredTrainerBoolean(TRAINER_FORMULA_HINT_KEY));
  const [formulaArrowEnabled, setFormulaArrowEnabled] = useState(() => readStoredTrainerBoolean(TRAINER_ROTATION_ARROW_KEY));
  const [f2lEdgeOnly, setF2lEdgeOnly] = useState(() => readStoredTrainerBoolean(TRAINER_F2L_EDGE_ONLY_KEY));
  const formulaHintEnabledRef = useRef(formulaHintEnabled);
  const formulaArrowEnabledRef = useRef(formulaArrowEnabled);
  const f2lEdgeOnlyRef = useRef(f2lEdgeOnly);
  const [formulaHintMoves, setFormulaHintMoves] = useState<string[]>([]);
  const [formulaHintRows, setFormulaHintRows] = useState<ReturnType<typeof groupAlgorithmMoves>>([]);
  const [formulaHintIndex, setFormulaHintIndex] = useState(0);
  const [formulaHintStatus, setFormulaHintStatus] = useState<FormulaHintStepStatus[]>([]);
  const [formulaHintWrong, setFormulaHintWrong] = useState(false);
  const [formulaHintUndoDisplay, setFormulaHintUndoDisplay] = useState<string[]>([]);
  const [f2lFocusMode, setF2lFocusMode] = useState(readF2lFocusModeEnabled);
  const [gyroDisabled, setGyroDisabled] = useState(loadPracticeGyroDisabled);
  const { notifyGyroEnabled } = useGyroPowerNotice();
  const [sessionRoundLimit, setSessionRoundLimit] = useState(readStoredTrainerSessionRounds);
  const [sessionInProgress, setSessionInProgress] = useState(false);
  const [viewResetEnabled, setViewResetEnabled] = useState(false);
  const [recognitionIncludeSlices, setRecognitionIncludeSlices] = useState(() => readStoredTrainerBoolean(TRAINER_RECOGNITION_SLICES_KEY));
  const [recognitionIncludeWideMoves, setRecognitionIncludeWideMoves] = useState(() => readStoredTrainerBoolean(TRAINER_RECOGNITION_WIDE_KEY));
  const [recognitionHintEnabled, setRecognitionHintEnabled] = useState(() => readStoredTrainerBoolean(TRAINER_RECOGNITION_HINT_KEY));
  const [recognitionExpectedMove, setRecognitionExpectedMove] = useState<string | null>(null);
  const [recognitionMoves, setRecognitionMoves] = useState<string[]>([]);
  const [recognitionStatuses, setRecognitionStatuses] = useState<AlgorithmStepStatus[]>([]);
  const [recognitionIndex, setRecognitionIndex] = useState(0);
  const [recognitionCorrect, setRecognitionCorrect] = useState(0);
  const [recognitionWrong, setRecognitionWrong] = useState(0);
  const [recognitionAverageResponseMs, setRecognitionAverageResponseMs] = useState<number | null>(null);

  const { connectionState, connectRealCube, facelets, visualState, getLatestGyro, subscribeMove, subscribeGyro, subscribeFacelets } = useCubeConnection();
  const realCubeStateRef = useRef({ facelets, visualState });
  const idleFaceletsSyncRef = useRef(new CubeIdleFaceletsSync());
  useEffect(() => {
    realCubeStateRef.current = { facelets, visualState };
  }, [facelets, visualState]);
  const { orientation, faceColors, renderMaxFps, backFaceProjectionEnabled, backFaceProjectionDistance } = useCubeAppearance();
  const connected = connectionState === "connected";
  const connecting = connectionState === "connecting";
  const isRecognitionSpecialty = selectedPhase === "turn-recognition";
  const recognitionSequenceVisible = isRecognitionSpecialty && state === "solving" && recognitionMoves.length > 0;
  const canResetDisplayOrientation = viewResetEnabled || !gyroDisabled;
  const timerDisplayMs = timerKind === "observe" ? observeMs : solveMs;
  const canUseFocusMode = isFormulaTrainerPhase(selectedPhase) && canUseFocusModeForPhase(selectedPhase);
  const formulaHintVisible = formulaHintEnabled && formulaHintMoves.length > 0;
  const formulaHintCounter = formulaHintMoves.length > 0 ? Math.min(formulaHintIndex + 1, formulaHintMoves.length) : 0;
  const sessionRoundCount = sessionResults.length;
  const recognitionAttemptCount = recognitionCorrect + recognitionWrong;
  const recognitionAccuracy = recognitionAttemptCount > 0
    ? Math.round((recognitionCorrect / recognitionAttemptCount) * 100)
    : 0;
  const sessionDnfCount = sessionResults.filter((entry) => entry.dnf).length;
  const sessionSuccessRate = sessionRoundCount > 0
    ? Math.round(((sessionRoundCount - sessionDnfCount) / sessionRoundCount) * 100)
    : null;
  const roundInProgress = state === "loading" || state === "observe" || state === "solving";
  const autoNextPending = !isRecognitionSpecialty && sessionInProgress && state === "done" && connected && sessionRoundCount > 0 && sessionRoundCount < sessionRoundLimit;
  const settingsLocked = sessionInProgress;
  const sessionAverageObserveMs = useMemo(
    () => averageTime(sessionResults.filter((entry) => !entry.dnf).map((entry) => entry.observeMs)),
    [sessionResults],
  );
  const sessionAverageSolveMs = useMemo(
    () => averageTime(sessionResults.filter((entry) => !entry.dnf).map((entry) => entry.solveMs)),
    [sessionResults],
  );

  const validTpsResults = sessionResults.filter((entry) => !entry.dnf && calculateTps(entry.moves, entry.solveMs) !== null);
  const sessionTps = validTpsResults.length > 0
    ? calculateTps(validTpsResults.reduce((sum, entry) => sum + entry.moves, 0), validTpsResults.reduce((sum, entry) => sum + entry.solveMs, 0))
    : null;

  const updateTrainerState = useCallback((next: TrainerState) => {
    if (next !== "error") setTrainerError(null);
    stateRef.current = next;
    setState(next);
  }, []);

  const renderFacelets = useCallback(
    (displayFacelets: string) => displayFaceletsToHardwareFacelets(displayFacelets, orientation),
    [orientation],
  );

  const renderTrainerCubeFacelets = useCallback(
    (displayFacelets: string) => {
      const cube = cubeApiRef.current;
      if (!cube) return;
      if (selectedPhaseRef.current === "turn-recognition") {
        const snapshot = realCubeStateRef.current;
        const initialState = getInitialCubeVisualState(snapshot.visualState, snapshot.facelets);
        if (initialState.facelets) {
          cube.setFacelets(initialState.facelets);
          initialState.moves.forEach(({ layer, dir }) => cube.applyMove(layer, dir, 0));
        }
        return;
      }
      if (
        isFormulaTrainerPhase(selectedPhaseRef.current) &&
        canUseFocusModeForPhase(selectedPhaseRef.current) &&
        f2lFocusModeRef.current
      ) {
        cube.setFormulaFacelets(focusFaceletsRef.current ?? focusSolvedFaceletsForPhase(selectedPhaseRef.current) ?? F2L_FOCUS_SOLVED_FACELETS);
        return;
      }
      cube.setFacelets(renderFacelets(displayFacelets));
    },
    [renderFacelets],
  );


  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    selectedPhaseRef.current = selectedPhase;
  }, [selectedPhase]);

  useEffect(() => {
    if (state !== "observe" && state !== "solving") return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (stateRef.current === "observe") setObserveMs(Math.max(0, now - observeStartRef.current));
      if (stateRef.current === "solving") setSolveMs(Math.max(0, now - solveStartRef.current));
    }, 33);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    const mount = cubeMountRef.current;
    if (!mount) return;
    setViewResetEnabled(false);
    const initialGyroQuaternion = loadPracticeGyroDisabled() ? null : getLatestGyro();
    const snapshot = realCubeStateRef.current;
    const initialState = selectedPhaseRef.current === "turn-recognition"
      ? getInitialCubeVisualState(snapshot.visualState, snapshot.facelets)
      : null;
    if (initialState) {
      idleFaceletsSyncRef.current.reset();
      if (visualPendingTimerRef.current !== null) window.clearTimeout(visualPendingTimerRef.current);
      visualPendingTimerRef.current = null;
      visualPendingMoveRef.current = null;
    }
    const api = mountSmartCube(mount, {
      orientation,
      faceColors,
      maxFps: renderMaxFps,
      compactGestureRegion: true,
      showBackFaceProjection: backFaceProjectionEnabled,
      backFaceProjectionDistance,
      cameraDistanceRange: TRAINER_CUBE_CAMERA_PRESET.distanceRange,
      compensateInitialGyroOffset: false,
      defaultDisplayState: TRAINER_CUBE_CAMERA_PRESET.displayState,
      sceneOffset: TRAINER_CUBE_CAMERA_PRESET.sceneOffset,
      initialGyroQuaternion,
      initialFacelets: initialState?.facelets,
      initialMoves: initialState?.moves,
      onDisplayOrientationChange: () => setViewResetEnabled(true),
    });
    cubeApiRef.current = api;
    if (!initialState) renderTrainerCubeFacelets(currentFaceletsRef.current);
    return () => {
      api.dispose();
      if (cubeApiRef.current === api) cubeApiRef.current = null;
    };
  }, [backFaceProjectionDistance, backFaceProjectionEnabled, faceColors, getLatestGyro, orientation, renderMaxFps, renderTrainerCubeFacelets]);

  useEffect(() => {
    cubeApiRef.current?.setBackFaceProjectionDistance(backFaceProjectionDistance);
  }, [backFaceProjectionDistance]);

  const resetDisplayOrientation = useCallback(() => {
    cubeApiRef.current?.resetDisplayOrientation();
    const displayState = cubeApiRef.current?.getDisplayState();
    setViewResetEnabled(displayState ? !isDefaultDisplayState(displayState) : false);
  }, []);

  const applyGyroOrientation = useCallback((quaternion: CubeQuaternion) => {
    if (gyroDisabledRef.current) return;
    cubeApiRef.current?.setGyroOrientation(quaternion);
  }, []);

  useEffect(() => {
    if (gyroDisabled) return;
    return subscribeGyro(applyGyroOrientation);
  }, [applyGyroOrientation, subscribeGyro, gyroDisabled]);

  const resetSessionResults = useCallback(() => {
    sessionResultsRef.current = [];
    setSessionResults([]);
  }, []);

  const resetRecognitionResults = useCallback(() => {
    recognitionExpectedMoveRef.current = null;
    recognitionPendingMovesRef.current = [];
    recognitionCoordinateRef.current = createMoveCoordinateState();
    recognitionPromptStartRef.current = 0;
    recognitionCorrectRef.current = 0;
    recognitionWrongRef.current = 0;
    recognitionResponseTotalRef.current = 0;
    recognitionMovesRef.current = [];
    recognitionStatusesRef.current = [];
    recognitionIndexRef.current = 0;
    setRecognitionExpectedMove(null);
    setRecognitionMoves([]);
    setRecognitionStatuses([]);
    setRecognitionIndex(0);
    setRecognitionCorrect(0);
    setRecognitionWrong(0);
    setRecognitionAverageResponseMs(null);
  }, []);

  const animateCubeMoves = useCallback((moves: string[], durationMs = TRAINER_MOVE_ANIMATION_MS) => {
    moves.forEach((move) => {
      cubeApiRef.current?.applyMoves(expandMoveNotation(move), durationMs);
    });
  }, []);

  const clearVisualPendingTimer = useCallback(() => {
    if (visualPendingTimerRef.current === null) return;
    window.clearTimeout(visualPendingTimerRef.current);
    visualPendingTimerRef.current = null;
  }, []);

  const clearAutoNextTimer = useCallback(() => {
    if (autoNextTimerRef.current !== null) {
      window.clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearVisualPendingTimer();
      clearAutoNextTimer();
    };
  }, [clearAutoNextTimer, clearVisualPendingTimer]);

  const flushVisualPendingMove = useCallback(() => {
    const pending = visualPendingMoveRef.current;
    clearVisualPendingTimer();
    visualPendingMoveRef.current = null;
    if (pending) animateCubeMoves([pending]);
  }, [animateCubeMoves, clearVisualPendingTimer]);

  const queueVisualMove = useCallback(
    (move: string) => {
      const pending = visualPendingMoveRef.current;
      if (!pending) {
        visualPendingMoveRef.current = move;
        clearVisualPendingTimer();
        visualPendingTimerRef.current = window.setTimeout(flushVisualPendingMove, 45);
        return;
      }

      clearVisualPendingTimer();
      animateCubeMoves([pending]);
      visualPendingMoveRef.current = move;
      visualPendingTimerRef.current = window.setTimeout(flushVisualPendingMove, 45);
    },
    [animateCubeMoves, clearVisualPendingTimer, flushVisualPendingMove],
  );

  useEffect(() => {
    const sync = idleFaceletsSyncRef.current;
    sync.reset();
    if (!connected || !isRecognitionSpecialty) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      if (selectedPhaseRef.current !== "turn-recognition") return;
      const cube = cubeApiRef.current;
      if (!cube) return;
      const busy = visualPendingMoveRef.current !== null || cube.isAnimating();
      if (sync.flush(busy, (nextFacelets) => cube.setFacelets(nextFacelets))) {
        timer = setTimeout(flush, 50);
      }
    };
    const unsubscribe = subscribeFacelets((nextFacelets, signal) => {
      if (!signal || selectedPhaseRef.current !== "turn-recognition") return;
      sync.receive(nextFacelets, signal.serial);
      if (timer === null) flush();
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
      sync.reset();
    };
  }, [connected, isRecognitionSpecialty, subscribeFacelets]);

  const resetFormulaHint = useCallback((source = "") => {
    const rows = groupAlgorithmMoves(source);
    const moves = parseAlgorithm(source);
    setFormulaHintRows(rows);
    formulaHintMovesRef.current = moves;
    formulaHintPendingMovesRef.current = [];
    formulaHintUndoStackRef.current = [];
    formulaHintPendingUndoMovesRef.current = [];
    formulaHintCoordinateRef.current = createMoveCoordinateState();
    formulaHintAnimationRef.current = { animatedCount: 0, animatedPartialMove: null };
    formulaHintUndoAnimationRef.current = { animatedCount: 0, animatedPartialMove: null };
    const advanced = advanceFormulaRotationSteps(
      moves, 0, formulaHintCoordinateRef.current,
    );
    const nextIndex = formulaHintEnabledRef.current ? advanced.nextIndex : 0;
    if (formulaHintEnabledRef.current) {
      animateCubeMoves(advanced.rotations, 0);
      formulaHintCoordinateRef.current = advanced.coordinate;
    }
    formulaHintIndexRef.current = nextIndex;
    setFormulaHintMoves(moves);
    setFormulaHintIndex(nextIndex);
    setFormulaHintStatus(freshFormulaHintStatus(moves).map((status, index) => index < nextIndex ? "correct" : status));
    setFormulaHintWrong(false);
    setFormulaHintUndoDisplay([]);
  }, [animateCubeMoves]);

  const updateFormulaHintMove = useCallback((move: string) => {
    const moves = formulaHintMovesRef.current;
    const actual = normalizeMoveCoordinate(normalizeMove(move), formulaHintCoordinateRef.current);
    const undoStack = formulaHintUndoStackRef.current;

    if (undoStack.length > 0) {
      const expectedUndo = undoStack[undoStack.length - 1];
      formulaHintPendingUndoMovesRef.current = [...formulaHintPendingUndoMovesRef.current, actual];
      const animation = planFormulaMoveAnimation(formulaHintPendingUndoMovesRef.current, expectedUndo, formulaHintUndoAnimationRef.current);
      animateCubeMoves(animation.moves);
      formulaHintUndoAnimationRef.current = animation;
      if (movesMatchExpected(formulaHintPendingUndoMovesRef.current, expectedUndo)) {
        formulaHintCoordinateRef.current = updateMoveCoordinateStateAfterMatch(
          formulaHintCoordinateRef.current, formulaHintPendingUndoMovesRef.current, expectedUndo,
        );
        formulaHintPendingUndoMovesRef.current = [];
        formulaHintUndoStackRef.current = undoStack.slice(0, -1);
        setFormulaHintUndoDisplay(formulaHintUndoStackRef.current);
        if (formulaHintUndoStackRef.current.length === 0) setFormulaHintWrong(false);
      } else if (moveCanStillMatchExpected(formulaHintPendingUndoMovesRef.current, expectedUndo)) {
        const remainingUndoStack = getRemainingUndoStack(undoStack, formulaHintPendingUndoMovesRef.current);
        setFormulaHintUndoDisplay(remainingUndoStack);
      } else {
        const pendingUndo = formulaHintPendingUndoMovesRef.current;
        formulaHintPendingUndoMovesRef.current = [];
        formulaHintUndoStackRef.current = appendUndoStackMoves(undoStack, pendingUndo);
        setFormulaHintUndoDisplay(formulaHintUndoStackRef.current);
        if (formulaHintUndoStackRef.current.length === 0) setFormulaHintWrong(false);
      }
      return;
    }

    const currentIndex = formulaHintIndexRef.current;
    const expected = moves[currentIndex];
    if (!expected) {
      animateCubeMoves([actual]);
      return;
    }
    formulaHintPendingMovesRef.current = [...formulaHintPendingMovesRef.current, actual];
    const previousAnimation = formulaHintAnimationRef.current;
    const animation = planFormulaMoveAnimation(formulaHintPendingMovesRef.current, expected, previousAnimation);
    // Undo instructions use the last confirmed frame, including after a half turn.
    animateCubeMoves(animation.match === "wrong"
      ? flushFormulaMoveAnimation(formulaHintPendingMovesRef.current, previousAnimation)
      : animation.moves);
    formulaHintAnimationRef.current = animation;
    if (movesMatchExpected(formulaHintPendingMovesRef.current, expected)) {
      formulaHintCoordinateRef.current = updateMoveCoordinateStateAfterMatch(
        formulaHintCoordinateRef.current,
        formulaHintPendingMovesRef.current,
        expected,
      );
      const advanced = advanceFormulaRotationSteps(moves, currentIndex + 1, formulaHintCoordinateRef.current);
      animateCubeMoves(advanced.rotations);
      formulaHintCoordinateRef.current = advanced.coordinate;
      const nextIndex = advanced.nextIndex;
      formulaHintPendingMovesRef.current = [];
      setFormulaHintStatus((prev) => prev.map((status, index) => (index >= currentIndex && index < nextIndex ? "correct" : status)));
      setFormulaHintWrong(false);
      formulaHintIndexRef.current = nextIndex;
      setFormulaHintIndex(nextIndex);
    } else if (moveCanStillMatchExpected(formulaHintPendingMovesRef.current, expected)) {
      setFormulaHintWrong(false);
      setFormulaHintStatus((prev) => prev.map((status, index) => (
        index === currentIndex
          ? movePartiallyMatchesExpectedDoubleTurn(formulaHintPendingMovesRef.current, expected)
            ? "partial"
            : "pending"
          : status
      )));
    } else {
      const pendingWrong = formulaHintPendingMovesRef.current;
      const { retainedMoves, wrongMoves } = splitInvalidPendingMoves(pendingWrong, expected);
      formulaHintPendingMovesRef.current = retainedMoves;
      formulaHintAnimationRef.current = { animatedCount: retainedMoves.length, animatedPartialMove: null };
      formulaHintPendingUndoMovesRef.current = [];
      formulaHintUndoAnimationRef.current = { animatedCount: 0, animatedPartialMove: null };
      setFormulaHintWrong(true);
      setFormulaHintStatus((prev) => prev.map((status, index) => (
        index === currentIndex
          ? movePartiallyMatchesExpectedDoubleTurn(retainedMoves, expected)
            ? "partial"
            : "pending"
          : status
      )));
      formulaHintUndoStackRef.current = buildUndoStack(wrongMoves);
      setFormulaHintUndoDisplay(formulaHintUndoStackRef.current);
      if (formulaHintUndoStackRef.current.length === 0) setFormulaHintWrong(false);
    }
  }, [animateCubeMoves]);

  const getFormulaHintMove = useCallback(() => {
    if (!formulaHintEnabled || !formulaArrowEnabled) return null;
    const undoNext = formulaHintUndoStackRef.current[formulaHintUndoStackRef.current.length - 1];
    if (undoNext) return hintMoveForDoubleTurnProgress(formulaHintPendingUndoMovesRef.current, undoNext);
    const expected = formulaHintMovesRef.current[formulaHintIndexRef.current];
    return expected ? hintMoveForDoubleTurnProgress(formulaHintPendingMovesRef.current, expected) : null;
  }, [formulaArrowEnabled, formulaHintEnabled]);

  useEffect(() => {
    cubeApiRef.current?.setHintMove(
      isRecognitionSpecialty
        ? recognitionHintEnabled ? recognitionExpectedMove : null
        : state === "observe" || state === "solving" ? getFormulaHintMove() : null,
    );
  }, [getFormulaHintMove, formulaHintIndex, formulaHintMoves, formulaHintStatus, formulaHintUndoDisplay, isRecognitionSpecialty, recognitionExpectedMove, recognitionHintEnabled, state]);

  const resetRun = useCallback(() => {
    runIdRef.current += 1;
    idleFaceletsSyncRef.current.reset();
    clearAutoNextTimer();
    resetSessionResults();
    clearVisualPendingTimer();
    visualPendingMoveRef.current = null;
    scenarioRotationRef.current = 0;
    currentFaceletsRef.current = SOLVED_FACELETS;
    focusFaceletsRef.current = isFormulaTrainerPhase(selectedPhaseRef.current)
      ? focusSolvedFaceletsForPhase(selectedPhaseRef.current)
      : null;
    solveMoveCountRef.current = 0;
    turnCounterRef.current.reset();
    setObserveMs(0);
    setSolveMs(0);
    setTimerKind("solve");
    resetFormulaHint();
    resetRecognitionResults();
    updateTrainerState("idle");
    renderTrainerCubeFacelets(SOLVED_FACELETS);
  }, [clearAutoNextTimer, clearVisualPendingTimer, renderTrainerCubeFacelets, resetFormulaHint, resetRecognitionResults, resetSessionResults, updateTrainerState]);

  const cancelRun = useCallback(() => {
    runIdRef.current += 1;
    clearAutoNextTimer();
    resetSessionResults();
    flushVisualPendingMove();
    const now = performance.now();
    if (stateRef.current === "observe") {
      setObserveMs(Math.max(0, now - observeStartRef.current));
    }
    if (stateRef.current === "solving") {
      setSolveMs(Math.max(0, now - solveStartRef.current));
    }
    recognitionExpectedMoveRef.current = null;
    recognitionPendingMovesRef.current = [];
    setRecognitionExpectedMove(null);
    updateTrainerState("cancelled");
    setSessionInProgress(false);
  }, [clearAutoNextTimer, flushVisualPendingMove, resetSessionResults, updateTrainerState]);

  const handleDisconnect = useEffectEvent(() => {
    if (sessionInProgress) {
      cancelRun();
    }
  });
  useEffect(() => {
    if (connected) return;
    const timer = window.setTimeout(() => handleDisconnect(), 0);
    return () => window.clearTimeout(timer);
  }, [connected]);

  const completeRound = useCallback((result: TrainerRoundResult, facelets = currentFaceletsRef.current) => {
    const phase = selectedPhaseRef.current;
    if (!isFormulaTrainerPhase(phase)) return;
    const nextResults = [...sessionResultsRef.current, result];
    currentFaceletsRef.current = facelets;
    sessionResultsRef.current = nextResults;
    setSessionResults(nextResults);
    setSolveMs(result.solveMs);
    setObserveMs(result.observeMs);
    updateTrainerState("done");
    if (nextResults.length >= sessionRoundLimit) {
      setSessionInProgress(false);
    }
  }, [sessionRoundLimit, updateTrainerState]);

  const endTraining = useCallback(() => {
    if (!sessionInProgress) return;
    runIdRef.current += 1;
    clearAutoNextTimer();
    flushVisualPendingMove();
    const now = performance.now();
    if (stateRef.current === "observe") setObserveMs(Math.max(0, now - observeStartRef.current));
    if (stateRef.current === "solving") setSolveMs(Math.max(0, now - solveStartRef.current));
    updateTrainerState("ended");
    setSessionInProgress(false);
  }, [clearAutoNextTimer, flushVisualPendingMove, sessionInProgress, updateTrainerState]);

  const finishRun = useCallback((facelets: string) => {
    completeRound({
      observeMs: Math.max(0, solveStartRef.current - observeStartRef.current),
      solveMs: Math.max(0, performance.now() - solveStartRef.current),
      moves: stateRef.current === "solving" ? solveMoveCountRef.current : 0,
      dnf: false,
    }, facelets);
  }, [completeRound]);

  const abandonRound = useCallback(() => {
    if (!sessionInProgress || !roundInProgress) return;
    const now = performance.now();
    runIdRef.current += 1;
    clearVisualPendingTimer();
    visualPendingMoveRef.current = null;
    completeRound({
      observeMs: stateRef.current === "solving"
        ? Math.max(0, solveStartRef.current - observeStartRef.current)
        : stateRef.current === "observe"
          ? Math.max(0, now - observeStartRef.current)
          : 0,
      solveMs: stateRef.current === "solving" ? Math.max(0, now - solveStartRef.current) : 0,
      moves: stateRef.current === "solving" ? solveMoveCountRef.current : 0,
      dnf: true,
    });
  }, [clearVisualPendingTimer, completeRound, roundInProgress, sessionInProgress]);

  const recordSolveMove = useCallback((move: string) => {
    solveMoveCountRef.current = turnCounterRef.current.push(move);
  }, []);

  const processSolveMove = useCallback(
    async (move: string) => {
      const phase = selectedPhaseRef.current;
      if (!isFormulaTrainerPhase(phase)) return;
      recordSolveMove(move);
      if (formulaHintEnabledRef.current) updateFormulaHintMove(move);
      const nextFacelets = await applyMoveToFacelets(currentFaceletsRef.current, move);
      const nextFocusFacelets = focusFaceletsRef.current
        ? await applyMoveToFormulaFacelets(focusFaceletsRef.current, move)
        : null;
      if (stateRef.current !== "solving") return;
      currentFaceletsRef.current = nextFacelets;
      focusFaceletsRef.current = nextFocusFacelets;
      if (
        phaseComplete(phase, nextFacelets, {
          f2lEdgeOnly: f2lEdgeOnlyRef.current,
          f2lRotation: scenarioRotationRef.current,
        })
      ) {
        if (formulaHintEnabledRef.current) {
          const undoing = formulaHintUndoStackRef.current.length > 0;
          animateCubeMoves(flushFormulaMoveAnimation(
            undoing ? formulaHintPendingUndoMovesRef.current : formulaHintPendingMovesRef.current,
            undoing ? formulaHintUndoAnimationRef.current : formulaHintAnimationRef.current,
          ));
          setFormulaHintWrong(false);
          setFormulaHintUndoDisplay([]);
        }
        finishRun(nextFacelets);
      }
    },
    [animateCubeMoves, finishRun, recordSolveMove, updateFormulaHintMove],
  );

  const buildRecognitionMoves = useCallback((count: number, previousMove: string | null = null) => {
    return createTurnRecognitionSequence(
      {
        includeSlices: recognitionIncludeSlices,
        includeWideMoves: recognitionIncludeWideMoves,
      },
      count,
      previousMove,
    );
  }, [recognitionIncludeSlices, recognitionIncludeWideMoves]);

  const prepareRecognitionSequence = useCallback(() => {
    const moves = buildRecognitionMoves(sessionRoundLimit);
    const statuses = moves.map(() => "pending" as AlgorithmStepStatus);
    recognitionMovesRef.current = moves;
    recognitionStatusesRef.current = statuses;
    recognitionIndexRef.current = 0;
    recognitionExpectedMoveRef.current = moves[0] ?? null;
    recognitionPendingMovesRef.current = [];
    recognitionPromptStartRef.current = performance.now();
    setRecognitionMoves(moves);
    setRecognitionStatuses(statuses);
    setRecognitionIndex(0);
    setRecognitionExpectedMove(moves[0] ?? null);
  }, [buildRecognitionMoves, sessionRoundLimit]);

  const completeRecognitionPrompt = useCallback((expected: string, pendingMoves: string[], correct: boolean) => {
    const now = performance.now();
    const responseMs = Math.max(0, now - recognitionPromptStartRef.current);
    const compressedMoves = compressMoveSequence(pendingMoves);
    const nextCorrect = recognitionCorrectRef.current + (correct ? 1 : 0);
    const nextWrong = recognitionWrongRef.current + (correct ? 0 : 1);
    const nextAttemptCount = nextCorrect + nextWrong;

    recognitionCorrectRef.current = nextCorrect;
    recognitionWrongRef.current = nextWrong;
    recognitionResponseTotalRef.current += responseMs;
    if (correct) {
      recognitionCoordinateRef.current = updateMoveCoordinateStateAfterMatch(
        recognitionCoordinateRef.current,
        pendingMoves,
        expected,
      );
    } else {
      compressedMoves.forEach((move) => {
        recognitionCoordinateRef.current = updateMoveCoordinateStateAfterMove(recognitionCoordinateRef.current, move);
      });
    }

    setRecognitionCorrect(nextCorrect);
    setRecognitionWrong(nextWrong);
    setRecognitionAverageResponseMs(recognitionResponseTotalRef.current / nextAttemptCount);

    const currentIndex = recognitionIndexRef.current;
    const nextIndex = currentIndex + 1;
    const moves = recognitionMovesRef.current;
    const statuses = [...recognitionStatusesRef.current];
    statuses[currentIndex] = correct ? "correct" : "wrong";

    recognitionStatusesRef.current = statuses;
    recognitionIndexRef.current = nextIndex;
    recognitionExpectedMoveRef.current = moves[nextIndex] ?? null;
    recognitionPendingMovesRef.current = [];
    recognitionPromptStartRef.current = now;
    setRecognitionMoves(moves);
    setRecognitionStatuses(statuses);
    setRecognitionIndex(nextIndex);
    setRecognitionExpectedMove(moves[nextIndex] ?? null);
    if (nextAttemptCount >= sessionRoundLimit) {
      setSolveMs(Math.max(0, now - solveStartRef.current));
      updateTrainerState("done");
      setSessionInProgress(false);
    }
  }, [sessionRoundLimit, updateTrainerState]);

  const processRecognitionMove = useCallback((move: string) => {
    if (stateRef.current !== "solving" || selectedPhaseRef.current !== "turn-recognition") return;
    const expected = recognitionExpectedMoveRef.current;
    if (!expected) return;

    const actual = normalizeMoveCoordinate(normalizeMove(move), recognitionCoordinateRef.current);
    const pendingMoves = [...recognitionPendingMovesRef.current, actual];
    recognitionPendingMovesRef.current = pendingMoves;
    if (movesMatchExpected(pendingMoves, expected)) {
      completeRecognitionPrompt(expected, pendingMoves, true);
      return;
    }
    if (moveCanStillMatchExpected(pendingMoves, expected)) return;
    completeRecognitionPrompt(expected, pendingMoves, false);
  }, [completeRecognitionPrompt]);

  const beginSolve = useCallback(
    async (firstMove: string) => {
      const phase = selectedPhaseRef.current;
      if (!isFormulaTrainerPhase(phase)) return;
      const now = performance.now();
      solveStartRef.current = now;
      solveMoveCountRef.current = 0;
      turnCounterRef.current.reset();
      setSolveMs(0);
      setTimerKind("solve");
      updateTrainerState("solving");
      await processSolveMove(firstMove);
    },
    [processSolveMove, updateTrainerState],
  );

  const enterObserve = useCallback(() => {
    observeStartRef.current = performance.now();
    setObserveMs(0);
    setSolveMs(0);
    setTimerKind("observe");
    updateTrainerState("observe");
  }, [updateTrainerState]);

  const beginFormulaScenario = useCallback(async (phase: CfopTrainerPhase, runId: number) => {
    updateTrainerState("loading");
    try {
      const nextScenario = await createFormulaTrainerScenario(phase, { includeRotations: formulaRotationVariants, selectedCaseIds: selectedCaseIds[phase] });
      if (!mountedRef.current || runIdRef.current !== runId || selectedPhaseRef.current !== phase) return;
      const focusSolvedFacelets = focusSolvedFaceletsForPhase(phase);
      const nextFocusFacelets = focusSolvedFacelets
        ? await applyMovesToFormulaFacelets(focusSolvedFacelets, nextScenario.setupMoves)
        : null;
      if (!mountedRef.current || runIdRef.current !== runId || selectedPhaseRef.current !== phase) return;
      scenarioRotationRef.current = nextScenario.rotation;
      currentFaceletsRef.current = nextScenario.startFacelets;
      focusFaceletsRef.current = nextFocusFacelets;
      renderTrainerCubeFacelets(nextScenario.startFacelets);
      resetFormulaHint(nextScenario.sourceAlgo);
      enterObserve();
    } catch (error) {
      if (!mountedRef.current || runIdRef.current !== runId) return;
      console.error("Failed to prepare trainer round", error);
      setTrainerError("本局加载失败，请重试本局");
      updateTrainerState("error");
    }
  }, [enterObserve, formulaRotationVariants, selectedCaseIds, renderTrainerCubeFacelets, resetFormulaHint, updateTrainerState]);

  const beginTrainerRound = useCallback(async (runId: number) => {
    const phase = selectedPhaseRef.current;
    if (!isFormulaTrainerPhase(phase)) return;
    await beginFormulaScenario(phase, runId);
  }, [beginFormulaScenario]);

  const retryTrainerRound = useCallback(() => {
    if (!sessionInProgress || !connected || stateRef.current !== "error") return;
    runIdRef.current += 1;
    clearVisualPendingTimer();
    visualPendingMoveRef.current = null;
    void beginTrainerRound(runIdRef.current);
  }, [beginTrainerRound, clearVisualPendingTimer, connected, sessionInProgress]);

  const beginRecognitionTraining = useCallback(() => {
    const now = performance.now();
    solveStartRef.current = now;
    setSolveMs(0);
    setTimerKind("solve");
    updateTrainerState("solving");
    prepareRecognitionSequence();
  }, [prepareRecognitionSequence, updateTrainerState]);

  const startTraining = useCallback(async () => {
    if (sessionInProgress) {
      endTraining();
      return;
    }
    if (!connected) {
      await connectRealCube();
      return;
    }
    resetRun();
    setSessionInProgress(true);
    if (selectedPhaseRef.current === "turn-recognition") {
      beginRecognitionTraining();
      return;
    }
    await beginTrainerRound(runIdRef.current);
  }, [beginRecognitionTraining, beginTrainerRound, endTraining, connectRealCube, connected, resetRun, sessionInProgress]);

  useEffect(() => {
    if (!autoNextPending) return;
    autoNextTimerRef.current = window.setTimeout(() => {
      autoNextTimerRef.current = null;
      if (!mountedRef.current || stateRef.current !== "done") return;
      runIdRef.current += 1;
      void beginTrainerRound(runIdRef.current);
    }, 1000);
    return clearAutoNextTimer;
  }, [autoNextPending, beginTrainerRound, clearAutoNextTimer]);

  const toggleGyroDisabled = useCallback(() => {
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
  }, [notifyGyroEnabled]);

  const toggleF2lFocusMode = useCallback(() => {
    if (settingsLocked) return;
    if (!isFormulaTrainerPhase(selectedPhaseRef.current) || !canUseFocusModeForPhase(selectedPhaseRef.current)) return;
    const next = !f2lFocusModeRef.current;
    f2lFocusModeRef.current = next;
    setF2lFocusMode(next);
    if (next && !focusFaceletsRef.current) {
      focusFaceletsRef.current = focusSolvedFaceletsForPhase(selectedPhaseRef.current);
    }
    saveF2lFocusModeEnabled(next);
    renderTrainerCubeFacelets(currentFaceletsRef.current);
  }, [renderTrainerCubeFacelets, settingsLocked]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " ") return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (formulaLibraryOpen || isTextEntryTarget(event.target)) return;

      event.preventDefault();
      if (event.repeat || connecting) return;
      void startTraining();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connecting, formulaLibraryOpen, startTraining]);

  const enqueueMove = useCallback(
    (move: string) => {
      const parsed = parseMoveNotation(move);
      if (!parsed) return;
      const actual = parsed.notation;
      if (selectedPhaseRef.current === "turn-recognition") {
        queueVisualMove(actual);
        processRecognitionMove(actual);
        return;
      }

      const runId = runIdRef.current;
      moveQueueRef.current = moveQueueRef.current
        .then(async () => {
          if (runIdRef.current !== runId) return;
          const currentState = stateRef.current;
          if (selectedPhaseRef.current === "turn-recognition") return;
          if (currentState === "observe") {
            if (!formulaHintEnabledRef.current) queueVisualMove(actual);
            await beginSolve(actual);
            return;
          }
          if (currentState === "solving") {
            if (!formulaHintEnabledRef.current) queueVisualMove(actual);
            await processSolveMove(actual);
          }
        })
        .catch((error) => {
          if (!mountedRef.current || runIdRef.current !== runId) return;
          console.error("Failed to process trainer move", error);
          setTrainerError("转动处理失败，请重试本局");
          updateTrainerState("error");
        });
    },
    [beginSolve, processRecognitionMove, processSolveMove, queueVisualMove, updateTrainerState],
  );

  useEffect(() => subscribeMove((move, signal) => {
    if (selectedPhaseRef.current === "turn-recognition" && signal) {
      idleFaceletsSyncRef.current.recordMove(signal.serial);
    }
    enqueueMove(move);
  }), [enqueueMove, subscribeMove]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== "r" && key !== "l" && key !== "h") return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (formulaLibraryOpen || isTextEntryTarget(event.target)) return;
      if (
        key === "h" &&
        (!isFormulaTrainerPhase(selectedPhaseRef.current) || !canUseFocusModeForPhase(selectedPhaseRef.current))
      ) return;

      event.preventDefault();
      if (key === "h") {
        toggleF2lFocusMode();
        return;
      }
      if (key === "l") {
        toggleGyroDisabled();
        return;
      }
      if (canResetDisplayOrientation) resetDisplayOrientation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canResetDisplayOrientation, formulaLibraryOpen, resetDisplayOrientation, toggleF2lFocusMode, toggleGyroDisabled]);

  const selectPhase = (phase: TrainerSpecialty) => {
    if (settingsLocked) return;
    selectedPhaseRef.current = phase;
    saveStoredTrainerPhase(phase);
    setSelectedPhase(phase);
    resetRun();
  };

  const updateSessionRoundLimit = (value: string) => {
    if (settingsLocked) return;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    const next = normalizeTrainerSessionRounds(parsed);
    setSessionRoundLimit(next);
    saveStoredTrainerSessionRounds(next);
    resetRun();
  };

  return (
    <div className="app lf-practice-app lf-trainer-app practice-focus-app trainer-focus-app">
      <AppTopbar />
      <main className="practice-layout trainer-layout">
        <div className="practice-info">
        <section className="practice-left trainer-left">
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
                  <SettingToggle label={t("加入中层转动")} checked={recognitionIncludeSlices} disabled={settingsLocked} onChange={(next) => {
                        setRecognitionIncludeSlices(next);
                        saveStoredTrainerBoolean(TRAINER_RECOGNITION_SLICES_KEY, next);
                      }} />
                  <SettingToggle label={t("加入宽层转动")} checked={recognitionIncludeWideMoves} disabled={settingsLocked} onChange={(next) => {
                        setRecognitionIncludeWideMoves(next);
                        saveStoredTrainerBoolean(TRAINER_RECOGNITION_WIDE_KEY, next);
                      }} />
                  <SettingToggle label={t("显示旋转箭头")} checked={recognitionHintEnabled} disabled={settingsLocked} onChange={(next) => {
                        setRecognitionHintEnabled(next);
                        saveStoredTrainerBoolean(TRAINER_RECOGNITION_HINT_KEY, next);
                      }} />
                </div>
              ) : (
                <>
                  <div className="trainer-option-list">
                    {isFormulaTrainerPhase(selectedPhase) && (
                      <button type="button" className="ui-setting-row trainer-library-button" disabled={settingsLocked} onClick={() => setFormulaLibraryOpen(true)} aria-haspopup="dialog">
                        <span><b>{t("formulaLibrary.title")}</b><small>{t("formulaLibrary.selected").replace("{count}", String(selectedCaseIds[selectedPhase].length)).replace("{total}", String(FORMULAS[selectedPhase].items.length))}</small></span>
                        <span aria-hidden="true">›</span>
                      </button>
                    )}
                    {selectedPhase === "f2l" && (
                      <SettingToggle label={t("仅判定目标棱")} checked={f2lEdgeOnly} disabled={settingsLocked} onChange={(next) => {
                            f2lEdgeOnlyRef.current = next;
                            setF2lEdgeOnly(next);
                            saveStoredTrainerBoolean(TRAINER_F2L_EDGE_ONLY_KEY, next);
                          }} />
                    )}
                    <SettingToggle label={t("公式提示")} checked={formulaHintEnabled} disabled={settingsLocked} onChange={(next) => {
                          formulaHintEnabledRef.current = next;
                          setFormulaHintEnabled(next);
                          saveStoredTrainerBoolean(TRAINER_FORMULA_HINT_KEY, next);
                        }} />
                    <SettingToggle label={t("显示旋转箭头")} checked={formulaArrowEnabled} disabled={settingsLocked || !formulaHintEnabled} onChange={(next) => {
                          formulaArrowEnabledRef.current = next;
                          setFormulaArrowEnabled(next);
                          saveStoredTrainerBoolean(TRAINER_ROTATION_ARROW_KEY, next);
                        }} />
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

        </section>

        <section className="practice-right trainer-right">
          <div className="stats trainer-results-panel ui-info-panel" aria-live="polite">
            <div className="practice-card-head">
              <div className="practice-title-line">
                <div className="practice-card-title">{t("当前成绩")}</div>
                <span className="practice-kicker" aria-hidden="true">SCORE</span>
              </div>
            </div>
              {isRecognitionSpecialty ? (
                <div className="stat-grid">
                  <div className="st st-primary">
                    <div className="st-l">{t("正确")}</div>
                    <div className="st-v">{recognitionCorrect}</div>
                  </div>
                  <div className="st">
                    <div className="st-l">{t("错误")}</div>
                    <div className="st-v">{recognitionWrong}</div>
                  </div>
                  <div className="st">
                    <div className="st-l">{t("正确率")}</div>
                    <div className="st-v">{recognitionAccuracy}%</div>
                  </div>
                  <div className="st">
                    <div className="st-l">{t("平均反应")}</div>
                    <div className="st-v">{fmtShort(recognitionAverageResponseMs)}</div>
                  </div>
                </div>
              ) : (
                <div className="stat-grid">
                  <div className="st st-primary">
                    <div className="st-l">{t("平均观察")}</div>
                    <div className="st-v">{fmtShort(sessionAverageObserveMs)}</div>
                  </div>
                  <div className="st">
                    <div className="st-l">{t("平均复原")}</div>
                    <div className="st-v">{fmtShort(sessionAverageSolveMs)}</div>
                  </div>
                  <div className="st">
                    <div className="st-l">{t("平均 TPS")}</div>
                    <div className="st-v">{formatTps(sessionTps)}</div>
                  </div>
                  <div className="st">
                    <div className="st-l">{t("复原成功率")}</div>
                    <div className="st-v">{sessionSuccessRate === null ? "—" : `${sessionSuccessRate}%`}</div>
                  </div>
                  <div className="st">
                    <div className="st-l">{t("本组进度")}{sessionDnfCount > 0 ? ` · DNF ${sessionDnfCount}` : ""}</div>
                    <div className="st-v">{sessionRoundCount}/{sessionRoundLimit}</div>
                  </div>
                </div>
              )}
              {!isRecognitionSpecialty && sessionResults.length > 0 && (
                <ol className="trainer-tps-history" aria-label={t("最近记录")}>
                  {sessionResults.slice(-5).toReversed().map((entry, index) => (
                    <li key={sessionResults.length - index}>
                      <span>#{sessionResults.length - index}</span>
                      <b>{entry.dnf ? "DNF" : fmtShort(entry.solveMs)}</b>
                      <span className="hr-tps">{formatTps(entry.dnf ? null : calculateTps(entry.moves, entry.solveMs))} <small>TPS</small></span>
                    </li>
                  ))}
                </ol>
              )}
          </div>
          {formulaHintVisible && (
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
          )}
        </section>
        </div>

        <section className="practice-center">
          <div className="practice-stage trainer-stage">
            <div ref={cubeMountRef} className="cube-mount" />
            <TurnSpeed />

            <div className={`stage-timer-stack${recognitionSequenceVisible ? " trainer-recognition-timer-stack" : ""}`}>
              {recognitionSequenceVisible ? (
                <div className="stage-hint trainer-recognition-sequence" role="status" aria-live="polite" aria-label={t("转动序列")}>
                  <div className="sh-head">
                    <div className="sh-kicker">{t("转动序列")}</div>
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
              ) : null}
              <div className={`timer timer-${state}`}>
                <div className="t-display t-active">{fmtTime(timerDisplayMs)}</div>
              </div>

              <div className="timer-controls trainer-timer-controls">
                <button
                  className="practice-btn practice-btn-primary trainer-start-btn"
                  type="button"
                  onClick={startTraining}
                  disabled={connecting}
                  aria-keyshortcuts={showKeyboardHints ? "Space" : undefined}
                >
                  <span>{sessionInProgress
                    ? isRecognitionSpecialty
                      ? t(showKeyboardHints ? "结束 · 按 SPACE" : "结束")
                      : t(showKeyboardHints ? "结束测试 · 按 SPACE" : "结束测试")
                    : connected ? t(showKeyboardHints ? "开始 · 按 SPACE" : "开始") : t("连接智能魔方")}</span>
                </button>
                {!isRecognitionSpecialty && sessionInProgress && state === "error" && (
                  <button
                    className="practice-btn practice-btn-ghost trainer-retry-btn"
                    type="button"
                    onClick={retryTrainerRound}
                    disabled={!connected || connecting}
                    title={trainerError ?? undefined}
                  >
                    <span>{t("重试本局")}</span>
                  </button>
                )}
                {!isRecognitionSpecialty && roundInProgress && (
                  <button
                    className="practice-btn practice-btn-ghost trainer-abandon-btn"
                    type="button"
                    onClick={abandonRound}
                  >
                    <span>{t("放弃本局")}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      {formulaLibraryOpen && isFormulaTrainerPhase(selectedPhase) && (
        <FormulaLibraryDialog phase={selectedPhase} selectedIds={selectedCaseIds[selectedPhase]} includeRotations={formulaRotationVariants}
          onClose={() => setFormulaLibraryOpen(false)}
          onSave={(ids, rotations) => {
            setSelectedCaseIds((current) => ({ ...current, [selectedPhase]: ids }));
            setFormulaRotationVariants(rotations);
            saveStoredTrainerBoolean(TRAINER_ROTATION_VARIANTS_KEY, rotations);
            try {
              window.localStorage.setItem(getArchiveScopedStorageKey(trainerLibraryKey(selectedPhase)), JSON.stringify(ids));
            } catch {
              // Keep the selection for this session when storage is unavailable.
            }
            setFormulaLibraryOpen(false);
          }} />
      )}
      <AppFooter />
    </div>
  );
}

export function CfopTrainerApp() {
  const clientReady = useClientReady();
  if (!clientReady) {
    return (
      <div className="app lf-practice-app lf-trainer-app practice-focus-app trainer-focus-app">
        <AppTopbar />
      </div>
    );
  }
  return <CfopTrainerClient />;
}
