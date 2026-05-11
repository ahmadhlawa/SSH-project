const DAY_MS = 24 * 60 * 60 * 1000;

function at(daysAgo, hour, minute = 0) {
  const date = new Date(Date.now() - daysAgo * DAY_MS);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function getMockAnalyticsEvents() {
  return [
    ["W-1002", "Lina Nasser", "HLM-ESP32-002", "Packaging", "Temperature", "High", at(0, 13, 42), 40.8, 56, 720, true, 38],
    ["W-1004", "Maya Khalil", "HLM-ESP32-004", "Maintenance", "Gas", "Critical", at(1, 10, 18), 35.7, 43, 1910, true, 68],
    ["W-1003", "Yousef Saleh", "HLM-ESP32-003", "Storage", "Gas", "High", at(1, 15, 8), 33.6, 62, 1610, true, 51],
    ["W-1005", "Kareem Mansour", "HLM-ESP32-005", "Forklift Area", "Fall", "High", at(2, 9, 35), 32.8, 49, 430, true, 45],
    ["W-1007", "Adam Barakat", "HLM-ESP32-007", "Loading", "Fall", "Warning", at(3, 16, 22), 34.2, 46, 510, true, 30],
    ["W-1002", "Lina Nasser", "HLM-ESP32-002", "Packaging", "Temperature", "Warning", at(4, 14, 5), 38.9, 59, 690, true, 41],
    ["W-1003", "Yousef Saleh", "HLM-ESP32-003", "Storage", "Gas", "Critical", at(5, 11, 48), 32.9, 65, 1845, true, 74],
    ["W-1008", "Sara Qasem", "HLM-ESP32-008", "Assembly", "Temperature", "Warning", at(6, 13, 12), 38.1, 51, 390, true, 34],
    ["W-1006", "Rana Awad", "HLM-ESP32-006", "Main Warehouse", "Temperature", "High", at(8, 12, 40), 41.1, 55, 610, true, 44],
    ["W-1007", "Adam Barakat", "HLM-ESP32-007", "Loading", "Fall", "High", at(9, 8, 58), 30.9, 48, 455, true, 63],
    ["W-1004", "Maya Khalil", "HLM-ESP32-004", "Maintenance", "Gas", "Critical", at(13, 17, 15), 36.2, 45, 2035, false, 92],
    ["W-1001", "ismail aljabri", "HLM-ESP32-001", "Jerusalem", "Gas", "Warning", at(26, 14, 33), 35.4, 46, 1325, true, 29]
  ].map(([workerId, workerName, helmetId, zone, alertType, severity, timestamp, temperature, humidity, gasValue, acknowledged, responseTimeSeconds]) => ({
    workerId,
    workerName,
    helmetId,
    zone,
    alertType,
    severity,
    timestamp,
    temperature,
    humidity,
    gasValue,
    durationMinutes: severity === "Critical" ? 12 : 7,
    acknowledged,
    responseTimeSeconds
  }));
}
