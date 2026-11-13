"use client";

import { useEffect, useId, useRef } from "react";
import { ColorSelectField } from "@/components/settings/color-select-field";
import { CubeColorLegend } from "@/components/cube/cube-color-legend";
import { useCubeAppearance } from "@/components/cube/cube-appearance-provider";
import { useLanguage } from "@/components/i18n/language-provider";
import { PaletteSelectField } from "@/components/settings/palette-select-field";
import { mountSmartCube } from "@/lib/cube/smart-cube";
import {
  COLOR_LIST,
  COLOR_OPPOSITE,
  COLOR_PALETTES,
  isValidOrientation,
  type CubeColor,
} from "@/lib/cube/cube-appearance";

export function TutorialOrientationSettings() {
  const id = useId();
  const { t, locale } = useLanguage();
  const {
    orientation, colorPaletteId, faceColors, setOrientation, setColorPaletteId,
    resetOrientation, resetColorPalette, backFaceProjectionDistance,
  } = useCubeAppearance();
  const previewRef = useRef<HTMLDivElement>(null);
  const paletteColors = COLOR_PALETTES[colorPaletteId].colors;

  useEffect(() => {
    if (!previewRef.current) return;
    const cube = mountSmartCube(previewRef.current, {
      faceColors,
      orientation,
      interactionLocked: true,
      wheelZoomEnabled: false,
      pinchZoomEnabled: false,
      showBackFaceProjection: true,
      backFaceProjectionDistance,
      defaultDisplayState: { cameraDistance: 8 },
    });
    return () => cube.dispose();
  }, [faceColors, orientation, backFaceProjectionDistance]);

  function handleTopChange(top: CubeColor) {
    const front = isValidOrientation(top, orientation.front)
      ? orientation.front
      : COLOR_LIST.find((color) => isValidOrientation(top, color))!;
    setOrientation({ top, front });
  }

  return (
    <div className="tutorial-orientation-settings ui-info-panel">
      <div className="tutorial-orientation-controls">
        <div>
          <div className="tutorial-orientation-palette-label">
            <label htmlFor={`${id}-palette`}>{t("settings.colorPalette")}</label>
            <button
              type="button"
              className="ui-setting-action"
              onClick={() => {
                resetOrientation();
                resetColorPalette();
              }}
            >
              {locale === "en" ? "Restore defaults" : "恢复默认"}
            </button>
          </div>
          <PaletteSelectField
            id={`${id}-palette`}
            selected={colorPaletteId}
            onSelect={setColorPaletteId}
          />
        </div>
        <div className="settings-color-select-grid">
          <div>
            <label htmlFor={`${id}-top`}>{t("settings.topFace")}</label>
            <ColorSelectField
              id={`${id}-top`}
              selected={orientation.top}
              paletteColors={paletteColors}
              onSelect={handleTopChange}
            />
          </div>
          <div>
            <label htmlFor={`${id}-front`}>{t("settings.frontFace")}</label>
            <ColorSelectField
              id={`${id}-front`}
              selected={orientation.front}
              paletteColors={paletteColors}
              disabledColors={[orientation.top, COLOR_OPPOSITE[orientation.top]]}
              onSelect={(front) => setOrientation({ top: orientation.top, front })}
            />
          </div>
        </div>
      </div>
      <div className="settings-preview tutorial-orientation-preview" role="img" aria-label={t("settings.colorPalette")}>
        <div className="cube-mount" ref={previewRef} />
      </div>
      <CubeColorLegend faceColors={faceColors} aria-label={t("settings.colorLegend")} />
    </div>
  );
}

