import { Menu, Moon, Radio, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useSafety } from "../context/SafetyContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { formatTime } from "../services/format.js";

const pageMeta = {
  "/": {
    title: "Worker Safety Dashboard",
    subtitle: "Live helmet telemetry, alarms, and site visibility."
  },
  "/map": {
    title: "Location Command",
    subtitle: "Monitor worker positions and zone status in Jerusalem."
  },
  "/alerts": {
    title: "Incident Center",
    subtitle: "Review active, acknowledged, and historical safety alerts."
  },
  "/analytics": {
    title: "Safety Analytics",
    subtitle: "Risk patterns, exposure trends, and incident intelligence."
  },
  "/settings": {
    title: "System Settings",
    subtitle: "Tune dashboard thresholds, alarm sound, and demo controls."
  }
};

export default function AppHeader({ onMenuClick }) {
  const location = useLocation();
  const { connectionStatus, lastRealtimeUpdate, demoMode, workers } = useSafety();
  const { theme, toggleTheme } = useTheme();
  const currentMeta = location.pathname.startsWith("/workers/")
    ? { title: "Worker Profile", subtitle: "Helmet telemetry, logs, map, and response timeline." }
    : pageMeta[location.pathname] || pageMeta["/"];
  const liveWorkers = workers.filter((worker) => worker.isOnline).length;

  return (
    <header className="top-header">
      <div className="top-header-main">
        <button className="icon-btn menu-toggle" type="button" aria-label="Open navigation menu" onClick={onMenuClick}>
          <Menu size={21} />
        </button>
        <div>
          <span className="eyebrow">Smart Safety Helmet</span>
          <h1>{currentMeta.title}</h1>
          <p>{currentMeta.subtitle}</p>
        </div>
      </div>
      <div className="top-header-actions">
        <div className={`connection-pill ${connectionStatus}`}>
          <Radio size={16} />
          <span>{connectionStatus === "connected" ? "Backend connected" : connectionStatus === "connecting" ? "Connecting" : "Disconnected"}</span>
        </div>
        <div className="live-pill">
          <span className="live-dot" />
          {liveWorkers} live
        </div>
        <div className="connection-meta">
          Updated <strong>{lastRealtimeUpdate ? formatTime(lastRealtimeUpdate) : "Waiting"}</strong>
        </div>
        {demoMode && <div className="demo-badge">Demo Mode</div>}
        <button className="icon-btn" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </div>
    </header>
  );
}
