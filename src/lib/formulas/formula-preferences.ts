"use client";
import { cleanupFormulaRecordSpeedData } from "@/lib/account/user-data-package";
import { type FormulaKey,type FormulaStats,type FormulaViewKey,type LearningStatusFilter,type OllShapeFilter,formulaVariantKey,getLocalDayKey,hasFormulaVariantKey,isLearningStatusFilter,isOllShapeFilter,} from "@/lib/formulas/formula-case-model";
import { FORMULA_STATS_LIMIT } from "@/lib/formulas/formula-time-distribution";
import { FORMULAS } from "@/lib/formulas/formulas-data";
import { getArchiveScopedStorageKey } from "@/lib/records/solve-history";

const FAV_KEY = "formula-favs";

const STATE_KEY = "formula-state";

export const METHOD_PREFERENCES_KEY = "formula-method-preferences";

const STATS_KEY = "formula-practice-stats";

const FOCUS_MODE_KEY = "formula-focus-mode";

function isFormulaStats(value: unknown): value is FormulaStats {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as FormulaStats).count === "number" &&
    Array.isArray((value as FormulaStats).times)
  );
}

function normalizeFormulaStats(stats: FormulaStats): FormulaStats {
  const validIndexes = stats.times.map((time, index) => Number.isFinite(time) && time > 0 ? index : -1).filter((index) => index >= 0).slice(-FORMULA_STATS_LIMIT);
  const times = validIndexes.map((index) => stats.times[index]);
  const storedBest = typeof stats.bestMs === "number" && Number.isFinite(stats.bestMs) && stats.bestMs > 0 ? stats.bestMs : null;
  const visibleBest = times.length > 0 ? Math.min(...times) : null;
  const bestMs = storedBest ?? visibleBest ?? undefined;
  return {
    count: stats.count,
    todayKey: stats.todayKey,
    todayCount: stats.todayCount,
    times,
    bestMs,
  };
}

export function readMethodPreferences(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(METHOD_PREFERENCES_KEY) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

export function readAllFormulaStats(): Record<string, FormulaStats> {
  if (typeof window === "undefined") return {};
  cleanupFormulaRecordSpeedData();
  try {
    const all = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(STATS_KEY)) || "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(all)
        .filter((entry): entry is [string, FormulaStats] => isFormulaStats(entry[1]))
        .map(([key, value]) => [key, normalizeFormulaStats(value)]),
    );
  } catch {
    return {};
  }
}

export function readFormulaStats(id: string): FormulaStats {
  if (typeof window === "undefined") return { count: 0, times: [] };
  try {
    const all = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(STATS_KEY)) || "{}") as Record<string, FormulaStats>;
    const s = all[id];
    if (isFormulaStats(s)) return normalizeFormulaStats(s);
  } catch { }
  return { count: 0, times: [] };
}

export function saveFormulaCompletion(id: string, ms: number): FormulaStats {
  try {
    const all = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(STATS_KEY)) || "{}") as Record<string, FormulaStats>;
    const prev = isFormulaStats(all[id]) ? normalizeFormulaStats(all[id]) : { count: 0, times: [] };
    const todayKey = getLocalDayKey();
    const next: FormulaStats = {
      count: prev.count + 1,
      times: [...prev.times, ms].slice(-FORMULA_STATS_LIMIT),
      bestMs: prev.bestMs == null ? ms : Math.min(prev.bestMs, ms),
      todayKey,
      todayCount: prev.todayKey === todayKey ? (prev.todayCount ?? 0) + 1 : 1,
    };
    all[id] = next;
    window.localStorage.setItem(getArchiveScopedStorageKey(STATS_KEY), JSON.stringify(all));
    return next;
  } catch {
    return { count: 1, times: [ms], todayKey: getLocalDayKey(), todayCount: 1 };
  }
}

export function readFavs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(getArchiveScopedStorageKey(FAV_KEY)) || "[]");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === "string"))];
  } catch {
    return [];
  }
}

export function saveFavs(favs: string[]) {
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(FAV_KEY), JSON.stringify(favs));
  } catch { }
}

export function readFocusModeEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getArchiveScopedStorageKey(FOCUS_MODE_KEY)) === "1";
  } catch {
    return false;
  }
}

export function saveFocusModeEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(FOCUS_MODE_KEY), enabled ? "1" : "0");
  } catch { }
}

export function getDefaultFormulaState() {
  return {
    cat: "pll" as FormulaViewKey,
    activeKey: formulaVariantKey(FORMULAS.pll.items[0].id, "main"),
    showFavOnly: false,
    statusFilter: "all" as LearningStatusFilter,
    ollShapeFilter: "all" as OllShapeFilter,
  };
}

export function readFormulaState(): {
  cat: FormulaViewKey;
  activeKey: string;
  showFavOnly: boolean;
  statusFilter: LearningStatusFilter;
  ollShapeFilter: OllShapeFilter;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getArchiveScopedStorageKey(STATE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.cat === "string" &&
      typeof parsed.activeId === "string"
    ) {
      const showFavOnly = typeof parsed.showFavOnly === "boolean" ? parsed.showFavOnly : false;
      const statusFilter = isLearningStatusFilter(parsed.statusFilter) ? parsed.statusFilter : "all";
      const ollShapeFilter = isOllShapeFilter(parsed.ollShapeFilter) ? parsed.ollShapeFilter : "all";
      if (parsed.cat === "favorites") {
        return parsed.activeId.includes(":")
          ? { cat: "favorites", activeKey: parsed.activeId, showFavOnly, statusFilter, ollShapeFilter }
          : null;
      }
      if (!(parsed.cat in FORMULAS)) return null;
      const cat = parsed.cat as FormulaKey;
      if (hasFormulaVariantKey(cat, parsed.activeId)) {
        return { cat, activeKey: parsed.activeId, showFavOnly, statusFilter, ollShapeFilter };
      }
    }
  } catch {
    // fall through to null
  }
  return null;
}

export function saveFormulaState(state: {
  cat: FormulaViewKey;
  activeKey: string;
  showFavOnly: boolean;
  statusFilter: LearningStatusFilter;
  ollShapeFilter: OllShapeFilter;
}) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getArchiveScopedStorageKey(STATE_KEY), JSON.stringify({
      cat: state.cat,
      activeId: state.activeKey,
      showFavOnly: state.showFavOnly,
      statusFilter: state.statusFilter,
      ollShapeFilter: state.ollShapeFilter,
    }));
  } catch {
    // local storage may be unavailable
  }
}
