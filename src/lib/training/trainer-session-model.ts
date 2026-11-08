"use client";
import type { CfopTrainerPhase } from "@/lib/training/cfop-trainer";
import { CFOP_TRAINER_PHASES } from "@/lib/training/cfop-trainer";

export type TrainerState = "idle" | "loading" | "observe" | "solving" | "cancelled" | "ended" | "done" | "error";

export type FormulaHintStepStatus = "pending" | "partial" | "correct";

export const TRAINER_SPECIALTIES: Array<{
  key: TrainerSpecialty;
  name: string;
}> = [
    ...CFOP_TRAINER_PHASES.map((phase) => ({
      key: phase.key,
      name: `${phase.label}专项`,
    })),
    { key: "turn-recognition", name: "转动专项" },
  ];

export type TrainerRoundResult = {
  observeMs: number;
  solveMs: number;
  moves: number;
  dnf: boolean;
};

export type TrainerSpecialty = CfopTrainerPhase | "turn-recognition";
