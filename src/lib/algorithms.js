"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMoveNotation = parseMoveNotation;
exports.parseAlgorithm = parseAlgorithm;
exports.invertMoveNotation = invertMoveNotation;
exports.isRotationMoveNotation = isRotationMoveNotation;
exports.expandMoveNotation = expandMoveNotation;
exports.compressMoveSequence = compressMoveSequence;
exports.normalizeMoveLogSequence = normalizeMoveLogSequence;
exports.appendNormalizedMoveLogMove = appendNormalizedMoveLogMove;
exports.appendFixedViewMoveLogMove = appendFixedViewMoveLogMove;
exports.createMoveCoordinateState = createMoveCoordinateState;
exports.normalizeMoveCoordinate = normalizeMoveCoordinate;
exports.moveCanStillMatchExpected = moveCanStillMatchExpected;
exports.movesMatchExpected = movesMatchExpected;
exports.movePartiallyMatchesExpectedDoubleTurn = movePartiallyMatchesExpectedDoubleTurn;
exports.hintMoveForDoubleTurnProgress = hintMoveForDoubleTurnProgress;
exports.shouldAnimateExpectedWideMoveAfterMatch = shouldAnimateExpectedWideMoveAfterMatch;
exports.shouldAnimateExpectedSliceMoveAfterMatch = shouldAnimateExpectedSliceMoveAfterMatch;
exports.shouldDeferExpectedWideMoveAnimation = shouldDeferExpectedWideMoveAnimation;
exports.shouldDeferExpectedSliceMoveAnimation = shouldDeferExpectedSliceMoveAnimation;
exports.updateMoveCoordinateStateAfterMatch = updateMoveCoordinateStateAfterMatch;
exports.updateMoveCoordinateStateAfterMove = updateMoveCoordinateStateAfterMove;
exports.updateMoveCoordinateStateAfterRotationMove = updateMoveCoordinateStateAfterRotationMove;
const FACE_SET = new Set(["U", "D", "L", "R", "F", "B"]);
const SLICE_SET = new Set(["M", "E", "S"]);
const LAYER_SET = new Set(["U", "D", "L", "R", "F", "B", "M", "E", "S"]);
const WIDE_LAYER_SET = new Set(["u", "d", "l", "r", "f", "b"]);
const ROTATION_LAYER_SET = new Set(["x", "y", "z"]);
const WIDE_MOVE_EXPANSION = {
    r: [{ layer: "R", dirMultiplier: 1 }, { layer: "M", dirMultiplier: -1 }],
    l: [{ layer: "L", dirMultiplier: 1 }, { layer: "M", dirMultiplier: 1 }],
    u: [{ layer: "U", dirMultiplier: 1 }, { layer: "E", dirMultiplier: -1 }],
    d: [{ layer: "D", dirMultiplier: 1 }, { layer: "E", dirMultiplier: 1 }],
    f: [{ layer: "F", dirMultiplier: 1 }, { layer: "S", dirMultiplier: 1 }],
    b: [{ layer: "B", dirMultiplier: 1 }, { layer: "S", dirMultiplier: -1 }],
};
const ROTATION_MOVE_EXPANSION = {
    x: [{ layer: "R", dirMultiplier: 1 }, { layer: "M", dirMultiplier: -1 }, { layer: "L", dirMultiplier: -1 }],
    y: [{ layer: "U", dirMultiplier: 1 }, { layer: "E", dirMultiplier: -1 }, { layer: "D", dirMultiplier: -1 }],
    z: [{ layer: "F", dirMultiplier: 1 }, { layer: "S", dirMultiplier: 1 }, { layer: "B", dirMultiplier: -1 }],
};
const OPPOSITE_FACE = {
    R: "L",
    L: "R",
    U: "D",
    D: "U",
    F: "B",
    B: "F",
};
const FACE_AXIS = {
    R: { axis: "x", sign: 1 },
    L: { axis: "x", sign: -1 },
    U: { axis: "y", sign: 1 },
    D: { axis: "y", sign: -1 },
    F: { axis: "z", sign: 1 },
    B: { axis: "z", sign: -1 },
};
const SLICE_BY_AXIS = {
    x: "M",
    y: "E",
    z: "S",
};
const SLICE_AXIS = {
    M: "x",
    E: "y",
    S: "z",
};
const IDENTITY_COORDINATE_STATE = {
    U: "U",
    D: "D",
    L: "L",
    R: "R",
    F: "F",
    B: "B",
};
function parseMoveNotation(notation) {
    if (typeof notation !== "string")
        return null;
    const trimmed = notation.trim();
    if (!trimmed)
        return null;
    const head = trimmed[0];
    const upperHead = head?.toUpperCase();
    const layer = WIDE_LAYER_SET.has(head) || ROTATION_LAYER_SET.has(head)
        ? head
        : upperHead;
    if (!WIDE_LAYER_SET.has(layer) &&
        !ROTATION_LAYER_SET.has(layer) &&
        !LAYER_SET.has(layer))
        return null;
    const suffix = trimmed.slice(1);
    const turns = suffix.includes("2") ? 2 : 1;
    const dir = suffix.includes("'") ? -1 : 1;
    return {
        notation: formatParsedMove(layer, turns, dir),
        layer,
        dir,
        turns,
    };
}
function parseAlgorithm(source) {
    if (typeof source !== "string")
        return [];
    return source
        .trim()
        .split(/\s+/)
        .flatMap((token) => {
        const parsed = parseMoveNotation(token.replace(/[()]/g, ""));
        return parsed ? [parsed.notation] : [];
    });
}
function invertMoveNotation(move) {
    const parsed = parseMoveNotation(move);
    if (!parsed)
        return move;
    if (parsed.turns === 2)
        return parsed.notation;
    return formatMove(parsed.layer, parsed.dir === 1 ? 3 : 1);
}
function isRotationMoveNotation(move) {
    const parsed = parseMoveNotation(move);
    return parsed ? ROTATION_LAYER_SET.has(parsed.layer) : false;
}
function expandMoveNotation(move) {
    const parsed = parseMoveNotation(move);
    if (!parsed)
        return [];
    const expanded = WIDE_MOVE_EXPANSION[parsed.layer];
    const rotated = ROTATION_MOVE_EXPANSION[parsed.layer];
    const moveGroup = expanded ?? rotated;
    if (!moveGroup) {
        return Array.from({ length: parsed.turns }, () => ({ layer: parsed.layer, dir: parsed.dir }));
    }
    return Array.from({ length: parsed.turns }).flatMap(() => moveGroup.map(({ layer, dirMultiplier }) => ({
        layer,
        dir: (parsed.dir * dirMultiplier),
    })));
}
function compressMoveSequence(moves) {
    return moves.reduce((history, move) => appendCompressedMove(history, move), []);
}
function normalizeMoveLogSequence(moves) {
    let coordinateState = createMoveCoordinateState();
    return moves.reduce((history, move) => {
        const next = appendNormalizedMoveLogMove(history, move, coordinateState);
        coordinateState = next.coordinateState;
        return next.history;
    }, []);
}
function appendNormalizedMoveLogMove(history, move, coordinateState) {
    const parsed = parseMoveNotation(move);
    if (!parsed)
        return { history, coordinateState };
    const normalizedMove = normalizeMoveCoordinate(parsed.notation, coordinateState);
    const next = appendCompressedMoveWithCoordinateEvent(history, normalizedMove);
    const rotation = next.coordinateMove ? coordinateRotationForSliceMove(next.coordinateMove) : null;
    return {
        history: next.history,
        coordinateState: rotation ? rotateCoordinateState(coordinateState, rotation) : coordinateState,
    };
}
function appendFixedViewMoveLogMove(history, move) {
    const parsed = parseMoveNotation(move);
    if (!parsed)
        return history;
    return appendCompressedMoveWithCoordinateEvent(history, parsed.notation).history;
}
function createMoveCoordinateState() {
    return { ...IDENTITY_COORDINATE_STATE };
}
function normalizeMoveCoordinate(move, state) {
    const parsed = parseMoveNotation(move);
    if (!parsed || !FACE_SET.has(parsed.layer))
        return parsed?.notation ?? move;
    return formatParsedMove(state[parsed.layer], parsed.turns, parsed.dir);
}
function moveCanStillMatchExpected(pendingMoves, expectedMove) {
    const expected = moveToAtom(expectedMove);
    if (!expected)
        return false;
    const compressed = compressMoveSequence(pendingMoves);
    if (compressed.length === 0)
        return true;
    if (compressed.length > 1)
        return partialSliceTurnCanStillMatch(compressed, expected);
    const actual = moveToAtom(compressed[0]);
    if (!actual)
        return false;
    if (actual.layer === expected.layer) {
        return actual.amount === expected.amount || (expected.amount === 2 && (actual.amount === 1 || actual.amount === 3));
    }
    if (faceMoveCanEmulateWide(actual, expected)) {
        return actual.amount === expected.amount || (expected.amount === 2 && (actual.amount === 1 || actual.amount === 3));
    }
    return faceMoveCanBecomeSlice(actual, expected);
}
function movesMatchExpected(pendingMoves, expectedMove) {
    const expected = moveToAtom(expectedMove);
    if (!expected)
        return false;
    const compressed = compressMoveSequence(pendingMoves);
    if (compressed.length !== 1)
        return false;
    const actual = moveToAtom(compressed[0]);
    if (!actual)
        return false;
    return ((actual.layer === expected.layer && actual.amount === expected.amount) ||
        (faceMoveCanEmulateWide(actual, expected) && actual.amount === expected.amount));
}
function movePartiallyMatchesExpectedDoubleTurn(pendingMoves, expectedMove) {
    const expected = moveToAtom(expectedMove);
    if (!expected || expected.amount !== 2)
        return false;
    const compressed = compressMoveSequence(pendingMoves);
    if (compressed.length !== 1)
        return false;
    const actual = moveToAtom(compressed[0]);
    if (!actual || (actual.amount !== 1 && actual.amount !== 3))
        return false;
    return actual.layer === expected.layer || faceMoveCanEmulateWide(actual, expected);
}
function hintMoveForDoubleTurnProgress(pendingMoves, expectedMove) {
    const expected = moveToAtom(expectedMove);
    if (!expected || expected.amount !== 2)
        return expectedMove;
    const compressed = compressMoveSequence(pendingMoves);
    if (compressed.length !== 1)
        return expectedMove;
    const actual = moveToAtom(compressed[0]);
    if (!actual || (actual.amount !== 1 && actual.amount !== 3))
        return expectedMove;
    if (actual.layer !== expected.layer && !faceMoveCanEmulateWide(actual, expected))
        return expectedMove;
    return formatMove(actual.layer, actual.amount);
}
function shouldAnimateExpectedWideMoveAfterMatch(pendingMoves, expectedMove) {
    const expected = moveToAtom(expectedMove);
    if (!expected || !WIDE_LAYER_SET.has(expected.layer))
        return false;
    if (!movesMatchExpected(pendingMoves, expectedMove))
        return false;
    const compressed = compressMoveSequence(pendingMoves);
    if (compressed.length !== 1)
        return false;
    const actual = moveToAtom(compressed[0]);
    return Boolean(actual && actual.layer !== expected.layer && faceMoveCanEmulateWide(actual, expected));
}
function shouldAnimateExpectedSliceMoveAfterMatch(pendingMoves, expectedMove) {
    return Boolean(sliceEmulationRotationAfterMatch(pendingMoves, expectedMove));
}
function shouldDeferExpectedWideMoveAnimation(pendingMoves, expectedMove) {
    const expected = moveToAtom(expectedMove);
    if (!expected || !WIDE_LAYER_SET.has(expected.layer))
        return false;
    if (!moveCanStillMatchExpected(pendingMoves, expectedMove))
        return false;
    const compressed = compressMoveSequence(pendingMoves);
    if (compressed.length !== 1)
        return false;
    const actual = moveToAtom(compressed[0]);
    return Boolean(actual && actual.layer !== expected.layer && faceMoveCanEmulateWide(actual, expected));
}
function shouldDeferExpectedSliceMoveAnimation(pendingMoves, expectedMove) {
    const expected = moveToAtom(expectedMove);
    if (!expected || !SLICE_SET.has(expected.layer))
        return false;
    if (!moveCanStillMatchExpected(pendingMoves, expectedMove))
        return false;
    return pendingMoves.some((move) => {
        const actual = moveToAtom(move);
        return Boolean(actual && FACE_SET.has(actual.layer));
    });
}
function updateMoveCoordinateStateAfterMatch(state, pendingMoves, expectedMove) {
    const rotation = sliceEmulationRotationAfterMatch(pendingMoves, expectedMove) ??
        wideEmulationRotationAfterMatch(pendingMoves, expectedMove);
    if (!rotation)
        return state;
    return rotateCoordinateState(state, rotation);
}
function updateMoveCoordinateStateAfterMove(state, move) {
    const rotation = coordinateRotationForSliceMove(move);
    if (!rotation)
        return state;
    return rotateCoordinateState(state, rotation);
}
function updateMoveCoordinateStateAfterRotationMove(state, move) {
    const rotation = coordinateRotationForRotationMove(move);
    if (!rotation)
        return state;
    return rotateCoordinateState(state, rotation);
}
function appendCompressedMove(history, move) {
    const nextAtom = moveToAtom(move);
    if (!nextAtom)
        return history;
    const next = [...history];
    const lastAtom = moveToAtom(next[next.length - 1]);
    if (lastAtom && lastAtom.layer === nextAtom.layer) {
        next.pop();
        const combined = addAmounts(lastAtom.amount, nextAtom.amount);
        if (combined !== 0) {
            const combinedMove = formatMove(nextAtom.layer, combined);
            const combinedAtom = moveToAtom(combinedMove);
            const previousAtom = moveToAtom(next[next.length - 1]);
            const slice = previousAtom && combinedAtom ? combineOppositeFaces(previousAtom, combinedAtom) : null;
            if (slice) {
                next.pop();
                return appendCompressedMove(next, slice);
            }
            next.push(combinedMove);
        }
        return next;
    }
    const slice = lastAtom ? combineOppositeFaces(lastAtom, nextAtom) : null;
    if (slice) {
        next.pop();
        return appendCompressedMove(next, slice);
    }
    next.push(formatMove(nextAtom.layer, nextAtom.amount));
    return next;
}
function appendCompressedMoveWithCoordinateEvent(history, move) {
    const nextAtom = moveToAtom(move);
    if (!nextAtom)
        return { history };
    const coordinateMove = SLICE_SET.has(nextAtom.layer)
        ? formatMove(nextAtom.layer, nextAtom.amount)
        : null;
    const next = [...history];
    const lastAtom = moveToAtom(next[next.length - 1]);
    if (lastAtom && lastAtom.layer === nextAtom.layer) {
        next.pop();
        const combined = addAmounts(lastAtom.amount, nextAtom.amount);
        if (combined !== 0) {
            const combinedMove = formatMove(nextAtom.layer, combined);
            const combinedAtom = moveToAtom(combinedMove);
            const previousAtom = moveToAtom(next[next.length - 1]);
            const slice = previousAtom && combinedAtom ? combineOppositeFaces(previousAtom, combinedAtom) : null;
            if (slice) {
                next.pop();
                return { history: appendCompressedMove(next, slice), coordinateMove: slice };
            }
            next.push(combinedMove);
        }
        return { history: next, coordinateMove };
    }
    const slice = lastAtom ? combineOppositeFaces(lastAtom, nextAtom) : null;
    if (slice) {
        next.pop();
        return { history: appendCompressedMove(next, slice), coordinateMove: slice };
    }
    next.push(formatMove(nextAtom.layer, nextAtom.amount));
    return { history: next, coordinateMove };
}
function moveToAtom(move) {
    const parsed = parseMoveNotation(move);
    if (!parsed)
        return null;
    return {
        layer: parsed.layer,
        amount: parsed.turns === 2 ? 2 : parsed.dir === -1 ? 3 : 1,
    };
}
function formatMove(layer, amount) {
    if (amount === 2)
        return `${layer}2`;
    if (amount === 3)
        return `${layer}'`;
    return layer;
}
function formatParsedMove(layer, turns, dir) {
    if (turns === 2)
        return dir === -1 ? `${layer}'2` : `${layer}2`;
    return formatMove(layer, dir === -1 ? 3 : 1);
}
function addAmounts(a, b) {
    return ((a + b) % 4);
}
function combineOppositeFaces(a, b) {
    if (!FACE_SET.has(a.layer) || !FACE_SET.has(b.layer))
        return null;
    const aFace = a.layer;
    const bFace = b.layer;
    if (OPPOSITE_FACE[aFace] !== bFace)
        return null;
    const aAxis = FACE_AXIS[aFace];
    const bAxis = FACE_AXIS[bFace];
    const aPhysical = physicalAmount(a.amount, aAxis.sign);
    const bPhysical = physicalAmount(b.amount, bAxis.sign);
    if (aAxis.axis !== bAxis.axis || aPhysical !== bPhysical)
        return null;
    const sliceAmount = aPhysical === 3 ? 1 : aPhysical === 1 ? 3 : 2;
    return formatMove(SLICE_BY_AXIS[aAxis.axis], sliceAmount);
}
function faceMoveCanBecomeSlice(actual, expected) {
    if (!SLICE_SET.has(expected.layer))
        return false;
    if (!FACE_SET.has(actual.layer))
        return false;
    const face = actual.layer;
    const axis = FACE_AXIS[face].axis;
    return SLICE_BY_AXIS[axis] === expected.layer;
}
function faceMoveCanEmulateWide(actual, expected) {
    if (!FACE_SET.has(actual.layer) || !WIDE_LAYER_SET.has(expected.layer))
        return false;
    const wideFace = wideLayerToFace(expected.layer);
    return OPPOSITE_FACE[wideFace] === actual.layer;
}
function partialSliceTurnCanStillMatch(compressedMoves, expected) {
    if (expected.amount !== 2 || compressedMoves.length !== 2)
        return false;
    const first = moveToAtom(compressedMoves[0]);
    const second = moveToAtom(compressedMoves[1]);
    if (!first || !second)
        return false;
    return (first.layer === expected.layer &&
        (first.amount === 1 || first.amount === 3) &&
        faceMoveCanBecomeSlice(second, expected));
}
function sliceEmulationRotationAfterMatch(pendingMoves, expectedMove) {
    const expected = moveToAtom(expectedMove);
    if (!expected || !SLICE_SET.has(expected.layer))
        return null;
    if (!movesMatchExpected(pendingMoves, expectedMove))
        return null;
    const hasFaceEmulation = pendingMoves.some((move) => {
        const atom = moveToAtom(move);
        return atom ? FACE_SET.has(atom.layer) : false;
    });
    if (!hasFaceEmulation)
        return null;
    return {
        axis: SLICE_AXIS[expected.layer],
        amount: expected.amount,
    };
}
function wideEmulationRotationAfterMatch(pendingMoves, expectedMove) {
    const expected = moveToAtom(expectedMove);
    if (!expected || !WIDE_LAYER_SET.has(expected.layer))
        return null;
    if (!movesMatchExpected(pendingMoves, expectedMove))
        return null;
    const wideFace = wideLayerToFace(expected.layer);
    const { axis, sign } = FACE_AXIS[wideFace];
    return {
        axis,
        amount: sign === 1 ? invertAmount(expected.amount) : expected.amount,
    };
}
function coordinateRotationForSliceMove(move) {
    const atom = moveToAtom(move);
    if (!atom || !SLICE_SET.has(atom.layer))
        return null;
    return {
        axis: SLICE_AXIS[atom.layer],
        amount: atom.amount,
    };
}
function coordinateRotationForRotationMove(move) {
    const atom = moveToAtom(move);
    if (!atom || !ROTATION_LAYER_SET.has(atom.layer))
        return null;
    return {
        axis: atom.layer,
        amount: invertAmount(atom.amount),
    };
}
function invertAmount(amount) {
    if (amount === 1)
        return 3;
    if (amount === 3)
        return 1;
    return 2;
}
function wideLayerToFace(layer) {
    return layer.toUpperCase();
}
function rotateCoordinateState(state, rotation) {
    return Object.keys(state).reduce((next, face) => {
        next[face] = rotateFace(state[face], rotation);
        return next;
    }, createMoveCoordinateState());
}
function rotateFace(face, rotation) {
    const axis = FACE_AXIS[face].axis;
    if (axis === rotation.axis)
        return face;
    const vector = faceToVector(face);
    const rotated = Array.from({ length: rotation.amount }).reduce((current) => rotateVectorOnce(current, rotation.axis), vector);
    return vectorToFace(rotated);
}
function faceToVector(face) {
    const { axis, sign } = FACE_AXIS[face];
    if (axis === "x")
        return [sign, 0, 0];
    if (axis === "y")
        return [0, sign, 0];
    return [0, 0, sign];
}
function vectorToFace([x, y, z]) {
    if (x === 1)
        return "R";
    if (x === -1)
        return "L";
    if (y === 1)
        return "U";
    if (y === -1)
        return "D";
    if (z === 1)
        return "F";
    return "B";
}
function rotateVectorOnce([x, y, z], axis) {
    if (axis === "x")
        return [x, -z, y];
    if (axis === "y")
        return [z, y, -x];
    return [-y, x, z];
}
function physicalAmount(amount, sign) {
    const signed = amount === 3 ? -1 : amount;
    const physical = -sign * signed;
    return (((physical % 4) + 4) % 4);
}
