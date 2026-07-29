#include "button.h"
#include "logic.h"           // enterMode()
#include "ble.h"             // BLE advertising globals
#include "led.h"
#include "buzzer.h"
#include "motor.h"
#include "motor_calibration.h"
#include "ota_secure.h"
#include <Preferences.h>

#ifndef OZEALIS_BUTTON_SERIAL_LOG
#define OZEALIS_BUTTON_SERIAL_LOG 0
#endif

#if OZEALIS_BUTTON_SERIAL_LOG
#define BUTTON_LOG(message) Serial.println(message)
#else
#define BUTTON_LOG(message) do { } while (0)
#endif

static constexpr uint8_t BTN_PIN = BTN_SIG;
static constexpr uint32_t DEBOUNCE_MS = 30;
static constexpr uint32_t SHORT_PRESS_MAX_MS = 800;
static constexpr uint32_t LONG_PRESS_MS = 15000;
static constexpr uint32_t MULTI_WINDOW_MS = 600;

static bool lastLevel = HIGH;
static uint32_t lastEdgeMs = 0;
static uint32_t pressStartMs = 0;
static uint8_t shortPressCnt = 0;
static uint32_t lastReleaseMs = 0;

void setupButton() {
  pinMode(BTN_PIN, INPUT);  // active-low
}

static void actionShort() {
  BUTTON_LOG("Button: Short clicked");
  if (motorCalIsWaterActive()) {
    if (motorCalCapturePoint()) {
      BUTTON_LOG("Button: water calibration point captured");
    }
    sendBLEEvent("BUTTON_CAL_CAPTURE");
    return;
  }

  if (motorCalIsActive()) {
    BUTTON_LOG("Button: cal stop");
    motorCalAbort();
    enterMode(MODE_SHUTDOWN);
    sendBLEEvent("BUTTON_CAL_STOP");
    return;
  }

  if (currentMode == MODE_RUNNING || currentMode == MODE_STARTUP) {
    BUTTON_LOG("Button: Triggering shutdown mode");
    enterMode(MODE_SHUTDOWN);
    sendBLEEvent("BUTTON_STOP");
  } else if (currentMode == MODE_IDLE) {
    if (otaSecure_inProgress()) {
      BUTTON_LOG("Button: start ignored during OTA");
      sendBLEEvent("BUTTON_START_IGNORED_OTA");
      return;
    }
    if (currentFault != FAULT_NONE) {
      BUTTON_LOG("Button: start ignored while fault is latched");
      sendBLEEvent("BUTTON_START_IGNORED_FAULT");
      return;
    }
    if (!motorDriverReady()) {
      BUTTON_LOG("Button: start rejected, motor driver not ready");
      triggerFault(FAULT_IO);
      return;
    }
    BUTTON_LOG("Button: Triggering startup mode");
    enterMode(MODE_STARTUP);
    sendBLEEvent("BUTTON_START");
  } else {
    BUTTON_LOG("Button: short ignored");
  }
}

static void actionLong() {
  BUTTON_LOG("Button: Long click");
  if (currentMode != MODE_IDLE || motorCalIsActive() || otaSecure_inProgress()) {
    BUTTON_LOG("Button: long ignored");
    return;
  }

  // Five red blinks, then NVS erase and reboot.
  for (int i = 0; i < 5; ++i) {
    setLED(255, 0, 0);
    delay(150);
    setLED(0, 0, 0);
    delay(150);
  }

  Preferences p;
  p.begin("cpap", false);
  p.clear();
  p.end();
  esp_restart();
}

static void actionTriple() {
  BUTTON_LOG("Button: Triple clicked");
  if (currentMode != MODE_IDLE || motorCalIsActive() || otaSecure_inProgress()) {
    BUTTON_LOG("Button: pairing ignored");
    return;
  }

  enterMode(MODE_IDLE);
  sendBLEEvent("BUTTON_PAIR");
  ledTogglePairingWave(true);
  ensureBleAdvertising();
}

void pollButton() {
  const uint32_t now = millis();
  const bool level = digitalRead(BTN_PIN);  // HIGH = released, LOW = pressed

  if (level != lastLevel && now - lastEdgeMs > DEBOUNCE_MS) {
    lastEdgeMs = now;
    lastLevel = level;

    if (level == LOW) {
      pressStartMs = now;
    } else {
      const uint32_t dur = now - pressStartMs;
      if (dur <= SHORT_PRESS_MAX_MS) {
        shortPressCnt++;
        lastReleaseMs = now;
      }
    }
  }

  if (level == LOW && (now - pressStartMs) >= LONG_PRESS_MS) {
    actionLong();
    lastLevel = HIGH;
    shortPressCnt = 0;
    return;
  }

  if (shortPressCnt && (now - lastReleaseMs) > MULTI_WINDOW_MS) {
    switch (shortPressCnt) {
      case 1: actionShort(); break;
      case 3: actionTriple(); break;
      default: break;
    }
    shortPressCnt = 0;
  }
}
