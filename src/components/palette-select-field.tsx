"use client";

import { handleSettingMenuKeyDown } from "@/components/setting-controls";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { COLOR_LIST, COLOR_PALETTES, type CubeColor, type CubeColorPaletteId } from "@/lib/cube-appearance";

const COLOR_PALETTE_OPTIONS = Object.entries(COLOR_PALETTES) as Array<
  [CubeColorPaletteId, (typeof COLOR_PALETTES)[CubeColorPaletteId]]
>;

export function PaletteSelectField({
  id,
  selected,
  onSelect,
}: {
  id: string;
  selected: CubeColorPaletteId;
  onSelect(paletteId: CubeColorPaletteId): void;
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const selectedPalette = COLOR_PALETTES[selected];

  function handleSelect(paletteId: CubeColorPaletteId) {
    onSelect(paletteId);
    setIsOpen(false);
  }

  return (
    <div
      className={`settings-palette-select-wrap${isOpen ? " open" : ""}`}
      onKeyDown={(event) => handleSettingMenuKeyDown(event, () => setIsOpen(false))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        className="settings-palette-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-menu` : undefined}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
        }}
      >
        <PaletteSwatches colors={selectedPalette.colors} />
        <span className="settings-color-select-label">{t(selectedPalette.label)}</span>
      </button>
      {isOpen && (
        <div id={`${id}-menu`} className="settings-color-menu settings-palette-menu" role="listbox" aria-labelledby={id}>
          {COLOR_PALETTE_OPTIONS.map(([paletteId, palette]) => {
            const isSelected = selected === paletteId;
            return (
              <button
                key={paletteId}
                type="button"
                className={`settings-color-option settings-palette-option${isSelected ? " selected" : ""}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(paletteId)}
              >
                <PaletteSwatches colors={palette.colors} />
                <span>{t(palette.label)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PaletteSwatches({ colors }: { colors: Record<CubeColor, string> }) {
  return (
    <span className="settings-palette-swatches" aria-hidden="true">
      {COLOR_LIST.map((color) => (
        <span key={color} style={{ background: colors[color] }}></span>
      ))}
    </span>
  );
}
