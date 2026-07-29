// oximetry.h - optional wired and BLE-relayed pulse oximetry samples
#ifndef OXIMETRY_H
#define OXIMETRY_H

#include <Arduino.h>

#define ADDR_OXIMETER 0x46

enum OximetrySource : uint8_t {
  OX_SOURCE_NONE = 0,
  OX_SOURCE_I2C = 1,
  OX_SOURCE_BLE = 2,
};

struct OximetrySample {
  bool present = false;
  float spo2Percent = NAN;
  float pulseBpm = NAN;
  uint8_t quality = 0;
  OximetrySource source = OX_SOURCE_NONE;
  uint32_t updatedMs = 0;
};

void oximetryInit();
void oximetryPollI2c();
void oximetrySetBleSample(float spo2Percent, float pulseBpm, uint8_t quality);
OximetrySample oximetryGetSample();
String oximetryJson();
const char* oximetrySourceName(OximetrySource source);

#endif  // OXIMETRY_H
