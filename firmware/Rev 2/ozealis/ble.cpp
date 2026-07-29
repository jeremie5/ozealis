//ble.cpp
#include "diag.h"
#include "modules.h"
#include "ble.h"
#include "logic.h"  // currentMode / epochOffset / eventFlag
#include <Preferences.h>
#include "datalog.h"
#include "ota_secure.h"
#include "motor.h"
#include "motor_calibration.h"
#include "oximetry.h"
#include "pressure_limits.h"
#include <Arduino.h>
#include <BLESecurity.h>
#include <driver/ledc.h>   // pour ledcSetup, ledcAttachPin, etc.
#include <esp_task_wdt.h>  // pour esp_task_wdt_*()
#include <WiFi.h>          // pour WiFi.begin(), etc.
#include <ArduinoJson.h>
#include <mbedtls/base64.h>
#include <math.h>
#include <string>
#include <string.h>  // for strncpy / snprintf

#ifndef OZEALIS_BLE_SERIAL_LOG
#define OZEALIS_BLE_SERIAL_LOG 0
#endif

#if OZEALIS_BLE_SERIAL_LOG
#define BLE_LOG(message) Serial.println(message)
#else
#define BLE_LOG(message) do { } while (0)
#endif

// ==== Global objects ====
BLEServer* bleServer = nullptr;

BLECharacteristic *char_pressure = nullptr, *char_vin = nullptr,
                  *char_mode = nullptr, *char_flow = nullptr,
                  *char_setpoint = nullptr, *char_settings = nullptr,
                  *char_fault = nullptr,
                  *char_humTemp = nullptr, *char_humRH = nullptr,
                  *char_hoseTemp = nullptr, *char_modStat = nullptr,
                  *char_oximetry = nullptr,
                  *char_ahi = nullptr, *char_liveCsv = nullptr,
                  *char_logDl = nullptr, *char_otaCmd = nullptr,
                  *char_otaSt = nullptr, *char_control = nullptr,
                  *char_oxRelay = nullptr,
                  *char_calStatus = nullptr, *char_calCmd = nullptr,
                  *char_mcfParams = nullptr, *char_protocol = nullptr;
BLECharacteristic* char_faultCsv = nullptr;


bool bleConnected = false;
bool bleActive = false;
unsigned long bleStartTime = 0;

CPAPSettings settings;  // live copy
Preferences prefs;      // NVS namespace "cpap"

static bool modeUsesAutoRange(TherapyMode mode) {
  return mode == MODE_AUTOPAP || mode == MODE_AUTO_ASV || mode == MODE_AUTO_BIPAP;
}

static void sanitizeBleName() {
  char cleaned[sizeof(settings.bleName)] = {};
  size_t out = 0;
  for (size_t i = 0; settings.bleName[i] != '\0' && out < sizeof(cleaned) - 1; ++i) {
    const unsigned char c = (unsigned char)settings.bleName[i];
    if (c < 0x20 || c > 0x7e || c == '"' || c == '\\') continue;
    cleaned[out++] = (char)c;
  }
  if (out == 0) {
    snprintf(settings.bleName, sizeof(settings.bleName), "Ozealis");
    return;
  }
  cleaned[out] = '\0';
  size_t start = 0;
  while (start < out && cleaned[start] == ' ') start++;
  size_t end = out;
  while (end > start && cleaned[end - 1] == ' ') end--;
  if (end <= start) {
    snprintf(settings.bleName, sizeof(settings.bleName), "Ozealis");
    return;
  }
  size_t len = end - start;
  if (len >= sizeof(settings.bleName)) len = sizeof(settings.bleName) - 1;
  memcpy(settings.bleName, cleaned + start, len);
  settings.bleName[len] = '\0';
}

static bool persistedSettingsEqual(const CPAPSettings& a, const CPAPSettings& b) {
  return a.pMin == b.pMin &&
         a.pMax == b.pMax &&
         a.autoPap == b.autoPap &&
         a.rampSecs == b.rampSecs &&
         a.mode == b.mode &&
         a.deltaCm == b.deltaCm &&
         a.epr == b.epr &&
         a.backupRateBpm == b.backupRateBpm &&
         a.inspTimeMs == b.inspTimeMs &&
         a.triggerSens == b.triggerSens &&
         a.cycleSens == b.cycleSens &&
         a.humidifierKind == b.humidifierKind &&
         a.humidifierTargetRH == b.humidifierTargetRH &&
         a.humidifierMaxTempC == b.humidifierMaxTempC &&
         a.humidifierPrewarmMinutes == b.humidifierPrewarmMinutes &&
         a.hoseTempDeltaC == b.hoseTempDeltaC &&
         a.bleAdvertise == b.bleAdvertise &&
         strcmp(a.bleName, b.bleName) == 0;
}

static bool sanitizeSettings() {
  CPAPSettings before = settings;
  if (!isfinite(settings.pMin)) settings.pMin = 4.0f;
  if (!isfinite(settings.pMax)) settings.pMax = 15.0f;
  if (!isfinite(settings.deltaCm)) settings.deltaCm = 4.0f;
  if (!isfinite(settings.rampSecs)) settings.rampSecs = 300.0f;
  if (!isfinite(settings.backupRateBpm)) settings.backupRateBpm = 12.0f;
  if (!isfinite(settings.humidifierTargetRH)) settings.humidifierTargetRH = 70.0f;
  if (!isfinite(settings.humidifierMaxTempC)) settings.humidifierMaxTempC = 45.0f;
  if (!isfinite(settings.hoseTempDeltaC)) settings.hoseTempDeltaC = 4.0f;
  settings.pMin = constrain(settings.pMin, MIN_THERAPY_PRESSURE_CM, MAX_THERAPY_PRESSURE_CM);
  settings.pMax = constrain(settings.pMax, settings.pMin, MAX_THERAPY_PRESSURE_CM);
  settings.deltaCm = constrain(settings.deltaCm, 0.0f, 12.0f);
  settings.rampSecs = constrain(settings.rampSecs, 0.0f, 1800.0f);
  settings.backupRateBpm = constrain(settings.backupRateBpm, 4.0f, 30.0f);
  settings.humidifierTargetRH = constrain(settings.humidifierTargetRH, 30.0f, 90.0f);
  settings.humidifierMaxTempC = constrain(settings.humidifierMaxTempC, 30.0f, 60.0f);
  settings.hoseTempDeltaC = constrain(settings.hoseTempDeltaC, 0.0f, 15.0f);
  settings.inspTimeMs = constrain(settings.inspTimeMs, (uint16_t)300, (uint16_t)3000);
  settings.humidifierPrewarmMinutes = constrain(settings.humidifierPrewarmMinutes, (uint16_t)0, (uint16_t)60);
  settings.triggerSens = constrain(settings.triggerSens, (uint8_t)1, (uint8_t)9);
  settings.cycleSens = constrain(settings.cycleSens, (uint8_t)1, (uint8_t)9);
  settings.epr = constrain(settings.epr, (uint8_t)0, (uint8_t)3);
  settings.humidifierKind = constrain(settings.humidifierKind, (uint8_t)0, (uint8_t)2);
  if (settings.mode > MODE_VAPS) settings.mode = MODE_CPAP;
  if (settings.mode == MODE_CPAP && settings.autoPap) settings.mode = MODE_AUTOPAP;
  settings.autoPap = modeUsesAutoRange(settings.mode);
  settings.bleName[sizeof(settings.bleName) - 1] = '\0';
  sanitizeBleName();
  return !persistedSettingsEqual(before, settings);
}

static String settingsJson() {
  DynamicJsonDocument jd(768);
  jd["pMin"] = settings.pMin;
  jd["pMax"] = settings.pMax;
  jd["auto"] = settings.autoPap;
  jd["ramp"] = settings.rampSecs;
  jd["mode"] = (uint8_t)settings.mode;
  jd["delta"] = settings.deltaCm;
  jd["epr"] = settings.epr;
  jd["backupRate"] = settings.backupRateBpm;
  jd["inspTimeMs"] = settings.inspTimeMs;
  jd["triggerSens"] = settings.triggerSens;
  jd["cycleSens"] = settings.cycleSens;
  jd["humidifierKind"] = settings.humidifierKind;
  jd["humidifierTargetRH"] = settings.humidifierTargetRH;
  jd["humidifierMaxTempC"] = settings.humidifierMaxTempC;
  jd["humidifierPrewarmMinutes"] = settings.humidifierPrewarmMinutes;
  jd["hoseTempDeltaC"] = settings.hoseTempDeltaC;
  jd["bleName"] = settings.bleName;
  jd["bleAdv"] = settings.bleAdvertise;
  String out;
  serializeJson(jd, out);
  return out;
}

static void publishSettings() {
  if (!char_settings) return;
  String out = settingsJson();
  char_settings->setValue(out.c_str());
}

static void publishModeFault(bool notify = false) {
  char modeValue[4];
  char faultValue[4];
  snprintf(modeValue, sizeof(modeValue), "%u", (unsigned)currentMode);
  snprintf(faultValue, sizeof(faultValue), "%u", (unsigned)currentFault);
  if (char_mode) {
    char_mode->setValue(modeValue);
    if (notify && bleConnected) char_mode->notify();
  }
  if (char_fault) {
    char_fault->setValue(faultValue);
    if (notify && bleConnected) char_fault->notify();
  }
}

static void publishModuleStatus(bool notify = false) {
  if (!char_modStat) return;
  const OximetrySample ox = oximetryGetSample();
  char moduleStatus[4];
  snprintf(moduleStatus, sizeof(moduleStatus), "%u",
           (unsigned)((humid.present ? 1 : 0) |
                      (hose.present ? 2 : 0) |
                      (ox.present ? 4 : 0) |
                      (humid.prewarm ? 8 : 0)));
  char_modStat->setValue(moduleStatus);
  if (notify && bleConnected) char_modStat->notify();
}

static void setFloatValue(BLECharacteristic* characteristic, float value, uint8_t decimals) {
  if (!characteristic) return;
  if (!isfinite(value)) {
    characteristic->setValue("NAN");
    return;
  }
  char out[16];
  snprintf(out, sizeof(out), "%.*f", decimals, value);
  characteristic->setValue(out);
}

static void publishCalibrationStatus(bool notify = false) {
  if (!char_calStatus) return;
  char_calStatus->setValue(motorCalStatusJson().c_str());
  if (notify && bleConnected) char_calStatus->notify();
}

static void configureBleSecurity() {
  BLEDevice::setEncryptionLevel(ESP_BLE_SEC_ENCRYPT);

  BLESecurity* security = new BLESecurity();
  security->setCapability(ESP_IO_CAP_NONE);
  security->setAuthenticationMode(ESP_LE_AUTH_REQ_SC_BOND);
  security->setKeySize(16);
  security->setInitEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);
  security->setRespEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);
}

static void requireEncryptedRead(BLECharacteristic* characteristic) {
  characteristic->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED);
}

static void requireEncryptedWrite(BLECharacteristic* characteristic) {
  characteristic->setAccessPermissions(ESP_GATT_PERM_WRITE_ENCRYPTED);
}

static void requireEncryptedReadWrite(BLECharacteristic* characteristic) {
  characteristic->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);
}

static void addNotificationCccd(BLECharacteristic* characteristic, bool encrypted = false) {
  BLE2902* descriptor = new BLE2902();
  if (encrypted) {
    descriptor->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);
  }
  characteristic->addDescriptor(descriptor);
}

static uint8_t jsonU8Clamped(JsonDocument& doc, const char* key, uint8_t fallback) {
  if (!doc.containsKey(key) || !doc[key].is<int>()) return fallback;
  const int value = doc[key].as<int>();
  if (value < 0 || value > 255) return fallback;
  return (uint8_t)value;
}

static uint16_t jsonU16Clamped(JsonDocument& doc, const char* key, uint16_t fallback) {
  if (!doc.containsKey(key) || !doc[key].is<long>()) return fallback;
  const long value = doc[key].as<long>();
  if (value < 0L || value > 65535L) return fallback;
  return (uint16_t)value;
}

static float jsonFiniteFloat(JsonDocument& doc, const char* key, float fallback) {
  if (!doc.containsKey(key) || !doc[key].is<float>()) return fallback;
  const float value = doc[key].as<float>();
  return isfinite(value) ? value : fallback;
}

static bool jsonBool(JsonDocument& doc, const char* key, bool fallback) {
  if (!doc.containsKey(key) || !doc[key].is<bool>()) return fallback;
  return doc[key].as<bool>();
}

static bool jsonFlag1(JsonDocument& doc, const char* key) {
  return doc.containsKey(key) && doc[key].is<int>() && doc[key].as<int>() == 1;
}

static const char* jsonNonEmptyString(JsonDocument& doc, const char* key) {
  if (!doc.containsKey(key) || !doc[key].is<const char*>()) return nullptr;
  const char* value = doc[key].as<const char*>();
  return value && value[0] != '\0' ? value : nullptr;
}

static bool jsonRootObject(JsonDocument& doc) {
  return doc.is<JsonObject>();
}

static bool hasSettingsConfigWrite(JsonDocument& doc) {
  return doc.containsKey("pMin") ||
         doc.containsKey("pMax") ||
         doc.containsKey("auto") ||
         doc.containsKey("ramp") ||
         doc.containsKey("delta") ||
         doc.containsKey("epr") ||
         doc.containsKey("backupRate") ||
         doc.containsKey("inspTimeMs") ||
         doc.containsKey("triggerSens") ||
         doc.containsKey("cycleSens") ||
         doc.containsKey("humidifierKind") ||
         doc.containsKey("humidifierTargetRH") ||
         doc.containsKey("humidifierMaxTempC") ||
         doc.containsKey("humidifierPrewarmMinutes") ||
         doc.containsKey("hoseTempDeltaC") ||
         doc.containsKey("mode") ||
         doc.containsKey("bleName") ||
         doc.containsKey("bleAdv");
}

PapLimits settingsToPapLimits() {
  sanitizeSettings();
  float effectivePMax = settings.mode == MODE_CPAP ? settings.pMin : settings.pMax;
  PapLimits limits = {
    settings.pMin,
    effectivePMax,
    settings.deltaCm,
    (uint16_t)settings.rampSecs,
    true,
    true,
    settings.epr,
    settings.backupRateBpm,
    settings.inspTimeMs
  };
  return limits;
}

static constexpr size_t CSV_TRANSFER_RAW_PAGE_BYTES = 288;
static constexpr size_t CSV_TRANSFER_MAX_TOTAL_BYTES = 512000;
static constexpr size_t CSV_TRANSFER_MAX_RESPONSE_BYTES = 500;

enum class CsvTransferSource : uint8_t {
  Session,
  Fault
};

static void publishCsvTransferError(BLECharacteristic* characteristic, const char* error) {
  if (!characteristic || !error) return;
  char response[80];
  const int written = snprintf(response, sizeof(response),
                               "{\"ok\":false,\"error\":\"%s\"}", error);
  characteristic->setValue(
    written > 0 && (size_t)written < sizeof(response)
      ? response
      : "{\"ok\":false,\"error\":\"internal\"}");
}

static bool csvTransferAvailable() {
  return (currentMode == MODE_IDLE || currentMode == MODE_FAULT) &&
         !motorCalIsActive() &&
         !otaSecure_inProgress();
}

class CsvTransferCallback : public BLECharacteristicCallbacks {
 public:
  explicit CsvTransferCallback(CsvTransferSource source) : source_(source) {
    dl_beginCsvRead(datalogCursor_);
    diag_begin_fault_csv_read(faultCursor_);
  }

  void resetSnapshot() {
    snapshotActive_ = false;
    snapshotGeneration_ = 0;
    snapshotTotal_ = 0;
    snapshotHash_ = 0;
    transferred_ = 0;
    datalogCursor_ = DatalogCsvCursor{};
    faultCursor_ = FaultCsvCursor{};
  }

  void onWrite(BLECharacteristic* characteristic) override {
    SystemControlGuard controlGuard;
    const std::string request = characteristic->getValue();
    if (request.empty() || request.size() > 96) {
      reject(characteristic, "invalid_request");
      return;
    }
    for (const unsigned char byte : request) {
      if (byte < 0x20 || byte > 0x7e) {
        reject(characteristic, "invalid_request");
        return;
      }
    }

    DynamicJsonDocument document(128);
    if (deserializeJson(document, request.data(), request.size()) ||
        !jsonRootObject(document)) {
      reject(characteristic, "invalid_request");
      return;
    }

    JsonObjectConst object = document.as<JsonObjectConst>();
    if (!object.containsKey("offset") || !object["offset"].is<unsigned long>()) {
      reject(characteristic, "invalid_request");
      return;
    }
    const unsigned long requestedOffset = object["offset"].as<unsigned long>();
    if (requestedOffset > CSV_TRANSFER_MAX_TOTAL_BYTES) {
      reject(characteristic, "offset_range");
      return;
    }

    uint32_t requestedGeneration = 0;
    if (requestedOffset == 0) {
      if (object.size() != 1 || object.containsKey("generation")) {
        reject(characteristic, "invalid_request");
        return;
      }
    } else {
      if (object.size() != 2 || !object.containsKey("generation") ||
          !object["generation"].is<unsigned long>()) {
        reject(characteristic, "invalid_request");
        return;
      }
      requestedGeneration = (uint32_t)object["generation"].as<unsigned long>();
      if (requestedGeneration == 0) {
        reject(characteristic, "invalid_request");
        return;
      }
    }

    if (!csvTransferAvailable()) {
      reject(characteristic, "busy");
      return;
    }

    if (requestedOffset == 0) {
      snapshotGeneration_ = sourceGeneration();
      snapshotTotal_ = sourceSize();
      snapshotHash_ = sourceHash();
      transferred_ = 0;
      snapshotActive_ = true;
      beginSourceRead();
      if (snapshotGeneration_ == 0 || snapshotTotal_ == 0 ||
          snapshotTotal_ > CSV_TRANSFER_MAX_TOTAL_BYTES) {
        reject(characteristic, "size_invalid");
        return;
      }
    } else {
      if (!snapshotActive_ || requestedGeneration != snapshotGeneration_ ||
          requestedOffset != transferred_) {
        reject(characteristic, "snapshot_mismatch");
        return;
      }
      if (sourceGeneration() != snapshotGeneration_) {
        reject(characteristic, "snapshot_changed");
        return;
      }
    }

    if (transferred_ >= snapshotTotal_) {
      reject(characteristic, "offset_range");
      return;
    }

    const size_t remaining = snapshotTotal_ - transferred_;
    const size_t expected = min(remaining, CSV_TRANSFER_RAW_PAGE_BYTES);
    unsigned char raw[CSV_TRANSFER_RAW_PAGE_BYTES];
    const size_t rawLength = readSource(raw, expected);
    if (rawLength != expected) {
      reject(characteristic, "source_error");
      return;
    }

    unsigned char encoded[((CSV_TRANSFER_RAW_PAGE_BYTES + 2) / 3) * 4 + 1];
    size_t encodedLength = 0;
    if (mbedtls_base64_encode(encoded, sizeof(encoded), &encodedLength,
                              raw, rawLength) != 0 ||
        encodedLength >= sizeof(encoded)) {
      reject(characteristic, "encode_error");
      return;
    }
    encoded[encodedLength] = '\0';

    char response[CSV_TRANSFER_MAX_RESPONSE_BYTES + 1];
    const int written = snprintf(
      response,
      sizeof(response),
      "{\"ok\":true,\"generation\":%lu,\"offset\":%lu,\"total\":%lu,"
      "\"hash\":\"%08lx\",\"data\":\"%s\"}",
      (unsigned long)snapshotGeneration_,
      (unsigned long)transferred_,
      (unsigned long)snapshotTotal_,
      (unsigned long)snapshotHash_,
      (const char*)encoded);
    if (written <= 0 || (size_t)written >= sizeof(response)) {
      reject(characteristic, "response_large");
      return;
    }

    characteristic->setValue(response);
    transferred_ += rawLength;
  }

 private:
  CsvTransferSource source_;
  bool snapshotActive_ = false;
  uint32_t snapshotGeneration_ = 0;
  size_t snapshotTotal_ = 0;
  uint32_t snapshotHash_ = 0;
  size_t transferred_ = 0;
  DatalogCsvCursor datalogCursor_{};
  FaultCsvCursor faultCursor_{};

  void reject(BLECharacteristic* characteristic, const char* error) {
    resetSnapshot();
    publishCsvTransferError(characteristic, error);
  }

  uint32_t sourceGeneration() const {
    return source_ == CsvTransferSource::Session
      ? dl_generation()
      : diag_fault_generation();
  }

  size_t sourceSize() const {
    return source_ == CsvTransferSource::Session
      ? dl_csvSize()
      : diag_fault_csv_size();
  }

  uint32_t sourceHash() const {
    return source_ == CsvTransferSource::Session
      ? dl_csvHash()
      : diag_fault_csv_hash();
  }

  void beginSourceRead() {
    if (source_ == CsvTransferSource::Session) {
      dl_beginCsvRead(datalogCursor_);
    } else {
      diag_begin_fault_csv_read(faultCursor_);
    }
  }

  size_t readSource(unsigned char* out, size_t maxBytes) {
    if (source_ == CsvTransferSource::Session) {
      return dl_readNextCsvChunk(datalogCursor_, (char*)out, maxBytes);
    }
    return diag_read_next_fault_csv_chunk(faultCursor_, (char*)out, maxBytes);
  }
};

static CsvTransferCallback* sessionCsvTransferCallback = nullptr;
static CsvTransferCallback* faultCsvTransferCallback = nullptr;

class McfParamsReadCallback : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* c) override {
    SystemControlGuard controlGuard;
    c->setValue(motorMcfParamsJson().c_str());
  }
};

class OximetryReadCallback : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* c) override {
    SystemControlGuard controlGuard;
    c->setValue(oximetryJson().c_str());
  }
};

// ================== Settings R/W =================
void loadSettings() {
  prefs.begin("cpap", true);
  settings.pMin = prefs.getFloat("pMin", 4.0f);
  settings.pMax = prefs.getFloat("pMax", 15.0f);
  settings.autoPap = prefs.getBool("auto", true);
  settings.rampSecs = prefs.getFloat("ramp", 300.0f);
  settings.mode = (TherapyMode)prefs.getUChar("mode", MODE_AUTOPAP);
  settings.deltaCm = prefs.getFloat("delta", 4.0f);
  settings.epr = prefs.getUChar("epr", 3);
  settings.backupRateBpm = prefs.getFloat("backupRate", 12.0f);
  settings.inspTimeMs = prefs.getUShort("inspTimeMs", 1000);
  settings.triggerSens = prefs.getUChar("triggerSens", 5);
  settings.cycleSens = prefs.getUChar("cycleSens", 5);
  settings.humidifierKind = prefs.getUChar("humKind", 0);
  settings.humidifierTargetRH = prefs.getFloat("humTarget", 70.0f);
  settings.humidifierMaxTempC = prefs.getFloat("humMaxT", 45.0f);
  settings.humidifierPrewarmMinutes = prefs.getUShort("humPreMin", 15);
  settings.hoseTempDeltaC = prefs.getFloat("hoseDelta", 4.0f);

  String nvsName = prefs.getString("bleName", "Ozealis");
  nvsName.toCharArray(settings.bleName, sizeof(settings.bleName));
  settings.bleAdvertise = prefs.getBool("bleAdv", true);
  prefs.end();

  if (sanitizeSettings()) {
    saveSettings();
  }
}

void saveSettings() {
  sanitizeSettings();
  prefs.begin("cpap", false);
  prefs.putFloat("pMin", settings.pMin);
  prefs.putFloat("pMax", settings.pMax);
  prefs.putBool("auto", settings.autoPap);
  prefs.putFloat("ramp", settings.rampSecs);
  prefs.putUChar("mode", (uint8_t)settings.mode);
  prefs.putFloat("delta", settings.deltaCm);
  prefs.putUChar("epr", settings.epr);
  prefs.putFloat("backupRate", settings.backupRateBpm);
  prefs.putUShort("inspTimeMs", settings.inspTimeMs);
  prefs.putUChar("triggerSens", settings.triggerSens);
  prefs.putUChar("cycleSens", settings.cycleSens);
  prefs.putUChar("humKind", settings.humidifierKind);
  prefs.putFloat("humTarget", settings.humidifierTargetRH);
  prefs.putFloat("humMaxT", settings.humidifierMaxTempC);
  prefs.putUShort("humPreMin", settings.humidifierPrewarmMinutes);
  prefs.putFloat("hoseDelta", settings.hoseTempDeltaC);
  prefs.putString("bleName", settings.bleName);
  prefs.putBool("bleAdv", settings.bleAdvertise);
  prefs.end();
}

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*, esp_ble_gatts_cb_param_t*) override {
    SystemControlGuard controlGuard;
    if (sessionCsvTransferCallback) {
      sessionCsvTransferCallback->resetSnapshot();
      publishCsvTransferError(char_logDl, "request_required");
    }
    if (faultCsvTransferCallback) {
      faultCsvTransferCallback->resetSnapshot();
      publishCsvTransferError(char_faultCsv, "request_required");
    }
    bleConnected = true;
    bleActive = false;
    ledTogglePairingWave(false);   // stop when phone connects
    refreshSystemStatusLed();
    BLE_LOG("BLE connected");
  }
  void onDisconnect(BLEServer*, esp_ble_gatts_cb_param_t*) override {
    SystemControlGuard controlGuard;
    bleConnected = false;
    bleActive = false;
    if (sessionCsvTransferCallback) {
      sessionCsvTransferCallback->resetSnapshot();
      publishCsvTransferError(char_logDl, "request_required");
    }
    if (faultCsvTransferCallback) {
      faultCsvTransferCallback->resetSnapshot();
      publishCsvTransferError(char_faultCsv, "request_required");
    }
    if (settings.bleAdvertise) {
      BLEAdvertising* adv = BLEDevice::getAdvertising();
      if (adv) {
        adv->start();
        bleStartTime = millis();
        bleActive = true;
      }
    }
    BLE_LOG("BLE disconnected");
  }
};

// ============== BLE callbacks ==============
class SettingsCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    SystemControlGuard controlGuard;
    String rx = c->getValue().c_str();
    if (rx.length() == 0) return;

    DynamicJsonDocument doc(768);
    if (deserializeJson(doc, rx)) {
      BLE_LOG("BLE JSON parse error");
      return;
    }
    if (!jsonRootObject(doc)) {
      BLE_LOG("BLE settings JSON root not object");
      return;
    }

    const bool clearLog = jsonFlag1(doc, "clearLog");
    const bool clearFaults = jsonFlag1(doc, "clearFaults");
    const bool clearMotorFault = jsonFlag1(doc, "clearMotorFault");
    const bool settingsConfigWrite = hasSettingsConfigWrite(doc);

    const bool logClearAllowed = currentMode == MODE_IDLE && currentFault == FAULT_NONE &&
                                 !motorCalIsActive() && !otaSecure_inProgress();

    if ((clearLog || clearFaults) && !logClearAllowed) {
      BLE_LOG("Log clear ignored outside idle");
      if (!clearMotorFault && !settingsConfigWrite) return;
    }

    if (clearLog && logClearAllowed) {
      dl_init();
      publishCsvTransferError(char_logDl, "request_required");
      BLE_LOG("Log cleared");
    }
    if (clearFaults && logClearAllowed) {
      diag_clear_faults();
      publishCsvTransferError(char_faultCsv, "request_required");
      BLE_LOG("Fault log cleared");
    }
    if (clearMotorFault) {
      const bool allowed = currentMode == MODE_IDLE || (currentMode == MODE_FAULT && currentFault == FAULT_IO);
      if (!allowed || motorCalIsActive() || otaSecure_inProgress()) {
        if (settingsConfigWrite) publishSettings();
        BLE_LOG("Motor fault clear ignored while unavailable");
        return;
      }
      if (motorClearFault()) {
        if (currentFault == FAULT_IO) {
          currentFault = FAULT_NONE;
          enterMode(MODE_IDLE);
          publishModeFault(true);
        }
        BLE_LOG("Motor fault cleared");
      } else {
        BLE_LOG("Motor fault clear failed");
      }
      if (settingsConfigWrite) publishSettings();
      return;
    }
    if ((clearLog || clearFaults) && !settingsConfigWrite) return;
    if (settingsConfigWrite && (currentMode != MODE_IDLE || currentFault != FAULT_NONE ||
                                motorCalIsActive() || otaSecure_inProgress())) {
      publishSettings();
      BLE_LOG("BLE settings write ignored outside idle");
      return;
    }
    if (doc.containsKey("pMin")) settings.pMin = jsonFiniteFloat(doc, "pMin", settings.pMin);
    if (doc.containsKey("pMax")) settings.pMax = jsonFiniteFloat(doc, "pMax", settings.pMax);
    if (doc.containsKey("auto")) settings.autoPap = jsonBool(doc, "auto", settings.autoPap);
    if (doc.containsKey("ramp")) settings.rampSecs = jsonFiniteFloat(doc, "ramp", settings.rampSecs);
    if (doc.containsKey("delta")) settings.deltaCm = jsonFiniteFloat(doc, "delta", settings.deltaCm);
    if (doc.containsKey("epr")) settings.epr = jsonU8Clamped(doc, "epr", settings.epr);
    if (doc.containsKey("backupRate")) settings.backupRateBpm = jsonFiniteFloat(doc, "backupRate", settings.backupRateBpm);
    if (doc.containsKey("inspTimeMs")) settings.inspTimeMs = jsonU16Clamped(doc, "inspTimeMs", settings.inspTimeMs);
    if (doc.containsKey("triggerSens")) settings.triggerSens = jsonU8Clamped(doc, "triggerSens", settings.triggerSens);
    if (doc.containsKey("cycleSens")) settings.cycleSens = jsonU8Clamped(doc, "cycleSens", settings.cycleSens);
    if (doc.containsKey("humidifierKind")) settings.humidifierKind = jsonU8Clamped(doc, "humidifierKind", settings.humidifierKind);
    if (doc.containsKey("humidifierTargetRH")) settings.humidifierTargetRH = jsonFiniteFloat(doc, "humidifierTargetRH", settings.humidifierTargetRH);
    if (doc.containsKey("humidifierMaxTempC")) settings.humidifierMaxTempC = jsonFiniteFloat(doc, "humidifierMaxTempC", settings.humidifierMaxTempC);
    if (doc.containsKey("humidifierPrewarmMinutes")) settings.humidifierPrewarmMinutes = jsonU16Clamped(doc, "humidifierPrewarmMinutes", settings.humidifierPrewarmMinutes);
    if (doc.containsKey("hoseTempDeltaC")) settings.hoseTempDeltaC = jsonFiniteFloat(doc, "hoseTempDeltaC", settings.hoseTempDeltaC);

    if (doc.containsKey("mode")) {
      settings.mode = (TherapyMode)jsonU8Clamped(doc, "mode", (uint8_t)settings.mode);
    }

    if (doc.containsKey("bleName")) {
      const char* nextName = jsonNonEmptyString(doc, "bleName");
      if (nextName) {
        snprintf(settings.bleName, sizeof(settings.bleName), "%s", nextName);
      }
    }
    if (doc.containsKey("bleAdv")) settings.bleAdvertise = jsonBool(doc, "bleAdv", settings.bleAdvertise);

    saveSettings();
    papSetMode(settings.mode);
    papSetLimits(settingsToPapLimits());
    publishSettings();
    BLE_LOG("BLE settings updated & saved");
  }
};

static void publishOtaStatus(bool notify = false) {
  if (!char_otaSt) return;
  switch (otaSecure_status()) {
    case OTA_IDLE: char_otaSt->setValue("IDLE"); break;
    case OTA_START: char_otaSt->setValue("START"); break;
    case OTA_PROG:
      {
        char buf[8];
        snprintf(buf, sizeof(buf), "%u%%", (unsigned)otaSecure_progress());
        char_otaSt->setValue(buf);
      }
      break;
    case OTA_OK: char_otaSt->setValue("OK"); break;
    case OTA_ERR: char_otaSt->setValue("ERR"); break;
  }
  if (notify) char_otaSt->notify();
}

class OtaStatusReadCallback : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic*) override {
    SystemControlGuard controlGuard;
    publishOtaStatus(false);
  }
};

class OtaCmdCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    SystemControlGuard controlGuard;
    DynamicJsonDocument d(512);
    if (deserializeJson(d, c->getValue().c_str())) {
      otaSecure_markError();
      publishOtaStatus(true);
      BLE_LOG("BLE OTA JSON parse error");
      return;
    }
    if (!jsonRootObject(d)) {
      otaSecure_markError();
      publishOtaStatus(true);
      BLE_LOG("BLE OTA JSON root not object");
      return;
    }
    if (currentMode != MODE_IDLE || currentFault != FAULT_NONE || motorCalIsActive() ||
        humidifierPrewarmActive() || otaSecure_inProgress()) {
      otaSecure_markError();
      publishOtaStatus(true);
      BLE_LOG("BLE OTA ignored outside idle");
      return;
    }
    const char* ss = jsonNonEmptyString(d, "ssid");
    const char* pw = jsonNonEmptyString(d, "pwd");
    const char* url = jsonNonEmptyString(d, "url");
    if (!ss || !pw || !url) {
      otaSecure_markError();
      publishOtaStatus(true);
      BLE_LOG("BLE OTA missing fields");
      return;
    }
    otaSecure_trigger(ss, pw, url);
    publishOtaStatus(true);
  }
};

class ControlCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    SystemControlGuard controlGuard;
    DynamicJsonDocument d(96);
    if (deserializeJson(d, c->getValue().c_str())) {
      BLE_LOG("BLE control JSON parse error");
      return;
    }
    if (!jsonRootObject(d)) {
      BLE_LOG("BLE control JSON root not object");
      return;
    }
    const char* command = jsonNonEmptyString(d, "command");
    if (!command) {
      BLE_LOG("BLE control missing command");
      return;
    }

    if (strcmp(command, "stop") == 0) {
      humidifierPrewarmStop();
      publishModuleStatus(true);
      if (motorCalIsActive()) motorCalAbort();
      publishCalibrationStatus(true);
      if (currentMode == MODE_FAULT) {
        motorSetDriveEnabled(false);
        publishModeFault(true);
        BLE_LOG("BLE control: stop ignored while faulted");
        return;
      }
      enterMode(MODE_SHUTDOWN);
      publishModeFault(true);
      BLE_LOG("BLE control: stop");
      return;
    }

    if (strcmp(command, "prewarmStart") == 0) {
      if (!humidifierPrewarmStart()) {
        humidifierPrewarmStop();
        BLE_LOG("BLE control: prewarm start ignored");
        publishModeFault(true);
        publishModuleStatus(true);
        return;
      }
      publishModeFault(true);
      publishModuleStatus(true);
      BLE_LOG("BLE control: prewarm start");
      return;
    }

    if (strcmp(command, "prewarmStop") == 0) {
      humidifierPrewarmStop();
      publishModeFault(true);
      publishModuleStatus(true);
      BLE_LOG("BLE control: prewarm stop");
      return;
    }

    if (strcmp(command, "start") == 0) {
      if (currentMode != MODE_IDLE || currentFault != FAULT_NONE || motorCalIsActive() ||
          otaSecure_inProgress()) {
        BLE_LOG("BLE control: start ignored while unavailable");
        publishModeFault(true);
        return;
      }
      if (!motorDriverReady()) {
        BLE_LOG("BLE control: start rejected, motor driver not ready");
        triggerFault(FAULT_IO);
        publishModeFault(true);
        return;
      }
      enterMode(MODE_STARTUP);
      publishModeFault(true);
      BLE_LOG("BLE control: start");
      return;
    }

    BLE_LOG("BLE control: unknown command");
  }
};

class OximetryRelayCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    SystemControlGuard controlGuard;
    DynamicJsonDocument d(128);
    if (deserializeJson(d, c->getValue().c_str())) {
      BLE_LOG("BLE oximetry relay JSON parse error");
      return;
    }
    if (!jsonRootObject(d)) {
      BLE_LOG("BLE oximetry relay root not object");
      return;
    }
    const float spo2 = jsonFiniteFloat(d, "spo2", NAN);
    const float pulse = jsonFiniteFloat(d, "pulse", NAN);
    const uint8_t quality = jsonU8Clamped(d, "quality", 0);
    if (!isfinite(spo2) || !isfinite(pulse) || spo2 < 50.0f || spo2 > 100.0f || pulse < 20.0f || pulse > 250.0f) {
      BLE_LOG("BLE oximetry relay invalid sample");
      return;
    }
    oximetrySetBleSample(spo2, pulse, quality);
    if (char_oximetry) {
      char_oximetry->setValue(oximetryJson().c_str());
      if (bleConnected) char_oximetry->notify();
    }
  }
};

class CalibrationStatusCallback : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* c) override {
    SystemControlGuard controlGuard;
    c->setValue(motorCalStatusJson().c_str());
  }
};

class CalibrationCommandCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    SystemControlGuard controlGuard;
    DynamicJsonDocument d(192);
    if (deserializeJson(d, c->getValue().c_str())) {
      BLE_LOG("BLE calibration JSON parse error");
      return;
    }
    if (!jsonRootObject(d)) {
      BLE_LOG("BLE calibration JSON root not object");
      return;
    }
    const char* command = jsonNonEmptyString(d, "command");
    if (!command) {
      BLE_LOG("BLE calibration missing command");
      return;
    }

    if (strcmp(command, "abort") == 0) {
      if (!motorCalIsActive()) {
        BLE_LOG("BLE calibration: abort ignored while inactive");
        publishCalibrationStatus(true);
        return;
      }
      motorCalAbort();
      publishCalibrationStatus(true);
      return;
    }

    if (strcmp(command, "capture") == 0) {
      if (!motorCalCapturePoint()) BLE_LOG("BLE calibration: capture ignored");
      publishCalibrationStatus(true);
      return;
    }

    if (strcmp(command, "start") == 0 || strcmp(command, "waterStart") == 0) {
      if (currentMode != MODE_IDLE || currentFault != FAULT_NONE || motorCalIsActive() ||
          otaSecure_inProgress()) {
        BLE_LOG("BLE calibration: start ignored while unavailable");
        publishCalibrationStatus(true);
        return;
      }
      if (!motorDriverReady()) {
        BLE_LOG("BLE calibration: start rejected, motor driver not ready");
        triggerFault(FAULT_IO);
        publishModeFault(true);
        publishCalibrationStatus(true);
        return;
      }
      MotorCalibrationPlan plan;
      plan.minAmp = jsonU8Clamped(d, "minAmp", plan.minAmp);
      plan.maxAmp = jsonU8Clamped(d, "maxAmp", plan.maxAmp);
      plan.stepAmp = jsonU8Clamped(d, "stepAmp", plan.stepAmp);
      plan.dwellMs = jsonU16Clamped(d, "dwellMs", plan.dwellMs);
      plan.maxPressureCm = jsonFiniteFloat(d, "maxPressureCm", plan.maxPressureCm);
      const bool accepted = strcmp(command, "waterStart") == 0 ? motorCalWaterStart(plan) : motorCalStart(plan);
      if (!accepted) BLE_LOG("BLE calibration: start rejected by calibration module");
      publishCalibrationStatus(true);
      return;
    }

    BLE_LOG("BLE calibration: unknown command");
  }
};

// =================== startBLE() ==========================
static void startBleStack(bool forceAdvertising) {
  if (bleServer != nullptr) return;
  if (!forceAdvertising && !settings.bleAdvertise) {
    BLE_LOG("BLE disabled by user setting");
    return;
  }

  BLEDevice::init(settings.bleName);
  BLEDevice::setMTU(517);
  configureBleSecurity();

  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new MyServerCallbacks());

  // One service handle, two handles per characteristic, and one CCCD per
  // notifying characteristic currently require 64 handles. Keep deliberate
  // headroom so the complete service registers instead of silently exhausting
  // the Arduino-ESP32 default 15-handle service budget.
  static constexpr uint16_t OZEALIS_SERVICE_HANDLE_BUDGET = 72;
  BLEService* svc = bleServer->createService(
    BLEUUID(UUID_CpapService),
    OZEALIS_SERVICE_HANDLE_BUDGET);

  char_pressure = svc->createCharacteristic(UUID_CHAR_PRESSURE, BLECharacteristic::PROPERTY_NOTIFY);
  char_flow = svc->createCharacteristic(UUID_CHAR_FLOW, BLECharacteristic::PROPERTY_NOTIFY);
  char_setpoint = svc->createCharacteristic(UUID_CHAR_SETPOINT, BLECharacteristic::PROPERTY_NOTIFY);
  char_vin = svc->createCharacteristic(UUID_CHAR_VIN, BLECharacteristic::PROPERTY_NOTIFY);
  char_mode = svc->createCharacteristic(UUID_CHAR_MODE,
                                        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  char_ahi = svc->createCharacteristic(UUID_CHAR_AHI, BLECharacteristic::PROPERTY_NOTIFY);
  char_fault = svc->createCharacteristic(UUID_CHAR_FAULT,
                                         BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);

  char_humTemp = svc->createCharacteristic(UUID_CHAR_HUM_TEMP, BLECharacteristic::PROPERTY_NOTIFY);
  char_humRH = svc->createCharacteristic(UUID_CHAR_HUM_RH, BLECharacteristic::PROPERTY_NOTIFY);
  char_hoseTemp = svc->createCharacteristic(UUID_CHAR_HOSE_TEMP, BLECharacteristic::PROPERTY_NOTIFY);
  char_modStat = svc->createCharacteristic(UUID_CHAR_MOD_STATUS,
                                           BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  char_oximetry = svc->createCharacteristic(UUID_CHAR_OXIMETRY,
                                            BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  requireEncryptedRead(char_oximetry);
  char_oximetry->setCallbacks(new OximetryReadCallback());

  char_liveCsv = svc->createCharacteristic(UUID_CHAR_LIVECSV, BLECharacteristic::PROPERTY_NOTIFY);

  char_logDl = svc->createCharacteristic(
    UUID_CHAR_LOGDL,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  requireEncryptedReadWrite(char_logDl);

  char_faultCsv = svc->createCharacteristic(
    UUID_CHAR_FAULTCSV,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  requireEncryptedReadWrite(char_faultCsv);
  faultCsvTransferCallback = new CsvTransferCallback(CsvTransferSource::Fault);
  char_faultCsv->setCallbacks(faultCsvTransferCallback);
  publishCsvTransferError(char_faultCsv, "request_required");

  sessionCsvTransferCallback = new CsvTransferCallback(CsvTransferSource::Session);
  char_logDl->setCallbacks(sessionCsvTransferCallback);
  publishCsvTransferError(char_logDl, "request_required");

  char_calStatus = svc->createCharacteristic(UUID_CHAR_CAL_STATUS,
                                             BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  requireEncryptedRead(char_calStatus);
  char_calStatus->setCallbacks(new CalibrationStatusCallback());
  char_calStatus->setValue(motorCalStatusJson().c_str());

  char_calCmd = svc->createCharacteristic(UUID_CHAR_CAL_CMD, BLECharacteristic::PROPERTY_WRITE);
  requireEncryptedWrite(char_calCmd);
  char_calCmd->setCallbacks(new CalibrationCommandCallback());

  char_mcfParams = svc->createCharacteristic(UUID_CHAR_MCF_PARAMS, BLECharacteristic::PROPERTY_READ);
  requireEncryptedRead(char_mcfParams);
  char_mcfParams->setCallbacks(new McfParamsReadCallback());
  char_mcfParams->setValue(motorMcfParamsJson().c_str());

  char_settings = svc->createCharacteristic(UUID_CHAR_SETTINGS_RW,
                                            BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  requireEncryptedReadWrite(char_settings);
  char_settings->setCallbacks(new SettingsCallback());

  char_otaCmd = svc->createCharacteristic(UUID_CHAR_OTA_CMD, BLECharacteristic::PROPERTY_WRITE);
  requireEncryptedWrite(char_otaCmd);
  char_otaCmd->setCallbacks(new OtaCmdCallback());

  char_otaSt = svc->createCharacteristic(UUID_CHAR_OTA_ST,
                                         BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  requireEncryptedRead(char_otaSt);
  char_otaSt->setCallbacks(new OtaStatusReadCallback());
  char_otaSt->setValue("IDLE");
  char_control = svc->createCharacteristic(UUID_CHAR_CONTROL, BLECharacteristic::PROPERTY_WRITE);
  requireEncryptedWrite(char_control);
  char_control->setCallbacks(new ControlCallback());
  char_oxRelay = svc->createCharacteristic(UUID_CHAR_OXIMETRY_RELAY, BLECharacteristic::PROPERTY_WRITE);
  requireEncryptedWrite(char_oxRelay);
  char_oxRelay->setCallbacks(new OximetryRelayCallback());
  char_protocol = svc->createCharacteristic(UUID_CHAR_PROTOCOL, BLECharacteristic::PROPERTY_READ);
  char_protocol->setValue(OZEALIS_PROTOCOL_VERSION);

  addNotificationCccd(char_pressure);
  addNotificationCccd(char_flow);
  addNotificationCccd(char_setpoint);
  addNotificationCccd(char_vin);
  addNotificationCccd(char_mode);
  addNotificationCccd(char_ahi);
  addNotificationCccd(char_fault);
  addNotificationCccd(char_humTemp);
  addNotificationCccd(char_humRH);
  addNotificationCccd(char_hoseTemp);
  addNotificationCccd(char_modStat);
  addNotificationCccd(char_oximetry, true);
  addNotificationCccd(char_liveCsv);
  addNotificationCccd(char_calStatus, true);
  addNotificationCccd(char_otaSt, true);

  // Initial values
  char_pressure->setValue("0");
  char_flow->setValue("0");
  char_setpoint->setValue("0");
  char_vin->setValue("0");
  char_mode->setValue("0");
  char_fault->setValue("0");
  char_ahi->setValue("0");
  char_humTemp->setValue("NAN");
  char_humRH->setValue("NAN");
  char_hoseTemp->setValue("NAN");
  char_modStat->setValue("0");
  char_oximetry->setValue("{\"present\":false,\"source\":\"none\"}");

  publishSettings();

  svc->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(UUID_CpapService);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);
  adv->setMinPreferred(0x12);
  adv->start();

  bleStartTime = millis();
  bleActive = true;
  BLE_LOG("BLE advertising started");
}

void startBLE() {
  startBleStack(false);
}

void ensureBleAdvertising() {
  // Bring the stack up for a temporary physical pairing window without
  // changing the saved or live boot-advertising preference.
  if (bleServer == nullptr) {
    startBleStack(true);
    return;
  }

  // If it ran before, simply start advertising again.
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  if (adv) {
    adv->start();             // resume TX
    bleStartTime = millis();  // restart 30 s timer
    bleActive = true;
  }
}

// ===================== streaming updater =====================
void updateBLEStream(float diff_hPa, float flow_hPa, float setPt_hPa,
                     float vin_V, float ahi,
                     const ModuleStatus& humid, const ModuleStatus& hose) {
  if (!bleConnected) return;

  setFloatValue(char_pressure, diff_hPa, 2);
  char_pressure->notify();
  setFloatValue(char_flow, flow_hPa, 2);
  char_flow->notify();
  setFloatValue(char_setpoint, setPt_hPa, 2);
  char_setpoint->notify();
  setFloatValue(char_vin, vin_V, 2);
  char_vin->notify();
  publishModeFault(true);
  setFloatValue(char_ahi, ahi, 1);
  char_ahi->notify();

  // Accessory telemetry
  if (humid.present) {
    setFloatValue(char_humTemp, humid.temp_C, 1);
    setFloatValue(char_humRH, humid.rh_percent, 1);
  } else {
    char_humTemp->setValue("NAN");
    char_humRH->setValue("NAN");
  }

  if (hose.present) setFloatValue(char_hoseTemp, hose.temp_C, 1);
  else char_hoseTemp->setValue("NAN");

  const OximetrySample ox = oximetryGetSample();
  char_oximetry->setValue(oximetryJson().c_str());

  publishModuleStatus(false);

  static uint32_t lastCsv = 0;
  static uint32_t lastMotorI2cProbe = 0;
  static bool liveMotorI2cPresent = false;
  constexpr uint32_t LIVE_CSV_CONNECTED_PERIOD_MS = 100;  // 10 Hz while the app is connected.
  constexpr uint32_t LIVE_CSV_I2C_PROBE_PERIOD_MS = 1000;
  if (millis() - lastCsv >= LIVE_CSV_CONNECTED_PERIOD_MS) {
    if (lastMotorI2cProbe == 0 || millis() - lastMotorI2cProbe >= LIVE_CSV_I2C_PROBE_PERIOD_MS) {
      liveMotorI2cPresent = motorDriverI2cPresent();
      lastMotorI2cProbe = millis();
    }
    const float measuredCm = papGetMeasuredCm();
    const float pressureErrorCm = papGetPressureErrorCm();
    const float motorFgHz = motorGetFgHz();
    const bool oxValid = ox.present && isfinite(ox.spo2Percent) && isfinite(ox.pulseBpm);
    if (isfinite(setPt_hPa) && isfinite(diff_hPa) && isfinite(flow_hPa) && isfinite(vin_V) &&
        isfinite(measuredCm) && isfinite(pressureErrorCm) && isfinite(motorFgHz)) {
      char buf[220];
      char spo2Text[12] = "NAN";
      char pulseText[12] = "NAN";
      char humidTempText[12] = "NAN";
      char humidRhText[12] = "NAN";
      char hoseTempText[12] = "NAN";
      if (oxValid) {
        snprintf(spo2Text, sizeof(spo2Text), "%.1f", ox.spo2Percent);
        snprintf(pulseText, sizeof(pulseText), "%.1f", ox.pulseBpm);
      }
      if (humid.present && isfinite(humid.temp_C) && isfinite(humid.rh_percent)) {
        snprintf(humidTempText, sizeof(humidTempText), "%.1f", humid.temp_C);
        snprintf(humidRhText, sizeof(humidRhText), "%.1f", humid.rh_percent);
      }
      if (hose.present && isfinite(hose.temp_C)) {
        snprintf(hoseTempText, sizeof(hoseTempText), "%.1f", hose.temp_C);
      }
      snprintf(buf, sizeof(buf),
               "%lu,%.2f,%.2f,%.2f,%.2f,%d,%.2f,%.2f,%u,%u,%u,%u,%.2f,%s,%s,%u,%s,%s,%s",
               millis(),
               setPt_hPa, diff_hPa, flow_hPa,
               vin_V, currentMode,
               measuredCm,
               pressureErrorCm,
               papGetCommandedAmp(),
               motorGetCommand(),
               motorFaultActive() ? 1 : 0,
               liveMotorI2cPresent ? 1 : 0,
               motorFgHz,
               spo2Text,
               pulseText,
               oxValid ? (unsigned)ox.source : 0,
               humidTempText,
               humidRhText,
               hoseTempText);
      char_liveCsv->setValue(buf);
      char_liveCsv->notify();
    }
    lastCsv = millis();
  }

  static uint32_t lastOTA = 0;
  if (millis() - lastOTA >= 1000) {
    publishOtaStatus(true);
    publishCalibrationStatus(true);
    lastOTA = millis();
  }

  char_humTemp->notify();
  char_humRH->notify();
  char_hoseTemp->notify();
  char_modStat->notify();
  char_oximetry->notify();
}

void sendBLEEvent(const char*) {
  publishModeFault(true);
  publishCalibrationStatus(true);
}
