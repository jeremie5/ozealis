// sensor.cpp
#include "sensor.h"
#include <Preferences.h>
#include <math.h>

// ========= user-configurable flags =========
#define OZEALIS_USE_I2C_PROBE 1   // set 0 to disable quick I2C probe on read fail

#ifndef OZEALIS_SENSOR_SERIAL_LOG
#define OZEALIS_SENSOR_SERIAL_LOG 0
#endif

#if OZEALIS_SENSOR_SERIAL_LOG
#define SENSOR_LOG(message) Serial.println(message)
#else
#define SENSOR_LOG(message) do { } while (0)
#endif

// ========= sensor objects =========
Adafruit_LPS22 lps1;  // 0x5D mask side
Adafruit_LPS22 lps2;  // 0x5C blower side
Adafruit_AHTX0 aht;

// ========= VIN filter =========
static float vinLP = 0.0f;
static bool vinLPInit = false;
static constexpr float VIN_ALPHA = 0.05f;  // about 300 ms at ~50 Hz

// ========= pressure read state =========
static bool     lps1OK = false;
static bool     lps2OK = false;
static uint32_t lastGoodMs = 0;
static Preferences sensorPrefs;

// cached absolute pressures for graceful fallback
static float pMask_cache   = NAN;
static float pBlower_cache = NAN;

// persisted blower-minus-mask trim learned during accepted no-flow water-column captures
static constexpr uint16_t SENSOR_TRIM_REQUIRED_SAMPLES = 17;
static constexpr float SENSOR_TRIM_MAX_ABS_HPA = 25.0f;
static bool sensorTrimValid = false;
static float sensorDiffTrim_hPa = 0.0f;
static float sensorTrimSampleSum_hPa = 0.0f;
static uint16_t sensorTrimSampleCount = 0;
static uint16_t sensorTrimCommittedSamples = 0;
static const char* sensorTrimStatus = "not-saved";

// transient failure debounce
static uint16_t badReadStreak = 0;
static constexpr uint16_t SENSOR_FAIL_DEBOUNCE = 5;   // ~250 ms at 50 ms loop
static constexpr uint32_t STALE_MS = 500;             // consider stale after this

// ambient estimator for gauge pressure
static float ambient_hPa = NAN;
static bool  ambientInit = false;

// diagnostics counters for each LPS22
static uint16_t miss1 = 0, miss2 = 0;
static int8_t  lastErr1 = 0, lastErr2 = 0;

// optional quick I2C probe to get a coarse error code
#if OZEALIS_USE_I2C_PROBE
static int8_t i2cProbe(uint8_t addr) {
  Wire.beginTransmission(addr);
  uint8_t rc = Wire.endTransmission(true);
  // Arduino-ESP32 returns: 0 ok, 1 tooLong, 2 NACK addr, 3 NACK data, 4 other
  switch (rc) {
    case 0: return 0;
    case 2: return -2;
    case 3: return -3;
    default: return -4;
  }
}
#endif

// expose diag taps
void sensorDiagGet(uint16_t& o_miss1, uint16_t& o_miss2, int8_t& o_err1, int8_t& o_err2) {
  o_miss1 = miss1; o_miss2 = miss2; o_err1 = lastErr1; o_err2 = lastErr2;
}

static float correctedBlowerPressure(float raw_hPa) {
  return sensorTrimValid ? raw_hPa - sensorDiffTrim_hPa : raw_hPa;
}

// Read both LPS22s. Caches remain available through the explicit cached
// diagnostics API, but live callers never receive stale samples as fresh data.
bool readPressures(float &pMask, float &pBlower) {
  sensors_event_t e1_pressure, e1_temp;
  sensors_event_t e2_pressure, e2_temp;

  const bool got1 = lps1.getEvent(&e1_pressure, &e1_temp) && isfinite(e1_pressure.pressure);
  const bool got2 = lps2.getEvent(&e2_pressure, &e2_temp) && isfinite(e2_pressure.pressure);

  if (got1) {
    pMask = e1_pressure.pressure;
    pMask_cache = pMask;
    lps1OK = true;
    miss1 = 0; lastErr1 = 0;
  } else {
    lps1OK = false;
    SENSOR_LOG("Warning: LPS22 #1 read failed");
    pMask = NAN;
#if OZEALIS_USE_I2C_PROBE
    lastErr1 = i2cProbe(0x5D);
#else
    lastErr1 = -1;
#endif
    if (miss1 < 0xFFFF) miss1++;
  }

  if (got2) {
    pBlower = correctedBlowerPressure(e2_pressure.pressure);
    pBlower_cache = pBlower;
    lps2OK = true;
    miss2 = 0; lastErr2 = 0;
  } else {
    lps2OK = false;
    SENSOR_LOG("Warning: LPS22 #2 read failed");
    pBlower = NAN;
#if OZEALIS_USE_I2C_PROBE
    lastErr2 = i2cProbe(0x5C);
#else
    lastErr2 = -1;
#endif
    if (miss2 < 0xFFFF) miss2++;
  }

  // freshness and debounce bookkeeping
  if (lps1OK && lps2OK) {
    lastGoodMs = millis();
    badReadStreak = 0;
  } else if (badReadStreak < 0xFFFF) {
    badReadStreak++;
  }

  return lps1OK && lps2OK;
}

// debounced health for state machine
bool sensorsOK() {
  const uint32_t age = millis() - lastGoodMs;
  if (lps1OK && lps2OK) return true;
  if (badReadStreak < SENSOR_FAIL_DEBOUNCE && age < STALE_MS) return true;
  return false;
}

// convenience helpers
float getPressureDiff() {
  float pm = NAN, pb = NAN;
  if (!readPressures(pm, pb)) return NAN;
  return pb - pm;
}

float getPressureDiffCached() {
  if (isnan(pMask_cache) || isnan(pBlower_cache)) return NAN;
  return pBlower_cache - pMask_cache;
}

void sensorDifferentialTrimResetSamples() {
  sensorTrimSampleSum_hPa = 0.0f;
  sensorTrimSampleCount = 0;
  sensorTrimCommittedSamples = 0;
  sensorTrimValid = false;
  sensorDiffTrim_hPa = 0.0f;
  sensorTrimStatus = "pending";
  sensorPrefs.begin("sensorcal", false);
  sensorPrefs.putBool("diffValid", false);
  sensorPrefs.putFloat("diffTrim", 0.0f);
  sensorPrefs.putUShort("diffSamples", 0);
  sensorPrefs.end();
}

bool sensorDifferentialTrimCaptureSample() {
  sensors_event_t e1_pressure, e1_temp;
  sensors_event_t e2_pressure, e2_temp;
  const bool got1 = lps1.getEvent(&e1_pressure, &e1_temp) && isfinite(e1_pressure.pressure);
  const bool got2 = lps2.getEvent(&e2_pressure, &e2_temp) && isfinite(e2_pressure.pressure);
  if (!got1 || !got2) return false;

  const float rawDiff = e2_pressure.pressure - e1_pressure.pressure;
  if (!isfinite(rawDiff) || fabsf(rawDiff) > SENSOR_TRIM_MAX_ABS_HPA) return false;
  sensorTrimSampleSum_hPa += rawDiff;
  if (sensorTrimSampleCount < 0xFFFF) sensorTrimSampleCount++;
  return true;
}

bool sensorDifferentialTrimCommit() {
  if (sensorTrimSampleCount < SENSOR_TRIM_REQUIRED_SAMPLES) {
    sensorTrimValid = false;
    sensorTrimStatus = "too-few-samples";
    return false;
  }
  const float nextTrim = sensorTrimSampleSum_hPa / (float)sensorTrimSampleCount;
  if (!isfinite(nextTrim) || fabsf(nextTrim) > SENSOR_TRIM_MAX_ABS_HPA) {
    sensorTrimValid = false;
    sensorTrimStatus = "invalid-offset";
    return false;
  }

  sensorDiffTrim_hPa = nextTrim;
  sensorTrimValid = true;
  sensorTrimCommittedSamples = sensorTrimSampleCount;
  sensorTrimStatus = "saved";
  sensorPrefs.begin("sensorcal", false);
  sensorPrefs.putBool("diffValid", sensorTrimValid);
  sensorPrefs.putFloat("diffTrim", sensorDiffTrim_hPa);
  sensorPrefs.putUShort("diffSamples", sensorTrimCommittedSamples);
  sensorPrefs.end();
  return true;
}

const char* sensorDifferentialTrimStatus() { return sensorTrimStatus; }
bool sensorDifferentialTrimValid() { return sensorTrimValid; }
float sensorDifferentialTrim_hPa() { return sensorDiffTrim_hPa; }
uint16_t sensorDifferentialTrimSamples() {
  return sensorTrimSampleCount > 0 ? sensorTrimSampleCount : sensorTrimCommittedSamples;
}

// VIN
float readVIN() {
  const uint16_t raw = analogRead(VIN_SEN);
  return (raw * (3.3f / 4095.0f)) * VIN_DIVIDER_RATIO;
}

float vinFiltered() {
  const float now = readVIN();
  if (!vinLPInit) {
    vinLP = now;
    vinLPInit = true;
    return vinLP;
  }
  vinLP = vinLP * (1.0f - VIN_ALPHA) + now * VIN_ALPHA;
  return vinLP;
}

// ambient estimate accessors
float sensorAmbient_hPa() { return ambient_hPa; }

// update ambient when flow is near zero
void sensorUpdateAmbientEstimate(float pMask, float diff_hPa) {
  if (!isfinite(pMask) || !isfinite(diff_hPa)) return;
  if (!ambientInit) {
    ambient_hPa = pMask;
    ambientInit = true;
    return;
  }

  const float FLOW_NEAR_ZERO_HPA = 0.5f;
  if (fabsf(diff_hPa) < FLOW_NEAR_ZERO_HPA) {
    const float alpha = 0.005f;
    ambient_hPa = ambient_hPa * (1.0f - alpha) + pMask * alpha;
  }
}

// setup
void setupSensors() {
  Wire.begin(IIC_SDA, IIC_SCL);

  sensorPrefs.begin("sensorcal", true);
  sensorTrimValid = sensorPrefs.getBool("diffValid", false);
  sensorDiffTrim_hPa = sensorPrefs.getFloat("diffTrim", 0.0f);
  sensorTrimCommittedSamples = sensorPrefs.getUShort("diffSamples", 0);
  sensorPrefs.end();
  bool rewriteSanitizedTrim = false;
  if (!isfinite(sensorDiffTrim_hPa) ||
      fabsf(sensorDiffTrim_hPa) > SENSOR_TRIM_MAX_ABS_HPA ||
      sensorTrimCommittedSamples < SENSOR_TRIM_REQUIRED_SAMPLES) {
    sensorTrimValid = false;
    sensorDiffTrim_hPa = 0.0f;
    sensorTrimCommittedSamples = 0;
    rewriteSanitizedTrim = true;
  }
  if (rewriteSanitizedTrim) {
    sensorPrefs.begin("sensorcal", false);
    sensorPrefs.putBool("diffValid", false);
    sensorPrefs.putFloat("diffTrim", 0.0f);
    sensorPrefs.putUShort("diffSamples", 0);
    sensorPrefs.end();
  }
  sensorTrimStatus = sensorTrimValid ? "saved" : "not-saved";

  lps1OK = lps1.begin_I2C(0x5D);
  SENSOR_LOG(lps1OK ? "LPS22 #1 OK" : "LPS22 #1 not found");

  lps2OK = lps2.begin_I2C(0x5C);
  SENSOR_LOG(lps2OK ? "LPS22 #2 OK" : "LPS22 #2 not found");

  const bool ahtOK = aht.begin();
  SENSOR_LOG(ahtOK ? "AHT20 OK" : "AHT20 not found");

  // prime caches if possible
  float pm, pb;
  const bool pressureComplete = readPressures(pm, pb);
  if (pressureComplete) {
    pMask_cache = pm;
    pBlower_cache = pb;
    lastGoodMs = millis();
    if (!ambientInit && isfinite(pm)) {
      ambient_hPa = pm;
      ambientInit = true;
    }
  }

  vinLP = readVIN();

}

// unit helpers for logic-side gauge checks
float cmH2O_to_hPa(float cm) { return cm * 0.980665f; }  // convenience
float hPa_to_cmH2O(float hPa) { return hPa * 1.019716f; } // convenience

// (cache fallback, debounce, ambient estimator, and I2C probe). Jeremie Frereault - 2025-08-10
