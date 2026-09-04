import { invertMoveNotation, parseAlgorithm } from "@/lib/algorithms";
import { rotateAlgorithmByYOffset, type FormulaRotationOffset } from "@/lib/formula-rotation";
import { FORMULAS, type FormulaItem } from "@/lib/formulas-data";
import { applyMovesToFacelets } from "@/lib/facelets-pattern";
export { displayFaceletsToHardwareFacelets } from "@/lib/cube-appearance";

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
  options: { includeRotations?: boolean } = {},
): Promise<CfopTrainerScenario> {
  const category = FORMULAS[phase];
  const algos = category.items
    .map(firstAlgo)
    .filter((algo): algo is string => Boolean(algo));
  const selectedAlgo = randomItem(algos);
  const rotation = (options.includeRotations ? Math.floor(Math.random() * 4) : 0) as FormulaRotationOffset;
  const sourceAlgo = rotateAlgorithmByYOffset(selectedAlgo, rotation);
  const setupMoves = parseAlgorithm(sourceAlgo).toReversed().map(invertMoveNotation);
  const startFacelets = await applyMovesToFacelets(SOLVED_FACELETS, setupMoves);

  return {
    rotation,
    setupMoves,
    sourceAlgo,
    startFacelets,
  };
}

export function formulaTrainerScenarioCount(phase: CfopTrainerPhase, options: { includeRotations?: boolean } = {}) {
  return FORMULAS[phase].items.filter((item) => Boolean(firstAlgo(item))).length * (options.includeRotations ? 4 : 1);
}
