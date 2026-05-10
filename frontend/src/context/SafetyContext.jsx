import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { createSocket } from "../services/socket";

const SafetyContext = createContext(null);

export function SafetyProvider({ children }) {
  const [workers, setWorkers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [alarmEnabled, setAlarmEnabled] = useState(() => localStorage.getItem("alarmEnabled") !== "false");
  const [thresholds, setThresholds] = useState({
    temperatureWarning: 37,
    temperatureDanger: 40,
    gasWarning: 1300,
    gasDanger: 1800
  });
  const [acknowledgedDangerIds, setAcknowledgedDangerIds] = useState([]);

  useEffect(() => {
    let active = true;

    api.getHealth()
      .then((health) => setDemoMode(Boolean(health.demoMode)))
      .catch((error) => console.error(error));

    Promise.all([api.getWorkers(), api.getAlerts()])
      .then(([workerData, alertData]) => {
        if (!active) return;
        setWorkers(workerData);
        setAlerts(alertData);
      })
      .catch((error) => console.error(error))
      .finally(() => active && setLoading(false));

    const socket = createSocket();

    socket.on("connect", () => {
      setConnectionStatus("connected");
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("workers:init", ({ workers: socketWorkers, alerts: socketAlerts }) => {
      setWorkers(socketWorkers);
      setAlerts(socketAlerts);
      setLastRealtimeUpdate(new Date().toISOString());
    });

    socket.on("worker:update", (worker) => {
      setWorkers((current) => current.map((item) => (item.id === worker.id ? worker : item)));
      setLastRealtimeUpdate(new Date().toISOString());
    });

    socket.on("alert:new", (alert) => {
      setAlerts((current) => [alert, ...current]);
      setLastRealtimeUpdate(new Date().toISOString());
      if (alert.severity === "Critical" || alert.severity === "High") {
        setAcknowledgedDangerIds((current) => current.filter((id) => id !== alert.workerId));
      }
    });

    socket.on("alert:update", (alert) => {
      setAlerts((current) => current.map((item) => (item.id === alert.id ? alert : item)));
      setLastRealtimeUpdate(new Date().toISOString());
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("alarmEnabled", String(alarmEnabled));
  }, [alarmEnabled]);

  const isDangerAlert = (alert) => alert.severity === "Critical" || alert.severity === "High";
  const isLocallyAcknowledged = (workerId) => acknowledgedDangerIds.includes(workerId);
  const activeDangerAlerts = alerts.filter(
    (alert) =>
      alert.status === "active" &&
      isDangerAlert(alert) &&
      !isLocallyAcknowledged(alert.workerId)
  );
  const alertBackedDanger = activeDangerAlerts[0] || null;
  const fallbackDangerWorker = workers.find((worker) => {
    if (!worker.isOnline || worker.status !== "DANGER" || isLocallyAcknowledged(worker.id)) return false;

    const latestWorkerDangerAlert = alerts.find((alert) => alert.workerId === worker.id && isDangerAlert(alert));
    return !latestWorkerDangerAlert || latestWorkerDangerAlert.status === "active";
  }) || null;
  const activeDangerWorker = alertBackedDanger
    ? workers.find((worker) => worker.id === alertBackedDanger.workerId) || fallbackDangerWorker
    : fallbackDangerWorker;
  const activeDangerAlert = activeDangerWorker
    ? alerts.find((alert) => alert.workerId === activeDangerWorker.id && alert.status === "active" && isDangerAlert(alert)) || null
    : null;

  const acknowledgeEmergency = async (workerId) => {
    setAcknowledgedDangerIds((current) => [...new Set([...current, workerId])]);
    const workerAlerts = alerts.filter(
      (alert) => alert.workerId === workerId && alert.status === "active" && (alert.severity === "Critical" || alert.severity === "High")
    );

    await Promise.allSettled(workerAlerts.map((alert) => api.acknowledgeAlert(alert.id)));
  };

  const acknowledgeAlert = async (alertId) => {
    const updated = await api.acknowledgeAlert(alertId);
    setAlerts((current) => current.map((item) => (item.id === alertId ? updated : item)));
  };

  const value = useMemo(
    () => ({
      workers,
      alerts,
      loading,
      connectionStatus,
      lastRealtimeUpdate,
      demoMode,
      thresholds,
      setThresholds,
      alarmEnabled,
      setAlarmEnabled,
      activeDangerWorker,
      activeDangerAlert,
      acknowledgeEmergency,
      acknowledgeAlert
    }),
    [workers, alerts, loading, connectionStatus, lastRealtimeUpdate, demoMode, thresholds, alarmEnabled, activeDangerWorker, activeDangerAlert]
  );

  return <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>;
}

export function useSafety() {
  const context = useContext(SafetyContext);
  if (!context) throw new Error("useSafety must be used inside SafetyProvider");
  return context;
}
