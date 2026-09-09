"use client";

import { useState } from "react";
import recognitionData from "@/data/tutorials/pll-six-sticker-recognition.json";
import { FormulaCubeImage } from "@/components/formula-cube-image";
import {
  DEFAULT_COLOR_PALETTE_ID,
  DEFAULT_ORIENTATION,
  getFaceHexColors,
} from "@/lib/cube-appearance";

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
    title: "车灯",
    note: "同一面两端角贴同色，中间棱贴颜色不同。三格同色那一面不计入车灯。",
    stickers: ["F", "B", "F", "R", "L", "R"],
    marked: [0, 2],
  },
  {
    title: "3×1 色块",
    note: "同一面的角、棱、角三格同色，该面只记 3×1 色块。图中右面另有独立车灯，仍保留车灯标签。",
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
    title: "书挡",
    note: "六格最左和最右的角贴同色，中间四格的颜色不限。",
    stickers: ["F", "B", "R", "B", "R", "F"],
    marked: [0, 5],
  },
  {
    title: "棋盘",
    note: "两种不同颜色连续交替，只记录最长的棋盘。图中仅标注 6 格棋盘。",
    stickers: ["F", "R", "F", "R", "F", "R"],
    marked: [0, 1, 2, 3, 4, 5],
  },
] as const;

const CORNER_FAMILY_CARDS = [
  {
    title: "角块全部归位",
    cases: "H、Ua、Ub、Z、PLL skip",
    note: "两个可见面各自的两端角贴同色。角块的相对位置已正确，可能还差一个 U 层调整。",
    stickers: ["F", "R", "F", "R", "B", "R"],
    marked: [0, 2, 3, 5],
  },
  {
    title: "对角换角",
    cases: "E、Na、Nb、V、Y",
    note: "两个可见面上，两端角贴分别互为相对色。",
    stickers: ["F", "R", "B", "L", "B", "R"],
    marked: [0, 2, 3, 5],
  },
  {
    title: "相邻换角：车灯视角",
    cases: "A、F、G、J、R、T",
    note: "只有一个可见面出现车灯，另一个面的两颗角不是同色。",
    stickers: ["F", "B", "F", "R", "R", "B"],
    marked: [0, 2],
  },
  {
    title: "相邻换角：相对色视角",
    cases: "同一组 12 个案例",
    note: "两面各自的角贴都不同色时，其中只有一个面的两端角贴互为相对色，归入相邻换角。",
    stickers: ["F", "F", "R", "B", "L", "F"],
    marked: [3, 5],
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
  return (
    <div className="tutorial-pll-strip" role="img" aria-label={`六格编码 ${code}`}>
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
    <section className="tutorial-pll-catalog" aria-label="PLL 情景目录">
      <div className="tutorial-pll-filters">
        <div className="tutorial-pll-filter-header">
          <strong>标签筛选</strong>
          <button type="button" onClick={() => setSelectedTags([])} disabled={selectedTags.length === 0}>
            清除筛选
          </button>
        </div>
        <p id="pll-filter-help">角块置换、颜色数量各选一项；可见特征可多选，结果需同时满足已选条件。</p>
        {FILTER_GROUPS.map((group) => {
          const multiple = group.id === "pattern";
          const tags = recognitionData.tags.filter((tag) => tag.group === group.id);
          const options = multiple ? tags : [{ id: "", label: "全部", description: "" }, ...tags];
          return (
            <fieldset key={group.id} aria-describedby="pll-filter-help">
              <legend>{group.label}</legend>
              <div className="tutorial-pll-tag-options">
                {options.map((tag) => (
                  <label
                    className="tutorial-pll-filter-option"
                    key={tag.id}
                    title={tag.description || undefined}
                  >
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      name={`pll-filter-${group.id}`}
                      value={tag.id}
                      checked={tag.id ? selectedTags.includes(tag.id) : !tags.some((option) => selectedTags.includes(option.id))}
                      aria-controls="pll-catalog-results"
                      onChange={() => multiple ? toggleTag(tag.id) : selectGroupTag(group.id, tag.id)}
                    />
                    {tag.label}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      <p className="tutorial-pll-result-count" role="status" aria-live="polite" aria-atomic="true">
        {caseCount} 个 PLL 类别 · {filteredScenarios.length} 种情景
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
                <ul className="tutorial-pll-scenario-tags" aria-label={`${scenario.code} 的全部标签`}>
                  {scenario.tags.map((id) => (
                    <li key={id} title={TAGS_BY_ID.get(id)?.description} data-selected={selectedTags.includes(id)}>
                      {TAGS_BY_ID.get(id)?.label}
                    </li>
                  ))}
                </ul>
              </figure>
            ))}
          </div>
        ) : (
          <div className="tutorial-pll-empty">
            <p>没有同时满足这些标签的情景，试着取消其中一个标签。</p>
            <button type="button" onClick={() => setSelectedTags([])}>显示全部情景</button>
          </div>
        )}
      </div>
    </section>
  );
}

export function TutorialPllRecognition({ group }: { group: string }) {
  if (group === "features") return <FeatureGallery />;
  if (group === "corner-families") return <CornerFamilyGallery />;
  if (group === "catalog") return <CaseCatalog />;
  throw new Error(`Unknown PLL recognition group: ${group}`);
}
