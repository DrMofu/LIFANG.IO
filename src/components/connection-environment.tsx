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

  return (
    <div className="top-connect-environment">
      <dl>
        <div><dt>{t("connection.environment.os")}</dt><dd>{environment ? environment.os || t("connection.environment.unidentified") : "—"}</dd></div>
        <div><dt>{t("connection.environment.browser")}</dt><dd>{environment ? environment.browser || t("connection.environment.unidentified") : "—"}</dd></div>
      </dl>
      <p className="top-connect-environment-status" role="status" data-status={environment?.status ?? "checking"}>
        {t(`connection.environment.${environment?.status ?? "checking"}`)}
      </p>
      <details key={environment?.status ?? "checking"} open={environment?.status === "unsupported"}>
        <summary>{t("connection.platformSupportTitle")}</summary>
        <p className="top-connect-platform-note">{t("connection.platformSupport")}</p>
      </details>
    </div>
  );
}
