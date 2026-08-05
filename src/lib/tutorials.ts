import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";

const TUTORIALS_ROOT = path.join(process.cwd(), "src", "content", "tutorials");
const ARTICLE_ID_PATTERN = /^[1-9]\d*$/;

type TutorialLocaleMetadata = {
  title: string;
  description: string;
  contentFile: string;
};

type TutorialMetadata = {
  id: number;
  slug: string;
  draft?: boolean;
  order: number;
  defaultLocale: string;
  locales: Record<string, TutorialLocaleMetadata>;
  cover: string;
};

export type TutorialSummary = TutorialLocaleMetadata & {
  id: number;
  slug: string;
  resolvedLocale: string;
  coverUrl: string;
  href: string;
};

export type TutorialArticle = TutorialSummary & {
  markdown: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeFileName(value: string) {
  return path.basename(value) === value && !value.includes("..") && !value.includes("/") && !value.includes("\\");
}

function parseMetadata(value: unknown, directoryName: string): TutorialMetadata {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    !Number.isInteger(value.id) ||
    value.id < 1 ||
    value.slug !== directoryName
  ) {
    throw new Error(`Invalid tutorial metadata in ${directoryName}`);
  }

  const { draft, order, defaultLocale, locales, cover } = value;
  if (
    (draft !== undefined && typeof draft !== "boolean") ||
    typeof order !== "number" ||
    typeof defaultLocale !== "string" ||
    !isRecord(locales) ||
    typeof cover !== "string" ||
    !isSafeFileName(cover)
  ) {
    throw new Error(`Incomplete tutorial metadata in ${directoryName}`);
  }

  for (const [locale, entry] of Object.entries(locales)) {
    if (
      !isRecord(entry) ||
      typeof entry.title !== "string" ||
      typeof entry.description !== "string" ||
      typeof entry.contentFile !== "string" ||
      !isSafeFileName(entry.contentFile)
    ) {
      throw new Error(`Invalid ${locale} tutorial content metadata in ${directoryName}`);
    }
  }

  return value as TutorialMetadata;
}

async function readMetadata(directoryName: string) {
  const metadataPath = path.join(TUTORIALS_ROOT, directoryName, "metadata.json");
  const source = await fs.readFile(metadataPath, "utf8");
  return parseMetadata(JSON.parse(source) as unknown, directoryName);
}

function resolveLocale(metadata: TutorialMetadata, requestedLocale: string) {
  const resolvedLocale = metadata.locales[requestedLocale]
    ? requestedLocale
    : metadata.locales[metadata.defaultLocale]
      ? metadata.defaultLocale
      : Object.keys(metadata.locales)[0];

  if (!resolvedLocale) throw new Error(`Tutorial ${metadata.slug} has no locale content`);
  return { resolvedLocale, content: metadata.locales[resolvedLocale] };
}

function toSummary(metadata: TutorialMetadata, requestedLocale: string): TutorialSummary {
  const { resolvedLocale, content } = resolveLocale(metadata, requestedLocale);
  return {
    id: metadata.id,
    slug: metadata.slug,
    resolvedLocale,
    ...content,
    coverUrl: `/articles/${metadata.id}/cover`,
    href: `/articles/${encodeURIComponent(content.title)}`,
  };
}

async function readAllMetadata() {
  const entries = await fs.readdir(TUTORIALS_ROOT, { withFileTypes: true });
  const metadata = await Promise.all(
    entries.filter((entry) => entry.isDirectory()).map((entry) => readMetadata(entry.name)),
  );

  const ids = new Set<number>();
  for (const item of metadata) {
    if (ids.has(item.id)) throw new Error(`Duplicate tutorial id ${item.id}`);
    ids.add(item.id);
  }

  return metadata;
}

async function findVisibleMetadataById(articleId: string) {
  if (!ARTICLE_ID_PATTERN.test(articleId)) return null;
  const id = Number(articleId);
  const metadata = (await readAllMetadata()).find((item) => item.id === id);
  return metadata?.draft === true ? null : metadata ?? null;
}

function normalizeArticleIdentifier(identifier: string) {
  try {
    return decodeURIComponent(identifier).normalize("NFC");
  } catch {
    return identifier.normalize("NFC");
  }
}

async function findVisibleMetadata(articleIdentifier: string) {
  const identifier = normalizeArticleIdentifier(articleIdentifier);
  if (ARTICLE_ID_PATTERN.test(identifier)) return findVisibleMetadataById(identifier);

  return (await readAllMetadata()).find((item) =>
    item.draft !== true && Object.values(item.locales).some(
      ({ title }) => title.normalize("NFC") === identifier,
    )) ?? null;
}

export const getTutorials = cache(async function getTutorials(requestedLocale = "zh-CN") {
  const metadata = await readAllMetadata();

  return metadata
    .filter((item) => item.draft !== true)
    .sort((a, b) => a.order - b.order)
    .map((item) => toSummary(item, requestedLocale));
});

export const getTutorial = cache(async function getTutorial(
  articleIdentifier: string,
  requestedLocale = "zh-CN",
): Promise<TutorialArticle | null> {
  try {
    const metadata = await findVisibleMetadata(articleIdentifier);
    if (!metadata) return null;
    const summary = toSummary(metadata, requestedLocale);
    const markdown = await fs.readFile(
      path.join(TUTORIALS_ROOT, metadata.slug, summary.contentFile),
      "utf8",
    );
    return { ...summary, markdown };
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
});

export async function getTutorialCover(articleId: string) {
  try {
    const metadata = await findVisibleMetadataById(articleId);
    if (!metadata) return null;
    return fs.readFile(path.join(TUTORIALS_ROOT, metadata.slug, metadata.cover));
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
