type Brand = { brand: string; version: string };
type ClientHints = {
  platform: string;
  brands: Brand[];
  getHighEntropyValues?: (hints: string[]) => Promise<{ platformVersion?: string }>;
};

export type ClientEnvironment = {
  os: string;
  browser: string;
  status: "supported" | "unsupported" | "insecure" | "unavailable" | "unknown";
};

export async function detectClientEnvironment(): Promise<ClientEnvironment> {
  const ua = navigator.userAgent;
  const hints = (navigator as Navigator & { userAgentData?: ClientHints }).userAgentData;
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  let os = ipad ? "iPadOS" : /iPhone|iPod/.test(ua) ? "iOS"
    : hints?.platform || (/Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
      : /Macintosh/.test(ua) ? "macOS" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "");
  const browserPatterns: [string, RegExp][] = [
    ["Edge", /(?:EdgA|EdgiOS|Edg)\/([\d.]+)/],
    ["Opera", /(?:OPR|OPiOS)\/([\d.]+)/],
    ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
  ];
  const match = browserPatterns.find(([, pattern]) => pattern.test(ua));
  let browser = match ? `${match[0]} ${ua.match(match[1])![1].split(".")[0]}` : "";
  const brand = hints?.brands.find(({ brand }) => !/Chromium|Not/i.test(brand))
    ?? hints?.brands.find(({ brand }) => brand === "Chromium");
  if (brand) browser = `${brand.brand} ${brand.version}`;

  let status: ClientEnvironment["status"] = !window.isSecureContext ? "insecure"
    : typeof navigator.bluetooth?.requestDevice !== "function" ? "unsupported" : "supported";
  if (status === "supported" && navigator.bluetooth.getAvailability) {
    try {
      if (!await navigator.bluetooth.getAvailability()) status = "unavailable";
    } catch {
      status = "unknown";
    }
  }
  // UA strings may freeze OS versions; only use client hints for version details.
  try {
    const values = await hints?.getHighEntropyValues?.(["platformVersion"]);
    const version = values?.platformVersion;
    if (version && /^\d+(\.\d+)*$/.test(version)) {
      if (os === "Windows") {
        const major = Number(version.split(".")[0]);
        if (major >= 13) os = "Windows 11";
        else if (major >= 1) os = "Windows 10";
      } else if (["macOS", "Android", "Chrome OS"].includes(os)) {
        os += ` ${version}`;
      }
    }
  } catch {
    // Keep the OS name when the browser withholds detailed version information.
  }
  return { os, browser, status };
}
