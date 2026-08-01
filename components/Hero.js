import { Shield } from "lucide-react";
import ServiceAreaMap from "./ServiceAreaMap";

export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden">
      {/* Subtle decorative background, kept quiet so the logo/text stay primary */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-background.svg"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
      </div>

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:pb-10 sm:pt-24">
        <h1 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl md:text-5xl">
          Small Repairs &amp;
          <br />
          <span className="text-gold-bright">Property Maintenance</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          For homes, rental property maintenance &amp; light commercial service.
        </p>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/50 bg-surface/80 px-4 py-2 text-sm font-medium text-gold-bright shadow-[0_0_24px_rgba(205,164,76,0.08)]">
          <Shield className="h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          <span>Fully Insured (General Liability)</span>
        </div>
      </div>

      <div className="relative pb-12">
        <ServiceAreaMap />
      </div>
    </section>
  );
}
