import GoogleMapView from "../components/GoogleMapView.jsx";
import { useSafety } from "../context/SafetyContext.jsx";

export default function MapPage() {
  const { workers } = useSafety();

  return (
    <section className="page full-height-page">
      <div className="page-header compact">
        <div>
          <span className="eyebrow">Location Command</span>
          <h1>Worker Map</h1>
          <p>Live worker position tracking with status-aware map markers.</p>
        </div>
        <div className="map-legend">
          <span><i className="dot safe-dot" /> Safe</span>
          <span><i className="dot warning-dot" /> Warning</span>
          <span><i className="dot danger-dot" /> Danger</span>
          <span><i className="dot offline-dot" /> Offline</span>
        </div>
      </div>
      <div className="map-panel glass-panel">
        <GoogleMapView workers={workers} />
      </div>
    </section>
  );
}
