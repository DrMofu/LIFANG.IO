import { expandMoveNotation } from "./algorithms";

/** Restore the hardware snapshot and only the moves received after that snapshot. */
export function getInitialCubeVisualState(
  visualState: { baseFacelets: string | null; moves: ReadonlyArray<{ move: string }> },
  latestFacelets: string | null,
) {
  const facelets = visualState.baseFacelets ?? latestFacelets;
  if (!facelets) return { facelets: null, moves: [] };
  const moves = visualState.baseFacelets ? visualState.moves : [];
  return { facelets, moves: moves.flatMap(({ move }) => expandMoveNotation(move)) };
}
