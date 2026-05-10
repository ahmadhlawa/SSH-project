#include <WiFi.h>
#include <HTTPClient.h>

// Replace with your Wi-Fi network name and password.
// Do not commit real credentials to source control.
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Replace SERVER_IP with the laptop/backend local network IP address.
// Example: http://192.168.1.25:5000/api/helmet/readings
const char* SERVER_URL = "http://SERVER_IP:5000/api/helmet/readings";

const char* WORKER_ID = "W-1001";
const char* HELMET_ID = "HLM-ESP32-001";

unsigned long lastPostTime = 0;
const unsigned long POST_INTERVAL_MS = 5000;

void connectToWiFi() {
  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Connected. ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

float readTemperature() {
  // TODO: Replace with DHT11/DHT22 temperature reading.
  return 34.5 + random(-20, 30) / 10.0;
}

float readHumidity() {
  // TODO: Replace with DHT11/DHT22 humidity reading.
  return 48.0 + random(-50, 60) / 10.0;
}

int readGasValue() {
  // TODO: Replace with MQ gas sensor analogRead value.
  return 300 + random(-80, 260);
}

bool readFallDetected() {
  // TODO: Replace with MPU6050 accelerometer/gyroscope fall detection logic.
  return false;
}

bool readSosPressed() {
  // TODO: Replace with digitalRead from SOS push button pin.
  return false;
}

void sendHelmetReading() {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  float temperature = readTemperature();
  float humidity = readHumidity();
  int gasValue = readGasValue();
  bool fallDetected = readFallDetected();
  bool sosPressed = readSosPressed();

  // Fixed demo location until GPS is connected.
  // TODO: Replace with GPS module lat/lng later.
  float lat = 31.9544;
  float lng = 35.9106;

  String payload = "{";
  payload += "\"workerId\":\"" + String(WORKER_ID) + "\",";
  payload += "\"helmetId\":\"" + String(HELMET_ID) + "\",";
  payload += "\"temperature\":" + String(temperature, 1) + ",";
  payload += "\"humidity\":" + String(humidity, 1) + ",";
  payload += "\"gasValue\":" + String(gasValue) + ",";
  payload += "\"fallDetected\":" + String(fallDetected ? "true" : "false") + ",";
  payload += "\"sosPressed\":" + String(sosPressed ? "true" : "false") + ",";
  payload += "\"lat\":" + String(lat, 6) + ",";
  payload += "\"lng\":" + String(lng, 6);
  payload += "}";

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  Serial.println("Sending payload:");
  Serial.println(payload);

  int responseCode = http.POST(payload);
  String responseBody = http.getString();

  Serial.print("Response code: ");
  Serial.println(responseCode);
  Serial.println("Response body:");
  Serial.println(responseBody);

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  randomSeed(analogRead(0));
  connectToWiFi();
}

void loop() {
  if (millis() - lastPostTime >= POST_INTERVAL_MS) {
    lastPostTime = millis();
    sendHelmetReading();
  }
}
