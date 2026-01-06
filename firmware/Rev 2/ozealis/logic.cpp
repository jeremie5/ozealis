// ========================= logic.cpp =========================
#ifndef LOGIC_H
#define LOGIC_H

#include <Arduino.h>
#include <deque>
#include "sensor.h"
#include "ble.h"
#include "diag.h"

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
  FAULT_OVERPRESSURE,
  FAULT_IO
};

static uint32_t lastTick = 0;

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
FaultType lastFault = FAULT_NONE;

// -------- Local helpers ------------------------------------
static void alarmBeep(uint8_t n) {
  for (uint8_t i = 0; i < n; ++i) {
    buzz(80);
    delay(120);
  }
}

const char* modeName(SystemMode m){
  switch(m){
    case MODE_IDLE: return "IDLE";
    case MODE_STARTUP: return "STARTUP";
    case MODE_RUNNING: return "RUNNING";
    case MODE_SHUTDOWN: return "SHUTDOWN";
    case MODE_FAULT: return "FAULT";
    default: return "?";
  }
}

const char* faultName(FaultType f){
  switch(f){
    case FAULT_NONE: return "NONE";
    case FAULT_LOW_VIN: return "LOW_VIN";
    case FAULT_SENSOR: return "SENSOR";
    case FAULT_OVERPRESSURE: return "OVERPRESSURE";
    case FAULT_IO: return "IO";
    default: return "?";
  }
}

// -----------------------------------------------------------
void triggerFault(FaultType f) {
  if (currentFault == f && currentMode == MODE_FAULT) return;

  lastFault = f;

  // Build snapshot
  float pMask = NAN, pBlower = NAN;
  readPressures(pMask, pBlower); // use cached fallback if needed
  const float diff = (isnan(pMask) || isnan(pBlower)) ? NAN : (pBlower - pMask);
  FaultSnapshot snap{};
  snap.ts_ms        = millis();
  snap.sys_mode     = (uint8_t)currentMode;
  snap.fault_code   = (uint8_t)f;
  snap.vin_V        = vinFiltered();
  snap.pMask_hPa    = pMask;
  snap.pBlower_hPa  = pBlower;
  snap.ambient_hPa  = sensorAmbient_hPa();
  snap.diff_hPa     = diff;
  snap.setpoint_cm  = papGetSetpointCm();
  snap.flowProxy_hPa= papGetFlowProxy();
  snap.motorAmp     = motorGetAmplitude();
  sensorDiagGet(snap.miss1, snap.miss2, snap.i2cErr1, snap.i2cErr2);
  diag_capture_fault(snap);  // log it

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
  // Allow STARTUP to transition to RUNNING even if we "think" we are already running
  if (m != MODE_STARTUP && currentMode == m) return;

  currentMode = m;

  switch (m) {
    case MODE_IDLE:
      motorSetDriveEnabled(false);   // stop + sleep driver
      setLED(0, 0, 255);             // blue
      break;

    case MODE_STARTUP:
      // Transitional alias: request motor start and immediately treat as RUNNING
      setLED(255, 255, 0);           // yellow for "starting"
      motorSetDriveEnabled(true);    // schedules non-blocking startMotor()
      currentMode = MODE_RUNNING;    // logical mode = RUNNING
      break;

    case MODE_RUNNING:
      setLED(0, 255, 0);             // green
      motorSetDriveEnabled(true);    // ensure motor is commanded ON
      break;

    case MODE_SHUTDOWN:
      setLED(255, 150, 0);           // orange
      motorSetDriveEnabled(false);
      delay(500);                    // ok, this is UI-level, not in motor code
      enterMode(MODE_IDLE);
      break;

    case MODE_FAULT:
      motorSetDriveEnabled(false);
      setLED(255, 0, 0);             // red
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
      if (millis() - vinLowSince > VIN_TRIP_MS){
        triggerFault(FAULT_LOW_VIN);
        Serial.println("VIN fault detected");
      }
    } else {
      vinLowSince = 0;
    }
  } else if (currentFault == FAULT_LOW_VIN && vin > VIN_RECOVER_V) {
    Serial.println("Low VIN Fault has recovered, entering idle");
    currentFault = FAULT_NONE;              // clear latched fault
    enterMode(MODE_IDLE);
  }  

  // If we're "running" but not spinning, kick a start
  static uint32_t lastKick = 0;
  if (currentMode == MODE_RUNNING && !motorIsStarting()) {
    // consider "not spinning" if edge rate is near zero
    static uint32_t lastE = 0, lastT = 0;
    uint32_t now = millis();
    if (now - lastT >= 300) {
      uint32_t dE = bemfEdges - lastE;
      lastE = bemfEdges; lastT = now;
      if (dE < 10 && now - lastKick > 2000) {    // hardly any edges
        restartMotor();
        lastKick = now;
      }
    }
  }

  /* 1. SENSOR HEALTH ------------------------------------------------ */
  if (!sensorsOK()) {
    Serial.println("Sensor fault detected");
    triggerFault(FAULT_SENSOR);
    return;
  }

  /* 2. PRESSURE ACQUISITION ---------------------------------------- */
  float pMask, pBlower;
  readPressures(pMask, pBlower);
  float diff_hPa = pBlower - pMask;

  // Choose a gauge limit, for example 25 cmH2O safety ceiling
  constexpr float MAX_MASK_CM = 25.0f;

  float maskGauge_hPa = NAN;
  if (isfinite(sensorAmbient_hPa())) {
    maskGauge_hPa = pMask - sensorAmbient_hPa();
  }

  // Update ambient estimate using this loop's readings
  sensorUpdateAmbientEstimate(pMask, diff_hPa);

  // Trip only if we have a valid gauge estimate
  if (isfinite(maskGauge_hPa)) {
    if (maskGauge_hPa > cmH2O_to_hPa(MAX_MASK_CM)) {
      triggerFault(FAULT_OVERPRESSURE);
      return;
    }
  }

  /* 3. DELEGATE TO AutoPAP (handles motor) */
  if (currentMode == MODE_RUNNING) {
    motorTrapKeepalive(1200, 200);   // ~833 Hz electrical, healthy capture
    papLoop();                       // sine writes are suppressed while trap is active
  } else {
    motorSetDriveEnabled(false);
  }

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

  uint32_t now_us = micros();
  uint32_t dt_us = lastTick ? (now_us - lastTick) : 0;
  lastTick = now_us;
  if (dt_us && dt_us < 65000) diag_note_loop_us((uint16_t)dt_us);  // cap at 65 ms
}
