/**
 * Safe Google Calendar event payload builder (pure).
 * No PII beyond operational Job snapshot fields listed below.
 */

import { SITE_URL } from "../../site-config.js";
import { truncateScopeSummary } from "./customer-jobs.js";
import { buildGoogleEventTimeRange } from "./google-calendar-event-time.js";

function mcsEnvLabel() {
  const v = (process.env.VERCEL_ENV || process.env.NODE_ENV || "").toLowerCase();
  if (v === "production") return "production";
  if (v === "preview") return "preview";
  return "development";
}

/**
 * @param {{
 *   job: object,
 *   customerName?: string | null,
 *   workerName?: string | null,
 *   cancelled?: boolean
 * }} args
 */
export function buildGoogleCalendarEventPayload({
  job,
  customerName = null,
  workerName = null,
  cancelled = false,
}) {
  if (!job || typeof job !== "object") return null;

  const name =
    (typeof customerName === "string" && customerName.trim()) ||
    job.customer_name ||
    "Customer";
  const serviceType =
    (typeof job.service_type === "string" && job.service_type.trim()) || "Job";

  const baseTitle = `MCS — ${name} — ${serviceType}`;
  const summary = cancelled ? `CANCELLED — ${baseTitle}` : baseTitle;

  const time = buildGoogleEventTimeRange(job.scheduled_date, job.scheduled_window);
  if (!time) return null;

  const worker =
    (typeof workerName === "string" && workerName.trim()) ||
    job.assigned_worker_name ||
    "Unassigned";

  const scope = truncateScopeSummary(job.scope_summary || "", 240);
  const city =
    typeof job.service_city === "string" ? job.service_city.trim() : "";
  const property =
    typeof job.property_type === "string" ? job.property_type.trim() : "";

  const lines = [
    `Job ID: ${job.id}`,
    `Service type: ${serviceType}`,
    city ? `Service city: ${city}` : null,
    property ? `Property type: ${property}` : null,
    scope ? `Scope: ${scope}` : null,
    `Assigned worker: ${worker}`,
    `Open in MCS: ${SITE_URL}/command-center/jobs/${job.id}`,
  ].filter(Boolean);

  const start =
    time.kind === "all_day"
      ? { date: time.startDate }
      : { dateTime: time.startDateTime, timeZone: time.timeZone };
  const end =
    time.kind === "all_day"
      ? { date: time.endDate }
      : { dateTime: time.endDateTime, timeZone: time.timeZone };

  return {
    summary,
    description: lines.join("\n"),
    location: city || undefined,
    start,
    end,
    extendedProperties: {
      private: {
        mcsJobId: String(job.id),
        mcsEnv: mcsEnvLabel(),
      },
    },
  };
}
