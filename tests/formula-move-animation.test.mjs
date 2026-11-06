import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

// Use the project's TypeScript compiler without adding a test runtime dependency.
const filename = fileURLToPath(new URL("../src/lib/algorithms.ts", import.meta.url));
const compiled = new Module(filename);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText, filename);
const {
  advanceFormulaRotationSteps,
  createMoveCoordinateState,
  flushFormulaMoveAnimation,
  formulaToHardwareMoves,
  invertMoveNotation,
  normalizeMoveCoordinate,
  parseAlgorithm,
  planFormulaMoveAnimation,
  updateMoveCoordinateStateAfterMatch,
} = compiled.exports;

const fresh = () => ({ animatedCount: 0, animatedPartialMove: null });
const puzzle = import("cubing/puzzles").then(({ cube3x3x3 }) => cube3x3x3.kpuzzle());

async function pattern(moves) {
  const kpuzzle = await puzzle;
  return kpuzzle.defaultPattern().applyAlg(moves.map((move) =>
    move.replace(/^([URFDLBMESurfdlbxyz])(?:'2|2')$/, "$12"),
  ).join(" ")).patternData;
}

const emulatedMoves = {
  M: ["R", "L'"], E: ["U", "D'"], S: ["F'", "B"],
  r: ["L"], l: ["R"], u: ["D"], d: ["U"], f: ["B"], b: ["F"],
};

for (const [layer, quarter] of Object.entries(emulatedMoves)) {
  for (const suffix of ["", "'", "2", "'2"]) {
    const expected = layer + suffix;
    const events = suffix.includes("2") ? [...quarter, ...quarter]
      : suffix === "'" ? quarter.toReversed().map(invertMoveNotation) : quarter;

    test(`${expected}: device face events animate the formula move exactly once`, async () => {
      let state = fresh();
      const animations = [];
      for (let index = 0; index < events.length; index++) {
        const next = planFormulaMoveAnimation(events.slice(0, index + 1), expected, state);
        animations.push(...next.moves);
        state = next;
        assert.equal(next.match, index === events.length - 1 ? "matched" : "partial");
      }
      assert.deepEqual(await pattern(animations), await pattern([expected]));
      assert.equal(state.animatedCount, 0);
      assert.equal(state.animatedPartialMove, null);
    });
  }
}

test("ordinary double turns animate each received quarter only once", async () => {
  const first = planFormulaMoveAnimation(["R"], "R2", fresh());
  const second = planFormulaMoveAnimation(["R", "R"], "R2", first);
  assert.deepEqual(first.moves, ["R"]);
  assert.deepEqual(second.moves, ["R"]);
  assert.deepEqual(await pattern([...first.moves, ...second.moves]), await pattern(["R2"]));
});

test("a partial emulated double turn shows its first quarter immediately", () => {
  const firstFace = planFormulaMoveAnimation(["R"], "M2", fresh());
  const firstQuarter = planFormulaMoveAnimation(["R", "L'"], "M2", firstFace);
  assert.deepEqual(firstFace.moves, []);
  assert.deepEqual(firstQuarter.moves, ["M"]);
  assert.equal(firstQuarter.animatedPartialMove, "M");
  assert.deepEqual(planFormulaMoveAnimation(["R", "L'", "R"], "M2", firstQuarter).moves, []);
});

test("wrong moves during an emulated half turn can return to the confirmed frame", async () => {
  const pending = ["R", "L'"];
  const half = planFormulaMoveAnimation(pending, "M2", fresh());
  const wrong = [...pending, "U"];
  assert.equal(planFormulaMoveAnimation(wrong, "M2", half).match, "wrong");
  const displayed = [...half.moves, ...flushFormulaMoveAnimation(wrong, half)];
  assert.deepEqual(await pattern(displayed), await pattern(wrong));

  // Undo the wrong U, retain the valid first half, then finish the second half.
  const retained = { animatedCount: pending.length, animatedPartialMove: null };
  const next = planFormulaMoveAnimation([...pending, ...pending], "M2", retained);
  assert.deepEqual(await pattern([...displayed, "U'", ...next.moves]), await pattern(["M2"]));
});

test("finishing by another solution flushes an unfinished hint without losing the real move", async () => {
  const deferred = planFormulaMoveAnimation(["R"], "M2", fresh());
  const flushed = flushFormulaMoveAnimation(["R"], deferred);
  assert.deepEqual(await pattern([...deferred.moves, ...flushed]), await pattern(["R"]));
});

test("virtual rotations advance without device events and rotate the next hardware move", () => {
  const initial = createMoveCoordinateState();
  const advanced = advanceFormulaRotationSteps(["y", "x'", "R", "U"], 0, initial);
  assert.equal(advanced.nextIndex, 2);
  assert.deepEqual(advanced.rotations, ["y", "x'"]);
  assert.notDeepEqual(advanced.coordinate, initial);
  assert.notEqual(normalizeMoveCoordinate("R", advanced.coordinate), "R");
  assert.deepEqual(createMoveCoordinateState(), initial);
});

test("slice and wide matches remap subsequent hardware faces", () => {
  for (const [expected, events] of Object.entries(emulatedMoves)) {
    const initial = createMoveCoordinateState();
    const next = updateMoveCoordinateStateAfterMatch(initial, events, expected);
    assert.notDeepEqual(next, initial, expected);
    assert.equal(new Set(["U", "R", "F", "D", "L", "B"].map((move) =>
      normalizeMoveCoordinate(move, next),
    )).size, 6);
  }
});

test("S uses the opposite physical rotation direction from M and E", () => {
  assert.deepEqual(formulaToHardwareMoves("S"), ["F'", "B"]);
  assert.equal(normalizeMoveCoordinate("R", updateMoveCoordinateStateAfterMatch(
    createMoveCoordinateState(), ["F'", "B"], "S",
  )), "D");
});

test("all formula scenarios preserve the physical target after removing display rotations", async () => {
  const kpuzzle = await puzzle;
  const orientations = [];
  const seen = new Set();
  const queue = [""];
  while (queue.length > 0) {
    const alg = queue.shift();
    const signature = kpuzzle.defaultPattern().applyAlg(alg).patternData.CENTERS.pieces.join();
    if (seen.has(signature)) continue;
    seen.add(signature);
    orientations.push(alg);
    for (const move of ["x", "y", "z"]) queue.push(`${alg} ${move}`);
  }
  assert.equal(orientations.length, 24);

  const normalize = (moves) => moves.map((move) =>
    move.replace(/^([URFDLBMESurfdlbxyz])(?:'2|2')$/, "$12"),
  ).join(" ");
  let count = 0;
  for (const category of ["f2l", "oll", "pll"]) {
    const data = JSON.parse(fs.readFileSync(new URL(`../src/data/formulas/${category}.json`, import.meta.url), "utf8"));
    function verify(value) {
      if (!value || typeof value !== "object") return;
      if (typeof value.algo === "string") {
        const ideal = kpuzzle.defaultPattern().applyAlg(normalize(parseAlgorithm(value.algo)));
        const canonical = orientations.map((rotation) => ideal.applyAlg(rotation).patternData)
          .find((data) => data.CENTERS.pieces.every((piece, index) => piece === index));
        assert.ok(canonical, value.algo);
        const hardware = kpuzzle.defaultPattern().applyAlg(normalize(formulaToHardwareMoves(value.algo))).patternData;
        assert.deepEqual(hardware.CORNERS, canonical.CORNERS, value.algo);
        assert.deepEqual(hardware.EDGES, canonical.EDGES, value.algo);
        count++;
      }
      Object.values(value).forEach(verify);
    }
    verify(data);
  }
  assert.ok(count > 0);
});
