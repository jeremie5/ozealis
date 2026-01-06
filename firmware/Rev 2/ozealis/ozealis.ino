// ozealis.ino

/***********************************************************************
*  Ozealis™
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
#include <esp32-hal-ledc.h>
#include <esp_task_wdt.h>
#include <WiFi.h>

void setup() {
  ESP_ERROR_CHECK(esp_task_wdt_add(nullptr));
  Serial.begin(115200);
  Serial.println("Ozealis - Booting");
  delay(200);
  loadSettings();
  otaSecure_begin();
  setupLED();
  setupBuzzer();
  setupButton();
  setupSensors();
  MotorProfile tune;
  setupMotor(tune);
  initModules();
  PapLimits limits = { 4.0f, 15.0f, 4.0f, 300, true, true, 3 };  // pMin, pMax, Δ, ramp, autoStart, autoStop, EPR
  papBegin(limits);
  dl_init();
  pinMode(ACC_EN, OUTPUT);
  digitalWrite(ACC_EN, LOW);
  buzz(100);
  setLED(255, 0, 255);
}

void loop() {
  esp_task_wdt_reset();
  runMainLogic();
  pollButton();
  ledPairingWaveService();
  motorDebugService();
  static uint32_t lastLog = 0;
  uint32_t now = millis();
  if (now - lastLog >= 2000) {
    lastLog = now;
    float setpoint = papGetSetpointCm();
    float flow = papGetFlowProxy();
    float vin = vinFiltered();
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
  delay(50);
}
