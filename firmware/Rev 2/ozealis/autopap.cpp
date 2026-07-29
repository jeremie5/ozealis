#include "autopap.h"
#include "motor_calibration.h"
#include "pressure_limits.h"

static PapLimits limits;
static TherapyMode mode = MODE_CPAP;

static float epapBase = 0.0f;
static float epap_cm = 5.0f;
static float ipap_cm = 9.0f;
static float flowProxy = 0.0f;
static uint32_t rampStart = 0;
static bool blowerOn = false;

static float ampCommand = 0.0f;
static float pressureIntegral = 0.0f;
static float measured_cm = NAN;
static float pressureError_cm = NAN;
static uint8_t commandedAmp = 0;
static uint32_t lastSpontaneousBreathMs = 0;
static uint32_t timedIpapUntilMs = 0;
static bool spontaneousInspirationSeen = false;

static bool modeUsesBilevelTargets(TherapyMode m) {
  return m == MODE_BIPAP_S || m == MODE_BIPAP_ST || m == MODE_BIPAP_T ||
         m == MODE_ASV || m == MODE_AUTO_ASV || m == MODE_AUTO_BIPAP ||
         m == MODE_BIPAP_PC || m == MODE_VAPS;
}

static bool modeUsesAutoPressure(TherapyMode m) {
  return m == MODE_AUTOPAP || m == MODE_AUTO_ASV || m == MODE_AUTO_BIPAP;
}

static bool modeUsesBackupRate(TherapyMode m) {
  return m == MODE_BIPAP_ST || m == MODE_BIPAP_T || m == MODE_BIPAP_PC;
}

static bool modeUsesSpontaneousBackupReset(TherapyMode m) {
  return m == MODE_BIPAP_ST || m == MODE_BIPAP_PC;
}

static PapLimits sanitizeLimits(const PapLimits& cfg) {
  PapLimits next = cfg;
  next.pMin = constrain(next.pMin, MIN_THERAPY_PRESSURE_CM, MAX_THERAPY_PRESSURE_CM);
  next.pMax = constrain(next.pMax, next.pMin, MAX_THERAPY_PRESSURE_CM);
  next.delta = constrain(next.delta, 0.0f, 12.0f);
  next.rampSecs = constrain(next.rampSecs, (uint16_t)0, (uint16_t)1800);
  next.epr = constrain(next.epr, (uint8_t)0, (uint8_t)3);
  if (!isfinite(next.backupRateBpm)) next.backupRateBpm = 12.0f;
  next.backupRateBpm = constrain(next.backupRateBpm, 4.0f, 30.0f);
  next.inspTimeMs = constrain(next.inspTimeMs, (uint16_t)300, (uint16_t)3000);
  return next;
}

static void resetPressureController() {
  ampCommand = 0.0f;
  pressureIntegral = 0.0f;
  pressureError_cm = NAN;
  commandedAmp = 0;
}

static void resetBreathTiming(uint32_t now) {
  lastSpontaneousBreathMs = now;
  timedIpapUntilMs = 0;
  spontaneousInspirationSeen = false;
}

static void updateBackupTiming(uint32_t now) {
  if (!modeUsesBackupRate(mode)) {
    timedIpapUntilMs = 0;
    spontaneousInspirationSeen = flowProxy > 0.25f;
    lastSpontaneousBreathMs = now;
    return;
  }

  const uint32_t backupIntervalMs = (uint32_t)constrain(60000.0f / limits.backupRateBpm, 2000.0f, 15000.0f);
  const uint32_t inspWindowMs = min((uint32_t)limits.inspTimeMs, backupIntervalMs / 2);
  const bool spontaneousNow = flowProxy > 0.25f;

  if (modeUsesSpontaneousBackupReset(mode) && spontaneousNow && !spontaneousInspirationSeen) {
    lastSpontaneousBreathMs = now;
    timedIpapUntilMs = 0;
  }
  spontaneousInspirationSeen = spontaneousNow;

  if (now - lastSpontaneousBreathMs >= backupIntervalMs) {
    timedIpapUntilMs = now + inspWindowMs;
    lastSpontaneousBreathMs = now;
  }
}

static uint8_t pressureControllerDuty(float targetCm, float measuredCm) {
  const float feedForward = motorCalDutyForCm(targetCm);
  float desired = feedForward;

  if (isfinite(measuredCm)) {
    const float error = constrain(targetCm - measuredCm, -8.0f, 8.0f);
    pressureError_cm = error;
    pressureIntegral = constrain(pressureIntegral + error * 0.35f, -35.0f, 35.0f);
    desired = feedForward + error * 4.0f + pressureIntegral;
  } else {
    pressureError_cm = NAN;
    pressureIntegral *= 0.95f;
  }

  desired = constrain(desired, 0.0f, 255.0f);
  if (desired > ampCommand + 2.0f) ampCommand += 2.0f;
  else if (desired < ampCommand - 3.0f) ampCommand -= 3.0f;
  else ampCommand = desired;

  commandedAmp = (uint8_t)constrain(ampCommand, 0.0f, 255.0f);
  return commandedAmp;
}

void papBegin(const PapLimits& cfg) {
  limits = sanitizeLimits(cfg);
  epapBase = limits.pMin;
  epap_cm = limits.pMin;
  ipap_cm = constrain(epap_cm + limits.delta, limits.pMin, limits.pMax);
  rampStart = millis();
  blowerOn = false;
  flowProxy = NAN;
  measured_cm = NAN;
  resetPressureController();
  resetBreathTiming(rampStart);
}

void papSetLimits(const PapLimits& cfg) {
  limits = sanitizeLimits(cfg);
  epap_cm = constrain(epap_cm, limits.pMin, limits.pMax);
  ipap_cm = constrain(max(ipap_cm, epap_cm + limits.delta), limits.pMin, limits.pMax);
  resetBreathTiming(millis());
}

void papStartSession() {
  const uint32_t now = millis();
  epapBase = limits.pMin;
  epap_cm = limits.pMin;
  ipap_cm = constrain(epap_cm + limits.delta, limits.pMin, limits.pMax);
  flowProxy = NAN;
  measured_cm = NAN;
  rampStart = now;
  blowerOn = true;
  resetPressureController();
  resetBreathTiming(now);
}

void papStopSession() {
  blowerOn = false;
  epapBase = limits.pMin;
  epap_cm = limits.pMin;
  ipap_cm = constrain(epap_cm + limits.delta, limits.pMin, limits.pMax);
  flowProxy = NAN;
  measured_cm = NAN;
  resetPressureController();
  resetBreathTiming(millis());
  setMotorAmplitude(0);
}

bool papSessionActive() {
  return blowerOn;
}

TherapyMode papGetMode() {
  return mode;
}

void papSetMode(TherapyMode m) {
  mode = m <= MODE_VAPS ? m : MODE_CPAP;
  resetBreathTiming(millis());
}

float papGetSetpointCm() {
  float targetCm = epap_cm;
  if (modeUsesBilevelTargets(mode)) {
    if (modeUsesBackupRate(mode) && millis() < timedIpapUntilMs) targetCm = ipap_cm;
    else if (mode != MODE_BIPAP_T) targetCm = flowProxy >= 0 ? ipap_cm : epap_cm;
  }
  return constrain(targetCm, MIN_THERAPY_PRESSURE_CM, MAX_THERAPY_PRESSURE_CM);
}

float papGetFlowProxy() {
  return flowProxy;
}

float papGetMeasuredCm() {
  return measured_cm;
}

float papGetPressureErrorCm() {
  return pressureError_cm;
}

uint8_t papGetCommandedAmp() {
  return commandedAmp;
}

void papLoop() {
  float pMask = NAN;
  float pBlower = NAN;
  if (!readPressures(pMask, pBlower)) {
    setMotorAmplitude(0);
    blowerOn = false;
    flowProxy = NAN;
    measured_cm = NAN;
    resetPressureController();
    resetBreathTiming(millis());
    return;
  }
  flowProxy = pBlower - pMask;

  if (!blowerOn && limits.autoStart && abs(flowProxy) > 0.8f) {
    restartMotor();
    blowerOn = true;
    rampStart = millis();
    resetPressureController();
    resetBreathTiming(rampStart);
  }

  if (blowerOn && limits.autoStop && abs(flowProxy) < 0.3f && (millis() - rampStart) > 5000) {
    setMotorAmplitude(0);
    blowerOn = false;
    resetPressureController();
    resetBreathTiming(millis());
  }
  if (!blowerOn) return;

  if (mode == MODE_CPAP || modeUsesAutoPressure(mode)) {
    uint32_t t = millis() - rampStart;
    float frac = limits.rampSecs ? min(1.0f, t / (limits.rampSecs * 1000.0f)) : 1.0f;
    const float ceiling = modeUsesAutoPressure(mode) ? limits.pMax : limits.pMin;
    epapBase = limits.pMin + frac * (ceiling - limits.pMin);
    epap_cm = epapBase;
  }

  switch (mode) {
    case MODE_CPAP:
    case MODE_AUTOPAP:
      ipap_cm = epapBase;
      epap_cm = (flowProxy < 0 && limits.epr > 0) ? max(limits.pMin, epapBase - limits.epr) : epapBase;
      break;

    case MODE_BIPAP_S:
    case MODE_BIPAP_ST:
    case MODE_BIPAP_T:
    case MODE_BIPAP_PC:
      ipap_cm = constrain(epap_cm + limits.delta, limits.pMin, limits.pMax);
      updateBackupTiming(millis());
      break;

    case MODE_AUTO_BIPAP:
    case MODE_VAPS:
      ipap_cm = constrain(epap_cm + limits.delta, limits.pMin, limits.pMax);
      break;

    case MODE_ASV:
    case MODE_AUTO_ASV:
      ipap_cm = constrain(epap_cm + limits.delta, limits.pMin, limits.pMax);
      break;
  }

  float measuredCm = NAN;
  if (isfinite(sensorAmbient_hPa())) {
    measuredCm = hPa_to_cmH2O(pMask - sensorAmbient_hPa());
  }
  measured_cm = measuredCm;

  setMotorAmplitude(pressureControllerDuty(papGetSetpointCm(), measuredCm));
}
