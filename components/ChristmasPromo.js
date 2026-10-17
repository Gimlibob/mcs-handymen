"use client";

import { CHRISTMAS_LIGHT_SERVICE } from "@/lib/site-config";
import { selectServiceInquiry } from "@/lib/service-inquiry";
import { PrimaryLink } from "./Buttons";

const BULB_COLORS = ["#ff5a5a", "#ffd166", "#4ade80", "#60a5fa", "#fb923c"];
const ROW_BULBS = 12;
const COLUMN_BULBS = 4;

function Bulb({ index, rotate }) {
  return (
    <span
      className="xmas-bulb block h-4 w-2.5"
      style={{
        "--bulb": BULB_COLORS[index % BULB_COLORS.length],
        transform: `rotate(${rotate}deg)`,
        animationDelay: `${-(index % 5) * 0.8}s`,
      }}
    >
      <svg viewBox="0 0 10 16" className="h-full w-full">
        <rect x="3" y="0" width="4" height="4" rx="1" fill="#5c5a55" />
        <ellipse cx="5" cy="10" rx="4" ry="5.5" fill="currentColor" />
        <ellipse cx="3.6" cy="8.4" rx="1.1" ry="1.8" fill="#fff" opacity="0.55" />
      </svg>
    </span>
  );
}

function BulbStrand({ count, offset, rotate, className }) {
  return (
    <div className={`pointer-events-none absolute flex ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <Bulb key={i} index={offset + i} rotate={rotate} />
      ))}
    </div>
  );
}

export default function ChristmasPromo() {
  return (
    <aside
      aria-labelledby="christmas-promo-title"
      className="relative mx-auto mt-8 max-w-2xl p-6"
    >
      <div aria-hidden="true">
        <div className="pointer-events-none absolute inset-3 rounded-2xl border border-[#3d6b47]" />
        <BulbStrand
          count={ROW_BULBS}
          offset={0}
          rotate={180}
          className="inset-x-8 top-3 -translate-y-1/2 justify-between"
        />
        <BulbStrand
          count={COLUMN_BULBS}
          offset={ROW_BULBS}
          rotate={-90}
          className="inset-y-8 right-3 translate-x-1/2 flex-col justify-around"
        />
        <BulbStrand
          count={ROW_BULBS}
          offset={ROW_BULBS + COLUMN_BULBS}
          rotate={0}
          className="inset-x-8 bottom-3 translate-y-1/2 justify-between"
        />
        <BulbStrand
          count={COLUMN_BULBS}
          offset={ROW_BULBS * 2 + COLUMN_BULBS}
          rotate={90}
          className="inset-y-8 left-3 -translate-x-1/2 flex-col justify-around"
        />
      </div>

      <div className="relative rounded-xl border border-gold/50 bg-surface-2 px-5 py-7 text-center sm:px-8">
        <h3
          id="christmas-promo-title"
          className="font-heading text-xl font-bold text-foreground sm:text-2xl"
        >
          Christmas Light Installation
        </h3>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted sm:text-base">
          Get your home ready for the holidays. Send us photos of your home to request a quote.
        </p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-gold-bright">
          Now booking for the holiday season.
        </p>
        <PrimaryLink
          href="#quote"
          onClick={(event) => {
            event.preventDefault();
            selectServiceInquiry(CHRISTMAS_LIGHT_SERVICE);
          }}
          className="mt-6 sm:min-w-[220px]"
        >
          Request a Quote
        </PrimaryLink>
      </div>
    </aside>
  );
}
