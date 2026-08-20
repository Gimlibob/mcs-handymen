import { ImageIcon } from "lucide-react";

/**
 * Before & After Gallery — not shown on the homepage until real project photos exist.
 *
 * To activate once you have your own completed-project photos:
 *   1. Add photo pairs to /public/images/gallery/.
 *   2. Replace the placeholder block below with an <img> grid of your photos.
 *   3. Import and render <Gallery /> again in HomePage.js
 *      (between HowItWorks and QuoteSection).
 */
export default function Gallery() {
  return (
    <section className="border-t border-border-soft px-4 py-14 sm:px-6" aria-labelledby="gallery-heading">
      <div className="mx-auto max-w-4xl text-center">
        <h2 id="gallery-heading" className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Gallery
        </h2>
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-soft bg-surface/40 px-6 py-10">
          <ImageIcon className="h-8 w-8 text-muted" aria-hidden="true" />
          <p className="text-sm text-muted">Project photos coming soon.</p>
        </div>
      </div>
    </section>
  );
}
