"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { SERVICE_AREA } from "@/lib/site-config";
import "leaflet/dist/leaflet.css";

/** Exact golden polygon vertices [lat, lng] */
export const SERVICE_POLYGON = [
  [29.504596, -95.22707],
  [29.390749, -95.215308],
  [29.396914, -95.460597],
  [29.504194, -95.437306],
  [29.528872, -95.348788],
];

/** Operational base (fallback center only — never shown as a pin/address) */
export const MAP_CENTER = { lat: 29.4651, lng: -95.3378 };

const GOLD_STROKE = "#d4af37";
const GOLD_FILL_OPACITY = 0.2;
const FIT_PADDING = 24;

const GOOGLE_MAPS_URL = `https://www.google.com/maps/@${MAP_CENTER.lat},${MAP_CENTER.lng},12z`;

function resetMapContainer(container) {
  if (!container) return;
  if (container._leaflet_id) {
    container._leaflet_id = undefined;
  }
  container.innerHTML = "";
}

function destroyMap(map, container) {
  if (map) {
    try {
      map.remove();
    } catch {
      // ignore
    }
  }
  resetMapContainer(container);
}

async function initLeafletMap(container) {
  const leafletModule = await import("leaflet");
  const L = leafletModule.default ?? leafletModule;

  resetMapContainer(container);

  const map = L.map(container, {
    center: [MAP_CENTER.lat, MAP_CENTER.lng],
    zoom: 11,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const polygon = L.polygon(SERVICE_POLYGON, {
    color: GOLD_STROKE,
    weight: 2,
    fillColor: GOLD_STROKE,
    fillOpacity: GOLD_FILL_OPACITY,
    interactive: false,
  }).addTo(map);

  function fitPolygon() {
    try {
      map.invalidateSize();
      map.fitBounds(polygon.getBounds(), { padding: [FIT_PADDING, FIT_PADDING] });
    } catch {
      // ignore transient layout races
    }
  }

  fitPolygon();
  requestAnimationFrame(fitPolygon);
  setTimeout(fitPolygon, 150);
  setTimeout(fitPolygon, 400);
  map.whenReady(fitPolygon);

  map.__mcsFit = fitPolygon;
  return map;
}

export default function ServiceAreaMap() {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const runIdRef = useRef(0);
  const reactId = useId();
  const [engine, setEngine] = useState("loading"); // loading | ready | error

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const runId = ++runIdRef.current;
    let cancelled = false;

    async function setup() {
      setEngine("loading");
      destroyMap(mapInstanceRef.current, node);
      mapInstanceRef.current = null;

      try {
        const map = await initLeafletMap(node);
        // A newer effect run (or unmount) owns the container — drop this instance
        if (cancelled || runId !== runIdRef.current) {
          destroyMap(map, null);
          return;
        }
        mapInstanceRef.current = map;
        setEngine("ready");
        map.__mcsFit?.();
      } catch (err) {
        console.error("[ServiceAreaMap] map init failed:", err);
        if (!cancelled && runId === runIdRef.current) {
          setEngine("error");
        }
      }
    }

    setup();

    function onResize() {
      mapInstanceRef.current?.__mcsFit?.();
    }

    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      destroyMap(mapInstanceRef.current, node);
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div className="mx-auto mt-10 w-full max-w-3xl px-4 sm:px-6">
      <div className="text-center">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.22em] text-gold-bright">
          Our Service Area
        </h2>
        <p className="mt-2 text-base text-muted">We come to you.</p>
        <p className="mt-1 text-sm text-muted/90">{SERVICE_AREA}</p>
      </div>

      <div className="mt-5 w-full">
        <div className="relative w-full overflow-hidden rounded-xl border border-border-soft bg-surface">
          <div
            key={reactId}
            ref={containerRef}
            className="h-[220px] w-full touch-manipulation md:h-[340px]"
            role="application"
            aria-label="Interactive map of MCS Handymen service area"
          />

          {engine === "loading" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface text-sm text-muted">
              Loading map…
            </div>
          )}

          {engine === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface px-4 text-center text-sm text-muted">
              <p>Map unavailable right now.</p>
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gold-bright underline underline-offset-2"
              >
                Open in Google Maps
              </a>
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-center md:justify-end">
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gold/50 bg-surface px-4 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-surface-2"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View in Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
