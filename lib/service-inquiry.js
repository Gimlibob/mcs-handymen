export const SERVICE_INQUIRY_EVENT = "mcs:service-inquiry";
export const SERVICE_INQUIRY_STORAGE_KEY = "mcs-service-inquiry";

export function inquiryDescription(serviceName) {
  return `Inquiry regarding ${serviceName}`;
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
