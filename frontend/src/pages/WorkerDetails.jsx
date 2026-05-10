import { AlertTriangle, Check, Clock, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import GoogleMapView from "../components/GoogleMapView.jsx";
import Metric from "../components/Metric.jsx";
import SensorChart from "../components/SensorChart.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useSafety } from "../context/SafetyContext.jsx";
import { api } from "../services/api.js";
import { formatDateTime } from "../services/format.js";

const recommendations = {
  Gas: "Inspect ventilation, move worker away from exposure, and verify gas sensor reading.",
  Temperature: "Provide cooling break, water, and check heat exposure in the current zone.",
  Humidity: "Check ventilation and moisture exposure, then move the worker to a drier area if needed.",
  Fall: "Dispatch first responder and avoid moving the worker until assessed.",
  SOS: "Contact the worker and send supervisor support immediately."
};

export default function WorkerDetails() {
  const { id } = useParams();
  const { workers, alerts, thresholds } = useSafety();
  const [sensorLogs, setSensorLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const worker = workers.find((item) => item.id === id);
  const workerEvents = useMemo(
    () => alerts.filter((alert) => alert.workerId === id).slice(0, 6),
    [alerts, id]
  );

  useEffect(() => {
    let active = true;
    setLogsLoading(true);

    api.getWorkerLogs(id)
      .then((response) => {
        if (!active) return;
        setSensorLogs(response.logs || []);
      })
      .catch((error) => console.error(error))
      .finally(() => active && setLogsLoading(false));

    return () => {
      active = false;
    };
  }, [id, worker?.lastUpdate]);

  if (!worker) return <div className="empty-state">Worker not found.</div>;
  const displayStatus = worker.isOnline ? worker.status : "OFFLINE";

  return (
    <section className="page">
      <div className="details-header">
        <div>
          <span className="eyebrow">Worker Profile</span>
          <h1>{worker.name}</h1>
          <p>{worker.id} · {worker.helmetId} · {worker.department}</p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>
      <div className="details-layout">
        <div className="details-main">
          <div className={`profile-panel card-${displayStatus.toLowerCase()}`}>
            <div className="profile-grid">
              <Metric label="Zone" value={worker.zone} />
              <Metric label="Temperature" value={`${worker.temperature}C`} tone={worker.temperature >= thresholds.temperatureDanger ? "danger" : worker.temperature >= thresholds.temperatureWarning ? "warning" : ""} />
              <Metric label="Humidity" value={`${worker.humidity}%`} tone={worker.humidity >= thresholds.humidityDanger ? "danger" : worker.humidity >= thresholds.humidityWarning ? "warning" : ""} />
              <Metric label="Gas Value" value={worker.gasValue} tone={worker.gasValue >= thresholds.gasDanger ? "danger" : worker.gasValue >= thresholds.gasWarning ? "warning" : ""} />
              <Metric label="Fall Detected" value={worker.fallDetected ? "YES" : "No"} tone={worker.fallDetected ? "danger" : ""} />
              <Metric label="SOS Status" value={worker.sosPressed ? "Pressed" : "No"} tone={worker.sosPressed ? "danger" : ""} />
            </div>
            <div className="last-update"><Clock size={16} /> Last update {formatDateTime(worker.lastUpdate)}</div>
          </div>

          {worker.isOnline && worker.status !== "SAFE" && (
            <div className={`alert-panel ${worker.status.toLowerCase()}`}>
              <AlertTriangle size={24} />
              <div>
                <h2>{worker.alertType} {worker.status === "DANGER" ? "Emergency" : "Warning"}</h2>
                <p>{recommendations[worker.alertType] || "Review worker condition and verify sensor data."}</p>
              </div>
            </div>
          )}

          <SensorChart logs={sensorLogs} loading={logsLoading} />

          <div className="timeline-panel">
            <h2>Recent Events</h2>
            {workerEvents.length === 0 ? (
              <div className="timeline-item"><Check size={16} /> No recent alerts for this worker.</div>
            ) : (
              workerEvents.map((event) => (
                <div className="timeline-item" key={event.id}>
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{event.type} · {event.severity}</strong>
                    <span>{formatDateTime(event.timestamp)} · {event.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <aside className="details-side">
          <div className="mini-map">
            <GoogleMapView workers={[worker]} focusWorker={worker} />
          </div>
          <div className="location-card">
            <MapPin size={20} />
            <div>
              <strong>{worker.zone}</strong>
              <span>{worker.lat.toFixed(5)}, {worker.lng.toFixed(5)}</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
