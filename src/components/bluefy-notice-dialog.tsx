"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { claimBluefyNotice } from "@/lib/bluefy-notice";

export function BluefyNoticeDescription() {
  const { t } = useLanguage();
  const parts = t("connection.environment.bluefyRequired").split(/(Bluefy\s*浏览器|Bluefy browser)/g);

  return (
    <>
      {parts.map((part, index) => index === parts.length - 2 ? (
        <a
          key={index}
          className="bluefy-app-store-link"
          href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055"
          target="_blank"
          rel="noopener noreferrer"
        >
          {part}
        </a>
      ) : part)}
    </>
  );
}

export function useBluefyNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (claimBluefyNotice(navigator, window.localStorage)) setOpen(true);
      } catch {
        // Access to localStorage itself can be blocked by the browser.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return { open, close: () => setOpen(false) };
}

export function BluefyNoticeDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="system-notice-dialog bluefy-notice-dialog"
      aria-labelledby="bluefy-notice-title"
      aria-describedby="bluefy-notice-description"
      onCancel={onClose}
    >
      <header className="bluefy-notice-head">
        <h2 id="bluefy-notice-title" className="ui-section-title">{t("connection.bluefyNoticeTitle")}</h2>
        <button type="button" className="system-notice-close" aria-label={t("connection.bluefyNoticeClose")} onClick={onClose}>×</button>
      </header>
      <p id="bluefy-notice-description" className="bluefy-notice-description"><BluefyNoticeDescription /></p>
    </dialog>
  );
}
