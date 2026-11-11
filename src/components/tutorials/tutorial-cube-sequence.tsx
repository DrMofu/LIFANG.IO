"use client";

import { Fragment } from "react";
import { useCubeAppearance } from "@/components/cube/cube-appearance-provider";
import { TutorialStaticCube } from "@/components/tutorials/tutorial-static-cube";
import { MoveToken } from "@/components/ui/move-token";

export type TutorialCubeSequenceProps = {
  cubes: {
    facelets: string;
    cameraLatitude?: number;
    cameraLongitude?: number;
  }[];
  transitions: string[];
  content?: string;
};

export function TutorialCubeSequence({ cubes, transitions, content }: TutorialCubeSequenceProps) {
  const { faceColors, orientation } = useCubeAppearance();

  return (
    <figure className="tutorial-cube-sequence">
      <div className="tutorial-cube-sequence-scroll" tabIndex={0} aria-label="魔方转动过程">
        <div className="tutorial-cube-sequence-track">
          {cubes.map(({ facelets, cameraLatitude = 25, cameraLongitude = 35 }, index) => (
            <Fragment key={index}>
              {index > 0 ? (
                <div className="tutorial-cube-sequence-transition">
                  <MoveToken move={transitions[index - 1]} />
                  <svg viewBox="0 0 48 24" aria-hidden="true">
                    <path d="M2 12h40M32 3l10 9-10 9" />
                  </svg>
                </div>
              ) : null}
              <div className="tutorial-cube-sequence-cube" role="img" aria-label={`魔方状态 ${index + 1}`}>
                <TutorialStaticCube
                  formulaFacelets={facelets}
                  faceColors={faceColors}
                  orientation={orientation}
                  cameraDistance={6.4}
                  cameraLatitude={cameraLatitude}
                  cameraLongitude={cameraLongitude}
                  sizes="(width <= 700px) 24vw, 160px"
                />
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      {content ? <figcaption>{content}</figcaption> : null}
    </figure>
  );
}
