// modules.cpp – implementation
#include "modules.h"

ModuleStatus humid, hose;
static unsigned long lastScan = 0;
static uint8_t heartbeatFrame = 0;

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

void initModules() {
  pinMode(ACC_EN, OUTPUT);
  powerRail(false);
  humid = {};
  hose  = {};
}

void pollModules(float targetRH, float targetTubeT) {
  // run every 500 ms
  if (millis() - lastScan < 500) return;
  lastScan = millis();

  // Step‑1: ensure rail is on while scanning
  powerRail(true);

  // ---- Humidifier ----
  if (heartbeat(ADDR_HUMIDIFIER)) {
    humid.present = true;
    humid.ready   = true;
    // read temp/RH from registers 0x01‑0x04 (example)
    Wire.beginTransmission(ADDR_HUMIDIFIER);
    Wire.write(0x01);
    if (Wire.endTransmission(false) == 0 && Wire.requestFrom(ADDR_HUMIDIFIER, (uint8_t)4) == 4) {
      uint16_t tRaw = (Wire.read() << 8) | Wire.read();
      uint16_t hRaw = (Wire.read() << 8) | Wire.read();
      humid.temp_C = tRaw / 100.0f;
      humid.rh_percent = hRaw / 100.0f;
    }
    // send target RH (%)
    Wire.beginTransmission(ADDR_HUMIDIFIER);
    Wire.write(0x10);                     // target register
    Wire.write((uint16_t)(targetRH * 100) >> 8);
    Wire.write((uint16_t)(targetRH * 100) & 0xFF);
    Wire.endTransmission();
  } else {
    humid = {};  // reset
  }

  // ---- Heated Hose ----
  if (heartbeat(ADDR_HEATEDHOSE)) {
    hose.present = true;
    hose.ready   = true;
    // read temp sensor on hose
    Wire.beginTransmission(ADDR_HEATEDHOSE);
    Wire.write(0x01);
    if (Wire.endTransmission(false) == 0 && Wire.requestFrom(ADDR_HEATEDHOSE, (uint8_t)2) == 2) {
      uint16_t tRaw = (Wire.read() << 8) | Wire.read();
      hose.temp_C = tRaw / 100.0f;
    }
    // send target tube temperature delta
    Wire.beginTransmission(ADDR_HEATEDHOSE);
    Wire.write(0x10);
    Wire.write((uint8_t)targetTubeT);  // °C delta
    Wire.endTransmission();
  } else {
    hose = {};
  }

  // If neither module responded for >2 scans, cut rail to save power
  static uint8_t missCnt = 0;
  if (!humid.present && !hose.present) ++missCnt; else missCnt = 0;
  if (missCnt >= 4) powerRail(false);
}
