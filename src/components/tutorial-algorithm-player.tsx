"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCubeAppearance } from "@/components/cube-appearance-provider";
import {
  expandMoveNotation,
  invertMoveNotation,
  parseAlgorithm,
} from "@/lib/algorithms";
import { CUBE_CAMERA_PRESETS } from "@/lib/cube-camera-presets";
import { mountSmartCube, type SmartCubeApi } from "@/lib/smart-cube";

const MOVE_DURATION_MS = 520;

function waitForAnimation(api: SmartCubeApi) {
  return new Promise<void>((resolve) => {
    function check() {
      if (!api.isAnimating() && api.queueLength() === 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(check);
    }
    window.requestAnimationFrame(check);
  });
}

export function TutorialAlgorithmPlayer({
  title,
  algorithm,
  note,
}: {
  title: string;
  algorithm: string;
  note: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<SmartCubeApi | null>(null);
  const actionIdRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const moves = useMemo(() => parseAlgorithm(algorithm), [algorithm]);
  const setupMoves = useMemo(() => moves
    .slice()
    .reverse()
    .flatMap((move) => expandMoveNotation(invertMoveNotation(move))), [moves]);
  const {
    orientation,
    faceColors,
    renderMaxFps,
    backFaceProjectionEnabled,
    backFaceProjectionDistance,
  } = useCubeAppearance();

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const api = mountSmartCube(container, {
      faceColors,
      orientation,
      maxFps: renderMaxFps,
      showBackFaceProjection: backFaceProjectionEnabled,
      wheelZoomEnabled: false,
      initialMoves: setupMoves,
      initialHintMove: moves[0] ?? null,
      defaultDisplayState: {
        ...CUBE_CAMERA_PRESETS.formulas.displayState,
        cameraDistance: 6.7,
      },
      onFirstRender: () => setReady(true),
    });
    apiRef.current = api;

    return () => {
      actionIdRef.current += 1;
      api.dispose();
      if (apiRef.current === api) apiRef.current = null;
      setReady(false);
    };
  }, [
    backFaceProjectionEnabled,
    faceColors,
    moves,
    orientation,
    renderMaxFps,
    setupMoves,
  ]);

  useEffect(() => {
    apiRef.current?.setBackFaceProjectionDistance(backFaceProjectionDistance);
  }, [backFaceProjectionDistance]);

  function prepareCase(api: SmartCubeApi) {
    api.reset();
    api.applyMoves(setupMoves, 0);
    api.setHintMove(moves[0] ?? null);
    setStep(0);
  }

  function resetCase() {
    const api = apiRef.current;
    if (!api) return;
    actionIdRef.current += 1;
    setPlaying(false);
    prepareCase(api);
  }

  async function playMove(api: SmartCubeApi, move: string) {
    api.setHintMove(move);
    api.applyMoves(expandMoveNotation(move), MOVE_DURATION_MS);
    await waitForAnimation(api);
  }

  async function playAll() {
    const api = apiRef.current;
    if (!api || playing || moves.length === 0) return;
    const actionId = actionIdRef.current + 1;
    actionIdRef.current = actionId;
    let cursor = step;
    if (cursor >= moves.length) {
      prepareCase(api);
      cursor = 0;
    }
    setPlaying(true);

    while (cursor < moves.length && actionIdRef.current === actionId) {
      await playMove(api, moves[cursor]);
      if (actionIdRef.current !== actionId) return;
      cursor += 1;
      setStep(cursor);
    }

    if (actionIdRef.current === actionId) {
      api.setHintMove(null);
      setPlaying(false);
    }
  }

  async function playNext() {
    const api = apiRef.current;
    if (!api || playing || step >= moves.length) return;
    const actionId = actionIdRef.current + 1;
    actionIdRef.current = actionId;
    setPlaying(true);
    await playMove(api, moves[step]);
    if (actionIdRef.current !== actionId) return;
    const nextStep = step + 1;
    setStep(nextStep);
    api.setHintMove(moves[nextStep] ?? null);
    setPlaying(false);
  }

  function jumpTo(targetStep: number) {
    const api = apiRef.current;
    if (!api || playing) return;
    actionIdRef.current += 1;
    prepareCase(api);
    for (const move of moves.slice(0, targetStep)) {
      api.applyMoves(expandMoveNotation(move), 0);
    }
    api.setHintMove(moves[targetStep] ?? null);
    setStep(targetStep);
  }

  const status = step >= moves.length
    ? "演示完成，可以重置后再练一遍"
    : `第 ${step + 1} / ${moves.length} 步 · 下一步 ${moves[step]}`;

  return (
    <section className="tutorial-algorithm-player" aria-label={`${title}公式演示`}>
      <div className="tutorial-algorithm-visual">
        <div className="tutorial-algorithm-mount" ref={mountRef} />
        {!ready ? <span className="tutorial-algorithm-loading">正在准备 3D 演示…</span> : null}
        <button
          className="tutorial-algorithm-view-reset"
          type="button"
          onClick={() => apiRef.current?.resetDisplayOrientation()}
          disabled={!ready}
        >
          视角归位
        </button>
      </div>

      <div className="tutorial-algorithm-panel">
        <div>
          <h3>{title}</h3>
          <p>{note}</p>
        </div>
        <div className="tutorial-algorithm-tokens" aria-label={`公式 ${algorithm}`}>
          {moves.map((move, index) => (
            <button
              className={index < step ? "is-complete" : index === step ? "is-current" : ""}
              type="button"
              key={`${move}-${index}`}
              onClick={() => jumpTo(index)}
              disabled={!ready || playing}
              aria-label={`查看第 ${index + 1} 步 ${move}`}
            >
              {move}
            </button>
          ))}
        </div>
        <div className="tutorial-algorithm-status" aria-live="polite">{status}</div>
        <div className="tutorial-algorithm-actions">
          <button className="is-primary" type="button" onClick={() => void playAll()} disabled={!ready || playing}>
            {step >= moves.length ? "重新播放" : "播放公式"}
          </button>
          <button type="button" onClick={() => void playNext()} disabled={!ready || playing || step >= moves.length}>
            下一步
          </button>
          <button type="button" onClick={resetCase} disabled={!ready}>重置情形</button>
        </div>
      </div>
    </section>
  );
}
