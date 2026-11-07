"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useReducer, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  formatNoticeMessage,
  getVisibleNotification,
  INITIAL_NOTIFICATION_STATE,
  NOTICE_DURATION_MS,
  notificationReducer,
  type Notice,
  type NoticeKind,
  type NotificationAction,
} from "@/lib/notification-state";

type NotificationApi = {
  send: (action: NotificationAction) => void;
  createNotice: (owner: string, key: string, kind: NoticeKind, message: string) => Notice;
};
const NotificationContext = createContext<NotificationApi | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, send] = useReducer(notificationReducer, INITIAL_NOTIFICATION_STATE);
  const sequence = useRef(0);
  const createNotice = useCallback((owner: string, key: string, kind: NoticeKind, message: string): Notice => ({
    id: `${owner}-${++sequence.current}`, owner, key, kind, message,
  }), []);
  const api = useMemo(() => ({ send, createNotice }), [createNotice]);

  useEffect(() => {
    if (!state.notice) return;
    const id = state.notice.id;
    const timer = setTimeout(() => send({ type: "expire", id }), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [state.notice]);

  useEffect(() => {
    let blocked = false;
    const update = () => {
      const next = !!document.querySelector('dialog[open], [aria-modal="true"]');
      if (next !== blocked) {
        blocked = next;
        send({ type: "block", blocked });
      }
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "aria-modal"] });
    update();
    return () => observer.disconnect();
  }, []);

  const visible = getVisibleNotification(state);
  const pending = visible !== null && visible !== state.notice;
  return (
    <NotificationContext.Provider value={api}>
      {children}
      {visible && createPortal(
        <div key={visible.id} className={`app-notice app-notice-${visible.kind}${pending ? " app-notice-pending" : ""}`}
          role={visible.kind === "error" ? "alert" : "status"} aria-atomic="true">
          <NoticeIcon kind={visible.kind} pending={pending} />
          <span>{formatNoticeMessage(visible.message)}</span>
        </div>, document.body,
      )}
    </NotificationContext.Provider>
  );
}

function NoticeIcon({ kind, pending }: { kind: NoticeKind; pending: boolean }) {
  return (
    <svg className={pending ? "app-notice-spinner" : undefined} width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {pending ? <path d="M20 12a8 8 0 1 1-8-8" /> : kind === "success" ? (
        <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>
      ) : kind === "warning" ? (
        <><path d="m12 3 10 18H2Z" /><path d="M12 9v4m0 4h.01" /></>
      ) : (
        <><circle cx="12" cy="12" r="9" /><path d={kind === "error" ? "m9 9 6 6m0-6-6 6" : "M12 11v6m0-10h.01"} /></>
      )}
    </svg>
  );
}

export function useNotification() {
  const api = useContext(NotificationContext);
  if (!api) throw new Error("useNotification must be used within NotificationProvider");
  const owner = useId();
  const { send, createNotice } = api;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      send({ type: "dismiss", owner });
    };
  }, [owner, send]);

  return useMemo(() => ({
    notify(kind: NoticeKind, message: string, key = "default") {
      if (mounted.current) send({ type: "show", notice: createNotice(owner, key, kind, message) });
    },
    startTask(message: string, key = "default") {
      const notice = createNotice(owner, key, "info", message);
      if (mounted.current) send({ type: "start", notice });
      return notice.id;
    },
    finishTask(taskId: string, kind?: NoticeKind, message?: string) {
      if (mounted.current) send({
        type: "finish", owner, taskId,
        notice: kind && message ? createNotice(owner, taskId, kind, message) : undefined,
      });
    },
    dismiss(key?: string) { send({ type: "dismiss", owner, key }); },
  }), [owner, send, createNotice]);
}
