import {
  DEFAULT_CUBE_DISPLAY_STATE,
  type CubeCameraDistanceRange,
  type CubeCameraViewportInsets,
  type CubeDisplayState,
  type CubeSceneOffset,
} from "@/lib/smart-cube";

export type CubeCameraPreset = {
  displayState: CubeDisplayState;
  distanceRange?: CubeCameraDistanceRange;
  viewportInsets?: CubeCameraViewportInsets;
  sceneOffset?: CubeSceneOffset;
};

const PRACTICE_TRAINER_CAMERA_PRESET = {
  displayState: {
    ...DEFAULT_CUBE_DISPLAY_STATE,
    cameraDistance: 7.2,
  },
  distanceRange: {
    min: 5.4,
    max: 10.5,
  },
  sceneOffset: {
    y: 0.7,
  },
} as const satisfies CubeCameraPreset;

export const CUBE_CAMERA_PRESETS = {
  practice: PRACTICE_TRAINER_CAMERA_PRESET,
  trainer: PRACTICE_TRAINER_CAMERA_PRESET,
  formulas: {
    displayState: {
      ...DEFAULT_CUBE_DISPLAY_STATE,
      cameraDistance: 8,
    },
  },
} as const satisfies Record<"practice" | "trainer" | "formulas", CubeCameraPreset>;
