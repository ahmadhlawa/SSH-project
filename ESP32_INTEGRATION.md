# ESP32 Integration Guide

This guide explains how to connect an ESP32 smart helmet to the Smart Safety Helmet backend over Wi-Fi.

## 1. Network Setup

The ESP32 and the laptop running the backend must be connected to the same Wi-Fi network.

The ESP32 cannot use `localhost` to reach your laptop. `localhost` on the ESP32 means the ESP32 itself, not your computer. Use the backend machine local network IP address instead.

## 2. Find the Backend Server IP Address

On Windows PowerShell, run:

```powershell
ipconfig
```

Look for your active Wi-Fi adapter and copy the `IPv4 Address`.

Example:

```text
IPv4 Address . . . . . . . . . . . : 192.168.1.25
```

In this example, the backend URL for the ESP32 is:

```text
http://192.168.1.25:5000/api/helmet/readings
```

## 3. Required Endpoint

The ESP32 should send readings using HTTP POST:

```text
http://SERVER_IP:5000/api/helmet/readings
```

Replace `SERVER_IP` with the laptop IP address on the local network.

## 4. Required JSON Payload

Minimum required field:

```json
{
  "workerId": "W-1001"
}
```

Recommended full payload:

```json
{
  "workerId": "W-1001",
  "helmetId": "HLM-ESP32-001",
  "temperature": 36.8,
  "humidity": 48,
  "gasValue": 420,
  "fallDetected": false,
  "sosPressed": false,
  "acX": 100,
  "acY": 200,
  "acZ": 16000,
  "gyX": 3,
  "gyY": 4,
  "gyZ": 5,
  "lat": 31.7683,
  "lng": 35.2137
}
```

Notes:

- `workerId` must match an existing worker in the backend mock data.
- `temperature`, `humidity`, `gasValue`, `lat`, and `lng` must be numbers.
- `fallDetected` and `sosPressed` must be booleans.
- `acX`, `acY`, `acZ`, `gyX`, `gyY`, and `gyZ` are optional MPU6050 details and are stored in the CSV logs when provided.
- `lat` and `lng` are optional. If GPS is not available yet, omit them or use fixed demo coordinates.
- The current temporary helmet location is Jerusalem until the GPS part is added.
- The backend marks a helmet offline if readings stop for about 10 seconds, and marks it online again on the next reading.
- CSV logs are sampled every 15 minutes while the helmet is sending readings.

## 5. Test With Postman

1. Start the backend.
2. Open Postman.
3. Set method to `POST`.
4. Use URL:

```text
http://SERVER_IP:5000/api/helmet/readings
```

5. Select `Body` -> `raw` -> `JSON`.
6. Send this example:

```json
{
  "workerId": "W-1001",
  "helmetId": "HLM-ESP32-001",
  "temperature": 38.2,
  "humidity": 51,
  "gasValue": 610,
  "fallDetected": false,
  "sosPressed": false
}
```

## 6. Test With curl

PowerShell example:

```powershell
curl.exe -X POST http://SERVER_IP:5000/api/helmet/readings `
  -H "Content-Type: application/json" `
  -d "{\"workerId\":\"W-1001\",\"helmetId\":\"HLM-ESP32-001\",\"temperature\":38.2,\"humidity\":51,\"gasValue\":610,\"fallDetected\":false,\"sosPressed\":false}"
```

Check backend health first:

```powershell
curl.exe http://SERVER_IP:5000/api/health
```

## 7. GPS Notes

Until the GPS module is added:

- Use the fixed Jerusalem `lat` and `lng` values for the active helmet.
- Or omit `lat` and `lng`; the backend will keep the worker's previous location.
- Add GPS readings later using the same `lat` and `lng` JSON fields.

## 8. Helmet Alarm Acknowledge

The helmet can poll this endpoint while the local buzzer is active:

```text
http://SERVER_IP:5000/api/helmet/alarm-state?workerId=W-1001
```

When the supervisor acknowledges the danger alert in the dashboard, the response includes:

```json
{
  "acknowledged": true
}
```

The ESP32 sketch uses that signal to stop the buzzer before the 5 second timeout.

## 9. Troubleshooting

- Make sure the ESP32 and laptop are on the same Wi-Fi network.
- Use the laptop local IP address, not `localhost`.
- Check `http://SERVER_IP:5000/api/health` before sending readings.
- Windows Firewall may block port `5000`; allow Node.js or open the port for local network testing.
- Confirm the backend is running with `npm run dev` inside the `backend` folder.
- Confirm the `workerId` exists in `backend/src/data/mockData.js`.
- If the dashboard does not update, check the browser console and backend terminal logs.
