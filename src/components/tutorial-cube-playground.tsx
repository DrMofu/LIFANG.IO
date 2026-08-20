"use client";

import { useEffect, useRef, useState } from "react";
import { FormulaKeypad } from "@/components/formula-keypad";
import { useCubeAppearance } from "@/components/cube-appearance-provider";
import { useLanguage } from "@/components/language-provider";
import { expandMoveNotation, parseMoveNotation } from "@/lib/algorithms";
import { CUBE_CAMERA_PRESETS } from "@/lib/cube-camera-presets";
import { mountSmartCube, type SmartCubeApi } from "@/lib/smart-cube";

const MOVE_DURATION_MS = 1000;
const SOLVED_HOLD_MS = 500;
const MOVED_HOLD_MS = 1500;

export function TutorialCubePlayground() {
  const cubeMountRef = useRef<HTMLDivElement | null>(null);
  const cubeApiRef = useRef<SmartCubeApi | null>(null);
  const [cubeApi, setCubeApi] = useState<SmartCubeApi | null>(null);
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const { locale } = useLanguage();
  const copy = locale === "en" ? {
    sectionLabel: "Interactive cube notation practice",
    cubeLabel: "Draggable 3D cube",
    cancel: "Stop demo",
    resetView: "Reset view",
    title: "Cube notation demo",
    idleStatus: "Select a move below to begin",
    playingStatus: (move: string) => `Looping ${move}`,
    keypadLabel: "Cube notation keypad",
    moveLabel: "Turn",
    groups: {
      face: "Face turns",
      rotate: "Cube rotations",
      wide: "Wide turns",
      slice: "Slice moves",
    },
  } : {
    sectionLabel: "交互式魔方符号练习",
    cubeLabel: "可拖动的三维魔方",
    cancel: "取消演示",
    resetView: "视角归位",
    title: "魔方公式演示",
    idleStatus: "选择下方符号开始演示",
    playingStatus: (move: string) => `正在循环演示 ${move}`,
    keypadLabel: "魔方公式键盘",
    moveLabel: "转动",
    groups: {
      face: "面转动",
      rotate: "整体旋转",
      wide: "宽层转动",
      slice: "中层转动",
    },
  };
  const {
    orientation,
    faceColors,
    renderMaxFps,
    backFaceProjectionEnabled,
    backFaceProjectionDistance,
  } = useCubeAppearance();

  useEffect(() => {
    const container = cubeMountRef.current;
    if (!container) return;

    const api = mountSmartCube(container, {
      faceColors,
      orientation,
      maxFps: renderMaxFps,
      showBackFaceProjection: backFaceProjectionEnabled,
      backFaceProjectionDistance,
      defaultDisplayState: CUBE_CAMERA_PRESETS.formulas.displayState,
      wheelZoomEnabled: false,
    });
    cubeApiRef.current = api;
    setCubeApi(api);

    return () => {
      api.dispose();
      if (cubeApiRef.current === api) cubeApiRef.current = null;
      setCubeApi((current) => current === api ? null : current);
    };
  }, [
    backFaceProjectionEnabled,
    faceColors,
    orientation,
    renderMaxFps,
  ]);

  useEffect(() => {
    cubeApiRef.current?.setBackFaceProjectionDistance(backFaceProjectionDistance);
  }, [backFaceProjectionDistance]);

  useEffect(() => {
    if (!cubeApi) return;
    const api = cubeApi;

    let timerId: number | null = null;
    let cancelled = false;
    const expandedMove = selectedMove ? expandMoveNotation(selectedMove) : [];

    function clearTimer() {
      if (timerId === null) return;
      window.clearTimeout(timerId);
      timerId = null;
    }

    function schedule(delayMs: number, callback: () => void) {
      clearTimer();
      timerId = window.setTimeout(() => {
        timerId = null;
        if (!cancelled) callback();
      }, delayMs);
    }

    function playCycle() {
      if (document.visibilityState !== "visible" || expandedMove.length === 0) return;
      api.reset();
      schedule(SOLVED_HOLD_MS, () => {
        api.applyMoves(expandedMove, MOVE_DURATION_MS);
        schedule(MOVE_DURATION_MS + MOVED_HOLD_MS, playCycle);
      });
    }

    function handleVisibilityChange() {
      clearTimer();
      if (document.visibilityState === "visible") playCycle();
    }

    api.reset();
    api.setHintMove(selectedMove);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    playCycle();

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cubeApi, selectedMove]);

  function selectMove(move: string) {
    const parsed = parseMoveNotation(move);
    if (!parsed) return;
    setSelectedMove((current) => current === parsed.notation ? null : parsed.notation);
  }

  return (
    <section className="tutorial-cube-widget" aria-label={copy.sectionLabel}>
      <div className="tutorial-cube-stage" aria-label={copy.cubeLabel}>
        <div className="tutorial-cube-mount" ref={cubeMountRef} />
        <div className="tutorial-cube-stage-actions">
          {selectedMove ? (
            <button className="is-cancel" type="button" onClick={() => setSelectedMove(null)}>
              {copy.cancel}
            </button>
          ) : null}
          <button type="button" onClick={() => cubeApiRef.current?.resetDisplayOrientation()}>
            {copy.resetView}
          </button>
        </div>
      </div>

      <div className="tutorial-cube-controls">
        <div className="tutorial-cube-controls-title" role="heading" aria-level={2}>
          {copy.title}
        </div>
        <div className="tutorial-cube-controls-status" aria-live="polite">
          {selectedMove ? copy.playingStatus(selectedMove) : copy.idleStatus}
        </div>
        <FormulaKeypad
          ariaLabel={copy.keypadLabel}
          groupLabels={copy.groups}
          moveLabel={copy.moveLabel}
          selectedMove={selectedMove}
          showEditControls={false}
          onMove={selectMove}
        />
      </div>
    </section>
  );
}
