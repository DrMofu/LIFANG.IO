import type { Metadata } from "next";
import { FormulasApp } from "@/components/formulas/formulas-app";
import { getPageTitle } from "@/lib/i18n/i18n";
import { getRequestLocale } from "@/lib/i18n/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: getPageTitle(locale, "formulas") };
}

export default function FormulasPage() {
  return <FormulasApp />;
}
