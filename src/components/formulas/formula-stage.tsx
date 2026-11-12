"use client";
import { useCubeConnection } from "@/components/connection/cube-connection-provider";
import { useCubeAppearance } from "@/components/cube/cube-appearance-provider";
import { FormulaCubeImage,FormulaTopViewImage } from "@/components/cube/formula-cube-image";
import { TurnSpeed } from "@/components/cube/turn-speed";
import { groupAlgorithmRows } from "@/components/formulas/formula-algorithm-display";
import { FormulaPracticeStats } from "@/components/formulas/formula-practice-stats";
import { PracticeMobilePanels } from "@/components/practice/practice-mobile-panels";
import { useLanguage } from "@/components/i18n/language-provider";
import { useNotification } from "@/components/notifications/notification-provider";
import { AlgorithmStepToken } from "@/components/ui/algorithm-step-token";
import { FormulaKeypad } from "@/components/ui/formula-keypad";
import { isFormulaTextEntryTarget } from "@/lib/browser/keyboard-shortcuts";
import { advanceFormulaRotationSteps,appendNormalizedMoveLogMove,createMoveCoordinateState,expandMoveNotation,hintMoveForDoubleTurnProgress,invertMoveNotation,isRotationMoveNotation,movePartiallyMatchesExpectedDoubleTurn,normalizeMoveCoordinate,parseAlgorithm,parseMoveNotation,planFormulaMoveAnimation,updateMoveCoordinateStateAfterMatch,updateMoveCoordinateStateAfterMove,type MoveCoordinateState,} from "@/lib/cube/algorithms";
import { getFaceHexColors } from "@/lib/cube/cube-appearance";
import { CUBE_CAMERA_PRESETS } from "@/lib/cube/cube-camera-presets";
import { mountSmartCube,type SmartCubeApi } from "@/lib/cube/smart-cube";
import { formulaPracticeStatsKey,getTodayPracticeCount,getTodayPracticeTone,usesTopViewFormulaImage,type FormulaStats,type FormulaVariantItem,} from "@/lib/formulas/formula-case-model";
import { FORMULA_LEARNING_STATUSES as LEARNING_STATUSES,type FormulaLearningStatus as LearningStatus,} from "@/lib/formulas/formula-learning-status";
import { readFocusModeEnabled,readFormulaStats,saveFocusModeEnabled,saveFormulaCompletion } from "@/lib/formulas/formula-preferences";
import { normalizeFormulaRotationOffset,rotateAlgorithmByYOffset,rotateFaceletsByYOffset,type FormulaRotationOffset,} from "@/lib/formulas/formula-rotation";
import { calculateAverageTime,describeAverageTimeSettings,type AverageTimeSettings } from "@/lib/records/average-time";
import { fmtShort } from "@/lib/utils/format";
import Image from "next/image";
import { useEffect,useEffectEvent,useMemo,useRef,useState,useSyncExternalStore } from "react";

const FORMULAS_CUBE_CAMERA_PRESET = CUBE_CAMERA_PRESETS.formulas;

const SMALL_FORMULA_QUERY = "(width <= 700px)";

const isSmallFormulaLayout = () => window.matchMedia(SMALL_FORMULA_QUERY).matches;

const serverSmallFormulaLayout = () => false;

const subscribeSmallFormulaLayout = (onChange: () => void) => {
  const query = window.matchMedia(SMALL_FORMULA_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

type PracticeStatus = "pending" | "partial" | "correct" | "wrong";

const FORMULA_PLAY_START_DELAY_MS = 0;

const FORMULA_PLAY_STEP_INTERVAL_MS = 1000;

const FORMULA_PLAY_MOVE_DURATION_MS = 600;

const FORMULA_PLAY_FINISH_DELAY_MS = 2000;

function fmtLiveSeconds(ms: number) {
  return (ms / 1000).toFixed(2);
}

function freshPracticeStatus(length: number) {
  return Array.from({ length }, () => "pending" as PracticeStatus);
}

export function FormulaStage({
  active,
  compactLayout,
  methods,
  onMethodChange,
  shouldSolveToReset,
  onStatsChange,
  learningStatus,
  onLearningStatusChange,
  averageSettings,
  formulaPickerOpen,
  onChooseFormula,
}: {
  active: FormulaVariantItem;
  compactLayout: boolean;
  methods: FormulaVariantItem[];
  onMethodChange(key: string): void;
  shouldSolveToReset: boolean;
  onStatsChange(id: string, stats: FormulaStats): void;
  learningStatus: LearningStatus;
  onLearningStatusChange(status: LearningStatus): void;
  averageSettings: AverageTimeSettings;
  formulaPickerOpen: boolean;
  onChooseFormula(): void;
}) {
  const { t } = useLanguage();
  const { notify, dismiss } = useNotification();
  const smallScreen = useSyncExternalStore(subscribeSmallFormulaLayout, isSmallFormulaLayout, serverSmallFormulaLayout);
  const cubeMountRef = useRef<HTMLDivElement | null>(null);
  const algorithmScrollRef = useRef<HTMLDivElement | null>(null);
  const cubeApiRef = useRef<SmartCubeApi | null>(null);
  const playingRef = useRef(false);
  const playRunRef = useRef(0);
  const practiceActiveRef = useRef(false);
  const researchModeRef = useRef(false);
  const transparentDisplayRef = useRef(false);
  const lowerLayerHiddenRef = useRef(false);
  const inRoundRef = useRef(false);
  const practiceIndexRef = useRef(0);
  const practiceStatusRef = useRef<PracticeStatus[]>([]);
  const pendingPracticeMovesRef = useRef<string[]>([]);
  const pendingPracticeAnimatedCountRef = useRef(0);
  const pendingPracticeAnimatedPartialRef = useRef<string | null>(null);
  const researchMovesRef = useRef<string[]>([]);
  const moveCoordinateRef = useRef<MoveCoordinateState>(createMoveCoordinateState());
  const wrongWaitRef = useRef(false);
  const roundStartRef = useRef(0);
  const nextRoundTimerRef = useRef<number | null>(null);
  const practiceTimerRef = useRef<number | null>(null);
  const playTimerRefs = useRef<number[]>([]);
  const [rotationOffset, setRotationOffset] = useState<FormulaRotationOffset>(0);
  const canRotateF2lVariant = active.sourceCat === "f2l";
  const displayAlgo = useMemo(
    () => rotateAlgorithmByYOffset(active.algo, canRotateF2lVariant ? rotationOffset : 0),
    [active.algo, canRotateF2lVariant, rotationOffset],
  );
  const displayFacelets = useMemo(
    () => rotateFaceletsByYOffset(active.caseFacelets, canRotateF2lVariant ? rotationOffset : 0),
    [active.caseFacelets, canRotateF2lVariant, rotationOffset],
  );
  const displayStatsKey = useMemo(
    () => formulaPracticeStatsKey(active.key, active.sourceCat, canRotateF2lVariant ? rotationOffset : 0),
    [active.key, active.sourceCat, canRotateF2lVariant, rotationOffset],
  );
  const algoMoves = useMemo(() => parseAlgorithm(displayAlgo), [displayAlgo]);
  const setupMoves = useMemo(
    () => algoMoves.toReversed().map(invertMoveNotation),
    [algoMoves],
  );
  const algoRows = useMemo(() => groupAlgorithmRows(displayAlgo), [displayAlgo]);
  const [practiceActive, setPracticeActive] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceStatus, setPracticeStatus] = useState<PracticeStatus[]>(() => freshPracticeStatus(algoMoves.length));
  const [playbackStatus, setPlaybackStatus] = useState<PracticeStatus[]>(() => freshPracticeStatus(algoMoves.length));
  const [practiceStats, setPracticeStats] = useState<FormulaStats>({ count: 0, times: [] });
  const [practiceMs, setPracticeMs] = useState(0);
  const [practiceTiming, setPracticeTiming] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [transparentDisplay, setTransparentDisplay] = useState(false);
  const [lowerLayerHidden, setLowerLayerHidden] = useState(false);
  const [researchMoves, setResearchMoves] = useState<string[]>([]);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [learningMenuOpen, setLearningMenuOpen] = useState(false);
  const [methodMenuOpen, setMethodMenuOpen] = useState(false);
  const methodMenuRef = useRef<HTMLDivElement | null>(null);
  const [viewResetEnabled, setViewResetEnabled] = useState(false);

  useEffect(() => {
    if (!smallScreen || researchMode) return;
    const index = playbackActive
      ? playbackStatus.findIndex((status) => status !== "correct")
      : practiceActive ? practiceIndex : -1;
    if (index < 0) return;
    const container = algorithmScrollRef.current;
    const token = container?.querySelectorAll<HTMLElement>(".algo-tok").item(index);
    if (!container || !token) return;
    const bounds = container.getBoundingClientRect();
    const target = token.getBoundingClientRect();
    if (target.top >= bounds.top + 8 && target.bottom <= bounds.bottom - 8) return;
    container.scrollTo({
      top: container.scrollTop + target.top - bounds.top - (container.clientHeight - target.height) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [smallScreen, researchMode, practiceActive, practiceIndex, playbackActive, playbackStatus]);

  useEffect(() => {
    if (!methodMenuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !methodMenuRef.current?.contains(event.target)) setMethodMenuOpen(false);
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [methodMenuOpen]);

  const {
    connectionState,
    subscribeMove,
  } = useCubeConnection();
  const { orientation, faceColors, renderMaxFps, backFaceProjectionEnabled, backFaceProjectionDistance } = useCubeAppearance();
  const formulaTopViewFaceColors = useMemo(() => getFaceHexColors(orientation, "cubing-js"), [orientation]);

  const connected = connectionState === "connected";
  const learningStatusLabel = t(LEARNING_STATUSES.find((status) => status.key === learningStatus)?.shortLabel ?? "未学习");
  const canUseFocusMode = active.sourceCat === "oll" || active.sourceCat === "pll";
  const canUseTransparentDisplay = active.sourceCat === "cross";
  const showVariantTag = active.name !== "主公式";
  const formulaTitle = showVariantTag && !compactLayout ? `${t(active.caseName)} · ${t(active.name)}` : t(active.caseName);
  const formulaAverage = calculateAverageTime(practiceStats.times, averageSettings);
  const formulaAverageLabel = formulaAverage ? fmtShort(formulaAverage.valueMs) : "--";
  const formulaAverageDescription = t(describeAverageTimeSettings(averageSettings));
  const todayPracticeCount = getTodayPracticeCount(practiceStats);
  const todayPracticeTone = getTodayPracticeTone(todayPracticeCount);
  const bestPracticeValue = typeof practiceStats.bestMs === "number" ? fmtShort(practiceStats.bestMs) : "--";
  const displayedMoveCount = researchMode ? researchMoves.length : algoMoves.length;

  function setPracticeStatuses(next: PracticeStatus[]) {
    practiceStatusRef.current = next;
    setPracticeStatus(next);
  }

  function advancePastVirtualRotations(startIndex: number, statuses: PracticeStatus[], durationMs: number) {
    const advanced = advanceFormulaRotationSteps(algoMoves, startIndex, moveCoordinateRef.current);
    const nextStatuses = [...statuses];
    advanced.rotations.forEach((move, index) => {
      nextStatuses[startIndex + index] = "correct";
      cubeApiRef.current?.applyMoves(expandMoveNotation(move), durationMs);
    });
    moveCoordinateRef.current = advanced.coordinate;
    const nextIndex = advanced.nextIndex;
    return { nextIndex, statuses: nextStatuses };
  }

  function nextInteractiveMoveIndex(startIndex: number) {
    let nextIndex = startIndex;
    while (nextIndex < algoMoves.length && isRotationMoveNotation(algoMoves[nextIndex])) {
      nextIndex += 1;
    }
    return nextIndex;
  }

  function setPreviewStartState() {
    const cube = cubeApiRef.current;
    if (!cube) return;
    if (displayFacelets) {
      cube.setFormulaFacelets(displayFacelets);
      return;
    }
    cube.reset();
    if (!shouldSolveToReset) return;
    setupMoves.forEach((move) => {
      cube.applyMoves(expandMoveNotation(move), 0);
    });
  }

  function clearNextRoundTimer() {
    if (nextRoundTimerRef.current !== null) {
      window.clearTimeout(nextRoundTimerRef.current);
      nextRoundTimerRef.current = null;
    }
  }

  function clearPracticeTimer() {
    if (practiceTimerRef.current !== null) {
      window.clearInterval(practiceTimerRef.current);
      practiceTimerRef.current = null;
    }
    setPracticeTiming(false);
  }

  function notifyFormulaError(message: string) {
    notify("error", message, "formula-error");
  }

  function notifyFormulaSuccess(message: string) {
    notify("success", message, "formula-success");
  }

  function clearPlayTimers() {
    playTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
    playTimerRefs.current = [];
  }

  function setResearchMoveLog(next: string[]) {
    researchMovesRef.current = next;
    setResearchMoves(next);
  }

  function appendResearchMove(move: string) {
    const normalizedMove = normalizeMoveCoordinate(move, moveCoordinateRef.current);
    const next = appendNormalizedMoveLogMove(
      researchMovesRef.current,
      move,
      moveCoordinateRef.current,
    );
    moveCoordinateRef.current = next.coordinateState;
    setResearchMoveLog(next.history);
    return normalizedMove;
  }

  function applyResearchMove(move: string) {
    const parsed = parseMoveNotation(move);
    if (!parsed) return;
    const normalizedMove = appendResearchMove(parsed.notation);
    cubeApiRef.current?.applyMoves(expandMoveNotation(normalizedMove), 180);
  }

  function deleteResearchMove() {
    const lastMove = researchMovesRef.current.at(-1);
    if (!lastMove) return;
    const remainingMoves = researchMovesRef.current.slice(0, -1);
    moveCoordinateRef.current = remainingMoves.reduce(
      (state, move) => updateMoveCoordinateStateAfterMove(state, move),
      createMoveCoordinateState(),
    );
    setResearchMoveLog(remainingMoves);
    cubeApiRef.current?.applyMoves(expandMoveNotation(invertMoveNotation(lastMove)), 180);
  }

  function clearResearchMoves() {
    if (researchMovesRef.current.length === 0) return;
    moveCoordinateRef.current = createMoveCoordinateState();
    setResearchMoveLog([]);
    setPreviewStartState();
    cubeApiRef.current?.setHintMove(null);
  }

  function resetPracticeFlow(resetMs = true) {
    clearNextRoundTimer();
    clearPracticeTimer();
    dismiss("formula-error");
    wrongWaitRef.current = false;
    pendingPracticeMovesRef.current = [];
    pendingPracticeAnimatedCountRef.current = 0;
    pendingPracticeAnimatedPartialRef.current = null;
    moveCoordinateRef.current = createMoveCoordinateState();
    practiceIndexRef.current = 0;
    inRoundRef.current = false;
    roundStartRef.current = performance.now();
    if (resetMs) {
      setPracticeMs(0);
    }
  }

  function getCurrentPracticeHintMove() {
    if (!practiceActiveRef.current) return null;
    const index = wrongWaitRef.current ? nextInteractiveMoveIndex(0) : practiceIndexRef.current;
    const expected = algoMoves[index];
    return expected ? hintMoveForDoubleTurnProgress(pendingPracticeMovesRef.current, expected) : null;
  }

  function stopPlayback() {
    playRunRef.current += 1;
    playingRef.current = false;
    setPlaybackActive(false);
    setPlaybackStatus(freshPracticeStatus(algoMoves.length));
    clearPlayTimers();
    cubeApiRef.current?.setHintMove(researchModeRef.current ? null : getCurrentPracticeHintMove());
  }

  function prepareRound(resetMs = true) {
    resetPracticeFlow(resetMs);
    setPreviewStartState();
    const freshStatus = freshPracticeStatus(algoMoves.length);
    const advanced = advancePastVirtualRotations(0, freshStatus, 0);
    practiceIndexRef.current = advanced.nextIndex;
    setPracticeIndex(advanced.nextIndex);
    setPracticeStatuses(advanced.statuses);
  }

  function startRound() {
    prepareRound();
    inRoundRef.current = true;
    roundStartRef.current = performance.now();
    practiceTimerRef.current = window.setInterval(() => {
      setPracticeMs(performance.now() - roundStartRef.current);
    }, 33);
    setPracticeTiming(true);
  }

  function resetPractice() {
    resetPracticeFlow();
    dismiss("formula-success");
    practiceActiveRef.current = false;
    setPracticeActive(false);
    setPracticeIndex(0);
    setPracticeStatuses(freshPracticeStatus(algoMoves.length));
    cubeApiRef.current?.setHintMove(null);
  }

  function resetDisplayOrientation() {
    cubeApiRef.current?.resetDisplayOrientation();
    setViewResetEnabled(false);
  }

  function setLowerLayerHiddenState(hidden: boolean) {
    lowerLayerHiddenRef.current = hidden;
    setLowerLayerHidden(hidden);
    saveFocusModeEnabled(hidden);
    cubeApiRef.current?.setLowerLayerDimmed(canUseFocusMode && hidden);
  }

  function toggleLowerLayerHidden() {
    if (!canUseFocusMode) return;
    setLowerLayerHiddenState(!lowerLayerHiddenRef.current);
  }

  function toggleTransparentDisplay() {
    if (!canUseTransparentDisplay) return;
    const nextEnabled = !transparentDisplayRef.current;
    transparentDisplayRef.current = nextEnabled;
    setTransparentDisplay(nextEnabled);
    cubeApiRef.current?.setTransparentFormulaFacelets(nextEnabled);
  }

  function enterResearchMode() {
    stopPlayback();
    resetPracticeFlow();
    practiceActiveRef.current = false;
    setPracticeActive(false);
    setPracticeIndex(0);
    setPracticeStatuses(freshPracticeStatus(algoMoves.length));
    setResearchMoveLog([]);
    researchModeRef.current = true;
    setResearchMode(true);
    cubeApiRef.current?.setHintMove(null);
    setPreviewStartState();
  }

  function exitResearchMode() {
    researchModeRef.current = false;
    setResearchMode(false);
    setResearchMoveLog([]);
    resetPracticeFlow();
    practiceActiveRef.current = false;
    setPracticeActive(false);
    setPracticeIndex(0);
    setPracticeStatuses(freshPracticeStatus(algoMoves.length));
    cubeApiRef.current?.setHintMove(null);
    setPreviewStartState();
  }

  const exitMobileResearch = useEffectEvent(() => {
    if (researchModeRef.current) exitResearchMode();
  });
  useEffect(() => {
    if (smallScreen) exitMobileResearch();
  }, [smallScreen]);

  function toggleResearchMode() {
    if (researchModeRef.current) {
      exitResearchMode();
      return;
    }
    enterResearchMode();
  }

  function changeFormulaRotation(delta: -1 | 1) {
    if (!canRotateF2lVariant || researchModeRef.current) return;
    const nextOffset = normalizeFormulaRotationOffset(rotationOffset + delta);
    stopPlayback();
    resetPractice();
    dismiss("formula-success");
    setPracticeStats(readFormulaStats(formulaPracticeStatsKey(active.key, active.sourceCat, nextOffset)));
    setLearningMenuOpen(false);
    setRotationOffset(nextOffset);
  }

  function rotateFormulaClockwise() {
    changeFormulaRotation(-1);
  }

  function rotateFormulaCounterClockwise() {
    changeFormulaRotation(1);
  }

  const stopPlaybackEffect = useEffectEvent(stopPlayback);
  const setPreviewStartStateEffect = useEffectEvent(setPreviewStartState);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const enabled = readFocusModeEnabled();
      lowerLayerHiddenRef.current = enabled;
      setLowerLayerHidden(enabled);
      setPracticeStats(readFormulaStats(displayStatsKey));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [displayStatsKey]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key !== "q" && key !== "p" && key !== "r" && key !== "h" && key !== "t" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isFormulaTextEntryTarget(event.target)) return;
      if (key === "h" && !canUseFocusMode) return;
      if (key === "t" && !canUseTransparentDisplay) return;
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && (!canRotateF2lVariant || researchModeRef.current)) return;

      event.preventDefault();
      if (event.key === "ArrowLeft") {
        rotateFormulaClockwise();
        return;
      }
      if (event.key === "ArrowRight") {
        rotateFormulaCounterClockwise();
        return;
      }
      if (key === "h") {
        toggleLowerLayerHidden();
        return;
      }
      if (key === "t") {
        toggleTransparentDisplay();
        return;
      }
      if (key === "q") {
        toggleResearchMode();
        return;
      }
      if (key === "p") {
        play();
        return;
      }
      if (viewResetEnabled) {
        resetDisplayOrientation();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const getInitialProjectionDistance = useEffectEvent(() => backFaceProjectionDistance);

  useEffect(() => {
    if (!cubeMountRef.current) return;
    setViewResetEnabled(false);
    const api = mountSmartCube(cubeMountRef.current, {
      faceColors,
      orientation,
      maxFps: renderMaxFps,
      compactGestureRegion: true,
      transparentFormulaFacelets: transparentDisplayRef.current,
      showBackFaceProjection: backFaceProjectionEnabled,
      backFaceProjectionDistance: getInitialProjectionDistance(),
      defaultDisplayState: compactLayout ? CUBE_CAMERA_PRESETS.practice.displayState : FORMULAS_CUBE_CAMERA_PRESET.displayState,
      cameraDistanceRange: compactLayout ? CUBE_CAMERA_PRESETS.practice.distanceRange : undefined,
      sceneOffset: compactLayout ? CUBE_CAMERA_PRESETS.practice.sceneOffset : undefined,
      onDisplayOrientationChange: () => setViewResetEnabled(true),
    });
    cubeApiRef.current = api;
    if (!researchModeRef.current) setPreviewStartStateEffect();
    api.setLowerLayerDimmed(canUseFocusMode && lowerLayerHiddenRef.current);
    if (practiceActiveRef.current) {
      const inWrongWait = wrongWaitRef.current;
      const idx = practiceIndexRef.current;
      const expected = inWrongWait ? algoMoves[0] : algoMoves[idx];
      const hintMove = expected ? hintMoveForDoubleTurnProgress(pendingPracticeMovesRef.current, expected) : null;
      api.setHintMove(hintMove);
    }
    return () => {
      stopPlaybackEffect();
      clearNextRoundTimer();
      clearPracticeTimer();
      api.dispose();
      if (cubeApiRef.current === api) cubeApiRef.current = null;
    };
  }, [algoMoves, backFaceProjectionEnabled, canUseFocusMode, compactLayout, displayFacelets, faceColors, orientation, renderMaxFps, setupMoves, shouldSolveToReset]);

  useEffect(() => {
    cubeApiRef.current?.setBackFaceProjectionDistance(backFaceProjectionDistance);
  }, [backFaceProjectionDistance]);

  useEffect(() => {
    cubeApiRef.current?.setLowerLayerDimmed(canUseFocusMode && lowerLayerHiddenRef.current);
  }, [canUseFocusMode]);

  useEffect(() => {
    practiceActiveRef.current = practiceActive;
  }, [practiceActive]);

  useEffect(() => {
    practiceIndexRef.current = practiceIndex;
  }, [practiceIndex]);

  function animatePracticeMoves(moves: string[]) {
    moves.forEach((move) => {
      cubeApiRef.current?.applyMoves(expandMoveNotation(move), 180);
    });
  }

  function handlePracticeMove(move: string) {
    const parsed = parseMoveNotation(move);
    if (!parsed) return;

    if (researchModeRef.current) {
      const normalizedMove = appendResearchMove(parsed.notation);
      cubeApiRef.current?.applyMoves(expandMoveNotation(normalizedMove), 180);
      return;
    }

    if (!practiceActiveRef.current) {
      stopPlayback();
      practiceActiveRef.current = true;
      setPracticeActive(true);
      startRound();
    } else if (!inRoundRef.current && !wrongWaitRef.current) {
      startRound();
    }

    if (wrongWaitRef.current) {
      startRound();
    }

    const normalizedMove = normalizeMoveCoordinate(parsed.notation, moveCoordinateRef.current);

    if (!inRoundRef.current) return;

    const currentIndex = practiceIndexRef.current;
    const expected = algoMoves[currentIndex];
    if (!expected) return;
    pendingPracticeMovesRef.current = [...pendingPracticeMovesRef.current, normalizedMove];

    const animation = planFormulaMoveAnimation(pendingPracticeMovesRef.current, expected, {
      animatedCount: pendingPracticeAnimatedCountRef.current,
      animatedPartialMove: pendingPracticeAnimatedPartialRef.current,
    });
    animatePracticeMoves(animation.moves);
    pendingPracticeAnimatedCountRef.current = animation.animatedCount;
    pendingPracticeAnimatedPartialRef.current = animation.animatedPartialMove;

    if (animation.match === "matched") {
      moveCoordinateRef.current = updateMoveCoordinateStateAfterMatch(
        moveCoordinateRef.current,
        pendingPracticeMovesRef.current,
        expected,
      );
      pendingPracticeMovesRef.current = [];
      pendingPracticeAnimatedPartialRef.current = null;
      const markedStatus = [...(practiceStatusRef.current.length ? practiceStatusRef.current : practiceStatus)];
      markedStatus[currentIndex] = "correct";
      const advanced = advancePastVirtualRotations(currentIndex + 1, markedStatus, 180);
      practiceIndexRef.current = advanced.nextIndex;
      setPracticeIndex(advanced.nextIndex);
      setPracticeStatuses(advanced.statuses);
      if (advanced.nextIndex >= algoMoves.length) {
        const elapsed = performance.now() - roundStartRef.current;
        clearPracticeTimer();
        inRoundRef.current = false;
        setPracticeMs(elapsed);
        const previousBest = readFormulaStats(displayStatsKey).bestMs;
        const newStats = saveFormulaCompletion(displayStatsKey, elapsed);
        setPracticeStats(newStats);
        onStatsChange(displayStatsKey, newStats);
        if (typeof previousBest === "number" && elapsed < previousBest) {
          notifyFormulaSuccess(t(`${fmtShort(elapsed)} 打破最佳成绩！`));
        }
        nextRoundTimerRef.current = window.setTimeout(() => {
          nextRoundTimerRef.current = null;
          if (practiceActiveRef.current) prepareRound(false);
        }, 900);
      }
    } else if (animation.match === "partial") {
      const partialStatus = [...(practiceStatusRef.current.length ? practiceStatusRef.current : practiceStatus)];
      const hasCompletedFirstHalf = movePartiallyMatchesExpectedDoubleTurn(
        pendingPracticeMovesRef.current,
        expected,
      );
      // While a double turn can still match, never regress its token from half-complete to pending.
      // The first face event of the second emulated slice turn may precede its recovered pair.
      partialStatus[currentIndex] = hasCompletedFirstHalf || partialStatus[currentIndex] === "partial"
        ? "partial"
        : "pending";
      setPracticeStatuses(partialStatus);
      return;
    } else {
      const detected = pendingPracticeMovesRef.current.join(" ") || normalizedMove;
      pendingPracticeMovesRef.current = [];
      pendingPracticeAnimatedCountRef.current = 0;
      pendingPracticeAnimatedPartialRef.current = null;
      moveCoordinateRef.current = createMoveCoordinateState();
      const wrongStatus = [...(practiceStatusRef.current.length ? practiceStatusRef.current : practiceStatus)];
      wrongStatus[currentIndex] = "wrong";
      setPracticeStatuses(wrongStatus);
      wrongWaitRef.current = true;
      inRoundRef.current = false;
      clearPracticeTimer();
      setPracticeMs(0);
      setPreviewStartState();
      cubeApiRef.current?.setHintMove(algoMoves[nextInteractiveMoveIndex(0)] ?? null);
      notifyFormulaError(t(`转动错误，检测到${detected}，应该为${expected}，请重新开始`));
    }
  }

  const resetDisconnectedPractice = useEffectEvent(() => {
    if (practiceActiveRef.current && inRoundRef.current) resetPractice();
  });
  useEffect(() => {
    if (!connected) resetDisconnectedPractice();
  }, [connected]);

  const handlePracticeMoveEffect = useEffectEvent(handlePracticeMove);

  async function copyResearchMoves() {
    if (researchMovesRef.current.length === 0) return;
    try {
      await navigator.clipboard.writeText(researchMovesRef.current.join(" "));
      notifyFormulaSuccess(t("研究记录已复制"));
    } catch {
      notifyFormulaError(t("复制失败，请重试"));
    }
  }

  useEffect(() => subscribeMove(handlePracticeMoveEffect), [subscribeMove]);

  useEffect(() => {
    const cube = cubeApiRef.current;
    if (!cube) return;
    if (researchMode || !practiceActive) {
      cube.setHintMove(null);
      return;
    }
    const inWrongWait = practiceStatus.some((status) => status === "wrong");
    const expected = inWrongWait ? algoMoves[0] : algoMoves[practiceIndex];
    cube.setHintMove(expected ? hintMoveForDoubleTurnProgress(pendingPracticeMovesRef.current, expected) : null);
  }, [researchMode, practiceActive, practiceIndex, practiceStatus, algoMoves]);

  function play() {
    if (!cubeApiRef.current) return;
    if (researchModeRef.current) exitResearchMode();
    if (playingRef.current) stopPlayback();
    if (practiceActiveRef.current) resetPractice();
    clearPlayTimers();
    playingRef.current = true;
    setPlaybackActive(true);
    setPlaybackStatus(freshPracticeStatus(algoMoves.length));
    const playRun = playRunRef.current + 1;
    playRunRef.current = playRun;
    setPreviewStartState();
    algoMoves.forEach((move, index) => {
      const timer = window.setTimeout(() => {
        if (playRunRef.current !== playRun) return;
        cubeApiRef.current?.setHintMove(move);
        cubeApiRef.current?.applyMoves(expandMoveNotation(move), FORMULA_PLAY_MOVE_DURATION_MS);
        setPlaybackStatus((prev) => {
          const next = prev.length === algoMoves.length ? [...prev] : freshPracticeStatus(algoMoves.length);
          next[index] = "correct";
          return next;
        });
        if (index === algoMoves.length - 1) {
          const resetTimer = window.setTimeout(() => {
            if (playRunRef.current !== playRun) return;
            playingRef.current = false;
            setPlaybackActive(false);
            setPlaybackStatus(freshPracticeStatus(algoMoves.length));
            clearPlayTimers();
            cubeApiRef.current?.setHintMove(getCurrentPracticeHintMove());
            if (shouldSolveToReset) setPreviewStartState();
          }, FORMULA_PLAY_FINISH_DELAY_MS);
          playTimerRefs.current.push(resetTimer);
        }
      }, FORMULA_PLAY_START_DELAY_MS + index * FORMULA_PLAY_STEP_INTERVAL_MS);
      playTimerRefs.current.push(timer);
    });
  }

  const formulaPanel = (
          <div className="formula-primary-panel practice-card ui-info-panel">
            <div className="tr-section formula-main-section">
              <div className="formula-hero">
                <div className="formula-hero-image" aria-hidden="true">
                  {usesTopViewFormulaImage(active.sourceCat) && displayFacelets ? (
                    <FormulaTopViewImage
                      facelets={displayFacelets}
                      faceColors={formulaTopViewFaceColors}
                      arrows={active.caseArrows}
                      className="formula-top-view-svg formula-cube-svg-hero"
                    />
                  ) : active.caseImage ? (
                    <Image src={active.caseImage} alt="" width={96} height={96} />
                  ) : displayFacelets ? (
                    <FormulaCubeImage
                      facelets={displayFacelets}
                      faceColors={faceColors}
                      className="formula-cube-svg formula-cube-svg-hero"
                    />
                  ) : (
                    <span>{t(active.caseName)}</span>
                  )}
                </div>
                <div className="formula-hero-info">
                  <div className="formula-hero-title">
                    <div className="ui-section-title-line formula-detail-title-line">
                      <h2 className="ui-section-title"><span>{formulaTitle}</span></h2>

                    </div>
                    <b>{displayedMoveCount} MOVES</b>
                    <button
                      type="button"
                      className="ghost-link fm-mobile-choose"
                      aria-haspopup="dialog"
                      aria-controls="fm-mobile-library"
                      aria-expanded={formulaPickerOpen}
                      onClick={onChooseFormula}
                    >{t("切换公式")}</button>
                  </div>
                  <div className="formula-hero-tags" aria-label={t("公式信息")}>
                    <div className="formula-selection-tags">
                      {compactLayout && methods.length > 1 && (
                        <div
                          ref={methodMenuRef}
                          className="formula-status-menu-wrap"
                          onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) setMethodMenuOpen(false);
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setMethodMenuOpen(false);
                              event.currentTarget.querySelector<HTMLButtonElement>(".formula-method-select")?.focus();
                            }
                            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                            event.preventDefault();
                            setMethodMenuOpen(true);
                            const wrapper = event.currentTarget;
                            const key = event.key;
                            requestAnimationFrame(() => {
                              const options = Array.from(wrapper.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
                              const current = options.indexOf(document.activeElement as HTMLButtonElement);
                              const index = key === "Home" ? 0 : key === "End" ? options.length - 1 : current < 0 ? (key === "ArrowUp" ? options.length - 1 : 0) : (current + (key === "ArrowUp" ? -1 : 1) + options.length) % options.length;
                              options[index]?.focus();
                            });
                          }}
                          onKeyUp={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="formula-hero-tag formula-method-select"
                            aria-label={t("切换公式方法")}
                            aria-haspopup="menu"
                            aria-expanded={methodMenuOpen}
                            onClick={() => { setLearningMenuOpen(false); setMethodMenuOpen((open) => !open); }}
                          >
                            <span>{t(active.name)}</span><span className="formula-status-caret" aria-hidden="true" />
                          </button>
                          {methodMenuOpen && (
                            <div className="formula-status-menu formula-method-menu" role="menu" aria-label={t("切换公式方法")}>
                              {methods.map((method) => (
                                <button
                                  key={method.key}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={active.key === method.key}
                                  className={`formula-status-menu-option${active.key === method.key ? " active" : ""}`}
                                  onClick={() => { setMethodMenuOpen(false); onMethodChange(method.key); }}
                                >{t(method.name)}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className="formula-status-menu-wrap"
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) {
                            setLearningMenuOpen(false);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setLearningMenuOpen(false);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className={`formula-hero-tag formula-status-select status-${learningStatus}`}
                          aria-haspopup="menu"
                          aria-expanded={learningMenuOpen}
                          onClick={() => setLearningMenuOpen((open) => !open)}
                        >
                          <span>{learningStatusLabel}</span>
                          <span className="formula-status-caret" aria-hidden="true"></span>
                        </button>
                        {learningMenuOpen && (
                          <div className="formula-status-menu" role="menu" aria-label={t("切换学习状态")}>
                            {LEARNING_STATUSES.map((status) => (
                              <button
                                key={status.key}
                                type="button"
                                role="menuitemradio"
                                aria-checked={learningStatus === status.key}
                                className={`formula-status-menu-option status-${status.key}${learningStatus === status.key ? " active" : ""}`}
                                onClick={() => {
                                  onLearningStatusChange(status.key);
                                  setLearningMenuOpen(false);
                                }}
                              >
                                {t(status.label)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="formula-performance-tags">
                      <span className="formula-stat-text formula-detail-stat">
                        <span>{t("最佳")}</span>{"\u00a0"}{bestPracticeValue}
                      </span>
                      <span className="formula-stat-text formula-detail-stat formula-average-tag" tabIndex={0}>
                        <span>{t("稳定")}</span>{"\u00a0"}{formulaAverageLabel}
                        <span className="formula-average-popover" role="tooltip">
                          {formulaAverageDescription}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {researchMode ? (
                <div className="algo-display formula-research-log" aria-label={t("研究模式转动记录")}>
                  {researchMoves.length > 0 ? (
                    <div className="algo-row">
                      {researchMoves.map((move, index) => (
                        <AlgorithmStepToken
                          key={`${move}-${index}`}
                          move={move}
                          index={index}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="formula-research-empty">{t("转动魔方开始记录")}</div>
                  )}
                </div>
              ) : (
                <div ref={algorithmScrollRef} className="algo-display">
                  {algoRows.map((row, rowIndex) => (
                    <div key={`row-${rowIndex}`} className="algo-row">
                      {row.moves.map(({ move, index }) => (
                        <AlgorithmStepToken
                          key={`${move}-${index}`}
                          move={move}
                          index={index}
                          status={playbackActive ? playbackStatus[index] : practiceStatus[index]}
                          active={!playbackActive && practiceActive && index === practiceIndex}
                        />
                      ))}
                      {active.sourceCat !== "triggers" && (row.triggerName || row.structureNotation) && (
                        <span className="algo-trigger-name">{row.triggerName ? t(row.triggerName) : row.structureNotation}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {(canRotateF2lVariant || researchMode) && <div className="formula-practice-actions">
                {canRotateF2lVariant && !researchMode && (
                  <>
                    <button
                      className="mini-btn formula-rotate-btn practice-btn practice-btn-ghost"
                      onClick={rotateFormulaClockwise}
                      type="button"
                    >{t("顺时针旋转")}</button>
                    <button
                      className="mini-btn formula-rotate-btn practice-btn practice-btn-ghost"
                      onClick={rotateFormulaCounterClockwise}
                      type="button"
                    >{t("逆时针旋转")}</button>
                  </>
                )}
                {researchMode && (
                  <button className="mini-btn full primary practice-btn practice-btn-primary" onClick={() => void copyResearchMoves()} disabled={researchMoves.length === 0}>{t("复制记录")}</button>
                )}
              </div>}
            </div>
          </div>
  );
  const secondaryPanel = (
        <div className={`fm-side-bottom practice-card ui-info-panel${researchMode ? "" : " fm-side-bottom-stats"}`}>
          {researchMode ? (
            <div className="tr-section formula-keypad-section">
              <div className="formula-stats-head">
                <div className="practice-title-line formula-title-line">
                  <div className="practice-card-title formula-card-title">{t("公式键盘")}</div>
                  <span className="practice-kicker" aria-hidden="true">KEYPAD</span>
                </div>
              </div>
              <FormulaKeypad
                ariaLabel={t("研究模式公式键盘")}
                hasMoves={researchMoves.length > 0}
                onMove={applyResearchMove}
                onDelete={deleteResearchMove}
                onClear={clearResearchMoves}
                deleteLabel={t("删除")}
                clearLabel={t("清空")}
              />
            </div>
          ) : (
            <div className="tr-section formula-stats-section">
              <FormulaPracticeStats
                key={displayStatsKey}
                times={practiceStats.times}
                count={practiceStats.count}
                bestMs={practiceStats.bestMs}
                todayPracticeCount={todayPracticeCount}
                todayPracticeTone={todayPracticeTone}
                compact={smallScreen}
                t={t}
              />
            </div>
          )}

        </div>
  );

  return (
    <>
      <div className="fm-stage">
        <button
          type="button"
          className="ghost-link fm-mobile-choose"
          aria-haspopup="dialog"
          aria-controls="fm-mobile-library"
          aria-expanded={formulaPickerOpen}
          onClick={onChooseFormula}
        >{t("切换公式")}</button>
        <div className="formula-mode-switch" role="group" aria-label={t("公式模式")}>
          <button
            type="button"
            className={!researchMode ? "active" : ""}
            aria-pressed={!researchMode}
            onClick={() => {
              if (researchMode) exitResearchMode();
            }}
          >
            {t("练习")}
          </button>
          <button
            type="button"
            className={researchMode ? "active" : ""}
            aria-pressed={researchMode}
            onClick={() => {
              if (!researchMode) enterResearchMode();
            }}
          >
            {t("研究")}
          </button>
        </div>
        <div className="crosshair ch-tl"></div>
        <div className="crosshair ch-tr"></div>
        <div className="crosshair ch-bl"></div>
        <div className="crosshair ch-br"></div>
        <div className="cube-mount" ref={cubeMountRef}></div>
        <TurnSpeed />
        {!researchMode && (
          <div className="stage-timer-stack formula-stage-timer-stack">
            <div className={`timer formula-practice-timer${practiceTiming ? " timer-solving" : ""}`} aria-label={t("实时计时")}>
              <div className={`t-display${practiceTiming ? " t-active" : ""}`}>
                {fmtLiveSeconds(practiceMs)}
              </div>
            </div>
          </div>
        )}
        <div className="stage-controls" aria-label={t("公式显示控制")}>
          <button className={`ui-setting-action${playbackActive ? " active" : ""}`} onClick={play} type="button">
            {t("播放公式")}</button>
          <button className="ui-setting-action" onClick={resetDisplayOrientation} disabled={!viewResetEnabled} type="button">
            {t("视角归位")}</button>
          {canUseTransparentDisplay ? (
            <button
              className={`ui-setting-action${transparentDisplay ? " active" : ""}`}
              onClick={toggleTransparentDisplay}
              aria-pressed={transparentDisplay}
              type="button"
            >
              {t("透明显示")}</button>
          ) : null}
          {canUseFocusMode ? (
            <button
              className={`ui-setting-action${lowerLayerHidden ? " active" : ""}`}
              onClick={toggleLowerLayerHidden}
              aria-pressed={lowerLayerHidden}
              type="button"
            >
              {t("专注模式")}</button>
          ) : null}
        </div>
      </div>
      <div className={`fm-side${researchMode ? " is-research" : " is-practice"}`}>
        {smallScreen && !researchMode ? (
          <PracticeMobilePanels panels={[formulaPanel, secondaryPanel]} />
        ) : (
          <>
            <div className="formula-info-stack">{formulaPanel}</div>
            {secondaryPanel}
          </>
        )}
      </div>
    </>
  );
}
