const { workers, alerts } = require("../data/mockData");
const { thresholds } = require("../data/thresholds");
const { maybeLogWorkerReading } = require("./sensorLogService");

let ioInstance = null;
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
  if (reading.gasValue >= thresholds.gasWarning) return { status: "WARNING", alertType: "Gas", severity: "Medium" };
  if (reading.temperature >= thresholds.temperatureWarning) {
    return { status: "WARNING", alertType: "Temperature", severity: "Medium" };
  }
  return { status: "SAFE", alertType: null, severity: null };
}

function isOpenAlert(alert) {
  return !alert.resolvedAt && (alert.status === "active" || alert.status === "acknowledged");
}

function updateAlertReadings(alert, worker) {
  alert.workerName = worker.name;
  alert.severity = worker.severity || alert.severity;
  alert.readings = {
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
    gyZ: worker.gyZ,
    accelG: worker.accelG,
    gyroDPS: worker.gyroDPS,
    helmetTilted: worker.helmetTilted,
    fallAlert: worker.fallAlert
  };
  alert.zone = worker.zone;
  alert.lastReadingAt = worker.lastUpdate;
}

function closeOpenAlertCycles(workerId) {
  const closedAlerts = [];
  const now = new Date().toISOString();

  alerts.forEach((alert) => {
    if (alert.workerId !== workerId || !isOpenAlert(alert)) return;
    alert.resolvedAt = alert.resolvedAt || now;
    closedAlerts.push(alert);
  });

  return closedAlerts;
}

function createAlert(worker) {
  if (worker.status === "SAFE") return null;

  const openSameTypeAlert = alerts.find((alert) => {
    return alert.workerId === worker.id && alert.type === worker.alertType && isOpenAlert(alert);
  });

  if (openSameTypeAlert) {
    updateAlertReadings(openSameTypeAlert, worker);
    return { alert: openSameTypeAlert, created: false };
  }

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
      gyZ: worker.gyZ,
      accelG: worker.accelG,
      gyroDPS: worker.gyroDPS,
      helmetTilted: worker.helmetTilted,
      fallAlert: worker.fallAlert
    },
    zone: worker.zone
  };

  alerts.push(alert);
  return { alert, created: true };
}

function updateWorkerReading(workerId, reading) {
  const worker = getWorkerById(workerId);
  if (!worker) return null;
  const nextLat = reading.lat === undefined ? undefined : Number(reading.lat);
  const nextLng = reading.lng === undefined ? undefined : Number(reading.lng);
  const hasValidGpsLocation =
    reading.gpsValid !== false &&
    Number.isFinite(nextLat) &&
    Number.isFinite(nextLng) &&
    nextLat !== 0 &&
    nextLng !== 0;

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
    gyZ: reading.gyZ === undefined ? worker.gyZ : Number(reading.gyZ),
    accelG: reading.accelG === undefined ? worker.accelG : Number(reading.accelG),
    gyroDPS: reading.gyroDPS === undefined ? worker.gyroDPS : Number(reading.gyroDPS),
    helmetTilted: Boolean(reading.helmetTilted ?? worker.helmetTilted),
    fallAlert: Boolean(reading.fallAlert ?? worker.fallAlert),
    gpsValid: Boolean(reading.gpsValid ?? worker.gpsValid),
    alert: Boolean(reading.alert ?? worker.alert),
    deviceTimestamp: reading.timestamp === undefined ? worker.deviceTimestamp : Number(reading.timestamp),
    deviceAlertType: reading.deviceAlertType === undefined ? worker.deviceAlertType : String(reading.deviceAlertType)
  };

  const statusResult = evaluateStatus(nextReading);
  const previousStatus = worker.status;
  const lastSeen = new Date().toISOString();
  const lat = hasValidGpsLocation ? nextLat : worker.lat;
  const lng = hasValidGpsLocation ? nextLng : worker.lng;

  Object.assign(worker, nextReading, statusResult, {
    workerId: worker.id,
    helmetId: reading.helmetId === undefined ? worker.helmetId : String(reading.helmetId),
    isOnline: true,
    offlineAt: null,
    latitude: lat,
    longitude: lng,
    lat,
    lng,
    lastSeen,
    lastUpdate: lastSeen
  });

  const closedAlerts = worker.status === "SAFE" && previousStatus !== "SAFE" ? closeOpenAlertCycles(worker.id) : [];
  const alertResult = worker.status === "SAFE" ? null : createAlert(worker);
  const alert = alertResult?.created ? alertResult.alert : null;
  maybeLogWorkerReading(worker);

  if (ioInstance) {
    ioInstance.emit("worker:update", worker);
    closedAlerts.forEach((closedAlert) => ioInstance.emit("alert:update", closedAlert));
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
  const openDangerAlert = workerAlerts.find((alert) => isOpenAlert(alert)) || null;
  const alarmCycleAlert = worker.status === "DANGER" ? openDangerAlert : null;

  return {
    workerId,
    alarmActive: Boolean(alarmCycleAlert),
    acknowledged: Boolean(alarmCycleAlert && alarmCycleAlert.status === "acknowledged"),
    alertType: alarmCycleAlert?.type || latestDangerAlert?.type || null,
    severity: alarmCycleAlert?.severity || latestDangerAlert?.severity || null,
    activeAlertId: alarmCycleAlert?.id || null,
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
