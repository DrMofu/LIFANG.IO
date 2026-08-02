"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUBE_BACK_FACE_PROJECTION_DISTANCE_KEY = exports.CUBE_BACK_FACE_PROJECTION_KEY = exports.CUBE_RENDER_FPS_KEY = exports.CUBE_COLOR_PALETTE_KEY = exports.CUBE_APPEARANCE_KEY = exports.DEFAULT_COLOR_PALETTE_ID = exports.MAX_BACK_FACE_PROJECTION_DISTANCE = exports.MIN_BACK_FACE_PROJECTION_DISTANCE = exports.DEFAULT_BACK_FACE_PROJECTION_DISTANCE = exports.DEFAULT_BACK_FACE_PROJECTION_ENABLED = exports.DEFAULT_RENDER_MAX_FPS = exports.DEFAULT_ORIENTATION = exports.COLOR_OPPOSITE = exports.COLOR_LIST = exports.COLOR_LABEL = exports.COLOR_PALETTES = exports.COLOR_HEX = void 0;
exports.rightColor = rightColor;
exports.isValidOrientation = isValidOrientation;
exports.getFaceColors = getFaceColors;
exports.getFaceHexColors = getFaceHexColors;
exports.mapFaceToOrientation = mapFaceToOrientation;
exports.mapMoveToOrientation = mapMoveToOrientation;
exports.displayFaceletsToHardwareFacelets = displayFaceletsToHardwareFacelets;
exports.hardwareFaceletsToDisplayFacelets = hardwareFaceletsToDisplayFacelets;
exports.loadCubeOrientation = loadCubeOrientation;
exports.saveCubeOrientation = saveCubeOrientation;
exports.normalizeCubeColorPaletteId = normalizeCubeColorPaletteId;
exports.loadCubeColorPaletteId = loadCubeColorPaletteId;
exports.saveCubeColorPaletteId = saveCubeColorPaletteId;
exports.normalizeCubeRenderMaxFps = normalizeCubeRenderMaxFps;
exports.loadCubeRenderMaxFps = loadCubeRenderMaxFps;
exports.saveCubeRenderMaxFps = saveCubeRenderMaxFps;
exports.loadBackFaceProjectionEnabled = loadBackFaceProjectionEnabled;
exports.saveBackFaceProjectionEnabled = saveBackFaceProjectionEnabled;
exports.normalizeBackFaceProjectionDistance = normalizeBackFaceProjectionDistance;
exports.loadBackFaceProjectionDistance = loadBackFaceProjectionDistance;
exports.saveBackFaceProjectionDistance = saveBackFaceProjectionDistance;
const solve_history_1 = require("@/lib/solve-history");
exports.COLOR_HEX = {
    white: "#F5F4EF",
    yellow: "#F2C744",
    green: "#1F6B3A",
    blue: "#1F4FB6",
    red: "#C9352A",
    orange: "#E7741A",
};
exports.COLOR_PALETTES = {
    "default-1": {
        label: "默认配色一",
        colors: exports.COLOR_HEX,
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
exports.COLOR_LABEL = {
    white: "白",
    yellow: "黄",
    green: "绿",
    blue: "蓝",
    red: "红",
    orange: "橙",
};
exports.COLOR_LIST = ["white", "yellow", "red", "orange", "green", "blue"];
exports.COLOR_OPPOSITE = {
    white: "yellow",
    yellow: "white",
    green: "blue",
    blue: "green",
    red: "orange",
    orange: "red",
};
const FACE_ORDER = ["U", "R", "F", "D", "L", "B"];
// Canonical 3D direction for each color, anchored to WCA Western
// (white-up, green-front, red-right). Cross product of any (top, front)
// canonical vectors yields the right-side color, preserving chirality.
const CANON = {
    white: [0, 1, 0],
    yellow: [0, -1, 0],
    green: [0, 0, 1],
    blue: [0, 0, -1],
    red: [1, 0, 0],
    orange: [-1, 0, 0],
};
const VEC_TO_COLOR = {};
Object.keys(CANON).forEach((color) => {
    const [x, y, z] = CANON[color];
    VEC_TO_COLOR[`${x},${y},${z}`] = color;
});
function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function vectorToFace([x, y, z]) {
    if (y === 1)
        return "U";
    if (y === -1)
        return "D";
    if (x === 1)
        return "R";
    if (x === -1)
        return "L";
    if (z === 1)
        return "F";
    return "B";
}
function displayPositionToHardware(x, y, z, orientation) {
    const top = CANON[orientation.top];
    const front = CANON[orientation.front];
    const right = cross(top, front);
    return [
        right[0] * x + top[0] * y + front[0] * z,
        right[1] * x + top[1] * y + front[1] * z,
        right[2] * x + top[2] * y + front[2] * z,
    ];
}
function hardwarePositionToDisplay(x, y, z, orientation) {
    const top = CANON[orientation.top];
    const front = CANON[orientation.front];
    const right = cross(top, front);
    const position = [x, y, z];
    return [dot(position, right), dot(position, top), dot(position, front)];
}
function displayFaceToHardware(face, orientation) {
    if (face === "U")
        return vectorToFace(displayPositionToHardware(0, 1, 0, orientation));
    if (face === "D")
        return vectorToFace(displayPositionToHardware(0, -1, 0, orientation));
    if (face === "R")
        return vectorToFace(displayPositionToHardware(1, 0, 0, orientation));
    if (face === "L")
        return vectorToFace(displayPositionToHardware(-1, 0, 0, orientation));
    if (face === "F")
        return vectorToFace(displayPositionToHardware(0, 0, 1, orientation));
    return vectorToFace(displayPositionToHardware(0, 0, -1, orientation));
}
function faceletPosition(face, row, col) {
    if (face === "U")
        return { face, x: col - 1, y: 1, z: row - 1 };
    if (face === "R")
        return { face, x: 1, y: 1 - row, z: 1 - col };
    if (face === "F")
        return { face, x: col - 1, y: 1 - row, z: 1 };
    if (face === "D")
        return { face, x: col - 1, y: -1, z: 1 - row };
    if (face === "L")
        return { face, x: -1, y: 1 - row, z: col - 1 };
    return { face, x: 1 - col, y: 1 - row, z: -1 };
}
function faceletIndex(face, x, y, z) {
    if (face === "U")
        return (z + 1) * 3 + (x + 1);
    if (face === "R")
        return 9 + (1 - y) * 3 + (1 - z);
    if (face === "F")
        return 18 + (1 - y) * 3 + (x + 1);
    if (face === "D")
        return 27 + (1 - z) * 3 + (x + 1);
    if (face === "L")
        return 36 + (1 - y) * 3 + (z + 1);
    return 45 + (1 - y) * 3 + (1 - x);
}
function rightColor(top, front) {
    const r = cross(CANON[top], CANON[front]);
    return VEC_TO_COLOR[`${r[0]},${r[1]},${r[2]}`];
}
exports.DEFAULT_ORIENTATION = { top: "yellow", front: "green" };
exports.DEFAULT_RENDER_MAX_FPS = 120;
exports.DEFAULT_BACK_FACE_PROJECTION_ENABLED = true;
exports.DEFAULT_BACK_FACE_PROJECTION_DISTANCE = 1.8;
exports.MIN_BACK_FACE_PROJECTION_DISTANCE = 1.00;
exports.MAX_BACK_FACE_PROJECTION_DISTANCE = 3.50;
exports.DEFAULT_COLOR_PALETTE_ID = "default-1";
function isValidOrientation(top, front) {
    return top !== front && exports.COLOR_OPPOSITE[top] !== front;
}
function getFaceColors(orientation) {
    const { top, front } = orientation;
    const safe = isValidOrientation(top, front) ? orientation : exports.DEFAULT_ORIENTATION;
    const right = rightColor(safe.top, safe.front);
    return {
        U: safe.top,
        D: exports.COLOR_OPPOSITE[safe.top],
        F: safe.front,
        B: exports.COLOR_OPPOSITE[safe.front],
        R: right,
        L: exports.COLOR_OPPOSITE[right],
    };
}
function getFaceHexColors(orientation, paletteId = exports.DEFAULT_COLOR_PALETTE_ID) {
    const colors = getFaceColors(orientation);
    const palette = exports.COLOR_PALETTES[paletteId]?.colors ?? exports.COLOR_PALETTES[exports.DEFAULT_COLOR_PALETTE_ID].colors;
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
const HARDWARE_ORIENTATION = { top: "white", front: "green" };
const HARDWARE_FACE_COLORS = getFaceColors(HARDWARE_ORIENTATION);
function mapFaceToOrientation(face, orientation) {
    const rawColor = HARDWARE_FACE_COLORS[face];
    const orientedFaceColors = getFaceColors(orientation);
    const mapped = Object.entries(orientedFaceColors).find(([, color]) => color === rawColor);
    return mapped?.[0] ?? face;
}
function mapMoveToOrientation(move, orientation) {
    const face = move[0]?.toUpperCase();
    if (!["U", "D", "L", "R", "F", "B"].includes(face))
        return move;
    return `${mapFaceToOrientation(face, orientation)}${move.slice(1)}`;
}
function displayFaceletsToHardwareFacelets(facelets, orientation) {
    const next = Array.from({ length: facelets.length }, () => "U");
    FACE_ORDER.forEach((displayFace, faceIndex) => {
        for (let row = 0; row < 3; row += 1) {
            for (let col = 0; col < 3; col += 1) {
                const sourceIndex = faceIndex * 9 + row * 3 + col;
                const sourceFace = facelets[sourceIndex];
                if (!sourceFace || !FACE_ORDER.includes(sourceFace))
                    continue;
                const displayPosition = faceletPosition(displayFace, row, col);
                const [hardwareX, hardwareY, hardwareZ] = displayPositionToHardware(displayPosition.x, displayPosition.y, displayPosition.z, orientation);
                const hardwareFace = displayFaceToHardware(displayPosition.face, orientation);
                const targetIndex = faceletIndex(hardwareFace, hardwareX, hardwareY, hardwareZ);
                next[targetIndex] = displayFaceToHardware(sourceFace, orientation);
            }
        }
    });
    return next.join("");
}
function hardwareFaceletsToDisplayFacelets(facelets, orientation) {
    if (facelets.length !== 54)
        return facelets;
    const next = Array.from({ length: facelets.length }, () => "U");
    FACE_ORDER.forEach((hardwareFace, faceIndex) => {
        for (let row = 0; row < 3; row += 1) {
            for (let col = 0; col < 3; col += 1) {
                const sourceIndex = faceIndex * 9 + row * 3 + col;
                const sourceFace = facelets[sourceIndex];
                if (!sourceFace || !FACE_ORDER.includes(sourceFace))
                    continue;
                const hardwarePosition = faceletPosition(hardwareFace, row, col);
                const [displayX, displayY, displayZ] = hardwarePositionToDisplay(hardwarePosition.x, hardwarePosition.y, hardwarePosition.z, orientation);
                const displayFace = mapFaceToOrientation(hardwarePosition.face, orientation);
                const targetIndex = faceletIndex(displayFace, displayX, displayY, displayZ);
                next[targetIndex] = mapFaceToOrientation(sourceFace, orientation);
            }
        }
    });
    return next.join("");
}
exports.CUBE_APPEARANCE_KEY = "cube-appearance";
exports.CUBE_COLOR_PALETTE_KEY = "cube-color-palette";
exports.CUBE_RENDER_FPS_KEY = "cube-render-fps-limit";
exports.CUBE_BACK_FACE_PROJECTION_KEY = "cube-back-face-projection";
exports.CUBE_BACK_FACE_PROJECTION_DISTANCE_KEY = "cube-back-face-projection-distance";
function loadCubeOrientation() {
    if (typeof window === "undefined")
        return exports.DEFAULT_ORIENTATION;
    try {
        const raw = window.localStorage.getItem((0, solve_history_1.getArchiveScopedStorageKey)(exports.CUBE_APPEARANCE_KEY));
        if (!raw)
            return exports.DEFAULT_ORIENTATION;
        const parsed = JSON.parse(raw);
        if (parsed &&
            typeof parsed.top === "string" &&
            typeof parsed.front === "string" &&
            parsed.top in exports.COLOR_HEX &&
            parsed.front in exports.COLOR_HEX &&
            isValidOrientation(parsed.top, parsed.front)) {
            return { top: parsed.top, front: parsed.front };
        }
    }
    catch {
        // fall through to default
    }
    return exports.DEFAULT_ORIENTATION;
}
function saveCubeOrientation(orientation) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem((0, solve_history_1.getArchiveScopedStorageKey)(exports.CUBE_APPEARANCE_KEY), JSON.stringify(orientation));
    }
    catch {
        // local storage might be unavailable in private contexts
    }
}
function normalizeCubeColorPaletteId(value) {
    if (value === "gan-i4")
        return "cubing-js";
    return typeof value === "string" && value in exports.COLOR_PALETTES
        ? value
        : exports.DEFAULT_COLOR_PALETTE_ID;
}
function loadCubeColorPaletteId() {
    if (typeof window === "undefined")
        return exports.DEFAULT_COLOR_PALETTE_ID;
    try {
        return normalizeCubeColorPaletteId(JSON.parse(window.localStorage.getItem((0, solve_history_1.getArchiveScopedStorageKey)(exports.CUBE_COLOR_PALETTE_KEY)) ?? "null"));
    }
    catch {
        return exports.DEFAULT_COLOR_PALETTE_ID;
    }
}
function saveCubeColorPaletteId(paletteId) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem((0, solve_history_1.getArchiveScopedStorageKey)(exports.CUBE_COLOR_PALETTE_KEY), JSON.stringify(normalizeCubeColorPaletteId(paletteId)));
    }
    catch {
        // local storage might be unavailable in private contexts
    }
}
function normalizeCubeRenderMaxFps(value) {
    return value === null || value === 30 || value === 60 || value === 120 ? value : exports.DEFAULT_RENDER_MAX_FPS;
}
function loadCubeRenderMaxFps() {
    if (typeof window === "undefined")
        return exports.DEFAULT_RENDER_MAX_FPS;
    try {
        return normalizeCubeRenderMaxFps(JSON.parse(window.localStorage.getItem((0, solve_history_1.getArchiveScopedStorageKey)(exports.CUBE_RENDER_FPS_KEY)) ?? "120"));
    }
    catch {
        return exports.DEFAULT_RENDER_MAX_FPS;
    }
}
function saveCubeRenderMaxFps(maxFps) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem((0, solve_history_1.getArchiveScopedStorageKey)(exports.CUBE_RENDER_FPS_KEY), JSON.stringify(normalizeCubeRenderMaxFps(maxFps)));
    }
    catch {
        // local storage might be unavailable in private contexts
    }
}
function loadBackFaceProjectionEnabled() {
    if (typeof window === "undefined")
        return exports.DEFAULT_BACK_FACE_PROJECTION_ENABLED;
    try {
        const raw = window.localStorage.getItem((0, solve_history_1.getArchiveScopedStorageKey)(exports.CUBE_BACK_FACE_PROJECTION_KEY));
        if (raw === null)
            return exports.DEFAULT_BACK_FACE_PROJECTION_ENABLED;
        return JSON.parse(raw) === true;
    }
    catch {
        return exports.DEFAULT_BACK_FACE_PROJECTION_ENABLED;
    }
}
function saveBackFaceProjectionEnabled(enabled) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem((0, solve_history_1.getArchiveScopedStorageKey)(exports.CUBE_BACK_FACE_PROJECTION_KEY), JSON.stringify(enabled));
    }
    catch {
        // local storage might be unavailable in private contexts
    }
}
function normalizeBackFaceProjectionDistance(value) {
    if (value == null)
        return exports.DEFAULT_BACK_FACE_PROJECTION_DISTANCE;
    const numberValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numberValue))
        return exports.DEFAULT_BACK_FACE_PROJECTION_DISTANCE;
    return Math.min(exports.MAX_BACK_FACE_PROJECTION_DISTANCE, Math.max(exports.MIN_BACK_FACE_PROJECTION_DISTANCE, numberValue));
}
function loadBackFaceProjectionDistance() {
    if (typeof window === "undefined")
        return exports.DEFAULT_BACK_FACE_PROJECTION_DISTANCE;
    try {
        return normalizeBackFaceProjectionDistance(JSON.parse(window.localStorage.getItem((0, solve_history_1.getArchiveScopedStorageKey)(exports.CUBE_BACK_FACE_PROJECTION_DISTANCE_KEY)) ?? "null"));
    }
    catch {
        return exports.DEFAULT_BACK_FACE_PROJECTION_DISTANCE;
    }
}
function saveBackFaceProjectionDistance(distance) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem((0, solve_history_1.getArchiveScopedStorageKey)(exports.CUBE_BACK_FACE_PROJECTION_DISTANCE_KEY), JSON.stringify(normalizeBackFaceProjectionDistance(distance)));
    }
    catch {
        // local storage might be unavailable in private contexts
    }
}
