import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "./StatusBadge.jsx";

const statusColors = {
  SAFE: "#16a34a",
  WARNING: "#FFD700",
  DANGER: "#FF4444",
  OFFLINE: "#6b7280"
};

const defaultCenter = { lat: 31.7622, lng: 35.2654 };

let googleMapsPromise;

function getWorkerPosition(worker) {
  return {
    lat: Number(worker?.lat ?? worker?.latitude ?? worker?.location?.lat ?? worker?.position?.lat),
    lng: Number(worker?.lng ?? worker?.longitude ?? worker?.location?.lng ?? worker?.position?.lng)
  };
}

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById("google-maps-script");
    const callbackName = "initSmartHelmetGoogleMaps";

    window[callbackName] = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps did not initialize."));
    };

    window.gm_authFailure = () => {
      reject(new Error("Google Maps authentication failed. Check API key, billing, and HTTP referrer restrictions."));
    };

    if (existingScript) return;

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps script failed to load."));
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function createMarkerIcon(maps, status) {
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: statusColors[status] || "#0F0F0F",
    fillOpacity: 1,
    strokeColor: status === "WARNING" ? "#0F0F0F" : "#ffffff",
    strokeWeight: status === "DANGER" ? 4 : 2,
    scale: status === "DANGER" ? 13 : 10
  };
}

function buildInfoWindowContent(worker, onViewDetails) {
  const displayStatus = worker.isOnline ? worker.status : "OFFLINE";
  const panel = document.createElement("div");
  panel.className = `map-info map-info-${displayStatus.toLowerCase()}`;

  const name = document.createElement("strong");
  name.textContent = worker.name;

  const meta = document.createElement("span");
  meta.textContent = `${worker.id} - ${worker.zone}`;

  const badge = document.createElement("span");
  badge.className = `status-badge status-${displayStatus.toLowerCase()}`;
  badge.textContent = displayStatus;

  const metrics = document.createElement("div");
  metrics.className = "map-info-metrics";
  metrics.innerHTML = `
    <span>Temp <strong>${worker.temperature}°C</strong></span>
    <span>Gas <strong>${worker.gasValue}</strong></span>
  `;

  const action = document.createElement("button");
  action.className = "map-info-action";
  action.type = "button";
  action.textContent = "View Details";
  action.addEventListener("click", onViewDetails);

  panel.append(name, meta, badge, metrics, action);
  return panel;
}

export default function GoogleMapView({ workers, focusWorker }) {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [loadState, setLoadState] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

  const center = useMemo(() => {
    const worker = focusWorker || workers[0];
    return worker ? getWorkerPosition(worker) : defaultCenter;
  }, [workers, focusWorker]);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return undefined;

    let cancelled = false;
    setLoadState("loading");
    setErrorMessage("");

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !mapRef.current) return;

        mapInstanceRef.current = new maps.Map(mapRef.current, {
          center,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true
        });
        infoWindowRef.current = new maps.InfoWindow();
        setLoadState("loaded");
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(error.message);
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapInstanceRef.current;
    if (!maps || !map || loadState !== "loaded") return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    map.setCenter(center);
    map.setZoom(focusWorker ? 17 : 16);

    workers.forEach((worker) => {
      const displayStatus = worker.isOnline ? worker.status : "OFFLINE";
      const position = getWorkerPosition(worker);
      console.log("[map] rendering marker coordinates", {
        workerId: worker.id,
        helmetId: worker.helmetId,
        gpsValid: worker.gpsValid,
        lat: position.lat,
        lng: position.lng
      });
      const marker = new maps.Marker({
        position,
        map,
        title: `${worker.name} - ${displayStatus}`,
        icon: createMarkerIcon(maps, displayStatus),
        animation: displayStatus === "DANGER" ? maps.Animation.BOUNCE : undefined
      });

      marker.addListener("click", () => {
        const content = buildInfoWindowContent(worker, () => navigate(`/workers/${worker.id}`));
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open({ anchor: marker, map });
      });

      markersRef.current.push(marker);
    });
  }, [workers, focusWorker, center, loadState, navigate]);

  if (!apiKey) {
    return (
      <MapFallback
        title="Google Maps key missing"
        message="Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env, then restart the frontend dev server."
        workers={workers}
      />
    );
  }

  if (loadState === "error") {
    return (
      <MapFallback
        title="Google Maps could not load"
        message={errorMessage || "Check API key restrictions, billing, and that Maps JavaScript API is enabled."}
        workers={workers}
      />
    );
  }

  return (
    <div className="map-stage">
      {loadState !== "loaded" && <div className="map-loading">Loading map...</div>}
      <div ref={mapRef} className="google-map-canvas" />
    </div>
  );
}

function MapFallback({ title, message, workers }) {
  return (
    <div className="map-placeholder">
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      <div className="fallback-workers">
        {workers.map((worker) => (
          <div key={worker.id} className="fallback-worker">
            <span>{worker.name}</span>
            <small>{worker.zone}</small>
            <StatusBadge status={worker.isOnline ? worker.status : "OFFLINE"} />
          </div>
        ))}
      </div>
    </div>
  );
}
