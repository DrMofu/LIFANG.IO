import type { MetadataRoute } from "next";
import { getTutorials } from "@/lib/tutorials";

const SITE_URL = "https://www.lifang.io";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tutorials = await getTutorials("zh-CN");

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
    },
    {
      url: `${SITE_URL}/practice`,
      changeFrequency: "weekly",
    },
    {
      url: `${SITE_URL}/formulas`,
      changeFrequency: "weekly",
    },
    {
      url: `${SITE_URL}/trainer`,
      changeFrequency: "weekly",
    },
    {
      url: `${SITE_URL}/articles`,
      changeFrequency: "weekly",
    },
  ];

  const articlePages: MetadataRoute.Sitemap = tutorials.map((tutorial) => ({
    url: new URL(tutorial.href, SITE_URL).toString(),
    changeFrequency: "monthly",
  }));

  return [...staticPages, ...articlePages];
}
