#include "motor_calibration.h"
#include "motor.h"
#include "pressure_limits.h"
#include "sensor.h"
#include "ota_secure.h"
#include <Preferences.h>
#include <math.h>
#include <string.h>

enum CalState : uint8_t {
  CAL_IDLE = 0,
  CAL_PREP,
  CAL_SWEEP,
  CAL_WATER,
  CAL_DONE,
  CAL_ABORTED,
  CAL_ERROR
};

enum CalMode : uint8_t {
  CAL_MODE_AUTO = 0,
  CAL_MODE_WATER
};

static Preferences calPrefs;
static MotorCalibrationProfile profile;
static MotorCalibrationPlan plan;
static CalState state = CAL_IDLE;
static CalMode calibrationMode = CAL_MODE_AUTO;
static uint8_t currentAmp = 0;
static uint32_t stepStartedMs = 0;
static float sampleSumCm = 0.0f;
static uint16_t sampleCount = 0;
static float bestPressureCm = 0.0f;
static uint8_t bestAmp = 0;
static uint8_t firstEffectiveAmp = 0;
static uint8_t waterTargetCm = 4;
static uint8_t waterCapturedPoints = 0;
static uint8_t waterCurveAmp[17] = {};
static char statusText[32] = "idle";

static bool pressureSensorsReadyForCalibration() {
  float pMask = NAN;
  float pBlower = NAN;
  return readPressures(pMask, pBlower) && isfinite(pMask) && isfinite(pBlower);
}

static void setState(CalState next, const char* text) {
  state = next;
  snprintf(statusText, sizeof(statusText), "%s", text);
}

static MotorCalibrationPlan sanitizePlan(MotorCalibrationPlan next) {
  if (!isfinite(next.maxPressureCm)) next.maxPressureCm = MotorCalibrationPlan{}.maxPressureCm;
  next.minAmp = constrain(next.minAmp, (uint8_t)10, (uint8_t)220);
  next.maxAmp = constrain(next.maxAmp, next.minAmp, (uint8_t)240);
  next.stepAmp = constrain(next.stepAmp, (uint8_t)1, (uint8_t)40);
  next.dwellMs = constrain(next.dwellMs, (uint16_t)1000, (uint16_t)60000);
  next.maxPressureCm = constrain(next.maxPressureCm, MIN_THERAPY_PRESSURE_CM, MAX_THERAPY_PRESSURE_CM);
  return next;
}

static void saveProfile() {
  calPrefs.begin("motorcal", false);
  calPrefs.putBool("valid", profile.valid);
  calPrefs.putUChar("minAmp", profile.minAmp);
  calPrefs.putUChar("maxAmp", profile.maxAmp);
  calPrefs.putFloat("gain", profile.gainCmPerAmp);
  calPrefs.putFloat("maxCm", profile.maxPressureCm);
  calPrefs.putUInt("atMs", profile.calibratedAtMs);
  calPrefs.putBool("curve", profile.curveValid);
  calPrefs.putBytes("curveAmp", profile.curveAmp, sizeof(profile.curveAmp));
  calPrefs.end();
}

static void resetSamples() {
  sampleSumCm = 0.0f;
  sampleCount = 0;
  stepStartedMs = millis();
}

static uint8_t clampAmp(float amp, uint8_t minAmp, uint8_t maxAmp) {
  if (!isfinite(amp)) return minAmp;
  if (amp <= minAmp) return minAmp;
  if (amp >= maxAmp) return maxAmp;
  return (uint8_t)(amp + 0.5f);
}

static float finiteStatusNumber(float value, float fallback, float minValue, float maxValue) {
  if (!isfinite(value)) return fallback;
  if (value < minValue) return fallback;
  if (value > maxValue) return fallback;
  return value;
}

static void finishCalibration() {
  stopMotor();

  if (bestAmp <= firstEffectiveAmp || bestPressureCm < 2.0f) {
    profile.valid = false;
    profile.curveValid = false;
    memset(profile.curveAmp, 0, sizeof(profile.curveAmp));
    saveProfile();
    setState(CAL_ERROR, "weak-response");
    return;
  }

  profile.valid = true;
  profile.curveValid = false;
  memset(profile.curveAmp, 0, sizeof(profile.curveAmp));
  profile.minAmp = firstEffectiveAmp;
  profile.maxAmp = bestAmp;
  profile.maxPressureCm = bestPressureCm;
  profile.gainCmPerAmp = bestPressureCm / max<uint8_t>(1, bestAmp - firstEffectiveAmp);
  profile.calibratedAtMs = millis();
  saveProfile();
  setState(CAL_DONE, "done");
}

void motorCalLoad() {
  bool rewriteSanitizedProfile = false;
  calPrefs.begin("motorcal", true);
  profile.valid = calPrefs.getBool("valid", false);
  profile.minAmp = calPrefs.getUChar("minAmp", 30);
  profile.maxAmp = calPrefs.getUChar("maxAmp", 180);
  profile.gainCmPerAmp = calPrefs.getFloat("gain", 1.0f / 16.0f);
  profile.maxPressureCm = calPrefs.getFloat("maxCm", 0.0f);
  profile.calibratedAtMs = calPrefs.getUInt("atMs", 0);
  profile.curveValid = calPrefs.getBool("curve", false);
  const size_t curveBytes = calPrefs.getBytes("curveAmp", profile.curveAmp, sizeof(profile.curveAmp));
  calPrefs.end();

  if (profile.minAmp >= profile.maxAmp ||
      !isfinite(profile.gainCmPerAmp) || profile.gainCmPerAmp <= 0.0f || profile.gainCmPerAmp > 2.0f ||
      !isfinite(profile.maxPressureCm) || profile.maxPressureCm < 0.0f || profile.maxPressureCm > MAX_THERAPY_PRESSURE_CM) {
    profile = MotorCalibrationProfile{};
    rewriteSanitizedProfile = true;
  } else if (profile.curveValid) {
    bool waterProfileInvalid =
      !profile.valid ||
      !sensorDifferentialTrimValid() ||
      curveBytes != sizeof(profile.curveAmp);
    if (!waterProfileInvalid) {
      for (uint8_t i = 0; i < 17; ++i) {
        if (profile.curveAmp[i] == 0 || (i > 0 && profile.curveAmp[i] <= profile.curveAmp[i - 1])) {
          waterProfileInvalid = true;
          break;
        }
      }
      if (!waterProfileInvalid &&
          (profile.minAmp != profile.curveAmp[0] || profile.maxAmp != profile.curveAmp[16])) {
        waterProfileInvalid = true;
      }
    }
    if (waterProfileInvalid) {
      profile.valid = false;
      profile.curveValid = false;
      memset(profile.curveAmp, 0, sizeof(profile.curveAmp));
      rewriteSanitizedProfile = true;
    }
  }
  if (rewriteSanitizedProfile) {
    saveProfile();
  }

  if (profile.valid && profile.curveValid) {
    calibrationMode = CAL_MODE_WATER;
    waterTargetCm = 20;
    waterCapturedPoints = 17;
    memcpy(waterCurveAmp, profile.curveAmp, sizeof(waterCurveAmp));
    setState(CAL_DONE, "water-done");
  } else {
    calibrationMode = CAL_MODE_AUTO;
    waterTargetCm = 4;
    waterCapturedPoints = 0;
    memset(waterCurveAmp, 0, sizeof(waterCurveAmp));
    setState(CAL_IDLE, "idle");
  }
}

bool motorCalStart(const MotorCalibrationPlan& requestedPlan) {
  if (motorCalIsActive() || otaSecure_inProgress()) return false;
  calibrationMode = CAL_MODE_AUTO;
  if (!motorDriverReady()) {
    setState(CAL_ERROR, "driver-not-ready");
    return false;
  }
  if (!pressureSensorsReadyForCalibration()) {
    setState(CAL_ERROR, "sensor-error");
    return false;
  }

  plan = sanitizePlan(requestedPlan);
  currentAmp = plan.minAmp;
  bestPressureCm = 0.0f;
  bestAmp = plan.minAmp;
  firstEffectiveAmp = 0;
  resetSamples();
  setState(CAL_PREP, "preparing");
  return true;
}

bool motorCalWaterStart(const MotorCalibrationPlan& requestedPlan) {
  if (motorCalIsActive() || otaSecure_inProgress()) return false;
  calibrationMode = CAL_MODE_WATER;
  if (!motorDriverReady()) {
    setState(CAL_ERROR, "driver-not-ready");
    return false;
  }
  if (!pressureSensorsReadyForCalibration()) {
    setState(CAL_ERROR, "sensor-error");
    return false;
  }

  plan = sanitizePlan(requestedPlan);
  plan.minAmp = 0;
  plan.stepAmp = constrain(plan.stepAmp, (uint8_t)1, (uint8_t)5);
  plan.dwellMs = constrain(plan.dwellMs, (uint16_t)800, (uint16_t)5000);
  currentAmp = 0;
  profile.valid = false;
  profile.curveValid = false;
  memset(profile.curveAmp, 0, sizeof(profile.curveAmp));
  saveProfile();
  waterTargetCm = 4;
  waterCapturedPoints = 0;
  memset(waterCurveAmp, 0, sizeof(waterCurveAmp));
  sensorDifferentialTrimResetSamples();
  resetSamples();
  setState(CAL_WATER, "water-column");
  return true;
}

bool motorCalCapturePoint() {
  if (state != CAL_WATER || waterTargetCm < 4 || waterTargetCm > 20) return false;

  const uint8_t index = waterTargetCm - 4;
  if (currentAmp == 0 || (index > 0 && currentAmp <= waterCurveAmp[index - 1])) {
    setState(CAL_WATER, "water-wait-rise");
    return false;
  }

  if (!sensorDifferentialTrimCaptureSample()) {
    currentAmp = currentAmp > 3 ? currentAmp - 3 : 0;
    resetSamples();
    setState(CAL_WATER, "sensor-error");
    return false;
  }

  waterCurveAmp[index] = currentAmp;
  waterCapturedPoints = index + 1;

  if (waterTargetCm >= 20) {
    stopMotor();
    if (!sensorDifferentialTrimCommit()) {
      profile.valid = false;
      profile.curveValid = false;
      memset(profile.curveAmp, 0, sizeof(profile.curveAmp));
      saveProfile();
      setState(CAL_ERROR, "sensor-error");
      return false;
    }
    memcpy(profile.curveAmp, waterCurveAmp, sizeof(profile.curveAmp));
    profile.curveValid = true;
    profile.valid = true;
    profile.minAmp = profile.curveAmp[0];
    profile.maxAmp = profile.curveAmp[16];
    profile.maxPressureCm = 20.0f;
    profile.gainCmPerAmp = 16.0f / max<uint8_t>(1, profile.maxAmp - profile.minAmp);
    profile.calibratedAtMs = millis();
    saveProfile();
    setState(CAL_DONE, "water-done");
    return true;
  }

  waterTargetCm++;
  currentAmp = currentAmp > 3 ? currentAmp - 3 : 0;
  resetSamples();
  return true;
}

void motorCalAbort() {
  if (state == CAL_PREP || state == CAL_SWEEP || state == CAL_WATER) {
    stopMotor();
    setState(CAL_ABORTED, "aborted");
  }
}

bool motorCalIsActive() {
  return state == CAL_PREP || state == CAL_SWEEP || state == CAL_WATER;
}

bool motorCalIsWaterActive() {
  return state == CAL_WATER;
}

bool motorCalHasProfile() {
  return profile.valid;
}

float motorCalLogTargetCm() {
  if (!motorCalIsActive()) return NAN;
  return state == CAL_WATER ? (float)waterTargetCm : plan.maxPressureCm;
}

MotorCalibrationProfile motorCalProfile() {
  return profile;
}

uint8_t motorCalDutyForCm(float targetCm) {
  if (!isfinite(targetCm) || targetCm <= 0.0f) return 0;
  if (profile.curveValid) {
    if (targetCm <= 4.0f) return profile.curveAmp[0];
    if (targetCm >= 20.0f) return profile.curveAmp[16];

    uint8_t loCm = (uint8_t)floor(targetCm);
    loCm = constrain(loCm, (uint8_t)4, (uint8_t)19);
    const uint8_t idx = loCm - 4;
    const float frac = targetCm - (float)loCm;
    const float amp = profile.curveAmp[idx] + frac * (float)(profile.curveAmp[idx + 1] - profile.curveAmp[idx]);
    return clampAmp(amp, profile.curveAmp[0], profile.curveAmp[16]);
  }
  if (!profile.valid) return clampAmp(targetCm * 16.0f, 0, 255);

  float duty = profile.minAmp + (targetCm / profile.gainCmPerAmp);
  return clampAmp(duty, profile.minAmp, profile.maxAmp);
}

void motorCalService() {
  if (state == CAL_IDLE || state == CAL_DONE || state == CAL_ABORTED || state == CAL_ERROR) return;

  if (otaSecure_inProgress()) {
    stopMotor();
    setState(CAL_ABORTED, "ota-busy");
    return;
  }

  if (!motorDriverReady()) {
    stopMotor();
    setState(CAL_ERROR, "driver-not-ready");
    return;
  }

  if (!sensorsOK()) {
    stopMotor();
    setState(CAL_ERROR, "sensor-error");
    return;
  }

  if (state == CAL_PREP) {
    startMotor();
    setMotorAmplitude(0);
    resetSamples();
    setState(CAL_SWEEP, "sweeping");
    return;
  }

  if (state == CAL_WATER) {
    startMotor();
    setMotorAmplitude(currentAmp);
    if (millis() - stepStartedMs < plan.dwellMs) return;
    if (currentAmp >= plan.maxAmp) {
      stopMotor();
      setState(CAL_ERROR, "water-limit");
      return;
    }
    currentAmp = min<uint8_t>(plan.maxAmp, currentAmp + plan.stepAmp);
    resetSamples();
    return;
  }

  float pMask = NAN;
  float pBlower = NAN;
  const float ambient = sensorAmbient_hPa();
  if (!readPressures(pMask, pBlower) || !isfinite(ambient)) {
    stopMotor();
    setState(CAL_ERROR, "sensor-error");
    return;
  }
  float maskCm = hPa_to_cmH2O(pMask - ambient);
  sampleSumCm += max(0.0f, maskCm);
  sampleCount++;

  setMotorAmplitude(currentAmp);

  if (millis() - stepStartedMs < plan.dwellMs) return;

  float avgCm = sampleCount ? sampleSumCm / sampleCount : 0.0f;
  if (avgCm > bestPressureCm) {
    bestPressureCm = avgCm;
    bestAmp = currentAmp;
  }
  if (firstEffectiveAmp == 0 && avgCm >= 1.0f) {
    firstEffectiveAmp = currentAmp;
  }

  if (avgCm >= plan.maxPressureCm || currentAmp >= plan.maxAmp) {
    finishCalibration();
    return;
  }

  currentAmp = min<uint8_t>(plan.maxAmp, currentAmp + plan.stepAmp);
  resetSamples();
}

String motorCalStatusJson() {
  char out[448];
  const bool active = motorCalIsActive();
  const bool waterMode = calibrationMode == CAL_MODE_WATER;
  const uint8_t statusMinAmp = active ? plan.minAmp : profile.minAmp;
  const uint8_t statusMaxAmp = active ? plan.maxAmp : profile.maxAmp;
  const float statusGain = finiteStatusNumber(profile.gainCmPerAmp, 0.0f, 0.0f, 2.0f);
  const float statusMaxCm = finiteStatusNumber(profile.maxPressureCm, 0.0f, 0.0f, MAX_THERAPY_PRESSURE_CM);
  const float statusBestCm = finiteStatusNumber(bestPressureCm, 0.0f, 0.0f, MAX_THERAPY_PRESSURE_CM);
  const float statusFgHz = finiteStatusNumber(motorGetFgHz(), 0.0f, 0.0f, 100000.0f);
  const float statusTrimHpa = finiteStatusNumber(sensorDifferentialTrim_hPa(), 0.0f, -25.0f, 25.0f);
  snprintf(out, sizeof(out),
           "{\"state\":\"%s\",\"active\":%s,\"valid\":%s,"
           "\"amp\":%u,\"minAmp\":%u,\"maxAmp\":%u,"
           "\"gain\":%.5f,\"maxCm\":%.2f,\"bestCm\":%.2f,\"bestAmp\":%u,"
           "\"mode\":\"%s\",\"targetCm\":%u,\"capturedPoints\":%u,\"curveValid\":%s,"
           "\"fgHz\":%.2f,"
           "\"sensorTrimValid\":%s,\"sensorTrimHpa\":%.3f,\"sensorTrimSamples\":%u,"
           "\"sensorTrimStatus\":\"%s\"}",
           statusText,
           active ? "true" : "false",
           profile.valid ? "true" : "false",
           currentAmp,
           statusMinAmp,
           statusMaxAmp,
           statusGain,
           statusMaxCm,
           statusBestCm,
           bestAmp,
           waterMode ? "water" : "auto",
           state == CAL_WATER ? waterTargetCm : 0,
           state == CAL_WATER ? waterCapturedPoints : (waterMode && profile.curveValid ? 17 : 0),
           profile.curveValid ? "true" : "false",
           statusFgHz,
           sensorDifferentialTrimValid() ? "true" : "false",
           statusTrimHpa,
           sensorDifferentialTrimSamples(),
           sensorDifferentialTrimStatus());
  return String(out);
}
