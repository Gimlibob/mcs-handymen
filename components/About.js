export default function About() {
  return (
    <section
      id="about"
      className="border-t border-border-soft bg-background px-4 py-10 sm:px-6 sm:py-12"
      aria-labelledby="about-heading"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="about-heading"
          className="font-heading text-xl font-bold text-foreground sm:text-2xl"
        >
          About MCS Handymen
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-base">
          MCS Handymen provides practical help for homeowners, landlords, property managers, and
          small businesses needing small repairs and property maintenance. We focus on clear
          communication, respect for your property, and straightforward service in Manvel, Iowa
          Colony, Rosharon, Alvin, and nearby areas.
        </p>
      </div>
    </section>
  );
}
