// ========================= logic.h =========================
#ifndef LOGIC_H
#define LOGIC_H

#include <Arduino.h>
#include <deque>
#include "sensor.h"
#include "ble.h"

// ───── System‑level machine states (NOT therapy) ────────────
enum SystemMode : uint8_t {
  MODE_IDLE = 0,
  MODE_STARTUP,
  MODE_RUNNING,
  MODE_SHUTDOWN,
  MODE_FAULT
};

// ───── Fault codes ──────────────────────────────────────────
enum FaultType : uint8_t {
  FAULT_NONE = 0,
  FAULT_LOW_VIN,
  FAULT_SENSOR,
  FAULT_OVERPRESSURE
};

// ───── Limits & constants ───────────────────────────────────
constexpr uint32_t BLE_TIMEOUT_MS = 30'000;     // 30 s
constexpr float MAX_MASK_PRESSURE_HPA = 30.0f;  // ≈12 cm H₂O

// ───── Globals exposed to other units ───────────────────────
extern SystemMode currentMode;
extern FaultType currentFault;

// ───── API ─────────────────────────────────────────────────
void runMainLogic();             // call every 50 ms in loop()
void enterMode(SystemMode m);    // state machine jump
void triggerFault(FaultType f);  // raises fault & enters MODE_FAULT

#endif  // LOGIC_H


// ========================= logic.cpp ========================
#include "logic.h"
#include "autopap.h"  // therapy & motor control lives here
#include "motor.h"    // restartMotor(), setMotorAmplitude()
#include "buzzer.h"
#include "led.h"
#include "button.h"
#include <BLEDevice.h>

// -------- External symbols provided by BLE unit ------------
extern BLECharacteristic *char_liveCsv;
extern bool bleActive;
extern unsigned long bleStartTime;
extern void sendBLEEvent(const char *evt);

// -------- VIN undervoltage guard ---------------------------
static constexpr float VIN_TRIP_V = 9.8f;
static constexpr float VIN_RECOVER_V = 10.3f;
static constexpr uint16_t VIN_TRIP_MS = 200;
static uint32_t vinLowSince = 0;

// -------- Global machine state -----------------------------
SystemMode currentMode = MODE_IDLE;
FaultType currentFault = FAULT_NONE;

// -------- Local helpers ------------------------------------
static void alarmBeep(uint8_t n) {
  for (uint8_t i = 0; i < n; ++i) {
    buzz(80);
    delay(120);
  }
}

// -----------------------------------------------------------
void triggerFault(FaultType f) {
  if (currentFault == f && currentMode == MODE_FAULT) return;

  currentFault = f;
  sendBLEEvent("FAULT");

  switch (f) {
    case FAULT_LOW_VIN: alarmBeep(2); break;
    case FAULT_SENSOR: alarmBeep(3); break;
    case FAULT_OVERPRESSURE: alarmBeep(5); break;
    default: alarmBeep(1); break;
  }
  enterMode(MODE_FAULT);
}

// -----------------------------------------------------------
void enterMode(SystemMode m) {
  if (currentMode == m) return;
  currentMode = m;

  switch (m) {
    case MODE_IDLE:
      setMotorAmplitude(0);
      setLED(0, 0, 255);
      break;

    case MODE_STARTUP:
      restartMotor();  // open‑loop spin‑up
      setLED(255, 255, 0);
      enterMode(MODE_RUNNING);
      break;

    case MODE_RUNNING:
      setLED(0, 255, 0);
      break;

    case MODE_SHUTDOWN:
      setMotorAmplitude(0);
      setLED(255, 150, 0);
      delay(500);
      enterMode(MODE_IDLE);
      break;

    case MODE_FAULT:
      setMotorAmplitude(0);
      setLED(255, 0, 0);
      break;
  }
}

// -----------------------------------------------------------
void runMainLogic() {
  /* 0. VIN MONITOR -------------------------------------------------- */
  float vin = vinFiltered();
  if (currentMode != MODE_FAULT) {
    if (vin < VIN_TRIP_V) {
      if (!vinLowSince) vinLowSince = millis();
      if (millis() - vinLowSince > VIN_TRIP_MS) triggerFault(FAULT_LOW_VIN);
    } else {
      vinLowSince = 0;
    }
  } else if (currentFault == FAULT_LOW_VIN && vin > VIN_RECOVER_V) {
    enterMode(MODE_IDLE);
  }

  /* 1. SENSOR HEALTH ------------------------------------------------ */
  if (!sensorsOK()) {
    triggerFault(FAULT_SENSOR);
    return;
  }

  /* 2. PRESSURE ACQUISITION ---------------------------------------- */
  float pMask, pBlower;
  readPressures(pMask, pBlower);
  float diff_hPa = pBlower - pMask;

  if (pMask > MAX_MASK_PRESSURE_HPA) {
    triggerFault(FAULT_OVERPRESSURE);
    return;
  }

  /* 3. DELEGATE TO AutoPAP (handles motor) ------------------------- */
  papLoop();

  /* 4. BASIC BLE STREAM (mask press & VIN) ------------------------- */
  if (bleActive && char_liveCsv) {
    static uint32_t lastBle = 0;
    if (millis() - lastBle >= 1000) {
      char buf[48];
      snprintf(buf, sizeof(buf), "%.2f,%.2f", pMask, vin);
      char_liveCsv->setValue(buf);
      char_liveCsv->notify();
      lastBle = millis();
    }
  }

  /* 5. BLE ADVERTISING TIMEOUT ------------------------------------ */
  if (bleActive && millis() - bleStartTime > BLE_TIMEOUT_MS) {
    BLEDevice::getAdvertising()->stop();
    bleActive = false;
    ledTogglePairingWave(false);   // stop animation
    enterMode(MODE_IDLE);
  }
}
