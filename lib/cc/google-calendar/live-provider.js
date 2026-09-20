/**
 * Live Google Calendar provider (GC-2).
 * calendarId always from caller (DB connection) — never from browser.
 */

import { google } from "googleapis";
import { GoogleCalendarProviderError } from "./provider.js";
import { oauthClientWithRefreshToken } from "./oauth-client.js";
import { decryptRefreshToken } from "./token-crypto.js";

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 * @template T
 */
function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(
        new GoogleCalendarProviderError("timeout", {
          code: "timeout",
          status: 408,
        })
      );
    }, ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(t);
        reject(err);
      });
  });
}

function mapGoogleError(err) {
  if (err instanceof GoogleCalendarProviderError) return err;
  const status =
    err?.response?.status ||
    err?.code ||
    (typeof err?.status === "number" ? err.status : null);
  const statusNum = typeof status === "number" ? status : Number(status);
  const message =
    err?.message && typeof err.message === "string"
      ? err.message.slice(0, 180)
      : "google_api_error";

  if (statusNum === 401) {
    return new GoogleCalendarProviderError(message, {
      code: "unauthorized",
      status: 401,
    });
  }
  if (statusNum === 403) {
    return new GoogleCalendarProviderError(message, {
      code: "forbidden",
      status: 403,
    });
  }
  if (statusNum === 404) {
    return new GoogleCalendarProviderError(message, {
      code: "not_found",
      status: 404,
    });
  }
  if (statusNum === 429) {
    return new GoogleCalendarProviderError(message, {
      code: "rate_limited",
      status: 429,
    });
  }
  if (statusNum >= 500) {
    return new GoogleCalendarProviderError(message, {
      code: "server_error",
      status: statusNum,
    });
  }
  return new GoogleCalendarProviderError(message, {
    code: "provider_error",
    status: statusNum || 0,
  });
}

/**
 * @param {{ refreshTokenCiphertext: string, calendarApi?: object }} opts
 *   calendarApi — injectable for tests (mock googleapis calendar)
 */
export function createLiveGoogleCalendarProvider(opts) {
  const { refreshTokenCiphertext, calendarApi = null, timeoutMs = DEFAULT_TIMEOUT_MS } =
    opts || {};

  function getCalendar() {
    if (calendarApi) return calendarApi;
    const refresh = decryptRefreshToken(refreshTokenCiphertext);
    const auth = oauthClientWithRefreshToken(refresh);
    return google.calendar({ version: "v3", auth });
  }

  return {
    async createEvent({ calendarId, event }) {
      try {
        const calendar = getCalendar();
        const res = await withTimeout(
          calendar.events.insert({
            calendarId,
            requestBody: event,
          }),
          timeoutMs
        );
        return {
          id: res.data.id,
          summary: res.data.summary,
          description: res.data.description,
          location: res.data.location,
          start: res.data.start,
          end: res.data.end,
          htmlLink: res.data.htmlLink,
          extendedProperties: res.data.extendedProperties,
        };
      } catch (err) {
        throw mapGoogleError(err);
      }
    },

    async updateEvent({ calendarId, eventId, event }) {
      try {
        const calendar = getCalendar();
        const res = await withTimeout(
          calendar.events.patch({
            calendarId,
            eventId,
            requestBody: event,
          }),
          timeoutMs
        );
        return {
          id: res.data.id,
          summary: res.data.summary,
          description: res.data.description,
          location: res.data.location,
          start: res.data.start,
          end: res.data.end,
          htmlLink: res.data.htmlLink,
          extendedProperties: res.data.extendedProperties,
        };
      } catch (err) {
        throw mapGoogleError(err);
      }
    },

    async deleteEvent({ calendarId, eventId }) {
      try {
        const calendar = getCalendar();
        await withTimeout(
          calendar.events.delete({
            calendarId,
            eventId,
          }),
          timeoutMs
        );
      } catch (err) {
        throw mapGoogleError(err);
      }
    },

    async findEventByMcsJobId({ calendarId, mcsJobId }) {
      try {
        const calendar = getCalendar();
        const res = await withTimeout(
          calendar.events.list({
            calendarId,
            privateExtendedProperty: [`mcsJobId=${mcsJobId}`],
            maxResults: 10,
            singleEvents: true,
          }),
          timeoutMs
        );
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        return items.map((ev) => ({
          id: ev.id,
          summary: ev.summary,
          description: ev.description,
          location: ev.location,
          start: ev.start,
          end: ev.end,
          htmlLink: ev.htmlLink,
          extendedProperties: ev.extendedProperties,
        }));
      } catch (err) {
        throw mapGoogleError(err);
      }
    },

    async getCalendar({ calendarId }) {
      try {
        const calendar = getCalendar();
        const res = await withTimeout(
          calendar.calendars.get({ calendarId }),
          timeoutMs
        );
        return { id: res.data.id, summary: res.data.summary };
      } catch (err) {
        throw mapGoogleError(err);
      }
    },

    async createCalendar({ summary, timeZone }) {
      try {
        const calendar = getCalendar();
        const res = await withTimeout(
          calendar.calendars.insert({
            requestBody: { summary, timeZone },
          }),
          timeoutMs
        );
        return { id: res.data.id, summary: res.data.summary };
      } catch (err) {
        throw mapGoogleError(err);
      }
    },
  };
}
