"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import banner from "../../public/banner.png";
import { AppFooter, CompactConnectButton, LanguageToggleButton, NavIcon } from "@/components/shell/app-shell";
import { useCubeAppearance } from "@/components/cube/cube-appearance-provider";
import { useCubeConnection, type CubeVisualState } from "@/components/connection/cube-connection-provider";
import { useLanguage } from "@/components/i18n/language-provider";
import type { MessageKey } from "@/lib/i18n/i18n-messages";
import { expandMoveNotation } from "@/lib/cube/algorithms";
import { type SmartCubeApi, mountSmartCube } from "@/lib/cube/smart-cube";

const HOME_NAV: Array<{ href: string; labelKey: MessageKey; icon: string; index: string }> = [
  { href: "/practice", labelKey: "nav.practice", icon: "practice", index: "01" },
  { href: "/formulas", labelKey: "nav.formulas", icon: "cube", index: "02" },
  { href: "/articles", labelKey: "nav.tutorials", icon: "tutorials", index: "03" },
  { href: "/stats", labelKey: "nav.stats", icon: "stats", index: "04" },
  { href: "/settings", labelKey: "nav.settings", icon: "settings", index: "05" },
];

export function HomeLandingApp() {
  const { t } = useLanguage();
  const cubeMountRef = useRef<HTMLDivElement | null>(null);
  const cubeApiRef = useRef<SmartCubeApi | null>(null);
  const lastAppliedFaceletsRef = useRef<string | null>(null);
  const hasRealtimeMovesRef = useRef(false);
  const {
    facelets,
    visualState,
    subscribeMove,
    subscribeFacelets,
  } = useCubeConnection();
  const { orientation, faceColors, renderMaxFps, backFaceProjectionEnabled, backFaceProjectionDistance } = useCubeAppearance();
  const visualStateRef = useRef<CubeVisualState>(visualState);
  const faceletsRef = useRef<string | null>(facelets);

  useEffect(() => {
    visualStateRef.current = visualState;
    faceletsRef.current = facelets;
  }, [facelets, visualState]);

  const restoreVisualCubeState = useCallback((api: SmartCubeApi) => {
    const visualStateSnapshot = visualStateRef.current;
    const baseFacelets = visualStateSnapshot.baseFacelets ?? faceletsRef.current;
    if (!baseFacelets || !api.setFacelets(baseFacelets)) return;

    lastAppliedFaceletsRef.current = baseFacelets;
    const restoredMoves = visualStateSnapshot.baseFacelets ? visualStateSnapshot.moves : [];
    const expandedMoves = restoredMoves.flatMap((move) => expandMoveNotation(move.move));
    if (expandedMoves.length > 0) api.applyMoves(expandedMoves, 0);
  }, []);

  const getInitialProjectionDistance = useEffectEvent(() => backFaceProjectionDistance);

  useEffect(() => {
    if (!cubeMountRef.current) return;
    const api = mountSmartCube(cubeMountRef.current, {
      faceColors,
      orientation,
      maxFps: renderMaxFps,
      showBackFaceProjection: backFaceProjectionEnabled,
      backFaceProjectionDistance: getInitialProjectionDistance(),
      initialDisplayState: {
        cameraDistance: 9,
        cameraLatitude: 23,
        cameraLongitude: 35,
      },
      autoRotateDegPerSecond: 4,
    });
    cubeApiRef.current = api;
    restoreVisualCubeState(api);

    return () => {
      api.dispose();
      if (cubeApiRef.current === api) cubeApiRef.current = null;
    };
  }, [backFaceProjectionEnabled, faceColors, orientation, renderMaxFps, restoreVisualCubeState]);

  useEffect(() => {
    cubeApiRef.current?.setBackFaceProjectionDistance(backFaceProjectionDistance);
  }, [backFaceProjectionDistance]);

  useEffect(() => {
    if (!facelets || facelets === lastAppliedFaceletsRef.current || hasRealtimeMovesRef.current) return;
    if (cubeApiRef.current?.setFacelets(facelets)) {
      lastAppliedFaceletsRef.current = facelets;
    }
  }, [facelets]);

  useEffect(() => subscribeMove((move) => {
    hasRealtimeMovesRef.current = true;
    const expandedMoves = expandMoveNotation(move);
    expandedMoves.forEach((turn) => {
      cubeApiRef.current?.applyMove(turn.layer, turn.dir, 180);
    });
  }), [subscribeMove]);

  useEffect(() => subscribeFacelets((nextFacelets) => {
    if (hasRealtimeMovesRef.current && cubeApiRef.current?.isAnimating()) {
      lastAppliedFaceletsRef.current = nextFacelets;
      return;
    }
    if (cubeApiRef.current?.setFacelets(nextFacelets)) {
      lastAppliedFaceletsRef.current = nextFacelets;
      hasRealtimeMovesRef.current = false;
    }
  }), [subscribeFacelets]);

  return (
    <div className="app lf-home-app">
      <main className="home-main">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-copy">
            <h1 id="home-title">
              <Image className="home-banner" src={banner} alt={t("brand.name")} sizes="(max-width: 760px) 100vw, 510px" preload />
            </h1>
            <nav className="home-nav topnav" aria-label={t("home.navigation")}>
              {HOME_NAV.map((item) => (
                <Link key={item.href} className="navitem" href={item.href}>
                  <NavIcon name={item.icon} />
                  <span>{t(item.labelKey)}</span>
                  <small>{item.index}</small>
                </Link>
              ))}
            </nav>
            <div className="home-actions">
              <CompactConnectButton tooltipAnchorSelector=".home-cube-stage" />
              <LanguageToggleButton />
            </div>
          </div>

          <div className="home-cube-stage" aria-label={t("home.smartCube")}>
            <div className="home-cube-mount" ref={cubeMountRef} />
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
