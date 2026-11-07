"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/components/language-provider";

const NOTICE_DURATION_MS = 3500;

export function useTimedNotice(message: string) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  const showNotice = useCallback((enabled = true) => {
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

  const notice = visible ? createPortal(
    <div className="gyro-power-notice" role="status">
      {message}
    </div>,
    document.body,
  ) : null;

  return { showNotice, notice };
}

export function useGyroPowerNotice() {
  const { t } = useLanguage();
  const { showNotice, notice } = useTimedNotice(t("connection.gyroPowerNotice"));
  return { notifyGyroEnabled: showNotice, gyroPowerNotice: notice };
}
