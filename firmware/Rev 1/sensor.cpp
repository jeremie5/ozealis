// sensor.cpp
#include "sensor.h"

// --------- sensor object definitions -----------
Adafruit_LPS22 lps1;          // 0x5D   (upstream / mask side)
Adafruit_LPS22 lps2;          // 0x5C   (downstream / blower side)
Adafruit_AHTX0  aht;

static float vinLP = 0;                       // exponentially filtered VIN
const float VIN_ALPHA = 0.05f;                // 5 % new value each sample

static bool   lps1OK = true, lps2OK = true;
static uint32_t lastGoodMs = 0;
static float pMask_cache   = NAN;
static float pBlower_cache = NAN;

bool readPressures(float &pMask, float &pBlower)
{
  bool ok = true;
  sensors_event_t e1, e2;

  if (!lps1.getEvent(&e1) || !isfinite(e1.pressure)) { lps1OK = false; ok = false; }
  else { pMask = pMask_cache = e1.pressure;  lps1OK = true; }

  if (!lps2.getEvent(&e2) || !isfinite(e2.pressure)) { lps2OK = false; ok = false; }
  else { pBlower = pBlower_cache = e2.pressure;  lps2OK = true; }

  if (ok) lastGoodMs = millis();                 // at least one good sample
  if (!ok) {                                     // fall back to cached
    pMask   = pMask_cache;
    pBlower = pBlower_cache;
  }
  return ok;
}

bool sensorsOK()
{
  // healthy if last good pair <250 ms ago *and* both devices flag OK
  return (millis() - lastGoodMs < 250) && lps1OK && lps2OK;
}

// ΔP helper now uses cached values (never NaN once first read succeeds)
float getPressureDiff() { return pBlower_cache - pMask_cache; }

float vinFiltered()
{
    float now = readVIN();                    // raw ADC → volts
    vinLP = vinLP * (1.0f - VIN_ALPHA) + now * VIN_ALPHA;
    return vinLP;
}

// --------- setup + helpers ---------------------
void setupSensors() {
  Wire.begin(IIC_SDA, IIC_SCL);
  if (!lps1.begin_I2C(0x5D))
    Serial.println("LPS22 #1 not found");
  else
    Serial.println("LPS22 #1 OK");
  if (!lps2.begin_I2C(0x5C))
    Serial.println("LPS22 #2 not found");
  else
    Serial.println("LPS22 #2 OK");
  if (!aht.begin())
    Serial.println("AHT20 not found");
  else
    Serial.println("AHT20 OK");
}

float readVIN() {
  uint16_t raw = analogRead(VIN_SEN);
  return raw * (3.3f / 4095.0f) * VIN_DIVIDER_RATIO;
}

// ΔP in **hPa** (positive when downstream > upstream)
float getPressureDiff() {
  return lps2.readPressure() - lps1.readPressure();
}
