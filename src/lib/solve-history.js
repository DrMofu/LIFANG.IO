"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_STATISTICS_ARCHIVE_ID = exports.STATISTICS_ARCHIVE_CHANGE_EVENT = exports.ACTIVE_STATISTICS_ARCHIVE_KEY = exports.STATISTICS_ARCHIVES_KEY = exports.PRACTICE_PENDING_SESSION_KEY = exports.DAILY_PRACTICE_SECONDS_KEY = exports.DAILY_LEVELS_KEY = exports.CUBE_HISTORY_KEY = exports.MISSING_HISTORY_VALUE = void 0;
exports.getLocalDateKey = getLocalDateKey;
exports.getDailyTestDateKey = getDailyTestDateKey;
exports.getArchiveScopedStorageKey = getArchiveScopedStorageKey;
exports.loadStatisticsArchives = loadStatisticsArchives;
exports.getActiveStatisticsArchiveId = getActiveStatisticsArchiveId;
exports.getActiveStatisticsArchive = getActiveStatisticsArchive;
exports.setActiveStatisticsArchive = setActiveStatisticsArchive;
exports.createStatisticsArchive = createStatisticsArchive;
exports.renameStatisticsArchive = renameStatisticsArchive;
exports.deleteStatisticsArchive = deleteStatisticsArchive;
exports.subscribeStatisticsArchiveChange = subscribeStatisticsArchiveChange;
exports.loadSolveHistory = loadSolveHistory;
exports.normalizeSolveHistoryEntry = normalizeSolveHistoryEntry;
exports.trimSolveHistory = trimSolveHistory;
exports.prependSolveHistoryEntry = prependSolveHistoryEntry;
exports.saveSolveHistory = saveSolveHistory;
exports.loadDailyLevels = loadDailyLevels;
exports.getDailyLevelExcludedSolveIndexes = getDailyLevelExcludedSolveIndexes;
exports.calculateDailyLevelAverage = calculateDailyLevelAverage;
exports.normalizeDailyLevelEntry = normalizeDailyLevelEntry;
exports.saveDailyLevels = saveDailyLevels;
exports.loadDailyPracticeSeconds = loadDailyPracticeSeconds;
exports.loadPendingPracticeSession = loadPendingPracticeSession;
exports.savePendingPracticeSession = savePendingPracticeSession;
exports.clearPendingPracticeSession = clearPendingPracticeSession;
exports.saveDailyPracticeSeconds = saveDailyPracticeSeconds;
exports.loadDailyPracticeSecondsWithPendingSession = loadDailyPracticeSecondsWithPendingSession;
exports.addDailyPracticeDuration = addDailyPracticeDuration;
exports.MISSING_HISTORY_VALUE = "—";
exports.CUBE_HISTORY_KEY = "cube-history";
exports.DAILY_LEVELS_KEY = "cube-daily-levels";
exports.DAILY_PRACTICE_SECONDS_KEY = "cube-daily-practice-seconds";
exports.PRACTICE_PENDING_SESSION_KEY = "cube-practice-pending-session";
exports.STATISTICS_ARCHIVES_KEY = "cube-stat-archives";
exports.ACTIVE_STATISTICS_ARCHIVE_KEY = "cube-active-stat-archive";
exports.STATISTICS_ARCHIVE_CHANGE_EVENT = "cube-stat-archive-change";
const ARCHIVE_SCOPED_STORAGE_KEYS = [
    exports.CUBE_HISTORY_KEY,
    exports.DAILY_LEVELS_KEY,
    exports.DAILY_PRACTICE_SECONDS_KEY,
    "cube-appearance",
    "cube-color-palette",
    "cube-render-fps-limit",
    "cube-back-face-projection",
    "cube-back-face-projection-distance",
    "average-time-settings",
    "cube-practice-inspection-settings",
    "cube-console-logging-settings",
    "cube-practice-gyro-disabled",
    "cube-practice-display-state",
    "cube-user-data-package-updated-at",
    "cube-visual-state",
    "formula-favs",
    "formula-state",
    "formula-practice-stats",
    "formula-learning-status",
    "formula-focus-mode",
    "cfop-stage-training-history",
];
exports.DEFAULT_STATISTICS_ARCHIVE_ID = "default";
const DEFAULT_STATISTICS_ARCHIVE = {
    id: exports.DEFAULT_STATISTICS_ARCHIVE_ID,
    name: "默认存档",
    createdAt: 0,
};
const EMPTY_CFOP_PHASE_METRICS = {
    cross: exports.MISSING_HISTORY_VALUE,
    f2l: exports.MISSING_HISTORY_VALUE,
    oll: exports.MISSING_HISTORY_VALUE,
    pll: exports.MISSING_HISTORY_VALUE,
};
const EMPTY_F2L_SUBPHASE_METRICS = {
    one: exports.MISSING_HISTORY_VALUE,
    two: exports.MISSING_HISTORY_VALUE,
    three: exports.MISSING_HISTORY_VALUE,
    four: exports.MISSING_HISTORY_VALUE,
};
let solveHistoryCache = null;
let dailyLevelsCache = null;
let dailyPracticeCache = null;
function readCachedArray(storageKey, cache, normalize) {
    const raw = window.localStorage.getItem(storageKey) || "[]";
    if (cache?.storageKey === storageKey && cache.raw === raw) {
        return { cache, value: cache.value };
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        const nextCache = { storageKey, raw, value: [] };
        return { cache: nextCache, value: nextCache.value };
    }
    const normalized = parsed
        .map(normalize)
        .filter((entry) => entry !== null);
    const normalizedRaw = JSON.stringify(normalized);
    if (raw !== normalizedRaw) {
        try {
            window.localStorage.setItem(storageKey, normalizedRaw);
        }
        catch {
            // Keep the normalized in-memory data even if localStorage cannot be updated.
        }
    }
    const nextCache = { storageKey, raw: raw === normalizedRaw ? raw : normalizedRaw, value: normalized };
    return { cache: nextCache, value: normalized };
}
function getLocalDateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function getDailyTestDateKey(date = new Date()) {
    return getLocalDateKey(date);
}
function getArchiveScopedStorageKey(baseKey, archiveId = getActiveStatisticsArchiveId()) {
    return archiveId === exports.DEFAULT_STATISTICS_ARCHIVE_ID ? baseKey : `${baseKey}:${archiveId}`;
}
function isStatisticsArchive(value) {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value;
    return (typeof candidate.id === "string" &&
        candidate.id.length > 0 &&
        typeof candidate.name === "string" &&
        candidate.name.length > 0 &&
        typeof candidate.createdAt === "number");
}
function normalizeStatisticsArchives(value) {
    const byId = new Map();
    byId.set(exports.DEFAULT_STATISTICS_ARCHIVE_ID, DEFAULT_STATISTICS_ARCHIVE);
    if (Array.isArray(value)) {
        value.forEach((archive) => {
            if (!isStatisticsArchive(archive))
                return;
            byId.set(archive.id, {
                id: archive.id,
                name: archive.name.trim() || DEFAULT_STATISTICS_ARCHIVE.name,
                createdAt: archive.id === exports.DEFAULT_STATISTICS_ARCHIVE_ID ? DEFAULT_STATISTICS_ARCHIVE.createdAt : archive.createdAt,
            });
        });
    }
    return Array.from(byId.values()).sort((left, right) => {
        if (left.id === exports.DEFAULT_STATISTICS_ARCHIVE_ID)
            return -1;
        if (right.id === exports.DEFAULT_STATISTICS_ARCHIVE_ID)
            return 1;
        return left.createdAt - right.createdAt;
    });
}
function saveStatisticsArchives(archives) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(exports.STATISTICS_ARCHIVES_KEY, JSON.stringify(normalizeStatisticsArchives(archives)));
    }
    catch {
        // Local storage can be unavailable in private contexts.
    }
}
function emitStatisticsArchiveChange() {
    if (typeof window === "undefined")
        return;
    window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent(exports.STATISTICS_ARCHIVE_CHANGE_EVENT));
    }, 0);
}
function loadStatisticsArchives() {
    if (typeof window === "undefined")
        return [DEFAULT_STATISTICS_ARCHIVE];
    try {
        const raw = window.localStorage.getItem(exports.STATISTICS_ARCHIVES_KEY);
        const archives = normalizeStatisticsArchives(JSON.parse(raw || "null"));
        const normalized = JSON.stringify(archives);
        if (raw !== normalized) {
            try {
                window.localStorage.setItem(exports.STATISTICS_ARCHIVES_KEY, normalized);
            }
            catch {
                // Keep the normalized in-memory archive list even if localStorage cannot be updated.
            }
        }
        return archives;
    }
    catch {
        return [DEFAULT_STATISTICS_ARCHIVE];
    }
}
function getActiveStatisticsArchiveId() {
    if (typeof window === "undefined")
        return exports.DEFAULT_STATISTICS_ARCHIVE_ID;
    const archives = loadStatisticsArchives();
    const archiveIds = new Set(archives.map((archive) => archive.id));
    try {
        const activeId = window.localStorage.getItem(exports.ACTIVE_STATISTICS_ARCHIVE_KEY) || exports.DEFAULT_STATISTICS_ARCHIVE_ID;
        if (archiveIds.has(activeId))
            return activeId;
    }
    catch {
        // Fall through to the default archive.
    }
    return exports.DEFAULT_STATISTICS_ARCHIVE_ID;
}
function getActiveStatisticsArchive() {
    const activeId = getActiveStatisticsArchiveId();
    return loadStatisticsArchives().find((archive) => archive.id === activeId) ?? DEFAULT_STATISTICS_ARCHIVE;
}
function setActiveStatisticsArchive(id) {
    if (typeof window === "undefined")
        return getActiveStatisticsArchive();
    const archives = loadStatisticsArchives();
    const nextActive = archives.find((archive) => archive.id === id) ?? DEFAULT_STATISTICS_ARCHIVE;
    try {
        window.localStorage.setItem(exports.ACTIVE_STATISTICS_ARCHIVE_KEY, nextActive.id);
    }
    catch {
        // Local storage can be unavailable in private contexts.
    }
    emitStatisticsArchiveChange();
    return nextActive;
}
function createStatisticsArchive() {
    const archives = loadStatisticsArchives();
    const existingIds = new Set(archives.map((archive) => archive.id));
    const createdAt = Date.now();
    let index = archives.length + 1;
    let id = `archive-${createdAt}`;
    while (existingIds.has(id)) {
        index += 1;
        id = `archive-${createdAt}-${index}`;
    }
    const archive = {
        id,
        name: `存档 ${archives.length + 1}`,
        createdAt,
    };
    const nextArchives = [...archives, archive];
    saveStatisticsArchives(nextArchives);
    setActiveStatisticsArchive(archive.id);
    return archive;
}
function renameStatisticsArchive(id, name) {
    const nextName = name.trim();
    if (typeof window === "undefined" || nextName.length === 0)
        return getActiveStatisticsArchive();
    const archives = loadStatisticsArchives();
    const archive = archives.find((candidate) => candidate.id === id);
    if (!archive)
        return getActiveStatisticsArchive();
    const nextArchive = { ...archive, name: nextName };
    saveStatisticsArchives(archives.map((candidate) => (candidate.id === id ? nextArchive : candidate)));
    emitStatisticsArchiveChange();
    return getActiveStatisticsArchiveId() === id ? nextArchive : getActiveStatisticsArchive();
}
function deleteStatisticsArchive(id) {
    if (typeof window === "undefined" || id === exports.DEFAULT_STATISTICS_ARCHIVE_ID)
        return getActiveStatisticsArchive();
    const archives = loadStatisticsArchives();
    const archive = archives.find((candidate) => candidate.id === id);
    if (!archive)
        return getActiveStatisticsArchive();
    const nextArchives = archives.filter((candidate) => candidate.id !== id);
    saveStatisticsArchives(nextArchives);
    try {
        ARCHIVE_SCOPED_STORAGE_KEYS.forEach((key) => {
            window.localStorage.removeItem(getArchiveScopedStorageKey(key, id));
        });
        window.localStorage.setItem(exports.ACTIVE_STATISTICS_ARCHIVE_KEY, exports.DEFAULT_STATISTICS_ARCHIVE_ID);
    }
    catch {
        // Local storage can be unavailable in private contexts.
    }
    emitStatisticsArchiveChange();
    return DEFAULT_STATISTICS_ARCHIVE;
}
function subscribeStatisticsArchiveChange(handler) {
    if (typeof window === "undefined")
        return () => { };
    const handleStorageChange = (event) => {
        if (event.key === exports.STATISTICS_ARCHIVES_KEY ||
            event.key === exports.ACTIVE_STATISTICS_ARCHIVE_KEY ||
            ARCHIVE_SCOPED_STORAGE_KEYS.some((key) => event.key === getArchiveScopedStorageKey(key))) {
            handler();
        }
    };
    window.addEventListener(exports.STATISTICS_ARCHIVE_CHANGE_EVENT, handler);
    window.addEventListener("storage", handleStorageChange);
    return () => {
        window.removeEventListener(exports.STATISTICS_ARCHIVE_CHANGE_EVENT, handler);
        window.removeEventListener("storage", handleStorageChange);
    };
}
function loadSolveHistory() {
    if (typeof window === "undefined")
        return [];
    const storageKey = getArchiveScopedStorageKey(exports.CUBE_HISTORY_KEY);
    try {
        const result = readCachedArray(storageKey, solveHistoryCache, (entry) => {
            if (!entry || typeof entry !== "object")
                return null;
            const candidate = entry;
            return typeof candidate.ms === "number" && typeof candidate.ts === "number"
                ? normalizeSolveHistoryEntry(candidate)
                : null;
        });
        solveHistoryCache = result.cache;
        return result.value;
    }
    catch {
        return [];
    }
}
function normalizeHistoryMetric(value) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
        return value;
    return exports.MISSING_HISTORY_VALUE;
}
function normalizeCfopPhaseMetrics(value) {
    if (!value || typeof value !== "object")
        return { ...EMPTY_CFOP_PHASE_METRICS };
    const candidate = value;
    return {
        cross: normalizeHistoryMetric(candidate.cross),
        f2l: normalizeHistoryMetric(candidate.f2l),
        oll: normalizeHistoryMetric(candidate.oll),
        pll: normalizeHistoryMetric(candidate.pll),
    };
}
function normalizeF2lSubphaseMetrics(value) {
    if (!value || typeof value !== "object")
        return { ...EMPTY_F2L_SUBPHASE_METRICS };
    const candidate = value;
    return {
        one: normalizeHistoryMetric(candidate.one),
        two: normalizeHistoryMetric(candidate.two),
        three: normalizeHistoryMetric(candidate.three),
        four: normalizeHistoryMetric(candidate.four),
    };
}
function normalizeSolveHistoryEntry(entry) {
    const { scramble: _scramble, ...rest } = entry;
    return {
        ...rest,
        cfop: normalizeCfopPhaseMetrics(entry.cfop),
        cfopMoves: normalizeCfopPhaseMetrics(entry.cfopMoves),
        cfopF2l: normalizeF2lSubphaseMetrics(entry.cfopF2l),
        cfopF2lMoves: normalizeF2lSubphaseMetrics(entry.cfopF2lMoves),
    };
}
function trimSolveHistory(history) {
    return history.map(normalizeSolveHistoryEntry);
}
function prependSolveHistoryEntry(history, entry) {
    return trimSolveHistory([entry, ...history]);
}
function saveSolveHistory(history) {
    if (typeof window === "undefined")
        return;
    try {
        const storageKey = getArchiveScopedStorageKey(exports.CUBE_HISTORY_KEY);
        const normalized = trimSolveHistory(history);
        const raw = JSON.stringify(normalized);
        window.localStorage.setItem(storageKey, raw);
        solveHistoryCache = { storageKey, raw, value: normalized };
        emitStatisticsArchiveChange();
    }
    catch {
        // Local storage can be unavailable in private contexts; the in-memory state still works.
    }
}
function loadDailyLevels() {
    if (typeof window === "undefined")
        return [];
    const storageKey = getArchiveScopedStorageKey(exports.DAILY_LEVELS_KEY);
    try {
        const result = readCachedArray(storageKey, dailyLevelsCache, normalizeDailyLevelEntry);
        dailyLevelsCache = result.cache;
        return result.value;
    }
    catch {
        return [];
    }
}
function normalizeDailyLevelSolve(value) {
    if (!value || typeof value !== "object")
        return null;
    const candidate = value;
    if (typeof candidate.ms !== "number" ||
        !Number.isFinite(candidate.ms) ||
        typeof candidate.ts !== "number") {
        return null;
    }
    return {
        ms: candidate.ms,
        ts: candidate.ts,
        ...(typeof candidate.moves === "number" ? { moves: candidate.moves } : {}),
    };
}
function getDailyLevelExcludedSolveIndexes(solves) {
    if (solves.length < 3)
        return new Set();
    const indexed = solves
        .map((solve, index) => ({ index, ms: solve.ms }))
        .filter((solve) => Number.isFinite(solve.ms));
    if (indexed.length < 3)
        return new Set();
    const sorted = [...indexed].sort((left, right) => {
        if (left.ms !== right.ms)
            return left.ms - right.ms;
        return left.index - right.index;
    });
    return new Set([sorted[0].index, sorted[sorted.length - 1].index]);
}
function calculateDailyLevelAverage(solves) {
    const excluded = getDailyLevelExcludedSolveIndexes(solves);
    const included = solves.filter((solve, index) => !excluded.has(index) && Number.isFinite(solve.ms));
    if (included.length === 0)
        return null;
    return included.reduce((sum, solve) => sum + solve.ms, 0) / included.length;
}
function normalizeDailyLevelEntry(value) {
    if (!value || typeof value !== "object")
        return null;
    const candidate = value;
    if (typeof candidate.id !== "string" ||
        typeof candidate.localDate !== "string" ||
        typeof candidate.completedAt !== "number" ||
        !Array.isArray(candidate.solves)) {
        return null;
    }
    const solves = candidate.solves.map(normalizeDailyLevelSolve);
    if (solves.some((solve) => solve === null))
        return null;
    const parsedSolves = solves;
    const averageMs = calculateDailyLevelAverage(parsedSolves);
    const fallbackAverageMs = typeof candidate.averageMs === "number" ? candidate.averageMs : null;
    if (averageMs == null && fallbackAverageMs == null)
        return null;
    const normalizedAverageMs = averageMs ?? fallbackAverageMs;
    if (normalizedAverageMs == null)
        return null;
    return {
        id: candidate.id,
        localDate: candidate.localDate,
        completedAt: candidate.completedAt,
        averageMs: normalizedAverageMs,
        solves: parsedSolves,
    };
}
function saveDailyLevels(levels) {
    if (typeof window === "undefined")
        return;
    try {
        const storageKey = getArchiveScopedStorageKey(exports.DAILY_LEVELS_KEY);
        const normalized = levels.map(normalizeDailyLevelEntry).filter((entry) => entry !== null);
        const raw = JSON.stringify(normalized);
        window.localStorage.setItem(storageKey, raw);
        dailyLevelsCache = { storageKey, raw, value: normalized };
        emitStatisticsArchiveChange();
    }
    catch {
        // Local storage can be unavailable in private contexts; the in-memory state still works.
    }
}
function normalizeDailyPracticeEntry(value) {
    if (!value || typeof value !== "object")
        return null;
    const candidate = value;
    if (typeof candidate.localDate !== "string" ||
        typeof candidate.seconds !== "number" ||
        typeof candidate.updatedAt !== "number" ||
        !Number.isFinite(candidate.seconds) ||
        !Number.isFinite(candidate.updatedAt) ||
        candidate.seconds < 0) {
        return null;
    }
    return {
        localDate: candidate.localDate,
        seconds: Math.max(0, Math.round(candidate.seconds)),
        updatedAt: candidate.updatedAt,
    };
}
function normalizePendingPracticeSession(value) {
    if (!value || typeof value !== "object")
        return null;
    const candidate = value;
    if (typeof candidate.archiveId !== "string" ||
        typeof candidate.startAt !== "number" ||
        typeof candidate.lastMoveAt !== "number" ||
        candidate.archiveId.length === 0 ||
        !Number.isFinite(candidate.startAt) ||
        !Number.isFinite(candidate.lastMoveAt) ||
        candidate.lastMoveAt < candidate.startAt) {
        return null;
    }
    return {
        archiveId: candidate.archiveId,
        startAt: candidate.startAt,
        lastMoveAt: candidate.lastMoveAt,
    };
}
function loadDailyPracticeSeconds(archiveId) {
    if (typeof window === "undefined")
        return [];
    const storageKey = getArchiveScopedStorageKey(exports.DAILY_PRACTICE_SECONDS_KEY, archiveId);
    try {
        const result = readCachedArray(storageKey, dailyPracticeCache, normalizeDailyPracticeEntry);
        dailyPracticeCache = result.cache;
        return result.value;
    }
    catch {
        return [];
    }
}
function loadPendingPracticeSession() {
    if (typeof window === "undefined")
        return null;
    try {
        return normalizePendingPracticeSession(JSON.parse(window.localStorage.getItem(exports.PRACTICE_PENDING_SESSION_KEY) || "null"));
    }
    catch {
        return null;
    }
}
function savePendingPracticeSession(session) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(exports.PRACTICE_PENDING_SESSION_KEY, JSON.stringify(session));
    }
    catch {
        // localStorage can be unavailable in restricted browsing modes.
    }
}
function clearPendingPracticeSession() {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.removeItem(exports.PRACTICE_PENDING_SESSION_KEY);
    }
    catch {
        // localStorage can be unavailable in restricted browsing modes.
    }
}
function saveDailyPracticeSeconds(entries, archiveId) {
    if (typeof window === "undefined")
        return;
    try {
        const byDate = new Map();
        entries.forEach((entry) => {
            const normalized = normalizeDailyPracticeEntry(entry);
            if (!normalized)
                return;
            const existing = byDate.get(normalized.localDate);
            if (!existing || normalized.updatedAt >= existing.updatedAt) {
                byDate.set(normalized.localDate, normalized);
            }
        });
        const storageKey = getArchiveScopedStorageKey(exports.DAILY_PRACTICE_SECONDS_KEY, archiveId);
        const normalized = Array.from(byDate.values()).sort((left, right) => left.localDate.localeCompare(right.localDate));
        const raw = JSON.stringify(normalized);
        window.localStorage.setItem(storageKey, raw);
        dailyPracticeCache = { storageKey, raw, value: normalized };
        emitStatisticsArchiveChange();
    }
    catch {
        // Local storage can be unavailable in private contexts; the in-memory state still works.
    }
}
function nextLocalMidnightMs(timestamp) {
    const date = new Date(timestamp);
    date.setHours(24, 0, 0, 0);
    return date.getTime();
}
function addPracticeDurationToEntries(entries, startMs, endMs, updatedAt = Date.now()) {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs)
        return entries;
    const additions = new Map();
    let cursor = startMs;
    while (cursor < endMs) {
        const segmentEnd = Math.min(endMs, nextLocalMidnightMs(cursor));
        const seconds = Math.round((segmentEnd - cursor) / 1000);
        if (seconds > 0) {
            const localDate = getLocalDateKey(new Date(cursor));
            additions.set(localDate, (additions.get(localDate) ?? 0) + seconds);
        }
        cursor = segmentEnd;
    }
    if (additions.size === 0)
        return entries;
    const byDate = new Map(entries.map((entry) => [entry.localDate, entry]));
    additions.forEach((seconds, localDate) => {
        const existing = byDate.get(localDate);
        byDate.set(localDate, {
            localDate,
            seconds: (existing?.seconds ?? 0) + seconds,
            updatedAt,
        });
    });
    return Array.from(byDate.values());
}
function loadDailyPracticeSecondsWithPendingSession(archiveId = getActiveStatisticsArchiveId()) {
    const entries = loadDailyPracticeSeconds(archiveId);
    const pending = loadPendingPracticeSession();
    if (!pending || pending.archiveId !== archiveId)
        return entries;
    return addPracticeDurationToEntries(entries, pending.startAt, pending.lastMoveAt, Date.now());
}
function addDailyPracticeDuration(startMs, endMs, archiveId) {
    if (typeof window === "undefined")
        return [];
    const entries = loadDailyPracticeSeconds(archiveId);
    const next = addPracticeDurationToEntries(entries, startMs, endMs);
    if (next === entries)
        return [];
    saveDailyPracticeSeconds(next, archiveId);
    return next;
}
