// modules.h - hot-plug accessory bus (humidifier, heated hose, and oximeter)
#ifndef MODULES_H
#define MODULES_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_AHTX0.h>

// I2C accessory addresses in the Ozealis reserved accessory range.
#define ADDR_HUMIDIFIER 0x44
#define ADDR_HEATEDHOSE 0x45

// GPIO that enables accessory rail
#define ACC_EN 16

struct ModuleStatus {
  bool present = false;  // detected on I2C
  bool ready = false;    // heartbeat plus a fresh, bounded telemetry frame
  float temp_C = NAN;    // on-board sensor
  float rh_percent = NAN;
  uint8_t kind = 0;       // 0 off/unknown, 1 ultrasonic, 2 water warmer
  float drive_percent = 0.0f;
  bool prewarm = false;
};

extern ModuleStatus humid, hose;

struct HumidifierControl {
  bool enabled = false;
  bool prewarm = false;
  uint8_t kind = 0;       // 0 off, 1 ultrasonic, 2 water warmer
  float targetRH = 70.0f;
  float maxTempC = 45.0f;
};

void initModules();                 // call once in setup()
bool humidifierTelemetryFresh();
bool heatedHoseTelemetryFresh();
void pollModules(const HumidifierControl& humidifier,
                 float targetTubeT  // desired hose C above ambient
);

#endif  // MODULES_H
