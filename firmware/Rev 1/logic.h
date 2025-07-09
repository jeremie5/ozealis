//logic.h
#ifndef LOGIC_H
#define LOGIC_H

#include <Arduino.h>
#include "motor.h"
#include "ble.h"
#include "sensor.h"
#include <deque>

enum SystemMode {
  MODE_IDLE,
  MODE_STARTUP,
  MODE_RUNNING,
  MODE_SHUTDOWN,
  MODE_FAULT
};

enum FaultType {
  FAULT_NONE,
  FAULT_LOW_VIN,
  FAULT_BEMF_TIMEOUT,
  FAULT_OVERPRESSURE,
  FAULT_OVERVOLT,
  FAULT_SENSOR
};

// ── safety thresholds ──────────────────────────
constexpr float MAX_MASK_PRESSURE_HPA = 30.0f;   // ≈ 12 cm H₂O
constexpr uint32_t FAULT_BUZZ_MS      = 80;      // beep length

struct ApneaEvent {
  uint32_t timestamp_ms;
  float pressure_before;
};

#define MAX_EVENTS 64

//--------------------------------------------------------------------
// Rolling window for apnea events (timestamps in ms since boot)
extern std::deque<uint32_t> apneaTimes;

/** return AHI (events / hour) over the preceding 60 min */
float getAHI();

// === External variables ===
extern SystemMode currentMode;
extern FaultType currentFault;
extern unsigned long modeEnteredAt;
extern bool bemfTriggeredRecently;
extern float pressureSetpoint;
extern float pressureTarget;
extern float pressureMin;
extern float pressureMax;
extern unsigned long rampStartTime;
extern unsigned long rampDuration;
extern float pressureHistory[];
extern uint8_t pressureIndex;
extern ApneaEvent eventLog[MAX_EVENTS];
extern uint8_t eventIndex;

// === Function declarations ===
void runMainLogic();
void enterMode(SystemMode newMode);
void triggerFault(FaultType fault);
void logApneaEvent(float pressure);
void handleButtonPress();

#endif // LOGIC_H
