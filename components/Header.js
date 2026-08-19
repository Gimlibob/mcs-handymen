"use client";

import { useState } from "react";
import { Menu, X, Camera } from "lucide-react";
import Logo from "./Logo";
import { NAV_LINKS, FACEBOOK_URL } from "@/lib/site-config";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border-soft bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a href="#home" className="min-w-0 flex-1 md:flex-none" aria-label="MCS Handymen home">
          <Logo />
        </a>

        {/* Desktop nav */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 md:flex"
        >
          {NAV_LINKS.map((link) =>
            link.label === "Facebook" ? (
              <a
                key={link.href}
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-muted transition-colors hover:text-gold-bright"
              >
                {link.label}
              </a>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted transition-colors hover:text-gold-bright"
              >
                {link.label}
              </a>
            )
          )}
        </nav>

        <div className="hidden md:block">
          <a
            href="#quote"
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-bright"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            Send Project Photos
          </a>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border-soft text-gold-bright md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile nav panel */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Primary mobile"
          className="border-t border-border-soft bg-background px-4 pb-4 pt-2 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) =>
              link.label === "Facebook" ? (
                <a
                  key={link.href}
                  href={FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-3 py-3 text-base font-medium text-muted hover:bg-surface hover:text-gold-bright"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-3 text-base font-medium text-muted hover:bg-surface hover:text-gold-bright"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              )
            )}
          </div>
          <a
            href="#quote"
            onClick={() => setOpen(false)}
            className="mt-3 flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-gold px-4 text-base font-semibold text-black hover:bg-gold-bright"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            Send Project Photos
          </a>
        </nav>
      )}
    </header>
  );
}
