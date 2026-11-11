"use client";

import { useCubeAppearance } from "@/components/cube/cube-appearance-provider";
import { TutorialStaticCube } from "@/components/tutorials/tutorial-static-cube";
import type { CubeOrientation } from "@/lib/cube/cube-appearance";
import type { CubeFace } from "@/lib/cube/smart-cube";
import { toTutorialHeadingId } from "@/lib/tutorials/tutorial-headings";

export type TutorialCubeStageItem = {
  title: string;
  content: string;
  facelets: string;
  cameraLatitude?: number;
};

export type TutorialCubeStageProps = {
  title: string;
  items: TutorialCubeStageItem[];
};

function StageCube({
  item,
  faceColors,
  orientation,
}: {
  item: Pick<TutorialCubeStageItem, "facelets" | "cameraLatitude">;
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

export function TutorialCubeStage({ title, items }: TutorialCubeStageProps) {
  const { faceColors, orientation } = useCubeAppearance();

  if (items.length === 1) {
    const item = items[0];
    return (
      <figure className="tutorial-stage-figure">
        <div className="tutorial-stage-cube">
          <StageCube item={item} faceColors={faceColors} orientation={orientation} />
        </div>
        <figcaption>
          <strong>{item.title}</strong>
          <span>{item.content}</span>
        </figcaption>
      </figure>
    );
  }

  return (
    <section className={`tutorial-stage-gallery is-${items.length}-up`} aria-label={title}>
      {items.map((item) => (
        <figure className="tutorial-stage-card" key={item.title}>
          <div className="tutorial-stage-card-visual">
            <StageCube item={item} faceColors={faceColors} orientation={orientation} />
          </div>
          <figcaption>
            <strong>{item.title}</strong>
            <span>{item.content}</span>
          </figcaption>
        </figure>
      ))}
    </section>
  );
}

const SOLVE_FLOW = [
  { label: "底层小花", heading: "第一步：底层小花", facelets: "XDXDUDXDXXXXXXXXXXXXXXXXXXXXXXXDXXXXXXXXLXXXXXXXXBXXXX" },
  { label: "底层十字", heading: "第二步：底层十字", facelets: "XXXXUXXXXXXXXRXXRXXXXXFXXFXXDXDDDXDXXXXXLXXLXXXXXBXXBX", cameraLatitude: -28 },
  { label: "复原底层", heading: "第三步：复原底层", facelets: "XXXXUXXXXXXXXRXRRRXXXXFXFFFDDDDDDDDDXXXXLXLLLXXXXBXBBB", cameraLatitude: -28 },
  { label: "中间层", heading: "第四步：复原中间层", facelets: "XXXXUXXXXXXXRRRRRRXXXFFFFFFDDDDDDDDDXXXLLLLLLXXXBBBBBB" },
  { label: "顶层十字", heading: "第五步：顶层十字", facelets: "XUXUUUXUXXXXRRRRRRXXXFFFFFFDDDDDDDDDXXXLLLLLLXXXBBBBBB" },
  { label: "顶层棱块归位", heading: "第六步：顶层棱块归位", facelets: "XUXUUUXUXXRXRRRRRRXFXFFFFFFDDDDDDDDDXLXLLLLLLXBXBBBBBB" },
  { label: "顶层角块归位", heading: "第七步：顶层角块归位", facelets: "LURUUUFUFURBRRRRRRLFRFFFFFFDDDDDDDDDBLULLLLLLUBUBBBBBB" },
  { label: "翻正顶层角块", heading: "第八步：翻正顶层角块", facelets: "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB" },
];

export function TutorialSolveFlow() {
  const { faceColors, orientation } = useCubeAppearance();

  return (
    <>
      <ol className="tutorial-solve-flow" aria-label="层先法复原流程">
        {SOLVE_FLOW.map(({ label, heading, ...visual }, index) => (
          <li key={heading}>
            <a href={`#${toTutorialHeadingId(heading)}`}>
              <span className="tutorial-solve-flow-number" aria-hidden="true">{index + 1}</span>
              <div className="tutorial-solve-flow-cube">
                <StageCube item={visual} faceColors={faceColors} orientation={orientation} />
              </div>
              <span className="tutorial-solve-flow-label">{label}</span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}
