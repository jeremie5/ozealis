//autopap.cpp
#include "autopap.h"

// ----------------‑private state‑----------------
static PapLimits limits;  // copy of user config
static TherapyMode mode = MODE_CPAP;

static float epap_cm = 5.0f;    // current expiratory target
static float ipap_cm = 9.0f;    // current inspiratory target
static float flowProxy = 0.0f;  // latest ΔP (hPa)
static uint32_t rampStart = 0;
static bool blowerOn = false;

// simple helper
static inline uint8_t cm2duty(float cm) {
  return constrain((uint8_t)(cm * 16), 0, 255);
}

// ------------------------------------------------
void papBegin(const PapLimits &cfg) {
  limits = cfg;
  epap_cm = limits.pMin;
  ipap_cm = epap_cm + limits.delta;
  rampStart = millis();
  blowerOn = false;
}

// ------------------------------------------------
TherapyMode papGetMode() {
  return mode;
}
void papSetMode(TherapyMode m) {
  mode = m;
}

float papGetSetpointCm() {
  return (mode == MODE_BIPAP || mode == MODE_ASV) ?  // dual‑level
           (flowProxy >= 0 ? ipap_cm : epap_cm)
                                                  :  // insp / exp
           epap_cm;                                  // CPAP
}

float papGetFlowProxy() {
  return flowProxy;
}

// ------------------------------------------------
static void applyBlower(float targetCm) {
  setMotorAmplitude(cm2duty(targetCm));
}

// ------------------------------------------------
void papLoop() {
  /* 1. Acquire pressures → flow proxy */
  float pMask, pBlower;
  if (!readPressures(pMask, pBlower)) return;  // fall‑back handled inside
  flowProxy = pBlower - pMask;                 // hPa  (+ve = insp)

  /* 2. Auto‑Start / Auto‑Stop */
  if (!blowerOn && limits.autoStart && abs(flowProxy) > 0.8f) {
    restartMotor();
    blowerOn = true;
    rampStart = millis();
  }
  if (blowerOn && limits.autoStop && abs(flowProxy) < 0.3f && (millis() - rampStart) > 5000) {
    setMotorAmplitude(0);
    blowerOn = false;
  }
  if (!blowerOn) return;

  /* 3. Ramp‑Up (CPAP only) */
  if (mode == MODE_CPAP) {
    uint32_t t = millis() - rampStart;
    float frac = limits.rampSecs ? min(1.0f, t / (limits.rampSecs * 1000.0f)) : 1.0f;
    epap_cm = limits.pMin + frac * (limits.pMax - limits.pMin);
  }

  /* 4. EPAP / IPAP adjustment by mode */
  switch (mode) {
    case MODE_CPAP:
      // optional EPR during expiration
      ipap_cm = epap_cm;
      if (flowProxy < 0 && limits.epr > 0) epap_cm = max(limits.pMin,
                                                         epap_cm - limits.epr);
      break;

    case MODE_BIPAP:
      // naive flow‑lim / apnea logic (placeholder)
      ipap_cm = constrain(epap_cm + limits.delta, limits.pMin,
                          limits.pMax);
      break;

    case MODE_ASV:
      // simplified ASV: boost IPAP if minute‑vent < 85 %
      // (real ASV needs running MV average — omitted for brevity)
      ipap_cm = constrain(epap_cm + limits.delta, limits.pMin,
                          limits.pMax + limits.delta);
      break;
  }

  /* 5. Drive blower */
  applyBlower(papGetSetpointCm());
}
