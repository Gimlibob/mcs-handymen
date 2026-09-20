/**
 * Google Calendar provider interface (GC-1).
 * Business logic must not import googleapis directly.
 */

/**
 * @typedef {object} GoogleCalendarEventRecord
 * @property {string} id
 * @property {string} [summary]
 * @property {string} [description]
 * @property {string} [location]
 * @property {object} [start]
 * @property {object} [end]
 * @property {{ private?: Record<string, string> }} [extendedProperties]
 */

/**
 * @typedef {object} GoogleCalendarProvider
 * @property {(args: { calendarId: string, event: object }) => Promise<GoogleCalendarEventRecord>} createEvent
 * @property {(args: { calendarId: string, eventId: string, event: object }) => Promise<GoogleCalendarEventRecord>} updateEvent
 * @property {(args: { calendarId: string, eventId: string }) => Promise<void>} deleteEvent
 * @property {(args: { calendarId: string, mcsJobId: string }) => Promise<GoogleCalendarEventRecord[]>} findEventByMcsJobId
 */

export class GoogleCalendarProviderError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string | number, status?: number }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "GoogleCalendarProviderError";
    this.code = opts.code ?? null;
    this.status = opts.status ?? null;
  }
}

/**
 * No-op provider when Google is not connected / not configured.
 * @type {GoogleCalendarProvider}
 */
export const nullGoogleCalendarProvider = {
  async createEvent() {
    throw new GoogleCalendarProviderError("google_not_configured", {
      code: "not_configured",
      status: 0,
    });
  },
  async updateEvent() {
    throw new GoogleCalendarProviderError("google_not_configured", {
      code: "not_configured",
      status: 0,
    });
  },
  async deleteEvent() {
    throw new GoogleCalendarProviderError("google_not_configured", {
      code: "not_configured",
      status: 0,
    });
  },
  async findEventByMcsJobId() {
    return [];
  },
};
