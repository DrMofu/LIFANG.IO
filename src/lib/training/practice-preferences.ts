"use client";
import { CUBE_CAMERA_PRESETS } from "@/lib/cube/cube-camera-presets";
import { type CubeDisplayState } from "@/lib/cube/smart-cube";
import { getArchiveScopedStorageKey,type SolveSource } from "@/lib/records/solve-history";

const DISPLAY_STATE_EPSILON = 0.001;

const PRACTICE_FORMULA_RECOGNITION_ENABLED_KEY = "cube-practice-formula-recognition-enabled";

const PRACTICE_DISPLAY_STATE_KEY = "cube-practice-display-state";

export const PRACTICE_UI_PREFERENCES_KEY = "cube-practice-ui-preferences-v1";

export const PRACTICE_CUBE_CAMERA_PRESET = CUBE_CAMERA_PRESETS.practice;

const LEGACY_PRACTICE_CAMERA_DISTANCES = [6.4, 8] as const;

export function loadPracticeFormulaRecognitionEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return JSON.parse(
      window.localStorage.getItem(getArchiveScopedStorageKey(PRACTICE_FORMULA_RECOGNITION_ENABLED_KEY)) || "false",
    ) === true;
  } catch {
    return false;
  }
}

export function savePracticeFormulaRecognitionEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getArchiveScopedStorageKey(PRACTICE_FORMULA_RECOGNITION_ENABLED_KEY),
      JSON.stringify(enabled),
    );
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

export function isDefaultDisplayState(state: CubeDisplayState) {
  const defaultState = PRACTICE_CUBE_CAMERA_PRESET.displayState;
  return (
    Math.abs(state.cameraDistance - defaultState.cameraDistance) <= DISPLAY_STATE_EPSILON &&
    Math.abs(state.cameraLatitude - defaultState.cameraLatitude) <= DISPLAY_STATE_EPSILON &&
    Math.abs(state.cameraLongitude - defaultState.cameraLongitude) <= DISPLAY_STATE_EPSILON
  );
}

function isStoredDisplayState(value: unknown): value is CubeDisplayState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Record<keyof CubeDisplayState, unknown>>;
  return (
    typeof candidate.cameraDistance === "number" &&
    Number.isFinite(candidate.cameraDistance) &&
    typeof candidate.cameraLatitude === "number" &&
    Number.isFinite(candidate.cameraLatitude) &&
    typeof candidate.cameraLongitude === "number" &&
    Number.isFinite(candidate.cameraLongitude)
  );
}

export function loadPracticeDisplayState() {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(PRACTICE_DISPLAY_STATE_KEY)) || "null");
    if (!isStoredDisplayState(parsed)) return null;
    if (LEGACY_PRACTICE_CAMERA_DISTANCES.some(
      (distance) => Math.abs(parsed.cameraDistance - distance) <= DISPLAY_STATE_EPSILON,
    )) {
      return {
        ...parsed,
        cameraDistance: PRACTICE_CUBE_CAMERA_PRESET.displayState.cameraDistance,
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePracticeDisplayState(state: CubeDisplayState | null) {
  if (typeof window === "undefined") return;
  try {
    const key = getArchiveScopedStorageKey(PRACTICE_DISPLAY_STATE_KEY);
    if (!state || isDefaultDisplayState(state)) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

export type PracticeMode = "scramble" | "free";

export type TimingMode = SolveSource;

type PracticeUiPreferences = {
  version: 1;
  practiceMode: PracticeMode;
  timingMode: TimingMode;
};

export function loadPracticeUiPreferences(): PracticeUiPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(getArchiveScopedStorageKey(PRACTICE_UI_PREFERENCES_KEY)) || "null",
    ) as Partial<PracticeUiPreferences> | null;
    if (
      parsed?.version !== 1 ||
      (parsed.practiceMode !== "scramble" && parsed.practiceMode !== "free") ||
      (parsed.timingMode !== "timer" && parsed.timingMode !== "smart-cube")
    ) {
      return null;
    }
    return parsed as PracticeUiPreferences;
  } catch {
    return null;
  }
}

export function savePracticeUiPreferences(practiceMode: PracticeMode, timingMode: TimingMode) {
  if (typeof window === "undefined") return;
  try {
    const preferences: PracticeUiPreferences = { version: 1, practiceMode, timingMode };
    window.localStorage.setItem(
      getArchiveScopedStorageKey(PRACTICE_UI_PREFERENCES_KEY),
      JSON.stringify(preferences),
    );
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}
