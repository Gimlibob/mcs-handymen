// Central place to edit contact details, links, and site copy.
// See README.md for step-by-step replacement instructions.

export const SITE_NAME = "MCS Handymen";

export const SITE_URL = "https://www.mcshandymen.com";

export const SERVICE_AREA = "Manvel, Iowa Colony & Rosharon, TX";

export const SERVICE_CITIES = ["Manvel", "Iowa Colony", "Rosharon", "Other"];

export const PROPERTY_TYPES = [
  "Home",
  "Rental Property",
  "Small Business / Office",
  "Other",
];

// Placeholder contact assets — replace before public launch.
export const FACEBOOK_URL = "https://www.facebook.com/share/14n4CrmLwJf/";
export const BACKUP_EMAIL = "info@mcshandymen.com";
export const MAILTO_HREF = `mailto:${BACKUP_EMAIL}`;
export const PHONE_NUMBER = "+10000000000";
export const PHONE_HREF = `tel:${PHONE_NUMBER}`;

// Form submission endpoint (Formspree, Web3Forms, etc.).
// Set NEXT_PUBLIC_FORM_ENDPOINT in .env.local — see README.md.
export const FORM_ENDPOINT = process.env.NEXT_PUBLIC_FORM_ENDPOINT || "";

export const SERVICES = [
  { id: "ceiling-fan-light", name: "Ceiling Fan & Light Fixture Swaps" },
  { id: "plumbing-fixture", name: "Plumbing Fixture Replacement" },
  { id: "drywall-patching", name: "Drywall Patching" },
  { id: "furniture-assembly", name: "Furniture Assembly" },
  { id: "door-lock-hardware", name: "Door Locks & Smart Locks" },
  { id: "rescreening", name: "Window & Door Rescreening" },
  { id: "wall-mounts-shelving", name: "Wall Mounts & Shelving" },
  { id: "tv-mounting", name: "TV Mounting" },
  { id: "doorbell-cameras", name: "Doorbell Cameras" },
  { id: "air-filter-swaps", name: "Air Filter Swaps" },
  { id: "smoke-detectors", name: "Smoke Detectors" },
  { id: "caulking-sealing", name: "Caulking & Sealing" },
  { id: "hollow-core-door", name: "Hollow-Core Door Repair" },
  { id: "weatherstripping", name: "Weatherstripping" },
  { id: "blind-curtain-rods", name: "Blind & Curtain Rods" },
  { id: "cabinet-hardware", name: "Cabinet Hardware" },
];

export const CONTACT_METHODS = ["Email", "Facebook Messenger"];

export const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#services", label: "Services" },
  { href: "#quote", label: "Request a Quote" },
  { href: "#facebook", label: "Facebook" },
];
