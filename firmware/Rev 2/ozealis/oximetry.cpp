// oximetry.cpp - optional wired and BLE-relayed pulse oximetry samples
#include "oximetry.h"
#include <Wire.h>
#include <math.h>

static OximetrySample g_sample;
static uint32_t g_lastI2cPollMs = 0;
static constexpr uint32_t OX_I2C_POLL_MS = 1000;
static constexpr uint32_t OX_STALE_MS = 10000;

static bool validSpo2(float value) {
  return isfinite(value) && value >= 50.0f && value <= 100.0f;
}

static bool validPulse(float value) {
  return isfinite(value) && value >= 20.0f && value <= 250.0f;
}

static bool heartbeat() {
  Wire.beginTransmission(ADDR_OXIMETER);
  Wire.write(0x00);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((uint8_t)ADDR_OXIMETER, (uint8_t)1) != 1) return false;
  return Wire.available() && Wire.read() == 0xA5;
}

static void setSample(float spo2Percent, float pulseBpm, uint8_t quality, OximetrySource source) {
  if (!validSpo2(spo2Percent) || !validPulse(pulseBpm)) return;
  g_sample.present = true;
  g_sample.spo2Percent = spo2Percent;
  g_sample.pulseBpm = pulseBpm;
  g_sample.quality = quality;
  g_sample.source = source;
  g_sample.updatedMs = millis();
}

static void expireIfStale() {
  if (g_sample.present && millis() - g_sample.updatedMs > OX_STALE_MS) {
    g_sample = {};
  }
}

void oximetryInit() {
  g_sample = {};
  g_lastI2cPollMs = 0;
}

void oximetryPollI2c() {
  const uint32_t now = millis();
  if (now - g_lastI2cPollMs < OX_I2C_POLL_MS) {
    expireIfStale();
    return;
  }
  g_lastI2cPollMs = now;

  if (!heartbeat()) {
    expireIfStale();
    return;
  }

  Wire.beginTransmission(ADDR_OXIMETER);
  Wire.write(0x01);
  if (Wire.endTransmission(false) != 0) {
    expireIfStale();
    return;
  }
  if (Wire.requestFrom((uint8_t)ADDR_OXIMETER, (uint8_t)5) != 5) {
    expireIfStale();
    return;
  }

  const uint16_t spo2Raw = ((uint16_t)Wire.read() << 8) | Wire.read();
  const uint16_t pulseRaw = ((uint16_t)Wire.read() << 8) | Wire.read();
  const uint8_t quality = Wire.read();
  setSample(spo2Raw / 100.0f, pulseRaw / 100.0f, quality, OX_SOURCE_I2C);
}

void oximetrySetBleSample(float spo2Percent, float pulseBpm, uint8_t quality) {
  OximetrySample current = oximetryGetSample();
  if (current.present && current.source == OX_SOURCE_I2C && millis() - current.updatedMs <= OX_STALE_MS) return;
  setSample(spo2Percent, pulseBpm, quality, OX_SOURCE_BLE);
}

OximetrySample oximetryGetSample() {
  expireIfStale();
  return g_sample;
}

const char* oximetrySourceName(OximetrySource source) {
  switch (source) {
    case OX_SOURCE_I2C: return "i2c";
    case OX_SOURCE_BLE: return "ble";
    default: return "none";
  }
}

String oximetryJson() {
  OximetrySample sample = oximetryGetSample();
  char buf[120];
  if (!sample.present) {
    snprintf(buf, sizeof(buf), "{\"present\":false,\"source\":\"none\"}");
    return String(buf);
  }
  snprintf(buf, sizeof(buf),
           "{\"present\":true,\"spo2\":%.1f,\"pulse\":%.1f,\"quality\":%u,\"source\":\"%s\",\"ageMs\":%lu}",
           sample.spo2Percent,
           sample.pulseBpm,
           (unsigned)sample.quality,
           oximetrySourceName(sample.source),
           (unsigned long)(millis() - sample.updatedMs));
  return String(buf);
}
