import QuoteForm from "./QuoteForm";

export default function QuoteSection() {
  return (
    <section id="quote" className="border-t border-border-soft bg-surface/40 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-xl">
        <h2 className="text-center font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Request a Quote
        </h2>
        <p className="mt-3 text-center text-sm text-muted">
          Fill out the form below and include a few photos — it&apos;s the fastest way to get an
          accurate quote.
        </p>
        <div className="mt-8">
          <QuoteForm />
        </div>
      </div>
    </section>
  );
}
