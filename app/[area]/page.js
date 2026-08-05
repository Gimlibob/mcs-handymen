import { notFound } from "next/navigation";
import HomePage from "@/components/HomePage";
import {
  SERVICE_AREA_PAGES,
  getServiceAreaBySlug,
} from "@/lib/service-areas";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

export function generateStaticParams() {
  return SERVICE_AREA_PAGES.map((area) => ({ area: area.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }) {
  const { area: slug } = await params;
  const area = getServiceAreaBySlug(slug);
  if (!area) {
    return { title: SITE_NAME };
  }

  const url = `${SITE_URL}/${area.slug}`;

  return {
    title: `${area.title} | ${SITE_NAME}`,
    description: area.description,
    keywords: [
      `handyman ${area.city} TX`,
      `handyman ${area.label}`,
      SITE_NAME,
      "property maintenance",
      "small repairs",
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${area.title} | ${SITE_NAME}`,
      description: area.description,
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${area.title} | ${SITE_NAME}`,
      description: area.description,
    },
  };
}

export default async function ServiceAreaPage({ params }) {
  const { area: slug } = await params;
  const area = getServiceAreaBySlug(slug);

  if (!area) {
    notFound();
  }

  return <HomePage area={area} />;
}
