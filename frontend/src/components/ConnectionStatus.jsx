import { Radio } from "lucide-react";
import { useSafety } from "../context/SafetyContext.jsx";
import { formatTime } from "../services/format.js";

const labels = {
  connected: "Backend connected",
  connecting: "Connecting",
  disconnected: "Backend disconnected"
};

export default function ConnectionStatus() {
  const { connectionStatus, lastRealtimeUpdate, demoMode } = useSafety();

  return (
    <div className="connection-strip">
      <div className={`connection-pill ${connectionStatus}`}>
        <Radio size={16} />
        <span>{labels[connectionStatus]}</span>
      </div>
      <div className="connection-meta">
        Last realtime update: <strong>{lastRealtimeUpdate ? formatTime(lastRealtimeUpdate) : "Waiting"}</strong>
      </div>
      {demoMode && <div className="demo-badge">Demo Mode Active</div>}
    </div>
  );
}
