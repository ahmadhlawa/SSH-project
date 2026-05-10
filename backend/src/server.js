require("dotenv").config();

const cors = require("cors");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const workerRoutes = require("./routes/workers");
const alertRoutes = require("./routes/alerts");
const helmetRoutes = require("./routes/helmet");
const { initializeSocket } = require("./socket");
const { startDemoSimulator } = require("./services/demoSimulator");
const { startHelmetPresenceMonitor } = require("./services/safetyService");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: clientUrl,
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: clientUrl }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "smart-safety-helmet-api",
    demoMode: process.env.DEMO_MODE === "true"
  });
});

app.use("/api/workers", workerRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/helmet", helmetRoutes);

initializeSocket(io);
startHelmetPresenceMonitor();

server.listen(port, () => {
  console.log(`Smart Safety Helmet API running on http://localhost:${port}`);
  if (process.env.DEMO_MODE === "true") {
    startDemoSimulator();
    console.log("Demo simulator enabled");
  }
});
