"use client";

import { useEffect, useState } from "react";
import { useCubeConnection } from "@/components/cube-connection-provider";
import { useLanguage } from "@/components/language-provider";
import { formatTps } from "@/lib/tps";

export function TurnSpeed() {
  const { t } = useLanguage();
  const { connectionState, getLiveTps, subscribeMove } = useCubeConnection();
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    if (connectionState !== "connected") return;
    const update = () => setSpeed(getLiveTps());
    const unsubscribe = subscribeMove(update);
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 100);
    return () => {
      unsubscribe();
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [connectionState, getLiveTps, subscribeMove]);

  return (
    <div className="turn-speed turn-speed-overlay" role="group" aria-label={t("实时转速")}>
      <span className="turn-speed-value">
        {formatTps(connectionState === "connected" ? speed : null)} <small>TPS</small>
      </span>
    </div>
  );
}
