import {
  Video,
  PaintRoller,
  Wind,
  BellRing,
  Droplets,
  DoorClosed,
} from "lucide-react";
import { SERVICES } from "@/lib/site-config";

const ICONS = {
  "doorbell-cameras": Video,
  "drywall-repair": PaintRoller,
  "air-filter-swaps": Wind,
  "smoke-detectors": BellRing,
  "caulking-sealing": Droplets,
  "hollow-core-door": DoorClosed,
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

        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {SERVICES.map((service) => {
            const Icon = ICONS[service.id] ?? DoorClosed;
            return (
              <div
                key={service.id}
                className="flex flex-col items-center gap-3 rounded-xl border border-border-soft bg-surface p-4 text-center transition-colors hover:border-gold/60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2">
                  <Icon className="h-5 w-5 text-gold-bright" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium leading-snug text-foreground">
                  {service.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
