import type { Metadata } from "next";
import { CfopTrainerApp } from "@/components/trainer/cfop-trainer-app";
import { getPageTitle } from "@/lib/i18n/i18n";
import { getRequestLocale } from "@/lib/i18n/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: getPageTitle(locale, "trainer") };
}

export default function TrainerPage() {
  return <CfopTrainerApp />;
}
