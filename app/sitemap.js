import { SERVICE_AREA_PAGES } from "@/lib/service-areas";
import { SITE_URL } from "@/lib/site-config";

/**
 * Public indexable URLs only.
 * Excludes: /command-center/*, /api/*, /login, estimate templates, technical routes.
 */
export default function sitemap() {
  const lastModified = new Date();

  const staticPages = [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const areaPages = SERVICE_AREA_PAGES.map((area) => ({
    url: `${SITE_URL}/${area.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  return [...staticPages, ...areaPages];
}
