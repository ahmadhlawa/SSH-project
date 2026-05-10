const { getWorkers, getAlerts, setIo } = require("../services/safetyService");

function initializeSocket(io) {
  setIo(io);

  io.on("connection", (socket) => {
    socket.emit("workers:init", {
      workers: getWorkers(),
      alerts: getAlerts()
    });
  });
}

module.exports = { initializeSocket };
