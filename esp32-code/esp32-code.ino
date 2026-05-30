#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <math.h>
#include <TinyGPSPlus.h>

#define MPU6050_ADDR 0x68

// ================= Wi-Fi Settings =================
const char* WIFI_SSID = "Ismail";
const char* WIFI_PASSWORD = "ismail2025";

// Backend endpoints. Use the laptop IP address, not localhost.
const char* READINGS_URL = "https://ssh-project-1.onrender.com/api/helmet/readings";
const char* ALARM_STATE_URL = "https://ssh-project-1.onrender.com/api/helmet/alarm-state";

// Dashboard worker mapping
const char* WORKER_ID = "W-1001";
const char* HELMET_ID = "HLM-ESP32-001";

// ================= Sensor Pins =================
#define DHTPIN 14
#define DHTTYPE DHT11

#define GAS_PIN 34
#define BUZZER_PIN 25
#define BUZZER_ACTIVE_LOW false

#define LED1 26
#define LED2 27
#define LED3 32
#define LED4 33

#define MPU_SDA 21
#define MPU_SCL 22

#define GPS_RX 16
#define GPS_TX 17

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

double gpsLat = 0.0;
double gpsLng = 0.0;
bool gpsValid = false;

DHT dht(DHTPIN, DHTTYPE);

int16_t AcX = 0;
int16_t AcY = 0;
int16_t AcZ = 0;
int16_t GyX = 0;
int16_t GyY = 0;
int16_t GyZ = 0;

float latestAccelG = 0.0;
float latestGyroDPS = 0.0;
bool latestHelmetTilted = false;
bool mpuReady = false;

// ================= Timing =================
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 5000;

const unsigned long LED_FLASH_INTERVAL = 180;
const unsigned long BUZZER_PULSE_INTERVAL = 220;
const unsigned long ALARM_CYCLE_DURATION_MS = 5000;
const unsigned long ALARM_REPEAT_INTERVAL_MS = 7000;
const unsigned long ALARM_STATE_POLL_INTERVAL_MS = 2000;

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

// ================= Alert Thresholds =================
const int GAS_DANGER_THRESHOLD = 1800;
const float TEMP_DANGER_THRESHOLD = 40.0;

// ================= Tested Fall Detection Thresholds =================
const float IMPACT_THRESHOLD_G = 1.55;
const float HARD_IMPACT_THRESHOLD_G = 2.70;
const float ROTATION_THRESHOLD_DPS = 230.0;
const float MIN_ACCEL_WITH_ROTATION_G = 1.25;
const float TILT_Z_THRESHOLD = 0.45;
const unsigned long FALL_CONFIRMATION_DELAY_MS = 650;
const unsigned long FALL_DETECTION_COOLDOWN_MS = 3000;

bool fallLatched = false;
unsigned long lastFallDetectionTime = 0;

// ================= Output Helpers =================
void setAllLeds(bool active) {
  digitalWrite(LED1, active ? HIGH : LOW);
  digitalWrite(LED2, active ? HIGH : LOW);
  digitalWrite(LED3, active ? HIGH : LOW);
  digitalWrite(LED4, active ? HIGH : LOW);
  ledsOn = active;
}

void setBuzzer(bool active) {
  if (BUZZER_ACTIVE_LOW) {
    digitalWrite(BUZZER_PIN, active ? LOW : HIGH);
  } else {
    digitalWrite(BUZZER_PIN, active ? HIGH : LOW);
  }
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

// ================= MPU6050 Helpers =================
void wakeMPU6050() {
  Serial.println("Initializing MPU6050...");
  Serial.print("MPU6050 address: 0x");
  Serial.println(MPU6050_ADDR, HEX);
  Serial.print("I2C SDA: GPIO");
  Serial.print(MPU_SDA);
  Serial.print(" SCL: GPIO");
  Serial.println(MPU_SCL);

  Wire.beginTransmission(MPU6050_ADDR);
  byte status = Wire.endTransmission();

  if (status != 0) {
    mpuReady = false;
    Serial.print("MPU6050 not found. I2C status: ");
    Serial.println(status);
    Serial.println("Continuing without infinite buzzer loop.");
    return;
  }

  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x6B);
  Wire.write(0x00);
  byte wakeStatus = Wire.endTransmission(true);

  mpuReady = wakeStatus == 0;
  if (mpuReady) {
    Serial.println("MPU6050 detected and awake.");
  } else {
    Serial.print("MPU6050 wake failed. I2C status: ");
    Serial.println(wakeStatus);
  }
}

void readMPU6050() {
  if (!mpuReady) return;

  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B);
  byte status = Wire.endTransmission(false);

  if (status != 0) {
    Serial.print("MPU6050 read request failed. I2C status: ");
    Serial.println(status);
    return;
  }

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
  } else {
    Serial.println("MPU6050 returned incomplete data.");
  }
}

float getAxG() {
  return AcX / 16384.0;
}

float getAyG() {
  return AcY / 16384.0;
}

float getAzG() {
  return AcZ / 16384.0;
}

float getAccelMagnitudeG() {
  float axG = getAxG();
  float ayG = getAyG();
  float azG = getAzG();
  return sqrt((axG * axG) + (ayG * ayG) + (azG * azG));
}

float getGyroMagnitudeDPS() {
  float gxDPS = GyX / 131.0;
  float gyDPS = GyY / 131.0;
  float gzDPS = GyZ / 131.0;
  return sqrt((gxDPS * gxDPS) + (gyDPS * gyDPS) + (gzDPS * gzDPS));
}

bool isHelmetSeriouslyTilted() {
  return fabs(getAzG()) < TILT_Z_THRESHOLD;
}

void updateMPUDiagnostics() {
  latestAccelG = getAccelMagnitudeG();
  latestGyroDPS = getGyroMagnitudeDPS();
  latestHelmetTilted = isHelmetSeriouslyTilted();
}

void printMPUValues() {
  Serial.print("axG: ");
  Serial.print(getAxG(), 3);
  Serial.print(" ayG: ");
  Serial.print(getAyG(), 3);
  Serial.print(" azG: ");
  Serial.print(getAzG(), 3);
  Serial.print(" accelG: ");
  Serial.print(latestAccelG, 3);
  Serial.print(" gyroDPS: ");
  Serial.print(latestGyroDPS, 1);
  Serial.print(" tilted: ");
  Serial.println(latestHelmetTilted ? "YES" : "NO");
}

void latchFall() {
  fallLatched = true;
  lastFallDetectionTime = millis();
}

bool detectFall() {
  if (!mpuReady) return false;

  updateMPUDiagnostics();
  printMPUValues();

  if (fallLatched) {
    return true;
  }

  unsigned long now = millis();
  if (now - lastFallDetectionTime < FALL_DETECTION_COOLDOWN_MS) {
    return false;
  }

  bool hardImpact = latestAccelG >= HARD_IMPACT_THRESHOLD_G;
  bool impact = latestAccelG >= IMPACT_THRESHOLD_G;
  bool rotationWithImpact = latestGyroDPS >= ROTATION_THRESHOLD_DPS && latestAccelG >= MIN_ACCEL_WITH_ROTATION_G;

  if (!hardImpact && !impact && !rotationWithImpact) {
    return false;
  }

  Serial.println("Possible fall/impact detected");
  lastFallDetectionTime = now;

  if (hardImpact) {
    Serial.println(">>> HARD IMPACT FALL CONFIRMED <<<");
    latchFall();
    return true;
  }

  delay(FALL_CONFIRMATION_DELAY_MS);

  readMPU6050();
  updateMPUDiagnostics();
  printMPUValues();

  if (latestHelmetTilted) {
    Serial.println(">>> FALL CONFIRMED <<<");
    latchFall();
    return true;
  }

  Serial.println("Fall ignored: impact happened but helmet did not stay in fall position.");
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

  if (backendAlarmAcknowledged && fallLatched) {
    fallLatched = false;
    Serial.println("Fall latch cleared after dashboard acknowledge.");
  }
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

String getAlertType(bool gasAlert, bool tempAlert, bool fallAlert) {
  if (fallAlert) return "fall";
  if (gasAlert) return "gas";
  if (tempAlert) return "temperature";
  return "none";
}

// ================= Send Reading to Backend =================
void sendReadingToBackend(
  float temperature,
  float humidity,
  int gasValue,
  bool fallDetected,
  bool sosPressed,
  bool gasAlert,
  bool tempAlert,
  bool fallAlert
) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected. Reconnecting...");
    connectToWiFi();
    return;
  }

  bool alert = gasAlert || tempAlert || fallAlert || sosPressed;
  String alertType = getAlertType(gasAlert, tempAlert, fallAlert);

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
  payload += "\"fall\":" + String(fallDetected ? "true" : "false") + ",";
  payload += "\"fallAlert\":" + String(fallAlert ? "true" : "false") + ",";
  payload += "\"sosPressed\":" + String(sosPressed ? "true" : "false") + ",";
  payload += "\"alert\":" + String(alert ? "true" : "false") + ",";
  payload += "\"alertType\":\"" + alertType + "\",";
  payload += "\"accelG\":" + String(latestAccelG, 3) + ",";
  payload += "\"gyroDPS\":" + String(latestGyroDPS, 1) + ",";
  payload += "\"gpsValid\":" + String(gpsValid ? "true":"false") + ",";
  payload += "\"latitude\":" + String(gpsLat,6) + ",";
  payload += "\"longitude\":" + String(gpsLng,6) + ",";
  payload += "\"helmetTilted\":" + String(latestHelmetTilted ? "true" : "false") + ",";
  payload += "\"timestamp\":" + String(millis()) + ",";
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

//================== gps ===================

void readGPS() {

  while (gpsSerial.available() > 0) {

    gps.encode(gpsSerial.read());

  }

  if (gps.location.isUpdated()) {

    gpsLat = gps.location.lat();
    gpsLng = gps.location.lng();
    gpsValid = gps.location.isValid();

    Serial.println("GPS Updated");

    Serial.print("Lat: ");
    Serial.println(gpsLat,6);

    Serial.print("Lng: ");
    Serial.println(gpsLng,6);

  }
}

// ================= Setup =================
void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  delay(300);

  Serial.println();
  Serial.println("Smart Safety Helmet Starting...");

  dht.begin();
  Serial.println("DHT11 initialized on GPIO14.");

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
  Wire.setClock(100000);
  wakeMPU6050();

  connectToWiFi();

  Serial.println("Smart Safety Helmet Started");
}

// ================= Main Loop =================
void loop() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  int gasValue = analogRead(GAS_PIN);
  readGPS();

  readMPU6050();

  bool fallAlert = detectFall();
  bool sosPressed = false;

  bool gasAlert = gasValue >= GAS_DANGER_THRESHOLD;
  bool tempAlert = !isnan(temperature) && temperature >= TEMP_DANGER_THRESHOLD;
  bool dangerAlert = gasAlert || tempAlert || fallAlert;

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

  Serial.print("Gas Alert: ");
  Serial.println(gasAlert ? "YES" : "NO");
  Serial.print("Temperature Alert: ");
  Serial.println(tempAlert ? "YES" : "NO");
  Serial.print("Fall Alert: ");
  Serial.println(fallAlert ? "YES" : "NO");

  if (dangerAlert && !previousDangerAlert) {
    sendReadingToBackend(temperature, humidity, gasValue, fallAlert, sosPressed, gasAlert, tempAlert, fallAlert);
    lastSendTime = millis();
  }

  if (millis() - lastAlarmStatePollTime >= ALARM_STATE_POLL_INTERVAL_MS) {
    lastAlarmStatePollTime = millis();
    pollBackendAlarmState();
  }

  updateBuzzerAlarm(dangerAlert);

  if (millis() - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = millis();
    sendReadingToBackend(temperature, humidity, gasValue, fallAlert, sosPressed, gasAlert, tempAlert, fallAlert);
  }

  previousDangerAlert = dangerAlert;
}
