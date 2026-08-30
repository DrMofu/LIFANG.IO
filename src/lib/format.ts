export function fmtTime(ms: number | null) {
  if (ms == null) return "--.--";
  const elapsedMs = Math.max(0, ms);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const centiseconds = Math.floor((elapsedMs % 1000) / 10);
  const secondsWithFraction = `${String(totalSeconds % 60).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  if (totalSeconds < 60) return secondsWithFraction;
  return `${Math.floor(totalSeconds / 60)}:${secondsWithFraction}`;
}

export function fmtShort(ms: number | null) {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(2)}s`;
}

export function fmtClock(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
