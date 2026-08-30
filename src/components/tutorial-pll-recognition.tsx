import pllData from "@/data/formulas/pll.json";
import { FormulaCubeImage } from "@/components/formula-cube-image";
import {
  DEFAULT_COLOR_PALETTE_ID,
  DEFAULT_ORIENTATION,
  getFaceHexColors,
} from "@/lib/cube-appearance";

type PllRecognitionGroup =
  | "features"
  | "corner-families"
  | "epll-cases"
  | "diagonal-cases"
  | "adjacent-cases";

type PllItem = {
  id: string;
  name: string;
  facelets?: string;
  algos?: Array<{ facelets?: string }>;
};

type PllCubeDiagramProps = {
  facelets: string;
  label: string;
  highlightedFacelets?: number[];
  compact?: boolean;
};

const TUTORIAL_FACE_COLORS = getFaceHexColors(DEFAULT_ORIENTATION, DEFAULT_COLOR_PALETTE_ID);
const VISIBLE_SIDE_FACELETS = [18, 19, 20, 9, 10, 11] as const;

const TOP_RING_GROUPS = [
  [47, 46, 45],
  [11, 10, 9],
  [20, 19, 18],
  [38, 37, 36],
] as const;

const CASE_IDS: Record<Exclude<PllRecognitionGroup, "features" | "corner-families">, string[]> = {
  "epll-cases": ["pll-h", "pll-z", "pll-ua", "pll-ub"],
  "diagonal-cases": ["pll-e", "pll-na", "pll-nb", "pll-v", "pll-y"],
  "adjacent-cases": [
    "pll-aa",
    "pll-ab",
    "pll-f",
    "pll-ga",
    "pll-gb",
    "pll-gc",
    "pll-gd",
    "pll-ja",
    "pll-jb",
    "pll-ra",
    "pll-rb",
    "pll-t",
  ],
};

const FEATURE_CARDS = [
  {
    title: "车灯",
    note: "同一面两颗角贴同色，中间的棱贴可以是别的颜色。车灯只描述两端角，不等于三格条。",
    stickers: ["F", "R", "F", "R", "B", "L"],
    marked: [0, 2],
  },
  {
    title: "3 格条",
    note: "同一面的角、棱、角连续三格同色。它是最强线索，所以总是最先检查。",
    stickers: ["F", "F", "F", "R", "B", "L"],
    marked: [0, 1, 2],
  },
  {
    title: "内侧 2 格块",
    note: "相邻同色格贴着两面接缝；图中正面右两格组成内侧块。",
    stickers: ["B", "F", "F", "R", "B", "L"],
    marked: [1, 2],
  },
  {
    title: "外侧 2 格块",
    note: "相邻同色格远离两面接缝；图中正面左两格组成外侧块。",
    stickers: ["F", "F", "B", "R", "B", "L"],
    marked: [0, 1],
  },
  {
    title: "书挡",
    note: "六格最外侧两颗角贴同色，像从两端夹住中间四格。书挡常在没有色块时负责收尾判断。",
    stickers: ["F", "B", "F", "B", "F", "F"],
    marked: [0, 5],
  },
  {
    title: "棋盘",
    note: "两种颜色在六格中交替出现，从左到右呈 A—B—A—B—A—B。",
    stickers: ["F", "B", "F", "B", "F", "B"],
    marked: [0, 1, 2, 3, 4, 5],
  },
] as const;

const CORNER_FAMILY_CARDS = [
  {
    title: "角块全部归位",
    cases: "H、Ua、Ub、Z",
    note: "两个可见面都有车灯。此时只剩棱块需要置换，也叫 EPLL。",
    stickers: ["F", "R", "F", "R", "B", "R"],
    marked: [0, 2, 3, 5],
  },
  {
    title: "对角换角",
    cases: "E、Na、Nb、V、Y",
    note: "两个可见面上，每一对角贴都是相对色。先把这五个案例单独学会，判断会很稳定。",
    stickers: ["F", "R", "B", "R", "B", "L"],
    marked: [0, 2, 3, 5],
  },
  {
    title: "相邻换角：车灯视角",
    cases: "A、F、G、J、R、T",
    note: "只有一个可见面出现车灯，另一个面的两颗角不是同色。",
    stickers: ["F", "R", "F", "R", "B", "L"],
    marked: [0, 2],
  },
  {
    title: "相邻换角：相对色视角",
    cases: "同一组 12 个案例",
    note: "换一个观察方向后，常表现为只有一个面的两颗角是相对色。两种现象都归入相邻换角。",
    stickers: ["F", "R", "B", "R", "F", "B"],
    marked: [0, 2],
  },
] as const;

function faceletsFromVisibleStickers(stickers: readonly string[]) {
  const facelets = Array<string>(54).fill("X");
  for (let index = 0; index < 9; index += 1) facelets[index] = "U";
  VISIBLE_SIDE_FACELETS.forEach((faceletIndex, index) => {
    facelets[faceletIndex] = stickers[index] ?? "X";
  });
  return facelets.join("");
}

function highlightedVisibleFacelets(marked: readonly number[] | undefined) {
  return marked?.map((index) => VISIBLE_SIDE_FACELETS[index]).filter((index) => index !== undefined) ?? [];
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

function caseFacelets(item: PllItem) {
  return item.facelets ?? item.algos?.find((variant) => variant.facelets)?.facelets ?? null;
}

function PllCubeDiagram({
  facelets,
  label,
  highlightedFacelets = [],
  compact = false,
}: PllCubeDiagramProps) {
  return (
    <div className={`tutorial-pll-cube${compact ? " is-compact" : ""}`}>
      <FormulaCubeImage
        className="tutorial-pll-cube-image"
        facelets={facelets}
        faceColors={TUTORIAL_FACE_COLORS}
        title={label}
        displayMode="last-layer"
        highlightedFacelets={highlightedFacelets}
      />
    </div>
  );
}

function FeatureGallery() {
  return (
    <div className="tutorial-pll-feature-grid">
      {FEATURE_CARDS.map((card) => (
        <figure className="tutorial-pll-feature-card" key={card.title}>
          <PllCubeDiagram
            facelets={faceletsFromVisibleStickers(card.stickers)}
            label={card.title}
            highlightedFacelets={highlightedVisibleFacelets("marked" in card ? card.marked : undefined)}
          />
          <figcaption>
            <strong>{card.title}</strong>
            <span>{card.note}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function CornerFamilyGallery() {
  return (
    <div className="tutorial-pll-family-grid">
      {CORNER_FAMILY_CARDS.map((card) => (
        <figure className="tutorial-pll-family-card" key={card.title}>
          <PllCubeDiagram
            facelets={faceletsFromVisibleStickers(card.stickers)}
            label={card.title}
            highlightedFacelets={highlightedVisibleFacelets(card.marked)}
          />
          <figcaption>
            <strong>{card.title}</strong>
            <em>{card.cases}</em>
            <span>{card.note}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function CaseGallery({ group }: { group: keyof typeof CASE_IDS }) {
  const items = (pllData.items as PllItem[]).filter((item) => CASE_IDS[group].includes(item.id));

  return (
    <div className="tutorial-pll-case-grid">
      {items.map((item) => {
        const initialFacelets = caseFacelets(item);
        if (!initialFacelets) return null;
        const angles = [initialFacelets];
        for (let index = 1; index < 4; index += 1) {
          angles.push(rotateTopLayerClockwise(angles[index - 1]));
        }

        return (
          <figure className="tutorial-pll-case-card" key={item.id}>
            <figcaption>{item.name.replace("-Perm", "")}</figcaption>
            <div className="tutorial-pll-angle-grid">
              {angles.map((facelets, index) => (
                <div className="tutorial-pll-angle" key={`${item.id}-${index}`}>
                  <PllCubeDiagram
                    facelets={facelets}
                    label={`${item.name} 的${["起始", "U", "U2", "U'"][index]}观察方向`}
                    compact
                  />
                  <small>{["起始", "U", "U2", "U'"][index]}</small>
                </div>
              ))}
            </div>
          </figure>
        );
      })}
    </div>
  );
}

export function TutorialPllRecognition({ group }: { group: string }) {
  if (group === "features") return <FeatureGallery />;
  if (group === "corner-families") return <CornerFamilyGallery />;
  if (group in CASE_IDS) return <CaseGallery group={group as keyof typeof CASE_IDS} />;
  throw new Error(`Unknown PLL recognition group: ${group}`);
}
