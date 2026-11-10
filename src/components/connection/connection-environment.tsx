"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { BluefyNoticeDescription } from "@/components/connection/bluefy-notice-dialog";
import { detectClientEnvironment, type ClientEnvironment } from "@/lib/connection/client-environment";

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

  const needsBluefy = environment !== null
    && (environment.os === "iOS" || environment.os === "iPadOS")
    && !/^Bluefy\b/i.test(environment.browser);
  const status = needsBluefy ? "unsupported" : environment?.status ?? "checking";

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
        <span>{needsBluefy ? <BluefyNoticeDescription /> : t(`connection.environment.${status}`)}</span>
      </p>
      {environment && (
        <div className="top-connect-environment-device">
          <span aria-label={t("connection.environment.os")}>{environment.os || t("connection.environment.unidentified")}</span>
          <span className="top-connect-environment-divider" aria-hidden="true" />
          <span aria-label={t("connection.environment.browser")}>{environment.browser || t("connection.environment.unidentified")}</span>
        </div>
      )}
    </div>
  );
}
