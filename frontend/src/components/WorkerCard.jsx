import { Thermometer, Wind, UserRound, HardHat } from "lucide-react";
import { Link } from "react-router-dom";
import Metric from "./Metric.jsx";
import StatusBadge from "./StatusBadge.jsx";
import { formatTime } from "../services/format.js";
import { useSafety } from "../context/SafetyContext.jsx";

export default function WorkerCard({ worker }) {
  const { thresholds } = useSafety();
  const displayStatus = worker.isOnline ? worker.status : "OFFLINE";

  return (
    <Link to={`/workers/${worker.id}`} className={`worker-card card-${displayStatus.toLowerCase()}`}>
      <div className="worker-card-header">
        <div className="avatar">
          <HardHat size={24} />
        </div>
        <div>
          <h3>{worker.name}</h3>
          <p>{worker.id} - {worker.helmetId}</p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>
      <div className="card-metrics">
        <Metric
          label="Temp"
          value={`${worker.temperature}C`}
          tone={worker.temperature >= thresholds.temperatureDanger ? "danger" : worker.temperature >= thresholds.temperatureWarning ? "warning" : ""}
        />
        <Metric
          label="Gas"
          value={worker.gasValue}
          tone={worker.gasValue >= thresholds.gasDanger ? "danger" : worker.gasValue >= thresholds.gasWarning ? "warning" : ""}
        />
        <Metric
          label="Humidity"
          value={`${worker.humidity}%`}
          tone={worker.humidity >= thresholds.humidityDanger ? "danger" : worker.humidity >= thresholds.humidityWarning ? "warning" : ""}
        />
      </div>
      <div className="worker-card-footer">
        <span><UserRound size={15} /> {worker.department}</span>
        <span><Wind size={15} /> Fall {worker.fallDetected ? "YES" : "No"}</span>
        <span><Thermometer size={15} /> {formatTime(worker.lastUpdate)}</span>
      </div>
    </Link>
  );
}
