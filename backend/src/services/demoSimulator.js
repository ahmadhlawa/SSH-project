const { getWorkers, updateWorkerReading } = require("./safetyService");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function jitter(value, amount, min, max, precision = 1) {
  return Number(clamp(value + (Math.random() * amount * 2 - amount), min, max).toFixed(precision));
}

function startDemoSimulator() {
  setInterval(() => {
    const workers = getWorkers();
    const worker = workers[Math.floor(Math.random() * workers.length)];
    const shouldSpike = Math.random() > 0.84;

    updateWorkerReading(worker.id, {
      temperature: shouldSpike ? jitter(worker.temperature + 4, 2.5, 24, 46) : jitter(worker.temperature, 1.3, 24, 43),
      humidity: Math.round(clamp(worker.humidity + (Math.random() * 8 - 4), 32, 72)),
      gasValue: shouldSpike ? Math.round(clamp(worker.gasValue + 150, 120, 900)) : Math.round(clamp(worker.gasValue + (Math.random() * 90 - 45), 120, 850)),
      fallDetected: Math.random() > 0.985,
      sosPressed: false,
      lat: jitter(worker.lat, 0.00035, 31.951, 31.958, 6),
      lng: jitter(worker.lng, 0.00035, 35.907, 35.914, 6)
    });
  }, 4500);
}

module.exports = { startDemoSimulator };
