// lucide-react does not ship brand/logo icons, so this small custom SVG
// covers the Facebook glyph used throughout the site.
export default function FacebookIcon({ className = "h-5 w-5", ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M13.5 21v-7.6h2.55l.4-2.95h-2.95V8.55c0-.85.24-1.43 1.46-1.43h1.55V4.5c-.27-.04-1.2-.12-2.28-.12-2.26 0-3.8 1.38-3.8 3.9v2.17H8.05v2.95h2.38V21h3.07z" />
    </svg>
  );
}
