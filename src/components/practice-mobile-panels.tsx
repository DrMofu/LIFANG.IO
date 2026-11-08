"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";

export function PracticeMobileDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLanguage();
  useEffect(() => {
    const dialog = ref.current;
    const focus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (focus instanceof HTMLElement) focus.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="daily-result-dialog practice-mobile-dialog ui-info-panel" aria-label={title}
      onCancel={onClose} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <header className="practice-card-head">
        <h2 className="ui-section-title">{title}</h2>
        <button type="button" className="practice-btn practice-btn-ghost practice-dialog-close" aria-label={t("关闭")} onClick={onClose}>×</button>
      </header>
      {children}
    </dialog>
  );
}

export function PracticeSettingsButton({ onClick, disabled, expanded, label = "练习设置" }: { onClick: () => void; disabled?: boolean; expanded: boolean; label?: string }) {
  const { t } = useLanguage();
  return (
<button type="button" className="practice-btn practice-btn-ghost practice-mobile-gear" aria-label={t(label)}
                aria-haspopup="dialog" aria-expanded={expanded} disabled={disabled}
                onClick={onClick}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9.5 3-.5 2-2 .9-1.9-.6-2.5 4.3 1.5 1.4v2l-1.5 1.4 2.5 4.3 1.9-.6 2 .9.5 2h5l.5-2 2-.9 1.9.6 2.5-4.3-1.5-1.4v-2l1.5-1.4-2.5-4.3-1.9.6-2-.9-.5-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
  );
}

export function PracticeMobilePanels({ panels, overlay, disabled, onChange }: {
  panels: ReactNode[];
  overlay?: ReactNode;
  disabled?: boolean;
  onChange?: () => void;
}) {
  const { t } = useLanguage();
  const hasOverlay = Boolean(overlay);
  const [page, setPage] = useState({ index: 0, previous: null as number | null, direction: null as "left" | "right" | null, hasOverlay });
  const startRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  if (page.hasOverlay !== hasOverlay) {
    setPage({ ...page, hasOverlay, previous: null, direction: null });
  }
  const index = Math.min(page.index, panels.length - 1);
  const changePage = (direction: "left" | "right") => {
    onChange?.();
    setPage({ ...page, index: (index + (direction === "right" ? 1 : panels.length - 1)) % panels.length, previous: index, direction });
  };
  return (
    <section className="practice-mobile-panels" aria-label={t("练习信息")} aria-roledescription="carousel"
      data-direction={overlay ? undefined : page.direction ?? undefined} tabIndex={0} inert={disabled}
      onKeyDown={(event) => {
        if (overlay || event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        changePage(event.key === "ArrowLeft" ? "right" : "left");
      }}
      onPointerDown={(event) => {
        if (overlay || !event.isPrimary || event.button !== 0) return;
        swipedRef.current = false;
        startRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        const start = startRef.current;
        if (overlay || !start || start.id !== event.pointerId) return;
        const dx = Math.abs(event.clientX - start.x);
        const dy = Math.abs(event.clientY - start.y);
        if (dx > 12 && dx > dy * 1.5) event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        const start = startRef.current;
        startRef.current = null;
        if (overlay || !start || start.id !== event.pointerId) return;
        const dx = Math.abs(event.clientX - start.x);
        const dy = Math.abs(event.clientY - start.y);
        if (dx < 40 || dx <= dy * 1.5) return;
        swipedRef.current = true;
        changePage(event.clientX > start.x ? "right" : "left");
      }}
      onPointerCancel={() => { startRef.current = null; }}
      onClickCapture={(event) => {
        if (!swipedRef.current || event.detail === 0) return;
        event.preventDefault();
        event.stopPropagation();
      }}>
      {panels.map((panel, i) => (
        <div key={i} className="practice-mobile-slide" data-exiting={page.previous === i || undefined}
          inert={!!overlay || index !== i} aria-hidden={!!overlay || index !== i}>
          {panel}
        </div>
      ))}
      {overlay && <div className="practice-mobile-scramble">{overlay}</div>}
    </section>
  );
}
