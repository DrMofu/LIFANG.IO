"use client";

import { useCubeAppearance } from "@/components/cube-appearance-provider";
import { useLanguage } from "@/components/language-provider";
import { COLOR_LABEL, COLOR_PALETTES, getFaceColors, type CubeColor } from "@/lib/cube-appearance";
import type { CubeFace } from "@/lib/smart-cube";

export function CubeColorText({ color }: { color: CubeColor }) {
  const { colorPaletteId } = useCubeAppearance();
  const { t } = useLanguage();

  return (
    <span style={{ color: COLOR_PALETTES[colorPaletteId].colors[color] }}>
      {t(COLOR_LABEL[color])}
    </span>
  );
}

export function CubeFaceLabel({ face }: { face: CubeFace }) {
  const { orientation, faceColors } = useCubeAppearance();
  const { t } = useLanguage();
  const color = getFaceColors(orientation)[face];

  return (
    <span className="cube-inline-face" role="img" aria-label={`${face} ${t(COLOR_LABEL[color])}`}>
      {face}
      <span className="cube-inline-face-swatch" style={{ background: faceColors[face] }} aria-hidden="true" />
    </span>
  );
}

export function CubeWhite() { return <CubeColorText color="white" />; }
export function CubeYellow() { return <CubeColorText color="yellow" />; }
export function CubeGreen() { return <CubeColorText color="green" />; }
export function CubeBlue() { return <CubeColorText color="blue" />; }
export function CubeRed() { return <CubeColorText color="red" />; }
export function CubeOrange() { return <CubeColorText color="orange" />; }

export function CubeU() { return <CubeFaceLabel face="U" />; }
export function CubeF() { return <CubeFaceLabel face="F" />; }
export function CubeR() { return <CubeFaceLabel face="R" />; }
export function CubeD() { return <CubeFaceLabel face="D" />; }
export function CubeB() { return <CubeFaceLabel face="B" />; }
export function CubeL() { return <CubeFaceLabel face="L" />; }
