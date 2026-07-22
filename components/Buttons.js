/**
 * Shared button styles so every CTA on the site looks and behaves the same.
 * Big touch targets (min 48px tall) per the mobile-first requirement.
 */

const base =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-semibold transition-colors sm:w-auto min-h-[52px]";

export function PrimaryLink({ href, children, external = false, className = "", ...props }) {
  return (
    <a
      href={href}
      className={`${base} bg-gold text-black hover:bg-gold-bright active:bg-gold-dim ${className}`}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      {...props}
    >
      {children}
    </a>
  );
}

export function SecondaryLink({ href, children, external = false, className = "", ...props }) {
  return (
    <a
      href={href}
      className={`${base} border-2 border-gold bg-transparent text-gold-bright hover:bg-surface-2 active:bg-surface ${className}`}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      {...props}
    >
      {children}
    </a>
  );
}
