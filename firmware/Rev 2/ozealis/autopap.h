// autopap.h
#ifndef AUTOPAP_H
#define AUTOPAP_H

#include <Arduino.h>
#include "motor.h"   // setMotorAmplitude()
#include "sensor.h"  // readPressures()

// User-configurable limits passed in at boot.
struct PapLimits {
  float pMin;         // cmH2O lower bound
  float pMax;         // cmH2O upper bound
  float delta;        // cmH2O IPAP-EPAP gap (BiPAP / ASV)
  uint16_t rampSecs;  // seconds, CPAP ramp duration
  bool autoStart;     // flow-triggered start
  bool autoStop;      // flow-triggered stop
  uint8_t epr;        // 0-3 cm automatic pressure relief
  float backupRateBpm;// timed-bilevel backup interval, breaths/min
  uint16_t inspTimeMs;// timed-bilevel IPAP window duration
};

enum TherapyMode : uint8_t {
  MODE_CPAP = 0,      // fixed EPAP with optional EPR
  MODE_AUTOPAP,       // auto pressure range using current experimental controller
  MODE_BIPAP_S,       // spontaneous bilevel pressure-target placeholder
  MODE_BIPAP_ST,      // spontaneous/timed bilevel target with experimental backup timing
  MODE_BIPAP_T,       // timed bilevel target with experimental backup timing
  MODE_ASV,           // servo-ventilation mode identifier; servo algorithm not implemented
  MODE_AUTO_ASV,      // auto servo mode identifier; auto servo algorithm not implemented
  MODE_AUTO_BIPAP,    // auto bilevel/VAuto identifier; auto bilevel algorithm not implemented
  MODE_BIPAP_PC,      // pressure-control bilevel identifier; experimental timed target only
  MODE_VAPS           // volume-assured pressure-support identifier; volume target not implemented
};

// API
void papBegin(const PapLimits &cfg);
void papSetLimits(const PapLimits &cfg);
void papStartSession();
void papStopSession();
bool papSessionActive();
void papLoop();  // call every 50 ms
TherapyMode papGetMode();
void papSetMode(TherapyMode m);

float papGetSetpointCm();  // current target (cmH2O)
float papGetFlowProxy();   // latest delta-P (hPa)
float papGetMeasuredCm();
float papGetPressureErrorCm();
uint8_t papGetCommandedAmp();

#endif
