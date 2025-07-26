// modules.h – hot‑plug accessory bus (humidifier & heated hose)
#ifndef MODULES_H
#define MODULES_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_AHTX0.h>

// I2C accessory addresses (reserved range)
#define ADDR_HUMIDIFIER 0x44  // example, AHT‑based
#define ADDR_HEATEDHOSE 0x45

// GPIO that enables accessory rail
#define ACC_EN 16

struct ModuleStatus {
  bool present = false;  // detected on I²C
  bool ready = false;    // replied to heartbeat
  float temp_C = NAN;    // on‑board sensor
  float rh_percent = NAN;
};

extern ModuleStatus humid, hose;

void initModules();                 // call once in setup()
void pollModules(float targetRH,    // call from loop(): desired RH (%)
                 float targetTubeT  // desired hose °C above ambient
);

#endif  // MODULES_H
