function scaleMoveDuration(durationMs: number, backlog: number) {
  if (durationMs <= 0 || backlog <= 1) return durationMs;
  if (backlog >= 12) return Math.max(12, Math.round(durationMs * 0.06));
  if (backlog >= 8) return Math.max(18, Math.round(durationMs * 0.1));
  if (backlog >= 5) return Math.max(28, Math.round(durationMs * 0.18));
  if (backlog >= 3) return Math.max(45, Math.round(durationMs * 0.35));
  return Math.max(80, Math.round(durationMs * 0.6));
}

/** Change playback speed without retroactively changing the angle already shown. */
export function advanceCubeMoveProgress(progress: number, elapsedMs: number, durationMs: number, backlog: number) {
  const scaledDuration = scaleMoveDuration(durationMs, backlog);
  if (scaledDuration <= 0) return 1;
  return Math.min(1, progress + Math.max(0, elapsedMs) / scaledDuration);
}
