"use client";
import { useLanguage } from "@/components/i18n/language-provider";
import { useEffect,useRef,type ReactNode } from "react";
import { createPortal } from "react-dom";

export const MOBILE_FORMULA_QUERY = "(width <= 1240px)";

export function FormulaPicker({ mobile, open, onClose, children }: {
  mobile: boolean;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!mobile || !open || !dialog) return;
    const overflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [mobile, open]);

  if (!mobile) return children;
  return createPortal(
    <dialog
      ref={dialogRef}
      id="fm-mobile-library"
      className="lf-tech-app fm-library-dialog"
      aria-label={t("切换公式")}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </dialog>,
    document.body,
  );
}
