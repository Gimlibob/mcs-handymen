// Central place to edit contact details, links, and site copy.
// See README.md for step-by-step replacement instructions.

export const SITE_NAME = "MCS Handymen";

export const SITE_URL = "https://www.mcshandymen.com";

export const SERVICE_AREA = "Manvel, Iowa Colony & Rosharon, TX";

export const SERVICE_CITIES = ["Manvel", "Iowa Colony", "Rosharon", "Other"];

// TODO: Replace with your real Facebook Page URL before launch.
export const FACEBOOK_URL = "https://www.facebook.com/";

// TODO: Replace with your real backup email address before launch.
export const BACKUP_EMAIL = "contact@mcshandymen.com";

// Form submission endpoint (Formspree, Web3Forms, etc.).
// Set NEXT_PUBLIC_FORM_ENDPOINT in .env.local — see README.md.
export const FORM_ENDPOINT = process.env.NEXT_PUBLIC_FORM_ENDPOINT || "";

export const SERVICES = [
  { id: "ceiling-fan-light", name: "Ceiling Fan & Light Fixture Swaps" },
  { id: "plumbing-fixture", name: "Plumbing Fixture Replacement" },
  { id: "drywall-patching", name: "Drywall Patching" },
  { id: "furniture-assembly", name: "Furniture Assembly" },
  { id: "door-lock-hardware", name: "Door & Lock Hardware" },
  { id: "rescreening", name: "Rescreening" },
  { id: "wall-mounts-shelving", name: "Wall Mounts & Shelving" },
  { id: "tv-mounting", name: "TV Mounting" },
  { id: "small-home-repairs", name: "Small Home Repairs" },
  { id: "property-turnover", name: "Property Turnover Services" },
];

export const CONTACT_METHODS = ["Email", "Facebook Messenger"];

export const BUDGET_RANGES = [
  "Under $150",
  "$150 - $300",
  "$300 - $600",
  "$600 - $1,000",
  "$1,000+",
  "Not sure yet",
];

export const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#services", label: "Services" },
  { href: "#quote", label: "Request a Quote" },
  { href: "#facebook", label: "Facebook" },
];
