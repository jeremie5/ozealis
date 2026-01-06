// ble.h
#ifndef BLE_H
#define BLE_H

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "autopap.h"

// ─────────────────────────────────────────────
// UUIDs  (16-bit just for brevity; swap for 128-bit if you wish)
#define UUID_CpapService "180F"

#define UUID_CHAR_PRESSURE "0001"     // ΔP   hPa    (notify)
#define UUID_CHAR_FLOW "0002"         // Flow proxy  (notify)
#define UUID_CHAR_SETPOINT "0003"     // AutoPap set-point hPa (notify)
#define UUID_CHAR_VIN "0004"          // VIN volts  (notify)
#define UUID_CHAR_MODE "0005"         // SystemMode enum (notify)
#define UUID_CHAR_AHI "0006"          // events/hour (notify)
#define UUID_CHAR_HUM_TEMP "0010"     // humidifier temp  °C (notify)
#define UUID_CHAR_HUM_RH "0011"       // humidifier RH    %  (notify)
#define UUID_CHAR_HOSE_TEMP "0012"    // hose temp        °C (notify)
#define UUID_CHAR_MOD_STATUS "0013"   // bit-field: bit0 humid, bit1 hose (notify)
#define UUID_CHAR_LIVECSV "0020"      // notify, 120-byte CSV every sec
#define UUID_CHAR_LOGDL "0021"        // read, full-session CSV (long read)
#define UUID_CHAR_SETTINGS_RW "00F0"  // JSON settings R/W
#define UUID_CHAR_OTA_CMD "0007"      // write JSON {ssid,pwd,url}
#define UUID_CHAR_OTA_ST "0008"       // notify "IDLE|n%|OK|ERR"
#define UUID_CHAR_FAULTCSV "0022"

extern BLECharacteristic* char_faultCsv;
extern BLECharacteristic* char_otaSt;

// ─────────────────────────────────────────────
// Settings persisted in NVS and edit-able over BLE
struct CPAPSettings {
  float pMin = 4.0f;
  float pMax = 15.0f;
  bool autoPap = true;
  float rampSecs = 300.0f;
  float targetRH = 70.0f;
  float tubeDelta = 4.0f;
  TherapyMode mode = MODE_CPAP;
  float deltaCm = 4.0f;
  char bleName[20] = "Ozealis";
  bool bleAdvertise = true;  // if false → keep BLE radio off next boot
};

// Accessory module live status
struct ModuleStatus;

// ─────────────────────────────────────────────
// Globals (defined in ble.cpp)
extern BLEServer* bleServer;
extern bool bleConnected;
extern bool bleActive;
extern unsigned long bleStartTime;

extern CPAPSettings settings;  // current persisted settings

// Notify characteristics (created in startBLE)
extern BLECharacteristic *char_pressure, *char_flow, *char_setpoint,
  *char_vin, *char_mode, *char_ahi,
  *char_humTemp, *char_humRH,
  *char_hoseTemp, *char_modStat,
  *char_settings, *char_liveCsv, *char_logDl;

// ─────────────────────────────────────────────
// API
void startBLE();      // start service + advertising
void ensureBleAdvertising();
void loadSettings();  // from NVS
void saveSettings();  // to   NVS

/** push one telemetry frame */
void updateBLEStream(float diff_hPa,
                     float flow_hPa,
                     float set_hPa,
                     float vin_V,
                     float ahi,
                     const ModuleStatus& humid,
                     const ModuleStatus& hose);

#endif  // BLE_H
