export type TutorialHeading = {
  id: string;
  title: string;
};

const SECOND_LEVEL_HEADING_PATTERN = /^##\s+(.+?)\s*#*\s*$/gm;

export function toTutorialHeadingId(title: string) {
  const slug = title
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("zh-CN")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return `section-${slug || "content"}`;
}

export function getTutorialHeadings(markdown: string): TutorialHeading[] {
  return Array.from(markdown.matchAll(SECOND_LEVEL_HEADING_PATTERN), ([, title]) => ({
    id: toTutorialHeadingId(title),
    title: title.trim(),
  }));
}
