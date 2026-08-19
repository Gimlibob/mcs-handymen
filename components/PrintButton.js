"use client";

export default function PrintButton({ label = "Print / Save as PDF" }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[44px] items-center rounded-lg border border-gold/50 bg-surface px-4 text-sm font-medium text-gold-bright hover:border-gold"
    >
      {label}
    </button>
  );
}
