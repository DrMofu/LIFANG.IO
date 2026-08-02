import { getArchiveScopedStorageKey } from "@/lib/solve-history";

export type FormulaLearningStatus = "unpracticed" | "learning" | "mastered";

const FORMULA_LEARNING_STATUS_KEY = "formula-learning-status";

export const FORMULA_LEARNING_STATUSES: Array<{
  key: FormulaLearningStatus;
  label: string;
  shortLabel: string;
}> = [
  { key: "unpracticed", label: "未学习", shortLabel: "未学习" },
  { key: "learning", label: "学习中", shortLabel: "学习中" },
  { key: "mastered", label: "已掌握", shortLabel: "已掌握" },
];

export function isFormulaLearningStatus(value: unknown): value is FormulaLearningStatus {
  return value === "unpracticed" || value === "learning" || value === "mastered";
}

export function readFormulaLearningStatuses(): Record<string, FormulaLearningStatus> {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(
      window.localStorage.getItem(getArchiveScopedStorageKey(FORMULA_LEARNING_STATUS_KEY)) || "{}",
    ) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, FormulaLearningStatus] => isFormulaLearningStatus(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export function saveFormulaLearningStatuses(statuses: Record<string, FormulaLearningStatus>) {
  try {
    window.localStorage.setItem(
      getArchiveScopedStorageKey(FORMULA_LEARNING_STATUS_KEY),
      JSON.stringify(statuses),
    );
  } catch {}
}

export function getFormulaLearningStatus(
  statuses: Record<string, FormulaLearningStatus>,
  id: string,
): FormulaLearningStatus {
  return statuses[id] ?? "unpracticed";
}
