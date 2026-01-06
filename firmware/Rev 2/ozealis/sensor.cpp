// sensor.cpp
#include "sensor.h"
#include <math.h>

// ========= user-configurable flags =========
#define OZEALIS_USE_I2C_PROBE 1   // set 0 to disable quick I2C probe on read fail

// ========= sensor objects =========
Adafruit_LPS22 lps1;  // 0x5D mask side
Adafruit_LPS22 lps2;  // 0x5C blower side
Adafruit_AHTX0 aht;

// ========= VIN filter =========
static float vinLP = 0.0f;
static constexpr float VIN_ALPHA = 0.05f;  // about 300 ms at ~50 Hz

// ========= pressure read state =========
static bool     lps1OK = false;
static bool     lps2OK = false;
static uint32_t lastGoodMs = 0;

// cached absolute pressures for graceful fallback
static float pMask_cache   = NAN;
static float pBlower_cache = NAN;

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

// read both LPS22s with per-sensor cache fallback
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
    Serial.println("Warning: LPS22 #1 read failed, using cached value");
    pMask = !isnan(pMask_cache) ? pMask_cache : NAN;
#if OZEALIS_USE_I2C_PROBE
    lastErr1 = i2cProbe(0x5D);
#else
    lastErr1 = -1;
#endif
    if (miss1 < 0xFFFF) miss1++;
  }

  if (got2) {
    pBlower = e2_pressure.pressure;
    pBlower_cache = pBlower;
    lps2OK = true;
    miss2 = 0; lastErr2 = 0;
  } else {
    lps2OK = false;
    Serial.println("Warning: LPS22 #2 read failed, using cached value");
    pBlower = !isnan(pBlower_cache) ? pBlower_cache : NAN;
#if OZEALIS_USE_I2C_PROBE
    lastErr2 = i2cProbe(0x5C);
#else
    lastErr2 = -1;
#endif
    if (miss2 < 0xFFFF) miss2++;
  }

  // freshness and debounce bookkeeping
  if (lps1OK || lps2OK) lastGoodMs = millis();
  if (lps1OK && lps2OK) badReadStreak = 0;
  else if (badReadStreak < 0xFFFF) badReadStreak++;

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
  if (!readPressures(pm, pb)) {
    if (isnan(pm)) pm = pMask_cache;
    if (isnan(pb)) pb = pBlower_cache;
  }
  if (isnan(pm) || isnan(pb)) return NAN;
  return pb - pm;
}

float getPressureDiffCached() {
  if (isnan(pMask_cache) || isnan(pBlower_cache)) return NAN;
  return pBlower_cache - pMask_cache;
}

// VIN
float readVIN() {
  const uint16_t raw = analogRead(VIN_SEN);
  return (raw * (3.3f / 4095.0f)) * VIN_DIVIDER_RATIO;
}

float vinFiltered() {
  const float now = readVIN();
  vinLP = vinLP * (1.0f - VIN_ALPHA) + now * VIN_ALPHA;
  return vinLP;
}

// ambient estimate accessors
float sensorAmbient_hPa() { return ambient_hPa; }

// update ambient when flow is near zero
void sensorUpdateAmbientEstimate(float pMask, float diff_hPa) {
  if (!ambientInit && isfinite(pMask)) {
    ambient_hPa = pMask;
    ambientInit = true;
    return;
  }
  if (!ambientInit || !isfinite(pMask)) return;

  const float FLOW_NEAR_ZERO_HPA = 0.5f;
  if (fabsf(diff_hPa) < FLOW_NEAR_ZERO_HPA) {
    const float alpha = 0.005f;
    ambient_hPa = ambient_hPa * (1.0f - alpha) + pMask * alpha;
  }
}

// setup
void setupSensors() {
  Wire.begin(IIC_SDA, IIC_SCL);

  lps1OK = lps1.begin_I2C(0x5D);
  Serial.println(lps1OK ? "LPS22 #1 OK" : "LPS22 #1 not found");

  lps2OK = lps2.begin_I2C(0x5C);
  Serial.println(lps2OK ? "LPS22 #2 OK" : "LPS22 #2 not found");

  const bool ahtOK = aht.begin();
  Serial.println(ahtOK ? "AHT20 OK" : "AHT20 not found");

  // prime caches if possible
  float pm, pb;
  if (readPressures(pm, pb)) {
    pMask_cache = pm;
    pBlower_cache = pb;
  }
  if (lps1OK || lps2OK) {
    lastGoodMs = millis();
    if (!ambientInit && isfinite(pMask_cache)) { ambient_hPa = pMask_cache; ambientInit = true; }
  }

  vinLP = readVIN();

}

// unit helpers for logic-side gauge checks
float cmH2O_to_hPa(float cm) { return cm * 0.980665f; }  // convenience
float hPa_to_cmH2O(float hPa) { return hPa * 1.019716f; } // convenience

// (cache fallback, debounce, ambient estimator, and I2C probe). Jérémie Fréreault - 2025-08-10
