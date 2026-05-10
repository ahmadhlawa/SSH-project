const { workers, alerts } = require("../data/mockData");
const { thresholds } = require("../data/thresholds");
const { maybeLogWorkerReading } = require("./sensorLogService");

let ioInstance = null;
const ALERT_COOLDOWN_MS = 120000;
const HELMET_OFFLINE_TIMEOUT_MS = Number(process.env.HELMET_OFFLINE_TIMEOUT_MS || 10000);
const HELMET_PRESENCE_CHECK_MS = 1000;
let presenceMonitor = null;

function setIo(io) {
  ioInstance = io;
}

function getWorkers() {
  return workers;
}

function getWorkerById(id) {
  return workers.find((worker) => worker.id === id);
}

function getAlerts() {
  return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function isDangerAlert(alert) {
  return alert.severity === "Critical" || alert.severity === "High";
}

function evaluateStatus(reading) {
  if (reading.sosPressed) return { status: "DANGER", alertType: "SOS", severity: "Critical" };
  if (reading.fallDetected) return { status: "DANGER", alertType: "Fall", severity: "Critical" };
  if (reading.gasValue >= thresholds.gasDanger) return { status: "DANGER", alertType: "Gas", severity: "Critical" };
  if (reading.temperature >= thresholds.temperatureDanger) {
    return { status: "DANGER", alertType: "Temperature", severity: "High" };
  }
  if (reading.humidity >= thresholds.humidityDanger) {
    return { status: "DANGER", alertType: "Humidity", severity: "High" };
  }
  if (reading.gasValue >= thresholds.gasWarning) return { status: "WARNING", alertType: "Gas", severity: "Medium" };
  if (reading.temperature >= thresholds.temperatureWarning) {
    return { status: "WARNING", alertType: "Temperature", severity: "Medium" };
  }
  if (reading.humidity >= thresholds.humidityWarning) {
    return { status: "WARNING", alertType: "Humidity", severity: "Medium" };
  }
  return { status: "SAFE", alertType: null, severity: null };
}

function createAlert(worker) {
  if (worker.status === "SAFE") return null;

  const recentDuplicate = alerts.find((alert) => {
    const ageMs = Date.now() - new Date(alert.timestamp).getTime();
    return alert.workerId === worker.id && alert.type === worker.alertType && ageMs < ALERT_COOLDOWN_MS;
  });

  if (recentDuplicate) return null;

  const alert = {
    id: `ALT-${Date.now()}`,
    workerId: worker.id,
    workerName: worker.name,
    type: worker.alertType,
    severity: worker.severity,
    timestamp: new Date().toISOString(),
    status: "active",
    readings: {
      temperature: worker.temperature,
    humidity: worker.humidity,
    gasValue: worker.gasValue,
    fallDetected: worker.fallDetected,
    sosPressed: worker.sosPressed,
    acX: worker.acX,
    acY: worker.acY,
    acZ: worker.acZ,
    gyX: worker.gyX,
    gyY: worker.gyY,
    gyZ: worker.gyZ
    },
    zone: worker.zone
  };

  alerts.push(alert);
  return alert;
}

function updateWorkerReading(workerId, reading) {
  const worker = getWorkerById(workerId);
  if (!worker) return null;

  const nextReading = {
    temperature: Number(reading.temperature ?? worker.temperature),
    humidity: Number(reading.humidity ?? worker.humidity),
    gasValue: Number(reading.gasValue ?? worker.gasValue),
    fallDetected: Boolean(reading.fallDetected ?? worker.fallDetected),
    sosPressed: Boolean(reading.sosPressed ?? worker.sosPressed),
    acX: reading.acX === undefined ? worker.acX : Number(reading.acX),
    acY: reading.acY === undefined ? worker.acY : Number(reading.acY),
    acZ: reading.acZ === undefined ? worker.acZ : Number(reading.acZ),
    gyX: reading.gyX === undefined ? worker.gyX : Number(reading.gyX),
    gyY: reading.gyY === undefined ? worker.gyY : Number(reading.gyY),
    gyZ: reading.gyZ === undefined ? worker.gyZ : Number(reading.gyZ)
  };

  const statusResult = evaluateStatus(nextReading);

  Object.assign(worker, nextReading, statusResult, {
    helmetId: reading.helmetId === undefined ? worker.helmetId : String(reading.helmetId),
    isOnline: true,
    offlineAt: null,
    lat: reading.lat === undefined ? worker.lat : Number(reading.lat),
    lng: reading.lng === undefined ? worker.lng : Number(reading.lng),
    lastUpdate: new Date().toISOString()
  });

  const alert = createAlert(worker);
  maybeLogWorkerReading(worker);

  if (ioInstance) {
    ioInstance.emit("worker:update", worker);
    if (alert) ioInstance.emit("alert:new", alert);
  }

  return { worker, alert };
}

function markStaleHelmetsOffline() {
  const now = Date.now();

  workers.forEach((worker) => {
    if (!worker.isOnline) return;

    const lastUpdateAt = new Date(worker.lastUpdate).getTime();
    if (!Number.isFinite(lastUpdateAt) || now - lastUpdateAt < HELMET_OFFLINE_TIMEOUT_MS) return;

    worker.isOnline = false;
    worker.offlineAt = new Date(now).toISOString();

    if (ioInstance) ioInstance.emit("worker:update", worker);
  });
}

function startHelmetPresenceMonitor() {
  if (presenceMonitor) return;
  presenceMonitor = setInterval(markStaleHelmetsOffline, HELMET_PRESENCE_CHECK_MS);
}

function getHelmetAlarmState(workerId) {
  const worker = getWorkerById(workerId);
  if (!worker) return null;

  const workerAlerts = alerts
    .filter((alert) => alert.workerId === workerId && isDangerAlert(alert))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const latestDangerAlert = workerAlerts[0] || null;
  const activeDangerAlert = workerAlerts.find((alert) => alert.status === "active") || null;

  return {
    workerId,
    alarmActive: Boolean(activeDangerAlert),
    acknowledged: latestDangerAlert?.status === "acknowledged",
    latestAlertId: latestDangerAlert?.id || null,
    latestAlertStatus: latestDangerAlert?.status || null
  };
}

function acknowledgeAlert(alertId) {
  const alert = alerts.find((item) => item.id === alertId);
  if (!alert) return null;
  alert.status = "acknowledged";
  alert.acknowledgedAt = new Date().toISOString();

  if (ioInstance) ioInstance.emit("alert:update", alert);
  return alert;
}

module.exports = {
  setIo,
  getWorkers,
  getWorkerById,
  getAlerts,
  updateWorkerReading,
  acknowledgeAlert,
  getHelmetAlarmState,
  startHelmetPresenceMonitor,
  evaluateStatus
};
