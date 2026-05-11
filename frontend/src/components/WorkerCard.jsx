import { Bell, HardHat, MapPin, Thermometer, Wind } from "lucide-react";
import { Link } from "react-router-dom";
import { useSafety } from "../context/SafetyContext.jsx";
import { formatTime } from "../services/format.js";
import StatusBadge from "./StatusBadge.jsx";

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function reading(worker, key, suffix = "") {
  if (!worker.isOnline) return "--";
  const value = worker[key];
  return value === undefined || value === null ? "--" : `${value}${suffix}`;
}

export default function WorkerCard({ worker }) {
  const { thresholds } = useSafety();
  const displayStatus = worker.isOnline ? worker.status : "OFFLINE";
  const live = worker.isOnline;

  return (
    <Link to={`/workers/${worker.id}`} className={`worker-card card-${displayStatus.toLowerCase()}`}>
      <div className="worker-card-header">
        <div className="avatar">
          {live ? <HardHat size={24} /> : getInitials(worker.name)}
        </div>
        <div>
          <div className="worker-title-row">
            <h3>{worker.name}</h3>
            {live && <span className="live-mini"><span className="live-dot" /> LIVE</span>}
          </div>
          <p>{worker.id} - {worker.helmetId}</p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>
      <div className="card-metrics">
        <MetricBlock
          icon={Thermometer}
          label="Temp"
          value={reading(worker, "temperature", " C")}
          tone={live && worker.temperature >= thresholds.temperatureDanger ? "danger" : live && worker.temperature >= thresholds.temperatureWarning ? "warning" : ""}
        />
        <MetricBlock
          icon={Wind}
          label="Gas"
          value={reading(worker, "gasValue")}
          tone={live && worker.gasValue >= thresholds.gasDanger ? "danger" : live && worker.gasValue >= thresholds.gasWarning ? "warning" : ""}
        />
        <MetricBlock label="Humidity" value={reading(worker, "humidity", "%")} />
        <MetricBlock label="Fall" value={live ? (worker.fallDetected ? "YES" : "No") : "--"} tone={live && worker.fallDetected ? "danger" : ""} />
        <MetricBlock icon={Bell} label="SOS" value={live ? (worker.sosPressed ? "Pressed" : "No") : "--"} tone={live && worker.sosPressed ? "danger" : ""} />
      </div>
      <div className="worker-card-footer">
        <span><MapPin size={15} /> {worker.zone}</span>
        <span>Updated {live ? formatTime(worker.lastUpdate) : "--"}</span>
      </div>
    </Link>
  );
}

function MetricBlock({ icon: Icon, label, value, tone }) {
  return (
    <div className={`metric ${tone ? `metric-${tone}` : ""}`}>
      <span>{Icon && <Icon size={14} />} {label}</span>
      <strong>{value}</strong>
    </div>
  );
}
