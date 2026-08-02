import { hardwareFaceletsToDisplayFacelets, type CubeOrientation } from "@/lib/cube-appearance";
import { FORMULAS, type FormulaArrow, type FormulaItem } from "@/lib/formulas-data";

export type FormulaRecognitionPhase = "oll" | "pll";

export type RecognizedFormulaAlgorithm = {
  id: string;
  name: string;
  algorithm: string;
};

export type FormulaRecognitionResult = {
  phase: FormulaRecognitionPhase;
  id: string;
  name: string;
  formulas: RecognizedFormulaAlgorithm[];
  facelets: string;
  arrows?: FormulaArrow[];
};

type FormulaRecognitionIndexMatch = {
  result: FormulaRecognitionResult;
  topRotation: number;
};

type FormulaRecognitionIndex = Map<string, FormulaRecognitionIndexMatch[]>;

const FACELET_LENGTH = 54;
const VALID_FACELETS = /^[URFDLB]+$/;
const TOP_FACE_INDICES = Array.from({ length: 9 }, (_, index) => index);
const TOP_RING_GROUPS = [
  [47, 46, 45],
  [11, 10, 9],
  [20, 19, 18],
  [38, 37, 36],
] as const;
const TOP_RING_INDICES = TOP_RING_GROUPS.flat();
const TOP_LAYER_INDICES = [...TOP_FACE_INDICES, ...TOP_RING_INDICES];
const SIDE_FACE_COLOR_ROTATION: Record<"R" | "F" | "L" | "B", "R" | "F" | "L" | "B"> = {
  R: "B",
  B: "L",
  L: "F",
  F: "R",
};
const FIRST_TWO_LAYER_RANGES = [
  { face: "R", start: 12, length: 6 },
  { face: "F", start: 21, length: 6 },
  { face: "D", start: 27, length: 9 },
  { face: "L", start: 39, length: 6 },
  { face: "B", start: 48, length: 6 },
] as const;

function itemFormulas(item: FormulaItem): RecognizedFormulaAlgorithm[] {
  if (item.algos?.length) {
    return item.algos.map((variant) => ({
      id: variant.id,
      name: variant.name,
      algorithm: variant.algo,
    }));
  }
  if (item.algo) return [{ id: "main", name: "公式一", algorithm: item.algo }];
  return [];
}

function previewFacelets(item: FormulaItem) {
  return item.facelets ?? item.algos?.find((variant) => variant.facelets)?.facelets ?? null;
}

function rotateTopLayerClockwise(facelets: string) {
  const next = facelets.split("");
  const top = facelets.slice(0, 9);
  const rotatedTop = [top[6], top[3], top[0], top[7], top[4], top[1], top[8], top[5], top[2]];
  rotatedTop.forEach((facelet, index) => {
    next[index] = facelet;
  });

  const ringGroups = TOP_RING_GROUPS.map((group) => group.map((index) => facelets[index]));
  TOP_RING_GROUPS.forEach((group, index) => {
    const source = ringGroups[(index + TOP_RING_GROUPS.length - 1) % TOP_RING_GROUPS.length];
    group.forEach((faceletIndex, stickerIndex) => {
      next[faceletIndex] = source[stickerIndex];
    });
  });

  return next.join("");
}

function rotateSideFaceColors(facelets: string) {
  return facelets.replace(/[RFLB]/g, (face) => SIDE_FACE_COLOR_ROTATION[face as "R" | "F" | "L" | "B"]);
}

function restoreLibraryTopOrientation(facelets: string, topRotation: number) {
  let restored = facelets;
  const inverseRotations = (4 - topRotation) % 4;
  for (let rotation = 0; rotation < inverseRotations; rotation += 1) {
    restored = rotateTopLayerClockwise(restored);
  }
  return restored;
}

function addIndexMatch(
  index: FormulaRecognitionIndex,
  key: string,
  match: FormulaRecognitionIndexMatch,
) {
  const matches = index.get(key);
  if (matches) {
    matches.push(match);
  } else {
    index.set(key, [match]);
  }
}

function selectIndexMatch(matches: FormulaRecognitionIndexMatch[] | undefined) {
  return matches?.reduce((best, match) => (
    match.topRotation < best.topRotation ? match : best
  ));
}

function ollSignature(facelets: string) {
  return TOP_LAYER_INDICES.map((index) => (facelets[index] === "U" ? "1" : "0")).join("");
}

function pllSignature(facelets: string) {
  return TOP_RING_INDICES.map((index) => facelets[index]).join("");
}

function createResult(phase: FormulaRecognitionPhase, item: FormulaItem): FormulaRecognitionResult | null {
  const formulas = itemFormulas(item);
  const facelets = previewFacelets(item);
  if (formulas.length === 0 || !facelets) return null;
  return {
    phase,
    id: item.id,
    name: item.name,
    formulas,
    facelets,
    ...(item.arrows ? { arrows: item.arrows } : {}),
  };
}

function buildSignatureIndex(
  phase: FormulaRecognitionPhase,
  items: FormulaItem[],
  signature: (facelets: string) => string,
) {
  const index: FormulaRecognitionIndex = new Map();
  items.forEach((item) => {
    const result = createResult(phase, item);
    if (!result) return;
    let rotatedFacelets = result.facelets;
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const key = signature(rotatedFacelets);
      addIndexMatch(index, key, { result, topRotation: rotation });
      rotatedFacelets = rotateTopLayerClockwise(rotatedFacelets);
    }
  });
  return index;
}

function buildPllSignatureIndex(items: FormulaItem[]) {
  const index: FormulaRecognitionIndex = new Map();
  items.forEach((item) => {
    const result = createResult("pll", item);
    if (!result) return;

    let colorRotatedFacelets = result.facelets;
    for (let colorRotation = 0; colorRotation < 4; colorRotation += 1) {
      let topRotatedFacelets = colorRotatedFacelets;
      for (let topRotation = 0; topRotation < 4; topRotation += 1) {
        const key = pllSignature(topRotatedFacelets);
        addIndexMatch(index, key, { result, topRotation });
        topRotatedFacelets = rotateTopLayerClockwise(topRotatedFacelets);
      }
      colorRotatedFacelets = rotateSideFaceColors(colorRotatedFacelets);
    }
  });
  return index;
}

const OLL_INDEX = buildSignatureIndex("oll", FORMULAS.oll.items, ollSignature);
const PLL_INDEX = buildPllSignatureIndex(FORMULAS.pll.items);

function firstTwoLayersSolved(facelets: string) {
  return FIRST_TWO_LAYER_RANGES.every(({ face, start, length }) => {
    for (let index = start; index < start + length; index += 1) {
      if (facelets[index] !== face) return false;
    }
    return true;
  });
}

function topFaceOriented(facelets: string) {
  return TOP_FACE_INDICES.every((index) => facelets[index] === "U");
}

export function recognizeLastLayerFormula(
  hardwareFacelets: string,
  orientation: CubeOrientation,
): FormulaRecognitionResult | null {
  if (hardwareFacelets.length !== FACELET_LENGTH || !VALID_FACELETS.test(hardwareFacelets)) return null;
  const facelets = hardwareFaceletsToDisplayFacelets(hardwareFacelets, orientation);
  if (!firstTwoLayersSolved(facelets)) return null;

  if (topFaceOriented(facelets)) {
    const pllMatch = selectIndexMatch(PLL_INDEX.get(pllSignature(facelets)));
    if (pllMatch) {
      return {
        ...pllMatch.result,
        facelets: restoreLibraryTopOrientation(facelets, pllMatch.topRotation),
      };
    }
  }

  const ollMatch = selectIndexMatch(OLL_INDEX.get(ollSignature(facelets)));
  if (!ollMatch) return null;
  return ollMatch.result;
}
