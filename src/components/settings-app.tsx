"use client";

import { handleSettingMenuKeyDown, SettingNumber, SettingToggle } from "@/components/setting-controls";
import { useSettingsDialog } from "@/components/settings-dialog";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AppFooter, AppTopbar } from "@/components/app-shell";
import { PaletteSelectField } from "@/components/palette-select-field";
import { ColorSelectField } from "@/components/color-select-field";
import { TurnSpeed } from "@/components/turn-speed";
import { CubeColorLegend } from "@/components/cube-color-legend";
import { useCubeAppearance } from "@/components/cube-appearance-provider";
import { useLanguage } from "@/components/language-provider";
import { useSystemNotification } from "@/components/system-notification-dialog";
import type { MessageKey } from "@/lib/i18n-messages";
import {
  COLOR_LIST,
  COLOR_OPPOSITE,
  COLOR_PALETTES,
  MAX_BACK_FACE_PROJECTION_DISTANCE,
  MIN_BACK_FACE_PROJECTION_DISTANCE,
  isValidOrientation,
  type CubeRenderMaxFps,
  type CubeColor,
} from "@/lib/cube-appearance";
import { mountSmartCube, type SmartCubeApi } from "@/lib/smart-cube";
import {
  STATISTICS_ARCHIVE_CHANGE_EVENT,
  createStatisticsArchive,
  DEFAULT_STATISTICS_ARCHIVE_ID,
  deleteStatisticsArchive,
  getActiveStatisticsArchive,
  loadDailyLevels,
  loadDailyPracticeSeconds,
  loadSolveHistory,
  loadStatisticsArchives,
  renameStatisticsArchive,
  saveDailyLevels,
  saveDailyPracticeSeconds,
  saveSolveHistory,
  setActiveStatisticsArchive,
  subscribeStatisticsArchiveChange,
  type DailyLevelEntry,
  type DailyPracticeEntry,
  type SolveHistoryEntry,
  type StatisticsArchive,
} from "@/lib/solve-history";
import {
  AVERAGE_TIME_METHOD_LABELS,
  DEFAULT_AVERAGE_TIME_SETTINGS,
  loadAverageTimeSettings,
  saveAverageTimeSettings,
  type AverageTimeMethod,
  type AverageTimeSettings,
} from "@/lib/average-time";
import {
  DEFAULT_CONSOLE_LOGGING_SETTINGS,
  loadConsoleLoggingSettings,
  saveConsoleLoggingSettings,
  type ConsoleLoggingSettingKey,
  type ConsoleLoggingSettings,
} from "@/lib/console-logging";
import {
  DEFAULT_PRACTICE_INSPECTION_SECONDS,
  DEFAULT_PRACTICE_INSPECTION_SETTINGS,
  MAX_PRACTICE_INSPECTION_SECONDS,
  MIN_PRACTICE_INSPECTION_SECONDS,
  loadPracticeInspectionSettings,
  normalizePracticeInspectionSettings,
  savePracticeInspectionSettings,
  type PracticeInspectionMode,
  type PracticeInspectionSettings,
} from "@/lib/practice-inspection";
import {
  loadCloudSnapshot,
  loadCloudSnapshotMetadata,
  saveCloudSnapshot,
  type CloudSnapshotMetadata,
} from "@/lib/cloud-sync";
import {
  applyUserDataImport,
  buildUserDataExportPayload,
  cleanupDeprecatedFormulaLocalStorage,
  getLocalUserDataPackageUpdatedAt,
  getPayloadTimestamp,
  hasFormulaExportData,
  isNewerTimestamp,
  parseUserDataImport,
  readFormulaExportData,
  touchLocalUserDataPackageUpdatedAt,
  type ParsedUserDataImport,
  type UserDataExportPayload,
} from "@/lib/user-data-package";

type StatusKind = "info" | "success" | "error";
type StatusMessage = { kind: StatusKind; text: string; scope?: "archive" | "cloud" | "debug" };

const CONSOLE_LOGGING_OPTIONS: Array<{
  key: Exclude<ConsoleLoggingSettingKey, "enabled">;
  label: string;
  hint: string;
}> = [
  { key: "logSentCommands", label: "发送命令", hint: "REQUEST_HARDWARE / BATTERY / FACELETS 等设备命令" },
  { key: "logMove", label: "MOVE", hint: "真实魔方转动事件，含方向、序号和时间戳" },
  { key: "logGyro", label: "GYRO", hint: "陀螺仪四元数与角速度，高频数据" },
  { key: "logFacelets", label: "FACELETS", hint: "完整魔方状态和 Kociemba facelets 字符串" },
  { key: "logBattery", label: "BATTERY", hint: "电量回报事件" },
  { key: "logHardware", label: "HARDWARE", hint: "硬件型号、固件版本、生产日期" },
  { key: "logDisconnect", label: "DISCONNECT", hint: "蓝牙断开事件" },
];

const RENDER_FPS_OPTIONS: Array<{ value: CubeRenderMaxFps; labelKey: MessageKey }> = [
  { value: null, labelKey: "settings.fps.unlimited" },
  { value: 120, labelKey: "settings.fps.120" },
  { value: 60, labelKey: "settings.fps.60" },
  { value: 30, labelKey: "settings.fps.30" },
];

const CLOUD_SNAPSHOT_AUTO_REFRESH_TTL_MS = 5 * 60 * 1000;

let recentCloudSnapshotMetadata: { userId: string; metadata: CloudSnapshotMetadata | null; fetchedAt: number } | null = null;

function emitArchiveDataChange() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(STATISTICS_ARCHIVE_CHANGE_EVENT));
  }, 0);
}

function getRecentCloudSnapshotMetadata(userId: string) {
  if (!recentCloudSnapshotMetadata || recentCloudSnapshotMetadata.userId !== userId) return null;
  if (Date.now() - recentCloudSnapshotMetadata.fetchedAt >= CLOUD_SNAPSHOT_AUTO_REFRESH_TTL_MS) return null;
  return { metadata: recentCloudSnapshotMetadata.metadata };
}

function rememberCloudSnapshotMetadata(userId: string, metadata: CloudSnapshotMetadata | null) {
  recentCloudSnapshotMetadata = { userId, metadata, fetchedAt: Date.now() };
}

export function SettingsApp() {
  const { locale, setLocale, t } = useLanguage();
  const { request: requestDialog, dialog: settingsDialog } = useSettingsDialog();
  const { openSystemNotification } = useSystemNotification();
  const { configured: authConfigured, loading: authLoading, user, supabase } = useAuth();
  const {
    orientation,
    colorPaletteId,
    faceColors,
    renderMaxFps,
    tpsEnabled,
    setTpsEnabled,
    backFaceProjectionEnabled,
    backFaceProjectionDistance,
    setOrientation,
    setColorPaletteId,
    setRenderMaxFps,
    setBackFaceProjectionEnabled,
    setBackFaceProjectionDistance,
  } = useCubeAppearance();
  const [history, setHistory] = useState<SolveHistoryEntry[]>([]);
  const [dailyLevels, setDailyLevels] = useState<DailyLevelEntry[]>([]);
  const [dailyPractice, setDailyPractice] = useState<DailyPracticeEntry[]>([]);
  const [hasFormulaData, setHasFormulaData] = useState(false);
  const [statisticsArchives, setStatisticsArchives] = useState<StatisticsArchive[]>([]);
  const [activeStatisticsArchive, setActiveStatisticsArchiveState] = useState<StatisticsArchive | null>(null);
  const [averageSettings, setAverageSettings] = useState<AverageTimeSettings>(DEFAULT_AVERAGE_TIME_SETTINGS);
  const [inspectionSettings, setInspectionSettings] = useState<PracticeInspectionSettings>(
    DEFAULT_PRACTICE_INSPECTION_SETTINGS,
  );
  const [consoleLoggingSettings, setConsoleLoggingSettings] = useState<ConsoleLoggingSettings>(
    DEFAULT_CONSOLE_LOGGING_SETTINGS,
  );
  const [showDebugSettings, setShowDebugSettings] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authCodeSent, setAuthCodeSent] = useState(false);
  const [authActionPending, setAuthActionPending] = useState(false);
  const [authStatusMessage, setAuthStatusMessage] = useState<StatusMessage | null>(null);
  const [cloudSnapshotMetadata, setCloudSnapshotMetadata] = useState<CloudSnapshotMetadata | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudActionPending, setCloudActionPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cubeMountRef = useRef<HTMLDivElement | null>(null);
  const cubeApiRef = useRef<SmartCubeApi | null>(null);
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function refreshArchiveData() {
      setStatisticsArchives(loadStatisticsArchives());
      setActiveStatisticsArchiveState(getActiveStatisticsArchive());
      setHistory(loadSolveHistory());
      setDailyLevels(loadDailyLevels());
      setDailyPractice(loadDailyPracticeSeconds());
      setHasFormulaData(hasFormulaExportData(readFormulaExportData()));
      setAverageSettings(loadAverageTimeSettings());
      setInspectionSettings(loadPracticeInspectionSettings());
      setConsoleLoggingSettings(loadConsoleLoggingSettings());
    }

    refreshArchiveData();
    return subscribeStatisticsArchiveChange(refreshArchiveData);
  }, []);

  useEffect(() => {
    if (!cubeMountRef.current) return;
    cubeApiRef.current = mountSmartCube(cubeMountRef.current, {
      faceColors,
      orientation,
      maxFps: renderMaxFps,
      showBackFaceProjection: backFaceProjectionEnabled,
      interactionLocked: true,
      wheelZoomEnabled: false,
      pinchZoomEnabled: false,
    });
    return () => {
      const api = cubeApiRef.current;
      api?.dispose();
      if (cubeApiRef.current === api) cubeApiRef.current = null;
    };
  }, [backFaceProjectionEnabled, faceColors, orientation, renderMaxFps]);

  useEffect(() => {
    cubeApiRef.current?.setBackFaceProjectionDistance(backFaceProjectionDistance);
  }, [backFaceProjectionDistance]);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const authResult = url.searchParams.get("auth");
    if (authResult !== "success" && authResult !== "error") return;

    const timer = window.setTimeout(() => {
      setAuthStatusMessage(authResult === "success"
        ? { kind: "success", text: t("已登录，可以同步云端数据。") }
        : { kind: "error", text: t("登录链接无效或已过期，请重新发送验证码。") });
    }, 0);
    url.searchParams.delete("auth");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    return () => window.clearTimeout(timer);
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!supabase || !user) {
        setCloudSnapshotMetadata(null);
        setCloudLoading(false);
        return;
      }

      const recentMetadata = getRecentCloudSnapshotMetadata(user.id);
      if (recentMetadata !== null) {
        setCloudSnapshotMetadata(recentMetadata.metadata);
        setCloudLoading(false);
        return;
      }

      setCloudLoading(true);
      try {
        const metadata = await loadCloudSnapshotMetadata(supabase);
        if (cancelled) return;
        rememberCloudSnapshotMetadata(user.id, metadata);
        setCloudSnapshotMetadata(metadata);
      } catch {
        if (!cancelled) flashStatus("error", t("读取云端数据失败。"), "cloud");
      } finally {
        if (!cancelled) setCloudLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, user, t]);

  function flashStatus(kind: StatusKind, text: string, scope: "archive" | "cloud" | "debug" = "archive") {
    setStatusMessage({ kind, text, scope });
    if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      statusTimerRef.current = null;
    }, 4000);
  }

  function buildCurrentUserDataPayload() {
    return buildUserDataExportPayload({
      activeArchiveId,
      activeArchiveName,
      history,
      dailyLevels,
      dailyPractice,
      orientation,
      colorPaletteId,
      renderMaxFps,
      tpsEnabled,
      backFaceProjectionEnabled,
      backFaceProjectionDistance,
      averageSettings,
      inspectionSettings,
      consoleLoggingSettings,
    });
  }

  function getCloudSnapshotTimestamp(snapshot: CloudSnapshotMetadata) {
    return (
      getPayloadTimestamp(null, snapshot.clientUpdatedAt) ??
      getPayloadTimestamp(null, snapshot.updatedAt)
    );
  }

  function getLocalPackageTimestamp(payload: UserDataExportPayload) {
    return getLocalUserDataPackageUpdatedAt() ?? getPayloadTimestamp(payload);
  }

  function applyImportedUserData(imported: ParsedUserDataImport) {
    const applied = applyUserDataImport(imported);
    setHistory(applied.history);
    setDailyLevels(applied.dailyLevels);
    setDailyPractice(applied.dailyPractice);
    setHasFormulaData(applied.hasFormulaData);
    setTpsEnabled(imported.preferences.appearance.tpsEnabled);
    setOrientation(imported.preferences.appearance.orientation);
    setColorPaletteId(imported.preferences.appearance.palette);
    setRenderMaxFps(imported.preferences.appearance.fps);
    setBackFaceProjectionEnabled(imported.preferences.appearance.backFaceProjection);
    setBackFaceProjectionDistance(imported.preferences.appearance.backFaceProjectionDistance);
    setAverageSettings(applied.averageSettings);
    setInspectionSettings(applied.inspectionSettings);
    setConsoleLoggingSettings(applied.consoleLoggingSettings);
    emitArchiveDataChange();
  }

  function handleTopChange(top: CubeColor) {
    let { front } = orientation;
    if (!isValidOrientation(top, front)) {
      front = COLOR_LIST.find((color) => isValidOrientation(top, color)) ?? "green";
    }
    setOrientation({ top, front });
  }

  function handleFrontChange(front: CubeColor) {
    if (!isValidOrientation(orientation.top, front)) return;
    setOrientation({ top: orientation.top, front });
  }

  async function sendAuthCode() {
    const email = authEmail.trim();
    if (!supabase || !email || authActionPending) return;
    setAuthActionPending(true);
    setAuthStatusMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setAuthCodeSent(true);
      const successMessage = t("验证码已发送，请查看邮箱。若未在收件箱中找到验证码，请检查垃圾邮件。");
      setAuthStatusMessage({ kind: "success", text: successMessage });
      flashStatus("success", successMessage, "cloud");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("请稍后重试。");
      setAuthStatusMessage({ kind: "error", text: t(`发送验证码失败：${message}`) });
      flashStatus("error", t(`发送验证码失败：${message}`), "cloud");
    } finally {
      setAuthActionPending(false);
    }
  }

  async function verifyAuthCode() {
    const email = authEmail.trim();
    const token = authCode.trim();
    if (!supabase || !email || !token || authActionPending) return;
    setAuthActionPending(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) throw error;
      setAuthCode("");
      setAuthCodeSent(false);
      setAuthStatusMessage({ kind: "success", text: t("已登录，可以同步云端数据。") });
      flashStatus("success", t("已登录，可以同步云端数据。"), "cloud");
    } catch {
      setAuthStatusMessage({ kind: "error", text: t("验证码无效或已过期。") });
      flashStatus("error", t("验证码无效或已过期。"), "cloud");
    } finally {
      setAuthActionPending(false);
    }
  }

  async function signOutCloudAccount() {
    if (!supabase || authActionPending) return;
    setAuthActionPending(true);
    try {
      await supabase.auth.signOut();
      setCloudSnapshotMetadata(null);
      setAuthStatusMessage(null);
      flashStatus("success", t("已退出登录，本地数据仍保留。"), "cloud");
    } catch {
      flashStatus("error", t("退出失败，请稍后重试。"), "cloud");
    } finally {
      setAuthActionPending(false);
    }
  }

  async function refreshCloudSnapshot() {
    if (!supabase || !user || cloudActionPending) return;
    setCloudLoading(true);
    try {
      const metadata = await loadCloudSnapshotMetadata(supabase);
      rememberCloudSnapshotMetadata(user.id, metadata);
      setCloudSnapshotMetadata(metadata);
      flashStatus("success", t("已刷新云端状态。"), "cloud");
    } catch {
      flashStatus("error", t("读取云端数据失败。"), "cloud");
    } finally {
      setCloudLoading(false);
    }
  }

  async function uploadToCloud() {
    if (!supabase || !user || cloudActionPending) return;
    setCloudActionPending(true);
    try {
      const snapshot = await loadCloudSnapshot(supabase);
      const currentPayload = buildCurrentUserDataPayload();
      if (snapshot) {
        const cloudData = parseUserDataImport(snapshot.payload);
        if (!cloudData) throw new Error("Invalid cloud data package");
        const cloudCount = cloudData.history.length;
        const localCount = currentPayload.practice.history.length;
        if (cloudCount > localCount) {
          const confirmed = (await requestDialog({
            title: t("上传到云端"),
            message: t("cloud.confirmOverwriteMoreSolves")
              .replace("{cloudCount}", String(cloudCount))
              .replace("{localCount}", String(localCount)),
            confirmLabel: t("上传到云端"),
            danger: true,
          })) !== null;
          if (!confirmed) return;
        }
      }
      const clientUpdatedAt = touchLocalUserDataPackageUpdatedAt() ?? new Date().toISOString();
      const payload = buildCurrentUserDataPayload();
      await saveCloudSnapshot({ supabase, userId: user.id, payload, clientUpdatedAt });
      const metadata = await loadCloudSnapshotMetadata(supabase);
      rememberCloudSnapshotMetadata(user.id, metadata);
      setCloudSnapshotMetadata(metadata);
      flashStatus("success", t("已上传当前存档到云端。"), "cloud");
    } catch {
      flashStatus("error", t("上传失败，请检查网络后重试。"), "cloud");
    } finally {
      setCloudActionPending(false);
    }
  }

  async function downloadFromCloud() {
    if (!supabase || !user || cloudActionPending) return;
    setCloudActionPending(true);
    try {
      const snapshot = await loadCloudSnapshot(supabase);
      if (!snapshot) {
        rememberCloudSnapshotMetadata(user.id, null);
        setCloudSnapshotMetadata(null);
        flashStatus("info", t("云端还没有可恢复的数据。"), "cloud");
        return;
      }
      const metadata: CloudSnapshotMetadata = {
        payloadVersion: snapshot.payloadVersion,
        clientUpdatedAt: snapshot.clientUpdatedAt,
        updatedAt: snapshot.updatedAt,
      };
      rememberCloudSnapshotMetadata(user.id, metadata);
      setCloudSnapshotMetadata(metadata);
      const imported = parseUserDataImport(snapshot.payload);
      if (!imported) {
        flashStatus("error", t("云端数据格式异常，未覆盖本地数据。"), "cloud");
        return;
      }
      const cloudTimestamp = getCloudSnapshotTimestamp(snapshot);
      const localPayload = buildCurrentUserDataPayload();
      const localTimestamp = getLocalPackageTimestamp(localPayload);
      const confirmMessage = isNewerTimestamp(localTimestamp, cloudTimestamp)
        ? t("本地数据包更新时间晚于云端。继续恢复会覆盖较新的本地数据。是否继续？")
        : t(`将以云端数据覆盖${activeArchiveName}中的练习数据、公式数据和设置偏好。是否继续？`);
      const confirmed = (await requestDialog({ title: t("从云端恢复"), message: `${t("当前存档")}: ${activeArchiveName}\n${confirmMessage}`, confirmLabel: t("从云端恢复"), danger: true })) !== null;
      if (!confirmed) return;
      applyImportedUserData(imported);
      touchLocalUserDataPackageUpdatedAt(cloudTimestamp ?? getPayloadTimestamp(snapshot.payload) ?? new Date());
      flashStatus("success", t(`已从云端恢复到${activeArchiveName}。`), "cloud");
    } catch {
      flashStatus("error", t("恢复失败，请稍后重试。"), "cloud");
    } finally {
      setCloudActionPending(false);
    }
  }

  function exportHistory() {
    const formulas = readFormulaExportData();
    if (history.length === 0 && dailyLevels.length === 0 && dailyPractice.length === 0 && !hasFormulaExportData(formulas)) return;
    const payload: UserDataExportPayload = buildCurrentUserDataPayload();
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cube-user-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    flashStatus("success", t(`已导出${activeArchiveName}的用户数据包。`));
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  function handleArchiveChange(archiveId: string) {
    const nextArchive = setActiveStatisticsArchive(archiveId);
    setActiveStatisticsArchiveState(nextArchive);
    setStatisticsArchives(loadStatisticsArchives());
    setHistory(loadSolveHistory());
    setDailyLevels(loadDailyLevels());
    setDailyPractice(loadDailyPracticeSeconds());
    setHasFormulaData(hasFormulaExportData(readFormulaExportData()));
    flashStatus("info", t(`已切换到${nextArchive.name}。`));
  }

  async function handleCreateArchive() {
    const name = await requestDialog({ title: t("创建新存档"), inputLabel: t("存档名称"), confirmLabel: t("创建新存档") });
    if (!name) return;
    const archive = renameStatisticsArchive(createStatisticsArchive().id, name);
    setActiveStatisticsArchiveState(archive);
    setStatisticsArchives(loadStatisticsArchives());
    setHistory(loadSolveHistory());
    setDailyLevels(loadDailyLevels());
    setDailyPractice(loadDailyPracticeSeconds());
    setHasFormulaData(hasFormulaExportData(readFormulaExportData()));
    flashStatus("success", t(`已创建并切换到${archive.name}。`));
  }

  async function handleRenameArchive() {
    const nextName = await requestDialog({ title: t("重命名存档"), inputLabel: t("存档名称"), initialValue: activeArchiveName, confirmLabel: t("保存") });
    if (!nextName || nextName === activeArchiveName) return;
    const archive = renameStatisticsArchive(activeArchiveId, nextName);
    setActiveStatisticsArchiveState(archive);
    setStatisticsArchives(loadStatisticsArchives());
    flashStatus("success", t(`已重命名为${archive.name}。`));
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = parseUserDataImport(parsed);
      if (!imported) {
        flashStatus("error", t("文件格式不对，应为 v3 用户数据导出 JSON。"));
        return;
      }
      const importedHasFormulaData = hasFormulaExportData(imported.formulas);
      if (imported.history.length === 0 && imported.dailyLevels.length === 0 && imported.dailyPractice.length === 0 && !importedHasFormulaData) {
        flashStatus("error", t("文件中没有可识别的记录。"));
        return;
      }
      const confirmed = (await requestDialog({ title: t("导入到当前存档"), message: `${file.name}\n${t(`将以文件中的用户数据覆盖${activeArchiveName}中的练习数据、公式数据和设置偏好。是否继续？`)}`, confirmLabel: t("导入到当前存档"), danger: true })) !== null;
      if (!confirmed) return;
      applyImportedUserData(imported);
      touchLocalUserDataPackageUpdatedAt(getPayloadTimestamp(parsed as UserDataExportPayload) ?? new Date());
      flashStatus("success", t(`已导入用户数据包到${activeArchiveName}。`));
    } catch {
      flashStatus("error", t("解析失败：不是有效的 JSON 文件。"));
    }
  }

  async function clearLocalStatisticsData() {
    if (history.length === 0 && dailyLevels.length === 0 && dailyPractice.length === 0) return;
    const confirmed = (await requestDialog({ title: t("清空当前存档"), message: t(`确定要清空${activeArchiveName}的 ${history.length} 条复原记录、${dailyLevels.length} 天水平测试和 ${dailyPractice.length} 天练习时长？此操作无法撤销。`), confirmLabel: t("清空当前存档"), danger: true })) !== null;
    if (!confirmed) return;
    saveSolveHistory([]);
    saveDailyLevels([]);
    saveDailyPracticeSeconds([]);
    setHistory([]);
    setDailyLevels([]);
    setDailyPractice([]);
    touchLocalUserDataPackageUpdatedAt();
    flashStatus("success", t(`已清空${activeArchiveName}的统计数据。`));
  }

  async function deleteCurrentStatisticsArchive() {
    if (activeArchiveId === DEFAULT_STATISTICS_ARCHIVE_ID) return;
    const confirmed = (await requestDialog({ title: t("删除当前存档"), message: t(`确定要删除${activeArchiveName}？此操作会删除该存档内的统计数据，无法撤销。`), confirmLabel: t("删除当前存档"), danger: true })) !== null;
    if (!confirmed) return;
    const nextArchive = deleteStatisticsArchive(activeArchiveId);
    setActiveStatisticsArchiveState(nextArchive);
    setStatisticsArchives(loadStatisticsArchives());
    setHistory(loadSolveHistory());
    setDailyLevels(loadDailyLevels());
    setDailyPractice(loadDailyPracticeSeconds());
    setHasFormulaData(hasFormulaExportData(readFormulaExportData()));
    flashStatus("success", t(`已删除${activeArchiveName}，并切换到${nextArchive.name}。`));
  }

  function handleArchiveDangerAction() {
    if (activeArchiveId === DEFAULT_STATISTICS_ARCHIVE_ID) {
      clearLocalStatisticsData();
      return;
    }
    deleteCurrentStatisticsArchive();
  }

  function updateAverageSettings(nextSettings: AverageTimeSettings) {
    setAverageSettings(nextSettings);
    saveAverageTimeSettings(nextSettings);
    touchLocalUserDataPackageUpdatedAt();
  }

  function handleAverageMethodChange(method: AverageTimeMethod) {
    updateAverageSettings({ ...averageSettings, method });
  }

  function handleAverageNumberChange(field: keyof Pick<AverageTimeSettings, "sampleSize" | "trimBest" | "trimWorst">, value: string) {
    const parsed = Number(value);
    const fallback = DEFAULT_AVERAGE_TIME_SETTINGS[field];
    const nextValue = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
    const max = field === "sampleSize" ? 100 : 20;
    const nextSettings = {
      ...averageSettings,
      [field]: field === "sampleSize" ? Math.min(max, Math.max(1, nextValue)) : Math.min(max, nextValue),
    };
    updateAverageSettings(nextSettings);
  }

  function updateInspectionSettings(nextSettings: PracticeInspectionSettings) {
    const normalized = normalizePracticeInspectionSettings(nextSettings);
    setInspectionSettings(normalized);
    savePracticeInspectionSettings(normalized);
    touchLocalUserDataPackageUpdatedAt();
  }

  function handleInspectionModeChange(mode: PracticeInspectionMode) {
    updateInspectionSettings({ ...inspectionSettings, mode });
  }

  function handleInspectionSecondsChange(value: string) {
    const parsed = Number(value);
    updateInspectionSettings({
      ...inspectionSettings,
      seconds: Number.isFinite(parsed) ? parsed : DEFAULT_PRACTICE_INSPECTION_SECONDS,
    });
  }

  function updateConsoleLoggingSettings(nextSettings: ConsoleLoggingSettings) {
    setConsoleLoggingSettings(nextSettings);
    saveConsoleLoggingSettings(nextSettings);
    touchLocalUserDataPackageUpdatedAt();
  }

  function handleConsoleLoggingChange(key: ConsoleLoggingSettingKey, checked: boolean) {
    updateConsoleLoggingSettings({ ...consoleLoggingSettings, [key]: checked });
  }

  async function cleanupDeprecatedFormulaData() {
    const confirmed = await requestDialog({ title: t("清理弃用数据"), message: t("删除收藏、学习状态、练习统计和页面状态中已不在公式 JSON 里的公式数据。"), confirmLabel: t("清理弃用数据"), danger: true });
    if (confirmed === null) return;
    const result = cleanupDeprecatedFormulaLocalStorage();
    const removed = result.favorites + result.learning + result.stats + result.state;
    setHasFormulaData(hasFormulaExportData(readFormulaExportData()));
    if (removed > 0) {
      touchLocalUserDataPackageUpdatedAt();
      emitArchiveDataChange();
      flashStatus("success", t(`已清理 ${removed} 条弃用公式数据。`), "debug");
      return;
    }
    flashStatus("info", t("没有发现需要清理的弃用公式数据。"), "debug");
  }

  const activeArchiveName = t(activeStatisticsArchive?.name ?? "默认存档");
  const activeArchiveId = activeStatisticsArchive?.id ?? "default";
  const userEmail = user?.email ?? "";
  const cloudUpdatedLabel = cloudLoading
    ? t("读取中")
    : cloudSnapshotMetadata
      ? new Date(getCloudSnapshotTimestamp(cloudSnapshotMetadata) ?? cloudSnapshotMetadata.updatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { hour12: false })
      : t("暂无云端数据");
  const localUpdatedAt = getLocalUserDataPackageUpdatedAt();
  const localUpdatedLabel = localUpdatedAt
    ? new Date(localUpdatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { hour12: false })
    : t("尚未记录");
  const cloudBusy = cloudLoading || cloudActionPending || authLoading;
  const cloudFeedback = statusMessage?.scope === "cloud";
  return (
    <div className="app lf-stats-app lf-settings-app">
      <AppTopbar />

      <main className="settings-main">
        <section className="settings-card ui-info-panel settings-card-appearance">
          <div className="ui-section-head settings-card-head">
            <div className="ui-section-title-line">
              <div className="ui-section-title">{t("settings.display.title")}</div>
              <div className="ui-section-kicker">APPEARANCE</div>
            </div>
            <CubeColorLegend faceColors={faceColors} className="settings-color-legend" aria-label={t("settings.colorLegend")} />
          </div>
          <div className="settings-card-body settings-card-body-appearance">
            <div className="settings-controls">
              <div className="settings-row">
                <label className="settings-row-label" htmlFor="settings-color-palette">{t("settings.colorPalette")}</label>
                <PaletteSelectField
                  id="settings-color-palette"
                  selected={colorPaletteId}
                  onSelect={setColorPaletteId}
                />
              </div>
              <div className="settings-color-select-grid">
                <div className="settings-row">
                  <label className="settings-row-label" htmlFor="settings-top-color">{t("settings.topFace")}</label>
                  <ColorSelectField
                    id="settings-top-color"
                    selected={orientation.top}
                    paletteColors={COLOR_PALETTES[colorPaletteId].colors}
                    onSelect={handleTopChange}
                  />
                </div>
                <div className="settings-row">
                  <label className="settings-row-label" htmlFor="settings-front-color">{t("settings.frontFace")}</label>
                  <ColorSelectField
                    id="settings-front-color"
                    selected={orientation.front}
                    disabledColors={[orientation.top, COLOR_OPPOSITE[orientation.top]]}
                    paletteColors={COLOR_PALETTES[colorPaletteId].colors}
                    onSelect={handleFrontChange}
                  />
                </div>
              </div>
              <SettingToggle label={t("settings.showTps")} checked={tpsEnabled} onChange={setTpsEnabled} />
              <div className="settings-projection-box">
                <SettingToggle label={t("settings.backProjection")} checked={backFaceProjectionEnabled} onChange={setBackFaceProjectionEnabled} />
                <label className="settings-projection-distance">
                  <b>{t("settings.projectionDistance")}</b>
                  <input
                    type="range"
                    min={MIN_BACK_FACE_PROJECTION_DISTANCE}
                    max={MAX_BACK_FACE_PROJECTION_DISTANCE}
                    step="0.05"
                    value={backFaceProjectionDistance}
                    disabled={!backFaceProjectionEnabled}
                    aria-label={t("settings.backProjectionDistance")}
                    onInput={(event) => setBackFaceProjectionDistance(Number(event.currentTarget.value))}
                    onChange={(event) => setBackFaceProjectionDistance(Number(event.target.value))}
                  />
                  <output>{backFaceProjectionDistance.toFixed(2)}</output>
                </label>
              </div>
            </div>
            <div className="settings-preview">
              <div className="cube-mount" ref={cubeMountRef}></div>
              <TurnSpeed preview />
            </div>
          </div>
        </section>

        <section className="settings-card ui-info-panel settings-card-other">
          <div className="ui-section-head settings-card-head">
            <div className="ui-section-title-line">
              <div className="ui-section-title">{t("settings.other.title")}</div>
              <div className="ui-section-kicker">SETTINGS</div>
            </div>
          </div>
          <div className="settings-card-body settings-card-body-other">
            <div className="settings-setting-group">
              <div className="settings-inline-select-row">
                <div className="settings-setting-title">{t("settings.language.label")}</div>
                <div role="group" className="ui-setting-segments" aria-label={t("settings.language.aria")}>
                  <button
                    type="button"
                    aria-pressed={locale === "zh"} className={`ui-setting-segment${locale === "zh" ? " active" : ""}`}
                    onClick={() => setLocale("zh")}
                  >
                    {t("settings.language.zh")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={locale === "en"} className={`ui-setting-segment${locale === "en" ? " active" : ""}`}
                    onClick={() => setLocale("en")}
                  >
                    {t("settings.language.en")}
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-setting-group">
              <div className="settings-inline-select-row">
                <div className="settings-setting-title">{t("settings.renderFps")}</div>
                <div role="group" className="ui-setting-segments settings-render-fps-segmented" aria-label={t("settings.renderFpsAria")}>
                  {RENDER_FPS_OPTIONS.map((option) => (
                    <button
                      key={option.labelKey}
                      type="button"
                      aria-pressed={renderMaxFps === option.value} className={`ui-setting-segment${renderMaxFps === option.value ? " active" : ""}`}
                      onClick={() => setRenderMaxFps(option.value)}
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="settings-setting-group">
              <div className="settings-inline-select-row">
                <div className="settings-setting-title">{t("settings.inspection")}</div>
                <div className="settings-inspection-inline-controls">
                  <div role="group" className="ui-setting-segments settings-inspection-mode-segmented" aria-label={t("settings.inspectionMode")}>
                    {(["unlimited", "timed"] as PracticeInspectionMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={inspectionSettings.mode === mode} className={`ui-setting-segment${inspectionSettings.mode === mode ? " active" : ""}`}
                        onClick={() => handleInspectionModeChange(mode)}
                      >
                        {mode === "unlimited" ? t("settings.inspectionUnlimited") : t("settings.inspectionTimed")}
                      </button>
                    ))}
                  </div>
                  <div className="settings-inspection-seconds-control">
                    <SettingNumber className="settings-inspection-seconds-input" min={MIN_PRACTICE_INSPECTION_SECONDS} max={MAX_PRACTICE_INSPECTION_SECONDS} value={inspectionSettings.seconds} disabled={inspectionSettings.mode === "unlimited"} aria-label={t("settings.inspectionSeconds")} onCommit={(value) => handleInspectionSecondsChange(String(value))} />
                    <span aria-hidden="true">s</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-setting-group">
              <div className="settings-inline-select-row">
                <div className="settings-setting-title">{t("settings.stableDefinition")}</div>
                <div role="group" className="ui-setting-segments settings-average-method-segmented" aria-label={t("settings.stableDefinitionAria")}>
                  {(Object.keys(AVERAGE_TIME_METHOD_LABELS) as AverageTimeMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      aria-pressed={averageSettings.method === method} className={`ui-setting-segment${averageSettings.method === method ? " active" : ""}`}
                      onClick={() => handleAverageMethodChange(method)}
                    >
                      {t(AVERAGE_TIME_METHOD_LABELS[method])}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-number-grid">
                <label className="settings-number-field">
                  <span>{t("settings.recentCount")}</span>
                  <SettingNumber min={1} max={100} value={averageSettings.sampleSize} aria-label={t("settings.recentCount")} onCommit={(value) => handleAverageNumberChange("sampleSize", String(value))} />
                </label>
                {averageSettings.method === "trimmed" && (
                  <>
                    <label className="settings-number-field">
                      <span>{t("settings.trimBest")}</span>
                      <SettingNumber min={0} max={20} value={averageSettings.trimBest} aria-label={t("settings.trimBest")} onCommit={(value) => handleAverageNumberChange("trimBest", String(value))} />
                    </label>
                    <label className="settings-number-field">
                      <span>{t("settings.trimWorst")}</span>
                      <SettingNumber min={0} max={20} value={averageSettings.trimWorst} aria-label={t("settings.trimWorst")} onCommit={(value) => handleAverageNumberChange("trimWorst", String(value))} />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="settings-card ui-info-panel settings-card-cloud">
          <div className="ui-section-head settings-card-head">
            <div className="ui-section-title-line">
              <div className="ui-section-title">{t("云端同步")}</div>
              <div className="ui-section-kicker">CLOUD</div>
            </div>
          </div>
          <div className="settings-card-body settings-card-body-cloud" aria-busy={cloudBusy}>
            {cloudActionPending && <div className="settings-status settings-status-info" role="status">{t("处理中")}</div>}
            {cloudFeedback && statusMessage && <div className={`settings-status settings-status-${statusMessage.kind}`} role="status">{statusMessage.text}</div>}
            {!authConfigured ? (
              <div className="settings-data-note">{t("云端同步暂不可用，本地数据不受影响。")}</div>
            ) : user ? (
              <>
                <div className="settings-cloud-account">
                  <span>{t("当前账号")}</span>
                  <b title={userEmail}>{userEmail}</b>
                </div>
                <div className="settings-cloud-metrics">
                  <div>
                    <span>{t("云端更新时间")}</span>
                    <b>{cloudUpdatedLabel}</b>
                  </div>
                  <div>
                    <span>{t("本地记录时间")}</span>
                    <b>{localUpdatedLabel}</b>
                  </div>
                  <div>
                    <span>{t("当前存档")}</span>
                    <b>{activeArchiveName}</b>
                  </div>
                </div>
                <div className="settings-cloud-actions">
                  <button type="button" className="ui-setting-action ui-setting-action-primary" onClick={uploadToCloud} disabled={cloudBusy}>{t("上传到云端")}</button>
                  <button
                    type="button"
                    className="ui-setting-action"
                    onClick={downloadFromCloud}
                    disabled={cloudBusy || !cloudSnapshotMetadata}
                  >{t("从云端恢复")}</button>
                  <button type="button" className="ui-setting-action" onClick={refreshCloudSnapshot} disabled={cloudBusy}>{t("刷新状态")}</button>
                  <button type="button" className="ui-setting-action" onClick={signOutCloudAccount} disabled={authActionPending}>{t("退出登录")}</button>
                </div>
              </>
            ) : (
              <>
                <label className="settings-auth-field">
                  <span>{t("邮箱")}</span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="name@example.com"
                    disabled={authActionPending || authLoading}
                  />
                </label>
                {authCodeSent && (
                  <label className="settings-auth-field">
                    <span>{t("验证码")}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={authCode}
                      onChange={(event) => setAuthCode(event.target.value)}
                      placeholder={t("8 位验证码")}
                      disabled={authActionPending}
                    />
                  </label>
                )}
                <div className="settings-cloud-actions">
                  <button type="button" className="ui-setting-action ui-setting-action-primary" onClick={sendAuthCode} disabled={!authEmail.trim() || authActionPending || authLoading}>
                    {authCodeSent ? t("重新发送验证码") : t("发送验证码")}
                  </button>
                  {authCodeSent && <button type="button" className="ui-setting-action ui-setting-action-primary" onClick={verifyAuthCode} disabled={!authCode.trim() || authActionPending}>{authActionPending ? t("处理中") : t("登录")}</button>}
                </div>
                {authStatusMessage && !cloudFeedback && (
                  <div className={`settings-status settings-status-${authStatusMessage.kind}`} role="status">
                    {authStatusMessage.text}
                  </div>
                )}
                <div className="settings-data-note">{t("登录后可将本地数据上传到云端或从云端恢复。")}</div>
              </>
            )}
          </div>
        </section>

        <section className="settings-card ui-info-panel settings-card-archive">
          <div className="ui-section-head settings-card-head">
            <div className="ui-section-title-line">
              <div className="ui-section-title">{t("存档管理")}</div>
              <div className="ui-section-kicker">ARCHIVE</div>
            </div>
            <div className="settings-archive-metrics" aria-label={t("当前存档统计")}>
              <span>{history.length}{" "}{t("条复原")}</span>
              <span>{dailyLevels.length}{" "}{t("天测试")}</span>
            </div>
          </div>
          <div className="settings-card-body settings-card-body-data">
            <div className="settings-archive-controls">
              <div className="settings-archive-select-field">
                <label htmlFor="settings-statistics-archive">{t("当前存档")}</label>
                <ArchiveSelectField
                  id="settings-statistics-archive"
                  archives={statisticsArchives}
                  selected={activeArchiveId}
                  onSelect={handleArchiveChange}
                />
              </div>
              <button type="button" className="ui-setting-action" onClick={handleCreateArchive}>{t("创建新存档")}</button>
              <button type="button" className="ui-setting-action" onClick={handleRenameArchive}>{t("重命名存档")}</button>

            </div>
            <div className="settings-data-actions">
              <button
                type="button"
                className="ui-setting-action"
                onClick={exportHistory}
                disabled={history.length === 0 && dailyLevels.length === 0 && dailyPractice.length === 0 && !hasFormulaData}
              >{t("导出当前存档")}</button>
              <button type="button" className="ui-setting-action" onClick={triggerImport}>{t("导入到当前存档")}</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={handleImportFile}
              />
            </div>
            <div className="ui-setting-actions ui-setting-divider settings-danger-actions">
              <button
                type="button"
                className="ui-setting-action ui-setting-action-danger"
                onClick={handleArchiveDangerAction}
                disabled={activeArchiveId === DEFAULT_STATISTICS_ARCHIVE_ID && history.length === 0 && dailyLevels.length === 0 && dailyPractice.length === 0}
              >
                {activeArchiveId === DEFAULT_STATISTICS_ARCHIVE_ID ? t("清空当前存档") : t("删除当前存档")}
              </button>
            </div>
            {statusMessage?.scope === "archive" && <div className={`settings-status settings-status-${statusMessage.kind}`} role="status">{statusMessage.text}</div>}
          </div>
        </section>

        <div className="settings-debug-block">
          {showDebugSettings && (
            <>
              <section className="settings-card ui-info-panel settings-card-console">
                <div className="ui-section-head settings-card-head">
                  <div className="ui-section-title-line">
                    <div className="ui-section-title">{t("Console 打印管理")}</div>
                    <div className="ui-section-kicker">CONSOLE</div>
                  </div>
                  <div className="settings-current">{consoleLoggingSettings.enabled ? "ON" : "OFF"}</div>
                </div>
                <div className="settings-card-body settings-card-body-console">
                  <SettingToggle label={t("开启 Console 打印")} hint={t("打印内容进入浏览器 DevTools Console；默认关闭。")} checked={consoleLoggingSettings.enabled} onChange={(checked) => handleConsoleLoggingChange("enabled", checked)} />

                  <div className="settings-toggle-grid" aria-label={t("Console 打印类别")}>
                    {CONSOLE_LOGGING_OPTIONS.map((option) => (
                      <label key={option.key} className="settings-toggle-row">
                        <input
                          type="checkbox"
                          checked={consoleLoggingSettings[option.key]}
                          disabled={!consoleLoggingSettings.enabled}
                          onChange={(event) => handleConsoleLoggingChange(option.key, event.target.checked)}
                        />
                        <span className="settings-toggle-copy">
                          <b>{t(option.label)}</b>
                          <small>{t(option.hint)}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              <section className="settings-card ui-info-panel settings-card-console settings-card-debug-tools">
                <div className="ui-section-head settings-card-head">
                  <div className="ui-section-title-line">
                    <div className="ui-section-title">{t("Debug 管理")}</div>
                    <div className="ui-section-kicker">DEBUG</div>
                  </div>
                </div>
                <div className="settings-card-body settings-card-body-console">
                  {statusMessage?.scope === "debug" && <div className={`settings-status settings-status-${statusMessage.kind}`} role="status">{statusMessage.text}</div>}
                  <div className="settings-debug-actions">
                    <div className="settings-debug-action-item">
                      <button type="button" className="ui-setting-action" onClick={cleanupDeprecatedFormulaData}>{t("清理弃用数据")}</button>
                      <div className="settings-data-note">{t("删除收藏、学习状态、练习统计和页面状态中已不在公式 JSON 里的公式数据。")}</div>
                    </div>
                    <div className="settings-debug-action-item">
                      <button
                        type="button"
                        className="ui-setting-action"
                        aria-haspopup="dialog"
                        onClick={openSystemNotification}
                      >
                        {t("打开系统通知")}
                      </button>
                      <div className="settings-data-note">{t("预览向用户展示的系统提示和版本更新内容。")}</div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          <div className="settings-debug-row">
            <button
              type="button"
              className={`ui-setting-action ui-setting-action-subtle settings-debug-toggle${showDebugSettings ? " active" : ""}`}
              aria-expanded={showDebugSettings}
              onClick={() => setShowDebugSettings((isVisible) => !isVisible)}
            >
              Debug
            </button>
            <a
              className="settings-author-link"
              href="https://mwhitelab.com/"
              target="_blank"
              rel="noreferrer"
            >
              {t("作者：皌白")}
            </a>
          </div>
        </div>
      </main>

      {settingsDialog}
      <AppFooter />
    </div>
  );
}

function ArchiveSelectField({
  id,
  archives,
  selected,
  onSelect,
}: {
  id: string;
  archives: StatisticsArchive[];
  selected: string;
  onSelect(archiveId: string): void;
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const selectedArchive = archives.find((archive) => archive.id === selected);

  function handleSelect(archiveId: string) {
    onSelect(archiveId);
    setIsOpen(false);
  }

  return (
    <div
      className={`settings-palette-select-wrap settings-archive-select-wrap${isOpen ? " open" : ""}`}
      onKeyDown={(event) => handleSettingMenuKeyDown(event, () => setIsOpen(false))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        className="settings-palette-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-menu` : undefined}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
        }}
      >
        <span className="settings-color-select-label">{t(selectedArchive?.name ?? "默认存档")}</span>
      </button>
      {isOpen && (
        <div id={`${id}-menu`} className="settings-color-menu settings-palette-menu" role="listbox" aria-labelledby={id}>
          {archives.map((archive) => {
            const isSelected = selected === archive.id;
            return (
              <button
                key={archive.id}
                type="button"
                className={`settings-color-option settings-palette-option${isSelected ? " selected" : ""}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(archive.id)}
              >
                <span>{t(archive.name)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
