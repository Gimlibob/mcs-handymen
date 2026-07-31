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

/** Operational base (fallback center only — never shown as a pin/address) */
export const MAP_CENTER = { lat: 29.4243, lng: -95.3709 };

const GOLD_STROKE = "#d4af37";
const GOLD_FILL_OPACITY = 0.2;
const FIT_PADDING = 20;

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

function fitGooglePolygon(map, maps) {
  const bounds = new maps.LatLngBounds();
  SERVICE_POLYGON.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
  map.fitBounds(bounds, {
    top: FIT_PADDING,
    right: FIT_PADDING,
    bottom: FIT_PADDING,
    left: FIT_PADDING,
  });
}

function initGoogleMap(container, maps) {
  const map = new maps.Map(container, {
    center: MAP_CENTER,
    zoom: 11,
    disableDefaultUI: true,
    zoomControl: true,
    // Pan/zoom freely on the map; page still scrolls when touch starts outside it
    gestureHandling: "greedy",
    draggable: true,
    scrollwheel: true,
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

  fitGooglePolygon(map, maps);
  maps.event.addListenerOnce(map, "idle", () => fitGooglePolygon(map, maps));

  map.__mcsFit = () => fitGooglePolygon(map, maps);
  return map;
}

async function initLeafletMap(container) {
  const L = (await import("leaflet")).default;

  const map = L.map(container, {
    center: [MAP_CENTER.lat, MAP_CENTER.lng],
    zoom: 11,
    zoomControl: true,
    dragging: true,
    touchZoom: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    boxZoom: true,
    keyboard: true,
    attributionControl: true,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
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
    map.invalidateSize();
    map.fitBounds(polygon.getBounds(), { padding: [FIT_PADDING, FIT_PADDING] });
  }

  fitPolygon();
  setTimeout(fitPolygon, 50);
  setTimeout(fitPolygon, 250);
  map.whenReady(fitPolygon);

  map.__mcsFit = fitPolygon;
  return map;
}

export default function ServiceAreaMap() {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [engine, setEngine] = useState("loading"); // loading | google | leaflet | error

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

  useEffect(() => {
    if (!shouldLoad || !containerRef.current) return undefined;

    let cancelled = false;
    const node = containerRef.current;

    async function setup() {
      if (mapInstanceRef.current) {
        try {
          if (mapInstanceRef.current.remove) mapInstanceRef.current.remove();
          else node.innerHTML = "";
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
          mapInstanceRef.current = initGoogleMap(node, maps);
          setEngine("google");
        } else {
          mapInstanceRef.current = await initLeafletMap(node);
          if (cancelled) return;
          setEngine("leaflet");
        }
      } catch {
        if (cancelled) return;
        try {
          node.innerHTML = "";
          mapInstanceRef.current = await initLeafletMap(node);
          setEngine("leaflet");
        } catch {
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
      if (mapInstanceRef.current?.remove) {
        mapInstanceRef.current.remove();
      }
      mapInstanceRef.current = null;
    };
  }, [shouldLoad]);

  return (
    <div className="mx-auto mt-10 w-full max-w-3xl px-4 sm:px-6">
      <div className="text-center">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.22em] text-gold-bright">
          Our Service Area
        </h2>
        <p className="mt-2 text-base text-muted">We come to you.</p>
      </div>

      <div className="mt-5 w-full">
        <div className="relative w-full overflow-hidden rounded-xl border border-border-soft bg-surface">
          <div
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
            <div className="absolute inset-0 flex items-center justify-center bg-surface px-4 text-center text-sm text-muted">
              Map unavailable. Use the link below to open the area in Google Maps.
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
