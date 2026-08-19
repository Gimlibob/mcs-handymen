"use client";

import { useEffect, useRef, useState } from "react";
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
const FIT_PADDING = 20;

const GOOGLE_MAPS_URL = `https://www.google.com/maps/@${MAP_CENTER.lat},${MAP_CENTER.lng},12z`;

function loadGoogleMaps(apiKey, timeoutMs = 10000) {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);

  const loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-mcs-google-maps]");
    if (existing) {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }
      existing.addEventListener("load", () => {
        if (window.google?.maps) resolve(window.google.maps);
        else reject(new Error("Google Maps failed to initialize"));
      });
      existing.addEventListener("error", () => reject(new Error("Google Maps script error")));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.mcsGoogleMaps = "true";
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps failed to initialize"));
    };
    script.onerror = () => reject(new Error("Google Maps script error"));
    document.head.appendChild(script);
  });

  const timeoutPromise = new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("Google Maps load timeout")), timeoutMs);
  });

  return Promise.race([loadPromise, timeoutPromise]);
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

function resetMapContainer(container) {
  // Leaflet leaves an internal id on the DOM node; clear it for React Strict Mode remounts
  if (container._leaflet_id) {
    container._leaflet_id = undefined;
  }
  container.innerHTML = "";
}

async function initLeafletMap(container) {
  const leafletModule = await import("leaflet");
  const L = leafletModule.default ?? leafletModule;

  resetMapContainer(container);

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

  // Prefer Carto light tiles; fall back to OSM if CDN is blocked
  const carto = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }
  );

  carto.on("tileerror", () => {
    if (map.__mcsOsmFallback) return;
    map.__mcsOsmFallback = true;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
  });

  carto.addTo(map);

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
      // ignore transient layout races during remount
    }
  }

  fitPolygon();
  requestAnimationFrame(fitPolygon);
  setTimeout(fitPolygon, 100);
  setTimeout(fitPolygon, 300);
  map.whenReady(fitPolygon);

  map.__mcsFit = fitPolygon;
  return map;
}

function destroyMap(map, container) {
  if (!map) {
    if (container) resetMapContainer(container);
    return;
  }
  try {
    if (typeof map.remove === "function") {
      map.remove();
    }
  } catch {
    // ignore
  }
  if (container) resetMapContainer(container);
}

export default function ServiceAreaMap() {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [shouldLoad] = useState(true);
  const [engine, setEngine] = useState("loading"); // loading | google | leaflet | error

  useEffect(() => {
    if (!shouldLoad || !containerRef.current) return undefined;

    let cancelled = false;
    const node = containerRef.current;

    async function setup() {
      setEngine("loading");
      destroyMap(mapInstanceRef.current, node);
      mapInstanceRef.current = null;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

      try {
        if (apiKey) {
          try {
            const maps = await loadGoogleMaps(apiKey);
            if (cancelled) return;
            mapInstanceRef.current = initGoogleMap(node, maps);
            setEngine("google");
            return;
          } catch (googleErr) {
            console.warn("[ServiceAreaMap] Google Maps unavailable, using Leaflet:", googleErr);
          }
        }

        mapInstanceRef.current = await initLeafletMap(node);
        if (cancelled) {
          destroyMap(mapInstanceRef.current, node);
          mapInstanceRef.current = null;
          return;
        }
        setEngine("leaflet");
      } catch (err) {
        console.error("[ServiceAreaMap] map init failed:", err);
        if (!cancelled) setEngine("error");
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
  }, [shouldLoad]);

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
