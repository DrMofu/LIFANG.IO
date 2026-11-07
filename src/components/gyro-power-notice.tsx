"use client";

import { useCallback } from "react";
import { useLanguage } from "@/components/language-provider";
import { useNotification } from "@/components/notification-provider";

export function useGyroPowerNotice() {
  const { t } = useLanguage();
  const { notify, dismiss } = useNotification();
  const notifyGyroEnabled = useCallback((enabled: boolean) => {
    if (enabled) notify("warning", t("connection.gyroPowerNotice"), "gyro-power");
    else dismiss("gyro-power");
  }, [notify, dismiss, t]);
  return { notifyGyroEnabled };
}
