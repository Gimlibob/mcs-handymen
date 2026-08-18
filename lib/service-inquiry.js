export const SERVICE_INQUIRY_EVENT = "mcs:service-inquiry";
export const SERVICE_INQUIRY_STORAGE_KEY = "mcs-service-inquiry";

const SERVICE_MESSAGE_TEMPLATES = {
  "Ceiling Fan & Light Fixture Swaps":
    "Inquiry regarding Ceiling Fan & Light Fixture Swaps. Is there an existing junction box/fixture to replace? Here is a photo of the ceiling area:",
  "Plumbing Fixture Replacement":
    "Inquiry regarding Plumbing Fixture Replacement (e.g., kitchen faucet, bathroom sink drain, supply lines). Here is a photo of the area:",
  "Drywall, Paint & Ceiling Tiles":
    "Inquiry regarding Drywall, Paint & Ceiling Tiles (e.g., drywall patching / small drywall repairs, minor paint touch-ups after repairs, ceiling tile replacement). Approximate size/location of the work: Here is a photo of the area:",
  "Furniture Assembly":
    "Inquiry regarding Furniture Assembly (e.g., desk, bed frame, shelving unit). Here is a photo or item description:",
  "Door Locks & Smart Locks":
    "Inquiry regarding Door Locks & Smart Locks (e.g., standard deadbolt, electronic keypad upgrade). Here is a photo of the door/lock:",
  "Window & Door Rescreening":
    "Inquiry regarding Window & Door Rescreening. Approximate number of screens or doors: Here is a photo:",
  "Wall Mounts & Shelving":
    "Inquiry regarding Wall Mounts & Shelving (e.g., heavy floating shelves, heavy frames). Here is a photo of the wall:",
  "TV Mounting":
    "Inquiry regarding TV Mounting (e.g., screen size, drywall or brick wall, soundbar included). Here is a photo of the wall/setup:",
  "Doorbell Cameras":
    "Inquiry regarding Doorbell Cameras (e.g., Ring, Google Nest - existing doorbell wiring or battery). Here is a photo of the door frame:",
  "Air Filter Swaps":
    "Inquiry regarding Air Filter Swaps (e.g., number of intake vents/units). Here is a photo or size details of the filters:",
  "Smoke Detectors":
    "Inquiry regarding Smoke Detectors (e.g., battery-powered units or hardwired replacement). Here is a photo of the units:",
  "Caulking & Sealing":
    "Inquiry regarding Caulking & Sealing. Location/Surface: [e.g., bathtub, shower, countertop, or sink]. Here is a photo of the area:",
  "Hollow-Core Door Repair":
    "Inquiry regarding Hollow-Core Door Repair. Location/Damage: [e.g., bedroom door / doorknob hole]. Here is a photo of the door:",
  "Weatherstripping":
    "Inquiry regarding Weatherstripping (e.g., front door, back door, drafty frame). Here is a photo of the door gap:",
  "Blind & Curtain Rods":
    "Inquiry regarding Blind & Curtain Rods (e.g., window width or number of windows). Here is a photo of the window area:",
  "Cabinet Hardware":
    "Inquiry regarding Cabinet Hardware (e.g., kitchen cabinets, bathroom vanity, replacing knobs/pulls). Here is a photo of the doors/drawers:",
};

export function inquiryDescription(serviceName) {
  if (!serviceName) return "";
  return (
    SERVICE_MESSAGE_TEMPLATES[serviceName] ??
    `Inquiry regarding ${serviceName}. Please describe the work needed and attach a photo of the area:`
  );
}

/** Prefill quote form context and smooth-scroll to the contact section. */
export function selectServiceInquiry(serviceName) {
  if (typeof window === "undefined" || !serviceName) return;

  try {
    window.sessionStorage.setItem(SERVICE_INQUIRY_STORAGE_KEY, serviceName);
  } catch {
    // sessionStorage may be unavailable in private modes
  }

  window.dispatchEvent(
    new CustomEvent(SERVICE_INQUIRY_EVENT, { detail: { serviceName } })
  );

  const quote = document.getElementById("quote");
  if (quote) {
    quote.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.location.hash = "quote";
  }
}
