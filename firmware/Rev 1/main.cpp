// main.cpp

/***********************************************************************
*  Ozealis™
*  NOT APPROVED FOR MEDICAL USE.  AS-IS, NO WARRANTIES.
*  See README and LICENSE for full legal terms.
***********************************************************************/
#include "setup.h"
#include "motor.h"
#include "ble.h"
#include "ota.h"
#include "ota_secure.h"
#include "sensor.h"
#include "logic.h"
#include "modules.h"
#include "datalog.h"

void setup() {
  esp_task_wdt_init(5, true); 
  esp_task_wdt_add(NULL);
	
  Serial.begin(115200);
  delay(200);
  
  loadSettings();
  otaSecure_begin();
  setupLED();
  setupButtonBuzzer();
  setupSensors();
  setupMotor();
  initModules();
  setupAutoPap();
	dl_init();

  WiFi.begin("YOUR_SSID", "YOUR_PASS");
  while (WiFi.status() != WL_CONNECTED) delay(100);
  setupOTA();   // after Wi-Fi is up
  
  ledcSetup(motorPwmChannel, motorPwmFreq, motorPwmResolution);
  ledcAttachPin(MOT_SIG_U, motorPwmChannel);

  pinMode(ACC_EN, OUTPUT);
  digitalWrite(ACC_EN, LOW);

  setLED(0, 0, 255);
  buzz(100);
}

void loop() {
  esp_task_wdt_reset();
  // ── Fast control (e.g. every 5 ms) ──
  float diff_hPa = readFlowDiff(); 
  updateAutoPap(diff_hPa);

  float pTarget = getPressureSetpoint(); // cm H₂O
  blowerPID.update(pTarget);

  runMainLogic();
  handleOTA();  // keep OTA alive
  delay(50);
}