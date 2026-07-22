import { Camera } from "lucide-react";
import FacebookIcon from "./icons/FacebookIcon";
import { PrimaryLink, SecondaryLink } from "./Buttons";
import { SERVICE_AREA, FACEBOOK_URL } from "@/lib/site-config";

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

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24">
        <h1 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl md:text-5xl">
          Reliable Handyman Services in{" "}
          <span className="text-gold-bright">Manvel, Iowa Colony &amp; Rosharon, TX</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Light repairs, residential services, and property turnover support.
          Send photos of your project for a fast quote.
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <PrimaryLink href="#quote" className="sm:min-w-[240px]">
            <Camera className="h-5 w-5" aria-hidden="true" />
            Send Project Photos
          </PrimaryLink>
          <SecondaryLink href={FACEBOOK_URL} external className="sm:min-w-[240px]">
            <FacebookIcon className="h-5 w-5" />
            Visit Us on Facebook
          </SecondaryLink>
        </div>

        <p className="mt-6 text-sm text-muted">Serving {SERVICE_AREA}</p>
      </div>
    </section>
  );
}
