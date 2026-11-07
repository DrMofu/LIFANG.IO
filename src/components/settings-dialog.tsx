"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/components/language-provider";

type DialogOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  inputLabel?: string;
  initialValue?: string;
  danger?: boolean;
};

export function useSettingsDialog() {
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const pending = useRef<((value: string | null) => void) | null>(null);
  const completed = useRef<{ resolve: (value: string | null) => void; value: string | null } | null>(null);
  const request = useCallback((next: DialogOptions) => new Promise<string | null>((resolve) => {
    pending.current?.(null);
    pending.current = resolve;
    setOptions(next);
  }), []);
  const finish = useCallback((value: string | null) => {
    if (pending.current) completed.current = { resolve: pending.current, value };
    pending.current = null;
    setOptions(null);
  }, []);
  // Resume the operation after the modal has left the DOM, so its result can be announced.
  useEffect(() => {
    if (options || !completed.current) return;
    const result = completed.current;
    completed.current = null;
    result.resolve(result.value);
  }, [options]);
  useEffect(() => () => {
    pending.current?.(null);
    completed.current?.resolve(null);
  }, []);
  return {
    request,
    dialog: options ? <SettingsDialog options={options} onFinish={finish} /> : null,
  };
}

function SettingsDialog({ options, onFinish }: { options: DialogOptions; onFinish: (value: string | null) => void }) {
  const { t } = useLanguage();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(options.initialValue ?? "");
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(
    <dialog ref={ref} className="ui-settings-dialog" aria-labelledby={`${id}-title`} aria-describedby={options.message ? `${id}-message` : undefined}
      onCancel={(event) => { event.preventDefault(); onFinish(null); }}>
      <form onSubmit={(event) => { event.preventDefault(); if (!options.inputLabel || name.trim()) onFinish(name.trim()); }}>
        <h2 id={`${id}-title`} className="ui-section-title">{options.title}</h2>
        {options.message && <p id={`${id}-message`}>{options.message}</p>}
        {options.inputLabel && <label className="settings-auth-field"><span>{options.inputLabel}</span>
          <input value={name} maxLength={80} required onChange={(event) => setName(event.target.value)} />
        </label>}
        <div className="ui-setting-actions">
          <button type="button" className="ui-setting-action" onClick={() => onFinish(null)}>{t("取消")}</button>
          <button type="submit" className={`ui-setting-action ${options.danger ? "ui-setting-action-danger" : "ui-setting-action-primary"}`}
            disabled={!!options.inputLabel && !name.trim()}>{options.confirmLabel}</button>
        </div>
      </form>
    </dialog>, document.body,
  );
}
