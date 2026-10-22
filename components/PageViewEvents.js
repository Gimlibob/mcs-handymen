"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackClientPageView } from "@/lib/contact-tracking";

// GTM sees the first page load on its own; client-side navigations (including the
// move to a Thank you page) do not reload it, so they are reported here.
export default function PageViewEvents() {
  const pathname = usePathname();
  const lastPathname = useRef(pathname);

  useEffect(() => {
    if (pathname === lastPathname.current) return;
    lastPathname.current = pathname;
    trackClientPageView(pathname);
  }, [pathname]);

  return null;
}
