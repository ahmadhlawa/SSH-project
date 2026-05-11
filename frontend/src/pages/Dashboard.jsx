import { Activity, AlertTriangle, CheckCircle2, Search, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import WorkerCard from "../components/WorkerCard.jsx";
import { useSafety } from "../context/SafetyContext.jsx";
import { analyticsMockWorkers } from "../data/analyticsMock.js";
import { formatTime } from "../services/format.js";

const filters = ["All", "Live", "Safe", "Warning", "Danger", "Offline"];

export default function Dashboard() {
  const { workers, loading, lastRealtimeUpdate } = useSafety();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const onlineWorkers = workers.filter((worker) => worker.isOnline);
  const counts = {
    safe: onlineWorkers.filter((worker) => worker.status === "SAFE").length,
    warning: onlineWorkers.filter((worker) => worker.status === "WARNING").length,
    danger: onlineWorkers.filter((worker) => worker.status === "DANGER").length,
    offline: workers.filter((worker) => !worker.isOnline).length,
    live: onlineWorkers.length
  };

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const displayStatus = worker.isOnline ? worker.status : "OFFLINE";
      const matchesSearch = `${worker.name} ${worker.id} ${worker.helmetId} ${worker.zone}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const matchesFilter =
        filter === "All" ||
        (filter === "Live" && worker.isOnline) ||
        displayStatus === filter.toUpperCase();

      return matchesSearch && matchesFilter;
    });
  }, [workers, search, filter]);

  const liveWorker = workers.find((worker) => worker.id === "W-1001") || onlineWorkers[0];
  const analysisRows = useMemo(() => {
    const liveRow = liveWorker
      ? [{
          id: liveWorker.id,
          name: liveWorker.name,
          zone: liveWorker.zone,
          shiftHours: 0.7,
          avgTemperature: Number(liveWorker.temperature || 0),
          avgGasValue: Number(liveWorker.gasValue || 0),
          humidity: Number(liveWorker.humidity || 0),
          alertsToday: liveWorker.status === "DANGER" ? 1 : 0,
          status: liveWorker.status,
          live: true
        }]
      : [];

    return [...liveRow, ...analyticsMockWorkers];
  }, [liveWorker]);

  return (
    <section className="page dashboard-page">
      <div className="hero-panel">
        <div>
          <span className="eyebrow">Live IoT Monitoring</span>
          <h2>Industrial helmet command center</h2>
          <p>Real-time safety state, worker telemetry, fall detection, gas exposure, and emergency acknowledgement in one control view.</p>
        </div>
        <div className="hero-live-card">
          <span className="live-dot" />
          <strong>{liveWorker?.name || "Waiting for helmet"}</strong>
          <small>{liveWorker ? `${liveWorker.id} - ${liveWorker.helmetId}` : "No live helmet yet"}</small>
          <span>Last update {lastRealtimeUpdate ? formatTime(lastRealtimeUpdate) : "Waiting"}</span>
        </div>
      </div>

      <div className="summary-grid">
        <StatCard tone="safe" icon={CheckCircle2} label="Safe Workers" value={counts.safe} />
        <StatCard tone="warning" icon={AlertTriangle} label="Warnings" value={counts.warning} />
        <StatCard tone="danger" icon={ShieldAlert} label="Danger" value={counts.danger} />
        <StatCard tone="offline" icon={WifiOff} label="Offline" value={counts.offline} />
        <StatCard tone="live" icon={Wifi} label="Active Live Helmets" value={counts.live} />
      </div>

      <div className="toolbar-panel">
        <label className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workers, helmets, zones..." />
        </label>
        <div className="filter-row">
          {filters.map((item) => (
            <button key={item} className={`filter-btn ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading workers...</div>
      ) : (
        <div className="workers-grid">
          {filteredWorkers.map((worker) => <WorkerCard key={worker.id} worker={worker} />)}
        </div>
      )}

      <section className="analysis-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Operations Analysis</span>
            <h2>Worker exposure overview</h2>
          </div>
          <Activity size={22} />
        </div>
        <div className="analysis-grid">
          {analysisRows.map((row) => (
            <div className="analysis-card" key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <span>{row.id} - {row.zone}</span>
              </div>
              <div className="analysis-metrics">
                <span>Shift <strong>{row.shiftHours}h</strong></span>
                <span>Avg Temp <strong>{row.avgTemperature} C</strong></span>
                <span>Avg Gas <strong>{row.avgGasValue}</strong></span>
                <span>Alerts <strong>{row.alertsToday}</strong></span>
              </div>
              <span className={`status-badge status-${row.status.toLowerCase()}`}>{row.live ? "LIVE" : row.status}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function StatCard({ tone, icon: Icon, label, value }) {
  return (
    <div className={`summary-tile ${tone}`}>
      <Icon />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
