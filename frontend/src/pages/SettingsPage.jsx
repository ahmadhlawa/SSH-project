import { AlertTriangle, Bell, BellOff, RotateCcw, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useSafety } from "../context/SafetyContext.jsx";
import { api } from "../services/api.js";

export default function SettingsPage() {
  const { workers, thresholds, setThresholds, alarmEnabled, setAlarmEnabled } = useSafety();
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [demoActionStatus, setDemoActionStatus] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!selectedWorkerId && workers.length > 0) {
      setSelectedWorkerId(workers[0].id);
    }
  }, [selectedWorkerId, workers]);

  const updateThreshold = (key, value) => {
    setThresholds((current) => ({ ...current, [key]: Number(value) }));
  };

  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId) || workers[0];

  const sendDemoReading = async (type) => {
    if (!selectedWorker) return;

    const payloads = {
      warning: {
        workerId: selectedWorker.id,
        helmetId: selectedWorker.helmetId,
        temperature: 38.2,
        humidity: 72,
        gasValue: 1350,
        fallDetected: false,
        sosPressed: false
      },
      danger: {
        workerId: selectedWorker.id,
        helmetId: selectedWorker.helmetId,
        temperature: 43.5,
        humidity: 88,
        gasValue: 1900,
        fallDetected: false,
        sosPressed: false
      }
    };

    setIsSending(true);
    setDemoActionStatus("");

    try {
      await api.sendHelmetReading(payloads[type]);
      setDemoActionStatus(`${type === "danger" ? "Danger" : "Warning"} reading sent for ${selectedWorker.name}.`);
    } catch (error) {
      setDemoActionStatus(error.message);
    } finally {
      setIsSending(false);
    }
  };

  const resetAllToSafe = async () => {
    setIsSending(true);
    setDemoActionStatus("");

    try {
      await Promise.all(
        workers.map((worker) =>
          api.sendHelmetReading({
            workerId: worker.id,
            helmetId: worker.helmetId,
            temperature: 32,
            humidity: 48,
            gasValue: 260,
            fallDetected: false,
            sosPressed: false
          })
        )
      );
      setDemoActionStatus("All workers reset to safe readings.");
    } catch (error) {
      setDemoActionStatus(error.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="page settings-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Demo Controls</span>
          <h1>Settings</h1>
          <p>Adjust presentation thresholds and alarm behavior for the dashboard demo.</p>
        </div>
      </div>
      <div className="settings-grid">
        {Object.entries(thresholds).map(([key, value]) => (
          <label className="setting-control" key={key}>
            <span>{labelFor(key)}</span>
            <input type="number" value={value} onChange={(event) => updateThreshold(key, event.target.value)} />
          </label>
        ))}
        <div className="setting-control toggle-control">
          <span>Alarm Sound</span>
          <button className={`toggle ${alarmEnabled ? "on" : ""}`} onClick={() => setAlarmEnabled(!alarmEnabled)}>
            {alarmEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            {alarmEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>
      <div className="demo-controls-panel">
        <div>
          <span className="eyebrow">Demo Controls</span>
          <h2>Manual Scenario Triggers</h2>
          <p>Send controlled readings through the same endpoint used by ESP32 helmets.</p>
        </div>
        <label className="setting-control demo-worker-select">
          <span>Demo Worker</span>
          <select value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(event.target.value)}>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name} - {worker.id}
              </option>
            ))}
          </select>
        </label>
        <div className="demo-actions">
          <button className="demo-btn warning" disabled={isSending || !selectedWorker} onClick={() => sendDemoReading("warning")}>
            <AlertTriangle size={18} /> Trigger Warning
          </button>
          <button className="demo-btn danger" disabled={isSending || !selectedWorker} onClick={() => sendDemoReading("danger")}>
            <ShieldAlert size={18} /> Trigger Danger
          </button>
          <button className="demo-btn neutral" disabled={isSending || workers.length === 0} onClick={resetAllToSafe}>
            <RotateCcw size={18} /> Reset All To Safe
          </button>
        </div>
        {demoActionStatus && <div className="demo-action-status">{demoActionStatus}</div>}
      </div>
    </section>
  );
}

function labelFor(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}
