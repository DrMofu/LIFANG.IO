"use client";
import { useCubeAppearance } from "@/components/cube/cube-appearance-provider";
import { FormulaCubeImage,FormulaTopViewImage } from "@/components/cube/formula-cube-image";
import { FormulaDescription,renderAlgorithmWithGroups } from "@/components/formulas/formula-algorithm-display";
import { LearningStatusSelectField,OllShapeSelectField } from "@/components/formulas/formula-filters";
import { FormulaPicker,MOBILE_FORMULA_QUERY } from "@/components/formulas/formula-picker";
import { FormulaStage } from "@/components/formulas/formula-stage";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppFooter,AppTopbar } from "@/components/shell/app-shell";
import { isFormulaTextEntryTarget } from "@/lib/browser/keyboard-shortcuts";
import { getFaceHexColors } from "@/lib/cube/cube-appearance";
import { caseHasVariantKey,caseUsesVariantList,findVariantByKey,getCaseLearningCounts,getCaseStats,getFormulaCasePreviewFacelets,normalizeFormulaCase,preferredCaseVariant,usesTopViewFormulaImage,type FormulaCaseItem,type FormulaKey,type FormulaStats,type FormulaVariantItem,type FormulaViewKey,type LearningStatusFilter,type OllShapeFilter,} from "@/lib/formulas/formula-case-model";
import { FORMULA_LEARNING_STATUSES as LEARNING_STATUSES,getFormulaLearningStatus as getLearningStatus,readFormulaLearningStatuses as readLearningStatuses,saveFormulaLearningStatuses as saveLearningStatuses,type FormulaLearningStatus as LearningStatus,} from "@/lib/formulas/formula-learning-status";
import { METHOD_PREFERENCES_KEY,getDefaultFormulaState,readAllFormulaStats,readFavs,readFormulaState,readMethodPreferences,saveFavs,saveFormulaState,} from "@/lib/formulas/formula-preferences";
import { FORMULAS } from "@/lib/formulas/formulas-data";
import { DEFAULT_AVERAGE_TIME_SETTINGS,calculateAverageTime,loadAverageTimeSettings,type AverageTimeSettings,} from "@/lib/records/average-time";
import { subscribeStatisticsArchiveChange } from "@/lib/records/solve-history";
import { fmtShort } from "@/lib/utils/format";
import Image from "next/image";
import { useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore } from "react";

type FormulaTip = {
  title: string;
  sourceName: string;
  variants: FormulaVariantItem[];
  left: number;
  top: number;
};

function getFormulaNavigationDirection(event: KeyboardEvent) {
  if (event.key === "ArrowDown") return 1;
  if (event.key === "ArrowUp") return -1;
  return 0;
}

function formatListStats(stats: FormulaStats | undefined, averageSettings: AverageTimeSettings) {
  if (!stats || stats.count <= 0) return { best: "--", stable: "--" };
  const average = calculateAverageTime(stats.times, averageSettings);
  return {
    best: stats.bestMs ? fmtShort(stats.bestMs) : "--",
    stable: average ? fmtShort(average.valueMs) : "--",
  };
}

const isMobileFormulaLayout = () => window.matchMedia(MOBILE_FORMULA_QUERY).matches;

const serverMobileFormulaLayout = () => false;

export function FormulasApp() {
  const { t } = useLanguage();
  const { orientation, faceColors } = useCubeAppearance();
  const formulaTopViewFaceColors = useMemo(() => getFaceHexColors(orientation, "cubing-js"), [orientation]);
  const initialFormulaState = useMemo(() => getDefaultFormulaState(), []);
  const [cat, setCat] = useState<FormulaViewKey>(initialFormulaState.cat);
  const [activeKey, setActiveKey] = useState<string>(initialFormulaState.activeKey);
  const [methodPreferences, setMethodPreferences] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  const [formulaStats, setFormulaStats] = useState<Record<string, FormulaStats>>({});
  const [learningStatuses, setLearningStatuses] = useState<Record<string, LearningStatus>>({});
  const [averageSettings, setAverageSettings] = useState<AverageTimeSettings>(DEFAULT_AVERAGE_TIME_SETTINGS);
  const [statusFilter, setStatusFilter] = useState<LearningStatusFilter>(initialFormulaState.statusFilter);
  const [ollShapeFilter, setOllShapeFilter] = useState<OllShapeFilter>(initialFormulaState.ollShapeFilter);
  const [showFavOnly, setShowFavOnly] = useState(initialFormulaState.showFavOnly);
  const [formulaTip, setFormulaTip] = useState<FormulaTip | null>(null);
  const [expandedCaseIds, setExpandedCaseIds] = useState<Set<string>>(() => new Set());
  const [archiveDataReady, setArchiveDataReady] = useState(false);
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0);
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const subscribeMobileLayout = useCallback((onChange: () => void) => {
    const query = window.matchMedia(MOBILE_FORMULA_QUERY);
    const handleChange = () => {
      setFormulaTip(null);
      if (!query.matches) setMobileLibraryOpen(false);
      onChange();
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);
  const isMobile = useSyncExternalStore(subscribeMobileLayout, isMobileFormulaLayout, serverMobileFormulaLayout);
  const keyboardSelectionRef = useRef(false);
  const formulaCases = useMemo(
    () =>
      Object.entries(FORMULAS).flatMap(([key, value]) =>
        value.items.map((item) => normalizeFormulaCase(item, key as FormulaKey, value.name, value.full)),
      ),
    [],
  ) satisfies FormulaCaseItem[];
  const favoriteCases = useMemo(
    () =>
      formulaCases
        .flatMap((item) => item.variants
          .filter((variant) => favs.includes(variant.key))
          .map((variant) => ({
            ...item,
            id: variant.key,
            algo: variant.algo,
            algos: undefined,
            facelets: variant.caseFacelets,
            variants: [variant],
          }))),
    [favs, formulaCases],
  );
  const isFavoritesView = cat === "favorites";
  const categoryCases = isFavoritesView
    ? favoriteCases
    : formulaCases.filter((item) => item.sourceCat === cat);
  const catData = isFavoritesView
    ? {
        name: t("收藏夹"),
        full: "Favorites",
        items: categoryCases,
      }
    : {
        ...FORMULAS[cat],
        items: categoryCases,
      };

  useEffect(() => {
    function refreshArchiveData() {
      const saved = readFormulaState() ?? getDefaultFormulaState();
      setCat(saved.cat);
      setActiveKey(saved.activeKey);
      setMethodPreferences(readMethodPreferences());
      setShowFavOnly(saved.showFavOnly);
      setStatusFilter(saved.statusFilter);
      setOllShapeFilter(saved.ollShapeFilter);
      setFilter("");
      setFormulaTip(null);
      const savedCase = formulaCases.find((item) => caseHasVariantKey(item, saved.activeKey));
      setExpandedCaseIds(new Set(savedCase && caseUsesVariantList(savedCase) ? [savedCase.id] : []));
      setFavs(readFavs());
      setFormulaStats(readAllFormulaStats());
      setLearningStatuses(readLearningStatuses());
      setAverageSettings(loadAverageTimeSettings());
      setArchiveRefreshKey((current) => current + 1);
    }

    refreshArchiveData();
    const readyTimer = window.setTimeout(() => setArchiveDataReady(true), 0);
    const unsubscribe = subscribeStatisticsArchiveChange(refreshArchiveData);
    return () => {
      window.clearTimeout(readyTimer);
      unsubscribe();
    };
  }, [formulaCases]);

  useEffect(() => {
    if (!archiveDataReady) return;
    saveFormulaState({ cat, activeKey, showFavOnly, statusFilter, ollShapeFilter });
  }, [archiveDataReady, cat, activeKey, showFavOnly, statusFilter, ollShapeFilter]);

  useEffect(() => {
    if (!archiveDataReady) return;
    saveFavs(favs);
  }, [archiveDataReady, favs]);

  useEffect(() => {
    if (!archiveDataReady) return;
    saveLearningStatuses(learningStatuses);
  }, [archiveDataReady, learningStatuses]);

  function changeCat(nextCat: FormulaViewKey) {
    if (nextCat === cat) return;
    setCat(nextCat);
    const nextItems = nextCat === "favorites"
      ? favoriteCases
      : formulaCases
          .filter((item) => item.sourceCat === nextCat)
          .map((item) => ({
            ...item,
            variants: showFavOnly ? item.variants.filter((variant) => favs.includes(variant.key)) : item.variants,
          }))
          .filter((item) => item.variants.length > 0);
    const firstVariant = nextItems[0]?.variants[0];
    if (firstVariant && !isMobile) {
      setActiveKey(firstVariant.key);
      const firstCase = nextItems[0];
      if (firstCase && caseUsesVariantList(firstCase)) {
        setExpandedCaseIds((prev) => {
          if (prev.has(firstCase.id)) return prev;
          const next = new Set(prev);
          next.add(firstCase.id);
          return next;
        });
      }
    }
    setFilter("");
    if (nextCat === "favorites") setShowFavOnly(false);
  }

  const items = useMemo(() => {
    let list = catData.items;
    if (showFavOnly) {
      list = list
        .map((item) => ({ ...item, variants: item.variants.filter((variant) => favs.includes(variant.key)) }))
        .filter((item) => item.variants.length > 0);
    }
    if (statusFilter !== "all") {
      list = list
        .map((item) => ({
          ...item,
          variants: item.variants.filter((variant) => getLearningStatus(learningStatuses, variant.key) === statusFilter),
        }))
        .filter((item) => item.variants.length > 0);
    }
    if (cat === "oll" && ollShapeFilter !== "all") {
      list = list.filter((item) => item.shape === ollShapeFilter);
    }
    if (filter.trim()) {
      const query = filter.toLowerCase();
      list = list
        .map((item) => {
          const caseMatches = item.name.toLowerCase().includes(query);
          const variants = caseMatches
            ? item.variants
            : item.variants.filter(
                (variant) =>
                  variant.name.toLowerCase().includes(query) ||
                  (variant.description?.toLowerCase().includes(query) ?? false) ||
                  variant.algo.toLowerCase().includes(query),
              );
          return { ...item, variants };
        })
        .filter((item) => item.variants.length > 0);
    }
    return list;
  }, [cat, catData.items, favs, filter, learningStatuses, ollShapeFilter, showFavOnly, statusFilter]);

  const visibleFormulaVariants = useMemo(() => items.flatMap((item) => item.variants), [items]);

  const active = isMobile
    ? findVariantByKey(formulaCases, activeKey) || formulaCases[0]?.variants[0] || null
    : isFavoritesView
    ? findVariantByKey(favoriteCases, activeKey) || favoriteCases[0]?.variants[0] || null
    : findVariantByKey(categoryCases, activeKey) || categoryCases[0]?.variants[0] || null;
  const resolvedActiveKey = active?.key ?? activeKey;
  const activeMethods = formulaCases.find((item) => item.id === active?.caseId)?.variants ?? [];
  const activeCatKey = active?.sourceCat ?? cat;
  const activeLearningStatus = active ? getLearningStatus(learningStatuses, active.key) : "unpracticed";
  const emptyMessage = filter.trim() ? t("无匹配结果") : statusFilter === "all" ? t("无匹配结果") : t("此状态下暂无公式");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isMobile) return;
      const direction = getFormulaNavigationDirection(event);
      if (direction === 0) return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isFormulaTextEntryTarget(event.target)) return;
      if (visibleFormulaVariants.length === 0) return;

      event.preventDefault();
      setFormulaTip(null);
      const currentIndex = visibleFormulaVariants.findIndex((variant) => variant.key === resolvedActiveKey);
      const startIndex = currentIndex === -1
        ? direction > 0
          ? -1
          : visibleFormulaVariants.length
        : currentIndex;
      const nextIndex = Math.min(Math.max(startIndex + direction, 0), visibleFormulaVariants.length - 1);
      const nextVariant = visibleFormulaVariants[nextIndex];
      if (!nextVariant || nextVariant.key === resolvedActiveKey) return;

      keyboardSelectionRef.current = true;
      setActiveKey(nextVariant.key);
      setExpandedCaseIds((prev) => {
        const nextCase = items.find((item) => caseHasVariantKey(item, nextVariant.key));
        if (!nextCase || !caseUsesVariantList(nextCase) || prev.has(nextCase.id)) return prev;
        const next = new Set(prev);
        next.add(nextCase.id);
        return next;
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, items, resolvedActiveKey, visibleFormulaVariants]);

  useEffect(() => {
    if (!keyboardSelectionRef.current) return;
    keyboardSelectionRef.current = false;
    const activeRow = document.querySelector<HTMLElement>(`[data-formula-key="${CSS.escape(resolvedActiveKey)}"]`);
    activeRow?.scrollIntoView({ block: "nearest" });
  }, [expandedCaseIds, resolvedActiveKey]);

  function toggleFav(id: string) {
    setFavs((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function setFormulaLearningStatus(id: string, status: LearningStatus) {
    setLearningStatuses((prev) => ({ ...prev, [id]: status }));
  }

  function updateFormulaStats(id: string, stats: FormulaStats) {
    setFormulaStats((prev) => ({ ...prev, [id]: stats }));
  }

  function toggleCaseExpanded(caseId: string) {
    setExpandedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }

  function selectCase(item: FormulaCaseItem) {
    if (isMobile) {
      const variant = preferredCaseVariant(item, methodPreferences);
      if (variant) selectVariant(variant.key);
      return;
    }
    if (!caseHasVariantKey(item, resolvedActiveKey)) {
      const firstVariant = item.variants[0];
      if (firstVariant) setActiveKey(firstVariant.key);
    }
    if (caseUsesVariantList(item)) toggleCaseExpanded(item.id);
  }

  function selectVariant(key: string) {
    const variant = findVariantByKey(formulaCases, key);
    if (!variant) return;
    const preferences = { ...methodPreferences, [variant.caseId]: key };
    setMethodPreferences(preferences);
    try {
      window.localStorage.setItem(METHOD_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch { /* Formula selection still works when storage is unavailable. */ }
    setActiveKey(key);
    if (isMobile) {
      setMobileLibraryOpen(false);
      setFormulaTip(null);
    }
  }

  function showFormulaTip(target: HTMLElement, title: string, sourceName: string, variants: FormulaVariantItem[]) {
    if (isMobile) return;
    if (variants.length === 0) return;
    const rect = target.getBoundingClientRect();
    const tipWidth = Math.min(360, window.innerWidth - 32);
    const margin = 16;
    const rightSide = rect.right + 10;
    const left = rightSide + tipWidth <= window.innerWidth - margin
      ? rightSide
      : Math.min(window.innerWidth - tipWidth - margin, Math.max(margin, rect.left));
    const tipHeightEstimate = Math.min(260, 70 + variants.length * 46);
    const maxTop = Math.max(margin, window.innerHeight - tipHeightEstimate);
    const top = Math.min(maxTop, Math.max(margin, rect.top));
    setFormulaTip({ title, sourceName, variants, left, top });
  }

  return (
    <div className="app lf-tech-app">
      <AppTopbar />

      <main className="fm-grid">
        <FormulaPicker mobile={isMobile} open={mobileLibraryOpen} onClose={() => setMobileLibraryOpen(false)}>
        <section className="fm-left practice-card ui-info-panel">
          <div className="fm-library-close-row">
            <button className="ghost-link" type="button" aria-label={t("关闭公式菜单")} onClick={() => setMobileLibraryOpen(false)}>×</button>
          </div>
          <div className="fm-category-tabs" aria-label={t("公式类别")}>
            {Object.entries(FORMULAS).map(([key, value]) => (
              <button
                key={key}
                type="button"
                className={`fm-category-tab${cat === key ? " active" : ""}`}
                onClick={() => changeCat(key as FormulaKey)}
              >
                {t(value.name)}
              </button>
            ))}
            <button
              type="button"
              className={`fm-category-tab${isFavoritesView ? " active" : ""}`}
              onClick={() => changeCat("favorites")}
            >{t("收藏夹")}</button>
          </div>
          <div className="fm-library-panel">
            <div className="fm-search">
              <input
                type="text"
                placeholder={t(`搜索 ${catData.name}…`)}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
              {cat === "oll" && (
                <OllShapeSelectField
                  id="oll-shape-filter"
                  selected={ollShapeFilter}
                  faceColors={formulaTopViewFaceColors}
                  onSelect={setOllShapeFilter}
                />
              )}
              <LearningStatusSelectField selected={statusFilter} onSelect={setStatusFilter} />
              {!isFavoritesView && (
                <button
                  className={`fm-fav-toggle${showFavOnly ? " active" : ""}`}
                  onClick={() => setShowFavOnly((value) => !value)}
                  aria-label={t("只看收藏")}
                  aria-pressed={showFavOnly}
                  title={t("只看收藏")}
                >
                  <span aria-hidden="true">★</span>
                </button>
              )}
            </div>
            <div className="fm-list">
              {items.length === 0 ? (
                <div className="fm-empty">{emptyMessage}</div>
              ) : (
                items.map((item) => {
                const caseActive = item.variants.some((variant) => variant.key === resolvedActiveKey);
                const usesVariantList = !isMobile && caseUsesVariantList(item);
                const caseExpanded = usesVariantList && expandedCaseIds.has(item.id);
                const summary = isMobile || usesVariantList ? null : formatListStats(getCaseStats(item, formulaStats), averageSettings);
                const preferredVariant = preferredCaseVariant(item, methodPreferences);
                const itemLearningStatus = getLearningStatus(learningStatuses, preferredVariant?.key ?? item.id);
                const statusLabel = t(LEARNING_STATUSES.find((status) => status.key === itemLearningStatus)?.shortLabel ?? "未学习");
                const learningCounts = getCaseLearningCounts(item, learningStatuses);
                const casePreviewFacelets = getFormulaCasePreviewFacelets(item);
                return (
                  <div key={item.id} className={`fm-case${caseActive ? " active" : ""}`}>
                    <div
                      data-formula-key={usesVariantList ? undefined : item.variants[0]?.key}
                      className={`fm-row fm-case-row${usesVariantList ? " multi" : ""}${caseActive ? " active" : ""}`}
                      onClick={() => selectCase(item)}
                      onBlur={() => setFormulaTip(null)}
                      onFocus={(event) => showFormulaTip(event.currentTarget, item.name, item.sourceName, item.variants)}
                      onMouseEnter={(event) => showFormulaTip(event.currentTarget, item.name, item.sourceName, item.variants)}
                      onMouseLeave={() => setFormulaTip(null)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        selectCase(item);
                      }}
                      tabIndex={0}
                    >
                      {usesTopViewFormulaImage(item.sourceCat) && casePreviewFacelets ? (
                        <FormulaTopViewImage
                          facelets={casePreviewFacelets}
                          faceColors={formulaTopViewFaceColors}
                          arrows={item.arrows}
                          className="fmr-img formula-top-view-svg"
                        />
                      ) : item.image ? (
                        <Image className="fmr-img" src={item.image} alt="" width={48} height={48} />
                      ) : casePreviewFacelets ? (
                        <FormulaCubeImage
                          facelets={casePreviewFacelets}
                          faceColors={faceColors}
                          className="fmr-img formula-cube-svg"
                        />
                      ) : (
                        <div className="fmr-img fmr-img-empty" aria-hidden="true"></div>
                      )}
                      <div className="fmr-l">
                        <div className="fmr-name">
                          <span>
                            {t(item.name)}
                            {isFavoritesView && item.variants[0].id !== "main" && item.variants[0].name !== item.name
                              ? ` · ${t(item.variants[0].name)}`
                              : ""}
                          </span>
                          {!isMobile && <FormulaDescription description={item.variants.length === 1 ? item.variants[0]?.description : item.description} />}
                        </div>
                        {!isMobile && isFavoritesView && <div className="fvr-algo">{item.variants[0].algo}</div>}
                        <div className="fmr-meta">
                          {usesVariantList ? (
                            <>
                              {learningCounts.mastered === 0 && learningCounts.learning === 0 && (
                                <span className="formula-status-badge status-unpracticed">{t("未掌握")}</span>
                              )}
                              {learningCounts.mastered > 0 && (
                                <span className="formula-status-badge status-mastered">{t("formulaCatalog.masteredCount").replace("{count}", String(learningCounts.mastered))}</span>
                              )}
                              {learningCounts.learning > 0 && (
                                <span className="formula-status-badge status-learning">{t("formulaCatalog.learningCount").replace("{count}", String(learningCounts.learning))}</span>
                              )}
                            </>
                          ) : (
                            <span className={`formula-status-badge status-${itemLearningStatus}`}>{!isMobile && itemLearningStatus === "unpracticed" ? t("未掌握") : statusLabel}</span>
                          )}
                          {summary && (
                            <>
                              <span className="formula-stat-text">{t("最佳")}{" "}{summary.best}</span>
                              <span className="formula-stat-text">{t("稳定")}{" "}{summary.stable}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {usesVariantList ? (
                        <button
                          className={`fmr-expand${caseExpanded ? " open" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleCaseExpanded(item.id);
                          }}
                          title={caseExpanded ? t("收起公式") : t("展开公式")}
                          type="button"
                        >
                          ▸
                        </button>
                      ) : (
                        <button
                          className={`fmr-fav${favs.includes(preferredVariant.key) ? " on" : ""}`}
                          aria-label={t("收藏")}
                          aria-pressed={favs.includes(preferredVariant.key)}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFav(preferredVariant.key);
                          }}
                          type="button"
                        >
                          {favs.includes(preferredVariant.key) ? "★" : "☆"}
                        </button>
                      )}
                    </div>
                    {caseExpanded && (
                      <div className="fm-variant-list">
                        {item.variants.map((variant) => {
                          const variantActive = variant.key === resolvedActiveKey;
                          const variantStats = formatListStats(formulaStats[variant.key], averageSettings);
                          const variantStatus = getLearningStatus(learningStatuses, variant.key);
                          const variantStatusLabel = t(LEARNING_STATUSES.find((status) => status.key === variantStatus)?.shortLabel ?? "未学习");
                          const isFav = favs.includes(variant.key);
                          return (
                            <div
                              key={variant.key}
                              data-formula-key={variant.key}
                              className={`fm-variant-row${variantActive ? " active" : ""}`}
                              onClick={() => selectVariant(variant.key)}
                              onBlur={() => setFormulaTip(null)}
                              onFocus={(event) => showFormulaTip(event.currentTarget, `${variant.caseName} · ${variant.name}`, variant.sourceName, [variant])}
                              onMouseEnter={(event) => showFormulaTip(event.currentTarget, `${variant.caseName} · ${variant.name}`, variant.sourceName, [variant])}
                              onMouseLeave={() => setFormulaTip(null)}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                selectVariant(variant.key);
                              }}
                              tabIndex={0}
                            >
                              <div className="fvr-main">
                                <div className="fvr-name">
                                  <span>{t(variant.name)}</span>
                                  <FormulaDescription description={variant.description} />
                                </div>
                                <div className="fvr-algo">{variant.algo}</div>
                                <div className="fmr-meta">
                                  <span className={`formula-status-badge status-${variantStatus}`}>{variantStatusLabel}</span>
                                  <span className="formula-stat-text">{t("最佳")}{" "}{variantStats.best}</span>
                                  <span className="formula-stat-text">{t("稳定")}{" "}{variantStats.stable}</span>
                                </div>
                              </div>
                              <button
                                className={`fmr-fav${isFav ? " on" : ""}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFav(variant.key);
                                }}
                                type="button"
                              >
                                {isFav ? "★" : "☆"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
                })
              )}
            </div>
          </div>
        </section>
        </FormulaPicker>

        <section className="fm-right">
          {active ? (
            <>
              <div className="fm-detail-body">
                <FormulaStage
                  key={`${active.key}:${archiveRefreshKey}`}
                  active={active}
                  compactLayout={isMobile}
                  methods={activeMethods}
                  onMethodChange={selectVariant}
                  shouldSolveToReset={activeCatKey !== "triggers"}
                  onStatsChange={updateFormulaStats}
                  learningStatus={activeLearningStatus}
                  onLearningStatusChange={(status) => setFormulaLearningStatus(active.key, status)}
                  averageSettings={averageSettings}
                  formulaPickerOpen={mobileLibraryOpen}
                  onChooseFormula={() => { setFormulaTip(null); setMobileLibraryOpen(true); }}
                />
              </div>
            </>
          ) : (
            <div className="fm-detail-empty practice-card ui-info-panel">
              <div className="fmd-cat">{t("收藏夹")}</div>
              <div className="fmd-name">{t("还没有收藏公式")}</div>
              <div className="fm-empty">{t("点击任意公式右侧的星标后，会在这里集中显示。")}</div>
              <button
                type="button"
                className="ghost-link fm-mobile-choose"
                aria-haspopup="dialog"
                aria-expanded={mobileLibraryOpen}
                aria-controls="fm-mobile-library"
                onClick={() => setMobileLibraryOpen(true)}
              >{t("切换公式")}</button>
            </div>
          )}
        </section>

        {formulaTip && (
          <div className="formula-floating-tip" role="tooltip" style={{ left: formulaTip.left, top: formulaTip.top }}>
            <div className="fft-head">
              <span>{formulaTip.title}</span>
              <b>{formulaTip.sourceName}</b>
            </div>
            <div className="fft-list">
              {formulaTip.variants.map((variant) => (
                <div key={variant.key} className="fft-row">
                  {formulaTip.variants.length > 1 && <div className="fft-name">{t(variant.name)}</div>}
                  <div className="fft-algo">{renderAlgorithmWithGroups(variant.algo)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
