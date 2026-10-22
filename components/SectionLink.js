"use client";

import Link from "next/link";

/**
 * Link to a page section (e.g. "/#quote"). When the section exists on the
 * current page, scroll to it in place, even if the URL already has that hash.
 * Otherwise fall back to normal navigation.
 */
export default function SectionLink({ href, onClick, children, ...props }) {
  function handleClick(event) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const id = href.split("#")[1];
    const target = id ? document.getElementById(id) : null;
    if (!target) return;

    event.preventDefault();
    if (window.location.hash !== `#${id}`) {
      window.history.pushState(null, "", `#${id}`);
    }
    // Wait for the mobile menu to close so the layout is final before scrolling.
    requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
