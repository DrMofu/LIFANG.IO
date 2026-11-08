"use client";
import { FORMULAS } from "@/lib/formulas/formulas-data";
import { getArchiveScopedStorageKey } from "@/lib/records/solve-history";
import { type CfopTrainerPhase } from "@/lib/training/cfop-trainer";
import type { TrainerSpecialty } from "@/lib/training/trainer-session-model";
import { TRAINER_SPECIALTIES } from "@/lib/training/trainer-session-model";

const DEFAULT_TRAINER_SESSION_ROUNDS = 20;

export const MIN_TRAINER_SESSION_ROUNDS = 1;

export const MAX_TRAINER_SESSION_ROUNDS = 100;

const F2L_FOCUS_MODE_KEY = "cfop-trainer-f2l-focus-mode";

const TRAINER_SELECTED_PHASE_KEY = "cfop-trainer-selected-phase";

const TRAINER_SESSION_ROUNDS_KEY = "cfop-trainer-session-rounds-v2";

const LEGACY_TRAINER_SESSION_ROUNDS_KEY = "cfop-trainer-session-rounds";

export const TRAINER_ROTATION_VARIANTS_KEY = "cfop-trainer-rotation-variants";

export function trainerLibraryKey(phase: CfopTrainerPhase) {
  return `cfop-trainer-${phase}-library-v1`;
}

export function readStoredFormulaCases(phase: CfopTrainerPhase): string[] {
  const allCaseIds = FORMULAS[phase].items.map((item) => item.id);
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(trainerLibraryKey(phase))) || "null");
    if (Array.isArray(stored)) {
      const valid = allCaseIds.filter((id) => stored.includes(id));
      if (valid.length) return valid;
    }
  } catch {
    // Use the full library when storage is unavailable or invalid.
  }
  return allCaseIds;
}

export const TRAINER_FORMULA_HINT_KEY = "cfop-trainer-formula-hint";

export const TRAINER_ROTATION_ARROW_KEY = "cfop-trainer-rotation-arrow";

export const TRAINER_F2L_EDGE_ONLY_KEY = "cfop-trainer-f2l-edge-only";

export const TRAINER_RECOGNITION_SLICES_KEY = "cfop-trainer-recognition-slices";

export const TRAINER_RECOGNITION_WIDE_KEY = "cfop-trainer-recognition-wide";

export const TRAINER_RECOGNITION_HINT_KEY = "cfop-trainer-recognition-hint";

export function readF2lFocusModeEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(F2L_FOCUS_MODE_KEY)) || "false") === true;
  } catch {
    return false;
  }
}

export function saveF2lFocusModeEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(F2L_FOCUS_MODE_KEY), JSON.stringify(enabled));
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

export function readStoredTrainerPhase() {
  if (typeof window === "undefined") return "f2l" as TrainerSpecialty;
  try {
    const stored = window.localStorage.getItem(getArchiveScopedStorageKey(TRAINER_SELECTED_PHASE_KEY));
    return TRAINER_SPECIALTIES.some((phase) => phase.key === stored)
      ? stored as TrainerSpecialty
      : "f2l";
  } catch {
    return "f2l";
  }
}

export function saveStoredTrainerPhase(phase: TrainerSpecialty) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(TRAINER_SELECTED_PHASE_KEY), phase);
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

export function isFormulaTrainerPhase(phase: TrainerSpecialty): phase is CfopTrainerPhase {
  return phase === "f2l" || phase === "oll" || phase === "pll";
}

export function readStoredTrainerBoolean(key: string) {
  if (typeof window === "undefined") return false;
  try {
    return JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(key)) || "false") === true;
  } catch {
    return false;
  }
}

export function saveStoredTrainerBoolean(key: string, enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(key), JSON.stringify(enabled));
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}

export function normalizeTrainerSessionRounds(value: number) {
  return Math.min(MAX_TRAINER_SESSION_ROUNDS, Math.max(MIN_TRAINER_SESSION_ROUNDS, Math.round(value)));
}

export function readStoredTrainerSessionRounds() {
  if (typeof window === "undefined") return DEFAULT_TRAINER_SESSION_ROUNDS;
  try {
    const current = window.localStorage.getItem(getArchiveScopedStorageKey(TRAINER_SESSION_ROUNDS_KEY));
    const stored = Number.parseInt(
      current ?? window.localStorage.getItem(getArchiveScopedStorageKey(LEGACY_TRAINER_SESSION_ROUNDS_KEY)) ?? "",
      10,
    );
    // Migrate the previous default while allowing newly saved custom values of 10.
    if (current === null && stored === 10) return DEFAULT_TRAINER_SESSION_ROUNDS;
    return Number.isFinite(stored) ? normalizeTrainerSessionRounds(stored) : DEFAULT_TRAINER_SESSION_ROUNDS;
  } catch {
    return DEFAULT_TRAINER_SESSION_ROUNDS;
  }
}

export function saveStoredTrainerSessionRounds(rounds: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getArchiveScopedStorageKey(TRAINER_SESSION_ROUNDS_KEY),
      String(normalizeTrainerSessionRounds(rounds)),
    );
  } catch {
    // localStorage can be unavailable in restricted browsing modes.
  }
}
