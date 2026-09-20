/**
 * In-memory Google Calendar provider for automated tests (no network).
 */

import { randomUUID } from "node:crypto";
import {
  GoogleCalendarProviderError,
} from "./provider.js";

/**
 * @returns {import('./provider.js').GoogleCalendarProvider & {
 *   _store: Map<string, object>,
 *   _calls: object[],
 *   reset: () => void,
 *   failNext: (op: string, error?: GoogleCalendarProviderError) => void
 * }}
 */
export function createMockGoogleCalendarProvider() {
  /** @type {Map<string, object>} */
  const store = new Map();
  /** @type {object[]} */
  const calls = [];
  /** @type {Map<string, GoogleCalendarProviderError>} */
  const failQueue = new Map();

  function maybeFail(op) {
    const err = failQueue.get(op);
    if (err) {
      failQueue.delete(op);
      throw err;
    }
  }

  const provider = {
    _store: store,
    _calls: calls,
    reset() {
      store.clear();
      calls.length = 0;
      failQueue.clear();
    },
    failNext(op, error) {
      failQueue.set(
        op,
        error ||
          new GoogleCalendarProviderError("mock_failure", {
            code: "mock_failure",
            status: 500,
          })
      );
    },
    async createEvent({ calendarId, event }) {
      calls.push({ op: "createEvent", calendarId, event });
      maybeFail("createEvent");
      const id = `mock-evt-${randomUUID()}`;
      const record = {
        id,
        calendarId,
        ...event,
        extendedProperties: event.extendedProperties || { private: {} },
      };
      store.set(`${calendarId}:${id}`, record);
      return { ...record };
    },
    async updateEvent({ calendarId, eventId, event }) {
      calls.push({ op: "updateEvent", calendarId, eventId, event });
      maybeFail("updateEvent");
      const key = `${calendarId}:${eventId}`;
      const existing = store.get(key);
      if (!existing) {
        throw new GoogleCalendarProviderError("not_found", {
          code: "not_found",
          status: 404,
        });
      }
      const record = {
        ...existing,
        ...event,
        id: eventId,
        calendarId,
        extendedProperties:
          event.extendedProperties || existing.extendedProperties,
      };
      store.set(key, record);
      return { ...record };
    },
    async deleteEvent({ calendarId, eventId }) {
      calls.push({ op: "deleteEvent", calendarId, eventId });
      maybeFail("deleteEvent");
      const key = `${calendarId}:${eventId}`;
      if (!store.has(key)) {
        throw new GoogleCalendarProviderError("not_found", {
          code: "not_found",
          status: 404,
        });
      }
      store.delete(key);
    },
    async findEventByMcsJobId({ calendarId, mcsJobId }) {
      calls.push({ op: "findEventByMcsJobId", calendarId, mcsJobId });
      maybeFail("findEventByMcsJobId");
      const matches = [];
      for (const record of store.values()) {
        if (record.calendarId !== calendarId) continue;
        const id = record.extendedProperties?.private?.mcsJobId;
        if (id === mcsJobId) matches.push({ ...record });
      }
      return matches;
    },
  };

  return provider;
}
