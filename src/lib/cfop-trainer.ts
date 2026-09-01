import { invertMoveNotation, parseAlgorithm } from "@/lib/algorithms";
import { rotateAlgorithmByYOffset, type FormulaRotationOffset } from "@/lib/formula-rotation";
import { FORMULAS, type FormulaItem } from "@/lib/formulas-data";
import { applyMovesToFacelets } from "@/lib/facelets-pattern";
import { getArchiveScopedStorageKey } from "@/lib/solve-history";
export { displayFaceletsToHardwareFacelets } from "@/lib/cube-appearance";

export type CfopTrainerPhase = "f2l" | "oll" | "pll";
export type CfopTrainerPhaseShort = "F" | "O" | "P";

export type CfopTrainerScenario = {
  phase: CfopTrainerPhase;
  short: CfopTrainerPhaseShort;
  caseId: string;
  caseName: string;
  rotation: FormulaRotationOffset;
  setupMoves: string[];
  sourceAlgo: string;
  startFacelets: string;
};

export type CfopTrainerHistoryOptions = {
  rotationVariants: boolean;
  formulaHint: boolean;
  rotationArrow: boolean;
  f2lEdgeOnly: boolean;
};

export type CfopTrainerHistoryEntry = {
  phase: CfopTrainerPhase;
  observeMs: number;
  solveMs: number;
  moves?: number;
  dnfCount?: number;
  rounds: number;
  ts: number;
  options: CfopTrainerHistoryOptions;
};

export const CFOP_TRAINER_HISTORY_KEY = "cfop-stage-training-history";
export const SOLVED_FACELETS = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
export const CFOP_TRAINER_HISTORY_LIMIT = 120;

export const CFOP_TRAINER_PHASES: Array<{
  key: CfopTrainerPhase;
  short: CfopTrainerPhaseShort;
  label: string;
  title: string;
  goal: string;
}> = [
  { key: "f2l", short: "F", label: "F2L", title: "F 阶段", goal: "复原前两层" },
  { key: "oll", short: "O", label: "OLL", title: "O 阶段", goal: "复原顶面" },
  { key: "pll", short: "P", label: "PLL", title: "P 阶段", goal: "复原整个魔方" },
];

function firstAlgo(item: FormulaItem) {
  return item.algos?.[0]?.algo ?? item.algo ?? null;
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function trainerPhaseShort(phase: CfopTrainerPhase) {
  return CFOP_TRAINER_PHASES.find((item) => item.key === phase)?.short ?? "F";
}

export async function createFormulaTrainerScenario(
  phase: CfopTrainerPhase,
  options: { includeRotations?: boolean } = {},
): Promise<CfopTrainerScenario> {
  const category = FORMULAS[phase];
  const cases = category.items
    .map((item) => ({ item, algo: firstAlgo(item) }))
    .filter((entry): entry is { item: FormulaItem; algo: string } => Boolean(entry.algo));
  const selected = randomItem(cases);
  const rotation = (options.includeRotations ? Math.floor(Math.random() * 4) : 0) as FormulaRotationOffset;
  const sourceAlgo = rotateAlgorithmByYOffset(selected.algo, rotation);
  const setupMoves = parseAlgorithm(sourceAlgo).toReversed().map(invertMoveNotation);
  const startFacelets = await applyMovesToFacelets(SOLVED_FACELETS, setupMoves);

  return {
    phase,
    short: trainerPhaseShort(phase),
    caseId: selected.item.id,
    caseName: selected.item.name,
    rotation,
    setupMoves,
    sourceAlgo,
    startFacelets,
  };
}

export function formulaTrainerScenarioCount(phase: CfopTrainerPhase, options: { includeRotations?: boolean } = {}) {
  return FORMULAS[phase].items.filter((item) => Boolean(firstAlgo(item))).length * (options.includeRotations ? 4 : 1);
}

const DEFAULT_TRAINER_HISTORY_OPTIONS: CfopTrainerHistoryOptions = {
  rotationVariants: false,
  formulaHint: false,
  rotationArrow: false,
  f2lEdgeOnly: false,
};

function normalizeTrainerHistoryOptions(value: unknown): CfopTrainerHistoryOptions {
  if (!value || typeof value !== "object") return DEFAULT_TRAINER_HISTORY_OPTIONS;
  const candidate = value as Partial<CfopTrainerHistoryOptions>;
  return {
    rotationVariants: candidate.rotationVariants === true,
    formulaHint: candidate.formulaHint === true,
    rotationArrow: candidate.rotationArrow === true,
    f2lEdgeOnly: candidate.f2lEdgeOnly === true,
  };
}

function normalizeTrainerHistoryEntry(value: unknown): CfopTrainerHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as CfopTrainerHistoryEntry;
  if (
    CFOP_TRAINER_PHASES.some((phase) => phase.key === candidate.phase) &&
    typeof candidate.observeMs === "number" &&
    typeof candidate.solveMs === "number" &&
    (candidate.moves === undefined || typeof candidate.moves === "number") &&
    (candidate.dnfCount === undefined || (typeof candidate.dnfCount === "number" && candidate.dnfCount >= 0)) &&
    typeof candidate.rounds === "number" &&
    typeof candidate.ts === "number"
  ) {
    return {
      phase: candidate.phase,
      observeMs: candidate.observeMs,
      solveMs: candidate.solveMs,
      ...(candidate.moves === undefined ? {} : { moves: candidate.moves }),
      ...(candidate.dnfCount === undefined ? {} : { dnfCount: Math.floor(candidate.dnfCount) }),
      rounds: candidate.rounds,
      ts: candidate.ts,
      options: normalizeTrainerHistoryOptions(candidate.options),
    };
  }
  return null;
}

export function readCfopTrainerHistory() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getArchiveScopedStorageKey(CFOP_TRAINER_HISTORY_KEY));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeTrainerHistoryEntry)
          .filter((entry): entry is CfopTrainerHistoryEntry => entry !== null)
          .slice(0, CFOP_TRAINER_HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function saveCfopTrainerHistory(history: CfopTrainerHistoryEntry[]) {
  const normalized = history
    .map(normalizeTrainerHistoryEntry)
    .filter((entry): entry is CfopTrainerHistoryEntry => entry !== null)
    .toSorted((a, b) => b.ts - a.ts)
    .slice(0, CFOP_TRAINER_HISTORY_LIMIT);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(getArchiveScopedStorageKey(CFOP_TRAINER_HISTORY_KEY), JSON.stringify(normalized));
    } catch {
      // Keep the in-memory result even if localStorage is unavailable.
    }
  }
  return normalized;
}

export function prependCfopTrainerHistoryEntry(history: CfopTrainerHistoryEntry[], entry: CfopTrainerHistoryEntry) {
  return saveCfopTrainerHistory([entry, ...history]);
}
