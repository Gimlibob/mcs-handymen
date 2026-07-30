/**
 * Full-width Google Map of the general service region (south Houston area).
 * No place pin / address — view-only embed + subtle gold region overlay.
 */
export default function ServiceAreaMap() {
  // Centered on the Manvel / Iowa Colony / Rosharon / Pearland / Alvin /
  // Fresno / Arcola corridor. Zoomed out to show the region, not a single address.
  // Uses ll= (center) without q= so Google does not drop a business pin.
  const mapSrc =
    "https://maps.google.com/maps?ll=29.455,-95.38&z=10&hl=en&t=m&output=embed";

  return (
    <div className="mt-10 w-full">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.22em] text-gold-bright">
          Our Service Area
        </h2>
        <p className="mt-2 text-base text-muted">We come to you.</p>
      </div>

      <div className="relative mt-5 w-full overflow-hidden border-y border-border-soft bg-surface">
        <div className="relative h-[220px] w-full md:h-[340px]">
          <iframe
            title="Service area map"
            src={mapSrc}
            className="absolute inset-0 h-full w-full border-0 grayscale-[20%] contrast-[1.05]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />

          {/* Subtle gold service-region outline (visual only — no labels or pins) */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <div
              className="h-[72%] w-[78%] max-w-3xl rounded-full border-2 border-gold/45 bg-gold/10 shadow-[0_0_40px_rgba(205,164,76,0.12)] md:h-[78%] md:w-[62%]"
            />
          </div>

          {/* Soft edge fade into the black page chrome */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/35 via-transparent to-background/50"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
