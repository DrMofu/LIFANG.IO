"use client";

import { handleSettingMenuKeyDown } from "@/components/setting-controls";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { COLOR_LABEL, COLOR_LIST, type CubeColor } from "@/lib/cube-appearance";

export function ColorSelectField({
  id,
  selected,
  paletteColors,
  disabledColors,
  onSelect,
}: {
  id: string;
  selected: CubeColor;
  paletteColors: Record<CubeColor, string>;
  disabledColors?: CubeColor[];
  onSelect(color: CubeColor): void;
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  function handleSelect(color: CubeColor) {
    if (disabledColors?.includes(color)) return;
    onSelect(color);
    setIsOpen(false);
  }

  return (
    <div
      className={`settings-color-select-wrap${isOpen ? " open" : ""}`}
      onKeyDown={(event) => handleSettingMenuKeyDown(event, () => setIsOpen(false))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        className="settings-color-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-menu` : undefined}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
        }}
      >
        <span className="settings-color-select-dot" style={{ background: paletteColors[selected] }}></span>
        <span className="settings-color-select-label">{t(COLOR_LABEL[selected])}</span>
      </button>
      {isOpen && (
        <div id={`${id}-menu`} className="settings-color-menu" role="listbox" aria-labelledby={id}>
          {COLOR_LIST.map((color) => {
            const disabled = disabledColors?.includes(color) ?? false;
            const isSelected = selected === color;
            return (
              <button
                key={color}
                type="button"
                className={`settings-color-option${isSelected ? " selected" : ""}`}
                role="option"
                aria-selected={isSelected}
                disabled={disabled}
                onClick={() => handleSelect(color)}
              >
                <span className="settings-color-option-dot" style={{ background: paletteColors[color] }}></span>
                <span>{t(COLOR_LABEL[color])}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
