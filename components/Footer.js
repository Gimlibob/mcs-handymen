import { Mail } from "lucide-react";
import FacebookIcon from "./icons/FacebookIcon";
import Logo from "./Logo";
import { SERVICE_AREA, FACEBOOK_URL, BACKUP_EMAIL } from "@/lib/site-config";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border-soft bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
        <Logo />

        <p className="text-sm text-muted">Serving {SERVICE_AREA}</p>

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
            href={`mailto:${BACKUP_EMAIL}`}
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
