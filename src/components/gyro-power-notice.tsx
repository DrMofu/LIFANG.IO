"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/components/language-provider";

const NOTICE_DURATION_MS = 3500;

export function useGyroPowerNotice() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  const notifyGyroEnabled = useCallback((enabled: boolean) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(enabled);
    if (enabled) {
      timerRef.current = setTimeout(() => {
        setVisible(false);
        timerRef.current = null;
      }, NOTICE_DURATION_MS);
    }
  }, []);

  const gyroPowerNotice = visible ? createPortal(
    <div className="gyro-power-notice" role="status">
      {t("connection.gyroPowerNotice")}
    </div>,
    document.body,
  ) : null;

  return { notifyGyroEnabled, gyroPowerNotice };
}
