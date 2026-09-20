/**
 * Resolve Google Calendar provider for the process.
 * Live client is created from DB connection credentials when sync is enabled.
 */

import { createMockGoogleCalendarProvider } from "./mock-provider.js";
import { nullGoogleCalendarProvider } from "./provider.js";
import { createLiveGoogleCalendarProvider } from "./live-provider.js";
import { isGoogleCalendarSyncEnabled } from "./config.js";
import { getConnectedGoogleCalendar } from "../db/google-calendar-connections.js";

/** @type {import('./provider.js').GoogleCalendarProvider | null} */
let injected = null;
let sharedMock = null;

export function setGoogleCalendarProviderForTests(provider) {
  injected = provider;
}

export function resetGoogleCalendarProviderForTests() {
  injected = null;
  sharedMock = null;
}

/**
 * Async resolver — prefers test injection, then mock mode, then live DB connection.
 */
export async function resolveGoogleCalendarProvider() {
  if (injected) return injected;

  const mode = (process.env.GOOGLE_CALENDAR_PROVIDER || "").trim().toLowerCase();
  if (mode === "mock") {
    if (!sharedMock) sharedMock = createMockGoogleCalendarProvider();
    return sharedMock;
  }

  if (!isGoogleCalendarSyncEnabled()) {
    return nullGoogleCalendarProvider;
  }

  try {
    const connection = await getConnectedGoogleCalendar();
    if (!connection?.refresh_token_ciphertext || !connection.calendar_id) {
      return nullGoogleCalendarProvider;
    }
    return createLiveGoogleCalendarProvider({
      refreshTokenCiphertext: connection.refresh_token_ciphertext,
    });
  } catch {
    return nullGoogleCalendarProvider;
  }
}

/** @deprecated prefer resolveGoogleCalendarProvider — sync mock/null only */
export function getGoogleCalendarProvider() {
  if (injected) return injected;
  const mode = (process.env.GOOGLE_CALENDAR_PROVIDER || "").trim().toLowerCase();
  if (mode === "mock") {
    if (!sharedMock) sharedMock = createMockGoogleCalendarProvider();
    return sharedMock;
  }
  return nullGoogleCalendarProvider;
}

export function getSharedMockGoogleCalendarProvider() {
  const p = getGoogleCalendarProvider();
  if (p && typeof p.reset === "function") return p;
  return null;
}
