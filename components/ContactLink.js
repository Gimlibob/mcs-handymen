"use client";

import { useRouter } from "next/navigation";
import { THANK_YOU_PATHS, trackContactClick } from "@/lib/contact-tracking";

// The mailto:/sms: default action is never prevented: the email or SMS app opens first,
// and the client-side move to the Thank you page happens afterwards without reloading.
const THANK_YOU_DELAY_MS = 800;

export default function ContactLink({ method, href, className, children }) {
  const router = useRouter();

  function handleClick(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    trackContactClick(method);

    const thankYouPath = THANK_YOU_PATHS[method];
    const startPath = window.location.pathname;
    if (!thankYouPath || startPath === thankYouPath) return;

    window.setTimeout(() => {
      if (window.location.pathname === startPath) {
        router.push(thankYouPath);
      }
    }, THANK_YOU_DELAY_MS);
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
