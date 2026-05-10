const express = require("express");
const { getAlerts, acknowledgeAlert } = require("../services/safetyService");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(getAlerts());
});

router.post("/:id/acknowledge", (req, res) => {
  const alert = acknowledgeAlert(req.params.id);
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  return res.json(alert);
});

module.exports = router;
