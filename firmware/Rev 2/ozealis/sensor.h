// sensor.h
#ifndef SENSOR_H
#define SENSOR_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_LPS2X.h>
#include <Adafruit_AHTX0.h>

// I2C pins
#define IIC_SDA 21
#define IIC_SCL 22

// VIN monitor
#define VIN_SEN 35
#define VIN_DIVIDER_RATIO 11.0f

// Global sensor objects
extern Adafruit_LPS22 lps1;   // upstream mask side
extern Adafruit_LPS22 lps2;   // downstream blower side
extern Adafruit_AHTX0 aht;

// Setup
void setupSensors();  // call once in setup()

// VIN
float readVIN();       // instantaneous VIN in volts
float vinFiltered();   // low pass filtered VIN

// Pressure IO
bool  readPressures(float &pMask_hPa, float &pBlower_hPa);  // per call read
bool  sensorsOK();                                         // debounced health
float getPressureDiff();                                   // blower − mask hPa
float getPressureDiffCached();                             // cached diff hPa

// Ambient estimate and gauge helpers
float sensorAmbient_hPa();                                 // current ambient estimate
void  sensorUpdateAmbientEstimate(float pMask_hPa, float diff_hPa); // call each loop

// Unit conversion helpers
float cmH2O_to_hPa(float cm);
float hPa_to_cmH2O(float hPa);

// Diagnostics taps
void sensorDiagGet(uint16_t& miss1, uint16_t& miss2, int8_t& err1, int8_t& err2);

#endif  // SENSOR_H
