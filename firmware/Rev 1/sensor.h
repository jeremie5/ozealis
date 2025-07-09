// sensor.h
#ifndef SENSOR_H
#define SENSOR_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_LPS2X.h>
#include <Adafruit_AHTX0.h>

// I²C pins (ESP32‑S3 default)
#define IIC_SDA 21
#define IIC_SCL 22

// VIN monitor divider
#define VIN_SEN 35
#define VIN_DIVIDER_RATIO 11.0

// --- Global sensor objects declared here, defined in sensor.cpp ---
extern Adafruit_LPS22 lps1;   // upstream / mask side
extern Adafruit_LPS22 lps2;   // downstream / blower side
extern Adafruit_AHTX0  aht;

// --- Setup and helpers ---
void setupSensors();                  // call once in setup()
float readVIN();                       // returns input voltage (V)
float getPressureDiff();               // ΔP = lps2 – lps1  (hPa)
/** Low-pass–filtered VIN (τ≈300 ms). Call once per loop. */
float vinFiltered();

bool readPressures(float &pMask_hPa, float &pBlower_hPa);   // false → bad read
bool sensorsOK();                                           // true while healthy

#endif // SENSOR_H
