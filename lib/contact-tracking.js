// dataLayer events read by Google Tag Manager (container in app/layout.js), which
// forwards them to the Meta Pixel. Payloads must never include names, emails,
// phone numbers, or form contents.

export const LEAD_FORM_EVENT = "mcs_lead_form";

export const CONTACT_CLICK_EVENTS = {
  email: "mcs_contact_email",
  sms: "mcs_contact_sms",
};

export const PAGE_VIEW_EVENT = "mcs_page_view";

export const THANK_YOU_PATHS = {
  form: "/thank-you/form",
  email: "/thank-you/email",
  sms: "/thank-you/sms",
};

const CONTACT_CLICK_STORAGE_PREFIX = "mcs-contact-click-";

function newEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pushToDataLayer(payload) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

function pushEvent(event, method) {
  pushToDataLayer({
    event,
    mcs_contact_method: method,
    mcs_event_id: newEventId(),
  });
}

/** Call once per quote request the server confirmed as received. */
export function trackLeadFormSubmitted() {
  pushEvent(LEAD_FORM_EVENT, "form");
}

/**
 * Records the first email or SMS link click of the browser session.
 * Returns false when the click was already recorded for this session.
 */
export function trackContactClick(method) {
  const event = CONTACT_CLICK_EVENTS[method];
  if (!event || typeof window === "undefined") return false;

  const key = `${CONTACT_CLICK_STORAGE_PREFIX}${method}`;
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage may be unavailable in private modes; record the click anyway.
  }

  pushEvent(event, method);
  return true;
}

/** Client-side navigation only; the first page load is GTM's own page view. */
export function trackClientPageView(pathname) {
  pushToDataLayer({ event: PAGE_VIEW_EVENT, mcs_page_path: pathname });
}
