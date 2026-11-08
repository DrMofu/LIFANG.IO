"use client";
import { getFormulaLearningStatus as getLearningStatus,isFormulaLearningStatus as isLearningStatus,type FormulaLearningStatus as LearningStatus,} from "@/lib/formulas/formula-learning-status";
import { type FormulaRotationOffset } from "@/lib/formulas/formula-rotation";
import { FORMULA_STATS_LIMIT } from "@/lib/formulas/formula-time-distribution";
import { FORMULAS,OLL_SHAPES,type FormulaArrow,type FormulaItem,type FormulaVariant as FormulaVariantData,type OllShape,} from "@/lib/formulas/formulas-data";

export type FormulaKey = keyof typeof FORMULAS;

export type FormulaViewKey = FormulaKey | "favorites";

export type FormulaVariantItem = FormulaVariantData & {
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

export type FormulaCaseItem = FormulaItem & {
  sourceCat: FormulaKey;
  sourceName: string;
  sourceFull: string;
  variants: FormulaVariantItem[];
};

export type LearningStatusFilter = "all" | LearningStatus;

export type OllShapeFilter = "all" | OllShape;

export const OLL_SHAPE_OPTIONS: readonly OllShapeFilter[] = ["all", ...OLL_SHAPES];

const FORMULA_ROTATION_SUFFIX: Record<Exclude<FormulaRotationOffset, 0>, string> = {
  1: "@view-y",
  2: "@view-y2",
  3: "@view-y-prime",
};

export type FormulaStats = {
  count: number;
  times: number[];
  bestMs?: number;
  todayKey?: string;
  todayCount?: number;
};

export function isLearningStatusFilter(value: unknown): value is LearningStatusFilter {
  return value === "all" || isLearningStatus(value);
}

export function isOllShapeFilter(value: unknown): value is OllShapeFilter {
  return OLL_SHAPE_OPTIONS.some((shape) => shape === value);
}

export function formulaVariantKey(caseId: string, variantId: string) {
  return `${caseId}:${variantId}`;
}

export function formulaPracticeStatsKey(baseKey: string, sourceCat: FormulaKey, rotationOffset: FormulaRotationOffset) {
  if (sourceCat !== "f2l" || rotationOffset === 0) return baseKey;
  return `${baseKey}${FORMULA_ROTATION_SUFFIX[rotationOffset]}`;
}

export function hasFormulaVariantKey(cat: FormulaKey, key: string) {
  const [caseId, variantId, extra] = key.split(":");
  if (!caseId || !variantId || extra) return false;
  const item = FORMULAS[cat].items.find((candidate) => candidate.id === caseId);
  if (!item) return false;
  if (item.algos?.length) return item.algos.some((variant) => (variant.id || "") === variantId);
  return Boolean(item.algo) && variantId === "main";
}

export function normalizeFormulaCase(item: FormulaItem, sourceCat: FormulaKey, sourceName: string, sourceFull: string): FormulaCaseItem {
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

export function findVariantByKey(cases: FormulaCaseItem[], key: string) {
  for (const item of cases) {
    const variant = item.variants.find((candidate) => candidate.key === key);
    if (variant) return variant;
  }
  return null;
}

export function preferredCaseVariant(item: FormulaCaseItem, preferences: Record<string, string>) {
  return item.variants.find((variant) => variant.key === preferences[variant.caseId]) ?? item.variants[0];
}

export function caseHasVariantKey(item: FormulaCaseItem, key: string) {
  return item.variants.some((variant) => variant.key === key);
}

export function getTotalVariantCount(item: FormulaCaseItem) {
  return item.algos?.length || (item.algo ? 1 : item.variants.length);
}

export function caseUsesVariantList(item: FormulaCaseItem) {
  return Boolean(item.algos);
}

export function usesTopViewFormulaImage(sourceCat: FormulaKey) {
  return sourceCat === "oll" || sourceCat === "pll";
}

export function getFormulaCasePreviewFacelets(item: FormulaCaseItem) {
  return item.facelets ?? item.variants.find((variant) => variant.caseFacelets)?.caseFacelets;
}

export function getCaseStats(item: FormulaCaseItem, statsByVariant: Record<string, FormulaStats>) {
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

export function getCaseLearningCounts(item: FormulaCaseItem, statuses: Record<string, LearningStatus>) {
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

export function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayPracticeCount(stats: FormulaStats) {
  return stats.todayKey === getLocalDayKey() ? stats.todayCount ?? 0 : 0;
}

export function getTodayPracticeTone(count: number) {
  if (count >= 50) return "gold";
  if (count >= 10) return "silver";
  if (count >= 1) return "bronze";
  return "idle";
}
