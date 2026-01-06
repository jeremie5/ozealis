// diag.h
#ifndef DIAG_H
#define DIAG_H

#include <Arduino.h>
#include <CircularBuffer.hpp>

// Keep this small so it is cheap to copy and push. Adjust as needed.
struct FaultSnapshot {
  uint32_t ts_ms;          // millis at capture
  uint8_t  sys_mode;       // SystemMode
  uint8_t  fault_code;     // FaultType
  float    vin_V;          // filtered VIN
  float    pMask_hPa;      // mask absolute
  float    pBlower_hPa;    // blower absolute
  float    ambient_hPa;    // ambient estimate if available
  float    diff_hPa;       // blower - mask
  float    setpoint_cm;    // pap setpoint at time of fault
  float    flowProxy_hPa;  // pap flow proxy
  uint8_t  motorAmp;       // PWM amplitude 0..255
  uint16_t loop_us;        // last loop time
  // Sensor-level diagnostics
  uint16_t miss1;          // consecutive misses sensor1
  uint16_t miss2;          // consecutive misses sensor2
  int8_t   i2cErr1;        // last Wire err sensor1
  int8_t   i2cErr2;        // last Wire err sensor2
};

void diag_init();                                    // call in setup
void diag_note_loop_us(uint16_t loop_us);            // call once per loop
void diag_capture_fault(const FaultSnapshot& s);     // call inside triggerFault
String diag_fault_csv();                             // read-only CSV
void diag_clear_faults();                            // clear buffer

// Sensor-layer taps - implemented in sensor.cpp
void sensorDiagGet(uint16_t& miss1, uint16_t& miss2, int8_t& err1, int8_t& err2);
float sensorAmbient_hPa();                           // already added earlier

#endif  // DIAG_H
