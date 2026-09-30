import assert from "node:assert/strict";
import { test } from "node:test";
import { expandMoveNotation } from "./algorithms";
import { getInitialCubeVisualState } from "./cube-visual-state";

const facelets = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

test("restores the hardware snapshot with subsequent turns exactly once", () => {
  const result = getInitialCubeVisualState({
    baseFacelets: facelets,
    moves: [{ move: "R" }, { move: "U2" }, { move: "F'" }],
  }, "newer locally calculated facelets");
  assert.equal(result.facelets, facelets);
  assert.deepEqual(result.moves, ["R", "U2", "F'"].flatMap(expandMoveNotation));
});

test("falls back to latest facelets without replaying already included turns", () => {
  assert.deepEqual(getInitialCubeVisualState({ baseFacelets: null, moves: [{ move: "R" }] }, facelets), {
    facelets, moves: [],
  });
});

test("does not fabricate a state when no hardware snapshot is available", () => {
  assert.deepEqual(getInitialCubeVisualState({ baseFacelets: null, moves: [{ move: "R" }] }, null), {
    facelets: null, moves: [],
  });
});
