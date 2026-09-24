// Central place to edit contact details, links, and site copy.
// See README.md for step-by-step replacement instructions.

export const SITE_NAME = "MCS Handymen";

export const LEGAL_ENTITY_NAME = "Maple Crest Services LLC";
export const LEGAL_ENTITY_DBA = "MCS Handymen";
export const LEGAL_ENTITY_FULL = "Maple Crest Services LLC d/b/a MCS Handymen";
export const LEGAL_PARTY_IDENTIFICATION =
  'Maple Crest Services LLC, doing business as MCS Handymen ("MCS Handymen," "we," "us," or "our").';

export const MIN_SERVICE_CALL_USD = 125;
export const TERMS_EFFECTIVE_DATE = "September 23, 2026";

export const SITE_URL = "https://www.mcshandymen.com";

export const SERVICE_AREA = "Manvel, Iowa Colony, Rosharon & Alvin, TX";

export const SERVICE_CITIES = ["Manvel", "Iowa Colony", "Rosharon", "Alvin", "Other"];

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
// Schema/legacy placeholder only — do not display on the public site as the SMS number.
export const PHONE_NUMBER = "+10000000000";
export const PHONE_HREF = `tel:${PHONE_NUMBER}`;

/**
 * Confirmed RingCentral business SMS number for the public "Text Us" section.
 * Leave empty until the professional business number (not a personal RC contact) is confirmed.
 * Example formats once confirmed: "+12815551234" and display "(281) 555-1234".
 */
export const BUSINESS_SMS_NUMBER = "+18327305915";
export const BUSINESS_SMS_DISPLAY = "(832) 730-5915";
export const BUSINESS_SMS_HREF = BUSINESS_SMS_NUMBER
  ? `sms:${BUSINESS_SMS_NUMBER.replace(/[^\d+]/g, "")}`
  : "";
export const HAS_PUBLIC_BUSINESS_SMS = Boolean(
  BUSINESS_SMS_NUMBER && BUSINESS_SMS_DISPLAY && !BUSINESS_SMS_NUMBER.includes("0000000000")
);

export const SERVICES = [
  { id: "ceiling-fan-light", name: "Ceiling Fan & Light Fixture Swaps" },
  { id: "plumbing-fixture", name: "Plumbing Fixture Replacement" },
  { id: "drywall-patching", name: "Drywall, Paint & Ceiling Tiles" },
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
  { href: "/", label: "Home" },
  { href: "/#services", label: "Services" },
  { href: "/#quote", label: "Request a Quote" },
  { href: "/#text-us", label: "Text Us" },
  { href: "#facebook", label: "Facebook" },
];
