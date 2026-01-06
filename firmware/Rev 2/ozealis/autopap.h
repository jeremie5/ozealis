//autopap.h
#ifndef AUTOPAP_H
#define AUTOPAP_H

#include <Arduino.h>
#include "motor.h"   // setMotorAmplitude()
#include "sensor.h"  // readPressures()

// ─── user‑configurable limits passed in at boot ──────────────
struct PapLimits {
  float pMin;         // cmH₂O  lower bound
  float pMax;         // cmH₂O  upper bound
  float delta;        // cmH₂O  IPAP‑EPAP gap (BiPAP / ASV)
  uint16_t rampSecs;  // seconds   CPAP ramp duration
  bool autoStart;     // flow‑triggered start
  bool autoStop;      // flow‑triggered stop
  uint8_t epr;        // 0‑3 cm automatic pressure relief
};

enum TherapyMode : uint8_t {
  MODE_CPAP = 0,  // fixed EPAP with optional EPR
  MODE_BIPAP,
  MODE_ASV
};

// ─────────── API ───────────
void papBegin(const PapLimits &cfg);
void papLoop();  // call every 50 ms
TherapyMode papGetMode();
void papSetMode(TherapyMode m);

float papGetSetpointCm();  // current target (cmH₂O)
float papGetFlowProxy();   // latest ΔP (hPa)

#endif
