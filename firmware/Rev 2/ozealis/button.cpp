#include "button.h"
#include "logic.h"           // enterMode()
#include "ble.h"             // BLE advertising globals
#include "led.h"
#include "buzzer.h"
#include <Preferences.h>

static constexpr uint8_t  BTN_PIN              = BTN_SIG;     // alias
static constexpr uint32_t DEBOUNCE_MS          = 30;
static constexpr uint32_t SHORT_PRESS_MAX_MS   = 800;
static constexpr uint32_t LONG_PRESS_MS        = 15'000;
static constexpr uint32_t MULTI_WINDOW_MS      = 600;

static bool       lastLevel      = HIGH;
static uint32_t   lastEdgeMs     = 0;
static uint32_t   pressStartMs   = 0;
static uint8_t    shortPressCnt  = 0;
static uint32_t   lastReleaseMs  = 0;

// ────────────────────────────────────────────────────────────
void setupButton() {
  pinMode(BTN_PIN, INPUT);   // active‑LOW
}

// ----‑‑ helpers ------------------------------------------------------
static void actionShort() {
  Serial.println("Button: Short clicked");
  if (currentMode == MODE_RUNNING || currentMode == MODE_STARTUP) {
    Serial.println("Button: Triggering shutdown mode");
    enterMode(MODE_SHUTDOWN);     // stop
  } else {
    Serial.println("Button: Triggering startup mode");
    enterMode(MODE_STARTUP);      // start
  }
}

static void actionLong() {
  Serial.println("Button: Long click");
  // five red blinks then NVS erase + reboot
  for (int i = 0; i < 5; ++i) { setLED(255,0,0); delay(150); setLED(0,0,0); delay(150); }

  Preferences p;
  p.begin("cpap", false);
  p.clear();
  p.end();
  esp_restart();
}

static void actionTriple() {
  Serial.println("Button: Triple clicked");
  enterMode(MODE_IDLE); // ensure we’re in idle before pairing
  ledTogglePairingWave(true);
  ensureBleAdvertising();
}

// ────────────────────────────────────────────────────────────
void pollButton() {
  uint32_t now   = millis();
  bool     level = digitalRead(BTN_PIN);   // HIGH = released, LOW = pressed

  // debounced edge?
  if (level != lastLevel && now - lastEdgeMs > DEBOUNCE_MS) {
    lastEdgeMs = now;
    lastLevel  = level;

    if (level == LOW) {                // pressed
      pressStartMs = now;
    } else {                           // released
      uint32_t dur = now - pressStartMs;
      if (dur <= SHORT_PRESS_MAX_MS) { // candidate short press
        shortPressCnt++;
        lastReleaseMs = now;
      }
    }
  }

  // long‑press detection (while still held)
  if (level == LOW && (now - pressStartMs) >= LONG_PRESS_MS) {
    actionLong();
    // defensive reset of state machine
    lastLevel = HIGH;
    shortPressCnt = 0;
    return;
  }

  // multi‑press timer expiry
  if (shortPressCnt && (now - lastReleaseMs) > MULTI_WINDOW_MS) {
    switch (shortPressCnt) {
      case 1: actionShort();  break;
      case 3: actionTriple(); break;
      default: /* ignore */   break;
    }
    shortPressCnt = 0;
  }
}
