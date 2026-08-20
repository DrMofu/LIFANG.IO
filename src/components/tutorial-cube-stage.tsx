"use client";

import { useCubeAppearance } from "@/components/cube-appearance-provider";
import { TutorialStaticCube } from "@/components/tutorial-static-cube";
import type { CubeOrientation } from "@/lib/cube-appearance";
import type { CubeFace } from "@/lib/smart-cube";

type CubeStageId =
  | "piece-types"
  | "white-daisy"
  | "white-cross"
  | "white-cross-check"
  | "first-layer-corner-cases"
  | "first-layer"
  | "middle-edge-cases"
  | "middle-layer"
  | "yellow-cross-cases"
  | "yellow-cross"
  | "yellow-edge-check"
  | "yellow-edges"
  | "yellow-corner-check"
  | "yellow-corners"
  | "yellow-corner-twist"
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

const WHITE_TOP_CENTERS = [
  [4, "D"],
  [13, "R"],
  [22, "F"],
  [31, "U"],
  [40, "L"],
  [49, "B"],
] as const;

const YELLOW_TOP_CENTERS = [
  [4, "U"],
  [13, "R"],
  [22, "F"],
  [31, "D"],
  [40, "L"],
  [49, "B"],
] as const;

function indexes(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => start + index);
}

function createFacelets(
  centers: ReadonlyArray<readonly [number, string]>,
  paintedAreas: ReadonlyArray<readonly [string, readonly number[]]>,
) {
  const facelets = Array<string>(54).fill("X");
  for (const [index, color] of centers) facelets[index] = color;
  for (const [color, area] of paintedAreas) {
    for (const index of area) facelets[index] = color;
  }
  return facelets.join("");
}

const FIRST_LAYER_BOTTOM: ReadonlyArray<readonly [string, readonly number[]]> = [
  ["D", indexes(27, 9)],
  ["R", indexes(15, 3)],
  ["F", indexes(24, 3)],
  ["L", indexes(42, 3)],
  ["B", indexes(51, 3)],
];

const FIRST_TWO_LAYERS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ["D", indexes(27, 9)],
  ["R", indexes(12, 6)],
  ["F", indexes(21, 6)],
  ["L", indexes(39, 6)],
  ["B", indexes(48, 6)],
];

const YELLOW_CROSS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ...FIRST_TWO_LAYERS,
  ["U", [1, 3, 4, 5, 7]],
];

const YELLOW_EDGES: ReadonlyArray<readonly [string, readonly number[]]> = [
  ...YELLOW_CROSS,
  ["F", [19]],
  ["R", [10]],
  ["L", [37]],
  ["B", [46]],
];

const CORRECT_TWISTED_CORNERS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ["R", [8, 11]],
  ["F", [9, 6]],
  ["U", [20, 45, 47, 38]],
  ["B", [2, 36]],
  ["L", [0, 18]],
];

const STAGE_CONFIGS: Record<CubeStageId, CubeStageGroup> = {
  "piece-types": {
    label: "三种块的位置",
    items: [
      {
        label: "中心块",
        note: "只有一个颜色，始终留在同一面，决定该面的最终颜色。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, []),
      },
      {
        label: "棱块",
        note: "有两个颜色，位于两面之间；图中标出黄绿棱块。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [["U", [7]], ["F", [19]]]),
      },
      {
        label: "角块",
        note: "有三个颜色，位于三面交界；图中标出黄橙绿角块。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [["U", [8]], ["R", [9]], ["F", [20]]]),
      },
    ],
  },
  "white-daisy": {
    label: "白色小花",
    items: [{
      label: "白色小花完成",
      note: "黄色中心在上，四颗白色棱块围在黄色中心四周；侧面暂时不用对齐。",
      facelets: createFacelets(YELLOW_TOP_CENTERS, [["D", [1, 3, 5, 7]]]),
    }],
  },
  "white-cross": {
    label: "白色十字",
    items: [{
      label: "白色十字完成",
      note: "白色棱块朝上，同时四个侧面棱块都与各自中心同色。",
      facelets: createFacelets(WHITE_TOP_CENTERS, [
        ["D", [1, 3, 4, 5, 7]],
        ["F", [19]],
        ["R", [10]],
        ["L", [37]],
        ["B", [46]],
      ]),
    }],
  },
  "white-cross-check": {
    label: "白色十字的正确与错误",
    items: [
      {
        label: "正确：白棱侧色也对齐",
        note: "白色朝上只是第一项检查；四颗棱块的侧面颜色还要分别连接同色中心。",
        facelets: createFacelets(WHITE_TOP_CENTERS, [
          ["D", [1, 3, 4, 5, 7]],
          ["F", [19]],
          ["R", [10]],
          ["L", [37]],
          ["B", [46]],
        ]),
      },
      {
        label: "错误：只拼出白色图案",
        note: "白色十字虽然完整，但前、右两颗棱块放错了位置，必须重新按中心颜色对齐。",
        facelets: createFacelets(WHITE_TOP_CENTERS, [
          ["D", [1, 3, 4, 5, 7]],
          ["R", [19]],
          ["F", [10]],
          ["L", [37]],
          ["B", [46]],
        ]),
      },
    ],
  },
  "first-layer-corner-cases": {
    label: "白色角块的三种朝向",
    items: [
      {
        label: "白色朝右",
        note: "目标角在右前下方；完整重复四步手法，直到它进入正上方的槽位。",
        facelets: createFacelets(WHITE_TOP_CENTERS, [["F", [29]], ["D", [15]], ["R", [26]]]),
        cameraLatitude: -28,
      },
      {
        label: "白色朝前",
        note: "仍然使用同一手法，不需要记另一条角块公式。",
        facelets: createFacelets(WHITE_TOP_CENTERS, [["R", [29]], ["F", [15]], ["D", [26]]]),
        cameraLatitude: -28,
      },
      {
        label: "白色朝下",
        note: "白色在底面时会多重复几组；每组四步都必须完整做完。",
        facelets: createFacelets(WHITE_TOP_CENTERS, [["D", [29]], ["R", [15]], ["F", [26]]]),
        cameraLatitude: -28,
      },
    ],
  },
  "first-layer": {
    label: "白色第一层",
    items: [{
      label: "第一层完成",
      note: "白色面完整，四个侧面的第一排也分别与中心块同色。",
      facelets: createFacelets(WHITE_TOP_CENTERS, [
        ["D", indexes(0, 9)],
        ["R", indexes(9, 3)],
        ["F", indexes(18, 3)],
        ["L", indexes(36, 3)],
        ["B", indexes(45, 3)],
      ]),
    }],
  },
  "middle-edge-cases": {
    label: "中层棱块的去向",
    items: [
      {
        label: "目标槽在右边",
        note: "顶层棱块的正面颜色已对齐，另一种颜色属于右面。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [...FIRST_LAYER_BOTTOM, ["F", [19]], ["R", [7]]]),
      },
      {
        label: "目标槽在左边",
        note: "另一种颜色属于左面；保持当前正面，使用向左插入的镜像公式。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [...FIRST_LAYER_BOTTOM, ["F", [19]], ["L", [7]]]),
      },
    ],
  },
  "middle-layer": {
    label: "前两层",
    items: [{
      label: "前两层完成",
      note: "白色面在底部，四个侧面的下两排全部与中心块同色。",
      facelets: createFacelets(YELLOW_TOP_CENTERS, FIRST_TWO_LAYERS),
    }],
  },
  "yellow-cross-cases": {
    label: "黄色十字的三种未完成形态",
    items: [
      {
        label: "中心点",
        note: "只有黄色中心朝上；先从任意方向做一次公式。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [...FIRST_TWO_LAYERS, ["U", [4]]]),
      },
      {
        label: "折角",
        note: "从顶面看，把两个黄色棱块放在后方和左方。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [...FIRST_TWO_LAYERS, ["U", [1, 3, 4]]]),
      },
      {
        label: "一字",
        note: "从顶面看，让黄色一字横向摆放。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [...FIRST_TWO_LAYERS, ["U", [3, 4, 5]]]),
      },
    ],
  },
  "yellow-cross": {
    label: "黄色十字",
    items: [{
      label: "黄色十字完成",
      note: "只检查四颗黄色棱块是否朝上，顶角和侧面是否对齐暂时不重要。",
      facelets: createFacelets(YELLOW_TOP_CENTERS, YELLOW_CROSS),
    }],
  },
  "yellow-edge-check": {
    label: "黄色棱块的两种待处理情形",
    items: [
      {
        label: "两颗相邻棱块对齐",
        note: "图中先找到了前面与右面；执行前水平转动整颗魔方，把它们移到右面与后面。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [...YELLOW_CROSS, ["F", [19]], ["R", [10]]]),
      },
      {
        label: "两颗相对棱块对齐",
        note: "先从任意方向执行一次公式，重新转动 U 检查，通常会变成相邻情形。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [...YELLOW_CROSS, ["F", [19]], ["B", [46]]]),
      },
    ],
  },
  "yellow-edges": {
    label: "黄色棱块归位",
    items: [{
      label: "四颗黄色棱块全部归位",
      note: "顶面仍是黄色十字，四个侧面的上排中间块也都与中心同色。",
      facelets: createFacelets(YELLOW_TOP_CENTERS, YELLOW_EDGES),
    }],
  },
  "yellow-corner-check": {
    label: "检查黄色角块的位置",
    items: [
      {
        label: "位置正确，方向可以暂时不对",
        note: "这颗角的三种颜色与周围三个中心相同，所以它已经属于这个角落。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [
          ...YELLOW_EDGES,
          ["R", [8]],
          ["F", [9]],
          ["U", [20]],
        ]),
      },
      {
        label: "位置错误，黄色朝上也不算完成",
        note: "角块含有不属于这个角落的颜色；判断位置时要同时看完三种颜色。",
        facelets: createFacelets(YELLOW_TOP_CENTERS, [
          ...YELLOW_EDGES,
          ["U", [8]],
          ["R", [9]],
          ["B", [20]],
        ]),
      },
    ],
  },
  "yellow-corners": {
    label: "黄色角块归位",
    items: [{
      label: "四颗黄色角块位置正确",
      note: "每颗顶角都属于所在角落；黄色贴纸可能仍朝向侧面，下一步再统一翻正。",
      facelets: createFacelets(YELLOW_TOP_CENTERS, [...YELLOW_EDGES, ...CORRECT_TWISTED_CORNERS]),
    }],
  },
  "yellow-corner-twist": {
    label: "逐颗翻正黄色角块",
    items: [{
      label: "先处理右前上角",
      note: "固定握持方向，重复四步手法直到这颗角的黄色朝上，再只转 U 换下一颗。",
      facelets: createFacelets(YELLOW_TOP_CENTERS, [
        ...YELLOW_EDGES,
        ...CORRECT_TWISTED_CORNERS,
        ["U", [8]],
        ["R", [9]],
        ["F", [20]],
      ]),
    }],
  },
  solved: {
    label: "复原完成",
    items: [{
      label: "三阶魔方复原完成",
      note: "六个面全部同色；图中以黄色朝上、白色朝下展示。",
      facelets: createFacelets(YELLOW_TOP_CENTERS, [
        ["U", indexes(0, 9)],
        ["R", indexes(9, 9)],
        ["F", indexes(18, 9)],
        ["D", indexes(27, 9)],
        ["L", indexes(36, 9)],
        ["B", indexes(45, 9)],
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
