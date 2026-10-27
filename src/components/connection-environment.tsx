"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { detectClientEnvironment, type ClientEnvironment } from "@/lib/client-environment";

export function ConnectionEnvironment() {
  const { t } = useLanguage();
  const [environment, setEnvironment] = useState<ClientEnvironment | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void detectClientEnvironment().then((value) => {
        if (active) setEnvironment(value);
      });
    };
    refresh();
    navigator.bluetooth?.addEventListener("availabilitychanged", refresh);
    return () => {
      active = false;
      navigator.bluetooth?.removeEventListener("availabilitychanged", refresh);
    };
  }, []);

  const status = environment?.status ?? "checking";
  const needsAttention = environment !== null && status !== "supported";

  return (
    <div className="top-connect-environment" data-status={status}>
      <p className="top-connect-environment-status" role="status">
        <span className="top-connect-environment-icon" aria-hidden="true">
          {status === "checking" ? <span className="dot dot-pulse" /> : (
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {status === "supported" ? <path d="m5 10 3 3 7-7" /> : <path d="M10 5v6m0 4h.01" />}
            </svg>
          )}
        </span>
        <span>{t(`connection.environment.${status}`)}</span>
      </p>
      {environment && (
        <details key={status} open={needsAttention}>
          <summary>
            <span className="top-connect-environment-device">
              <span aria-label={t("connection.environment.os")}>{environment.os || t("connection.environment.unidentified")}</span>
              <span className="top-connect-environment-divider" aria-hidden="true" />
              <span aria-label={t("connection.environment.browser")}>{environment.browser || t("connection.environment.unidentified")}</span>
            </span>
            <svg className="top-connect-environment-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 6 3 3 3-3" />
            </svg>
          </summary>
          <p className="top-connect-platform-note">{t("connection.platformSupport")}</p>
        </details>
      )}
    </div>
  );
}
