# Smart Safety Helmet

React + Node.js realtime IoT safety monitoring dashboard for ESP32 smart helmets.

## Overview

The system monitors industrial or warehouse workers wearing smart helmets. Each helmet can send temperature, humidity, gas, fall detection, SOS, and location readings to the backend. Supervisors use the dashboard to watch worker status, view locations on Google Maps, receive realtime alerts, and respond to emergencies.

## Features

- Realtime dashboard for SAFE, WARNING, and DANGER worker states
- Worker cards with temperature, gas, fall status, humidity, and last update
- Google Maps overview and worker detail maps
- Emergency modal with Web Audio alarm
- Alerts page with filters and acknowledgement
- Settings page for demo thresholds and alarm toggle
- Socket.io realtime updates
- Offline worker roster with live readings coming from the ESP32 helmet
- ESP32 HTTP POST endpoint ready for real device integration

## Project Structure

```text
backend/
  src/
    data/
    routes/
    services/
    socket/
esp32/
  smart_helmet_http_post_example.ino
frontend/
  src/
    components/
    context/
    pages/
    services/
    styles/
```

## Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
DEMO_MODE=false
```

Create `frontend/.env` from `frontend/.env.example`:

```env
VITE_GOOGLE_MAPS_API_KEY=your_key_here
VITE_API_URL=http://localhost:5000
```

Do not commit real API keys or credentials. `.env` files are ignored.

## Run Backend

```bash
cd backend
npm run dev
```

Backend runs at:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

## Run Frontend

Open another terminal:

```bash
cd frontend
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

## Demo Mode

The backend now runs with real helmet readings by default. Keep demo mode disabled:

```env
DEMO_MODE=false
```

Only set `DEMO_MODE=true` when you intentionally want the random simulator for testing.

The system receives real helmet readings through `POST /api/helmet/readings`. GPS is optional at this stage: if `lat` and `lng` are omitted, the backend keeps the worker's current temporary Jerusalem location.

Helmet readings are also sampled to `backend/logs.csv` once every 15 minutes per worker. Worker detail pages read those CSV snapshots to render the sensor chart.

## API Endpoints

- `GET /api/health` - backend health and demo mode status
- `GET /api/workers` - list all workers
- `GET /api/workers/:id` - get one worker
- `GET /api/workers/:id/logs` - read that worker's 15-minute sensor snapshots from `backend/logs.csv`
- `GET /api/alerts` - list alerts
- `POST /api/helmet/readings` - receive ESP32 helmet readings
- `GET /api/helmet/alarm-state?workerId=W-1001` - let the helmet check if the latest danger alert was acknowledged
- `POST /api/alerts/:id/acknowledge` - acknowledge an alert

## Socket.io Events

Frontend listens for:

- `workers:init`
- `worker:update`
- `alert:new`
- `alert:update`

The UI also shows backend connected/disconnected status and the last realtime update timestamp.

## Test ESP32 POST Manually

Use the backend machine local IP if testing from another device. From the same laptop, `localhost` is fine.

PowerShell curl example:

```powershell
curl.exe -X POST http://localhost:5000/api/helmet/readings `
  -H "Content-Type: application/json" `
  -d "{\"workerId\":\"W-1001\",\"helmetId\":\"HLM-ESP32-001\",\"temperature\":38.2,\"humidity\":51,\"gasValue\":610,\"fallDetected\":false,\"sosPressed\":false}"
```

Example JSON payload:

```json
{
  "workerId": "W-1001",
  "helmetId": "HLM-ESP32-001",
  "temperature": 38.2,
  "humidity": 51,
  "gasValue": 610,
  "fallDetected": false,
  "sosPressed": false,
  "lat": 31.7683,
  "lng": 35.2137
}
```

`lat` and `lng` are optional. If not provided, the backend keeps the worker's previous location.

More ESP32 details are in:

```text
ESP32_INTEGRATION.md
```

Arduino example:

```text
esp32/smart_helmet_http_post_example.ino
```

## Prepare for Presentation

1. Add the Google Maps key to `frontend/.env`.
2. Keep `DEMO_MODE=false` so the dashboard depends on the real ESP32 helmet.
3. Start backend first, then frontend.
4. Open the dashboard and confirm the connection indicator is green.
5. Open the map page and verify the active helmet appears in Jerusalem.
6. Trigger a real gas or temperature danger reading from the helmet to demonstrate realtime emergency behavior.
7. Use Settings to show alarm toggle and thresholds.

## Future ESP32 Integration

1. Flash each ESP32 with the assigned `workerId` and `helmetId`.
2. Connect ESP32 to the same Wi-Fi as the backend laptop.
3. Send readings to `POST /api/helmet/readings`.
4. Add DHT11/DHT22, MQ gas sensor, MPU6050, SOS button, and GPS readings.
5. Disable demo mode when real devices are stable.
6. Replace mock data with a database for production.
