"use client";

import { useCubeAppearance } from "@/components/cube-appearance-provider";
import { useLanguage } from "@/components/language-provider";
import { TutorialStaticCube } from "@/components/tutorial-static-cube";
import type { CubeOrientation } from "@/lib/cube-appearance";
import type { CubeFace } from "@/lib/smart-cube";

type GalleryId = "faces" | "turns" | "suffixes" | "rotations" | "slices" | "wide";

type MoveDiagram = {
  symbol: string;
  move: string;
  title: string;
  note?: string;
  face?: CubeFace;
};

const FACE_ORDER: CubeFace[] = ["U", "R", "F", "D", "L", "B"];

function highlightedFacelets(face: CubeFace) {
  return FACE_ORDER.map((candidate) => candidate === face ? face.repeat(9) : "X".repeat(9)).join("");
}

const GALLERIES: Record<GalleryId, { label: string; items: MoveDiagram[] }> = {
  faces: {
    label: "六个面的转动示意",
    items: [
      { symbol: "R", move: "R", title: "右面", face: "R" },
      { symbol: "L", move: "L", title: "左面", face: "L" },
      { symbol: "U", move: "U", title: "上面", face: "U" },
      { symbol: "D", move: "D", title: "下面", face: "D" },
      { symbol: "F", move: "F", title: "前面", face: "F" },
      { symbol: "B", move: "B", title: "后面", face: "B" },
    ],
  },
  turns: {
    label: "六个面的单层转动示意",
    items: [
      { symbol: "R", move: "R", title: "转动右面" },
      { symbol: "L", move: "L", title: "转动左面" },
      { symbol: "U", move: "U", title: "转动上面" },
      { symbol: "D", move: "D", title: "转动下面" },
      { symbol: "F", move: "F", title: "转动前面" },
      { symbol: "B", move: "B", title: "转动后面" },
    ],
  },
  suffixes: {
    label: "转动后缀示意",
    items: [
      { symbol: "R", move: "R", title: "无后缀", note: "顺时针 90°" },
      { symbol: "R'", move: "R'", title: "撇号", note: "逆时针 90°" },
      { symbol: "R2", move: "R2", title: "数字 2", note: "转动 180°" },
    ],
  },
  rotations: {
    label: "整颗魔方旋转示意",
    items: [
      { symbol: "x", move: "x", title: "左右轴", note: "方向与 R 相同" },
      { symbol: "y", move: "y", title: "上下轴", note: "方向与 U 相同" },
      { symbol: "z", move: "z", title: "前后轴", note: "方向与 F 相同" },
    ],
  },
  slices: {
    label: "中间层转动示意",
    items: [
      { symbol: "M", move: "M", title: "中间竖层", note: "方向与 L 相同" },
      { symbol: "E", move: "E", title: "中间横层", note: "方向与 D 相同" },
      { symbol: "S", move: "S", title: "中间前后层", note: "方向与 F 相同" },
    ],
  },
  wide: {
    label: "宽层转动示意",
    items: [
      { symbol: "r", move: "r", title: "右边两层", note: "右层与相邻中层一起转动" },
      { symbol: "l", move: "l", title: "左边两层", note: "左层与相邻中层一起转动" },
      { symbol: "u", move: "u", title: "上面两层", note: "上层与相邻中层一起转动" },
      { symbol: "d", move: "d", title: "下面两层", note: "下层与相邻中层一起转动" },
      { symbol: "f", move: "f", title: "前面两层", note: "前层与相邻中层一起转动" },
      { symbol: "b", move: "b", title: "后面两层", note: "后层与相邻中层一起转动" },
    ],
  },
};

const ENGLISH_GALLERY_COPY: Record<string, string> = {
  "六个面的转动示意": "The six cube faces",
  "右面": "Right face",
  "左面": "Left face",
  "上面": "Upper face",
  "下面": "Down face",
  "前面": "Front face",
  "后面": "Back face",
  "六个面的单层转动示意": "Single-layer face turns",
  "转动右面": "Turn the right face",
  "转动左面": "Turn the left face",
  "转动上面": "Turn the upper face",
  "转动下面": "Turn the down face",
  "转动前面": "Turn the front face",
  "转动后面": "Turn the back face",
  "转动后缀示意": "Turn suffixes",
  "无后缀": "No suffix",
  "顺时针 90°": "90° clockwise",
  "撇号": "Prime mark",
  "逆时针 90°": "90° counterclockwise",
  "数字 2": "Number 2",
  "转动 180°": "Turn 180°",
  "整颗魔方旋转示意": "Whole-cube rotations",
  "左右轴": "Left–right axis",
  "上下轴": "Up–down axis",
  "前后轴": "Front–back axis",
  "方向与 R 相同": "Same direction as R",
  "方向与 U 相同": "Same direction as U",
  "方向与 F 相同": "Same direction as F",
  "中间层转动示意": "Slice moves",
  "中间竖层": "Middle vertical slice",
  "中间横层": "Middle horizontal slice",
  "中间前后层": "Middle front–back slice",
  "方向与 L 相同": "Same direction as L",
  "方向与 D 相同": "Same direction as D",
  "宽层转动示意": "Wide turns",
  "右边两层": "Right two layers",
  "左边两层": "Left two layers",
  "上面两层": "Upper two layers",
  "下面两层": "Bottom two layers",
  "前面两层": "Front two layers",
  "后面两层": "Back two layers",
  "右层与相邻中层一起转动": "Turn the right face and adjacent slice together",
  "左层与相邻中层一起转动": "Turn the left face and adjacent slice together",
  "上层与相邻中层一起转动": "Turn the upper face and adjacent slice together",
  "下层与相邻中层一起转动": "Turn the bottom face and adjacent slice together",
  "前层与相邻中层一起转动": "Turn the front face and adjacent slice together",
  "后层与相邻中层一起转动": "Turn the back face and adjacent slice together",
};

function getGalleryCopy(source: string, locale: "zh" | "en") {
  return locale === "en" ? ENGLISH_GALLERY_COPY[source] ?? source : source;
}

function NotationCard({
  diagram,
  faceColors,
  orientation,
  locale,
}: {
  diagram: MoveDiagram;
  faceColors: Record<CubeFace, string>;
  orientation: CubeOrientation;
  locale: "zh" | "en";
}) {
  return (
    <figure className="tutorial-notation-card">
      <div className="tutorial-notation-visual">
        <TutorialStaticCube
          hintMove={diagram.face ? undefined : diagram.move}
          formulaFacelets={diagram.face ? highlightedFacelets(diagram.face) : undefined}
          transparentFormulaFacelets={Boolean(diagram.face)}
          faceColors={faceColors}
          orientation={orientation}
          sizes="(max-width: 560px) 50vw, (max-width: 760px) 45vw, 240px"
        />
      </div>
      <figcaption>
        <code>{diagram.symbol}</code>
        <span className="tutorial-notation-copy">
          <strong>{getGalleryCopy(diagram.title, locale)}</strong>
          {diagram.note ? <small>{getGalleryCopy(diagram.note, locale)}</small> : null}
        </span>
      </figcaption>
    </figure>
  );
}

function isGalleryId(group: string): group is GalleryId {
  return group in GALLERIES;
}

export function TutorialNotationGallery({ group }: { group: string }) {
  const { faceColors, orientation } = useCubeAppearance();
  const { locale } = useLanguage();
  if (!isGalleryId(group)) throw new Error(`Unknown notation gallery: ${group}`);
  const gallery = GALLERIES[group];

  return (
    <section className="tutorial-notation-gallery" aria-label={getGalleryCopy(gallery.label, locale)}>
      {gallery.items.map((diagram) => (
        <NotationCard
          diagram={diagram}
          faceColors={faceColors}
          orientation={orientation}
          locale={locale}
          key={diagram.symbol}
        />
      ))}
    </section>
  );
}
