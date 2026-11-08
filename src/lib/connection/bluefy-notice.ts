const BLUEFY_NOTICE_DATE_KEY = "lifang-bluefy-notice-date";
const BLUEFY_NOTICE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function claimBluefyNotice(
  device: Pick<Navigator, "userAgent" | "maxTouchPoints">,
  storage: Pick<Storage, "getItem" | "setItem">,
  now = new Date(),
) {
  const { userAgent, maxTouchPoints } = device;
  const isAppleMobile = /iPhone|iPad/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  if (!isAppleMobile || /\bBluefy\b/i.test(userAgent)) return false;

  try {
    const stored = storage.getItem(BLUEFY_NOTICE_DATE_KEY);
    // Older versions stored a local calendar date without a time.
    const legacyDate = stored?.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const lastShownAt = legacyDate
      ? new Date(Number(legacyDate[1]), Number(legacyDate[2]) - 1, Number(legacyDate[3])).getTime()
      : Date.parse(stored ?? "");
    if (Number.isFinite(lastShownAt) && now.getTime() - lastShownAt < BLUEFY_NOTICE_INTERVAL_MS) return false;
    // Record when shown, so refreshing without dismissing cannot repeat the notice.
    storage.setItem(BLUEFY_NOTICE_DATE_KEY, now.toISOString());
    return true;
  } catch {
    // Skip the notice if its weekly limit cannot be persisted.
    return false;
  }
}
