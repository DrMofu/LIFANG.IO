import type { Metadata } from "next";
import { StatsApp } from "@/components/stats-app";
import { getPageTitle } from "@/lib/i18n/i18n";
import { getRequestLocale } from "@/lib/i18n/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: getPageTitle(locale, "stats") };
}

export default function StatsPage() {
  return <StatsApp />;
}
