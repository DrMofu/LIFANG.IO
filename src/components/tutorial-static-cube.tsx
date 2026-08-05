"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CubeOrientation } from "@/lib/cube-appearance";
import { CUBE_CAMERA_PRESETS } from "@/lib/cube-camera-presets";
import { mountSmartCube, type CubeFace, type SmartCubeApi } from "@/lib/smart-cube";

type TutorialStaticCubeProps = {
  faceColors: Record<CubeFace, string>;
  orientation: CubeOrientation;
  formulaFacelets?: string;
  hintMove?: string;
  transparentFormulaFacelets?: boolean;
  cameraDistance?: number;
  className?: string;
  sizes?: string;
};

const FACE_ORDER: CubeFace[] = ["U", "R", "F", "D", "L", "B"];
const SNAPSHOT_CACHE_LIMIT = 160;
const snapshotCache = new Map<string, string>();
let snapshotQueue: Promise<void> = Promise.resolve();

function enqueueSnapshot(job: () => Promise<void>) {
  const pending = snapshotQueue.then(job, job);
  snapshotQueue = pending.catch(() => undefined);
  return pending;
}

function cacheSnapshot(key: string, dataUrl: string) {
  snapshotCache.set(key, dataUrl);
  if (snapshotCache.size <= SNAPSHOT_CACHE_LIMIT) return;
  const oldestKey = snapshotCache.keys().next().value;
  if (oldestKey) snapshotCache.delete(oldestKey);
}

function snapshotKey({
  faceColors,
  orientation,
  formulaFacelets,
  hintMove,
  transparentFormulaFacelets,
  cameraDistance,
}: TutorialStaticCubeProps) {
  const colors = FACE_ORDER.map((face) => faceColors[face]).join("|");
  return [
    hintMove ?? "",
    formulaFacelets ?? "",
    transparentFormulaFacelets ? "transparent" : "solid",
    String(cameraDistance ?? CUBE_CAMERA_PRESETS.formulas.displayState.cameraDistance),
    orientation.top,
    orientation.front,
    colors,
  ].join("|");
}

export function TutorialStaticCube(props: TutorialStaticCubeProps) {
  const {
    faceColors,
    orientation,
    formulaFacelets,
    hintMove,
    transparentFormulaFacelets = false,
    cameraDistance = CUBE_CAMERA_PRESETS.formulas.displayState.cameraDistance,
    className,
    sizes = "240px",
  } = props;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const key = snapshotKey(props);
  const [renderedSnapshot, setRenderedSnapshot] = useState<{ key: string; src: string } | null>(null);
  const snapshot = renderedSnapshot?.key === key
    ? renderedSnapshot.src
    : snapshotCache.get(key) ?? null;

  useEffect(() => {
    if (snapshotCache.has(key)) return;

    let cancelled = false;
    let api: SmartCubeApi | null = null;
    let finishJob: (() => void) | null = null;

    function releaseRenderer() {
      const mountedApi = api;
      api = null;
      mountedApi?.dispose();
      finishJob?.();
      finishJob = null;
    }

    void enqueueSnapshot(async () => {
      const container = mountRef.current;
      if (cancelled || !container?.isConnected) return;
      const queuedSnapshot = snapshotCache.get(key);
      if (queuedSnapshot) {
        setRenderedSnapshot({ key, src: queuedSnapshot });
        return;
      }

      await new Promise<void>((resolve) => {
        finishJob = resolve;
        try {
          api = mountSmartCube(container, {
            faceColors,
            orientation,
            interactionLocked: true,
            wheelZoomEnabled: false,
            animateHintArrow: false,
            initialHintMove: hintMove,
            initialFormulaFacelets: formulaFacelets,
            transparentFormulaFacelets,
            maxFps: null,
            defaultDisplayState: {
              ...CUBE_CAMERA_PRESETS.formulas.displayState,
              cameraDistance,
            },
            onFirstRender(canvas) {
              const dataUrl = canvas.toDataURL("image/png");
              cacheSnapshot(key, dataUrl);
              if (!cancelled) setRenderedSnapshot({ key, src: dataUrl });
              queueMicrotask(releaseRenderer);
            },
          });
        } catch {
          releaseRenderer();
        }
      });
    });

    return () => {
      cancelled = true;
      releaseRenderer();
    };
  }, [
    faceColors,
    cameraDistance,
    formulaFacelets,
    hintMove,
    key,
    orientation,
    transparentFormulaFacelets,
  ]);

  return (
    <div className={`tutorial-static-cube${className ? ` ${className}` : ""}`} aria-hidden="true">
      <div className={`tutorial-static-cube-mount${snapshot ? " is-hidden" : ""}`} ref={mountRef} />
      {snapshot ? (
        <Image
          className="tutorial-static-cube-snapshot"
          src={snapshot}
          alt=""
          fill
          sizes={sizes}
          unoptimized
          draggable={false}
        />
      ) : null}
    </div>
  );
}
