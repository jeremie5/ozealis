// logic.h
#ifndef LOGIC_H
#define LOGIC_H

#include <Arduino.h>
#include <deque>
#include "buzzer.h"
#include "button.h"
#include "led.h"
#include "ble.h"
#include "pressure_limits.h"

// System-level machine states (NOT therapy)
enum SystemMode : uint8_t {
  MODE_IDLE = 0,
  MODE_STARTUP,
  MODE_RUNNING,
  MODE_SHUTDOWN,
  MODE_FAULT
};

// Fault codes
enum FaultType : uint8_t {
  FAULT_NONE = 0,
  FAULT_LOW_VIN,
  FAULT_SENSOR,
  FAULT_OVERPRESSURE,
  FAULT_IO
};

// Limits and constants
constexpr uint32_t BLE_TIMEOUT_MS = 30000;      // 30 s

// BLE callbacks run on the Bluetooth task while loop() owns the machine state,
// sensors, motor driver, and shared Wire bus. This recursive guard provides one
// serialization boundary for those cross-task control paths.
void systemControlInit();
void systemControlLock();
void systemControlUnlock();

class SystemControlGuard {
 public:
  SystemControlGuard() { systemControlLock(); }
  ~SystemControlGuard() { systemControlUnlock(); }
  SystemControlGuard(const SystemControlGuard&) = delete;
  SystemControlGuard& operator=(const SystemControlGuard&) = delete;
};

// Globals exposed to other units
extern SystemMode currentMode;
extern FaultType currentFault;

// API
void runMainLogic();             // call every 50 ms in loop()
void enterMode(SystemMode m);    // state machine jump
void refreshSystemStatusLed();   // request mode-color restore on the main loop
void triggerFault(FaultType f);  // raises fault and enters MODE_FAULT
bool humidifierPrewarmStart();
void humidifierPrewarmStop();
bool humidifierPrewarmActive();

const char* modeName(SystemMode m);
const char* faultName(FaultType f);
extern FaultType lastFault;

#endif  // LOGIC_H
