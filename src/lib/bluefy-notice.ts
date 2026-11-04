const BLUEFY_NOTICE_DATE_KEY = "lifang-bluefy-notice-date";

export function claimBluefyNotice(
  device: Pick<Navigator, "userAgent" | "maxTouchPoints">,
  storage: Pick<Storage, "getItem" | "setItem">,
  now = new Date(),
) {
  const { userAgent, maxTouchPoints } = device;
  const isAppleMobile = /iPhone|iPad/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  if (!isAppleMobile || /\bBluefy\b/i.test(userAgent)) return false;

  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  try {
    if (storage.getItem(BLUEFY_NOTICE_DATE_KEY) === today) return false;
    // Record when shown, so refreshing without dismissing cannot repeat the notice.
    storage.setItem(BLUEFY_NOTICE_DATE_KEY, today);
    return true;
  } catch {
    // Skip the notice if its daily limit cannot be persisted.
    return false;
  }
}
