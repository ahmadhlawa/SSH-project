import {
  AlertTriangle,
  BarChart3,
  Clock,
  Gauge,
  HardHat,
  LineChart,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Thermometer,
  TrendingUp,
  UserRound,
  Wind
} from "lucide-react";
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
const timeWindows = [
  { label: "Morning", start: 6, end: 12 },
  { label: "Midday", start: 12, end: 14 },
  { label: "Afternoon", start: 14, end: 18 },
  { label: "Evening", start: 18, end: 22 },
  { label: "Night", start: 22, end: 30 }
];

export default function AnalyticsPage() {
  const { workers, alerts } = useSafety();
  const [range, setRange] = useState("7 Days");
  const [liveLogs, setLiveLogs] = useState([]);
  const liveWorker = workers.find((worker) => worker.id === "W-1001");

  useEffect(() => {
    let active = true;
    api.getWorkerLogs("W-1001")
      .then((response) => {
        if (active) setLiveLogs(response.logs || []);
      })
      .catch(() => {
        if (active) setLiveLogs([]);
      });

    return () => {
      active = false;
    };
  }, [liveWorker?.lastUpdate]);

  const analytics = useMemo(() => {
    const mockEvents = getMockAnalyticsEvents();
    const realAlertEvents = alerts.map((alert) => ({
      workerId: alert.workerId,
      workerName: alert.workerName,
      helmetId: workers.find((worker) => worker.id === alert.workerId)?.helmetId || "Unknown",
      zone: alert.zone || workers.find((worker) => worker.id === alert.workerId)?.zone || "Unknown",
      department: workers.find((worker) => worker.id === alert.workerId)?.department || "Unknown",
      timestamp: alert.timestamp,
      alertType: alert.type,
      severity: alert.severity,
      temperature: alert.readings?.temperature ?? workers.find((worker) => worker.id === alert.workerId)?.temperature ?? 0,
      humidity: alert.readings?.humidity ?? workers.find((worker) => worker.id === alert.workerId)?.humidity ?? 0,
      gasValue: alert.readings?.gasValue ?? workers.find((worker) => worker.id === alert.workerId)?.gasValue ?? 0,
      durationMinutes: alert.status === "active" ? 1 : 8,
      acknowledged: alert.status === "acknowledged",
      responseTimeSeconds: alert.acknowledgedAt ? Math.max(8, Math.round((new Date(alert.acknowledgedAt) - new Date(alert.timestamp)) / 1000)) : 52,
      real: true
    }));

    const liveCurrentEvent = liveWorker && liveWorker.isOnline && liveWorker.status !== "SAFE"
      ? [{
          workerId: liveWorker.id,
          workerName: liveWorker.name,
          helmetId: liveWorker.helmetId,
          zone: liveWorker.zone,
          department: liveWorker.department,
          timestamp: liveWorker.lastUpdate,
          alertType: liveWorker.alertType || liveWorker.status,
          severity: liveWorker.severity || "Warning",
          temperature: liveWorker.temperature,
          humidity: liveWorker.humidity,
          gasValue: liveWorker.gasValue,
          durationMinutes: 1,
          acknowledged: false,
          responseTimeSeconds: 0,
          real: true,
          liveCurrent: true
        }]
      : [];

    const allEvents = [...liveCurrentEvent, ...realAlertEvents, ...mockEvents];
    const filteredEvents = filterEventsByRange(allEvents, range);
    return buildAnalytics(filteredEvents, liveWorker, liveLogs);
  }, [alerts, liveLogs, liveWorker, range, workers]);

  return (
    <section className="page analytics-page">
      <div className="analytics-header hero-panel">
        <div>
          <span className="eyebrow">Real + Demo Analytics</span>
          <h2>Safety Analytics</h2>
          <p>Analytics combines the live W-1001 helmet with realistic historical demo events for offline workers until more real logs are collected.</p>
        </div>
        <div className="analytics-range">
          {ranges.map((item) => (
            <button key={item} className={`filter-btn ${range === item ? "active" : ""}`} onClick={() => setRange(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-kpi-grid">
        <KpiCard icon={BarChart3} label="Total Incidents" value={analytics.totalIncidents} note={`${range} scope`} tone="warning" />
        <KpiCard icon={ShieldAlert} label="Critical Alerts" value={analytics.criticalAlerts} note="Requires supervisor attention" tone="danger" />
        <KpiCard icon={MapPin} label="Most Risky Zone" value={analytics.highestRiskZone?.zone || "None"} note={`${analytics.highestRiskZone?.count || 0} incidents`} tone="danger" />
        <KpiCard icon={UserRound} label="Highest Risk Worker" value={analytics.highestRiskWorker?.workerName || "None"} note={`${analytics.highestRiskWorker?.count || 0} incidents`} tone="warning" />
        <KpiCard icon={Clock} label="Avg Response" value={`${analytics.averageResponseTime}s`} note="Acknowledgement speed" tone="safe" />
        <KpiCard icon={HardHat} label="Active Live Helmet" value={liveWorker?.id || "W-1001"} note={liveWorker?.isOnline ? "1 live helmet" : "Waiting for live data"} tone="live" />
      </div>

      <div className="analytics-main-grid">
        <RiskScoreCard analytics={analytics} />
        <AlertTypeDistribution distribution={analytics.typeDistribution} />
        <TimeRiskHeatmap windows={analytics.timeWindowRisk} />
      </div>

      <div className="analytics-two-col">
        <TopRiskZones zones={analytics.zoneRisks} />
        <RepeatedExposure workers={analytics.repeatedWorkers} />
      </div>

      <div className="analytics-two-col analytics-lower-grid">
        <TrendPanel trend={analytics.trend} />
        <LiveHelmetInsight worker={liveWorker} />
      </div>

      <div className="analytics-two-col analytics-lower-grid">
        <SafetyRecommendations recommendations={analytics.recommendations} />
        <RecentEvents events={analytics.recentEvents} />
      </div>
    </section>
  );
}

function filterEventsByRange(events, range) {
  if (range === "All") return events;
  const now = Date.now();
  const days = range === "Today" ? 1 : range === "7 Days" ? 7 : 30;
  return events.filter((event) => now - new Date(event.timestamp).getTime() <= days * 24 * 60 * 60 * 1000);
}

function buildAnalytics(events, liveWorker, liveLogs) {
  const zoneRisks = rankBy(events, "zone");
  const typeDistribution = rankBy(events, "alertType");
  const workerRisks = rankBy(events, "workerId", (event) => event.workerName);
  const criticalAlerts = events.filter((event) => event.severity === "Critical").length;
  const highAlerts = events.filter((event) => event.severity === "High").length;
  const warningAlerts = events.filter((event) => event.severity === "Warning" || event.severity === "Medium").length;
  const responseEvents = events.filter((event) => Number.isFinite(event.responseTimeSeconds) && event.responseTimeSeconds > 0);
  const averageResponseTime = responseEvents.length
    ? Math.round(responseEvents.reduce((sum, event) => sum + event.responseTimeSeconds, 0) / responseEvents.length)
    : 0;
  const repeatedWorkers = workerRisks.filter((worker) => worker.count > 1);
  const averageResponseTimePenalty = averageResponseTime > 60 ? 12 : averageResponseTime > 40 ? 8 : averageResponseTime > 25 ? 4 : 0;

  // Prototype risk formula: severity frequency + repeated exposure + response delay, clamped to 0-100.
  const riskScore = Math.min(
    100,
    criticalAlerts * 12 + highAlerts * 8 + warningAlerts * 4 + repeatedWorkers.length * 6 + averageResponseTimePenalty
  );

  return {
    totalIncidents: events.length,
    criticalAlerts,
    averageResponseTime,
    highestRiskZone: zoneRisks[0],
    highestRiskWorker: workerRisks[0],
    zoneRisks,
    typeDistribution,
    repeatedWorkers,
    timeWindowRisk: buildTimeWindowRisk(events),
    riskScore,
    riskLabel: riskScore >= 80 ? "Critical" : riskScore >= 60 ? "High" : riskScore >= 35 ? "Medium" : "Low",
    recommendations: buildRecommendations(zoneRisks, typeDistribution, repeatedWorkers, averageResponseTime),
    recentEvents: [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8),
    trend: buildTrend(events, liveLogs, liveWorker)
  };
}

function rankBy(events, key, labelGetter) {
  const map = new Map();
  events.forEach((event) => {
    const id = event[key] || "Unknown";
    const current = map.get(id) || {
      id,
      zone: key === "zone" ? id : event.zone,
      workerName: labelGetter ? labelGetter(event) : event.workerName,
      label: id,
      count: 0,
      score: 0,
      types: {}
    };
    current.count += 1;
    current.score += severityWeight[event.severity] || 3;
    current.types[event.alertType] = (current.types[event.alertType] || 0) + 1;
    current.lastIncident = !current.lastIncident || new Date(event.timestamp) > new Date(current.lastIncident) ? event.timestamp : current.lastIncident;
    map.set(id, current);
  });

  return [...map.values()]
    .map((item) => ({
      ...item,
      mainRisk: Object.entries(item.types).sort((a, b) => b[1] - a[1])[0]?.[0] || "None",
      riskLevel: item.score >= 28 ? "Critical" : item.score >= 18 ? "High" : item.score >= 8 ? "Medium" : "Low"
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count);
}

function buildTimeWindowRisk(events) {
  return timeWindows.map((window) => {
    const matching = events.filter((event) => {
      const hour = new Date(event.timestamp).getHours();
      const normalizedEnd = window.end > 24 ? window.end - 24 : window.end;
      return window.end > 24 ? hour >= window.start || hour < normalizedEnd : hour >= window.start && hour < window.end;
    });
    const score = matching.reduce((sum, event) => sum + (severityWeight[event.severity] || 3), 0);
    const commonType = rankBy(matching, "alertType")[0]?.id || "None";
    return { ...window, count: matching.length, score, commonType };
  });
}

function buildTrend(events, liveLogs, liveWorker) {
  const logPoints = liveLogs.slice(-7).map((log) => ({
    label: new Date(log.timestamp).toLocaleDateString(undefined, { month: "short", day: "2-digit" }),
    gasValue: Number(log.gasValue),
    temperature: Number(log.temperature)
  }));

  if (logPoints.length > 0) return logPoints;

  const eventPoints = [...events]
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-7)
    .map((event) => ({
      label: new Date(event.timestamp).toLocaleDateString(undefined, { month: "short", day: "2-digit" }),
      gasValue: Number(event.gasValue),
      temperature: Number(event.temperature)
    }));

  if (eventPoints.length > 0) return eventPoints;

  return liveWorker
    ? [{ label: "Live", gasValue: Number(liveWorker.gasValue || 0), temperature: Number(liveWorker.temperature || 0) }]
    : [];
}

function buildRecommendations(zoneRisks, typeDistribution, repeatedWorkers, averageResponseTime) {
  const recommendations = [];
  const topZone = zoneRisks[0];
  const topType = typeDistribution[0];

  if (topZone && topType?.id === "Gas") {
    recommendations.push({
      priority: "High",
      subject: topZone.zone,
      reason: "Gas incidents are repeated in this area.",
      action: "Increase ventilation checks and verify MQ sensor calibration before each shift."
    });
  }

  recommendations.push({
    priority: "Medium",
    subject: "12 PM - 4 PM",
    reason: "Temperature exposure clusters around midday and afternoon shifts.",
    action: "Schedule heat exposure breaks and hydration checks during peak heat windows."
  });

  recommendations.push({
    priority: "Medium",
    subject: "Loading / Forklift Area",
    reason: "Fall-related incidents appear around movement-heavy areas.",
    action: "Inspect floor safety, traffic lanes, and helmet fit before loading operations."
  });

  if (repeatedWorkers.length > 0) {
    recommendations.push({
      priority: averageResponseTime > 55 ? "High" : "Medium",
      subject: repeatedWorkers[0].workerName,
      reason: "This worker appears more than once in the analytics history.",
      action: "Review repeated exposure causes and assign supervisor follow-up."
    });
  }

  return recommendations;
}

function KpiCard({ icon: Icon, label, value, note, tone }) {
  return (
    <div className={`analytics-kpi-card ${tone}`}>
      <Icon size={30} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

function RiskScoreCard({ analytics }) {
  const score = analytics.riskScore;
  return (
    <div className={`analytics-card risk-score-card risk-${analytics.riskLabel.toLowerCase()}`}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Risk Engine</span>
          <h2>Overall Safety Risk Score</h2>
        </div>
        <Gauge size={22} />
      </div>
      <div className="risk-score-body">
        <div className="risk-score-number" style={{ "--score": score }}>
          <strong>{score}</strong>
          <span>/100</span>
        </div>
        <div className="risk-score-copy">
          <span className={`risk-label ${analytics.riskLabel.toLowerCase()}`}>{analytics.riskLabel} Risk</span>
          <p>Risk score is calculated from danger frequency, severity, repeated exposure, and response time.</p>
        </div>
      </div>
      <div className="risk-bar">
        <span style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function TopRiskZones({ zones }) {
  const maxScore = Math.max(1, ...zones.map((zone) => zone.score));
  return (
    <div className="analytics-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Area Intelligence</span>
          <h2>Top Risk Zones</h2>
        </div>
        <MapPin size={22} />
      </div>
      <div className="zone-risk-list">
        {zones.slice(0, 6).map((zone, index) => (
          <div className="zone-risk-row" key={zone.id}>
            <span className="rank-pill">{index + 1}</span>
            <div>
              <strong>{zone.zone}</strong>
              <small>{zone.count} incidents - Most common: {zone.mainRisk}</small>
            </div>
            <div className="zone-risk-bar"><span style={{ width: `${(zone.score / maxScore) * 100}%` }} /></div>
            <span className={`risk-label ${zone.riskLevel.toLowerCase()}`}>{zone.riskLevel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertTypeDistribution({ distribution }) {
  const total = Math.max(1, distribution.reduce((sum, item) => sum + item.count, 0));
  const top = distribution[0];

  return (
    <div className="analytics-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Hazard Mix</span>
          <h2>Alert Type Distribution</h2>
        </div>
        <ShieldAlert size={22} />
      </div>
      <div className="distribution-list">
        {["Gas", "Temperature", "Fall", "SOS"].map((type) => {
          const item = distribution.find((entry) => entry.id === type) || { id: type, count: 0 };
          const percent = Math.round((item.count / total) * 100);
          return (
            <div className={`distribution-row type-${type.toLowerCase()}`} key={type}>
              <span>{type}</span>
              <div className="distribution-bar"><span style={{ width: `${percent}%` }} /></div>
              <strong>{percent}% ({item.count})</strong>
            </div>
          );
        })}
      </div>
      <p className="insight-text">{top ? `${top.id} is the most frequent hazard in the selected period.` : "No incidents in this period."}</p>
    </div>
  );
}

function TimeRiskHeatmap({ windows }) {
  const maxScore = Math.max(1, ...windows.map((window) => window.score));
  return (
    <div className="analytics-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Shift Timing</span>
          <h2>High Risk Time Windows</h2>
        </div>
        <Clock size={22} />
      </div>
      <div className="time-heatmap">
        {windows.map((window) => (
          <div className="time-window" key={window.label}>
            <span>{window.label}</span>
            <div className="heat-cell" style={{ "--heat": Math.max(0.08, window.score / maxScore) }} />
            <strong>{window.count} incidents</strong>
            <small>{window.commonType}</small>
          </div>
        ))}
      </div>
      <p className="insight-text">Highest risk usually clusters around midday and afternoon work periods.</p>
    </div>
  );
}

function RepeatedExposure({ workers }) {
  return (
    <div className="analytics-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Repeated Exposure</span>
          <h2>Workers Requiring Attention</h2>
        </div>
        <UserRound size={22} />
      </div>
      <div className="repeated-list">
        {workers.length === 0 ? (
          <div className="empty-row">No repeated exposure workers in this range.</div>
        ) : (
          workers.slice(0, 6).map((worker) => (
            <div className="repeated-row" key={worker.id}>
              <div>
                <strong>{worker.workerName}</strong>
                <small>{worker.id} - {worker.zone}</small>
              </div>
              <span>{worker.count} incidents</span>
              <span>{worker.mainRisk}</span>
              <span>{formatDateTime(worker.lastIncident)}</span>
              <span className={`risk-label ${worker.riskLevel.toLowerCase()}`}>{worker.riskLevel}</span>
              <Link className="small-btn" to={`/workers/${worker.id}`}>View Worker</Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TrendPanel({ trend }) {
  const maxGas = Math.max(1, ...trend.map((point) => point.gasValue));
  const maxTemp = Math.max(1, ...trend.map((point) => point.temperature));

  return (
    <div className="analytics-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Trend Line</span>
          <h2>Gas & Temperature Trends</h2>
        </div>
        <LineChart size={22} />
      </div>
      <div className="trend-chart">
        {trend.map((point, index) => (
          <div className="trend-column" key={`${point.label}-${index}`}>
            <div className="trend-bars">
              <span className="gas-bar" style={{ height: `${Math.max(8, (point.gasValue / maxGas) * 100)}%` }} />
              <span className="temp-bar" style={{ height: `${Math.max(8, (point.temperature / maxTemp) * 100)}%` }} />
            </div>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span><i style={{ background: "#ff4444" }} /> Gas</span>
        <span><i style={{ background: "#ffd700" }} /> Temperature</span>
      </div>
    </div>
  );
}

function LiveHelmetInsight({ worker }) {
  const interpretation = getLiveInterpretation(worker);
  return (
    <div className="analytics-card live-insight-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Real Data</span>
          <h2>Live Helmet Insight</h2>
        </div>
        <span className="live-mini"><span className="live-dot" /> LIVE</span>
      </div>
      {worker ? (
        <>
          <div className="live-worker-profile">
            <div className="avatar">{worker.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>
            <div>
              <strong>{worker.name}</strong>
              <span>{worker.id} - {worker.helmetId}</span>
              <small>{worker.zone}</small>
            </div>
            <StatusBadge status={worker.isOnline ? worker.status : "OFFLINE"} />
          </div>
          <div className="profile-grid">
            <Metric label="Temperature" value={`${worker.temperature} C`} />
            <Metric label="Gas" value={worker.gasValue} />
            <Metric label="Humidity" value={`${worker.humidity}%`} />
            <Metric label="Last Reading" value={worker.lastUpdate ? formatTime(worker.lastUpdate) : "Waiting"} />
          </div>
          <div className={`live-interpretation ${interpretation.tone}`}>
            <ShieldCheck size={20} />
            <span>{interpretation.text}</span>
          </div>
        </>
      ) : (
        <div className="empty-row">Waiting for W-1001 live helmet data.</div>
      )}
    </div>
  );
}

function getLiveInterpretation(worker) {
  if (!worker) return { tone: "warning", text: "Live helmet data is not available yet." };
  if (!worker.isOnline) return { tone: "warning", text: "W-1001 is currently offline. Waiting for the next ESP32 reading." };
  if (worker.status === "DANGER") return { tone: "danger", text: `${worker.alertType || "Danger"} requires immediate supervisor attention.` };
  if (worker.status === "WARNING") return { tone: "warning", text: `${worker.alertType || "Warning"} is approaching the safety threshold.` };
  return { tone: "safe", text: "Current readings are within safe limits. All systems normal." };
}

function SafetyRecommendations({ recommendations }) {
  return (
    <div className="analytics-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Action Plan</span>
          <h2>Safety Recommendations</h2>
        </div>
        <TrendingUp size={22} />
      </div>
      <div className="recommendation-list">
        {recommendations.map((item) => (
          <div className="recommendation-card" key={`${item.priority}-${item.subject}-${item.action}`}>
            <AlertTriangle size={20} />
            <div>
              <strong>{item.subject}</strong>
              <span>{item.reason}</span>
              <small>{item.action}</small>
            </div>
            <span className={`risk-label ${item.priority.toLowerCase()}`}>{item.priority}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentEvents({ events }) {
  return (
    <div className="analytics-card recent-events-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Event Stream</span>
          <h2>Recent Analytics Events</h2>
        </div>
        <Wind size={22} />
      </div>
      <div className="analytics-events-table">
        <div className="analytics-events-head">
          <span>Time</span>
          <span>Worker</span>
          <span>Zone</span>
          <span>Alert Type</span>
          <span>Severity</span>
          <span>Response</span>
          <span>Status</span>
        </div>
        {events.map((event) => (
          <div className="analytics-events-row" key={`${event.workerId}-${event.timestamp}-${event.alertType}`}>
            <span>{formatDateTime(event.timestamp)}</span>
            <span>{event.workerName}</span>
            <span>{event.zone}</span>
            <span>{event.alertType}</span>
            <span className={`severity ${String(event.severity).toLowerCase()}`}>{event.severity}</span>
            <span>{event.responseTimeSeconds || "--"}s</span>
            <span className={`alert-status ${event.acknowledged ? "acknowledged" : "active"}`}>{event.acknowledged ? "Acknowledged" : "Active"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
