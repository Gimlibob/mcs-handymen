"use client";

import {
  Fan,
  Wrench,
  PaintRoller,
  Package,
  DoorClosed,
  PanelTop,
  LayoutGrid,
  Tv,
  Video,
  Wind,
  BellRing,
  Droplets,
  Camera,
  Thermometer,
  Blinds,
  SquareStack,
} from "lucide-react";
import { SERVICES, FACEBOOK_URL } from "@/lib/site-config";
import { selectServiceInquiry } from "@/lib/service-inquiry";
import { PrimaryLink, SecondaryLink } from "./Buttons";
import FacebookIcon from "./icons/FacebookIcon";

const ICONS = {
  "ceiling-fan-light": Fan,
  "plumbing-fixture": Wrench,
  "drywall-patching": PaintRoller,
  "furniture-assembly": Package,
  "door-lock-hardware": DoorClosed,
  rescreening: PanelTop,
  "wall-mounts-shelving": LayoutGrid,
  "tv-mounting": Tv,
  "doorbell-cameras": Video,
  "air-filter-swaps": Wind,
  "smoke-detectors": BellRing,
  "caulking-sealing": Droplets,
  "hollow-core-door": DoorClosed,
  weatherstripping: Thermometer,
  "blind-curtain-rods": Blinds,
  "cabinet-hardware": SquareStack,
};

export default function Services() {
  return (
    <section id="services" className="border-t border-border-soft bg-surface/40 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Services We Handle
        </h2>

        <p className="mx-auto mt-5 max-w-3xl rounded-xl border border-gold/50 bg-surface-2 px-4 py-3.5 text-center text-sm leading-relaxed text-gold-bright sm:px-6 sm:text-base">
          Small repairs &amp; maintenance only &bull; No roofing &bull; No major remodeling or
          structural work &bull; No major plumbing or electrical &bull; Labor only — materials
          extra &bull; Minimum service call fee applies
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
          {SERVICES.map((service) => {
            const Icon = ICONS[service.id] ?? DoorClosed;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => selectServiceInquiry(service.name)}
                className="flex min-h-[120px] w-full flex-col items-center gap-3 rounded-xl border border-border-soft bg-surface p-4 text-center transition-colors hover:border-gold/60 hover:bg-surface-2 focus-visible:border-gold active:scale-[0.98]"
                aria-label={`Request a quote for ${service.name}`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2">
                  <Icon className="h-5 w-5 text-gold-bright" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium leading-snug text-foreground">
                  {service.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-10 flex w-full max-w-xl flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <PrimaryLink href="#quote" className="sm:min-w-[240px]">
            <Camera className="h-5 w-5" aria-hidden="true" />
            Send Project Photos
          </PrimaryLink>
          <SecondaryLink href={FACEBOOK_URL} external className="sm:min-w-[240px]">
            <FacebookIcon className="h-5 w-5" />
            Visit Us on Facebook
          </SecondaryLink>
        </div>
      </div>
    </section>
  );
}
