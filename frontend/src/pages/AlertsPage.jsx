import { useMemo, useState } from "react";
import StatusBadge from "../components/StatusBadge.jsx";
import { useSafety } from "../context/SafetyContext.jsx";
import { formatDateTime } from "../services/format.js";

const filters = ["All", "Warnings", "Danger", "Acknowledged"];

export default function AlertsPage() {
  const { alerts, acknowledgeAlert } = useSafety();
  const [filter, setFilter] = useState("All");

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (filter === "Warnings") return alert.severity === "Medium";
      if (filter === "Danger") return alert.severity === "High" || alert.severity === "Critical";
      if (filter === "Acknowledged") return alert.status === "acknowledged";
      return true;
    });
  }, [alerts, filter]);

  return (
    <section className="page">
      <div className="page-header compact">
        <div>
          <span className="eyebrow">Incident Center</span>
          <h1>Alerts</h1>
        </div>
        <div className="filter-row">
          {filters.map((item) => (
            <button key={item} className={`filter-btn ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="alerts-table">
        <div className="alerts-head">
          <span>Worker</span>
          <span>Type</span>
          <span>Severity</span>
          <span>Time</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {filteredAlerts.map((alert) => (
          <div className="alerts-row" key={alert.id}>
            <span><strong>{alert.workerName}</strong><small>{alert.workerId}</small></span>
            <span>{alert.type}</span>
            <span className={`severity ${alert.severity.toLowerCase()}`}>{alert.severity}</span>
            <span>{formatDateTime(alert.timestamp)}</span>
            <span>{alert.status}</span>
            <span>
              {alert.status === "active" ? (
                <button className="small-btn" onClick={() => acknowledgeAlert(alert.id)}>Acknowledge</button>
              ) : (
                <StatusBadge status="SAFE" />
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
