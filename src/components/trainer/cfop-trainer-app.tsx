"use client";
import { useCubeConnection } from "@/components/connection/cube-connection-provider";
import { useCubeAppearance } from "@/components/cube/cube-appearance-provider";
import { TurnSpeed } from "@/components/cube/turn-speed";
import { useLanguage } from "@/components/i18n/language-provider";
import { useGyroPowerNotice } from "@/components/notifications/gyro-power-notice";
import { PracticeMobileDialog,PracticeMobilePanels,PracticeSettingsButton } from "@/components/practice/practice-mobile-panels";
import { AppFooter,AppTopbar } from "@/components/shell/app-shell";
import { FormulaLibraryDialog } from "@/components/trainer/formula-library-dialog";
import { TrainerCatalogPanel,TrainerHintPanel,TrainerRecognitionPanel,TrainerScorePanel,TrainerSettingsPanel } from "@/components/trainer/trainer-panels";
import { type AlgorithmStepStatus } from "@/components/ui/algorithm-step-token";
import { useClientReady } from "@/lib/browser/client-ready";
import { isTextEntryTarget } from "@/lib/browser/keyboard-shortcuts";
import { useKeyboardHints } from "@/lib/browser/use-keyboard-hints";
import { advanceFormulaRotationSteps,compressMoveSequence,createMoveCoordinateState,expandMoveNotation,flushFormulaMoveAnimation,groupAlgorithmMoves,hintMoveForDoubleTurnProgress,moveCanStillMatchExpected,movePartiallyMatchesExpectedDoubleTurn,movesMatchExpected,normalizeMoveCoordinate,parseAlgorithm,parseMoveNotation,planFormulaMoveAnimation,updateMoveCoordinateStateAfterMatch,updateMoveCoordinateStateAfterMove,type FormulaMoveAnimationState,type MoveCoordinateState,} from "@/lib/cube/algorithms";
import { loadPracticeGyroDisabled,savePracticeGyroDisabled } from "@/lib/cube/cube-appearance";
import { CUBE_CAMERA_PRESETS } from "@/lib/cube/cube-camera-presets";
import { CubeIdleFaceletsSync } from "@/lib/cube/cube-idle-facelets-sync";
import { getInitialCubeVisualState } from "@/lib/cube/cube-visual-state";
import { applyMoveToFacelets,applyMoveToFormulaFacelets,applyMovesToFormulaFacelets } from "@/lib/cube/facelets-pattern";
import { appendUndoStackMoves,buildUndoStack,getRemainingUndoStack,normalizeMove,splitInvalidPendingMoves,} from "@/lib/cube/move-sequence";
import { PendingMoveQueue } from "@/lib/cube/pending-move-queue";
import { mountSmartCube,type CubeDisplayState,type CubeQuaternion,type SmartCubeApi } from "@/lib/cube/smart-cube";
import { getArchiveScopedStorageKey } from "@/lib/records/solve-history";
import { TurnCounter,calculateTps,formatTps } from "@/lib/records/tps";
import { F2L_FOCUS_SOLVED_FACELETS,SOLVED_FACELETS,canUseFocusModeForPhase,createFormulaTrainerScenario,displayFaceletsToHardwareFacelets,focusSolvedFaceletsForPhase,phaseComplete,type CfopTrainerPhase } from "@/lib/training/cfop-trainer";
import { TRAINER_F2L_EDGE_ONLY_KEY,TRAINER_FORMULA_HINT_KEY,TRAINER_RECOGNITION_HINT_KEY,TRAINER_RECOGNITION_SLICES_KEY,TRAINER_RECOGNITION_WIDE_KEY,TRAINER_ROTATION_ARROW_KEY,TRAINER_ROTATION_VARIANTS_KEY,isFormulaTrainerPhase,normalizeTrainerSessionRounds,readF2lFocusModeEnabled,readStoredFormulaCases,readStoredTrainerBoolean,readStoredTrainerPhase,readStoredTrainerSessionRounds,saveF2lFocusModeEnabled,saveStoredTrainerBoolean,saveStoredTrainerPhase,saveStoredTrainerSessionRounds,trainerLibraryKey,} from "@/lib/training/trainer-preferences";
import type { TrainerSpecialty } from "@/lib/training/trainer-session-model";
import { type FormulaHintStepStatus,type TrainerRoundResult,type TrainerState } from "@/lib/training/trainer-session-model";
import { createTurnRecognitionSequence } from "@/lib/training/turn-recognition-trainer";
import { fmtShort,fmtTime } from "@/lib/utils/format";
import { useCallback,useEffect,useEffectEvent,useMemo,useRef,useState } from "react";

const TRAINER_MOVE_ANIMATION_MS = 100;

const DISPLAY_STATE_EPSILON = 0.001;

const TRAINER_CUBE_CAMERA_PRESET = CUBE_CAMERA_PRESETS.trainer;

function isDefaultDisplayState(state: CubeDisplayState) {
  const defaultState = TRAINER_CUBE_CAMERA_PRESET.displayState;
  return (
    Math.abs(state.cameraDistance - defaultState.cameraDistance) <= DISPLAY_STATE_EPSILON &&
    Math.abs(state.cameraLatitude - defaultState.cameraLatitude) <= DISPLAY_STATE_EPSILON &&
    Math.abs(state.cameraLongitude - defaultState.cameraLongitude) <= DISPLAY_STATE_EPSILON
  );
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
  const keyboardHints = useKeyboardHints();
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const showKeyboardHints = keyboardHints && !isSmallScreen;
  useEffect(() => {
    const query = window.matchMedia("(width <= 700px)");
    const update = () => {
      setIsSmallScreen(query.matches);
      if (!query.matches) setMobileSettingsOpen(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
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


  const animateCubeMoves = useCallback((moves: string[], durationMs = TRAINER_MOVE_ANIMATION_MS) => {
    moves.forEach((move) => {
      cubeApiRef.current?.applyMoves(expandMoveNotation(move), durationMs);
    });
  }, []);

  const visualMoveQueue = useMemo(() => new PendingMoveQueue(), []);
  const { flush: flushVisualPendingMove, discard: discardVisualPendingMoves, hasPending: hasPendingVisualMove } = visualMoveQueue;
  const queueVisualMove = useCallback((move: string) => {
    visualMoveQueue.push(move, (pending) => animateCubeMoves([pending]));
  }, [animateCubeMoves, visualMoveQueue]);

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
      discardVisualPendingMoves();
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
  }, [discardVisualPendingMoves, backFaceProjectionDistance, backFaceProjectionEnabled, faceColors, getLatestGyro, orientation, renderMaxFps, renderTrainerCubeFacelets]);

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
      discardVisualPendingMoves();
      clearAutoNextTimer();
    };
  }, [clearAutoNextTimer, discardVisualPendingMoves]);

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
      const busy = hasPendingVisualMove() || cube.isAnimating();
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
  }, [connected, hasPendingVisualMove, isRecognitionSpecialty, subscribeFacelets]);

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
    discardVisualPendingMoves();
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
  }, [clearAutoNextTimer, discardVisualPendingMoves, renderTrainerCubeFacelets, resetFormulaHint, resetRecognitionResults, resetSessionResults, updateTrainerState]);

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
    discardVisualPendingMoves();
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
  }, [discardVisualPendingMoves, completeRound, roundInProgress, sessionInProgress]);

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
    discardVisualPendingMoves();
    void beginTrainerRound(runIdRef.current);
  }, [beginTrainerRound, discardVisualPendingMoves, connected, sessionInProgress]);

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
      if (document.querySelector("dialog[open]") || formulaLibraryOpen || isTextEntryTarget(event.target)) return;

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
      if (document.querySelector("dialog[open]") || formulaLibraryOpen || isTextEntryTarget(event.target)) return;
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

  const historyList = (
!isRecognitionSpecialty && sessionResults.length > 0 && (
                <ol className="trainer-tps-history" aria-label={t("最近记录")}>
                  {sessionResults.slice(-5).toReversed().map((entry, index) => (
                    <li key={sessionResults.length - index}>
                      <span>#{sessionResults.length - index}</span>
                      <b>{entry.dnf ? "DNF" : fmtShort(entry.solveMs)}</b>
                      <span className="hr-tps">{formatTps(entry.dnf ? null : calculateTps(entry.moves, entry.solveMs))} <small>TPS</small></span>
                    </li>
                  ))}
                </ol>
              )
  );
  const catalogPanel = (
<TrainerCatalogPanel selectedPhase={selectedPhase} selectPhase={selectPhase} settingsLocked={settingsLocked} />
  );
  const changeRecognitionIncludeSlices = (next: boolean) => {
    setRecognitionIncludeSlices(next);
    saveStoredTrainerBoolean(TRAINER_RECOGNITION_SLICES_KEY, next);
  };

  const changeRecognitionIncludeWideMoves = (next: boolean) => {
    setRecognitionIncludeWideMoves(next);
    saveStoredTrainerBoolean(TRAINER_RECOGNITION_WIDE_KEY, next);
  };

  const changeRecognitionHintEnabled = (next: boolean) => {
    setRecognitionHintEnabled(next);
    saveStoredTrainerBoolean(TRAINER_RECOGNITION_HINT_KEY, next);
  };

  const changeF2lEdgeOnly = (next: boolean) => {
    f2lEdgeOnlyRef.current = next;
    setF2lEdgeOnly(next);
    saveStoredTrainerBoolean(TRAINER_F2L_EDGE_ONLY_KEY, next);
  };

  const changeFormulaHintEnabled = (next: boolean) => {
    formulaHintEnabledRef.current = next;
    setFormulaHintEnabled(next);
    saveStoredTrainerBoolean(TRAINER_FORMULA_HINT_KEY, next);
  };

  const changeFormulaArrowEnabled = (next: boolean) => {
    formulaArrowEnabledRef.current = next;
    setFormulaArrowEnabled(next);
    saveStoredTrainerBoolean(TRAINER_ROTATION_ARROW_KEY, next);
  };

  const settingsPanel = (
<TrainerSettingsPanel
    sessionRoundLimit={sessionRoundLimit}
    settingsLocked={settingsLocked}
    updateSessionRoundLimit={updateSessionRoundLimit}
    isRecognitionSpecialty={isRecognitionSpecialty}
    recognitionIncludeSlices={recognitionIncludeSlices}
    changeRecognitionIncludeSlices={changeRecognitionIncludeSlices}
    recognitionIncludeWideMoves={recognitionIncludeWideMoves}
    changeRecognitionIncludeWideMoves={changeRecognitionIncludeWideMoves}
    recognitionHintEnabled={recognitionHintEnabled}
    changeRecognitionHintEnabled={changeRecognitionHintEnabled}
    selectedPhase={selectedPhase}
    onSelectPhase={isSmallScreen ? selectPhase : undefined}
    onOpenFormulaLibrary={() => { setMobileSettingsOpen(false); setFormulaLibraryOpen(true); }}
    selectedCaseIds={selectedCaseIds}
    f2lEdgeOnly={f2lEdgeOnly}
    changeF2lEdgeOnly={changeF2lEdgeOnly}
    formulaHintEnabled={formulaHintEnabled}
    changeFormulaHintEnabled={changeFormulaHintEnabled}
    formulaArrowEnabled={formulaArrowEnabled}
    changeFormulaArrowEnabled={changeFormulaArrowEnabled}
    canUseFocusMode={canUseFocusMode}
    f2lFocusMode={f2lFocusMode}
    toggleF2lFocusMode={toggleF2lFocusMode}
    gyroDisabled={gyroDisabled}
    toggleGyroDisabled={toggleGyroDisabled}
    resetDisplayOrientation={resetDisplayOrientation}
    canResetDisplayOrientation={canResetDisplayOrientation}
  />
  );
  const scorePanel = (
<TrainerScorePanel
    summary={isRecognitionSpecialty
      ? { kind: "recognition", recognitionCorrect, recognitionWrong, recognitionAccuracy, recognitionAverageResponseMs }
      : { kind: "cfop", sessionAverageObserveMs, sessionAverageSolveMs, sessionTps, sessionSuccessRate, sessionDnfCount, sessionRoundCount, sessionRoundLimit }}
    isSmallScreen={isSmallScreen}
    historyList={historyList}
  />
  );
  const hintPanel = (
formulaHintVisible && (
            <TrainerHintPanel
    formulaHintCounter={formulaHintCounter}
    formulaHintMoves={formulaHintMoves}
    formulaHintUndoDisplay={formulaHintUndoDisplay}
    formulaHintRows={formulaHintRows}
    formulaHintIndex={formulaHintIndex}
    formulaHintWrong={formulaHintWrong}
    formulaHintStatus={formulaHintStatus}
  />
          )
  );
  const recognitionPanel = (
recognitionSequenceVisible ? (
                <TrainerRecognitionPanel recognitionIndex={recognitionIndex} recognitionMoves={recognitionMoves} recognitionStatuses={recognitionStatuses} />
              ) : null
  );
  const historyPanel = historyList ? (
    <div className="trainer-history-panel ui-info-panel">
      <div className="practice-card-head"><div className="practice-title-line">
        <div className="practice-card-title">{t("最近记录")}</div><span className="practice-kicker" aria-hidden="true">RECENT</span>
      </div></div>
      {historyList}
    </div>
  ) : null;
  const timerPanel = (
    <div className={`timer timer-${state}`}>
      <div className="t-display t-active">{fmtTime(timerDisplayMs)}</div>
    </div>
  );
  const abandonButton = !isRecognitionSpecialty && roundInProgress ? (
    <button className="practice-btn practice-btn-ghost trainer-abandon-btn" type="button" onClick={abandonRound}>
      <span>{t("放弃本局")}</span>
    </button>
  ) : null;
  return (
    <div className="app lf-practice-app lf-trainer-app practice-focus-app trainer-focus-app">
      <AppTopbar />
      <main className="practice-layout trainer-layout">
        <div className="practice-info">
        <section className="practice-left trainer-left">
          {!isSmallScreen && catalogPanel}
          {!isSmallScreen && settingsPanel}

        </section>

        <section className="practice-right trainer-right">
          {!isSmallScreen && scorePanel}
          {!isSmallScreen && hintPanel}
        </section>
        </div>

        {isSmallScreen && <PracticeMobilePanels panels={[scorePanel, ...(historyPanel ? [historyPanel] : [])]}
          overlay={recognitionPanel || hintPanel} />}

        <section className="practice-center">
          <div className="practice-stage trainer-stage">
            <div ref={cubeMountRef} className="cube-mount" />
            <TurnSpeed />

            <div className={`stage-timer-stack${recognitionSequenceVisible && !isSmallScreen ? " trainer-recognition-timer-stack" : ""}`}>
              {!isSmallScreen && recognitionPanel}
              {isSmallScreen ? (
                <div className="trainer-timer-row">
                  {timerPanel}
                  {abandonButton && <div className="timer-controls trainer-round-actions">{abandonButton}</div>}
                </div>
              ) : timerPanel}

              <div className="timer-controls trainer-timer-controls">
                <button
                  className="practice-btn practice-btn-primary"
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
                {!isSmallScreen && abandonButton}
              </div>
            </div>
            <div className="practice-mobile-actions">
              <PracticeSettingsButton label="专项设置" expanded={mobileSettingsOpen} onClick={() => setMobileSettingsOpen(true)} disabled={settingsLocked} />
            </div>
          </div>
        </section>
      </main>
      {isSmallScreen && mobileSettingsOpen && <PracticeMobileDialog title={t("专项设置")} onClose={() => setMobileSettingsOpen(false)}>
        {settingsPanel}
      </PracticeMobileDialog>}
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
