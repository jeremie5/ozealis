//logic.h
#ifndef LOGIC_H
#define LOGIC_H

#include <Arduino.h>
#include <deque>
#include "buzzer.h"
#include "button.h"
#include "led.h"
#include "ble.h"

// ───── System‑level machine states (NOT therapy) ────────────
enum SystemMode : uint8_t {
  MODE_IDLE = 0,
  MODE_STARTUP,
  MODE_RUNNING,
  MODE_SHUTDOWN,
  MODE_FAULT
};

// ───── Fault codes ──────────────────────────────────────────
enum FaultType : uint8_t {
  FAULT_NONE = 0,
  FAULT_LOW_VIN,
  FAULT_SENSOR,
  FAULT_OVERPRESSURE
};

// ───── Limits & constants ───────────────────────────────────
constexpr uint32_t BLE_TIMEOUT_MS = 30'000;     // 30 s
constexpr float MAX_MASK_PRESSURE_HPA = 30.0f;  // ≈12 cm H₂O

// ───── Globals exposed to other units ───────────────────────
extern SystemMode currentMode;
extern FaultType currentFault;

// ───── API ─────────────────────────────────────────────────
void runMainLogic();             // call every 50 ms in loop()
void enterMode(SystemMode m);    // state machine jump
void triggerFault(FaultType f);  // raises fault & enters MODE_FAULT

#endif  // LOGIC_H