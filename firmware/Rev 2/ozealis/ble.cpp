//ble.cpp
#include "diag.h"
#include "modules.h"
#include "ble.h"
#include "logic.h"  // currentMode / epochOffset / eventFlag
#include <Preferences.h>
#include "datalog.h"
#include "ota_secure.h"
#include <Arduino.h>
#include <driver/ledc.h>   // pour ledcSetup, ledcAttachPin, etc.
#include <esp_task_wdt.h>  // pour esp_task_wdt_*()
#include <WiFi.h>          // pour WiFi.begin(), etc.
#include <ArduinoJson.h>
#include <string.h>  // for strncpy / snprintf

// ==== Global objects ====
BLEServer* bleServer = nullptr;

BLECharacteristic *char_pressure = nullptr, *char_vin = nullptr,
                  *char_mode = nullptr, *char_flow = nullptr,
                  *char_setpoint = nullptr, *char_settings = nullptr,
                  *char_humTemp = nullptr, *char_humRH = nullptr,
                  *char_hoseTemp = nullptr, *char_modStat = nullptr,
                  *char_ahi = nullptr, *char_liveCsv = nullptr,
                  *char_logDl = nullptr, *char_otaCmd = nullptr,
                  *char_otaSt = nullptr;
BLECharacteristic* char_faultCsv = nullptr;


bool bleConnected = false;
bool bleActive = false;
unsigned long bleStartTime = 0;

CPAPSettings settings;  // live copy
Preferences prefs;      // NVS namespace "cpap"

class FaultLogReadCallback : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* c) override {
    c->setValue(diag_fault_csv().c_str());
  }
};

// ================== Settings R/W =================
void loadSettings() {
  prefs.begin("cpap", true);
  settings.pMin = prefs.getFloat("pMin", 4.0f);
  settings.pMax = prefs.getFloat("pMax", 15.0f);
  settings.autoPap = prefs.getBool("auto", true);
  settings.rampSecs = prefs.getFloat("ramp", 300.0f);
  settings.mode = (TherapyMode)prefs.getUChar("mode", MODE_CPAP);
  settings.deltaCm = prefs.getFloat("delta", 4.0f);

  String nvsName = prefs.getString("bleName", "Ozealis");
  nvsName.toCharArray(settings.bleName, sizeof(settings.bleName));
  settings.bleAdvertise = prefs.getBool("bleAdv", true);
  prefs.end();
}

void saveSettings() {
  prefs.begin("cpap", false);
  prefs.putFloat("pMin", settings.pMin);
  prefs.putFloat("pMax", settings.pMax);
  prefs.putBool("auto", settings.autoPap);
  prefs.putFloat("ramp", settings.rampSecs);
  prefs.putUChar("mode", (uint8_t)settings.mode);
  prefs.putFloat("delta", settings.deltaCm);
  prefs.putString("bleName", settings.bleName);
  prefs.putBool("bleAdv", settings.bleAdvertise);
  prefs.end();
}

// add near the top of ble.cpp
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*, esp_ble_gatts_cb_param_t*) override {
    bleConnected = true;
    bleActive = true;
    ledTogglePairingWave(false);   // stop when phone connects
    Serial.println("BLE connected");
  }
  void onDisconnect(BLEServer*, esp_ble_gatts_cb_param_t*) override {
    bleConnected = false;
    Serial.println("BLE disconnected");
  }
};

// ============== BLE callbacks ==============
class SettingsCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    String rx = c->getValue();
    if (rx.length() == 0) return;

    DynamicJsonDocument doc(256);
    if (deserializeJson(doc, rx)) {
      Serial.println("BLE JSON parse error");
      return;
    }

    if (doc["clearLog"] == 1) {
      dl_init();
      char_logDl->setValue("");
      Serial.println("Log cleared");
    }
    if (doc.containsKey("pMin")) settings.pMin = doc["pMin"].as<float>();
    if (doc.containsKey("pMax")) settings.pMax = doc["pMax"].as<float>();
    if (doc.containsKey("auto")) settings.autoPap = doc["auto"].as<bool>();
    if (doc.containsKey("ramp")) settings.rampSecs = doc["ramp"].as<float>();

    if (doc.containsKey("mode"))
      settings.mode = (TherapyMode)doc["mode"].as<uint8_t>(),
      papSetMode(settings.mode);

    if (doc.containsKey("bleName")) {
      snprintf(settings.bleName, sizeof(settings.bleName), "%s", doc["bleName"].as<const char*>());
    }
    if (doc.containsKey("bleAdv")) settings.bleAdvertise = doc["bleAdv"].as<int>() != 0;

    saveSettings();
    Serial.println("BLE settings updated & saved");
  }
};

class LogReadCallback : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* c) override {
    c->setValue(dl_getCsv().c_str());
  }
};

class OtaCmdCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    DynamicJsonDocument d(256);
    if (deserializeJson(d, c->getValue())) return;
    const char* ss = d["ssid"];
    const char* pw = d["pwd"];
    const char* url = d["url"];
    if (ss && pw && url) otaSecure_trigger(ss, pw, url);
  }
};

// =================== startBLE() ==========================
void startBLE() {
  if (!settings.bleAdvertise) {
    Serial.println("BLE disabled by user setting");
    return;
  }

  BLEDevice::init(settings.bleName);
  //BLEDevice::setEncryptionLevel(ESP_BLE_SEC_ENCRYPT);
  // BLEDevice::setSecurityAuth(true, true, true);  // not supported, remove or replace if needed

  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new MyServerCallbacks());

  BLEService* svc = bleServer->createService(UUID_CpapService);

  char_pressure = svc->createCharacteristic(UUID_CHAR_PRESSURE, BLECharacteristic::PROPERTY_NOTIFY);
  char_flow = svc->createCharacteristic(UUID_CHAR_FLOW, BLECharacteristic::PROPERTY_NOTIFY);
  char_setpoint = svc->createCharacteristic(UUID_CHAR_SETPOINT, BLECharacteristic::PROPERTY_NOTIFY);
  char_vin = svc->createCharacteristic(UUID_CHAR_VIN, BLECharacteristic::PROPERTY_NOTIFY);
  char_mode = svc->createCharacteristic(UUID_CHAR_MODE, BLECharacteristic::PROPERTY_NOTIFY);
  char_ahi = svc->createCharacteristic(UUID_CHAR_AHI, BLECharacteristic::PROPERTY_NOTIFY);

  char_humTemp = svc->createCharacteristic(UUID_CHAR_HUM_TEMP, BLECharacteristic::PROPERTY_NOTIFY);
  char_humRH = svc->createCharacteristic(UUID_CHAR_HUM_RH, BLECharacteristic::PROPERTY_NOTIFY);
  char_hoseTemp = svc->createCharacteristic(UUID_CHAR_HOSE_TEMP, BLECharacteristic::PROPERTY_NOTIFY);
  char_modStat = svc->createCharacteristic(UUID_CHAR_MOD_STATUS, BLECharacteristic::PROPERTY_NOTIFY);

  char_liveCsv = svc->createCharacteristic(UUID_CHAR_LIVECSV, BLECharacteristic::PROPERTY_NOTIFY);

  char_logDl = svc->createCharacteristic(UUID_CHAR_LOGDL, BLECharacteristic::PROPERTY_READ);

  char_faultCsv = svc->createCharacteristic(UUID_CHAR_FAULTCSV, BLECharacteristic::PROPERTY_READ);
  char_faultCsv->setCallbacks(new FaultLogReadCallback());
  char_faultCsv->setValue("");

  char_logDl->setCallbacks(new LogReadCallback());
  char_logDl->setValue("");

  char_settings = svc->createCharacteristic(UUID_CHAR_SETTINGS_RW,
                                            BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  char_settings->setCallbacks(new SettingsCallback());

  char_otaCmd = svc->createCharacteristic(UUID_CHAR_OTA_CMD, BLECharacteristic::PROPERTY_WRITE);
  char_otaCmd->setCallbacks(new OtaCmdCallback());

  char_otaSt = svc->createCharacteristic(UUID_CHAR_OTA_ST, BLECharacteristic::PROPERTY_NOTIFY);
  char_otaSt->setValue("IDLE");

  // Initial values
  char_pressure->setValue("0");
  char_flow->setValue("0");
  char_setpoint->setValue("0");
  char_vin->setValue("0");
  char_mode->setValue("0");
  char_ahi->setValue("0");
  char_humTemp->setValue("NAN");
  char_humRH->setValue("NAN");
  char_hoseTemp->setValue("NAN");
  char_modStat->setValue("0");

  DynamicJsonDocument jd(192);
  jd["pMin"] = settings.pMin;
  jd["pMax"] = settings.pMax;
  jd["auto"] = settings.autoPap;
  jd["ramp"] = settings.rampSecs;
  jd["mode"] = (uint8_t)settings.mode;
  jd["delta"] = settings.deltaCm;
  jd["bleName"] = settings.bleName;
  jd["bleAdv"] = settings.bleAdvertise;
  String out;
  serializeJson(jd, out);
  char_settings->setValue(out);

  svc->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(UUID_CpapService);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);
  adv->setMinPreferred(0x12);
  adv->start();

  bleStartTime = millis();
  Serial.println("BLE advertising started");
}

void ensureBleAdvertising() {
  /* 1. Bring BLE stack up once if it never ran, even when the user
         had “BLE disabled” in saved settings                         */
  if (bleServer == nullptr) {
    settings.bleAdvertise = true;  // over‑ride the off flag
    startBLE();                    // runs BLEDevice::init() etc.
    return;                        // startBLE() already began adv.
  }

  /* 2. If it ran before, simply start advertising again */
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  if (adv) {
    adv->start();             // resume TX
    bleStartTime = millis();  // restart 30 s timer
    bleActive = true;
  }
}

// ===================== streaming updater =====================
void updateBLEStream(float diff_hPa, float flow_hPa, float setPt_hPa,
                     float vin_V, float ahi,
                     const ModuleStatus& humid, const ModuleStatus& hose) {
  if (!bleConnected) return;

  char_pressure->setValue(String(diff_hPa, 2).c_str());
  char_pressure->notify();
  char_flow->setValue(String(flow_hPa, 2).c_str());
  char_flow->notify();
  char_setpoint->setValue(String(setPt_hPa, 2).c_str());
  char_setpoint->notify();
  char_vin->setValue(String(vin_V, 2).c_str());
  char_vin->notify();
  char_mode->setValue(String((uint8_t)settings.mode).c_str());
  char_mode->notify();
  char_ahi->setValue(String(ahi, 1).c_str());
  char_ahi->notify();

  // Accessory telemetry
  if (humid.present) {
    char_humTemp->setValue(String(humid.temp_C, 1).c_str());
    char_humRH->setValue(String(humid.rh_percent, 1).c_str());
  } else {
    char_humTemp->setValue("NAN");
    char_humRH->setValue("NAN");
  }

  if (hose.present) char_hoseTemp->setValue(String(hose.temp_C, 1).c_str());
  else char_hoseTemp->setValue("NAN");

  char_modStat->setValue(String((humid.present ? 1 : 0) | (hose.present ? 2 : 0)).c_str());

  static uint32_t lastCsv = 0;
  if (millis() - lastCsv >= 1000) {
    char buf[128];
    snprintf(buf, sizeof(buf),
             "%lu,%.2f,%.2f,%.2f,%.2f,%d",
             millis(),
             setPt_hPa, diff_hPa, flow_hPa,
             vin_V, currentMode);
    char_liveCsv->setValue(buf);
    char_liveCsv->notify();
    lastCsv = millis();
  }

  static uint32_t lastOTA = 0;
  if (millis() - lastOTA >= 1000) {
    switch (otaSecure_status()) {
      case OTA_IDLE: char_otaSt->setValue("IDLE"); break;
      case OTA_START: char_otaSt->setValue("START"); break;
      case OTA_PROG:
        {
          char buf[8];
          sprintf(buf, "%d%%", otaSecure_progress());
          char_otaSt->setValue(buf);
        }
        break;
      case OTA_OK: char_otaSt->setValue("OK"); break;
      case OTA_ERR: char_otaSt->setValue("ERR"); break;
    }
    char_otaSt->notify();
    lastOTA = millis();
  }

  char_humTemp->notify();
  char_humRH->notify();
  char_hoseTemp->notify();
  char_modStat->notify();
}

void sendBLEEvent(const char*) {}
