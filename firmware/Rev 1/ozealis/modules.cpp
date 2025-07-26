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
  hose = {};
}

void pollModules(float targetRH, float targetTubeT) {
  static bool wasHumidPresent = false;
  static bool wasHosePresent = false;

  // run every 500 ms
  if (millis() - lastScan < 500) return;
  lastScan = millis();

  // Step‑1: ensure rail is on while scanning
  powerRail(true);

  // ---- Humidifier ----
  bool humidNow = heartbeat(ADDR_HUMIDIFIER);
  if (humidNow) {
    if (!wasHumidPresent) Serial.println("[I2C] Humidifier detected.");
    humid.present = true;
    humid.ready = true;

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
    uint16_t rh = targetRH * 100;
    Wire.beginTransmission(ADDR_HUMIDIFIER);
    Wire.write(0x10);  // target register
    Wire.write((rh >> 8) & 0xFF);
    Wire.write(rh & 0xFF);
    Wire.endTransmission();
  } else {
    if (wasHumidPresent) Serial.println("[I2C] Humidifier disconnected.");
    humid = {};
  }
  wasHumidPresent = humidNow;

  // ---- Heated Hose ----
  bool hoseNow = heartbeat(ADDR_HEATEDHOSE);
  if (hoseNow) {
    if (!wasHosePresent) Serial.println("[I2C] Heated hose detected.");
    hose.present = true;
    hose.ready = true;

    Wire.beginTransmission(ADDR_HEATEDHOSE);
    Wire.write(0x01);
    if (Wire.endTransmission(false) == 0 && Wire.requestFrom(ADDR_HEATEDHOSE, (uint8_t)2) == 2) {
      uint16_t tRaw = (Wire.read() << 8) | Wire.read();
      hose.temp_C = tRaw / 100.0f;
    }

    Wire.beginTransmission(ADDR_HEATEDHOSE);
    Wire.write(0x10);
    Wire.write((uint8_t)targetTubeT);  // °C delta
    Wire.endTransmission();
  } else {
    if (wasHosePresent) Serial.println("[I2C] Heated hose disconnected.");
    hose = {};
  }
  wasHosePresent = hoseNow;

  // Cut rail if no response for 2 s
  static uint8_t missCnt = 0;
  if (!humid.present && !hose.present) ++missCnt;
  else missCnt = 0;
  if (missCnt >= 4) {
    Serial.println("[I2C] Powering down accessory rail.");
    powerRail(false);
  }
}
