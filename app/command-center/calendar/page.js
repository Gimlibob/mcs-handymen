import Link from "next/link";
import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import {
  listJobsForCalendarRange,
  listNeedsSchedulingJobs,
} from "@/lib/cc/db/jobs";
import { listWorkers } from "@/lib/cc/db/workers";
import {
  addCalendarDays,
  addCalendarMonths,
  chicagoToday,
  formatCalendarDate,
  formatMonthHeading,
  isValidCalendarDateString,
  mondayWeekContaining,
  monthGridContaining,
  normalizeMonthParam,
} from "@/lib/cc/domain/chicago-date";
import {
  compareJobsForCalendarDay,
  isLegacyNeedsDate,
  scheduleWindowLabel,
} from "@/lib/cc/domain/job-scheduling";
import { JOB_STATUSES, jobStatusLabel } from "@/lib/cc/domain/job-status";

export const metadata = {
  title: "Calendar",
};

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_CHIP_LIMIT = 3;

function parseView(sp) {
  const raw = typeof sp?.view === "string" ? sp.view.trim().toLowerCase() : "";
  return raw === "month" ? "month" : "week";
}

function buildCalendarHref({
  view = "week",
  weekStart = null,
  monthStart = null,
  workerId = null,
  status = null,
}) {
  const params = new URLSearchParams();
  if (view === "month") {
    params.set("view", "month");
    if (monthStart) params.set("month", monthStart);
  } else if (weekStart) {
    params.set("week", weekStart);
  }
  if (workerId) params.set("worker_id", workerId);
  if (status) params.set("status", status);
  const q = params.toString();
  return q ? `/command-center/calendar?${q}` : "/command-center/calendar";
}

function bucketJobsByDay(days, jobs) {
  const byDay = Object.fromEntries(days.map((d) => [d, []]));
  for (const job of jobs) {
    const d = job.scheduled_date;
    if (d && byDay[d]) byDay[d].push(job);
  }
  for (const d of days) {
    byDay[d].sort(compareJobsForCalendarDay);
  }
  return byDay;
}

function dayNumber(ymd) {
  return ymd.slice(8, 10).replace(/^0/, "") || ymd.slice(8, 10);
}

export default async function CalendarPage({ searchParams }) {
  await requireOwner();
  const sp = await searchParams;

  const view = parseView(sp);
  const today = chicagoToday();

  const workerParam =
    typeof sp?.worker_id === "string" && sp.worker_id.trim()
      ? sp.worker_id.trim()
      : null;
  const statusParam =
    typeof sp?.status === "string" && JOB_STATUSES.includes(sp.status)
      ? sp.status
      : null;

  const weekParam =
    typeof sp?.week === "string" && isValidCalendarDateString(sp.week)
      ? sp.week
      : null;
  const monthParam = normalizeMonthParam(
    typeof sp?.month === "string" ? sp.month : null
  );

  const week = mondayWeekContaining(weekParam);
  const month = monthGridContaining(monthParam);

  const rangeStart = view === "month" ? month.gridStart : week.weekStart;
  const rangeEnd = view === "month" ? month.gridEnd : week.weekEnd;
  const days = view === "month" ? month.days : week.days;

  const [jobs, needs, workers] = await Promise.all([
    listJobsForCalendarRange({
      weekStart: rangeStart,
      weekEnd: rangeEnd,
      workerId: workerParam,
      status: statusParam,
    }),
    listNeedsSchedulingJobs({ limit: 30 }),
    listWorkers({ limit: 200 }).catch(() => []),
  ]);

  const byDay = bucketJobsByDay(days, jobs);

  const prevWeek = addCalendarDays(week.weekStart, -7);
  const nextWeek = addCalendarDays(week.weekStart, 7);
  const prevMonth = addCalendarMonths(month.monthStart, -1);
  const nextMonth = addCalendarMonths(month.monthStart, 1);

  const filterHiddenDate =
    view === "month" ? (
      <input type="hidden" name="month" value={month.monthStart} />
    ) : (
      <input type="hidden" name="week" value={week.weekStart} />
    );

  return (
    <CommandCenterShell pathname="/command-center/calendar">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Calendar
            </h1>
            <p className="mt-1 text-sm text-muted">
              {view === "month"
                ? `${formatMonthHeading(month.monthStart)} · America/Chicago`
                : `Week of ${formatCalendarDate(week.weekStart)} · America/Chicago`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div
              className="inline-flex rounded-lg border border-border-soft p-0.5"
              role="group"
              aria-label="Calendar view"
            >
              <Link
                href={buildCalendarHref({
                  view: "week",
                  weekStart: weekParam || (view === "week" ? week.weekStart : null),
                  workerId: workerParam,
                  status: statusParam,
                })}
                className={
                  view === "week"
                    ? "rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-black"
                    : "rounded-md px-3 py-1.5 text-sm text-muted hover:text-gold-bright"
                }
              >
                Week
              </Link>
              <Link
                href={buildCalendarHref({
                  view: "month",
                  monthStart: monthParam || (view === "month" ? month.monthStart : null),
                  workerId: workerParam,
                  status: statusParam,
                })}
                className={
                  view === "month"
                    ? "rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-black"
                    : "rounded-md px-3 py-1.5 text-sm text-muted hover:text-gold-bright"
                }
              >
                Month
              </Link>
            </div>
            {view === "month" ? (
              <>
                <Link
                  href={buildCalendarHref({
                    view: "month",
                    monthStart: prevMonth,
                    workerId: workerParam,
                    status: statusParam,
                  })}
                  className="rounded-lg border border-border-soft px-3 py-2 text-sm text-muted hover:text-gold-bright"
                >
                  ← Prev
                </Link>
                <Link
                  href={buildCalendarHref({
                    view: "month",
                    monthStart: null,
                    workerId: workerParam,
                    status: statusParam,
                  })}
                  className="rounded-lg border border-border-soft px-3 py-2 text-sm text-muted hover:text-gold-bright"
                >
                  This month
                </Link>
                <Link
                  href={buildCalendarHref({
                    view: "month",
                    monthStart: nextMonth,
                    workerId: workerParam,
                    status: statusParam,
                  })}
                  className="rounded-lg border border-border-soft px-3 py-2 text-sm text-muted hover:text-gold-bright"
                >
                  Next →
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={buildCalendarHref({
                    view: "week",
                    weekStart: prevWeek,
                    workerId: workerParam,
                    status: statusParam,
                  })}
                  className="rounded-lg border border-border-soft px-3 py-2 text-sm text-muted hover:text-gold-bright"
                >
                  ← Prev
                </Link>
                <Link
                  href={buildCalendarHref({
                    view: "week",
                    weekStart: null,
                    workerId: workerParam,
                    status: statusParam,
                  })}
                  className="rounded-lg border border-border-soft px-3 py-2 text-sm text-muted hover:text-gold-bright"
                >
                  This week
                </Link>
                <Link
                  href={buildCalendarHref({
                    view: "week",
                    weekStart: nextWeek,
                    workerId: workerParam,
                    status: statusParam,
                  })}
                  className="rounded-lg border border-border-soft px-3 py-2 text-sm text-muted hover:text-gold-bright"
                >
                  Next →
                </Link>
              </>
            )}
          </div>
        </div>

        <form
          method="get"
          action="/command-center/calendar"
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-soft bg-surface p-4"
        >
          {view === "month" ? (
            <input type="hidden" name="view" value="month" />
          ) : null}
          {filterHiddenDate}
          <div>
            <label htmlFor="cal-worker" className="mb-1 block text-xs text-muted">
              Worker
            </label>
            <select
              id="cal-worker"
              name="worker_id"
              defaultValue={workerParam || ""}
              className="rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-foreground"
            >
              <option value="">All</option>
              <option value="unassigned">Unassigned</option>
              {workers
                .filter((w) => w.status === "active")
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.display_name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="cal-status" className="mb-1 block text-xs text-muted">
              Status
            </label>
            <select
              id="cal-status"
              name="status"
              defaultValue={statusParam || ""}
              className="rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm text-foreground"
            >
              <option value="">All</option>
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {jobStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-bright"
          >
            Apply
          </button>
        </form>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="min-w-0 overflow-x-auto xl:col-span-9">
            {view === "month" ? (
              <div className="min-w-[900px]">
                <div className="mb-1 grid grid-cols-7 gap-1">
                  {WEEKDAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="px-1 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day) => {
                    const inMonth =
                      day >= month.monthStart && day <= month.monthEnd;
                    const isToday = day === today;
                    const dayJobs = byDay[day] || [];
                    const visible = dayJobs.slice(0, MONTH_CHIP_LIMIT);
                    const overflow = dayJobs.length - visible.length;
                    const weekForDay = mondayWeekContaining(day);
                    return (
                      <div
                        key={day}
                        className={[
                          "min-h-[7.5rem] rounded-lg border p-1.5",
                          inMonth
                            ? "border-border-soft bg-surface"
                            : "border-border-soft/50 bg-surface-2/40 opacity-55",
                          isToday ? "ring-1 ring-gold/40" : "",
                        ].join(" ")}
                        data-outside-month={inMonth ? "0" : "1"}
                        data-calendar-day={day}
                      >
                        <p
                          className={[
                            "text-[11px] font-semibold tabular-nums",
                            inMonth ? "text-muted" : "text-muted/70",
                            isToday ? "text-gold-bright" : "",
                          ].join(" ")}
                        >
                          {dayNumber(day)}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {visible.map((job) => (
                            <li key={job.id}>
                              <Link
                                href={`/command-center/jobs/${job.id}`}
                                className="block rounded border border-border-soft bg-surface-2 px-1.5 py-1 text-[10px] leading-snug hover:border-gold"
                              >
                                <span className="font-medium text-gold-bright">
                                  {scheduleWindowLabel(job.scheduled_window)}
                                </span>
                                <span className="mt-0.5 block truncate text-foreground">
                                  {job.customer_name || "Customer"}
                                </span>
                                <span className="block truncate text-muted">
                                  {job.service_type}
                                </span>
                              </Link>
                            </li>
                          ))}
                          {overflow > 0 ? (
                            <li>
                              <Link
                                href={buildCalendarHref({
                                  view: "week",
                                  weekStart: weekForDay.weekStart,
                                  workerId: workerParam,
                                  status: statusParam,
                                })}
                                className="block px-1 py-0.5 text-[10px] font-medium text-gold-bright hover:underline"
                              >
                                +{overflow} more
                              </Link>
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid min-w-[900px] grid-cols-7 gap-2">
                {days.map((day) => (
                  <div
                    key={day}
                    className="rounded-xl border border-border-soft bg-surface p-2"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {formatCalendarDate(day)}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {(byDay[day] || []).length === 0 ? (
                        <li className="text-xs text-muted">—</li>
                      ) : (
                        (byDay[day] || []).map((job) => (
                          <li key={job.id}>
                            <Link
                              href={`/command-center/jobs/${job.id}`}
                              className="block rounded-lg border border-border-soft bg-surface-2 px-2 py-1.5 text-xs hover:border-gold"
                            >
                              <p className="font-medium text-gold-bright">
                                {scheduleWindowLabel(job.scheduled_window)} ·{" "}
                                {job.customer_name || "Customer"}
                              </p>
                              <p className="mt-0.5 text-muted">
                                {job.service_city} · {job.service_type}
                              </p>
                              <p className="mt-0.5 text-muted">
                                {job.assigned_worker_name || "Unassigned"} ·{" "}
                                {jobStatusLabel(job.status)}
                              </p>
                            </Link>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="xl:col-span-3">
            <section className="rounded-2xl border border-border-soft bg-surface p-4">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Needs Scheduling
              </h2>
              <p className="mt-1 text-xs text-muted">
                Authorized without a date, plus legacy Scheduled without a date.
              </p>
              <ul className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">
                {needs.length === 0 ? (
                  <li className="text-sm text-muted">Queue is clear.</li>
                ) : (
                  needs.map((job) => (
                    <li key={job.id}>
                      <Link
                        href={`/command-center/jobs/${job.id}`}
                        className="block rounded-lg border border-border-soft px-3 py-2 text-sm hover:border-gold"
                      >
                        <p className="font-medium text-gold-bright">
                          {job.customer_name}
                        </p>
                        <p className="text-xs text-muted">
                          {job.service_type} · {job.service_city}
                        </p>
                        <p className="mt-1 text-[11px] text-muted">
                          {jobStatusLabel(job.status)}
                          {isLegacyNeedsDate(job) ? (
                            <span className="ml-2 rounded-full border border-amber-500/40 px-1.5 py-0.5 text-amber-100">
                              Needs date
                            </span>
                          ) : null}
                        </p>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </CommandCenterShell>
  );
}
