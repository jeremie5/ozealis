// modules.cpp - implementation
#include "modules.h"
#include "oximetry.h"

#ifndef OZEALIS_MODULE_SERIAL_LOG
#define OZEALIS_MODULE_SERIAL_LOG 0
#endif

#if OZEALIS_MODULE_SERIAL_LOG
#define MODULE_LOG(message) Serial.println(message)
#else
#define MODULE_LOG(message) do { } while (0)
#endif

ModuleStatus humid, hose;
static unsigned long lastScan = 0;
static uint8_t heartbeatFrame = 0;
static uint32_t humidTelemetryMs = 0;
static uint32_t hoseTelemetryMs = 0;
static constexpr uint32_t MODULE_TELEMETRY_FRESH_MS = 1500;
static constexpr float MODULE_MIN_TEMP_C = 0.0f;
static constexpr float MODULE_MAX_TEMP_C = 100.0f;

struct PidState {
  float integral = 0.0f;
  float lastOutput = 0.0f;
  uint32_t lastMs = 0;
  uint8_t lastKind = 0;
};

static PidState humidPid;

// accessory protocol: register 0x00 returns 0xA5 when alive
static bool heartbeat(uint8_t addr) {
  Wire.beginTransmission(addr);
  Wire.write(0x00);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom(addr, (uint8_t)1);
  if (!Wire.available()) return false;
  return Wire.read() == 0xA5;
}

static void powerRail(bool on) {
  digitalWrite(ACC_EN, on ? HIGH : LOW);
}

static float clampFloat(float value, float lo, float hi) {
  if (!isfinite(value)) return lo;
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

static bool validModuleTemperature(float value) {
  return isfinite(value) && value >= MODULE_MIN_TEMP_C && value <= MODULE_MAX_TEMP_C;
}

static bool validRelativeHumidity(float value) {
  return isfinite(value) && value >= 0.0f && value <= 100.0f;
}

bool humidifierTelemetryFresh() {
  return humid.present && humid.ready &&
         humidTelemetryMs != 0 && millis() - humidTelemetryMs <= MODULE_TELEMETRY_FRESH_MS &&
         validModuleTemperature(humid.temp_C) && validRelativeHumidity(humid.rh_percent);
}

bool heatedHoseTelemetryFresh() {
  return hose.present && hose.ready &&
         hoseTelemetryMs != 0 && millis() - hoseTelemetryMs <= MODULE_TELEMETRY_FRESH_MS &&
         validModuleTemperature(hose.temp_C);
}

static void resetHumidifierPid(uint8_t kind = 0) {
  humidPid.integral = 0.0f;
  humidPid.lastOutput = 0.0f;
  humidPid.lastMs = millis();
  humidPid.lastKind = kind;
  humid.drive_percent = 0.0f;
}

static float humidifierPidOutput(const HumidifierControl& control, float measuredRH, float measuredTempC) {
  const uint32_t now = millis();
  if (!control.enabled || control.kind == 0 || !isfinite(measuredRH) ||
      (control.kind == 2 && !isfinite(measuredTempC))) {
    resetHumidifierPid(control.kind);
    return 0.0f;
  }

  if (humidPid.lastKind != control.kind || humidPid.lastMs == 0) {
    resetHumidifierPid(control.kind);
  }

  const float dt = clampFloat((now - humidPid.lastMs) / 1000.0f, 0.1f, 2.0f);
  humidPid.lastMs = now;
  humidPid.lastKind = control.kind;

  const float targetRH = clampFloat(control.targetRH, 30.0f, 90.0f);
  const float maxTempC = clampFloat(control.maxTempC, 30.0f, 60.0f);
  float kp = 1.6f, ki = 0.12f, maxStep = 35.0f;
  if (control.kind == 2) {
    kp = 0.45f;
    ki = 0.015f;
    maxStep = 4.0f;
  }

  float out = 0.0f;
  if (control.prewarm && control.kind == 2) {
    const float headroom = maxTempC - measuredTempC;
    out = headroom <= 0.0f ? 0.0f : clampFloat(headroom * 12.0f, 8.0f, 55.0f);
  } else {
    const float error = targetRH - measuredRH;
    humidPid.integral = clampFloat(humidPid.integral + error * ki * dt, -35.0f, 70.0f);
    out = clampFloat(error * kp + humidPid.integral, 0.0f, 100.0f);
  }

  if (control.kind == 2 && isfinite(measuredTempC)) {
    const float headroom = maxTempC - measuredTempC;
    if (headroom <= 0.0f) out = 0.0f;
    else if (headroom < 5.0f) out = min(out, headroom * 20.0f);
  }

  const float lo = max(0.0f, humidPid.lastOutput - maxStep);
  const float hi = min(100.0f, humidPid.lastOutput + maxStep);
  out = clampFloat(out, lo, hi);
  humidPid.lastOutput = out;
  return out;
}

static void writeHumidifierCommand(const HumidifierControl& control, float outputPercent) {
  const uint16_t targetRh = (uint16_t)(clampFloat(control.targetRH, 30.0f, 90.0f) * 100.0f);
  const uint16_t maxTemp = (uint16_t)(clampFloat(control.maxTempC, 30.0f, 60.0f) * 100.0f);
  const uint16_t output = (uint16_t)(clampFloat(outputPercent, 0.0f, 100.0f) * 100.0f);
  const uint8_t kind = control.enabled ? min((uint8_t)2, control.kind) : 0;

  Wire.beginTransmission(ADDR_HUMIDIFIER);
  Wire.write(0x10);  // target RH centi-percent
  Wire.write((targetRh >> 8) & 0xFF);
  Wire.write(targetRh & 0xFF);
  Wire.write(kind);  // 0x12 humidifier kind
  Wire.write((output >> 8) & 0xFF); // 0x13..0x14 output centi-percent
  Wire.write(output & 0xFF);
  Wire.write((maxTemp >> 8) & 0xFF); // 0x15..0x16 thermal ceiling centi-C
  Wire.write(maxTemp & 0xFF);
  Wire.endTransmission();
}

void initModules() {
  pinMode(ACC_EN, OUTPUT);
  powerRail(false);
  humid = {};
  hose = {};
  humidTelemetryMs = 0;
  hoseTelemetryMs = 0;
  resetHumidifierPid();
}

void pollModules(const HumidifierControl& humidifier, float targetTubeT) {
  static bool wasHumidPresent = false;
  static bool wasHosePresent = false;

  // run every 500 ms
  if (millis() - lastScan < 500) return;
  lastScan = millis();

  // Step 1: ensure rail is on while scanning
  powerRail(true);
  oximetryPollI2c();

  // ---- Humidifier ----
  bool humidNow = heartbeat(ADDR_HUMIDIFIER);
  if (humidNow) {
    if (!wasHumidPresent) MODULE_LOG("[I2C] Humidifier detected.");
    humid.present = true;

    // Accessory telemetry contract: 0x01..0x04 = centi-C then centi-%RH.
    bool telemetryValid = false;
    float nextTempC = NAN;
    float nextRhPercent = NAN;
    Wire.beginTransmission(ADDR_HUMIDIFIER);
    Wire.write(0x01);
    if (Wire.endTransmission(false) == 0 && Wire.requestFrom((uint8_t)ADDR_HUMIDIFIER, (uint8_t)4) == 4) {
      uint16_t tRaw = (Wire.read() << 8) | Wire.read();
      uint16_t hRaw = (Wire.read() << 8) | Wire.read();
      nextTempC = tRaw / 100.0f;
      nextRhPercent = hRaw / 100.0f;
      telemetryValid = validModuleTemperature(nextTempC) && validRelativeHumidity(nextRhPercent);
    }
    humid.ready = telemetryValid;
    if (telemetryValid) {
      humid.temp_C = nextTempC;
      humid.rh_percent = nextRhPercent;
      humidTelemetryMs = millis();
    } else {
      humid.temp_C = NAN;
      humid.rh_percent = NAN;
      humidTelemetryMs = 0;
    }

    HumidifierControl safeControl = humidifier;
    if (!telemetryValid) {
      safeControl.enabled = false;
      safeControl.prewarm = false;
    }
    humid.kind = safeControl.enabled ? safeControl.kind : 0;
    humid.prewarm = safeControl.prewarm && safeControl.kind == 2;
    humid.drive_percent = humidifierPidOutput(safeControl, humid.rh_percent, humid.temp_C);
    writeHumidifierCommand(safeControl, humid.drive_percent);
  } else {
    if (wasHumidPresent) MODULE_LOG("[I2C] Humidifier disconnected.");
    humid = {};
    humidTelemetryMs = 0;
    resetHumidifierPid();
  }
  wasHumidPresent = humidNow;

  // ---- Heated Hose ----
  bool hoseNow = heartbeat(ADDR_HEATEDHOSE);
  if (hoseNow) {
    if (!wasHosePresent) MODULE_LOG("[I2C] Heated hose detected.");
    hose.present = true;

    bool telemetryValid = false;
    float nextTempC = NAN;
    Wire.beginTransmission(ADDR_HEATEDHOSE);
    Wire.write(0x01);
    if (Wire.endTransmission(false) == 0 && Wire.requestFrom((uint8_t)ADDR_HEATEDHOSE, (uint8_t)2) == 2) {
      uint16_t tRaw = (Wire.read() << 8) | Wire.read();
      nextTempC = tRaw / 100.0f;
      telemetryValid = validModuleTemperature(nextTempC);
    }
    hose.ready = telemetryValid;
    if (telemetryValid) {
      hose.temp_C = nextTempC;
      hoseTelemetryMs = millis();
    } else {
      hose.temp_C = NAN;
      hoseTelemetryMs = 0;
    }

    Wire.beginTransmission(ADDR_HEATEDHOSE);
    Wire.write(0x10);
    const float safeTargetDeltaC = telemetryValid ? clampFloat(targetTubeT, 0.0f, 15.0f) : 0.0f;
    Wire.write((uint8_t)safeTargetDeltaC);  // C delta; zero disables heat
    Wire.endTransmission();
  } else {
    if (wasHosePresent) MODULE_LOG("[I2C] Heated hose disconnected.");
    hose = {};
    hoseTelemetryMs = 0;
  }
  wasHosePresent = hoseNow;

  // Cut rail if no response for 2 s
  static uint8_t missCnt = 0;
  if (!humid.present && !hose.present) ++missCnt;
  else missCnt = 0;
  if (missCnt >= 4) {
    MODULE_LOG("[I2C] Powering down accessory rail.");
    powerRail(false);
  }
}
