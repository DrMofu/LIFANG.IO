import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";
import { detectLocale, isLocale, LANGUAGE_COOKIE_KEY } from "@/lib/i18n";

export const getRequestLocale = cache(async function getRequestLocale() {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(LANGUAGE_COOKIE_KEY)?.value;
  if (isLocale(savedLocale)) return savedLocale;

  const requestHeaders = await headers();
  return detectLocale(requestHeaders.get("accept-language"));
});
