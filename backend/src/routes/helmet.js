const express = require("express");
const { getWorkerById, updateWorkerReading, getHelmetAlarmState } = require("../services/safetyService");

const router = express.Router();

function isProvided(value) {
  return value !== undefined && value !== null && value !== "";
}

function parseOptionalNumber(body, key, errors) {
  if (!isProvided(body[key])) return undefined;
  const value = Number(body[key]);
  if (!Number.isFinite(value)) {
    errors.push(`${key} must be a valid number`);
    return undefined;
  }
  return value;
}

function parseOptionalBoolean(body, key, errors) {
  if (!isProvided(body[key])) return undefined;
  if (typeof body[key] === "boolean") return body[key];
  if (body[key] === 1 || body[key] === "1" || body[key] === "true") return true;
  if (body[key] === 0 || body[key] === "0" || body[key] === "false") return false;
  errors.push(`${key} must be true or false`);
  return undefined;
}

function validateReadingPayload(body) {
  const errors = [];
  const workerId = body.workerId || body.id;

  if (!workerId || typeof workerId !== "string") {
    errors.push("workerId is required and must be a string");
  }

  const reading = {};
  const numericFields = ["temperature", "humidity", "gasValue", "lat", "lng", "acX", "acY", "acZ", "gyX", "gyY", "gyZ", "accelG", "gyroDPS", "timestamp"];
  const booleanFields = ["fallDetected", "fall", "fallAlert", "sosPressed", "alert", "helmetTilted"];

  numericFields.forEach((field) => {
    const value = parseOptionalNumber(body, field, errors);
    if (value !== undefined) reading[field] = value;
  });

  booleanFields.forEach((field) => {
    const value = parseOptionalBoolean(body, field, errors);
    if (value !== undefined) reading[field] = value;
  });

  if (reading.fallDetected === undefined && reading.fall !== undefined) {
    reading.fallDetected = reading.fall;
  }

  if (isProvided(body.helmetId)) reading.helmetId = String(body.helmetId);
  if (isProvided(body.alertType)) reading.deviceAlertType = String(body.alertType);

  return { workerId, reading, errors };
}

router.post("/readings", (req, res) => {
  const { workerId, reading, errors } = validateReadingPayload(req.body || {});

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Invalid helmet reading payload",
      errors
    });
  }

  const worker = getWorkerById(workerId);
  if (!worker) {
    return res.status(404).json({
      message: "Worker not found",
      workerId
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[helmet:reading]", {
      workerId,
      helmetId: reading.helmetId || worker.helmetId,
      ...reading
    });
  }

  const result = updateWorkerReading(workerId, reading);

  return res.status(201).json({
    ...result,
    alarmState: getHelmetAlarmState(workerId)
  });
});

router.get("/alarm-state", (req, res) => {
  const workerId = req.query.workerId || req.query.id;

  if (!workerId || typeof workerId !== "string") {
    return res.status(400).json({ message: "workerId is required" });
  }

  const alarmState = getHelmetAlarmState(workerId);
  if (!alarmState) {
    return res.status(404).json({ message: "Worker not found", workerId });
  }

  return res.json(alarmState);
});

module.exports = router;
