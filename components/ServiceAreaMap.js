"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import "leaflet/dist/leaflet.css";

/** Exact golden polygon vertices [lat, lng] — NW → NE → SE → SW */
export const SERVICE_POLYGON = [
  [29.5042, -95.4373],
  [29.528417, -95.348833],
  [29.3901, -95.3621],
  [29.3912, -95.4601],
];

/** Operational base (map center only — never shown as a pin/address on the page) */
export const MAP_CENTER = { lat: 29.4243, lng: -95.3709 };

const GOLD_STROKE = "#d4af37";
const GOLD_FILL_OPACITY = 0.2;

const GOOGLE_MAPS_URL = `https://www.google.com/maps/@${MAP_CENTER.lat},${MAP_CENTER.lng},12z`;

function loadGoogleMaps(apiKey) {
  if (typeof window === "undefined") return Promise.reject();
  if (window.google?.maps) return Promise.resolve(window.google.maps);

  const existing = document.querySelector("script[data-mcs-google-maps]");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(window.google.maps));
      existing.addEventListener("error", reject);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.mcsGoogleMaps = "true";
    script.onload = () => resolve(window.google.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function initGoogleMap(container, maps, interactive) {
  const map = new maps.Map(container, {
    center: MAP_CENTER,
    zoom: 11,
    disableDefaultUI: true,
    zoomControl: interactive,
    gestureHandling: interactive ? "greedy" : "none",
    draggable: interactive,
    scrollwheel: interactive,
    disableDoubleClickZoom: !interactive,
    keyboardShortcuts: interactive,
    backgroundColor: "#e5e3df",
  });

  new maps.Polygon({
    paths: SERVICE_POLYGON.map(([lat, lng]) => ({ lat, lng })),
    strokeColor: GOLD_STROKE,
    strokeOpacity: 1,
    strokeWeight: 2,
    fillColor: GOLD_STROKE,
    fillOpacity: GOLD_FILL_OPACITY,
    map,
    clickable: false,
  });

  return map;
}

async function initLeafletMap(container, interactive) {
  const L = (await import("leaflet")).default;

  const map = L.map(container, {
    center: [MAP_CENTER.lat, MAP_CENTER.lng],
    zoom: 11,
    zoomControl: interactive,
    dragging: interactive,
    touchZoom: interactive,
    scrollWheelZoom: interactive,
    doubleClickZoom: interactive,
    boxZoom: interactive,
    keyboard: interactive,
    attributionControl: true,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  L.polygon(SERVICE_POLYGON, {
    color: GOLD_STROKE,
    weight: 2,
    fillColor: GOLD_STROKE,
    fillOpacity: GOLD_FILL_OPACITY,
    interactive: false,
  }).addTo(map);

  // Ensure layout calculates correctly inside rounded container
  setTimeout(() => map.invalidateSize(), 50);

  return map;
}

export default function ServiceAreaMap() {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [engine, setEngine] = useState("loading"); // loading | google | leaflet | error

  // Track viewport < 768px for scroll-safe mobile behavior
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Lazy-load map only when section enters viewport (PageSpeed-friendly)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initialize map once visible
  useEffect(() => {
    if (!shouldLoad || !containerRef.current) return undefined;

    let cancelled = false;
    const interactive = !isMobile;
    const node = containerRef.current;

    async function setup() {
      // Tear down previous instance when switching mobile/desktop interaction mode
      if (mapInstanceRef.current) {
        try {
          if (mapInstanceRef.current.remove) mapInstanceRef.current.remove();
          else if (mapInstanceRef.current.setOptions) {
            // Google Map — destroy by clearing container
            node.innerHTML = "";
          }
        } catch {
          node.innerHTML = "";
        }
        mapInstanceRef.current = null;
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      try {
        if (apiKey) {
          const maps = await loadGoogleMaps(apiKey);
          if (cancelled) return;
          mapInstanceRef.current = initGoogleMap(node, maps, interactive);
          setEngine("google");
        } else {
          mapInstanceRef.current = await initLeafletMap(node, interactive);
          if (cancelled) return;
          setEngine("leaflet");
        }
      } catch {
        if (cancelled) return;
        // Fallback if Google Maps fails to load
        try {
          node.innerHTML = "";
          mapInstanceRef.current = await initLeafletMap(node, interactive);
          setEngine("leaflet");
        } catch {
          setEngine("error");
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current?.remove) {
        mapInstanceRef.current.remove();
      }
      mapInstanceRef.current = null;
    };
  }, [shouldLoad, isMobile]);

  return (
    <div className="mx-auto mt-10 w-full max-w-3xl px-4 sm:px-6">
      <div className="text-center">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.22em] text-gold-bright">
          Our Service Area
        </h2>
        <p className="mt-2 text-base text-muted">We come to you.</p>
      </div>

      <div className="mt-5 w-full">
        <div
          className={`relative w-full overflow-hidden rounded-xl border border-border-soft bg-surface ${
            isMobile ? "pointer-events-none" : ""
          }`}
        >
          <div
            ref={containerRef}
            className="h-[220px] w-full md:h-[340px]"
            role="img"
            aria-label="Map of MCS Handymen service area"
          />

          {engine === "loading" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface text-sm text-muted">
              Loading map…
            </div>
          )}

          {engine === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface px-4 text-center text-sm text-muted">
              Map unavailable. Use the link below to open the area in Google Maps.
            </div>
          )}
        </div>

        {/* Mobile: external link so users can explore without scroll-trapping the page */}
        <div className={`mt-3 flex justify-center ${isMobile ? "" : "md:justify-end"}`}>
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
