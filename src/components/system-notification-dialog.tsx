"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useClientReady } from "@/lib/client-ready";
import settings from "@/settings.json";

const SYSTEM_NOTICE_DISMISSED_VERSION_KEY = "lifang-system-notice-dismissed-version";
const DEFAULT_CHANGELOG_ENTRY_COUNT = 2;

type SystemNotificationContextValue = {
  openSystemNotification(): void;
};

const SystemNotificationContext = createContext<SystemNotificationContextValue | null>(null);

const CHANGELOG_ENTRIES = [
  {
    version: "v0.1.3",
    changes: [
      "练习界面添加OLL，PLL公式识别",
      "新增教程界面",
      "修复调整部分公式",
      "修复无法使用邮箱进行云端同步的问题",
      "修复公式研究模式中进行旋转操作M/S/E后，面映射错误的问题。",
    ],
  },
  {
    version: "v0.1.2",
    changes: [
      "调整移动端布局",
      "调整公式-触发的内容",
      "公式界面公式面板新增交换子公式表达",
      "修复中心面旋转M, S, E识别延迟的问题",
    ],
  },
  {
    version: "v0.1.1",
    changes: [
      "调整统计界面布局",
      "微调公式界面布局与OLL筛选功能",
      "新增系统通知界面",
    ],
  },
  {
    version: "v0.1.0",
    changes: [
      "支持英文",
      "细微界面调整",
      "部分公式进行了调整",
    ],
  },
  {
    version: "v0.0.1",
    changes: [
      "初始化项目",
      "练习页、专项页、教程页、公式页、统计页",
      "支持GAN Web Bluetooth连接GAN智能魔方",
    ],
  },
] as const;

export function SystemNotificationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const clientReady = useClientReady();
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissedLocally, setDismissedLocally] = useState(false);
  let versionDismissed = false;
  if (clientReady && !dismissedLocally) {
    try {
      versionDismissed = window.localStorage.getItem(SYSTEM_NOTICE_DISMISSED_VERSION_KEY) === settings.version;
    } catch {
      versionDismissed = false;
    }
  }
  const open = pathname !== "/" && (manualOpen || (clientReady && !dismissedLocally && !versionDismissed));

  const openSystemNotification = useCallback(() => setManualOpen(true), []);
  const closeSystemNotification = useCallback(() => {
    setManualOpen(false);
    setDismissedLocally(true);
    try {
      window.localStorage.setItem(SYSTEM_NOTICE_DISMISSED_VERSION_KEY, settings.version);
    } catch {
      // localStorage can be unavailable in restricted browsing modes.
    }
  }, []);
  const value = useMemo(() => ({ openSystemNotification }), [openSystemNotification]);

  return (
    <SystemNotificationContext.Provider value={value}>
      {children}
      <SystemNotificationDialog open={open} onClose={closeSystemNotification} />
    </SystemNotificationContext.Provider>
  );
}

export function useSystemNotification() {
  const context = useContext(SystemNotificationContext);
  if (!context) throw new Error("useSystemNotification must be used within SystemNotificationProvider");
  return context;
}

type SystemNotificationDialogProps = {
  open: boolean;
  onClose(): void;
};

export function SystemNotificationDialog({ open, onClose }: SystemNotificationDialogProps) {
  const { t } = useLanguage();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [showAllChangelogEntries, setShowAllChangelogEntries] = useState(false);
  const visibleChangelogEntries = showAllChangelogEntries
    ? CHANGELOG_ENTRIES
    : CHANGELOG_ENTRIES.slice(0, DEFAULT_CHANGELOG_ENTRY_COUNT);
  const handleClose = useCallback(() => {
    setShowAllChangelogEntries(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [handleClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="system-notice-backdrop" onMouseDown={handleClose}>
      <section
        className="system-notice-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-notice-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="system-notice-head">
          <div>
            <div className="st-ch-kicker">— SYSTEM NOTICE</div>
            <h2 id="system-notice-title">{t("系统通知")}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="system-notice-close"
            aria-label={t("关闭系统通知")}
            onClick={handleClose}
          >
            ×
          </button>
        </header>

        <div className="system-notice-body">
          <section className="system-notice-changelog" aria-labelledby="system-notice-changelog-title">
            <div className="system-notice-section-head">
              <div>
                <span>CHANGE LOG</span>
                <h3 id="system-notice-changelog-title">Change log</h3>
              </div>
              <b>{settings.version}</b>
            </div>

            <div className="system-notice-timeline" id="system-notice-changelog-entries">
              {visibleChangelogEntries.map((entry) => (
                <article key={entry.version} className="system-notice-release">
                  <div className="system-notice-release-meta">
                    <strong>{t(entry.version)}</strong>
                  </div>
                  <ul>
                    {entry.changes.map((change) => <li key={change}>{t(change)}</li>)}
                  </ul>
                </article>
              ))}
            </div>

            {CHANGELOG_ENTRIES.length > DEFAULT_CHANGELOG_ENTRY_COUNT && (
              <button
                type="button"
                className="system-notice-more"
                aria-controls="system-notice-changelog-entries"
                aria-expanded={showAllChangelogEntries}
                onClick={() => setShowAllChangelogEntries((current) => !current)}
              >
                {t(showAllChangelogEntries ? "收起" : "查看更多")}
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </button>
            )}
          </section>

          <aside className="system-notice-development-note">
            <span>{t("开发期声明")}</span>
            <p>{t("本项目仍处于开发周期，版本更新时可能存在数据结构变动以及旧数据不兼容的问题，敬请谅解。")}</p>
            <p>
              {t("如有任何需求或问题，请前往")}{" "}
              <a href="https://github.com/DrMofu/lifang" target="_blank" rel="noreferrer">
                DrMofu/lifang
              </a>{" "}
              {t("提交 Issue。")}
            </p>
          </aside>
        </div>
      </section>
    </div>,
    document.body,
  );
}
