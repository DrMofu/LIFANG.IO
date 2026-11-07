"use client";

import { useCubeAppearance } from "@/components/cube-appearance-provider";
import { TutorialStaticCube } from "@/components/tutorial-static-cube";
import type { CubeOrientation } from "@/lib/cube-appearance";
import type { CubeFace } from "@/lib/smart-cube";
import { toTutorialHeadingId } from "@/lib/tutorial-headings";

type CubeStageId =
  | "bottom-daisy"
  | "bottom-cross"
  | "bottom-cross-check"
  | "bottom-corner-cases"
  | "first-layer"
  | "middle-edge-cases"
  | "middle-layer"
  | "top-cross-cases"
  | "top-cross"
  | "top-edge-check"
  | "top-edges"
  | "top-corner-check"
  | "top-corners"
  | "top-corner-twist"
  | "solved";

type CubeStageItem = {
  label: string;
  note: string;
  facelets: string;
  cameraLatitude?: number;
};

type CubeStageGroup = {
  label: string;
  items: CubeStageItem[];
};

const CENTERS = [
  [4, "U"], [13, "R"], [22, "F"], [31, "D"], [40, "L"], [49, "B"],
] as const;

type PaintedAreas = ReadonlyArray<readonly [CubeFace | "X", readonly number[]]>;

function indexes(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => start + index);
}

function createFacelets(paintedAreas: PaintedAreas) {
  const facelets = Array<string>(54).fill("X");
  for (const [index, face] of CENTERS) facelets[index] = face;
  for (const [face, area] of paintedAreas) {
    for (const index of area) facelets[index] = face;
  }
  return facelets.join("");
}

const BOTTOM_CROSS: PaintedAreas = [
  ["D", [28, 30, 31, 32, 34]],
  ["R", [16]], ["F", [25]], ["L", [43]], ["B", [52]],
];

const BOTTOM_LAYER: PaintedAreas = [
  ["D", indexes(27, 9)],
  ["R", indexes(15, 3)], ["F", indexes(24, 3)],
  ["L", indexes(42, 3)], ["B", indexes(51, 3)],
];

const FIRST_TWO_LAYERS: PaintedAreas = [
  ["D", indexes(27, 9)],
  ["R", indexes(12, 6)], ["F", indexes(21, 6)],
  ["L", indexes(39, 6)], ["B", indexes(48, 6)],
];

const TOP_CROSS: PaintedAreas = [...FIRST_TWO_LAYERS, ["U", [1, 3, 4, 5, 7]]];
const TOP_EDGES: PaintedAreas = [
  ...TOP_CROSS,
  ["F", [19]], ["R", [10]], ["L", [37]], ["B", [46]],
];

// Solved corner positions with legal twists [1, 1, 2, 2] in UFR, URB, UBL, ULF order.
const TWISTED_TOP_CORNERS: PaintedAreas = [
  ["U", [9, 45, 47, 38]],
  ["R", [20, 2]], ["F", [8, 6]], ["B", [11, 36]], ["L", [0, 18]],
];

const STAGE_CONFIGS: Record<CubeStageId, CubeStageGroup> = {
  "bottom-daisy": {
    label: "底层小花",
    items: [{
      label: "四张底面贴纸朝上",
      note: "底层棱块围住顶面中心。侧面暂时不需要对齐。",
      facelets: createFacelets([["D", [1, 3, 5, 7]], ["X", [13, 22]]]),
    }],
  },
  "bottom-cross": {
    label: "底层十字",
    items: [{
      label: "底层十字完成",
      note: "从底部看十字，四颗底棱的侧面贴纸也与中心同色。",
      facelets: createFacelets(BOTTOM_CROSS),
      cameraLatitude: -28,
    }],
  },
  "bottom-cross-check": {
    label: "底层十字的侧面对齐",
    items: [
      {
        label: "侧面对齐",
        note: "底面成十字，每颗底棱的侧面贴纸与中心同色。",
        facelets: createFacelets(BOTTOM_CROSS),
        cameraLatitude: -28,
      },
      {
        label: "侧面未对齐",
        note: "前、右底棱放错了位置，需要回到顶层重新对齐。",
        facelets: createFacelets([...BOTTOM_CROSS, ["R", [25]], ["F", [16]]]),
        cameraLatitude: -28,
      },
    ],
  },
  "bottom-corner-cases": {
    label: "右前上角的三种朝向",
    items: [
      {
        label: "底面贴纸朝右",
        note: "角块放在目标槽正上方，重复插角公式。",
        facelets: createFacelets([...BOTTOM_CROSS, ["R", [8]], ["D", [9]], ["F", [20]]]),
      },
      {
        label: "底面贴纸朝前",
        note: "做完整组后再检查，不在公式中途加转动。",
        facelets: createFacelets([...BOTTOM_CROSS, ["F", [8]], ["R", [9]], ["D", [20]]]),
      },
      {
        label: "底面贴纸朝上",
        note: "仍用同一条插角公式，直到目标底角三面归位。",
        facelets: createFacelets([...BOTTOM_CROSS, ["D", [8]], ["F", [9]], ["R", [20]]]),
      },
    ],
  },
  "first-layer": {
    label: "底层",
    items: [{
      label: "底层完成",
      note: "底面完整，四个侧面的最下排与各自中心同色。",
      facelets: createFacelets(BOTTOM_LAYER),
      cameraLatitude: -28,
    }],
  },
  "middle-edge-cases": {
    label: "中层棱块的目标槽",
    items: [
      {
        label: "插入右前槽",
        note: "前上棱的朝前贴纸对齐前面中心，朝上贴纸与右面中心同色。",
        facelets: createFacelets([...BOTTOM_LAYER, ["F", [19]], ["R", [7]]]),
      },
      {
        label: "插入左前槽",
        note: "前上棱的朝前贴纸对齐前面中心，朝上贴纸与左面中心同色。",
        facelets: createFacelets([...BOTTOM_LAYER, ["F", [19]], ["L", [7]]]),
      },
    ],
  },
  "middle-layer": {
    label: "前两层",
    items: [{
      label: "前两层完成",
      note: "底层保留完整，四个侧面的下两排已复原。",
      facelets: createFacelets(FIRST_TWO_LAYERS),
    }],
  },
  "top-cross-cases": {
    label: "顶层十字的三种待处理形状",
    items: [
      {
        label: "中心点",
        note: "四颗顶棱都没有顶面贴纸朝上，先做一次公式。",
        facelets: createFacelets(FIRST_TWO_LAYERS),
      },
      {
        label: "折角",
        note: "从上方看，两张顶面贴纸放在后、左。",
        facelets: createFacelets([...FIRST_TWO_LAYERS, ["U", [1, 3, 4]]]),
      },
      {
        label: "一字",
        note: "两张顶面贴纸放在左、右，横着摆。",
        facelets: createFacelets([...FIRST_TWO_LAYERS, ["U", [3, 4, 5]]]),
      },
    ],
  },
  "top-cross": {
    label: "顶层十字",
    items: [{
      label: "顶层十字完成",
      note: "四张顶面贴纸朝上，棱块的侧面贴纸可以暂时不对齐。",
      facelets: createFacelets(TOP_CROSS),
    }],
  },
  "top-edge-check": {
    label: "顶棱侧面的两种对齐情况",
    items: [
      {
        label: "相邻两颗对齐",
        note: "图中前、右已对齐。水平转动整颗魔方，把它们移到后、右再做公式。",
        facelets: createFacelets([...TOP_CROSS, ["F", [19]], ["R", [10]]]),
      },
      {
        label: "相对两颗对齐",
        note: "先做一次公式，再转 U 找到相邻的一对。",
        facelets: createFacelets([...TOP_CROSS, ["F", [19]], ["B", [46]]]),
      },
    ],
  },
  "top-edges": {
    label: "顶层棱块归位",
    items: [{
      label: "四颗顶棱归位",
      note: "顶层保留十字，四颗顶棱的侧面贴纸与中心同色。",
      facelets: createFacelets(TOP_EDGES),
    }],
  },
  "top-corner-check": {
    label: "顶角的位置与朝向",
    items: [
      {
        label: "位置正确，朝向未正",
        note: "右前上角的三张贴纸与周围三个中心同色，只需要翻正。",
        facelets: createFacelets([...TOP_EDGES, ["F", [8]], ["U", [9]], ["R", [20]]]),
      },
      {
        label: "朝上也可能放错位置",
        note: "这颗角块属于后、右两个中心之间，不能留在右前角。",
        facelets: createFacelets([...TOP_EDGES, ["U", [8]], ["B", [9]], ["R", [20]]]),
      },
    ],
  },
  "top-corners": {
    label: "顶层角块归位",
    items: [{
      label: "四颗顶角位置正确",
      note: "每颗角都属于所在的角槽，顶面贴纸还可能朝向侧面。",
      facelets: createFacelets([...TOP_EDGES, ...TWISTED_TOP_CORNERS]),
    }],
  },
  "top-corner-twist": {
    label: "翻正顶层角块",
    items: [{
      label: "处理右前上角",
      note: "固定正面，先翻正这颗角；再只转 U 换下一颗。",
      facelets: createFacelets([...TOP_EDGES, ...TWISTED_TOP_CORNERS]),
    }],
  },
  solved: {
    label: "复原完成",
    items: [{
      label: "六面复原",
      note: "六个面分别与各自的中心块同色。",
      facelets: createFacelets([
        ["U", indexes(0, 9)], ["R", indexes(9, 9)], ["F", indexes(18, 9)],
        ["D", indexes(27, 9)], ["L", indexes(36, 9)], ["B", indexes(45, 9)],
      ]),
    }],
  },
};

function isCubeStageId(stage: string): stage is CubeStageId {
  return stage in STAGE_CONFIGS;
}

function StageCube({
  item,
  faceColors,
  orientation,
}: {
  item: CubeStageItem;
  faceColors: Record<CubeFace, string>;
  orientation: CubeOrientation;
}) {
  return (
    <TutorialStaticCube
      className="tutorial-stage-cube-render"
      formulaFacelets={item.facelets}
      cameraDistance={6.4}
      cameraLatitude={item.cameraLatitude}
      faceColors={faceColors}
      orientation={orientation}
      sizes="(max-width: 560px) 44vw, 190px"
    />
  );
}

export function TutorialCubeStage({ stage }: { stage: string }) {
  if (!isCubeStageId(stage)) throw new Error(`Unknown tutorial cube stage: ${stage}`);
  const config = STAGE_CONFIGS[stage];
  const { faceColors, orientation } = useCubeAppearance();

  if (config.items.length === 1) {
    const item = config.items[0];
    return (
      <figure className="tutorial-stage-figure">
        <div className="tutorial-stage-cube">
          <StageCube item={item} faceColors={faceColors} orientation={orientation} />
        </div>
        <figcaption>
          <strong>{item.label}</strong>
          <span>{item.note}</span>
        </figcaption>
      </figure>
    );
  }

  return (
    <section className={`tutorial-stage-gallery is-${config.items.length}-up`} aria-label={config.label}>
      {config.items.map((item) => (
        <figure className="tutorial-stage-card" key={item.label}>
          <div className="tutorial-stage-card-visual">
            <StageCube item={item} faceColors={faceColors} orientation={orientation} />
          </div>
          <figcaption>
            <strong>{item.label}</strong>
            <span>{item.note}</span>
          </figcaption>
        </figure>
      ))}
    </section>
  );
}

const SOLVE_FLOW: Array<{ stage: CubeStageId; label: string; heading: string }> = [
  { stage: "bottom-daisy", label: "底层小花", heading: "第一步：底层小花" },
  { stage: "bottom-cross", label: "底层十字", heading: "第二步：底层十字" },
  { stage: "first-layer", label: "复原底层", heading: "第三步：复原底层" },
  { stage: "middle-layer", label: "中间层", heading: "第四步：复原中间层" },
  { stage: "top-cross", label: "顶层十字", heading: "第五步：顶层十字" },
  { stage: "top-edges", label: "顶层棱块归位", heading: "第六步：顶层棱块归位" },
  { stage: "top-corners", label: "顶层角块归位", heading: "第七步：顶层角块归位" },
  { stage: "solved", label: "翻正顶层角块", heading: "第八步：翻正顶层角块" },
];

export function TutorialSolveFlow() {
  const { faceColors, orientation } = useCubeAppearance();

  return (
    <>
      <ol className="tutorial-solve-flow" aria-label="层先法复原流程">
        {SOLVE_FLOW.map(({ stage, label, heading }, index) => (
          <li key={stage}>
            <a href={`#${toTutorialHeadingId(heading)}`}>
              <span className="tutorial-solve-flow-number" aria-hidden="true">{index + 1}</span>
              <div className="tutorial-solve-flow-cube">
                <StageCube item={STAGE_CONFIGS[stage].items[0]} faceColors={faceColors} orientation={orientation} />
              </div>
              <span className="tutorial-solve-flow-label">{label}</span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}
