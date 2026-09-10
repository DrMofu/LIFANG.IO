"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import recognitionData from "@/data/tutorials/pll-six-sticker-recognition.json";
import { FormulaCubeImage } from "@/components/formula-cube-image";
import {
  DEFAULT_COLOR_PALETTE_ID,
  DEFAULT_ORIENTATION,
  getFaceHexColors,
} from "@/lib/cube-appearance";

const ENGLISH_COPY: Record<string, string> = {
  "车灯（headlight）": "Headlights",
  "同一面两端角贴同色，中间棱贴颜色不同。": "The two corner stickers on one face match, while the edge sticker between them is a different color.",
  "3×1 色块": "3×1 block",
  "同一面的角、棱、角三格同色。": "The corner, edge, and corner stickers on one face all match.",
  "内侧 2×1 色块": "Inner 2×1 block",
  "相邻同色格贴着两面接缝；图中正面右两格组成内侧块。": "Two matching adjacent stickers sit next to the seam between the faces. Here, the right two stickers on the front face form the inner block.",
  "外侧 2×1 色块": "Outer 2×1 block",
  "相邻同色格远离两面接缝；图中正面左两格组成外侧块。": "Two matching adjacent stickers sit away from the seam between the faces. Here, the left two stickers on the front face form the outer block.",
  "书挡（bookend）": "Bookends",
  "六格最左和最右的角贴同色。": "The corner stickers at the far left and far right of the six-sticker view match.",
  "棋盘（checkerboard）": "Checkerboard",
  "两种不同颜色连续交替。": "Two different colors alternate in a consecutive sequence.",
  "角块置换": "Corner permutation",
  "颜色数量": "Number of colors",
  "可见特征": "Visible features",
  "六格编码": "Six-sticker code",
  "PLL 情景目录": "PLL case catalog",
  "标签筛选": "Filter by tags",
  "清除筛选": "Clear filters",
  "角块置换、颜色数量各选一项；可见特征可多选，结果需同时满足已选条件。": "Select one corner permutation and one color count. You can select multiple visible features; results must match every selected condition.",
  "全部": "All",
  "没有同时满足这些标签的情景，试着取消其中一个标签。": "No views match all these tags. Try deselecting a tag.",
  "显示全部情景": "Show all views",
  "车灯": "Headlights",
  "同一面两端角贴同色，中间棱贴颜色不同；三格同色那一面不计入车灯。": "The two corner stickers on one face match, but the edge sticker between them differs. A solid three-sticker bar does not count as headlights.",
  "书挡": "Bookends",
  "六格最左与最右的角贴同色。": "The corner stickers at the far left and far right of the six-sticker view match.",
  "2×1 色块": "2×1 block",
  "同一面恰有连续两格同色，第三格颜色不同；三格同色内部的两格不计入。": "Exactly two adjacent stickers on one face match, and the third differs. Pairs within a solid three-sticker bar do not count.",
  "同一面的三格全部同色。": "All three stickers on one face match.",
  "4 格棋盘": "4-sticker checkerboard",
  "最长的连续双色交替片段为四格，可跨越两面接缝。": "The longest consecutive sequence alternating between two colors is four stickers long. It can cross the seam between the faces.",
  "5 格棋盘": "5-sticker checkerboard",
  "最长的连续双色交替片段为五格，不再标注 4 格棋盘。": "The longest consecutive sequence alternating between two colors is five stickers long. The 4-sticker tag is omitted.",
  "6 格棋盘": "6-sticker checkerboard",
  "六格由两种不同颜色连续交替组成，不再标注 4 格和 5 格棋盘。": "All six stickers alternate between two different colors. The 4-sticker and 5-sticker tags are omitted.",
  "2 种颜色": "2 colors",
  "全部六格恰好有两种颜色。": "There are exactly two colors across all six stickers.",
  "3 种颜色": "3 colors",
  "全部六格恰好有三种颜色。": "There are exactly three colors across all six stickers.",
  "4 种颜色": "4 colors",
  "全部六格恰好有四种颜色。": "There are exactly four colors across all six stickers.",
  "EPLL · 角块归位": "EPLL · Corners solved",
  "四个角块的相对位置正确，允许整体差一个 U 层调整；包含 PLL skip。": "All four corners are correctly positioned relative to each other, possibly requiring a U-layer adjustment. Includes PLL skip.",
  "Diag CP · 对角换角": "Diag CP · Diagonal corner swap",
  "调整 U 层后，需要交换一对对角的角块。": "After adjusting the U layer, a pair of diagonally opposite corners needs to be swapped.",
  "Adj CP · 邻角换角": "Adj CP · Adjacent corner swap",
  "调整 U 层后，需要交换一对相邻的角块。": "After adjusting the U layer, a pair of adjacent corners needs to be swapped."
};

function usePllCopy() {
  const { locale } = useLanguage();
  return { locale, t: (text: string) => locale === "en" ? ENGLISH_COPY[text] ?? text : text };
}

type PllCubeDiagramProps = {
  facelets: string;
  label: string;
  highlightedFacelets?: number[];
  compact?: boolean;
};

const TUTORIAL_FACE_COLORS = getFaceHexColors(DEFAULT_ORIENTATION, DEFAULT_COLOR_PALETTE_ID);
const VISIBLE_SIDE_FACELETS = [18, 19, 20, 9, 10, 11] as const;

const FEATURE_CARDS = [
  {
    title: "车灯（headlight）",
    note: "同一面两端角贴同色，中间棱贴颜色不同。",
    stickers: ["F", "B", "F", "R", "L", "R"],
    marked: [0, 2],
  },
  {
    title: "3×1 色块",
    note: "同一面的角、棱、角三格同色。",
    stickers: ["F", "F", "F", "R", "B", "R"],
    marked: [0, 1, 2],
  },
  {
    title: "内侧 2×1 色块",
    note: "相邻同色格贴着两面接缝；图中正面右两格组成内侧块。",
    stickers: ["F", "R", "R", "B", "B", "F"],
    marked: [1, 2],
  },
  {
    title: "外侧 2×1 色块",
    note: "相邻同色格远离两面接缝；图中正面左两格组成外侧块。",
    stickers: ["F", "F", "R", "B", "L", "F"],
    marked: [0, 1],
  },
  {
    title: "书挡（bookend）",
    note: "六格最左和最右的角贴同色。",
    stickers: ["F", "B", "R", "B", "R", "F"],
    marked: [0, 5],
  },
  {
    title: "棋盘（checkerboard）",
    note: "两种不同颜色连续交替。",
    stickers: ["F", "R", "F", "R", "F", "R"],
    marked: [0, 1, 2, 3, 4, 5],
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
  const { t } = usePllCopy();
  return (
    <div className="tutorial-pll-feature-grid">
      {FEATURE_CARDS.map((card) => (
        <figure className="tutorial-pll-feature-card" key={card.title}>
          <PllCubeDiagram
            facelets={faceletsFromVisibleStickers(card.stickers)}
            label={t(card.title)}
            highlightedFacelets={highlightedVisibleFacelets("marked" in card ? card.marked : undefined)}
          />
          <figcaption>
            <strong>{t(card.title)}</strong>
            <span>{t(card.note)}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

const TAGS_BY_ID = new Map(recognitionData.tags.map((tag) => [tag.id, tag]));
const SCENARIOS = recognitionData.cases.flatMap((item) =>
  item.scenarios.map((scenario) => ({ ...scenario, caseId: item.id, name: item.name })),
);
const FILTER_GROUPS = [
  { id: "corners", label: "角块置换" },
  { id: "colors", label: "颜色数量" },
  { id: "pattern", label: "可见特征" },
];

function StickerStrip({ code }: { code: string }) {
  const { t } = usePllCopy();
  return (
    <div className="tutorial-pll-strip" role="img" aria-label={`${t("六格编码")} ${code}`}>
      {[...code].map((face, index) => (
        <span
          key={index}
          style={{ backgroundColor: TUTORIAL_FACE_COLORS[face as keyof typeof TUTORIAL_FACE_COLORS] }}
          aria-hidden="true"
        >
          {face}
        </span>
      ))}
    </div>
  );
}

function CaseCatalog() {
  const { locale, t } = usePllCopy();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const filteredScenarios = SCENARIOS.filter((scenario) => selectedTags.every((tag) => scenario.tags.includes(tag)));
  const caseCount = new Set(filteredScenarios.map((scenario) => scenario.caseId)).size;

  function toggleTag(tag: string) {
    setSelectedTags((current) => current.includes(tag)
      ? current.filter((value) => value !== tag)
      : [...current, tag]);
  }

  function selectGroupTag(group: string, tag: string) {
    setSelectedTags((current) => {
      const otherTags = current.filter((value) => TAGS_BY_ID.get(value)?.group !== group);
      return tag ? [...otherTags, tag] : otherTags;
    });
  }

  return (
    <section className="tutorial-pll-catalog" aria-label={t("PLL 情景目录")}>
      <div className="tutorial-pll-filters">
        <div className="tutorial-pll-filter-header">
          <strong>{t("标签筛选")}</strong>
          <button type="button" onClick={() => setSelectedTags([])} disabled={selectedTags.length === 0}>
            {t("清除筛选")}
          </button>
        </div>
        <p id="pll-filter-help">{t("角块置换、颜色数量各选一项；可见特征可多选，结果需同时满足已选条件。")}</p>
        {FILTER_GROUPS.map((group) => {
          const multiple = group.id === "pattern";
          const tags = recognitionData.tags.filter((tag) => tag.group === group.id);
          const options = multiple ? tags : [{ id: "", label: "全部", description: "" }, ...tags];
          return (
            <fieldset key={group.id} aria-describedby="pll-filter-help">
              <legend>{t(group.label)}</legend>
              <div className="tutorial-pll-tag-options">
                {options.map((tag) => (
                  <label
                    className="tutorial-pll-filter-option"
                    key={tag.id}
                    title={tag.description ? t(tag.description) : undefined}
                  >
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      name={`pll-filter-${group.id}`}
                      value={tag.id}
                      checked={tag.id ? selectedTags.includes(tag.id) : !tags.some((option) => selectedTags.includes(option.id))}
                      aria-controls="pll-catalog-results"
                      onChange={() => multiple ? toggleTag(tag.id) : selectGroupTag(group.id, tag.id)}
                    />
                    {t(tag.label)}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      <p className="tutorial-pll-result-count" role="status" aria-live="polite" aria-atomic="true">
        {locale === "en"
          ? `${caseCount} PLL ${caseCount === 1 ? "case" : "cases"} · ${filteredScenarios.length} ${filteredScenarios.length === 1 ? "view" : "views"}`
          : `${caseCount} 个 PLL 类别 · ${filteredScenarios.length} 种情景`}
      </p>
      <div id="pll-catalog-results">
        {filteredScenarios.length > 0 ? (
          <div className="tutorial-pll-scenario-grid">
            {filteredScenarios.map((scenario) => (
              <figure className="tutorial-pll-scenario-card" key={scenario.code}>
                <figcaption>{scenario.name}</figcaption>
                <PllCubeDiagram
                  facelets={faceletsFromVisibleStickers([...scenario.code])}
                  label={`${scenario.name} · ${scenario.code}`}
                  compact
                />
                <StickerStrip code={scenario.code} />
                <ul className="tutorial-pll-scenario-tags" aria-label={locale === "en" ? `All tags for ${scenario.code}` : `${scenario.code} 的全部标签`}>
                  {scenario.tags.map((id) => (
                    <li key={id} title={t(TAGS_BY_ID.get(id)?.description ?? "")} data-selected={selectedTags.includes(id)}>
                      {t(TAGS_BY_ID.get(id)?.label ?? "")}
                    </li>
                  ))}
                </ul>
              </figure>
            ))}
          </div>
        ) : (
          <div className="tutorial-pll-empty">
            <p>{t("没有同时满足这些标签的情景，试着取消其中一个标签。")}</p>
            <button type="button" onClick={() => setSelectedTags([])}>{t("显示全部情景")}</button>
          </div>
        )}
      </div>
    </section>
  );
}

export function TutorialPllRecognition({ group }: { group: string }) {
  if (group === "features") return <FeatureGallery />;
  if (group === "catalog") return <CaseCatalog />;
  throw new Error(`Unknown PLL recognition group: ${group}`);
}
