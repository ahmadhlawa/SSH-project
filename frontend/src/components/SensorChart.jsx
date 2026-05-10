import { Activity } from "lucide-react";
import { formatDateTime } from "../services/format.js";

const chartWidth = 720;
const chartHeight = 260;
const padding = { top: 18, right: 20, bottom: 38, left: 42 };
const seriesConfig = {
  temperature: { label: "Temp", color: "#ff4444", unit: "C" },
  humidity: { label: "Humidity", color: "#2563eb", unit: "%" },
  gasValue: { label: "Gas", color: "#0f0f0f", unit: "" }
};

function normalizePoint(value, min, max, height) {
  if (max === min) return padding.top + height / 2;
  const ratio = (value - min) / (max - min);
  return padding.top + height - ratio * height;
}

function buildPath(logs, key, min, max) {
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  return logs
    .map((log, index) => {
      const x = padding.left + (logs.length === 1 ? innerWidth / 2 : (index / (logs.length - 1)) * innerWidth);
      const y = normalizePoint(Number(log[key]), min, max, innerHeight);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function getRange(logs, key) {
  const values = logs.map((log) => Number(log[key]));
  const cleanValues = values.filter(Number.isFinite);

  if (cleanValues.length === 0) return { min: 0, max: 1 };

  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const spread = Math.max(1, max - min);

  return {
    min: Math.max(0, Math.floor(min - spread * 0.08)),
    max: Math.ceil(max + spread * 0.08)
  };
}

export default function SensorChart({ logs, loading }) {
  const visibleLogs = logs.slice(-48);
  const ranges = Object.keys(seriesConfig).reduce((acc, key) => {
    acc[key] = getRange(visibleLogs, key);
    return acc;
  }, {});
  const latest = visibleLogs[visibleLogs.length - 1];

  return (
    <div className="sensor-chart-panel">
      <div className="chart-header">
        <div>
          <span className="eyebrow">Helmet Logs</span>
          <h2>Sensor Chart</h2>
        </div>
        <div className="chart-meta">
          <Activity size={17} />
          {loading ? "Loading logs..." : `${visibleLogs.length} snapshots`}
        </div>
      </div>

      {visibleLogs.length === 0 ? (
        <div className="chart-empty">No CSV logs yet. The first real helmet reading will create the first snapshot.</div>
      ) : (
        <>
          <div className="chart-stage" aria-label="Sensor readings chart">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img">
              <line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight - padding.bottom} />
              <line x1={padding.left} y1={chartHeight - padding.bottom} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom} />
              <text x="8" y={padding.top + 5}>High</text>
              <text x="8" y={chartHeight - padding.bottom}>Low</text>
              {Object.entries(seriesConfig).map(([key, config]) => (
                <path key={key} d={buildPath(visibleLogs, key, ranges[key].min, ranges[key].max)} stroke={config.color} />
              ))}
              {Object.entries(seriesConfig).flatMap(([key, config]) =>
                visibleLogs.map((log, index) => {
                  const innerWidth = chartWidth - padding.left - padding.right;
                  const x = padding.left + (visibleLogs.length === 1 ? innerWidth / 2 : (index / (visibleLogs.length - 1)) * innerWidth);
                  const y = normalizePoint(Number(log[key]), ranges[key].min, ranges[key].max, chartHeight - padding.top - padding.bottom);
                  return <circle key={`${key}-${log.timestamp}-${index}`} cx={x} cy={y} r="3.4" style={{ fill: config.color }} />;
                })
              )}
            </svg>
          </div>
          <div className="chart-legend">
            {Object.entries(seriesConfig).map(([key, config]) => (
              <span key={key}><i style={{ background: config.color }} /> {config.label}</span>
            ))}
          </div>
          {latest && (
            <div className="chart-latest">
              <span>Latest CSV snapshot</span>
              <strong>{formatDateTime(latest.timestamp)}</strong>
              <span>{latest.temperature}C / {latest.humidity}% / Gas {latest.gasValue}</span>
              {latest.acX !== null && (
                <span>MPU A({latest.acX}, {latest.acY}, {latest.acZ}) G({latest.gyX}, {latest.gyY}, {latest.gyZ})</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
