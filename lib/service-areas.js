import { SERVICES, SITE_NAME, SITE_URL, PHONE_NUMBER, MAILTO_HREF, BACKUP_EMAIL, FACEBOOK_URL } from "@/lib/site-config";

/** Local landing pages keyed by URL slug (e.g. /manvel-tx). */
export const SERVICE_AREA_PAGES = [
  {
    slug: "manvel-tx",
    city: "Manvel",
    state: "TX",
    label: "Manvel, TX",
    title: "Top-Rated Handyman Services in Manvel, TX",
    description:
      "Small repairs and property maintenance for homes, rentals, and small businesses in Manvel, TX. Send project photos for a quote from MCS Handymen.",
    heroSub:
      "Trusted handyman help for homes, rentals & light commercial in Manvel, TX.",
  },
  {
    slug: "iowa-colony-tx",
    city: "Iowa Colony",
    state: "TX",
    label: "Iowa Colony, TX",
    title: "Top-Rated Handyman Services in Iowa Colony, TX",
    description:
      "Small repairs and property maintenance for homes, rentals, and small businesses in Iowa Colony, TX. Send project photos for a quote from MCS Handymen.",
    heroSub:
      "Trusted handyman help for homes, rentals & light commercial in Iowa Colony, TX.",
  },
  {
    slug: "rosharon-tx",
    city: "Rosharon",
    state: "TX",
    label: "Rosharon, TX",
    title: "Top-Rated Handyman Services in Rosharon, TX",
    description:
      "Small repairs and property maintenance for homes, rentals, and small businesses in Rosharon, TX. Send project photos for a quote from MCS Handymen.",
    heroSub:
      "Trusted handyman help for homes, rentals & light commercial in Rosharon, TX.",
  },
];

export function getServiceAreaBySlug(slug) {
  return SERVICE_AREA_PAGES.find((area) => area.slug === slug) ?? null;
}

/** JSON-LD for LocalBusiness / HandymanService. */
export function buildLocalBusinessJsonLd() {
  const areaServed = SERVICE_AREA_PAGES.map((area) => ({
    "@type": "City",
    name: area.city,
    containedInPlace: {
      "@type": "State",
      name: "Texas",
    },
  }));

  const serviceOffers = SERVICES.map((service) => ({
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: service.name,
      provider: {
        "@type": "LocalBusiness",
        name: SITE_NAME,
      },
    },
  }));

  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HandymanService"],
    "@id": `${SITE_URL}/#business`,
    name: SITE_NAME,
    url: SITE_URL,
    telephone: PHONE_NUMBER,
    email: BACKUP_EMAIL,
    image: `${SITE_URL}/images/logo.png`,
    priceRange: "$$",
    areaServed,
    sameAs: [FACEBOOK_URL],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: PHONE_NUMBER,
      email: BACKUP_EMAIL,
      contactType: "customer service",
      areaServed: SERVICE_AREA_PAGES.map((a) => a.city),
      availableLanguage: ["English"],
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Handyman Services",
      itemListElement: serviceOffers,
    },
    potentialAction: {
      "@type": "CommunicateAction",
      target: MAILTO_HREF,
    },
  };
}
