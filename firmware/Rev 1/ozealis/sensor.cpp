#include "sensor.h"

// --------- sensor object definitions -----------
Adafruit_LPS22 lps1;  // 0x5D   (upstream / mask side)
Adafruit_LPS22 lps2;  // 0x5C   (downstream / blower side)
Adafruit_AHTX0 aht;

static float vinLP = 0;  // exponentially filtered VIN
const float VIN_ALPHA = 0.05f;

static bool lps1OK = false, lps2OK = false;
static uint32_t lastGoodMs = 0;
static float pMask_cache = NAN;
static float pBlower_cache = NAN;

bool readPressures(float &pMask, float &pBlower) {
  bool ok = true;
  sensors_event_t e1_pressure, e1_temp;
  sensors_event_t e2_pressure, e2_temp;

  bool got1 = lps1.getEvent(&e1_pressure, &e1_temp);
  bool got2 = lps2.getEvent(&e2_pressure, &e2_temp);

  if (!got1 || !isfinite(e1_pressure.pressure)) {
    lps1OK = false;
    ok = false;
    Serial.println("Warning: LPS22 #1 read failed, using cached value");
  } else {
    pMask = pMask_cache = e1_pressure.pressure;
    lps1OK = true;
  }

  if (!got2 || !isfinite(e2_pressure.pressure)) {
    lps2OK = false;
    ok = false;
    Serial.println("Warning: LPS22 #2 read failed, using cached value");
  } else {
    pBlower = pBlower_cache = e2_pressure.pressure;
    lps2OK = true;
  }

  if (lps1OK && !isnan(pMask_cache))
    pMask = pMask_cache;
  else if (!lps1OK)
    pMask = NAN;

  if (lps2OK && !isnan(pBlower_cache))
    pBlower = pBlower_cache;
  else if (!lps2OK)
    pBlower = NAN;

  if (lps1OK || lps2OK)
    lastGoodMs = millis();

  return lps1OK && lps2OK;
}

bool sensorsOK() {
  return (millis() - lastGoodMs < 250) && lps1OK && lps2OK;
}

float getPressureDiff() {
  float pMask, pBlower;
  readPressures(pMask, pBlower);
  if (isnan(pMask) || isnan(pBlower)) return NAN;
  return pBlower - pMask;
}

float getPressureDiffCached() {
  if (isnan(pMask_cache) || isnan(pBlower_cache)) return NAN;
  return pBlower_cache - pMask_cache;
}

float vinFiltered() {
  float now = readVIN();
  vinLP = vinLP * (1.0f - VIN_ALPHA) + now * VIN_ALPHA;
  return vinLP;
}

// --------- setup + helpers ---------------------
void setupSensors() {
  Wire.begin(IIC_SDA, IIC_SCL);

  lps1OK = lps1.begin_I2C(0x5D);
  Serial.println(lps1OK ? "LPS22 #1 OK" : "LPS22 #1 not found");

  lps2OK = lps2.begin_I2C(0x5C);
  Serial.println(lps2OK ? "LPS22 #2 OK" : "LPS22 #2 not found");

  bool ahtOK = aht.begin();
  Serial.println(ahtOK ? "AHT20 OK" : "AHT20 not found");
}

float readVIN() {
  uint16_t raw = analogRead(VIN_SEN);
  return raw * (3.3f / 4095.0f) * VIN_DIVIDER_RATIO;
}
