const express = require("express");
const { getWorkers, getWorkerById } = require("../services/safetyService");
const { readSensorLogs } = require("../services/sensorLogService");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(getWorkers());
});

router.get("/:id/logs", (req, res) => {
  const worker = getWorkerById(req.params.id);
  if (!worker) return res.status(404).json({ message: "Worker not found" });

  const limit = Number(req.query.limit || 48);
  const logs = readSensorLogs(req.params.id);
  const limitedLogs = Number.isFinite(limit) && limit > 0 ? logs.slice(-limit) : logs;

  return res.json({
    workerId: worker.id,
    helmetId: worker.helmetId,
    intervalMinutes: 15,
    logs: limitedLogs
  });
});

router.get("/:id", (req, res) => {
  const worker = getWorkerById(req.params.id);
  if (!worker) return res.status(404).json({ message: "Worker not found" });
  return res.json(worker);
});

module.exports = router;
