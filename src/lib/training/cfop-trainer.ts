import { formulaToHardwareMoves,invertMoveNotation } from "@/lib/cube/algorithms";
import { detectCfopMilestones,detectF2lTargetEdgeSolved,isSolvedFacelets,type F2lTargetSlot } from "@/lib/cube/cube-state";
import { applyMovesToFacelets } from "@/lib/cube/facelets-pattern";
import { rotateAlgorithmByYOffset,type FormulaRotationOffset } from "@/lib/formulas/formula-rotation";
import { FORMULAS,type FormulaItem } from "@/lib/formulas/formulas-data";

export { displayFaceletsToHardwareFacelets } from "@/lib/cube/cube-appearance";

export type CfopTrainerPhase = "f2l" | "oll" | "pll";
export type CfopTrainerPhaseShort = "F" | "O" | "P";

export type CfopTrainerScenario = {
  rotation: FormulaRotationOffset;
  setupMoves: string[];
  sourceAlgo: string;
  startFacelets: string;
};

export const SOLVED_FACELETS = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

export const CFOP_TRAINER_PHASES: Array<{
  key: CfopTrainerPhase;
  short: CfopTrainerPhaseShort;
  label: string;
}> = [
  { key: "f2l", short: "F", label: "F2L" },
  { key: "oll", short: "O", label: "OLL" },
  { key: "pll", short: "P", label: "PLL" },
];

function firstAlgo(item: FormulaItem) {
  return item.algos?.[0]?.algo ?? item.algo ?? null;
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export async function createFormulaTrainerScenario(
  phase: CfopTrainerPhase,
  options: { includeRotations?: boolean; selectedCaseIds?: readonly string[] } = {},
): Promise<CfopTrainerScenario> {
  const category = FORMULAS[phase];
  const algos = category.items
    .filter((item) => !options.selectedCaseIds || options.selectedCaseIds.includes(item.id))
    .map(firstAlgo)
    .filter((algo): algo is string => Boolean(algo));
  if (!algos.length) throw new Error("No formulas selected");
  const selectedAlgo = randomItem(algos);
  const rotation = (options.includeRotations ? Math.floor(Math.random() * 4) : 0) as FormulaRotationOffset;
  const sourceAlgo = rotateAlgorithmByYOffset(selectedAlgo, rotation);
  const setupMoves = formulaToHardwareMoves(sourceAlgo).toReversed().map(invertMoveNotation);
  const startFacelets = await applyMovesToFacelets(SOLVED_FACELETS, setupMoves);

  return {
    rotation,
    setupMoves,
    sourceAlgo,
    startFacelets,
  };
}

export function formulaTrainerScenarioCount(phase: CfopTrainerPhase, options: { includeRotations?: boolean; selectedCaseIds?: readonly string[] } = {}) {
  return FORMULAS[phase].items.filter((item) => Boolean(firstAlgo(item)) && (!options.selectedCaseIds || options.selectedCaseIds.includes(item.id))).length * (options.includeRotations ? 4 : 1);
}

export const F2L_FOCUS_SOLVED_FACELETS = [
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

function f2lTargetSlotForRotation(rotation: number): F2lTargetSlot {
  if (rotation === 1) return "br";
  if (rotation === 2) return "bl";
  if (rotation === 3) return "fl";
  return "fr";
}

export function phaseComplete(
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

export function canUseFocusModeForPhase(phase: CfopTrainerPhase) {
  return phase === "f2l" || phase === "oll";
}

export function focusSolvedFaceletsForPhase(phase: CfopTrainerPhase) {
  if (phase === "f2l") return F2L_FOCUS_SOLVED_FACELETS;
  if (phase === "oll") return OLL_FOCUS_SOLVED_FACELETS;
  return null;
}
