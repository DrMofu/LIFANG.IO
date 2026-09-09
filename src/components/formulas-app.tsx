"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { AlgorithmStepToken } from "@/components/algorithm-step-token";
import { AppFooter, AppTopbar } from "@/components/app-shell";
import { useLanguage } from "@/components/language-provider";
import { useCubeAppearance } from "@/components/cube-appearance-provider";
import { useCubeConnection } from "@/components/cube-connection-provider";
import { FormulaCubeImage, FormulaTopViewImage } from "@/components/formula-cube-image";
import { FormulaKeypad } from "@/components/formula-keypad";
import { FormulaPracticeStats } from "@/components/formula-practice-stats";
import { FORMULA_STATS_LIMIT } from "@/lib/formula-time-distribution";
import { MoveToken } from "@/components/move-token";
import {
  appendNormalizedMoveLogMove,
  compressMoveSequence,
  createMoveCoordinateState,
  expandMoveNotation,
  hintMoveForDoubleTurnProgress,
  invertMoveNotation,
  isRotationMoveNotation,
  movePartiallyMatchesExpectedDoubleTurn,
  moveCanStillMatchExpected,
  movesMatchExpected,
  normalizeMoveCoordinate,
  parseAlgorithm,
  parseMoveNotation,
  shouldAnimateExpectedSliceMoveAfterMatch,
  shouldAnimateExpectedWideMoveAfterMatch,
  shouldDeferExpectedSliceMoveAnimation,
  shouldDeferExpectedWideMoveAnimation,
  updateMoveCoordinateStateAfterMatch,
  updateMoveCoordinateStateAfterMove,
  updateMoveCoordinateStateAfterRotationMove,
  type MoveCoordinateState,
} from "@/lib/algorithms";
import { getFaceHexColors } from "@/lib/cube-appearance";
import { normalizeFormulaRotationOffset, rotateAlgorithmByYOffset, rotateFaceletsByYOffset, type FormulaRotationOffset } from "@/lib/formula-rotation";
import {
  FORMULAS,
  OLL_SHAPES,
  type FormulaArrow,
  type FormulaItem,
  type FormulaVariant as FormulaVariantData,
  type OllShape,
} from "@/lib/formulas-data";
import { fmtShort } from "@/lib/format";
import {
  DEFAULT_AVERAGE_TIME_SETTINGS,
  calculateAverageTime,
  describeAverageTimeSettings,
  loadAverageTimeSettings,
  type AverageTimeSettings,
} from "@/lib/average-time";
import { CUBE_CAMERA_PRESETS } from "@/lib/cube-camera-presets";
import {
  FORMULA_LEARNING_STATUSES as LEARNING_STATUSES,
  getFormulaLearningStatus as getLearningStatus,
  isFormulaLearningStatus as isLearningStatus,
  readFormulaLearningStatuses as readLearningStatuses,
  saveFormulaLearningStatuses as saveLearningStatuses,
  type FormulaLearningStatus as LearningStatus,
} from "@/lib/formula-learning-status";
import { type CubeFace, type SmartCubeApi, mountSmartCube } from "@/lib/smart-cube";
import { getArchiveScopedStorageKey, subscribeStatisticsArchiveChange } from "@/lib/solve-history";

type FormulaKey = keyof typeof FORMULAS;
type FormulaViewKey = FormulaKey | "favorites";
type FormulaVariantItem = FormulaVariantData & {
  key: string;
  caseId: string;
  caseName: string;
  caseImage?: string;
  caseFacelets?: string;
  caseArrows?: FormulaArrow[];
  sourceCat: FormulaKey;
  sourceName: string;
  sourceFull: string;
};

const FORMULAS_CUBE_CAMERA_PRESET = CUBE_CAMERA_PRESETS.formulas;
type FormulaCaseItem = FormulaItem & {
  sourceCat: FormulaKey;
  sourceName: string;
  sourceFull: string;
  variants: FormulaVariantItem[];
};
type PracticeStatus = "pending" | "partial" | "correct" | "wrong";
type LearningStatusFilter = "all" | LearningStatus;
type OllShapeFilter = "all" | OllShape;
type FormulaTip = {
  title: string;
  sourceName: string;
  variants: FormulaVariantItem[];
  left: number;
  top: number;
};

const FAV_KEY = "formula-favs";
const STATE_KEY = "formula-state";
const STATS_KEY = "formula-practice-stats";
const FOCUS_MODE_KEY = "formula-focus-mode";
const FORMULA_PLAY_START_DELAY_MS = 0;
const FORMULA_PLAY_STEP_INTERVAL_MS = 1000;
const FORMULA_PLAY_MOVE_DURATION_MS = 600;
const FORMULA_PLAY_FINISH_DELAY_MS = 2000;
const FORMULA_TOAST_FADE_MS = 260;
const MAX_STRUCTURE_NOTATION_MOVE_COUNT = 5;
const TRIGGER_NAME_BY_ALGORITHM = new Map(
  FORMULAS.triggers.items.flatMap((item) => {
    const triggers: Array<readonly [string, string]> = [
      ...(item.algo ? [[item.algo, item.name] as const] : []),
      ...(item.algos?.map((variant) => [variant.algo, variant.name] as const) ?? []),
    ];
    return triggers.map(([algorithm, name]) => [parseAlgorithm(algorithm).join("\u0000"), name] as const);
  }),
);
const STATUS_FILTERS: Array<{ key: LearningStatusFilter; label: string }> = [
  { key: "all", label: "全部" },
  ...LEARNING_STATUSES.map(({ key, label }) => ({ key, label })),
];
const OLL_SHAPE_LABELS: Record<OllShape, string> = {
  "all-corners-oriented": "formula.shape.allCornersOriented",
  awkward: "formula.shape.awkward",
  c: "formula.shape.c",
  dot: "formula.shape.dot",
  fish: "formula.shape.fish",
  "knight-move": "formula.shape.knightMove",
  l: "formula.shape.l",
  lightning: "formula.shape.lightning",
  line: "formula.shape.line",
  ocll: "formula.shape.ocll",
  p: "formula.shape.p",
  square: "formula.shape.square",
  t: "formula.shape.t",
  w: "formula.shape.w",
};
const OLL_SHAPE_OPTIONS: readonly OllShapeFilter[] = ["all", ...OLL_SHAPES];
const OLL_SHAPE_PREVIEW_CASES = Object.fromEntries(
  OLL_SHAPES.map((shape) => [shape, FORMULAS.oll.items.find((item) => item.shape === shape)]),
) as Record<OllShape, FormulaItem | undefined>;
const FORMULA_ROTATION_SUFFIX: Record<Exclude<FormulaRotationOffset, 0>, string> = {
  1: "@view-y",
  2: "@view-y2",
  3: "@view-y-prime",
};
type FormulaStats = {
  count: number;
  times: number[];
  bestMs?: number;
  todayKey?: string;
  todayCount?: number;
};

function OllShapeSelectField({
  id,
  selected,
  faceColors,
  onSelect,
}: {
  id: string;
  selected: OllShapeFilter;
  faceColors: Record<CubeFace, string>;
  onSelect(shape: OllShapeFilter): void;
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = selected === "all" ? "formula.shape.all" : OLL_SHAPE_LABELS[selected];

  function handleSelect(shape: OllShapeFilter) {
    onSelect(shape);
    setIsOpen(false);
  }

  function renderPreview(shape: OllShapeFilter, className: string) {
    if (shape === "all") {
      return (
        <span className={`${className} fm-shape-all-preview`} aria-hidden="true">
          <i></i><i></i><i></i><i></i>
        </span>
      );
    }

    const previewCase = OLL_SHAPE_PREVIEW_CASES[shape];
    const facelets = previewCase?.facelets ?? previewCase?.algos?.find((variant) => variant.facelets)?.facelets;
    if (!previewCase || !facelets) return <span className={`${className} fm-shape-preview-empty`} aria-hidden="true"></span>;

    return (
      <FormulaTopViewImage
        facelets={facelets}
        faceColors={faceColors}
        arrows={previewCase.arrows}
        className={className}
      />
    );
  }

  return (
    <div
      className={`fm-shape-select-wrap${isOpen ? " open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        className="fm-shape-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
        }}
      >
        {renderPreview(selected, "fm-shape-select-trigger-preview")}
        <span className="fm-shape-select-label">{t(selectedLabel)}</span>
      </button>
      {isOpen && (
        <div id={`${id}-menu`} className="fm-shape-select-menu" role="listbox" aria-labelledby={id}>
          {OLL_SHAPE_OPTIONS.map((shape) => {
            const isSelected = selected === shape;
            const label = shape === "all" ? "formula.shape.all" : OLL_SHAPE_LABELS[shape];
            return (
              <button
                key={shape}
                type="button"
                className={`fm-shape-select-option${isSelected ? " selected" : ""}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(shape)}
              >
                {renderPreview(shape, "fm-shape-select-option-preview")}
                <span>{t(label)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LearningStatusSelectField({
  selected,
  onSelect,
}: {
  selected: LearningStatusFilter;
  onSelect(status: LearningStatusFilter): void;
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = STATUS_FILTERS.find((status) => status.key === selected) ?? STATUS_FILTERS[0];

  function handleSelect(status: LearningStatusFilter) {
    onSelect(status);
    setIsOpen(false);
  }

  return (
    <div
      className={`fm-status-select-wrap${isOpen ? " open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        type="button"
        className="fm-status-select-trigger"
        aria-label={t("学习状态筛选")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="formula-status-filter-menu"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
          if (event.key === "ArrowDown") setIsOpen(true);
        }}
      >
        <span className="fm-status-select-label">{t(selectedOption.label)}</span>
        <svg className="fm-status-select-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <div id="formula-status-filter-menu" className="fm-status-select-menu" role="listbox">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status.key}
              type="button"
              className={`fm-status-select-option status-${status.key}${selected === status.key ? " selected" : ""}`}
              role="option"
              aria-selected={selected === status.key}
              onClick={() => handleSelect(status.key)}
            >
              <span>{t(status.label)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function isLearningStatusFilter(value: unknown): value is LearningStatusFilter {
  return value === "all" || isLearningStatus(value);
}

function isOllShapeFilter(value: unknown): value is OllShapeFilter {
  return OLL_SHAPE_OPTIONS.some((shape) => shape === value);
}

function isFormulaStats(value: unknown): value is FormulaStats {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as FormulaStats).count === "number" &&
    Array.isArray((value as FormulaStats).times)
  );
}

function normalizeFormulaStats(stats: FormulaStats): FormulaStats {
  const times = stats.times.filter((time) => Number.isFinite(time) && time > 0).slice(-FORMULA_STATS_LIMIT);
  const storedBest = typeof stats.bestMs === "number" && Number.isFinite(stats.bestMs) && stats.bestMs > 0 ? stats.bestMs : null;
  const visibleBest = times.length > 0 ? Math.min(...times) : null;
  const bestMs = storedBest ?? visibleBest ?? undefined;
  return {
    ...stats,
    times,
    bestMs,
  };
}

function formulaVariantKey(caseId: string, variantId: string) {
  return `${caseId}:${variantId}`;
}

function formulaPracticeStatsKey(baseKey: string, sourceCat: FormulaKey, rotationOffset: FormulaRotationOffset) {
  if (sourceCat !== "f2l" || rotationOffset === 0) return baseKey;
  return `${baseKey}${FORMULA_ROTATION_SUFFIX[rotationOffset]}`;
}

function hasFormulaVariantKey(cat: FormulaKey, key: string) {
  const [caseId, variantId, extra] = key.split(":");
  if (!caseId || !variantId || extra) return false;
  const item = FORMULAS[cat].items.find((candidate) => candidate.id === caseId);
  if (!item) return false;
  if (item.algos?.length) return item.algos.some((variant) => (variant.id || "") === variantId);
  return Boolean(item.algo) && variantId === "main";
}

function normalizeFormulaCase(item: FormulaItem, sourceCat: FormulaKey, sourceName: string, sourceFull: string): FormulaCaseItem {
  const rawVariants = item.algos?.length
    ? item.algos
    : item.algo
      ? [{ id: "main", name: "主公式", algo: item.algo }]
      : [];
  const variants = rawVariants.map((variant, index) => {
    const variantId = variant.id || `v${index + 1}`;
    return {
      id: variantId,
      key: formulaVariantKey(item.id, variantId),
      name: variant.name || (variantId === "main" ? "主公式" : `公式 ${index + 1}`),
      description: variant.description ?? item.description,
      algo: variant.algo,
      caseId: item.id,
      caseName: item.name,
      caseImage: item.image,
      caseFacelets: variant.facelets ?? item.facelets,
      caseArrows: item.arrows,
      sourceCat,
      sourceName,
      sourceFull,
    };
  });
  return {
    ...item,
    sourceCat,
    sourceName,
    sourceFull,
    variants,
  };
}

function findVariantByKey(cases: FormulaCaseItem[], key: string) {
  for (const item of cases) {
    const variant = item.variants.find((candidate) => candidate.key === key);
    if (variant) return variant;
  }
  return null;
}

function caseHasVariantKey(item: FormulaCaseItem, key: string) {
  return item.variants.some((variant) => variant.key === key);
}

function getTotalVariantCount(item: FormulaCaseItem) {
  return item.algos?.length || (item.algo ? 1 : item.variants.length);
}

function caseUsesVariantList(item: FormulaCaseItem) {
  return Boolean(item.algos);
}

function usesTopViewFormulaImage(sourceCat: FormulaKey) {
  return sourceCat === "oll" || sourceCat === "pll";
}

function getFormulaCasePreviewFacelets(item: FormulaCaseItem) {
  return item.facelets ?? item.variants.find((variant) => variant.caseFacelets)?.caseFacelets;
}

function getCaseStats(item: FormulaCaseItem, statsByVariant: Record<string, FormulaStats>) {
  return item.variants.reduce<FormulaStats>(
    (total, variant) => {
      const stats = statsByVariant[variant.key];
      if (!stats) return total;
      return {
        count: total.count + stats.count,
        times: [...total.times, ...stats.times].slice(-FORMULA_STATS_LIMIT),
        bestMs: [total.bestMs, stats.bestMs].filter((time): time is number => typeof time === "number").sort((a, b) => a - b)[0],
        todayKey: getLocalDayKey(),
        todayCount: (total.todayCount ?? 0) + getTodayPracticeCount(stats),
      };
    },
    { count: 0, times: [], todayKey: getLocalDayKey(), todayCount: 0 },
  );
}

function getCaseLearningCounts(item: FormulaCaseItem, statuses: Record<string, LearningStatus>) {
  return item.variants.reduce(
    (counts, variant) => {
      const status = getLearningStatus(statuses, variant.key);
      if (status === "learning") counts.learning += 1;
      if (status === "mastered") counts.mastered += 1;
      return counts;
    },
    { learning: 0, mastered: 0 },
  );
}

function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayPracticeCount(stats: FormulaStats) {
  return stats.todayKey === getLocalDayKey() ? stats.todayCount ?? 0 : 0;
}

function getTodayPracticeTone(count: number) {
  if (count >= 50) return "gold";
  if (count >= 10) return "silver";
  if (count >= 1) return "bronze";
  return "idle";
}

function readAllFormulaStats(): Record<string, FormulaStats> {
  if (typeof window === "undefined") return {};
  try {
    const all = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(STATS_KEY)) || "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(all)
        .filter((entry): entry is [string, FormulaStats] => isFormulaStats(entry[1]))
        .map(([key, value]) => [key, normalizeFormulaStats(value)]),
    );
  } catch {
    return {};
  }
}

function readFormulaStats(id: string): FormulaStats {
  if (typeof window === "undefined") return { count: 0, times: [] };
  try {
    const all = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(STATS_KEY)) || "{}") as Record<string, FormulaStats>;
    const s = all[id];
    if (isFormulaStats(s)) return normalizeFormulaStats(s);
  } catch {}
  return { count: 0, times: [] };
}

function saveFormulaCompletion(id: string, ms: number): FormulaStats {
  try {
    const all = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(STATS_KEY)) || "{}") as Record<string, FormulaStats>;
    const prev = isFormulaStats(all[id]) ? normalizeFormulaStats(all[id]) : { count: 0, times: [] };
    const todayKey = getLocalDayKey();
    const next: FormulaStats = {
      count: prev.count + 1,
      times: [...prev.times, ms].slice(-FORMULA_STATS_LIMIT),
      bestMs: prev.bestMs == null ? ms : Math.min(prev.bestMs, ms),
      todayKey,
      todayCount: prev.todayKey === todayKey ? (prev.todayCount ?? 0) + 1 : 1,
    };
    all[id] = next;
    window.localStorage.setItem(getArchiveScopedStorageKey(STATS_KEY), JSON.stringify(all));
    return next;
  } catch {
    return { count: 1, times: [ms], todayKey: getLocalDayKey(), todayCount: 1 };
  }
}

function readFavs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(FAV_KEY)) || "[]");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === "string"))];
  } catch {
    return [];
  }
}

function saveFavs(favs: string[]) {
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(FAV_KEY), JSON.stringify(favs));
  } catch {}
}

function readFocusModeEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getArchiveScopedStorageKey(FOCUS_MODE_KEY)) === "1";
  } catch {
    return false;
  }
}

function saveFocusModeEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(FOCUS_MODE_KEY), enabled ? "1" : "0");
  } catch {}
}

function fmtLiveSeconds(ms: number) {
  return (ms / 1000).toFixed(2);
}

function getDefaultFormulaState() {
  return {
    cat: "pll" as FormulaViewKey,
    activeKey: formulaVariantKey(FORMULAS.pll.items[0].id, "main"),
    showFavOnly: false,
    statusFilter: "all" as LearningStatusFilter,
    ollShapeFilter: "all" as OllShapeFilter,
  };
}

function readFormulaState(): {
  cat: FormulaViewKey;
  activeKey: string;
  showFavOnly: boolean;
  statusFilter: LearningStatusFilter;
  ollShapeFilter: OllShapeFilter;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getArchiveScopedStorageKey(STATE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.cat === "string" &&
      typeof parsed.activeId === "string"
    ) {
      const showFavOnly = typeof parsed.showFavOnly === "boolean" ? parsed.showFavOnly : false;
      const statusFilter = isLearningStatusFilter(parsed.statusFilter) ? parsed.statusFilter : "all";
      const ollShapeFilter = isOllShapeFilter(parsed.ollShapeFilter) ? parsed.ollShapeFilter : "all";
      if (parsed.cat === "favorites") {
        return parsed.activeId.includes(":")
          ? { cat: "favorites", activeKey: parsed.activeId, showFavOnly, statusFilter, ollShapeFilter }
          : null;
      }
      if (!(parsed.cat in FORMULAS)) return null;
      const cat = parsed.cat as FormulaKey;
      if (hasFormulaVariantKey(cat, parsed.activeId)) {
        return { cat, activeKey: parsed.activeId, showFavOnly, statusFilter, ollShapeFilter };
      }
    }
  } catch {
    // fall through to null
  }
  return null;
}

function saveFormulaState(state: {
  cat: FormulaViewKey;
  activeKey: string;
  showFavOnly: boolean;
  statusFilter: LearningStatusFilter;
  ollShapeFilter: OllShapeFilter;
}) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(STATE_KEY), JSON.stringify({
      cat: state.cat,
      activeId: state.activeKey,
      showFavOnly: state.showFavOnly,
      statusFilter: state.statusFilter,
      ollShapeFilter: state.ollShapeFilter,
    }));
  } catch {
    // local storage may be unavailable
  }
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
}

function getFormulaNavigationDirection(event: KeyboardEvent) {
  if (event.key === "ArrowDown") return 1;
  if (event.key === "ArrowUp") return -1;
  return 0;
}

function freshPracticeStatus(length: number) {
  return Array.from({ length }, () => "pending" as PracticeStatus);
}

function formatListStats(stats: FormulaStats | undefined, averageSettings: AverageTimeSettings) {
  if (!stats || stats.count <= 0) return { best: "--", stable: "--" };
  const average = calculateAverageTime(stats.times, averageSettings);
  return {
    best: stats.bestMs ? fmtShort(stats.bestMs) : "--",
    stable: average ? fmtShort(average.valueMs) : "--",
  };
}

function renderAlgorithmWithGroups(algo: string) {
  const parts = algo
    .split(/(\s+|[()])/)
    .filter((part) => part.length > 0 && !/^\s+$/.test(part));

  return parts.map((part, index) => {
      if (part === "(" || part === ")") {
        return (
          <span key={`${part}-${index}`} className={`algo-group-mark algo-group-${part === "(" ? "open" : "close"}`}>
            {part}
          </span>
        );
      }
      const move = parseMoveNotation(part);
      const tokenClassName = [
        parts[index - 1] === "(" ? "move-token-after-open" : "",
        parts[index + 1] === ")" ? "move-token-before-close" : "",
      ].filter(Boolean).join(" ");
      return move ? (
        <MoveToken key={`${part}-${index}`} move={part} className={tokenClassName} />
      ) : (
        <span key={`${part}-${index}`} className="algo-group-text">
          {part}
        </span>
    );
  });
}

function FormulaDescription({ description }: { description?: string }) {
  const { t } = useLanguage();
  if (!description) return null;
  return <span className="formula-description">{t(description)}</span>;
}

function sequenceIsInverseOf(sequence: string[], source: string[]) {
  return sequence.length === source.length && sequence.every(
    (move, index) => move === invertMoveNotation(source[source.length - index - 1]),
  );
}

function getTriggerName(moves: string[]) {
  return TRIGGER_NAME_BY_ALGORITHM.get(
    moves
      .map((move) => parseMoveNotation(move)?.notation ?? move)
      .join("\u0000"),
  );
}

function formatAlgorithmPart(moves: string[]) {
  return getTriggerName(moves) ?? moves.join(" ");
}

function getCommutatorOrConjugateNotation(moves: string[]) {
  const normalizedMoves = moves.map((move) => parseMoveNotation(move)?.notation ?? move);
  const halfLength = normalizedMoves.length / 2;

  if (Number.isInteger(halfLength)) {
    for (let aLength = 1; aLength < halfLength; aLength += 1) {
      const bLength = halfLength - aLength;
      const a = normalizedMoves.slice(0, aLength);
      const b = normalizedMoves.slice(aLength, halfLength);
      const aInverse = normalizedMoves.slice(halfLength, halfLength + aLength);
      const bInverse = normalizedMoves.slice(halfLength + aLength);

      if (sequenceIsInverseOf(aInverse, a) && sequenceIsInverseOf(bInverse, b)) {
        return `[${formatAlgorithmPart(moves.slice(0, aLength))}, ${formatAlgorithmPart(moves.slice(aLength, aLength + bLength))}]`;
      }
    }
  }

  for (let aLength = 1; aLength * 2 < normalizedMoves.length; aLength += 1) {
    const a = normalizedMoves.slice(0, aLength);
    const aInverse = normalizedMoves.slice(-aLength);

    if (sequenceIsInverseOf(aInverse, a)) {
      return `[${formatAlgorithmPart(moves.slice(0, aLength))}: ${formatAlgorithmPart(moves.slice(aLength, -aLength))}]`;
    }
  }

  return undefined;
}

function groupAlgorithmRows(algo: string) {
  const rows: Array<{
    moves: Array<{ move: string; index: number }>;
  }> = [];
  let current: Array<{ move: string; index: number }> = [];
  let moveIndex = 0;

  function pushCurrent() {
    if (current.length === 0) return;
    rows.push({ moves: current });
    current = [];
  }

  algo
    .trim()
    .split(/\s+/)
    .forEach((token) => {
      const opens = token.includes("(");
      const closes = token.includes(")");
      const displayMove = token.replace(/[()]/g, "");
      const parsed = parseMoveNotation(displayMove);

      if (opens) {
        pushCurrent();
      }

      if (parsed) {
        current.push({ move: displayMove, index: moveIndex });
        moveIndex += 1;
      }

      if (closes) {
        pushCurrent();
      }
    });

  pushCurrent();
  return rows.map((row) => {
    const moves = row.moves.map(({ move }) => move);
    const triggerName = getTriggerName(moves);

    return {
      ...row,
      triggerName,
      structureNotation:
        triggerName || moves.length > MAX_STRUCTURE_NOTATION_MOVE_COUNT
          ? undefined
          : getCommutatorOrConjugateNotation(moves),
    };
  });
}

function FormulaStage({
  active,
  shouldSolveToReset,
  onStatsChange,
  learningStatus,
  onLearningStatusChange,
  averageSettings,
}: {
  active: FormulaVariantItem;
  shouldSolveToReset: boolean;
  onStatsChange(id: string, stats: FormulaStats): void;
  learningStatus: LearningStatus;
  onLearningStatusChange(status: LearningStatus): void;
  averageSettings: AverageTimeSettings;
}) {
  const { t } = useLanguage();
  const cubeMountRef = useRef<HTMLDivElement | null>(null);
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
  const practiceToastTimerRef = useRef<number | null>(null);
  const pbToastTimerRef = useRef<number | null>(null);
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
  const [practiceToast, setPracticeToast] = useState<string | null>(null);
  const [practiceToastFading, setPracticeToastFading] = useState(false);
  const [pbToast, setPbToast] = useState<string | null>(null);
  const [pbToastFading, setPbToastFading] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [transparentDisplay, setTransparentDisplay] = useState(false);
  const [lowerLayerHidden, setLowerLayerHidden] = useState(false);
  const [researchMoves, setResearchMoves] = useState<string[]>([]);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [learningMenuOpen, setLearningMenuOpen] = useState(false);
  const [viewResetEnabled, setViewResetEnabled] = useState(false);

  const {
    connectionState,
    connectRealCube,
    subscribeMove,
  } = useCubeConnection();
  const { orientation, faceColors, renderMaxFps, backFaceProjectionEnabled, backFaceProjectionDistance } = useCubeAppearance();
  const formulaTopViewFaceColors = useMemo(() => getFaceHexColors(orientation, "cubing-js"), [orientation]);

  const connected = connectionState === "connected";
  const learningStatusLabel = t(LEARNING_STATUSES.find((status) => status.key === learningStatus)?.shortLabel ?? "未学习");
  const canUseFocusMode = active.sourceCat === "oll" || active.sourceCat === "pll";
  const canUseTransparentDisplay = active.sourceCat === "cross";
  const showVariantTag = active.name !== "主公式";
  const formulaTitle = showVariantTag ? `${t(active.caseName)} · ${t(active.name)}` : t(active.caseName);
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
    let nextIndex = startIndex;
    const nextStatuses = [...statuses];
    while (nextIndex < algoMoves.length && isRotationMoveNotation(algoMoves[nextIndex])) {
      nextStatuses[nextIndex] = "correct";
      cubeApiRef.current?.applyMoves(expandMoveNotation(algoMoves[nextIndex]), durationMs);
      moveCoordinateRef.current = updateMoveCoordinateStateAfterRotationMove(moveCoordinateRef.current, algoMoves[nextIndex]);
      nextIndex += 1;
    }
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

  function clearPracticeToastTimer() {
    if (practiceToastTimerRef.current !== null) {
      window.clearTimeout(practiceToastTimerRef.current);
      practiceToastTimerRef.current = null;
    }
  }

  function clearPbToastTimer() {
    if (pbToastTimerRef.current !== null) {
      window.clearTimeout(pbToastTimerRef.current);
      pbToastTimerRef.current = null;
    }
  }

  function showPracticeToast(message: string) {
    clearPracticeToastTimer();
    setPracticeToastFading(false);
    setPracticeToast(message);
    practiceToastTimerRef.current = window.setTimeout(() => {
      setPracticeToastFading(true);
      practiceToastTimerRef.current = window.setTimeout(() => {
        practiceToastTimerRef.current = null;
        setPracticeToast(null);
        setPracticeToastFading(false);
      }, FORMULA_TOAST_FADE_MS);
    }, 2400);
  }

  function showPbToast(message: string) {
    clearPbToastTimer();
    setPbToastFading(false);
    setPbToast(message);
    pbToastTimerRef.current = window.setTimeout(() => {
      setPbToastFading(true);
      pbToastTimerRef.current = window.setTimeout(() => {
        pbToastTimerRef.current = null;
        setPbToast(null);
        setPbToastFading(false);
      }, FORMULA_TOAST_FADE_MS);
    }, 3200);
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
    clearPracticeToastTimer();
    setPracticeToast(null);
    setPracticeToastFading(false);
    wrongWaitRef.current = false;
    pendingPracticeMovesRef.current = [];
    pendingPracticeAnimatedCountRef.current = 0;
    pendingPracticeAnimatedPartialRef.current = null;
    moveCoordinateRef.current = createMoveCoordinateState();
    practiceIndexRef.current = 0;
    inRoundRef.current = false;
    roundStartRef.current = performance.now();
    if (resetMs) setPracticeMs(0);
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
    clearPbToastTimer();
    setPbToast(null);
    setPbToastFading(false);
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
    clearPbToastTimer();
    setPbToast(null);
    setPbToastFading(false);
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
      if (isTextEntryTarget(event.target)) return;
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
      backFaceProjectionDistance,
      defaultDisplayState: FORMULAS_CUBE_CAMERA_PRESET.displayState,
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
      clearPracticeToastTimer();
      clearPbToastTimer();
      api.dispose();
      if (cubeApiRef.current === api) cubeApiRef.current = null;
    };
  }, [algoMoves, backFaceProjectionEnabled, canUseFocusMode, displayFacelets, faceColors, orientation, renderMaxFps, setupMoves, shouldSolveToReset]);

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

  function beginPractice() {
    if (!connected) return;
    stopPlayback();
    practiceActiveRef.current = true;
    setPracticeActive(true);
    prepareRound();
  }

  function animatePracticeMoves(moves: string[]) {
    moves.forEach((move) => {
      cubeApiRef.current?.applyMoves(expandMoveNotation(move), 180);
    });
  }

  function animateUnplayedPracticeMoves(moves: string[], fallbackMove?: string) {
    const unplayed = moves.slice(pendingPracticeAnimatedCountRef.current);
    if (unplayed.length > 0) {
      animatePracticeMoves(unplayed);
    } else if (fallbackMove) {
      animatePracticeMoves([fallbackMove]);
    }
    pendingPracticeAnimatedCountRef.current = 0;
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

    if (movesMatchExpected(pendingPracticeMovesRef.current, expected)) {
      const shouldAnimateExpectedMove =
        shouldAnimateExpectedSliceMoveAfterMatch(pendingPracticeMovesRef.current, expected) ||
        shouldAnimateExpectedWideMoveAfterMatch(pendingPracticeMovesRef.current, expected);
      const animatedPartialMove = pendingPracticeAnimatedPartialRef.current;
      if (shouldAnimateExpectedMove && animatedPartialMove) {
        // The first quarter of an emulated slice or wide double turn was already rendered.
        // Render only the second quarter instead of replaying the whole double turn.
        animatePracticeMoves([animatedPartialMove]);
        pendingPracticeAnimatedCountRef.current = 0;
      } else {
        animateUnplayedPracticeMoves(
          shouldAnimateExpectedMove
            ? [expected]
            : pendingPracticeMovesRef.current,
          expected,
        );
      }
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
          showPbToast(t(`${fmtShort(elapsed)} 打破最佳成绩！`));
        }
        nextRoundTimerRef.current = window.setTimeout(() => {
          nextRoundTimerRef.current = null;
          if (practiceActiveRef.current) prepareRound();
        }, 900);
      }
    } else if (moveCanStillMatchExpected(pendingPracticeMovesRef.current, expected)) {
      const shouldDeferSliceAnimation = shouldDeferExpectedSliceMoveAnimation(
        pendingPracticeMovesRef.current,
        expected,
      );
      const partialSliceAnimationMove =
        shouldDeferSliceAnimation &&
        movePartiallyMatchesExpectedDoubleTurn(pendingPracticeMovesRef.current, expected)
          ? compressMoveSequence(pendingPracticeMovesRef.current)[0]
          : undefined;
      const shouldDeferWideAnimation = shouldDeferExpectedWideMoveAnimation(
        pendingPracticeMovesRef.current,
        expected,
      );
      const shouldDeferAnimation = shouldDeferSliceAnimation || shouldDeferWideAnimation;
      const partialWideAnimationMove =
        shouldDeferWideAnimation &&
        movePartiallyMatchesExpectedDoubleTurn(pendingPracticeMovesRef.current, expected)
          ? hintMoveForDoubleTurnProgress(pendingPracticeMovesRef.current, expected)
          : undefined;
      const partialAnimationMove = partialSliceAnimationMove ?? partialWideAnimationMove;
      if (partialAnimationMove && !pendingPracticeAnimatedPartialRef.current) {
        // Show the known first quarter immediately while keeping the formula step partial.
        animatePracticeMoves([partialAnimationMove]);
        pendingPracticeAnimatedCountRef.current = pendingPracticeMovesRef.current.length;
        pendingPracticeAnimatedPartialRef.current = partialAnimationMove;
      } else if (!shouldDeferAnimation) {
        animatePracticeMoves([normalizedMove]);
        pendingPracticeAnimatedCountRef.current = pendingPracticeMovesRef.current.length;
      }
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
      animateUnplayedPracticeMoves(pendingPracticeMovesRef.current);
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
      showPracticeToast(t(`转动错误，检测到${detected}，应该为${expected}，请重新开始`));
    }
  }

  const handlePracticeMoveEffect = useEffectEvent(handlePracticeMove);

  async function copyResearchMoves() {
    if (researchMovesRef.current.length === 0) return;
    try {
      await navigator.clipboard.writeText(researchMovesRef.current.join(" "));
      showPbToast(t("研究记录已复制"));
    } catch {
      showPracticeToast(t("复制失败，请重试"));
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

  return (
    <>
      <div className="fm-stage">
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
        {practiceToast && (
          <div className={`formula-practice-toast${practiceToastFading ? " fading" : ""}`} role="status" aria-live="polite">
            {practiceToast}
          </div>
        )}
        {pbToast && (
          <div className={`formula-practice-toast formula-pb-toast${practiceToast ? " stacked" : ""}${pbToastFading ? " fading" : ""}`} role="status" aria-live="polite">
            {pbToast}
          </div>
        )}
        <div className="cube-mount" ref={cubeMountRef}></div>
        {!researchMode && (
          <div className="stage-timer-stack formula-stage-timer-stack">
            <div className={`timer formula-practice-timer${practiceTiming ? " timer-solving" : ""}`} aria-label={t("实时计时")}>
              <div className={`t-display${practiceTiming ? " t-active" : ""}`}>
                {fmtLiveSeconds(practiceMs)}
                <span className="t-unit">s</span>
              </div>
            </div>
          </div>
        )}
        <div className="stage-controls" aria-label={t("公式显示控制")}>
          <button className={`sc-btn${playbackActive ? " active" : ""}`} onClick={play} type="button">
            <span className="sc-key" aria-hidden="true">P</span>{t("播放公式")}</button>
          <button className="sc-btn" onClick={resetDisplayOrientation} disabled={!viewResetEnabled} type="button">
            <span className="sc-key" aria-hidden="true">R</span>{t("视角归位")}</button>
          {canUseTransparentDisplay ? (
            <button
              className={`sc-btn${transparentDisplay ? " active" : ""}`}
              onClick={toggleTransparentDisplay}
              type="button"
            >
              <span className="sc-key" aria-hidden="true">T</span>{t("透明显示")}</button>
          ) : null}
          {canUseFocusMode ? (
            <button
              className={`sc-btn${lowerLayerHidden ? " active" : ""}`}
              onClick={toggleLowerLayerHidden}
              type="button"
            >
              <span className="sc-key" aria-hidden="true">H</span>{t("专注模式")}</button>
          ) : null}
        </div>
      </div>
      <div className={`fm-side${researchMode ? " is-research" : " is-practice"}`}>
        <div className="formula-info-stack">
          <div className="formula-primary-panel practice-card">
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
                <img src={active.caseImage} alt="" />
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
                <h2>
                  <span>{formulaTitle}</span>
                </h2>
                <b>{displayedMoveCount} MOVES</b>
              </div>
              <div className="formula-hero-tags" aria-label={t("公式信息")}>
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
                <span className="formula-stat-text formula-detail-stat">
                  <span>{t("最佳")}</span>{" "}{bestPracticeValue}
                </span>
                <span className="formula-stat-text formula-detail-stat formula-average-tag" tabIndex={0}>
                  <span>{t("稳定")}</span>{" "}{formulaAverageLabel}
                  <span className="formula-average-popover" role="tooltip">
                    {formulaAverageDescription}
                  </span>
                </span>
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
            <div className="algo-display">
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
          <div className="formula-practice-actions">
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
            {researchMode ? (
              <button className="mini-btn full primary practice-btn practice-btn-primary" onClick={() => void copyResearchMoves()} disabled={researchMoves.length === 0}>{t("复制记录")}</button>
            ) : !connected ? (
              <button className="mini-btn full primary practice-btn practice-btn-primary" onClick={() => void connectRealCube()}>{t("连接魔方")}</button>
            ) : practiceActive ? (
              <button className="mini-btn full primary practice-btn practice-btn-primary" onClick={() => resetPractice()}>{t("停止练习")}</button>
            ) : (
              <button className="mini-btn full primary practice-btn practice-btn-primary" onClick={beginPractice}>{t("开始练习")}</button>
            )}
          </div>
          </div>
        </div>
        </div>

        <div className={`fm-side-bottom practice-card${researchMode ? "" : " fm-side-bottom-stats"}`}>
          {researchMode ? (
            <div className="tr-section formula-keypad-section">
              <div className="formula-stats-head">
                <div className="practice-title-line formula-title-line">
                  <div className="practice-card-title formula-card-title">{t("公式键盘")}</div>
                  <div className="practice-kicker formula-card-kicker">KEYPAD</div>
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
                t={t}
              />
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export function FormulasApp() {
  const { t } = useLanguage();
  const { orientation, faceColors } = useCubeAppearance();
  const formulaTopViewFaceColors = useMemo(() => getFaceHexColors(orientation, "cubing-js"), [orientation]);
  const initialFormulaState = useMemo(() => getDefaultFormulaState(), []);
  const [cat, setCat] = useState<FormulaViewKey>(initialFormulaState.cat);
  const [activeKey, setActiveKey] = useState<string>(initialFormulaState.activeKey);
  const [filter, setFilter] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  const [formulaStats, setFormulaStats] = useState<Record<string, FormulaStats>>({});
  const [learningStatuses, setLearningStatuses] = useState<Record<string, LearningStatus>>({});
  const [averageSettings, setAverageSettings] = useState<AverageTimeSettings>(DEFAULT_AVERAGE_TIME_SETTINGS);
  const [statusFilter, setStatusFilter] = useState<LearningStatusFilter>(initialFormulaState.statusFilter);
  const [ollShapeFilter, setOllShapeFilter] = useState<OllShapeFilter>(initialFormulaState.ollShapeFilter);
  const [showFavOnly, setShowFavOnly] = useState(initialFormulaState.showFavOnly);
  const [formulaTip, setFormulaTip] = useState<FormulaTip | null>(null);
  const [expandedCaseIds, setExpandedCaseIds] = useState<Set<string>>(() => new Set());
  const [archiveDataReady, setArchiveDataReady] = useState(false);
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0);
  const keyboardSelectionRef = useRef(false);
  const formulaCases = useMemo(
    () =>
      Object.entries(FORMULAS).flatMap(([key, value]) =>
        value.items.map((item) => normalizeFormulaCase(item, key as FormulaKey, value.name, value.full)),
      ),
    [],
  ) satisfies FormulaCaseItem[];
  const favoriteCases = useMemo(
    () =>
      formulaCases
        .flatMap((item) => item.variants
          .filter((variant) => favs.includes(variant.key))
          .map((variant) => ({
            ...item,
            id: variant.key,
            algo: variant.algo,
            algos: undefined,
            facelets: variant.caseFacelets,
            variants: [variant],
          }))),
    [favs, formulaCases],
  );
  const isFavoritesView = cat === "favorites";
  const categoryCases = isFavoritesView
    ? favoriteCases
    : formulaCases.filter((item) => item.sourceCat === cat);
  const catData = isFavoritesView
    ? {
        name: t("收藏夹"),
        full: "Favorites",
        items: categoryCases,
      }
    : {
        ...FORMULAS[cat],
        items: categoryCases,
      };

  useEffect(() => {
    function refreshArchiveData() {
      const saved = readFormulaState() ?? getDefaultFormulaState();
      setCat(saved.cat);
      setActiveKey(saved.activeKey);
      setShowFavOnly(saved.showFavOnly);
      setStatusFilter(saved.statusFilter);
      setOllShapeFilter(saved.ollShapeFilter);
      setFilter("");
      setFormulaTip(null);
      const savedCase = formulaCases.find((item) => caseHasVariantKey(item, saved.activeKey));
      setExpandedCaseIds(new Set(savedCase && caseUsesVariantList(savedCase) ? [savedCase.id] : []));
      setFavs(readFavs());
      setFormulaStats(readAllFormulaStats());
      setLearningStatuses(readLearningStatuses());
      setAverageSettings(loadAverageTimeSettings());
      setArchiveRefreshKey((current) => current + 1);
    }

    refreshArchiveData();
    const readyTimer = window.setTimeout(() => setArchiveDataReady(true), 0);
    const unsubscribe = subscribeStatisticsArchiveChange(refreshArchiveData);
    return () => {
      window.clearTimeout(readyTimer);
      unsubscribe();
    };
  }, [formulaCases]);

  useEffect(() => {
    if (!archiveDataReady) return;
    saveFormulaState({ cat, activeKey, showFavOnly, statusFilter, ollShapeFilter });
  }, [archiveDataReady, cat, activeKey, showFavOnly, statusFilter, ollShapeFilter]);

  useEffect(() => {
    if (!archiveDataReady) return;
    saveFavs(favs);
  }, [archiveDataReady, favs]);

  useEffect(() => {
    if (!archiveDataReady) return;
    saveLearningStatuses(learningStatuses);
  }, [archiveDataReady, learningStatuses]);

  function changeCat(nextCat: FormulaViewKey) {
    if (nextCat === cat) return;
    setCat(nextCat);
    const nextItems = nextCat === "favorites"
      ? favoriteCases
      : formulaCases
          .filter((item) => item.sourceCat === nextCat)
          .map((item) => ({
            ...item,
            variants: showFavOnly ? item.variants.filter((variant) => favs.includes(variant.key)) : item.variants,
          }))
          .filter((item) => item.variants.length > 0);
    const firstVariant = nextItems[0]?.variants[0];
    if (firstVariant) {
      setActiveKey(firstVariant.key);
      const firstCase = nextItems[0];
      if (firstCase && caseUsesVariantList(firstCase)) {
        setExpandedCaseIds((prev) => {
          if (prev.has(firstCase.id)) return prev;
          const next = new Set(prev);
          next.add(firstCase.id);
          return next;
        });
      }
    }
    setFilter("");
    if (nextCat === "favorites") setShowFavOnly(false);
  }

  const items = useMemo(() => {
    let list = catData.items;
    if (showFavOnly) {
      list = list
        .map((item) => ({ ...item, variants: item.variants.filter((variant) => favs.includes(variant.key)) }))
        .filter((item) => item.variants.length > 0);
    }
    if (statusFilter !== "all") {
      list = list
        .map((item) => ({
          ...item,
          variants: item.variants.filter((variant) => getLearningStatus(learningStatuses, variant.key) === statusFilter),
        }))
        .filter((item) => item.variants.length > 0);
    }
    if (cat === "oll" && ollShapeFilter !== "all") {
      list = list.filter((item) => item.shape === ollShapeFilter);
    }
    if (filter.trim()) {
      const query = filter.toLowerCase();
      list = list
        .map((item) => {
          const caseMatches = item.name.toLowerCase().includes(query);
          const variants = caseMatches
            ? item.variants
            : item.variants.filter(
                (variant) =>
                  variant.name.toLowerCase().includes(query) ||
                  (variant.description?.toLowerCase().includes(query) ?? false) ||
                  variant.algo.toLowerCase().includes(query),
              );
          return { ...item, variants };
        })
        .filter((item) => item.variants.length > 0);
    }
    return list;
  }, [cat, catData.items, favs, filter, learningStatuses, ollShapeFilter, showFavOnly, statusFilter]);

  const visibleFormulaVariants = useMemo(() => items.flatMap((item) => item.variants), [items]);

  const active = isFavoritesView
    ? findVariantByKey(favoriteCases, activeKey) || favoriteCases[0]?.variants[0] || null
    : findVariantByKey(categoryCases, activeKey) || categoryCases[0]?.variants[0] || null;
  const resolvedActiveKey = active?.key ?? activeKey;
  const activeCatKey = active?.sourceCat ?? cat;
  const activeLearningStatus = active ? getLearningStatus(learningStatuses, active.key) : "unpracticed";
  const emptyMessage = filter.trim() ? t("无匹配结果") : statusFilter === "all" ? t("无匹配结果") : t("此状态下暂无公式");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const direction = getFormulaNavigationDirection(event);
      if (direction === 0) return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTextEntryTarget(event.target)) return;
      if (visibleFormulaVariants.length === 0) return;

      event.preventDefault();
      setFormulaTip(null);
      const currentIndex = visibleFormulaVariants.findIndex((variant) => variant.key === resolvedActiveKey);
      const startIndex = currentIndex === -1
        ? direction > 0
          ? -1
          : visibleFormulaVariants.length
        : currentIndex;
      const nextIndex = Math.min(Math.max(startIndex + direction, 0), visibleFormulaVariants.length - 1);
      const nextVariant = visibleFormulaVariants[nextIndex];
      if (!nextVariant || nextVariant.key === resolvedActiveKey) return;

      keyboardSelectionRef.current = true;
      setActiveKey(nextVariant.key);
      setExpandedCaseIds((prev) => {
        const nextCase = items.find((item) => caseHasVariantKey(item, nextVariant.key));
        if (!nextCase || !caseUsesVariantList(nextCase) || prev.has(nextCase.id)) return prev;
        const next = new Set(prev);
        next.add(nextCase.id);
        return next;
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items, resolvedActiveKey, visibleFormulaVariants]);

  useEffect(() => {
    if (!keyboardSelectionRef.current) return;
    keyboardSelectionRef.current = false;
    const activeRow = document.querySelector<HTMLElement>(`[data-formula-key="${CSS.escape(resolvedActiveKey)}"]`);
    activeRow?.scrollIntoView({ block: "nearest" });
  }, [expandedCaseIds, resolvedActiveKey]);

  function toggleFav(id: string) {
    setFavs((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function setFormulaLearningStatus(id: string, status: LearningStatus) {
    setLearningStatuses((prev) => ({ ...prev, [id]: status }));
  }

  function updateFormulaStats(id: string, stats: FormulaStats) {
    setFormulaStats((prev) => ({ ...prev, [id]: stats }));
  }

  function toggleCaseExpanded(caseId: string) {
    setExpandedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }

  function selectCase(item: FormulaCaseItem) {
    if (!caseHasVariantKey(item, resolvedActiveKey)) {
      const firstVariant = item.variants[0];
      if (firstVariant) setActiveKey(firstVariant.key);
    }
    if (caseUsesVariantList(item)) toggleCaseExpanded(item.id);
  }

  function showFormulaTip(target: HTMLElement, title: string, sourceName: string, variants: FormulaVariantItem[]) {
    if (variants.length === 0) return;
    const rect = target.getBoundingClientRect();
    const tipWidth = Math.min(360, window.innerWidth - 32);
    const margin = 16;
    const rightSide = rect.right + 10;
    const left = rightSide + tipWidth <= window.innerWidth - margin
      ? rightSide
      : Math.min(window.innerWidth - tipWidth - margin, Math.max(margin, rect.left));
    const tipHeightEstimate = Math.min(260, 70 + variants.length * 46);
    const maxTop = Math.max(margin, window.innerHeight - tipHeightEstimate);
    const top = Math.min(maxTop, Math.max(margin, rect.top));
    setFormulaTip({ title, sourceName, variants, left, top });
  }

  return (
    <div className="app lf-tech-app">
      <AppTopbar />

      <main className="fm-grid">
        <section className="fm-left practice-card">
          <div className="fm-category-tabs" aria-label={t("公式类别")}>
            {Object.entries(FORMULAS).map(([key, value]) => (
              <button
                key={key}
                type="button"
                className={`fm-category-tab${cat === key ? " active" : ""}`}
                onClick={() => changeCat(key as FormulaKey)}
              >
                {t(value.name)}
              </button>
            ))}
            <button
              type="button"
              className={`fm-category-tab${isFavoritesView ? " active" : ""}`}
              onClick={() => changeCat("favorites")}
            >{t("收藏夹")}</button>
          </div>
          <div className="fm-library-panel">
            <div className="fm-search">
              <input
                type="text"
                placeholder={t(`搜索 ${catData.name}…`)}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
              <LearningStatusSelectField selected={statusFilter} onSelect={setStatusFilter} />
              {!isFavoritesView && (
                <button
                  className={`fm-fav-toggle${showFavOnly ? " active" : ""}`}
                  onClick={() => setShowFavOnly((value) => !value)}
                  aria-label={t("只看收藏")}
                  aria-pressed={showFavOnly}
                  title={t("只看收藏")}
                >
                  <span aria-hidden="true">★</span>
                </button>
              )}
            </div>
            {cat === "oll" && (
              <div className="fm-shape-filter">
                <label htmlFor="oll-shape-filter">{t("formula.shape.label")}</label>
                <OllShapeSelectField
                  id="oll-shape-filter"
                  selected={ollShapeFilter}
                  faceColors={formulaTopViewFaceColors}
                  onSelect={setOllShapeFilter}
                />
              </div>
            )}
            <div className="fm-list">
              {items.length === 0 ? (
                <div className="fm-empty">{emptyMessage}</div>
              ) : (
                items.map((item) => {
                const caseActive = item.variants.some((variant) => variant.key === resolvedActiveKey);
                const totalVariantCount = getTotalVariantCount(item);
                const usesVariantList = caseUsesVariantList(item);
                const caseExpanded = usesVariantList && expandedCaseIds.has(item.id);
                const summary = usesVariantList ? null : formatListStats(getCaseStats(item, formulaStats), averageSettings);
                const itemLearningStatus = getLearningStatus(learningStatuses, item.variants[0]?.key ?? item.id);
                const statusLabel = t(LEARNING_STATUSES.find((status) => status.key === itemLearningStatus)?.shortLabel ?? "未学习");
                const learningCounts = getCaseLearningCounts(item, learningStatuses);
                const casePreviewFacelets = getFormulaCasePreviewFacelets(item);
                return (
                  <div key={item.id} className={`fm-case${caseActive ? " active" : ""}`}>
                    <div
                      data-formula-key={usesVariantList ? undefined : item.variants[0]?.key}
                      className={`fm-row fm-case-row${usesVariantList ? " multi" : ""}${caseActive ? " active" : ""}`}
                      onClick={() => selectCase(item)}
                      onBlur={() => setFormulaTip(null)}
                      onFocus={(event) => showFormulaTip(event.currentTarget, item.name, item.sourceName, item.variants)}
                      onMouseEnter={(event) => showFormulaTip(event.currentTarget, item.name, item.sourceName, item.variants)}
                      onMouseLeave={() => setFormulaTip(null)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        selectCase(item);
                      }}
                      tabIndex={0}
                    >
                      {usesTopViewFormulaImage(item.sourceCat) && casePreviewFacelets ? (
                        <FormulaTopViewImage
                          facelets={casePreviewFacelets}
                          faceColors={formulaTopViewFaceColors}
                          arrows={item.arrows}
                          className="fmr-img formula-top-view-svg"
                        />
                      ) : item.image ? (
                        <img className="fmr-img" src={item.image} alt="" loading="lazy" />
                      ) : casePreviewFacelets ? (
                        <FormulaCubeImage
                          facelets={casePreviewFacelets}
                          faceColors={faceColors}
                          className="fmr-img formula-cube-svg"
                        />
                      ) : (
                        <div className="fmr-img fmr-img-empty" aria-hidden="true"></div>
                      )}
                      <div className="fmr-l">
                        <div className="fmr-name">
                          <span>
                            {t(item.name)}
                            {isFavoritesView && item.variants[0].id !== "main" && item.variants[0].name !== item.name
                              ? ` · ${t(item.variants[0].name)}`
                              : ""}
                          </span>
                          <FormulaDescription description={item.variants.length === 1 ? item.variants[0]?.description : item.description} />
                        </div>
                        {isFavoritesView && <div className="fvr-algo">{item.variants[0].algo}</div>}
                        <div className="fmr-meta">
                          {usesVariantList ? (
                            <>
                              {learningCounts.mastered > 0 && (
                                <span className="formula-status-badge status-mastered">{learningCounts.mastered}{t("个公式已掌握")}</span>
                              )}
                              {learningCounts.learning > 0 && (
                                <span className="formula-status-badge status-learning">{learningCounts.learning}{t("个公式学习中")}</span>
                              )}
                            </>
                          ) : (
                            <span className={`formula-status-badge status-${itemLearningStatus}`}>{statusLabel}</span>
                          )}
                          {usesVariantList && <span className="formula-variant-count">{totalVariantCount}{t("个公式")}</span>}
                          {summary && (
                            <>
                              <span className="formula-stat-text">{t("最佳")}{" "}{summary.best}</span>
                              <span className="formula-stat-text">{t("稳定")}{" "}{summary.stable}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {usesVariantList ? (
                        <button
                          className={`fmr-expand${caseExpanded ? " open" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleCaseExpanded(item.id);
                          }}
                          title={caseExpanded ? t("收起公式") : t("展开公式")}
                          type="button"
                        >
                          ▸
                        </button>
                      ) : (
                        <button
                          className={`fmr-fav${favs.includes(item.variants[0].key) ? " on" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFav(item.variants[0].key);
                          }}
                          type="button"
                        >
                          {favs.includes(item.variants[0].key) ? "★" : "☆"}
                        </button>
                      )}
                    </div>
                    {caseExpanded && (
                      <div className="fm-variant-list">
                        {item.variants.map((variant) => {
                          const variantActive = variant.key === resolvedActiveKey;
                          const variantStats = formatListStats(formulaStats[variant.key], averageSettings);
                          const variantStatus = getLearningStatus(learningStatuses, variant.key);
                          const variantStatusLabel = t(LEARNING_STATUSES.find((status) => status.key === variantStatus)?.shortLabel ?? "未学习");
                          const isFav = favs.includes(variant.key);
                          return (
                            <div
                              key={variant.key}
                              data-formula-key={variant.key}
                              className={`fm-variant-row${variantActive ? " active" : ""}`}
                              onClick={() => setActiveKey(variant.key)}
                              onBlur={() => setFormulaTip(null)}
                              onFocus={(event) => showFormulaTip(event.currentTarget, `${variant.caseName} · ${variant.name}`, variant.sourceName, [variant])}
                              onMouseEnter={(event) => showFormulaTip(event.currentTarget, `${variant.caseName} · ${variant.name}`, variant.sourceName, [variant])}
                              onMouseLeave={() => setFormulaTip(null)}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                setActiveKey(variant.key);
                              }}
                              tabIndex={0}
                            >
                              <div className="fvr-main">
                                <div className="fvr-name">
                                  <span>{t(variant.name)}</span>
                                  <FormulaDescription description={variant.description} />
                                </div>
                                <div className="fvr-algo">{variant.algo}</div>
                                <div className="fmr-meta">
                                  <span className={`formula-status-badge status-${variantStatus}`}>{variantStatusLabel}</span>
                                  <span className="formula-stat-text">{t("最佳")}{" "}{variantStats.best}</span>
                                  <span className="formula-stat-text">{t("稳定")}{" "}{variantStats.stable}</span>
                                </div>
                              </div>
                              <button
                                className={`fmr-fav${isFav ? " on" : ""}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFav(variant.key);
                                }}
                                type="button"
                              >
                                {isFav ? "★" : "☆"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
                })
              )}
            </div>
          </div>
        </section>

        <section className="fm-right">
          {active ? (
            <>
              <div className="fm-detail-body">
                <FormulaStage
                  key={`${active.key}:${archiveRefreshKey}`}
                  active={active}
                  shouldSolveToReset={activeCatKey !== "triggers"}
                  onStatsChange={updateFormulaStats}
                  learningStatus={activeLearningStatus}
                  onLearningStatusChange={(status) => setFormulaLearningStatus(active.key, status)}
                  averageSettings={averageSettings}
                />
              </div>
            </>
          ) : (
            <div className="fm-detail-empty practice-card">
              <div className="fmd-cat">{t("收藏夹")}</div>
              <div className="fmd-name">{t("还没有收藏公式")}</div>
              <div className="fm-empty">{t("点击任意公式右侧的星标后，会在这里集中显示。")}</div>
            </div>
          )}
        </section>

        {formulaTip && (
          <div className="formula-floating-tip" role="tooltip" style={{ left: formulaTip.left, top: formulaTip.top }}>
            <div className="fft-head">
              <span>{formulaTip.title}</span>
              <b>{formulaTip.sourceName}</b>
            </div>
            <div className="fft-list">
              {formulaTip.variants.map((variant) => (
                <div key={variant.key} className="fft-row">
                  {formulaTip.variants.length > 1 && <div className="fft-name">{t(variant.name)}</div>}
                  <div className="fft-algo">{renderAlgorithmWithGroups(variant.algo)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
