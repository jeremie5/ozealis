#ifndef AUTOPAP_H
#define AUTOPAP_H

#include <Arduino.h>

// ─── controller tuning (all cm H₂O unless noted) ───────────────────────
constexpr float APNEA_RISE_CM       = 1.0;
constexpr float HYPO_RISE_CM        = 0.4;
constexpr float DECAY_STEP_CM       = 0.2;
constexpr uint32_t DECAY_AFTER_MS   = 10UL * 60UL * 1000UL;   // 10 min
constexpr uint32_t MAX_RISE_RATE_MS = 60UL * 1000UL;          // 1 min
constexpr uint32_t APNEA_TIMEOUT_MS = 10UL * 1000UL;          // ≥10 s
constexpr float FLOW_LIMIT_RATIO    = 0.60;                   // <60 % = flow-lim

// ─── Therapy modes ─────────────────────────────────────────────────────
enum TherapyMode : uint8_t {
  MODE_CpapAuto = 0,
  MODE_BiPapAuto
};

// ─── API ────────────────────────────────────────────────────────────────
void  setupAutoPap();
void  updateAutoPap(float diff_hPa);
float getPressureSetpoint();   // returns cm H₂O (IPAP or EPAP depending on phase)
float getEstimatedFlow();      // diff_hPa proxy (≈ cm H₂O)
void  logFlowState();

// accessors you might call from BLE menu
void  setTherapyMode(TherapyMode m);
TherapyMode getTherapyMode();
void  setDeltaCm(float d);
float getDeltaCm();

#endif
