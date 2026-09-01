import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AppFooter, AppTopbar } from "@/components/app-shell";
import { getSiteTitle } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-locale";
import { getTutorials } from "@/lib/tutorials";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: getSiteTitle(locale),
    description: locale === "en"
      ? "Learn cube notation, algorithms, and solving methods."
      : "系统学习魔方符号、公式与复原方法。",
  };
}

export default async function ArticlesPage() {
  const locale = await getRequestLocale();
  const tutorials = await getTutorials(locale);
  const copy = locale === "en"
    ? { title: "Tutorials", sectionLabel: "Tutorial articles", read: "Read tutorial" }
    : { title: "教程", sectionLabel: "教程文章", read: "阅读教程" };

  return (
    <div className="app tutorial-app">
      <AppTopbar />
      <main className="tutorial-scroll">
        <div className="tutorial-list-shell">
          <header className="tutorial-page-header">
            <h1>{copy.title}</h1>
          </header>

          <section className="tutorial-grid" aria-label={copy.sectionLabel}>
            {tutorials.map((tutorial) => (
              <Link key={tutorial.id} href={tutorial.href} className="tutorial-card-link">
                <article className="tutorial-card">
                  <div className="tutorial-card-cover">
                    <Image
                      src={tutorial.coverUrl}
                      fill
                      alt={tutorial.title}
                      sizes="(max-width: 760px) calc(100vw - 28px), (max-width: 1500px) 45vw, 650px"
                      preload
                      unoptimized
                    />
                  </div>
                  <div className="tutorial-card-copy">
                    <h2>{tutorial.title}</h2>
                    <p>{tutorial.description}</p>
                    <span className="tutorial-card-action">
                      {copy.read}
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="m7 4 6 6-6 6" />
                      </svg>
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </section>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
