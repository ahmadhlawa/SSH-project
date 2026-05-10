import { AlertTriangle, CheckCircle2, ShieldAlert, WifiOff } from "lucide-react";
import WorkerCard from "../components/WorkerCard.jsx";
import { useSafety } from "../context/SafetyContext.jsx";

export default function Dashboard() {
  const { workers, loading } = useSafety();
  const onlineWorkers = workers.filter((worker) => worker.isOnline);
  const counts = {
    safe: onlineWorkers.filter((worker) => worker.status === "SAFE").length,
    warning: onlineWorkers.filter((worker) => worker.status === "WARNING").length,
    danger: onlineWorkers.filter((worker) => worker.status === "DANGER").length,
    offline: workers.filter((worker) => !worker.isOnline).length
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Live IoT Monitoring</span>
          <h1>Worker Safety Dashboard</h1>
          <p>Real-time helmet readings, fall detection, gas exposure, and emergency response visibility.</p>
        </div>
      </div>
      <div className="summary-grid">
        <div className="summary-tile safe"><CheckCircle2 /> <span>Safe</span><strong>{counts.safe}</strong></div>
        <div className="summary-tile warning"><AlertTriangle /> <span>Warning</span><strong>{counts.warning}</strong></div>
        <div className="summary-tile danger"><ShieldAlert /> <span>Danger</span><strong>{counts.danger}</strong></div>
        <div className="summary-tile offline"><WifiOff /> <span>Offline</span><strong>{counts.offline}</strong></div>
      </div>
      {loading ? (
        <div className="empty-state">Loading workers...</div>
      ) : (
        <div className="workers-grid">
          {workers.map((worker) => <WorkerCard key={worker.id} worker={worker} />)}
        </div>
      )}
    </section>
  );
}
