import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppFooter, AppTopbar } from "@/components/app-shell";
import { TutorialMarkdown } from "@/components/tutorial-markdown";
import { TutorialTableOfContents } from "@/components/tutorial-table-of-contents";
import { getRequestLocale } from "@/lib/request-locale";
import { getTutorial, getTutorials } from "@/lib/tutorials";
import { getTutorialHeadings } from "@/lib/tutorial-headings";

type ArticlePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  return (await getTutorials()).flatMap(({ id, title }) => [
    { id: String(id) },
    { id: title },
  ]);
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { id } = await params;
  const locale = await getRequestLocale();
  const tutorial = await getTutorial(id, locale);
  if (!tutorial) return {};

  return {
    title: tutorial.title,
    description: tutorial.description,
    alternates: { canonical: tutorial.href },
  };
}

export default async function ArticleDetailPage({ params }: ArticlePageProps) {
  const { id } = await params;
  const locale = await getRequestLocale();
  const tutorial = await getTutorial(id, locale);
  if (!tutorial) notFound();
  const headings = getTutorialHeadings(tutorial.markdown);
  const copy = locale === "en"
    ? { back: "Back to tutorials", tableOfContents: "On this page" }
    : { back: "返回教程", tableOfContents: "文章目录" };

  return (
    <div className="app tutorial-app">
      <AppTopbar />
      <main className="tutorial-scroll">
        <div className="tutorial-article-layout">
          <TutorialTableOfContents headings={headings} label={copy.tableOfContents} />

          <article className="tutorial-article">
            <Link href="/articles" className="tutorial-back-link">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="m12.5 4-6 6 6 6" />
              </svg>
              {copy.back}
            </Link>

            <div className="tutorial-article-surface">
              <header className="tutorial-article-header">
                <h1>{tutorial.title}</h1>
                <p>{tutorial.description}</p>
              </header>

              <TutorialMarkdown markdown={tutorial.markdown} />
            </div>
          </article>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
