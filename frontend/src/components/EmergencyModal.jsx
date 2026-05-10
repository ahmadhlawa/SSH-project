import { AlertOctagon, BellOff, Eye, ShieldAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSafety } from "../context/SafetyContext.jsx";
import { formatDateTime } from "../services/format.js";

export default function EmergencyModal({ worker, alert }) {
  const navigate = useNavigate();
  const { alarmEnabled, acknowledgeEmergency } = useSafety();
  const audioRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    stopAlarm();
    if (!worker || !alarmEnabled) return undefined;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return undefined;

    const context = new AudioContext();
    audioRef.current = context;

    const beep = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      oscillator.type = "square";
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.38);
    };

    context.resume().then(beep).catch(() => {});
    intervalRef.current = window.setInterval(beep, 850);

    return stopAlarm;
  }, [worker, alarmEnabled]);

  function stopAlarm() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (audioRef.current) {
      audioRef.current.close().catch(() => {});
      audioRef.current = null;
    }
  }

  if (!worker) return null;

  const dangerType = alert?.type || worker.alertType || "Danger";
  const severity = alert?.severity || worker.severity || "Critical";

  const handleAcknowledge = async () => {
    stopAlarm();
    await acknowledgeEmergency(worker.id);
  };

  return (
    <div className="emergency-overlay" role="dialog" aria-modal="true">
      <div className="emergency-modal">
        <div className="emergency-title">
          <AlertOctagon size={42} />
          <div>
            <span>Emergency Alert</span>
            <h2>{dangerType} detected</h2>
          </div>
        </div>
        <div className="emergency-worker">
          <div>
            <strong>{worker.name}</strong>
            <span>{worker.id} - {worker.helmetId}</span>
          </div>
          <div className="emergency-severity">{severity}</div>
        </div>
        <div className="emergency-grid">
          <span>Danger Type <strong>{dangerType}</strong></span>
          <span>Severity <strong>{severity}</strong></span>
          <span>Temperature <strong>{worker.temperature} C</strong></span>
          <span>Gas <strong>{worker.gasValue}</strong></span>
          <span>Humidity <strong>{worker.humidity}%</strong></span>
          <span>Fall <strong>{worker.fallDetected ? "YES" : "No"}</strong></span>
          <span>SOS <strong>{worker.sosPressed ? "Pressed" : "No"}</strong></span>
          <span>Zone <strong>{worker.zone}</strong></span>
          <span>Timestamp <strong>{formatDateTime(alert?.timestamp || worker.lastUpdate)}</strong></span>
        </div>
        <div className="emergency-actions">
          <button className="btn btn-dark" onClick={() => navigate(`/workers/${worker.id}`)}>
            <Eye size={18} /> View Worker
          </button>
          <button className="btn btn-light" onClick={handleAcknowledge}>
            <BellOff size={18} /> تم الاستعلام
          </button>
        </div>
        <div className="emergency-note">
          <ShieldAlert size={18} />
          Dispatch supervisor response to {worker.zone} immediately.
        </div>
      </div>
    </div>
  );
}
