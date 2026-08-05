import QuoteForm from "./QuoteForm";

export default function QuoteSection({ initialCity = "" }) {
  return (
    <section id="quote" className="border-t border-border-soft bg-surface/40 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-xl">
        <h2 className="text-center font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Request a Quote
        </h2>
        <p className="mt-3 text-center text-sm text-muted">
          Fill out the form below and include a few photos so we can review your project and send a
          quote.
        </p>
        <div className="mt-8">
          <QuoteForm initialCity={initialCity} />
        </div>
      </div>
    </section>
  );
}
