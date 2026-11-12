import type { Metadata } from "next";
import { CubePracticeApp } from "@/components/practice/cube-practice-app";
import { getPageTitle } from "@/lib/i18n/i18n";
import { getRequestLocale } from "@/lib/i18n/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: getPageTitle(locale, "practice") };
}

export default function PracticePage() {
  return <CubePracticeApp />;
}
