import type { CubeFace } from "@/lib/smart-cube";
import { getArchiveScopedStorageKey } from "@/lib/solve-history";

export type CubeColor = "white" | "yellow" | "green" | "blue" | "red" | "orange";

export const COLOR_HEX: Record<CubeColor, string> = {
  white: "#F5F4EF",
  yellow: "#F2C744",
  green: "#1F6B3A",
  blue: "#1F4FB6",
  red: "#C9352A",
  orange: "#E7741A",
};

export type CubeColorPaletteId = "default-1" | "cubing-js" | "default-3";

export const COLOR_PALETTES: Record<CubeColorPaletteId, { label: string; colors: Record<CubeColor, string> }> = {
  "default-1": {
    label: "默认配色一",
    colors: COLOR_HEX,
  },
  "cubing-js": {
    label: "默认配色二",
    colors: {
      white: "#FFFFFF",
      yellow: "#F4F400",
      green: "#44EE00",
      blue: "#2266FF",
      red: "#FF0000",
      orange: "#FF8000",
    },
  },
  "default-3": {
    label: "默认配色三",
    colors: {
      white: "#F3F3F3",
      yellow: "#F5B400",
      green: "#009D54",
      blue: "#3D81F6",
      red: "#DC422F",
      orange: "#E87000",
    },
  },
};

export const COLOR_LABEL: Record<CubeColor, string> = {
  white: "白",
  yellow: "黄",
  green: "绿",
  blue: "蓝",
  red: "红",
  orange: "橙",
};

export const COLOR_LIST: CubeColor[] = ["white", "yellow", "red", "orange", "green", "blue"];

export const COLOR_OPPOSITE: Record<CubeColor, CubeColor> = {
  white: "yellow",
  yellow: "white",
  green: "blue",
  blue: "green",
  red: "orange",
  orange: "red",
};

type Vec3 = readonly [number, number, number];
type FaceletPosition = { face: CubeFace; x: number; y: number; z: number };

const FACE_ORDER: CubeFace[] = ["U", "R", "F", "D", "L", "B"];

// Canonical 3D direction for each color, anchored to WCA Western
// (white-up, green-front, red-right). Cross product of any (top, front)
// canonical vectors yields the right-side color, preserving chirality.
const CANON: Record<CubeColor, [number, number, number]> = {
  white: [0, 1, 0],
  yellow: [0, -1, 0],
  green: [0, 0, 1],
  blue: [0, 0, -1],
  red: [1, 0, 0],
  orange: [-1, 0, 0],
};

const VEC_TO_COLOR: Record<string, CubeColor> = {};
(Object.keys(CANON) as CubeColor[]).forEach((color) => {
  const [x, y, z] = CANON[color];
  VEC_TO_COLOR[`${x},${y},${z}`] = color;
});

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vectorToFace([x, y, z]: Vec3): CubeFace {
  if (y === 1) return "U";
  if (y === -1) return "D";
  if (x === 1) return "R";
  if (x === -1) return "L";
  if (z === 1) return "F";
  return "B";
}

function displayPositionToHardware(x: number, y: number, z: number, orientation: CubeOrientation): Vec3 {
  const top = CANON[orientation.top];
  const front = CANON[orientation.front];
  const right = cross(top, front);
  return [
    right[0] * x + top[0] * y + front[0] * z,
    right[1] * x + top[1] * y + front[1] * z,
    right[2] * x + top[2] * y + front[2] * z,
  ];
}

function hardwarePositionToDisplay(x: number, y: number, z: number, orientation: CubeOrientation): Vec3 {
  const top = CANON[orientation.top];
  const front = CANON[orientation.front];
  const right = cross(top, front);
  const position: Vec3 = [x, y, z];
  return [dot(position, right), dot(position, top), dot(position, front)];
}

function displayFaceToHardware(face: CubeFace, orientation: CubeOrientation) {
  if (face === "U") return vectorToFace(displayPositionToHardware(0, 1, 0, orientation));
  if (face === "D") return vectorToFace(displayPositionToHardware(0, -1, 0, orientation));
  if (face === "R") return vectorToFace(displayPositionToHardware(1, 0, 0, orientation));
  if (face === "L") return vectorToFace(displayPositionToHardware(-1, 0, 0, orientation));
  if (face === "F") return vectorToFace(displayPositionToHardware(0, 0, 1, orientation));
  return vectorToFace(displayPositionToHardware(0, 0, -1, orientation));
}

function faceletPosition(face: CubeFace, row: number, col: number): FaceletPosition {
  if (face === "U") return { face, x: col - 1, y: 1, z: row - 1 };
  if (face === "R") return { face, x: 1, y: 1 - row, z: 1 - col };
  if (face === "F") return { face, x: col - 1, y: 1 - row, z: 1 };
  if (face === "D") return { face, x: col - 1, y: -1, z: 1 - row };
  if (face === "L") return { face, x: -1, y: 1 - row, z: col - 1 };
  return { face, x: 1 - col, y: 1 - row, z: -1 };
}

function faceletIndex(face: CubeFace, x: number, y: number, z: number) {
  if (face === "U") return (z + 1) * 3 + (x + 1);
  if (face === "R") return 9 + (1 - y) * 3 + (1 - z);
  if (face === "F") return 18 + (1 - y) * 3 + (x + 1);
  if (face === "D") return 27 + (1 - z) * 3 + (x + 1);
  if (face === "L") return 36 + (1 - y) * 3 + (z + 1);
  return 45 + (1 - y) * 3 + (1 - x);
}

export function rightColor(top: CubeColor, front: CubeColor): CubeColor {
  const r = cross(CANON[top], CANON[front]);
  return VEC_TO_COLOR[`${r[0]},${r[1]},${r[2]}`];
}

export type CubeOrientation = { top: CubeColor; front: CubeColor };
export type CubeRenderMaxFps = 30 | 60 | 120 | null;

export const DEFAULT_ORIENTATION: CubeOrientation = { top: "yellow", front: "green" };
export const DEFAULT_RENDER_MAX_FPS: CubeRenderMaxFps = 120;
export const DEFAULT_BACK_FACE_PROJECTION_ENABLED = true;
export const DEFAULT_BACK_FACE_PROJECTION_DISTANCE = 1.8;
export const MIN_BACK_FACE_PROJECTION_DISTANCE = 1.00;
export const MAX_BACK_FACE_PROJECTION_DISTANCE = 3.50;
export const DEFAULT_COLOR_PALETTE_ID: CubeColorPaletteId = "default-1";

export function isValidOrientation(top: CubeColor, front: CubeColor): boolean {
  return top !== front && COLOR_OPPOSITE[top] !== front;
}

export function getFaceColors(orientation: CubeOrientation): Record<CubeFace, CubeColor> {
  const { top, front } = orientation;
  const safe = isValidOrientation(top, front) ? orientation : DEFAULT_ORIENTATION;
  const right = rightColor(safe.top, safe.front);
  return {
    U: safe.top,
    D: COLOR_OPPOSITE[safe.top],
    F: safe.front,
    B: COLOR_OPPOSITE[safe.front],
    R: right,
    L: COLOR_OPPOSITE[right],
  };
}

export function getFaceHexColors(
  orientation: CubeOrientation,
  paletteId: CubeColorPaletteId = DEFAULT_COLOR_PALETTE_ID,
): Record<CubeFace, string> {
  const colors = getFaceColors(orientation);
  const palette = COLOR_PALETTES[paletteId]?.colors ?? COLOR_PALETTES[DEFAULT_COLOR_PALETTE_ID].colors;
  return {
    U: palette[colors.U],
    D: palette[colors.D],
    F: palette[colors.F],
    B: palette[colors.B],
    R: palette[colors.R],
    L: palette[colors.L],
  };
}

// gan-web-bluetooth emits moves in Kociemba/GAN coordinates:
// U=white, R=red, F=green, D=yellow, L=orange, B=blue.
const HARDWARE_ORIENTATION: CubeOrientation = { top: "white", front: "green" };
const HARDWARE_FACE_COLORS = getFaceColors(HARDWARE_ORIENTATION);

export function mapFaceToOrientation(face: CubeFace, orientation: CubeOrientation): CubeFace {
  const rawColor = HARDWARE_FACE_COLORS[face];
  const orientedFaceColors = getFaceColors(orientation);
  const mapped = (Object.entries(orientedFaceColors) as Array<[CubeFace, CubeColor]>).find(
    ([, color]) => color === rawColor,
  );
  return mapped?.[0] ?? face;
}

export function mapMoveToOrientation(move: string, orientation: CubeOrientation): string {
  const face = move[0]?.toUpperCase() as CubeFace;
  if (!["U", "D", "L", "R", "F", "B"].includes(face)) return move;
  return `${mapFaceToOrientation(face, orientation)}${move.slice(1)}`;
}

export function displayFaceletsToHardwareFacelets(facelets: string, orientation: CubeOrientation) {
  const next = Array.from({ length: facelets.length }, () => "U");

  FACE_ORDER.forEach((displayFace, faceIndex) => {
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const sourceIndex = faceIndex * 9 + row * 3 + col;
        const sourceFace = facelets[sourceIndex] as CubeFace | undefined;
        if (!sourceFace || !FACE_ORDER.includes(sourceFace)) continue;
        const displayPosition = faceletPosition(displayFace, row, col);
        const [hardwareX, hardwareY, hardwareZ] = displayPositionToHardware(
          displayPosition.x,
          displayPosition.y,
          displayPosition.z,
          orientation,
        );
        const hardwareFace = displayFaceToHardware(displayPosition.face, orientation);
        const targetIndex = faceletIndex(hardwareFace, hardwareX, hardwareY, hardwareZ);
        next[targetIndex] = displayFaceToHardware(sourceFace, orientation);
      }
    }
  });

  return next.join("");
}

export function hardwareFaceletsToDisplayFacelets(facelets: string, orientation: CubeOrientation) {
  if (facelets.length !== 54) return facelets;
  const next = Array.from({ length: facelets.length }, () => "U");

  FACE_ORDER.forEach((hardwareFace, faceIndex) => {
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const sourceIndex = faceIndex * 9 + row * 3 + col;
        const sourceFace = facelets[sourceIndex] as CubeFace | undefined;
        if (!sourceFace || !FACE_ORDER.includes(sourceFace)) continue;
        const hardwarePosition = faceletPosition(hardwareFace, row, col);
        const [displayX, displayY, displayZ] = hardwarePositionToDisplay(
          hardwarePosition.x,
          hardwarePosition.y,
          hardwarePosition.z,
          orientation,
        );
        const displayFace = mapFaceToOrientation(hardwarePosition.face, orientation);
        const targetIndex = faceletIndex(displayFace, displayX, displayY, displayZ);
        next[targetIndex] = mapFaceToOrientation(sourceFace, orientation);
      }
    }
  });

  return next.join("");
}

export const CUBE_APPEARANCE_KEY = "cube-appearance";
export const CUBE_COLOR_PALETTE_KEY = "cube-color-palette";
export const CUBE_RENDER_FPS_KEY = "cube-render-fps-limit";
export const CUBE_BACK_FACE_PROJECTION_KEY = "cube-back-face-projection";
export const CUBE_BACK_FACE_PROJECTION_DISTANCE_KEY = "cube-back-face-projection-distance";

export function loadCubeOrientation(): CubeOrientation {
  if (typeof window === "undefined") return DEFAULT_ORIENTATION;
  try {
    const raw = window.localStorage.getItem(getArchiveScopedStorageKey(CUBE_APPEARANCE_KEY));
    if (!raw) return DEFAULT_ORIENTATION;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.top === "string" &&
      typeof parsed.front === "string" &&
      parsed.top in COLOR_HEX &&
      parsed.front in COLOR_HEX &&
      isValidOrientation(parsed.top, parsed.front)
    ) {
      return { top: parsed.top, front: parsed.front };
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_ORIENTATION;
}

export function saveCubeOrientation(orientation: CubeOrientation) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(CUBE_APPEARANCE_KEY), JSON.stringify(orientation));
  } catch {
    // local storage might be unavailable in private contexts
  }
}

export function normalizeCubeColorPaletteId(value: unknown): CubeColorPaletteId {
  if (value === "gan-i4") return "cubing-js";
  return typeof value === "string" && value in COLOR_PALETTES
    ? (value as CubeColorPaletteId)
    : DEFAULT_COLOR_PALETTE_ID;
}

export function loadCubeColorPaletteId(): CubeColorPaletteId {
  if (typeof window === "undefined") return DEFAULT_COLOR_PALETTE_ID;
  try {
    return normalizeCubeColorPaletteId(
      JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(CUBE_COLOR_PALETTE_KEY)) ?? "null"),
    );
  } catch {
    return DEFAULT_COLOR_PALETTE_ID;
  }
}

export function saveCubeColorPaletteId(paletteId: CubeColorPaletteId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getArchiveScopedStorageKey(CUBE_COLOR_PALETTE_KEY),
      JSON.stringify(normalizeCubeColorPaletteId(paletteId)),
    );
  } catch {
    // local storage might be unavailable in private contexts
  }
}

export function normalizeCubeRenderMaxFps(value: unknown): CubeRenderMaxFps {
  return value === null || value === 30 || value === 60 || value === 120 ? value : DEFAULT_RENDER_MAX_FPS;
}

export function loadCubeRenderMaxFps(): CubeRenderMaxFps {
  if (typeof window === "undefined") return DEFAULT_RENDER_MAX_FPS;
  try {
    return normalizeCubeRenderMaxFps(
      JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(CUBE_RENDER_FPS_KEY)) ?? "120"),
    );
  } catch {
    return DEFAULT_RENDER_MAX_FPS;
  }
}

export function saveCubeRenderMaxFps(maxFps: CubeRenderMaxFps) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getArchiveScopedStorageKey(CUBE_RENDER_FPS_KEY),
      JSON.stringify(normalizeCubeRenderMaxFps(maxFps)),
    );
  } catch {
    // local storage might be unavailable in private contexts
  }
}

export function loadBackFaceProjectionEnabled(): boolean {
  if (typeof window === "undefined") return DEFAULT_BACK_FACE_PROJECTION_ENABLED;
  try {
    const raw = window.localStorage.getItem(getArchiveScopedStorageKey(CUBE_BACK_FACE_PROJECTION_KEY));
    if (raw === null) return DEFAULT_BACK_FACE_PROJECTION_ENABLED;
    return JSON.parse(raw) === true;
  } catch {
    return DEFAULT_BACK_FACE_PROJECTION_ENABLED;
  }
}

export function saveBackFaceProjectionEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(CUBE_BACK_FACE_PROJECTION_KEY), JSON.stringify(enabled));
  } catch {
    // local storage might be unavailable in private contexts
  }
}

export function normalizeBackFaceProjectionDistance(value: unknown): number {
  if (value == null) return DEFAULT_BACK_FACE_PROJECTION_DISTANCE;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return DEFAULT_BACK_FACE_PROJECTION_DISTANCE;
  return Math.min(
    MAX_BACK_FACE_PROJECTION_DISTANCE,
    Math.max(MIN_BACK_FACE_PROJECTION_DISTANCE, numberValue),
  );
}

export function loadBackFaceProjectionDistance(): number {
  if (typeof window === "undefined") return DEFAULT_BACK_FACE_PROJECTION_DISTANCE;
  try {
    return normalizeBackFaceProjectionDistance(
      JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(CUBE_BACK_FACE_PROJECTION_DISTANCE_KEY)) ?? "null"),
    );
  } catch {
    return DEFAULT_BACK_FACE_PROJECTION_DISTANCE;
  }
}

export function saveBackFaceProjectionDistance(distance: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getArchiveScopedStorageKey(CUBE_BACK_FACE_PROJECTION_DISTANCE_KEY),
      JSON.stringify(normalizeBackFaceProjectionDistance(distance)),
    );
  } catch {
    // local storage might be unavailable in private contexts
  }
}
