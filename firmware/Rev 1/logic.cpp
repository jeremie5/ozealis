//logic.cpp
#include "logic.h"
#include "setup.h"
#include "autopap.h"
#include "datalog.h"
#include "sensor.h"

SystemMode currentMode = MODE_IDLE;
FaultType currentFault = FAULT_NONE;
unsigned long modeEnteredAt = 0;
bool bemfTriggeredRecently = false;

float pressureSetpoint = 5.0;
float pressureTarget = 0.0;
float pressureMin = 90.0;
float pressureMax = 110.0;
unsigned long rampStartTime = 0;
unsigned long rampDuration = 3000;

// ----- VIN undervoltage guard -----
constexpr float VIN_TRIP_V     = 9.8f;        // fault threshold
constexpr float VIN_RECOVER_V  = 10.3f;       // must exceed to leave fault
constexpr uint16_t VIN_TRIP_MS = 200;         // debounce
static uint32_t vinLowSince = 0;

float pressureHistory[64];
uint8_t pressureIndex = 0;

ApneaEvent eventLog[MAX_EVENTS];
uint8_t eventIndex = 0;

unsigned long lastButtonCheck = 0;
bool lastButtonState = false;

std::deque<uint32_t> apneaTimes;

float getAHI() {
  uint32_t now = millis();

  // purge anything older than 60 min
  while (!apneaTimes.empty() && now - apneaTimes.front() > 3'600'000UL)
    apneaTimes.pop_front();

  // minutes actually covered (important during the first hour after boot)
  float windowMin = min(60.0f, now / 60'000.0f);
  return windowMin > 0.0f ? (apneaTimes.size() * 60.0f / windowMin) : 0.0f;
}

void logApneaEvent(float pressure) {
  if (eventIndex < MAX_EVENTS) {
    eventLog[eventIndex++] = { millis(), pressure };
  }
  apneaTimes.push_back(millis());          // NEW
  Serial.printf("Apnea event logged (AHI now %.1f)\n", getAHI());
}

static void alarmPattern(uint8_t count) {
  for (uint8_t i = 0; i < count; ++i) {
    buzz(FAULT_BUZZ_MS);
    delay(FAULT_BUZZ_MS + 40);
  }
}

void runMainLogic()
{
  handleButtonPress();

  /* ───── 0. VIN measurement & fault handling ─────────────────────── */
  float vin = vinFiltered();                 // use your filtered helper

  if (currentMode != MODE_FAULT) {           // only evaluate if healthy
    if (vin < VIN_TRIP_V) {
      if (vinLowSince == 0) vinLowSince = millis();
      if (millis() - vinLowSince > VIN_TRIP_MS)
        triggerFault(FAULT_LOW_VIN);
    } else {
      vinLowSince = 0;                       // reset timer
    }
  } else if (currentFault == FAULT_LOW_VIN && vin > VIN_RECOVER_V) {
    Serial.println("VIN recovered — exiting fault");
    enterMode(MODE_IDLE);                    // restart chain
  }

  /* ───── 1. Sensor health check ───────────────────────────────────── */
  if (!sensorsOK()) {                        // cached flag from sensor.cpp
    triggerFault(FAULT_SENSOR);
    return;                                  // blower already disabled
  }
  if (currentFault == FAULT_SENSOR && sensorsOK()) {
    Serial.println("Sensors OK again — exiting fault");
    enterMode(MODE_IDLE);
  }

  /* ───── 2. Acquire pressures safely ──────────────────────────────── */
  float pMask, pBlower;                      // hPa absolute
  readPressures(pMask, pBlower);             // always returns last-good pair
  float diff = pBlower - pMask;              // downstream − upstream  (~flow)

  /* hard shut-off on absolute over-pressure */
  if (pMask > MAX_MASK_PRESSURE_HPA) {
    triggerFault(FAULT_OVERPRESSURE);
    return;
  }

  /* ───── 3. AutoPAP control & blower drive ────────────────────────── */
  updateAutoPap(diff);                       // new one-argument version
  pressureTarget = getPressureSetpoint();    // cm ≈ hPa

  setMotorAmplitude(map(pressureTarget,4,15,0,255));

  /* ───── 4. Telemetry (BLE + DataLog) ─────────────────────────────── */
  extern ModuleStatus humidStatus, hoseStatus;

  float flow = getEstimatedFlow();           // proxy from AutoPAP
  float ahi  = getAHI();                     // whatever fn you have

  updateBLEStream(diff, flow, pressureTarget, vin, ahi,
                  humidStatus, hoseStatus);

  static uint32_t lastCsvMs = 0;
  static char     csvBuf[128];

  if (millis() - lastCsvMs >= 1000) {        // 1 Hz CSV snapshot
    snprintf(csvBuf, sizeof(csvBuf),
             "%lu,%.2f,%.2f,%.2f,%.2f,%d,%.1f,%.1f,%.1f,%.1f,%.2f,%s",
             millis(),                       // epochOffset handled elsewhere
             pressureTarget,
             pMask, pBlower,
             flow, currentMode, ahi,
             humidStatus.temp_C, humidStatus.rh_percent,
             hoseStatus.temp_C, vin,
             "");

    char_liveCsv->setValue(csvBuf);
    char_liveCsv->notify();
    dl_push(csvBuf);                         // add to ring buffer
    lastCsvMs = millis();
  }

  /* ───── 5. House-keeping ─────────────────────────────────────────── */
  if (millis() - bleStartTime > BLE_TIMEOUT) {
    BLEDevice::getAdvertising()->stop();
    bleActive = false;
  }

  /* ───── 6. Breath / apnea detection ──────────────────── */
  static float  diffLP       = 0.0f;
  static bool   lastSign     = false;
  static uint32_t lastInhaleMs = 0, lastLogged = 0;

  diffLP = diffLP * 0.8f + diff * 0.2f;          // τ ≈ 250 ms
  bool signNow = diffLP >= 0;
  if (signNow && !lastSign) lastInhaleMs = millis();
  lastSign = signNow;

  if (millis() - lastInhaleMs > 10'000UL &&
      millis() - lastLogged   > 10'000UL) {
    logApneaEvent(diffLP);
    sendBLEEvent("APNEA");
    lastLogged = millis();
  }
}


void enterMode(SystemMode newMode) {
  currentMode = newMode;
  modeEnteredAt = millis();
  Serial.printf("Entering mode: %d\n", currentMode);
  switch (newMode) {
    case MODE_IDLE:
      setLED(0, 0, 255);
      break;
    case MODE_STARTUP:
      setLED(255, 255, 0);
      forcedStartMotor();
      enterMode(MODE_RUNNING);
      break;
    case MODE_RUNNING:
      setLED(0, 255, 0);
      rampStartTime = millis();
      break;
    case MODE_SHUTDOWN:
      setLED(255, 150, 0);
      digitalWrite(MOT_EN, LOW);
      delay(1000);
      enterMode(MODE_IDLE);
      break;
	case MODE_FAULT:
	  setLED(255, 0, 0);
	  digitalWrite(MOT_EN, LOW);
	  updateMotorPWM(0);
	  break;
  }
}

void triggerFault(FaultType fault) {
  if (currentMode != MODE_FAULT) {
    currentFault = fault;
    switch (fault) {
      case FAULT_LOW_VIN:
        Serial.println("FAULT: VIN too low");
        alarmPattern(2);
        break;
      case FAULT_BEMF_TIMEOUT:
        Serial.println("FAULT: BEMF timeout");
        alarmPattern(3);
        break;
      case FAULT_OVERPRESSURE:
        Serial.println("FAULT: Over-pressure");
        alarmPattern(5);
        break;
	case FAULT_SENSOR:
		Serial.println("FAULT: Pressure sensor failure");
		alarmPattern(6);
		break;
      default:
        Serial.println("FAULT: Unknown");
        alarmPattern(1);
        break;
    }
    enterMode(MODE_FAULT);
  }
}

void handleButtonPress() {
  static unsigned long lastDebounceTime = 0;
  static unsigned long lastPressTime = 0;
  static bool lastButtonState = HIGH;
  static uint8_t shortPressCount = 0;
  static bool longPressHandled = false;
  bool currentState = digitalRead(BTN_SIG);
  // Debounce logic
  if (currentState != lastButtonState) {
    lastDebounceTime = millis();
  }
  if ((millis() - lastDebounceTime) > 30) {
    // Button is pressed
    if (currentState == LOW && lastButtonState == HIGH) {
      lastPressTime = millis();
      longPressHandled = false;
    }
    // Button held
    if (currentState == LOW && !longPressHandled && millis() - lastPressTime > 800) {
      longPressHandled = true;
      // Toggle between modes
      if (currentMode == MODE_IDLE) {
        enterMode(MODE_STARTUP);
      } else if (currentMode == MODE_RUNNING) {
        enterMode(MODE_SHUTDOWN);
      }
    }
    // Button released quickly
    if (currentState == HIGH && lastButtonState == LOW) {
      if (!longPressHandled) {
        shortPressCount++;
        // Reset short press count after timeout
        static unsigned long lastShortPress = 0;
        if (millis() - lastShortPress > 800) {
          shortPressCount = 1;
        }
        lastShortPress = millis();
        if (shortPressCount == 3) {
          shortPressCount = 0;
          if (!bleActive) {
            startBLE();  // Enter Bluetooth pairing mode
          } else {
            Serial.println("BLE already active");
          }
        }
      }
    }
  }
  lastButtonState = currentState;
}

