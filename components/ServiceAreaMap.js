/**
 * Google Map of the general service region (south Houston area).
 * Constrained to content width. Static view — no pin, no drag away from region.
 */
export default function ServiceAreaMap() {
  // Centered on the Manvel / Iowa Colony / Rosharon / Pearland / Alvin /
  // Fresno / Arcola corridor. Zoomed out to show the region, not a single address.
  // Uses ll= (center) without q= so Google does not drop a business pin.
  const mapSrc =
    "https://maps.google.com/maps?ll=29.455,-95.38&z=10&hl=en&t=m&output=embed";

  return (
    <div className="mx-auto mt-10 w-full max-w-3xl px-4 sm:px-6">
      <div className="text-center">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.22em] text-gold-bright">
          Our Service Area
        </h2>
        <p className="mt-2 text-base text-muted">We come to you.</p>
      </div>

      <div className="relative mt-5 w-full overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="relative h-[220px] w-full md:h-[340px]">
          <iframe
            title="Service area map"
            src={mapSrc}
            className="pointer-events-none absolute inset-0 h-full w-full border-0 grayscale-[20%] contrast-[1.05]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            tabIndex={-1}
          />

          {/* Soft edge fade into the black page chrome */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/25 via-transparent to-background/40"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
