import Link from "next/link";
import { logoutAction } from "@/lib/cc/auth/actions";
import { SITE_NAME } from "@/lib/site-config";

const NAV = [
  { href: "/command-center", label: "Dashboard", exact: true },
  { href: "/command-center/leads", label: "Leads", exact: false },
  { href: "/command-center/customers", label: "Customers", exact: false },
  { href: "/command-center/workers", label: "Workers", exact: false },
  { href: "/command-center/playbook", label: "Playbook", exact: false },
];

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function CommandCenterShell({
  pathname = "/command-center",
  showClock = false,
  /** Compact chrome so the Dashboard can fit in one desktop viewport. */
  fitViewport = false,
  children,
}) {
  const clock = showClock
    ? new Date().toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className={`min-h-full flex-1 bg-background text-foreground ${
        fitViewport ? "xl:flex xl:h-[100vh] xl:max-h-[100vh] xl:flex-col xl:overflow-hidden" : ""
      }`}
    >
      <header className="shrink-0 border-b border-border-soft bg-surface/90 backdrop-blur">
        <div
          className={`mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 ${
            fitViewport ? "py-3 xl:py-3" : "py-5"
          }`}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-bright">
              {SITE_NAME}
            </p>
            <p
              className={`mt-0.5 font-heading font-bold text-foreground ${
                fitViewport ? "text-lg xl:text-xl" : "text-xl sm:text-2xl"
              }`}
            >
              MCS Command Center
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <nav aria-label="Command Center" className="flex flex-wrap items-center gap-1">
              {NAV.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border border-gold-dim/50 bg-surface-2 text-gold-bright"
                        : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <form action={logoutAction} className="ml-1">
                <button
                  type="submit"
                  className="rounded-lg border border-border-soft px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-gold hover:text-gold-bright"
                >
                  Sign out
                </button>
              </form>
            </nav>
            {clock ? (
              <p className="hidden text-xs text-muted tabular-nums lg:block">{clock}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div
        className={`mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 ${
          fitViewport
            ? "py-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden xl:py-4"
            : "py-9"
        }`}
      >
        {children}
      </div>

      {!fitViewport ? (
        <footer className="border-t border-border-soft">
          <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6 lg:px-8">
            <p className="text-xs text-muted">
              <span className="font-medium uppercase tracking-[0.16em] text-gold-dim">
                {SITE_NAME}
              </span>
              <span className="mx-2 text-border-soft">·</span>
              Build. Fix. Maintain.
            </p>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
