/**
 * Resolve Google Calendar provider for the process.
 * GC-1: mock when GOOGLE_CALENDAR_PROVIDER=mock (tests); otherwise null provider.
 * Live googleapis client is intentionally not wired yet.
 */

import { createMockGoogleCalendarProvider } from "./mock-provider.js";
import { nullGoogleCalendarProvider } from "./provider.js";

/** @type {import('./provider.js').GoogleCalendarProvider | null} */
let injected = null;

/** Shared mock instance for tests that set GOOGLE_CALENDAR_PROVIDER=mock */
let sharedMock = null;

/**
 * @param {import('./provider.js').GoogleCalendarProvider | null} provider
 */
export function setGoogleCalendarProviderForTests(provider) {
  injected = provider;
}

export function resetGoogleCalendarProviderForTests() {
  injected = null;
  sharedMock = null;
}

export function getGoogleCalendarProvider() {
  if (injected) return injected;
  const mode = (process.env.GOOGLE_CALENDAR_PROVIDER || "").trim().toLowerCase();
  if (mode === "mock") {
    if (!sharedMock) sharedMock = createMockGoogleCalendarProvider();
    return sharedMock;
  }
  // Real provider deferred to OAuth phase (GC-2).
  return nullGoogleCalendarProvider;
}

export function getSharedMockGoogleCalendarProvider() {
  const p = getGoogleCalendarProvider();
  if (p && typeof p.reset === "function") return p;
  return null;
}
