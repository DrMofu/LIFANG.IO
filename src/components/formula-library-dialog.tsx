"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FormulaCubeImage, FormulaTopViewImage } from "@/components/formula-cube-image";
import { useLanguage } from "@/components/language-provider";
import { FORMULAS, OLL_SHAPES, OLL_SHAPE_LABELS } from "@/lib/formulas-data";
import { useCubeAppearance } from "@/components/cube-appearance-provider";
import type { CfopTrainerPhase } from "@/lib/cfop-trainer";
import { getFaceHexColors } from "@/lib/cube-appearance";

export function FormulaLibraryDialog({ phase, selectedIds, includeRotations, onClose, onSave }: {
  phase: CfopTrainerPhase;
  selectedIds: string[];
  includeRotations: boolean;
  onClose: () => void;
  onSave: (ids: string[], rotations: boolean) => void;
}) {
  const { t } = useLanguage();
  const { orientation, faceColors: cubeFaceColors } = useCubeAppearance();
  const cases = FORMULAS[phase].items;
  const groups = phase === "oll"
    ? OLL_SHAPES.map((shape) => ({ key: shape, label: OLL_SHAPE_LABELS[shape], items: cases.filter((item) => item.shape === shape) }))
    : [{ key: phase, label: FORMULAS[phase].name, items: cases }];
  const faceColors = useMemo(() => getFaceHexColors(orientation, "cubing-js"), [orientation]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(() => new Set(selectedIds));
  const [rotations, setRotations] = useState(includeRotations);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  function toggle(ids: string[], checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => checked ? next.add(id) : next.delete(id));
      return next;
    });
  }

  return (
    <dialog ref={dialogRef} className="formula-library-dialog" aria-labelledby="formula-library-title" onCancel={onClose}>
      <header className="formula-library-toolbar">
        <h2 id="formula-library-title" className="ui-section-title">{t("formulaLibrary.title")}</h2>
        <span aria-live="polite">{t("formulaLibrary.selected").replace("{count}", String(selected.size)).replace("{total}", String(cases.length))}</span>
      </header>
      <div className="formula-library-toolbar">
        <label className="trainer-variant-toggle">
          <input type="checkbox" checked={rotations} onChange={(event) => setRotations(event.target.checked)} />
          <span><b>{t("加入 Y 轴旋转变体")}</b><small>{t("formulaLibrary.pool").replace("{count}", String(selected.size * (rotations ? 4 : 1)))}</small></span>
        </label>
        <div className="formula-library-actions">
          <button type="button" className="practice-btn practice-btn-ghost" onClick={() => setSelected(new Set(cases.map((item) => item.id)))}>{t("formulaLibrary.all")}</button>
          <button type="button" className="practice-btn practice-btn-ghost" onClick={() => setSelected(new Set())}>{t("formulaLibrary.clear")}</button>
        </div>
      </div>
      <div className="formula-library-groups">
        {groups.map(({ key, label, items }) => {
          const count = items.filter((item) => selected.has(item.id)).length;
          return (
            <section key={key} className="formula-library-group">
              <label className="formula-library-group-label">
                <input type="checkbox" checked={count === items.length}
                  ref={(node) => { if (node) node.indeterminate = count > 0 && count < items.length; }}
                  onChange={(event) => toggle(items.map((item) => item.id), event.target.checked)} />
                <b>{t(label)}</b><span>{count} / {items.length}</span>
              </label>
              <div className="formula-library-grid">
                {items.map((item) => (
                  <label key={item.id} className={`formula-library-case${selected.has(item.id) ? " is-selected" : ""}`}>
                    <input type="checkbox" checked={selected.has(item.id)} onChange={(event) => toggle([item.id], event.target.checked)} />
                    {phase === "f2l" ? (
                      <FormulaCubeImage facelets={item.facelets ?? item.algos?.[0]?.facelets ?? "X".repeat(54)} faceColors={cubeFaceColors} />
                    ) : (
                      <FormulaTopViewImage facelets={item.facelets ?? item.algos?.[0]?.facelets ?? "X".repeat(54)} faceColors={faceColors} arrows={item.arrows} />
                    )}
                    <b>{item.name}</b>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <footer className="formula-library-toolbar">
        <span role="status">{selected.size === 0 ? t("formulaLibrary.empty") : ""}</span>
        <div className="formula-library-actions">
          <button type="button" className="practice-btn practice-btn-ghost" onClick={onClose}>{t("formulaLibrary.cancel")}</button>
          <button type="button" className="practice-btn practice-btn-primary" disabled={selected.size === 0} onClick={() => onSave(cases.filter((item) => selected.has(item.id)).map((item) => item.id), rotations)}>{t("formulaLibrary.save")}</button>
        </div>
      </footer>
    </dialog>
  );
}
