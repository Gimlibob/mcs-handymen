import Link from "next/link";
import { Mail } from "lucide-react";
import FacebookIcon from "./icons/FacebookIcon";
import Logo from "./Logo";
import { FACEBOOK_URL, BACKUP_EMAIL, MAILTO_HREF } from "@/lib/site-config";
import { SERVICE_AREA_PAGES } from "@/lib/service-areas";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border-soft bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
        <Logo />

        <nav aria-label="Service areas" className="flex flex-col items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-bright">
            Service Areas
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {SERVICE_AREA_PAGES.map((area) => (
              <li key={area.slug}>
                <Link
                  href={`/${area.slug}`}
                  className="text-sm font-medium text-muted transition-colors hover:text-gold-bright"
                >
                  {area.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-gold-bright"
          >
            <FacebookIcon className="h-4 w-4" />
            Facebook
          </a>
          <a
            href={MAILTO_HREF}
            className="inline-flex items-center gap-2 text-sm text-muted/80 transition-colors hover:text-gold-bright"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {BACKUP_EMAIL}
          </a>
        </div>

        <p className="text-xs text-muted/70">
          &copy; 2026 MCS Handymen. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
