// ozealis.ino

/***********************************************************************
*  Ozealis
*  NOT APPROVED FOR MEDICAL USE. AS-IS, NO WARRANTIES.
*  See README and LICENSE for full legal terms.
***********************************************************************/
#include <string>
#include "led.h"
#include "button.h"
#include "buzzer.h"
#include "motor.h"
#include "ble.h"
#include "autopap.h"
#include "ota_secure.h"
#include "sensor.h"
#include "logic.h"
#include "modules.h"
#include "datalog.h"
#include "motor_calibration.h"
#include "oximetry.h"
#include <esp32-hal-ledc.h>
#include <esp_task_wdt.h>
#include <WiFi.h>

#ifndef OZEALIS_SERIAL_STATUS_LOG
#define OZEALIS_SERIAL_STATUS_LOG 0
#endif

#if OZEALIS_SERIAL_STATUS_LOG
static void logSerialStatus() {
  const float setpoint = papGetSetpointCm();
  const float flow = papGetFlowProxy();
  const float vin = vinFiltered();
  Serial.print("State: mode=");
  Serial.print(modeName(currentMode));
  Serial.print(" fault=");
  Serial.print(faultName(currentFault));
  Serial.print(" last_fault=");
  Serial.print(faultName(lastFault));
  Serial.print(" setpoint_cm=");
  Serial.print(setpoint, 2);
  Serial.print(" flow_proxy=");
  Serial.print(flow, 2);
  Serial.print(" vin=");
  Serial.print(vin, 2);
  Serial.println(" V");
  motorDumpPins();
}
#endif

void setup() {
  ESP_ERROR_CHECK(esp_task_wdt_add(nullptr));
  Serial.begin(115200);
#if OZEALIS_SERIAL_STATUS_LOG
  Serial.println("Ozealis - Booting");
#endif
  delay(200);
  systemControlInit();
  loadSettings();
  dl_init();
  otaSecure_begin();
  setupLED();
  setupBuzzer();
  setupButton();
  setupSensors();
  motorCalLoad();
  oximetryInit();
  MotorProfile tune;
  setupMotor(tune);
  initModules();
  papBegin(settingsToPapLimits());
  papSetMode(settings.mode);
  startBLE();
  pinMode(ACC_EN, OUTPUT);
  digitalWrite(ACC_EN, LOW);
  buzz(100);
  setLED(255, 0, 255);
}

void loop() {
  esp_task_wdt_reset();
  {
    SystemControlGuard controlGuard;
    runMainLogic();
    pollButton();
    ledPairingWaveService();
#if OZEALIS_SERIAL_STATUS_LOG
    static uint32_t lastLog = 0;
    uint32_t now = millis();
    if (now - lastLog >= 2000) {
      lastLog = now;
      logSerialStatus();
    }
#endif
  }
  delay(50);
}
