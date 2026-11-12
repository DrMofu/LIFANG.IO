import type { Metadata } from "next";
import { SettingsApp } from "@/components/settings/settings-app";
import { getPageTitle } from "@/lib/i18n/i18n";
import { getRequestLocale } from "@/lib/i18n/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: getPageTitle(locale, "settings") };
}

export default function SettingsPage() {
  return <SettingsApp />;
}
