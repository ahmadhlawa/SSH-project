const fs = require("fs");
const path = require("path");

const LOG_INTERVAL_MS = 15 * 60 * 1000;
const LOG_FILE_PATH = path.resolve(__dirname, "../../logs.csv");
const CSV_HEADER = [
  "timestamp",
  "workerId",
  "workerName",
  "helmetId",
  "status",
  "temperature",
  "humidity",
  "gasValue",
  "fallDetected",
  "sosPressed",
  "acX",
  "acY",
  "acZ",
  "gyX",
  "gyY",
  "gyZ",
  "lat",
  "lng",
  "alertType",
  "severity"
];

function ensureLogFile() {
  if (!fs.existsSync(LOG_FILE_PATH)) {
    fs.writeFileSync(LOG_FILE_PATH, `${CSV_HEADER.join(",")}\n`, "utf8");
  }
}

function escapeCsv(value) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function rowToLog(row) {
  const optionalNumber = (value) => (value === "" || value === undefined ? null : Number(value));

  return {
    timestamp: row.timestamp,
    workerId: row.workerId,
    workerName: row.workerName,
    helmetId: row.helmetId,
    status: row.status,
    temperature: Number(row.temperature),
    humidity: Number(row.humidity),
    gasValue: Number(row.gasValue),
    fallDetected: row.fallDetected === "true",
    sosPressed: row.sosPressed === "true",
    acX: optionalNumber(row.acX),
    acY: optionalNumber(row.acY),
    acZ: optionalNumber(row.acZ),
    gyX: optionalNumber(row.gyX),
    gyY: optionalNumber(row.gyY),
    gyZ: optionalNumber(row.gyZ),
    lat: Number(row.lat),
    lng: Number(row.lng),
    alertType: row.alertType || null,
    severity: row.severity || null
  };
}

function readSensorLogs(workerId) {
  ensureLogFile();

  const content = fs.readFileSync(LOG_FILE_PATH, "utf8").trim();
  if (!content) return [];

  const [headerLine, ...lines] = content.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);

  return lines
    .filter(Boolean)
    .map((line) => {
      const values = parseCsvLine(line);
      return headers.reduce((row, header, index) => {
        row[header] = values[index] ?? "";
        return row;
      }, {});
    })
    .filter((row) => !workerId || row.workerId === workerId)
    .map(rowToLog)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function getLatestWorkerLog(workerId) {
  const logs = readSensorLogs(workerId);
  return logs[logs.length - 1] || null;
}

function appendSensorLog(worker) {
  ensureLogFile();

  const values = CSV_HEADER.map((key) => escapeCsv(worker[key]));
  fs.appendFileSync(LOG_FILE_PATH, `${values.join(",")}\n`, "utf8");
}

function maybeLogWorkerReading(worker) {
  const latestLog = getLatestWorkerLog(worker.id);
  const now = Date.now();

  if (latestLog) {
    const latestLogAt = new Date(latestLog.timestamp).getTime();
    if (Number.isFinite(latestLogAt) && now - latestLogAt < LOG_INTERVAL_MS) return false;
  }

  appendSensorLog({
    timestamp: new Date(now).toISOString(),
    workerId: worker.id,
    workerName: worker.name,
    helmetId: worker.helmetId,
    status: worker.status,
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
    lat: worker.lat,
    lng: worker.lng,
    alertType: worker.alertType,
    severity: worker.severity
  });

  return true;
}

module.exports = {
  LOG_FILE_PATH,
  readSensorLogs,
  maybeLogWorkerReading
};
