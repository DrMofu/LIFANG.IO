"use client";

import { useSyncExternalStore } from "react";

type DeviceNavigator = Pick<Navigator, "userAgent" | "maxTouchPoints"> & {
  platform?: string;
  userAgentData?: { mobile?: boolean };
};

export function shouldShowKeyboardHints(device: DeviceNavigator) {
  const handheld = device.userAgentData?.mobile
    || /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|PlayBook/i.test(device.userAgent);
  const desktopModeIPad = (/Macintosh/i.test(device.userAgent) || device.platform === "MacIntel")
    && device.maxTouchPoints > 1;
  return !handheld && !desktopModeIPad;
}

const subscribe = () => () => undefined;
const getClientSnapshot = () => shouldShowKeyboardHints(navigator);
const getServerSnapshot = () => false;

export function useKeyboardHints() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
