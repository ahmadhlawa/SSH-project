#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <math.h>

#define MPU6050_ADDR 0x68

// ================= Wi-Fi Settings =================
const char* WIFI_SSID = "Home";
const char* WIFI_PASSWORD = "QASSAM2002";

// Backend endpoints. Use the laptop IP address, not localhost.
const char* READINGS_URL = "http://192.168.1.3:5000/api/helmet/readings";
const char* ALARM_STATE_URL = "http://192.168.1.3:5000/api/helmet/alarm-state";

// Dashboard worker mapping
const char* WORKER_ID = "W-1001";
const char* HELMET_ID = "HLM-ESP32-001";

// ================= Sensor Pins =================
#define DHTPIN 14
#define DHTTYPE DHT11

#define GAS_PIN 34
#define BUZZER_PIN 25

#define LED1 26
#define LED2 27
#define LED3 32
#define LED4 33

#define MPU_SDA 22
#define MPU_SCL 21

DHT dht(DHTPIN, DHTTYPE);

int16_t AcX, AcY, AcZ;
int16_t GyX, GyY, GyZ;

// ================= Timing =================
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 3000;

const unsigned long LED_FLASH_INTERVAL = 180;
const unsigned long BUZZER_PULSE_INTERVAL = 220;
const unsigned long ALARM_CYCLE_DURATION_MS = 5000;
const unsigned long ALARM_REPEAT_INTERVAL_MS = 7000;
const unsigned long ALARM_STATE_POLL_INTERVAL_MS = 2000;
const unsigned long FALL_CONFIRMATION_DELAY_MS = 1200;

unsigned long lastLedFlashTime = 0;
unsigned long lastBuzzerPulseTime = 0;
unsigned long alarmCycleStartedAt = 0;
unsigned long lastAlarmCycleEndedAt = 0;
unsigned long lastAlarmStatePollTime = 0;

bool ledsOn = false;
bool buzzerOn = false;
bool alarmCycleRunning = false;
bool backendAlarmActive = false;
bool backendAlarmAcknowledged = false;
bool previousDangerAlert = false;

// ================= Thresholds =================
const int GAS_DANGER_THRESHOLD = 1800;
const float TEMP_DANGER_THRESHOLD = 40.0;

const float IMPACT_G_THRESHOLD = 2.5;
const float STABLE_MIN_G = 0.7;
const float STABLE_MAX_G = 1.3;
const float GYRO_ROTATION_THRESHOLD = 30000;

// ================= Output Helpers =================
void setAllLeds(bool active) {
  digitalWrite(LED1, active ? HIGH : LOW);
  digitalWrite(LED2, active ? HIGH : LOW);
  digitalWrite(LED3, active ? HIGH : LOW);
  digitalWrite(LED4, active ? HIGH : LOW);
  ledsOn = active;
}

void setBuzzer(bool active) {
  digitalWrite(BUZZER_PIN, active ? HIGH : LOW);
  buzzerOn = active;
}

void playStartupTones() {
  for (int i = 0; i < 3; i++) {
    setBuzzer(true);
    delay(120);
    setBuzzer(false);
    delay(110);
  }
}

// ================= Wi-Fi Connection =================
void connectToWiFi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected successfully!");
    Serial.print("ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection failed!");
  }
}

// ================= MPU6050 Read =================
void readMPU6050() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)MPU6050_ADDR, (size_t)14, true);

  if (Wire.available() == 14) {
    AcX = Wire.read() << 8 | Wire.read();
    AcY = Wire.read() << 8 | Wire.read();
    AcZ = Wire.read() << 8 | Wire.read();

    Wire.read();
    Wire.read();

    GyX = Wire.read() << 8 | Wire.read();
    GyY = Wire.read() << 8 | Wire.read();
    GyZ = Wire.read() << 8 | Wire.read();
  }
}

float calculateTotalG() {
  float axG = AcX / 16384.0;
  float ayG = AcY / 16384.0;
  float azG = AcZ / 16384.0;

  return sqrt((axG * axG) + (ayG * ayG) + (azG * azG));
}

float calculateGyroMagnitude() {
  float gx = GyX;
  float gy = GyY;
  float gz = GyZ;

  return sqrt((gx * gx) + (gy * gy) + (gz * gz));
}

void printMPUCalibrationValues() {
  float axG = AcX / 16384.0;
  float ayG = AcY / 16384.0;
  float azG = AcZ / 16384.0;
  float totalG = calculateTotalG();
  float gyroMagnitude = calculateGyroMagnitude();

  Serial.print("axG: ");
  Serial.print(axG, 3);
  Serial.print(" ayG: ");
  Serial.print(ayG, 3);
  Serial.print(" azG: ");
  Serial.print(azG, 3);
  Serial.print(" totalG: ");
  Serial.print(totalG, 3);
  Serial.print(" gyroMagnitude: ");
  Serial.println(gyroMagnitude, 1);
}

bool detectFall() {
  float totalG = calculateTotalG();
  float gyroMagnitude = calculateGyroMagnitude();
  bool possibleImpact = totalG > IMPACT_G_THRESHOLD;
  bool abnormalRotation = gyroMagnitude > GYRO_ROTATION_THRESHOLD;

  printMPUCalibrationValues();

  if (!possibleImpact && !abnormalRotation) {
    return false;
  }

  Serial.println("Possible fall/impact detected");
  delay(FALL_CONFIRMATION_DELAY_MS);

  readMPU6050();
  printMPUCalibrationValues();

  float confirmedTotalG = calculateTotalG();
  bool stableAfterImpact = confirmedTotalG >= STABLE_MIN_G && confirmedTotalG <= STABLE_MAX_G;

  if (stableAfterImpact) {
    Serial.println("Fall confirmed");
    return true;
  }

  Serial.println("Impact ignored");
  return false;
}

// ================= Local Alert =================
void updateAlarmOutputs() {
  unsigned long now = millis();

  if (now - lastLedFlashTime >= LED_FLASH_INTERVAL) {
    lastLedFlashTime = now;
    setAllLeds(!ledsOn);
  }

  if (now - lastBuzzerPulseTime >= BUZZER_PULSE_INTERVAL) {
    lastBuzzerPulseTime = now;
    setBuzzer(!buzzerOn);
  }
}

void updateBackendAlarmStateFromBody(String responseBody) {
  backendAlarmActive = responseBody.indexOf("\"alarmActive\":true") >= 0;
  backendAlarmAcknowledged = responseBody.indexOf("\"acknowledged\":true") >= 0;
}

void pollBackendAlarmState() {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  HTTPClient http;
  String url = String(ALARM_STATE_URL) + "?workerId=" + String(WORKER_ID);
  http.begin(url);

  int responseCode = http.GET();
  String responseBody = http.getString();
  http.end();

  Serial.print("Alarm state response: ");
  Serial.print(responseCode);
  Serial.print(" ");
  Serial.println(responseBody);

  bool requestOk = responseCode >= 200 && responseCode < 300;
  if (requestOk) updateBackendAlarmStateFromBody(responseBody);
}

void startAlarmCycle() {
  unsigned long now = millis();
  alarmCycleRunning = true;
  alarmCycleStartedAt = now;
  lastBuzzerPulseTime = now;
  lastLedFlashTime = now;
  setBuzzer(true);
  setAllLeds(true);
  Serial.println("Danger alarm cycle started.");
}

void stopAlarmCycle(bool resetRepeatTimer) {
  if (alarmCycleRunning) {
    Serial.println("Danger alarm cycle stopped.");
  }
  alarmCycleRunning = false;
  setBuzzer(false);
  setAllLeds(false);
  if (resetRepeatTimer) lastAlarmCycleEndedAt = millis();
}

void updateBuzzerAlarm(bool dangerActive) {
  unsigned long now = millis();
  bool backendAllowsAlarm = backendAlarmActive && !backendAlarmAcknowledged;
  bool shouldAlarm = dangerActive && backendAllowsAlarm;

  if (backendAlarmAcknowledged || !shouldAlarm) {
    stopAlarmCycle(false);
    return;
  }

  if (!alarmCycleRunning) {
    if (lastAlarmCycleEndedAt == 0 || now - lastAlarmCycleEndedAt >= ALARM_REPEAT_INTERVAL_MS) {
      startAlarmCycle();
    }
    return;
  }

  if (now - alarmCycleStartedAt >= ALARM_CYCLE_DURATION_MS) {
    stopAlarmCycle(true);
    return;
  }

  updateAlarmOutputs();
}

// ================= Send Reading to Backend =================
void sendReadingToBackend(
  float temperature,
  float humidity,
  int gasValue,
  bool fallDetected,
  bool sosPressed
) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected. Reconnecting...");
    connectToWiFi();
    return;
  }

  HTTPClient http;

  http.begin(READINGS_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"workerId\":\"" + String(WORKER_ID) + "\",";
  payload += "\"helmetId\":\"" + String(HELMET_ID) + "\",";

  if (!isnan(temperature)) {
    payload += "\"temperature\":" + String(temperature, 1) + ",";
  }

  if (!isnan(humidity)) {
    payload += "\"humidity\":" + String(humidity, 1) + ",";
  }

  payload += "\"gasValue\":" + String(gasValue) + ",";
  payload += "\"fallDetected\":" + String(fallDetected ? "true" : "false") + ",";
  payload += "\"sosPressed\":" + String(sosPressed ? "true" : "false") + ",";
  payload += "\"acX\":" + String(AcX) + ",";
  payload += "\"acY\":" + String(AcY) + ",";
  payload += "\"acZ\":" + String(AcZ) + ",";
  payload += "\"gyX\":" + String(GyX) + ",";
  payload += "\"gyY\":" + String(GyY) + ",";
  payload += "\"gyZ\":" + String(GyZ);
  payload += "}";

  Serial.println("Sending payload to backend:");
  Serial.println(payload);

  int httpResponseCode = http.POST(payload);

  Serial.print("HTTP Response Code: ");
  Serial.println(httpResponseCode);

  String response = http.getString();
  Serial.println("Backend Response:");
  Serial.println(response);
  if (httpResponseCode >= 200 && httpResponseCode < 300) {
    updateBackendAlarmStateFromBody(response);
  }

  http.end();
}

// ================= Setup =================
void setup() {
  Serial.begin(115200);

  dht.begin();

  pinMode(GAS_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);
  pinMode(LED3, OUTPUT);
  pinMode(LED4, OUTPUT);

  setAllLeds(false);
  setBuzzer(false);
  playStartupTones();

  Wire.begin(MPU_SDA, MPU_SCL);

  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  connectToWiFi();

  Serial.println("Smart Safety Helmet Started");
}

// ================= Main Loop =================
void loop() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  int gasValue = analogRead(GAS_PIN);

  readMPU6050();

  bool fallDetected = detectFall();
  bool sosPressed = false;

  bool gasAlert = gasValue >= GAS_DANGER_THRESHOLD;
  bool tempAlert = !isnan(temperature) && temperature >= TEMP_DANGER_THRESHOLD;
  bool dangerAlert = gasAlert || tempAlert || fallDetected || sosPressed;

  Serial.println("-------------");

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT ERROR");
  } else {
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" C");

    Serial.print("Humidity: ");
    Serial.print(humidity);
    Serial.println(" %");
  }

  Serial.print("Gas Value: ");
  Serial.println(gasValue);

  Serial.print("AX: ");
  Serial.print(AcX);
  Serial.print(" AY: ");
  Serial.print(AcY);
  Serial.print(" AZ: ");
  Serial.println(AcZ);

  Serial.print("GX: ");
  Serial.print(GyX);
  Serial.print(" GY: ");
  Serial.print(GyY);
  Serial.print(" GZ: ");
  Serial.println(GyZ);

  Serial.print("Fall Detected: ");
  Serial.println(fallDetected ? "YES" : "NO");

  if (dangerAlert && !previousDangerAlert) {
    sendReadingToBackend(temperature, humidity, gasValue, fallDetected, sosPressed);
    lastSendTime = millis();
  }

  if (millis() - lastAlarmStatePollTime >= ALARM_STATE_POLL_INTERVAL_MS) {
    lastAlarmStatePollTime = millis();
    pollBackendAlarmState();
  }

  updateBuzzerAlarm(dangerAlert);

  if (millis() - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = millis();
    sendReadingToBackend(temperature, humidity, gasValue, fallDetected, sosPressed);
  }

  previousDangerAlert = dangerAlert;
}
