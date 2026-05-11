import { AlertTriangle, BarChart3, Clock, Gauge, HardHat, LineChart, MapPin, ShieldAlert, ShieldCheck, TrendingUp, UserRound, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Metric from "../components/Metric.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useSafety } from "../context/SafetyContext.jsx";
import { getMockAnalyticsEvents } from "../data/analyticsMockData.js";
import { api } from "../services/api.js";
import { formatDateTime, formatTime } from "../services/format.js";

const ranges = ["Today", "7 Days", "30 Days", "All"];
const severityWeight = { Critical: 12, High: 8, Warning: 4, Medium: 4 };

export default function AnalyticsPage() {
  const { workers, alerts } = useSafety();
  const [range, setRange] = useState("7 Days");
  const [logs, setLogs] = useState([]);
  const liveWorker = workers.find((worker) => worker.id === "W-1001");

  useEffect(() => {
    let active = true;
    api.getWorkerLogs("W-1001")
      .then((response) => active && setLogs(response.logs || []))
      .catch(() => active && setLogs([]));
    return () => {
      active = false;
    };
  }, [liveWorker?.lastUpdate]);

  const analytics = useMemo(() => {
    const realEvents = alerts.map((alert) => {
      const worker = workers.find((item) => item.id === alert.workerId);
      return {
        workerId: alert.workerId,
        workerName: alert.workerName,
        helmetId: worker?.helmetId || "Unknown",
        zone: alert.zone || worker?.zone || "Unknown",
        timestamp: alert.timestamp,
        alertType: alert.type,
        severity: alert.severity,
        temperature: alert.readings?.temperature ?? worker?.temperature ?? 0,
        humidity: alert.readings?.humidity ?? worker?.humidity ?? 0,
        gasValue: alert.readings?.gasValue ?? worker?.gasValue ?? 0,
        acknowledged: alert.status === "acknowledged",
        responseTimeSeconds: alert.acknowledgedAt ? Math.max(8, Math.round((new Date(alert.acknowledgedAt) - new Date(alert.timestamp)) / 1000)) : 52
      };
    });
    const liveEvent = liveWorker?.isOnline && liveWorker.status !== "SAFE"
      ? [{
          workerId: liveWorker.id,
          workerName: liveWorker.name,
          helmetId: liveWorker.helmetId,
          zone: liveWorker.zone,
          timestamp: liveWorker.lastUpdate,
          alertType: liveWorker.alertType || liveWorker.status,
          severity: liveWorker.severity || "Warning",
          temperature: liveWorker.temperature,
          humidity: liveWorker.humidity,
          gasValue: liveWorker.gasValue,
          acknowledged: false,
          responseTimeSeconds: 0
        }]
      : [];
    return buildAnalytics(filterByRange([...liveEvent, ...realEvents, ...getMockAnalyticsEvents()], range), liveWorker, logs);
  }, [alerts, liveWorker, logs, range, workers]);

  return (
    <section className="page analytics-page">
      <div className="page-header compact analytics-hero">
        <div>
          <span className="eyebrow">Real + Demo Analytics</span>
          <h1>Safety Analytics</h1>
          <p>Risk patterns, exposure trends, and incident intelligence using W-1001 live data plus realistic historical demo analytics.</p>
        </div>
        <div className="filter-row">
          {ranges.map((item) => (
            <button key={item} className={`filter-btn ${range === item ? "active" : ""}`} onClick={() => setRange(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-kpi-grid">
        <Kpi icon={BarChart3} label="Total Incidents" value={analytics.total} note={`${range} selected`} />
        <Kpi icon={ShieldAlert} label="Critical Alerts" value={analytics.critical} note="Highest severity" tone="danger" />
        <Kpi icon={MapPin} label="Most Risky Zone" value={analytics.topZone?.label || "None"} note={`${analytics.topZone?.count || 0} incidents`} />
        <Kpi icon={UserRound} label="Highest Risk Worker" value={analytics.topWorker?.name || "None"} note={`${analytics.topWorker?.count || 0} incidents`} />
        <Kpi icon={Clock} label="Avg Response" value={`${analytics.avgResponse}s`} note="Acknowledge time" tone="safe" />
        <Kpi icon={HardHat} label="Active Live Helmet" value={liveWorker?.id || "W-1001"} note={liveWorker?.isOnline ? "1 live helmet" : "Waiting"} />
      </div>

      <div className="analytics-main-grid">
        <RiskScore analytics={analytics} />
        <Distribution items={analytics.byType} />
        <TimeWindows events={analytics.events} />
      </div>

      <div className="analytics-two-col">
        <TopZones zones={analytics.byZone} />
        <RepeatedWorkers workers={analytics.repeatedWorkers} />
      </div>

      <div className="analytics-two-col analytics-lower-grid">
        <TrendChart points={analytics.trend} />
        <LiveInsight worker={liveWorker} />
      </div>

      <div className="analytics-two-col analytics-lower-grid">
        <Recommendations analytics={analytics} />
        <RecentEvents events={analytics.events.slice(0, 8)} />
      </div>
    </section>
  );
}

function filterByRange(events, range) {
  if (range === "All") return events;
  const days = range === "Today" ? 1 : range === "7 Days" ? 7 : 30;
  return events.filter((event) => Date.now() - new Date(event.timestamp).getTime() <= days * 24 * 60 * 60 * 1000);
}

function buildAnalytics(events, liveWorker, logs) {
  const sorted = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const byZone = rank(sorted, "zone");
  const byType = rank(sorted, "alertType");
  const byWorker = rank(sorted, "workerId", "workerName");
  const critical = sorted.filter((event) => event.severity === "Critical").length;
  const high = sorted.filter((event) => event.severity === "High").length;
  const warning = sorted.filter((event) => event.severity === "Warning" || event.severity === "Medium").length;
  const repeatedWorkers = byWorker.filter((item) => item.count > 1);
  const responseEvents = sorted.filter((event) => event.responseTimeSeconds > 0);
  const avgResponse = responseEvents.length ? Math.round(responseEvents.reduce((sum, event) => sum + event.responseTimeSeconds, 0) / responseEvents.length) : 0;
  const responsePenalty = avgResponse > 60 ? 12 : avgResponse > 40 ? 8 : avgResponse > 25 ? 4 : 0;
  const riskScore = Math.min(100, critical * 12 + high * 8 + warning * 4 + repeatedWorkers.length * 6 + responsePenalty);
  const trend = logs.slice(-7).map((log) => ({
    label: new Date(log.timestamp).toLocaleDateString(undefined, { month: "short", day: "2-digit" }),
    gasValue: Number(log.gasValue),
    temperature: Number(log.temperature)
  }));
  return {
    events: sorted,
    total: sorted.length,
    critical,
    avgResponse,
    topZone: byZone[0],
    topWorker: byWorker[0],
    byZone,
    byType,
    byWorker,
    repeatedWorkers,
    riskScore,
    riskLabel: riskScore >= 80 ? "Critical" : riskScore >= 60 ? "High" : riskScore >= 35 ? "Medium" : "Low",
    trend: trend.length ? trend : sorted.slice(-7).reverse().map((event) => ({
      label: new Date(event.timestamp).toLocaleDateString(undefined, { month: "short", day: "2-digit" }),
      gasValue: event.gasValue,
      temperature: event.temperature
    }))
  };
}

function rank(events, key, nameKey = key) {
  const map = new Map();
  events.forEach((event) => {
    const id = event[key] || "Unknown";
    const current = map.get(id) || { id, label: event[key], name: event[nameKey], zone: event.zone, count: 0, score: 0, types: {}, last: event.timestamp };
    current.count += 1;
    current.score += severityWeight[event.severity] || 3;
    current.types[event.alertType] = (current.types[event.alertType] || 0) + 1;
    current.last = new Date(event.timestamp) > new Date(current.last) ? event.timestamp : current.last;
    map.set(id, current);
  });
  return [...map.values()].map((item) => ({
    ...item,
    mainRisk: Object.entries(item.types).sort((a, b) => b[1] - a[1])[0]?.[0] || "None",
    riskLevel: item.score >= 28 ? "Critical" : item.score >= 18 ? "High" : item.score >= 8 ? "Medium" : "Low"
  })).sort((a, b) => b.score - a.score);
}

function Kpi({ icon: Icon, label, value, note, tone = "warning" }) {
  return <div className={`analytics-kpi-card ${tone}`}><Icon size={30} /><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

function RiskScore({ analytics }) {
  return <div className="analytics-card"><div className="section-heading"><div><span className="eyebrow">Risk Engine</span><h2>Overall Safety Risk Score</h2></div><Gauge size={22} /></div><div className="risk-score-body"><div className="risk-score-number" style={{ "--score": analytics.riskScore }}><strong>{analytics.riskScore}</strong><span>/100</span></div><div className="risk-score-copy"><span className={`risk-label ${analytics.riskLabel.toLowerCase()}`}>{analytics.riskLabel} Risk</span><p>Risk score is calculated from danger frequency, severity, repeated exposure, and response time.</p></div></div><div className="risk-bar"><span style={{ width: `${analytics.riskScore}%` }} /></div></div>;
}

function TopZones({ zones }) {
  const max = Math.max(1, ...zones.map((zone) => zone.score));
  return <div className="analytics-card"><div className="section-heading"><div><span className="eyebrow">Area Intelligence</span><h2>Top Risk Zones</h2></div><MapPin size={22} /></div><div className="zone-risk-list">{zones.slice(0, 6).map((zone, index) => <div className="zone-risk-row" key={zone.id}><span className="rank-pill">{index + 1}</span><div><strong>{zone.label}</strong><small>{zone.count} incidents - Most common: {zone.mainRisk}</small></div><div className="zone-risk-bar"><span style={{ width: `${(zone.score / max) * 100}%` }} /></div><span className={`risk-label ${zone.riskLevel.toLowerCase()}`}>{zone.riskLevel}</span></div>)}</div></div>;
}

function Distribution({ items }) {
  const total = Math.max(1, items.reduce((sum, item) => sum + item.count, 0));
  return <div className="analytics-card"><div className="section-heading"><div><span className="eyebrow">Hazard Mix</span><h2>Alert Type Distribution</h2></div><ShieldAlert size={22} /></div><div className="distribution-list">{["Gas", "Temperature", "Fall", "SOS"].map((type) => { const item = items.find((entry) => entry.id === type) || { count: 0 }; const percent = Math.round((item.count / total) * 100); return <div className={`distribution-row type-${type.toLowerCase()}`} key={type}><span>{type}</span><div className="distribution-bar"><span style={{ width: `${percent}%` }} /></div><strong>{percent}% ({item.count})</strong></div>; })}</div><p className="insight-text">{items[0]?.id || "No"} is the most frequent hazard in the selected period.</p></div>;
}

function TimeWindows({ events }) {
  const groups = ["Morning", "Midday", "Afternoon", "Evening", "Night"].map((label) => ({ label, events: [] }));
  events.forEach((event) => { const hour = new Date(event.timestamp).getHours(); const index = hour < 6 || hour >= 22 ? 4 : hour < 12 ? 0 : hour < 14 ? 1 : hour < 18 ? 2 : 3; groups[index].events.push(event); });
  const max = Math.max(1, ...groups.map((group) => group.events.length));
  return <div className="analytics-card"><div className="section-heading"><div><span className="eyebrow">Shift Timing</span><h2>High Risk Time Windows</h2></div><Clock size={22} /></div><div className="time-heatmap">{groups.map((group) => <div className="time-window" key={group.label}><span>{group.label}</span><div className="heat-cell" style={{ "--heat": Math.max(0.08, group.events.length / max) }} /><strong>{group.events.length} incidents</strong><small>{rank(group.events, "alertType")[0]?.id || "None"}</small></div>)}</div><p className="insight-text">Highest risk usually clusters around midday and afternoon work periods.</p></div>;
}

function RepeatedWorkers({ workers }) {
  return <div className="analytics-card"><div className="section-heading"><div><span className="eyebrow">Repeated Exposure</span><h2>Workers Requiring Attention</h2></div><UserRound size={22} /></div><div className="repeated-list">{workers.length === 0 ? <div className="empty-row">No repeated exposure workers in this range.</div> : workers.slice(0, 6).map((worker) => <div className="repeated-row" key={worker.id}><div><strong>{worker.name}</strong><small>{worker.id} - {worker.zone}</small></div><span>{worker.count} incidents</span><span>{worker.mainRisk}</span><span>{formatDateTime(worker.last)}</span><span className={`risk-label ${worker.riskLevel.toLowerCase()}`}>{worker.riskLevel}</span><Link className="small-btn" to={`/workers/${worker.id}`}>View Worker</Link></div>)}</div></div>;
}

function TrendChart({ points }) {
  const maxGas = Math.max(1, ...points.map((point) => point.gasValue));
  const maxTemp = Math.max(1, ...points.map((point) => point.temperature));
  return <div className="analytics-card"><div className="section-heading"><div><span className="eyebrow">Trend Line</span><h2>Gas & Temperature Trends</h2></div><LineChart size={22} /></div><div className="trend-chart">{points.map((point, index) => <div className="trend-column" key={`${point.label}-${index}`}><div className="trend-bars"><span className="gas-bar" style={{ height: `${Math.max(8, (point.gasValue / maxGas) * 100)}%` }} /><span className="temp-bar" style={{ height: `${Math.max(8, (point.temperature / maxTemp) * 100)}%` }} /></div><small>{point.label}</small></div>)}</div><div className="chart-legend"><span><i style={{ background: "#ff4444" }} /> Gas</span><span><i style={{ background: "#ffd700" }} /> Temperature</span></div></div>;
}

function LiveInsight({ worker }) {
  const interpretation = getLiveInterpretation(worker);
  return <div className="analytics-card live-insight-card"><div className="section-heading"><div><span className="eyebrow">Real Data</span><h2>Live Helmet Insight</h2></div><span className="live-mini"><span className="live-dot" /> LIVE</span></div>{worker ? <><div className="live-worker-profile"><div className="avatar">{worker.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div><div><strong>{worker.name}</strong><span>{worker.id} - {worker.helmetId}</span><small>{worker.zone}</small></div><StatusBadge status={worker.isOnline ? worker.status : "OFFLINE"} /></div><div className="profile-grid"><Metric label="Temperature" value={`${worker.temperature} C`} /><Metric label="Gas" value={worker.gasValue} /><Metric label="Humidity" value={`${worker.humidity}%`} /><Metric label="Last Reading" value={worker.lastUpdate ? formatTime(worker.lastUpdate) : "Waiting"} /></div><div className={`live-interpretation ${interpretation.tone}`}><ShieldCheck size={20} /><span>{interpretation.text}</span></div></> : <div className="empty-row">Waiting for W-1001 live helmet data.</div>}</div>;
}

function getLiveInterpretation(worker) {
  if (!worker) return { tone: "warning", text: "Live helmet data is not available yet." };
  if (!worker.isOnline) return { tone: "warning", text: "W-1001 is currently offline. Waiting for the next ESP32 reading." };
  if (worker.status === "DANGER") return { tone: "danger", text: `${worker.alertType || "Danger"} requires immediate supervisor attention.` };
  if (worker.status === "WARNING") return { tone: "warning", text: `${worker.alertType || "Warning"} is approaching the safety threshold.` };
  return { tone: "safe", text: "Current readings are within safe limits. All systems normal." };
}

function Recommendations({ analytics }) {
  const items = [
    { priority: "High", subject: analytics.topZone?.label || "Storage", reason: "Repeated incidents indicate a concentrated risk area.", action: "Increase ventilation and supervisor checks in this zone." },
    { priority: "Medium", subject: "12 PM - 4 PM", reason: "Temperature exposure is common around midday.", action: "Schedule hydration and heat breaks during peak hours." },
    { priority: "Medium", subject: "Loading / Forklift Area", reason: "Fall-related incidents appear around movement-heavy areas.", action: "Inspect floor safety, traffic lanes, and helmet fit." }
  ];
  return <div className="analytics-card"><div className="section-heading"><div><span className="eyebrow">Action Plan</span><h2>Safety Recommendations</h2></div><TrendingUp size={22} /></div><div className="recommendation-list">{items.map((item) => <div className="recommendation-card" key={item.subject}><AlertTriangle size={20} /><div><strong>{item.subject}</strong><span>{item.reason}</span><small>{item.action}</small></div><span className={`risk-label ${item.priority.toLowerCase()}`}>{item.priority}</span></div>)}</div></div>;
}

function RecentEvents({ events }) {
  return <div className="analytics-card recent-events-card"><div className="section-heading"><div><span className="eyebrow">Event Stream</span><h2>Recent Analytics Events</h2></div><Wind size={22} /></div><div className="analytics-events-table"><div className="analytics-events-head"><span>Time</span><span>Worker</span><span>Zone</span><span>Type</span><span>Severity</span><span>Response</span><span>Status</span></div>{events.map((event) => <div className="analytics-events-row" key={`${event.workerId}-${event.timestamp}-${event.alertType}`}><span>{formatDateTime(event.timestamp)}</span><span>{event.workerName}</span><span>{event.zone}</span><span>{event.alertType}</span><span className={`severity ${String(event.severity).toLowerCase()}`}>{event.severity}</span><span>{event.responseTimeSeconds || "--"}s</span><span className={`alert-status ${event.acknowledged ? "acknowledged" : "active"}`}>{event.acknowledged ? "Acknowledged" : "Active"}</span></div>)}</div></div>;
}
