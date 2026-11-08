"use client";
import { FormulaTopViewImage } from "@/components/cube/formula-cube-image";
import { useLanguage } from "@/components/i18n/language-provider";
import { type CubeFace } from "@/lib/cube/smart-cube";
import { OLL_SHAPE_OPTIONS,type LearningStatusFilter,type OllShapeFilter } from "@/lib/formulas/formula-case-model";
import { FORMULA_LEARNING_STATUSES as LEARNING_STATUSES } from "@/lib/formulas/formula-learning-status";
import { FORMULAS,OLL_SHAPES,OLL_SHAPE_LABELS,type FormulaItem,type OllShape } from "@/lib/formulas/formulas-data";
import { useState } from "react";

const STATUS_FILTERS: Array<{ key: LearningStatusFilter; label: string }> = [
  { key: "all", label: "全部" },
  ...LEARNING_STATUSES.map(({ key, label }) => ({ key, label })),
];

const OLL_SHAPE_PREVIEW_CASES = Object.fromEntries(
  OLL_SHAPES.map((shape) => [shape, FORMULAS.oll.items.find((item) => item.shape === shape)]),
) as Record<OllShape, FormulaItem | undefined>;

export function OllShapeSelectField({
  id,
  selected,
  faceColors,
  onSelect,
}: {
  id: string;
  selected: OllShapeFilter;
  faceColors: Record<CubeFace, string>;
  onSelect(shape: OllShapeFilter): void;
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = selected === "all" ? "formula.shape.all" : OLL_SHAPE_LABELS[selected];

  function handleSelect(shape: OllShapeFilter) {
    onSelect(shape);
    setIsOpen(false);
  }

  function renderPreview(shape: OllShapeFilter, className: string) {
    if (shape === "all") {
      return (
        <span className={`${className} fm-shape-all-preview`} aria-hidden="true">
          <i></i><i></i><i></i><i></i>
        </span>
      );
    }

    const previewCase = OLL_SHAPE_PREVIEW_CASES[shape];
    const facelets = previewCase?.facelets ?? previewCase?.algos?.find((variant) => variant.facelets)?.facelets;
    if (!previewCase || !facelets) return <span className={`${className} fm-shape-preview-empty`} aria-hidden="true"></span>;

    return (
      <FormulaTopViewImage
        facelets={facelets}
        faceColors={faceColors}
        arrows={previewCase.arrows}
        className={className}
      />
    );
  }

  return (
    <div
      className={`fm-shape-select-wrap${isOpen ? " open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        className="fm-shape-select-trigger"
        aria-label={`${t("formula.shape.label")}: ${t(selectedLabel)}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
        }}
      >
        {renderPreview(selected, "fm-shape-select-trigger-preview")}
        <span className="fm-shape-select-label">{t(selectedLabel)}</span>
      </button>
      {isOpen && (
        <div id={`${id}-menu`} className="fm-shape-select-menu" role="listbox" aria-labelledby={id}>
          {OLL_SHAPE_OPTIONS.map((shape) => {
            const isSelected = selected === shape;
            const label = shape === "all" ? "formula.shape.all" : OLL_SHAPE_LABELS[shape];
            return (
              <button
                key={shape}
                type="button"
                className={`fm-shape-select-option${isSelected ? " selected" : ""}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(shape)}
              >
                {renderPreview(shape, "fm-shape-select-option-preview")}
                <span>{t(label)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LearningStatusSelectField({
  selected,
  onSelect,
}: {
  selected: LearningStatusFilter;
  onSelect(status: LearningStatusFilter): void;
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = STATUS_FILTERS.find((status) => status.key === selected) ?? STATUS_FILTERS[0];

  function handleSelect(status: LearningStatusFilter) {
    onSelect(status);
    setIsOpen(false);
  }

  return (
    <div
      className={`fm-status-select-wrap${isOpen ? " open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        type="button"
        className="fm-status-select-trigger"
        aria-label={t("学习状态筛选")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="formula-status-filter-menu"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
          if (event.key === "ArrowDown") setIsOpen(true);
        }}
      >
        <span className="fm-status-select-label">{t(selectedOption.label)}</span>
        <svg className="fm-status-select-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <div id="formula-status-filter-menu" className="fm-status-select-menu" role="listbox">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status.key}
              type="button"
              className={`fm-status-select-option status-${status.key}${selected === status.key ? " selected" : ""}`}
              role="option"
              aria-selected={selected === status.key}
              onClick={() => handleSelect(status.key)}
            >
              <span>{t(status.label)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
