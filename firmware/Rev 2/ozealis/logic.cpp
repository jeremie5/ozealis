// ========================= logic.cpp ========================
#include "logic.h"
#include "autopap.h"  // therapy & motor control lives here
#include "motor.h"
#include "buzzer.h"
#include "led.h"
#include "button.h"
#include "datalog.h"
#include "diag.h"
#include "modules.h"
#include "motor_calibration.h"
#include "oximetry.h"
#include "ota_secure.h"
#include <BLEDevice.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <stdlib.h>

#ifndef OZEALIS_LOGIC_SERIAL_LOG
#define OZEALIS_LOGIC_SERIAL_LOG 0
#endif

#if OZEALIS_LOGIC_SERIAL_LOG
#define LOGIC_LOG(message) Serial.println(message)
#else
#define LOGIC_LOG(message) do { } while (0)
#endif

static uint32_t lastTick = 0;
static uint32_t lastLogMs = 0;
static volatile bool statusLedRefreshPending = false;
static SemaphoreHandle_t systemControlMutex = nullptr;

// -------- External symbols provided by BLE unit ------------
extern bool bleActive;
extern unsigned long bleStartTime;
extern void sendBLEEvent(const char *evt);

// -------- VIN undervoltage guard ---------------------------
static constexpr float VIN_TRIP_V = 9.8f;
static constexpr float VIN_RECOVER_V = 10.3f;
static constexpr uint16_t VIN_TRIP_MS = 200;
static uint32_t vinLowSince = 0;
static bool humidifierPrewarmOn = false;
static uint32_t humidifierPrewarmUntilMs = 0;

// -------- Global machine state -----------------------------
SystemMode currentMode = MODE_IDLE;
FaultType currentFault = FAULT_NONE;
FaultType lastFault = FAULT_NONE;

void systemControlInit() {
  if (systemControlMutex) return;
  systemControlMutex = xSemaphoreCreateRecursiveMutex();
  if (!systemControlMutex) abort();
}

void systemControlLock() {
  if (!systemControlMutex ||
      xSemaphoreTakeRecursive(systemControlMutex, portMAX_DELAY) != pdTRUE) {
    abort();
  }
}

void systemControlUnlock() {
  if (!systemControlMutex ||
      xSemaphoreGiveRecursive(systemControlMutex) != pdTRUE) {
    abort();
  }
}

// -------- Local helpers ------------------------------------
static void alarmBeep(uint8_t n) {
  for (uint8_t i = 0; i < n; ++i) {
    buzz(80);
    delay(120);
  }
}

static float finiteOrNan(float value) {
  return isfinite(value) ? value : NAN;
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

static void applySystemStatusLed() {
  switch (currentMode) {
    case MODE_IDLE: setLED(0, 0, 255); break;
    case MODE_STARTUP: setLED(255, 255, 0); break;
    case MODE_RUNNING: setLED(0, 255, 0); break;
    case MODE_SHUTDOWN: setLED(255, 150, 0); break;
    case MODE_FAULT: setLED(255, 0, 0); break;
  }
}

void refreshSystemStatusLed() {
  // BLE callbacks run outside the Arduino loop task. Defer the shared pixel
  // buffer and RMT write to the main loop instead of touching them cross-task.
  statusLedRefreshPending = true;
}

bool humidifierPrewarmActive() {
  if (!humidifierPrewarmOn) return false;
  if (settings.humidifierKind != 2 || settings.humidifierPrewarmMinutes == 0 ||
      currentMode != MODE_IDLE || currentFault != FAULT_NONE || motorCalIsActive() ||
      otaSecure_inProgress() || !humid.present || !humid.ready || !humidifierTelemetryFresh()) {
    humidifierPrewarmStop();
    return false;
  }
  if ((int32_t)(millis() - humidifierPrewarmUntilMs) >= 0) {
    humidifierPrewarmStop();
    return false;
  }
  return true;
}

bool humidifierPrewarmStart() {
  if (currentMode != MODE_IDLE || currentFault != FAULT_NONE || motorCalIsActive() ||
      otaSecure_inProgress()) return false;
  if (settings.humidifierKind != 2 || settings.humidifierPrewarmMinutes == 0) return false;
  if (!humid.present || !humid.ready || !humidifierTelemetryFresh()) return false;
  humidifierPrewarmOn = true;
  humid.prewarm = true;
  humidifierPrewarmUntilMs = millis() + (uint32_t)settings.humidifierPrewarmMinutes * 60000UL;
  return true;
}

void humidifierPrewarmStop() {
  humidifierPrewarmOn = false;
  humidifierPrewarmUntilMs = 0;
  humid.prewarm = false;
}

// -----------------------------------------------------------
void triggerFault(FaultType f) {
  if (currentFault == f && currentMode == MODE_FAULT) return;

  lastFault = f;
  currentFault = f;

  // Remove motor power through the dedicated hardware pin before any I2C,
  // sensor, BLE, logging, or UI work. Preserve the already-cached command
  // values for the snapshot because normal shutdown clears them.
  motorEmergencyDisable();
  const uint8_t faultMotorAmp = motorGetAmplitude();
  const uint16_t faultMotorCommand = motorGetCommand();
  const float faultSetpointCm = finiteOrNan(papGetSetpointCm());
  const float faultFlowProxy = finiteOrNan(papGetFlowProxy());

  if (motorCalIsActive()) motorCalAbort();
  humidifierPrewarmStop();
  enterMode(MODE_FAULT);

  // Build a best-effort snapshot only after the fault is latched and the
  // hardware drive is disabled.
  float pMask = NAN, pBlower = NAN;
  const bool pressureComplete = readPressures(pMask, pBlower);
  if (!pressureComplete) {
    pMask = NAN;
    pBlower = NAN;
  }
  pMask = finiteOrNan(pMask);
  pBlower = finiteOrNan(pBlower);
  const float diff = (isfinite(pMask) && isfinite(pBlower)) ? (pBlower - pMask) : NAN;
  FaultSnapshot snap{};
  snap.ts_ms        = millis();
  snap.sys_mode     = (uint8_t)MODE_FAULT;
  snap.fault_code   = (uint8_t)f;
  snap.vin_V        = finiteOrNan(vinFiltered());
  snap.pMask_hPa    = pMask;
  snap.pBlower_hPa  = pBlower;
  snap.ambient_hPa  = finiteOrNan(sensorAmbient_hPa());
  snap.diff_hPa     = finiteOrNan(diff);
  snap.setpoint_cm  = faultSetpointCm;
  snap.flowProxy_hPa= faultFlowProxy;
  snap.motorAmp     = faultMotorAmp;
  snap.motorCmd     = faultMotorCommand;
  snap.motorFault   = motorFaultActive() ? 1 : 0;
  snap.motorI2c     = motorDriverI2cPresent() ? 1 : 0;
  snap.motorFgHz    = finiteOrNan(motorGetFgHz());
  sensorDiagGet(snap.miss1, snap.miss2, snap.i2cErr1, snap.i2cErr2);
  diag_capture_fault(snap);  // log it

  sendBLEEvent("FAULT");

  switch (f) {
    case FAULT_LOW_VIN: alarmBeep(2); break;
    case FAULT_SENSOR: alarmBeep(3); break;
    case FAULT_OVERPRESSURE: alarmBeep(5); break;
    default: alarmBeep(1); break;
  }
}

// -----------------------------------------------------------
void enterMode(SystemMode m) {
  // Allow STARTUP to transition to RUNNING even if we "think" we are already running
  if (m != MODE_STARTUP && currentMode == m) return;
  if ((m == MODE_STARTUP || m == MODE_RUNNING) && otaSecure_inProgress()) return;

  currentMode = m;
  ledTogglePairingWave(false);

  switch (m) {
    case MODE_IDLE:
      papStopSession();
      motorSetDriveEnabled(false);   // stop + sleep driver
      setLED(0, 0, 255);             // blue
      break;

    case MODE_STARTUP:
      humidifierPrewarmStop();
      setLED(255, 255, 0);           // yellow for "starting"
      motorSetDriveEnabled(true);
      if (!motorIsRunning()) {
        currentMode = MODE_IDLE;
        triggerFault(FAULT_IO);
        break;
      }
      enterMode(MODE_RUNNING);
      break;

    case MODE_RUNNING:
      humidifierPrewarmStop();
      setLED(0, 255, 0);             // green
      motorSetDriveEnabled(true);    // ensure motor is commanded ON
      if (!motorIsRunning()) {
        currentMode = MODE_IDLE;
        triggerFault(FAULT_IO);
        break;
      }
      papStartSession();
      break;

    case MODE_SHUTDOWN:
      humidifierPrewarmStop();
      papStopSession();
      setLED(255, 150, 0);           // orange
      motorSetDriveEnabled(false);
      delay(500);                    // ok, this is UI-level, not in motor code
      enterMode(MODE_IDLE);
      break;

    case MODE_FAULT:
      humidifierPrewarmStop();
      papStopSession();
      motorSetDriveEnabled(false);
      setLED(255, 0, 0);             // red
      break;
  }
}

// -----------------------------------------------------------
void runMainLogic() {
  if (statusLedRefreshPending) {
    statusLedRefreshPending = false;
    applySystemStatusLed();
  }

  if (otaSecure_inProgress()) {
    if (motorCalIsActive()) motorCalAbort();
    if (papSessionActive()) papStopSession();
    if (motorIsRunning()) motorSetDriveEnabled(false);
    humidifierPrewarmStop();
  }

  /* 0. VIN MONITOR -------------------------------------------------- */
  float vin = vinFiltered();
  if (currentMode != MODE_FAULT) {
    if (vin < VIN_TRIP_V) {
      if (!vinLowSince) vinLowSince = millis();
      if (millis() - vinLowSince > VIN_TRIP_MS){
        triggerFault(FAULT_LOW_VIN);
        LOGIC_LOG("VIN fault detected");
      }
    } else {
      vinLowSince = 0;
    }
  } else if (currentFault == FAULT_LOW_VIN && vin > VIN_RECOVER_V) {
    LOGIC_LOG("Low VIN Fault has recovered, entering idle");
    currentFault = FAULT_NONE;              // clear latched fault
    enterMode(MODE_IDLE);
    sendBLEEvent("VIN_RECOVER");
  }  

  if (currentMode != MODE_FAULT && motorFaultActive()) {
    LOGIC_LOG("Motor driver fault detected");
    triggerFault(FAULT_IO);
    return;
  }

  /* 1. SENSOR HEALTH ------------------------------------------------ */
  if (currentMode != MODE_FAULT && !sensorsOK()) {
    LOGIC_LOG("Sensor fault detected");
    triggerFault(FAULT_SENSOR);
    return;
  }

  /* 2. PRESSURE ACQUISITION ---------------------------------------- */
  float pMask = NAN, pBlower = NAN;
  const bool pressureComplete = readPressures(pMask, pBlower);
  const float diff_hPa = pressureComplete ? (pBlower - pMask) : NAN;

  float maskGauge_hPa = NAN;
  if (pressureComplete && isfinite(sensorAmbient_hPa())) {
    maskGauge_hPa = pMask - sensorAmbient_hPa();
  }

  // Update ambient estimate using this loop's readings
  if (pressureComplete) sensorUpdateAmbientEstimate(pMask, diff_hPa);

  // Trip only if we have a valid gauge estimate
  if (currentMode != MODE_FAULT && isfinite(maskGauge_hPa)) {
    if (maskGauge_hPa > cmH2O_to_hPa(MAX_MASK_PRESSURE_CM)) {
      triggerFault(FAULT_OVERPRESSURE);
      return;
    }
  }

  /* 3. DELEGATE TO AutoPAP (handles motor) */
  if (motorCalIsActive()) {
    if (!motorDriverReady()) {
      LOGIC_LOG("Motor calibration driver fault detected");
      triggerFault(FAULT_IO);
      return;
    }
    motorCalService();
  } else if (currentMode == MODE_RUNNING) {
    papLoop();
    if (!papSessionActive()) enterMode(MODE_IDLE);
  } else {
    motorSetDriveEnabled(false);
  }

  if ((currentMode == MODE_RUNNING || motorCalIsActive()) && millis() - lastLogMs >= 1000) {
    const bool calibrationActive = motorCalIsActive();
    const float measured_cm = isfinite(maskGauge_hPa) ? hPa_to_cmH2O(maskGauge_hPa) : NAN;
    const float setpoint_cm = calibrationActive ? motorCalLogTargetCm() : papGetSetpointCm();
    const float error_cm = isfinite(measured_cm) ? (setpoint_cm - measured_cm) : NAN;
    const float flowProxy = calibrationActive ? diff_hPa : papGetFlowProxy();
    const float controllerError = calibrationActive ? error_cm : papGetPressureErrorCm();
    const uint8_t controllerAmp = calibrationActive ? motorGetAmplitude() : papGetCommandedAmp();
    const float motorFgHz = motorGetFgHz();
    const OximetrySample ox = oximetryGetSample();
    const bool oxValid = ox.present && isfinite(ox.spo2Percent) && isfinite(ox.pulseBpm);
    if (isfinite(setpoint_cm) && isfinite(measured_cm) && isfinite(error_cm) && isfinite(flowProxy) &&
        isfinite(controllerError) && isfinite(motorFgHz)) {
      char line[220];
      char spo2Text[12] = "NAN";
      char pulseText[12] = "NAN";
      char humidTempText[12] = "NAN";
      char humidRhText[12] = "NAN";
      char hoseTempText[12] = "NAN";
      if (oxValid) {
        snprintf(spo2Text, sizeof(spo2Text), "%.1f", ox.spo2Percent);
        snprintf(pulseText, sizeof(pulseText), "%.1f", ox.pulseBpm);
      }
      if (humid.present && isfinite(humid.temp_C) && isfinite(humid.rh_percent)) {
        snprintf(humidTempText, sizeof(humidTempText), "%.1f", humid.temp_C);
        snprintf(humidRhText, sizeof(humidRhText), "%.1f", humid.rh_percent);
      }
      if (hose.present && isfinite(hose.temp_C)) {
        snprintf(hoseTempText, sizeof(hoseTempText), "%.1f", hose.temp_C);
      }
      snprintf(line, sizeof(line), "%lu,%.2f,%.2f,%.2f,%.2f,%u,%.2f,%u,%u,%u,%u,%.2f,%s,%s,%u,%s,%s,%s",
               (unsigned long)millis(),
               setpoint_cm,
               measured_cm,
               error_cm,
               flowProxy,
               (unsigned)motorGetAmplitude(),
               controllerError,
               (unsigned)controllerAmp,
               (unsigned)motorGetCommand(),
               motorFaultActive() ? 1 : 0,
               motorDriverI2cPresent() ? 1 : 0,
               motorFgHz,
               spo2Text,
               pulseText,
               oxValid ? (unsigned)ox.source : 0,
               humidTempText,
               humidRhText,
               hoseTempText);
      dl_push(
        calibrationActive ? DatalogSampleKind::Calibration : DatalogSampleKind::AirflowRun,
        line);
    }
    lastLogMs = millis();
  }

  /* 4. ACCESSORY + BLE TELEMETRY ----------------------------------- */
  const bool prewarmActive = humidifierPrewarmActive();
  HumidifierControl humidifierControl;
  humidifierControl.enabled = (currentMode == MODE_RUNNING && settings.humidifierKind != 0) || prewarmActive;
  humidifierControl.prewarm = prewarmActive;
  humidifierControl.kind = prewarmActive ? 2 : settings.humidifierKind;
  humidifierControl.targetRH = settings.humidifierTargetRH;
  humidifierControl.maxTempC = settings.humidifierMaxTempC;
  const float hoseTargetDeltaC = currentMode == MODE_RUNNING ? settings.hoseTempDeltaC : 0.0f;
  pollModules(humidifierControl, hoseTargetDeltaC);
  updateBLEStream(diff_hPa,
                  papGetFlowProxy(),
                  cmH2O_to_hPa(papGetSetpointCm()),
                  vin,
                  0.0f,
                  humid,
                  hose);

  /* 5. BLE ADVERTISING TIMEOUT ------------------------------------ */
  if (bleActive && !bleConnected && millis() - bleStartTime > BLE_TIMEOUT_MS) {
    BLEDevice::getAdvertising()->stop();
    bleActive = false;
    ledTogglePairingWave(false);   // stop animation
    refreshSystemStatusLed();
  }

  uint32_t now_us = micros();
  uint32_t dt_us = lastTick ? (now_us - lastTick) : 0;
  lastTick = now_us;
  if (dt_us && dt_us < 65000) diag_note_loop_us((uint16_t)dt_us);  // cap at 65 ms
}
