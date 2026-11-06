"use client";

import { type InputHTMLAttributes, type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { useLanguage } from "@/components/language-provider";

export function SettingToggle({ label, hint, checked, onChange, disabled, shortcut }: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  shortcut?: string;
}) {
  const hintId = useId();
  return (
    <label className="ui-setting-row ui-toggle-row">
      <span className="ui-setting-copy"><span>{label}</span>{hint && <small id={hintId}>{hint}</small>}</span>
      <input className="ui-setting-switch" type="checkbox" role="switch" checked={checked} disabled={disabled}
        aria-label={label} aria-describedby={hint ? hintId : undefined} aria-keyshortcuts={shortcut}
        onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function SettingNumber({ value, onCommit, min, max, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur" | "onKeyDown" | "type" | "min" | "max"> & {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const { t } = useLanguage();
  const errorId = useId();
  const [edit, setEdit] = useState({ source: value, text: String(value) });
  const [validated, setValidated] = useState(false);
  const text = edit.source === value ? edit.text : String(value);
  const number = Number(text);
  const valid = text.trim() !== "" && Number.isInteger(number) && number >= min && number <= max;
  const error = validated && !valid;
  return (
    <span className="ui-number-field">
      <input {...props} type="number" inputMode="numeric" min={min} max={max} step={1} value={text}
        aria-invalid={error || undefined} aria-describedby={error ? errorId : props["aria-describedby"]}
        onChange={(event) => { setEdit({ source: value, text: event.target.value }); setValidated(false); }}
        onBlur={() => { setValidated(true); if (valid && number !== value) onCommit(number); }}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} />
      {error && <small id={errorId} role="alert">{t("请输入范围内的整数")} ({min}–{max})</small>}
    </span>
  );
}

export function SettingChoice({ label, children }: { label: string; children: ReactNode }) {
  return <div className="ui-setting-choice"><span className="ui-setting-label">{label}</span>{children}</div>;
}

export function handleSettingMenuKeyDown(event: KeyboardEvent<HTMLElement>, close: () => void) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();
    return;
  }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)'));
  if (!options.length) return;
  event.preventDefault();
  const index = options.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
    : event.key === "ArrowDown" ? (index + 1) % options.length : (index <= 0 ? options.length : index) - 1;
  options[next]?.focus();
}
