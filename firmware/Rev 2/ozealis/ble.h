// ble.h
#ifndef BLE_H
#define BLE_H

#include <Arduino.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include "autopap.h"

#define UUID_CpapService "7f2d5f4a-0f4d-4a1f-9f84-0c2a6b3d0000"
#define OZEALIS_PROTOCOL_VERSION "ozealis-ble-v3"

#define UUID_CHAR_PRESSURE "7f2d0001-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_FLOW "7f2d0002-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_SETPOINT "7f2d0003-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_VIN "7f2d0004-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_MODE "7f2d0005-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_AHI "7f2d0006-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_OTA_CMD "7f2d0007-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_OTA_ST "7f2d0008-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_FAULT "7f2d0009-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_HUM_TEMP "7f2d0010-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_HUM_RH "7f2d0011-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_HOSE_TEMP "7f2d0012-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_MOD_STATUS "7f2d0013-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_OXIMETRY "7f2d0014-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_LIVECSV "7f2d0020-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_LOGDL "7f2d0021-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_FAULTCSV "7f2d0022-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_CAL_STATUS "7f2d0030-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_CAL_CMD "7f2d0031-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_MCF_PARAMS "7f2d0032-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_CONTROL "7f2d00c0-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_OXIMETRY_RELAY "7f2d00d0-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_SETTINGS_RW "7f2d00f0-0f4d-4a1f-9f84-0c2a6b3d0000"
#define UUID_CHAR_PROTOCOL "7f2d00ff-0f4d-4a1f-9f84-0c2a6b3d0000"

extern BLECharacteristic* char_faultCsv;
extern BLECharacteristic* char_otaSt;

struct CPAPSettings {
  float pMin = 4.0f;
  float pMax = 15.0f;
  bool autoPap = true;
  float rampSecs = 300.0f;
  TherapyMode mode = MODE_AUTOPAP;
  float deltaCm = 4.0f;
  uint8_t epr = 3;
  float backupRateBpm = 12.0f;
  uint16_t inspTimeMs = 1000;
  uint8_t triggerSens = 5;
  uint8_t cycleSens = 5;
  uint8_t humidifierKind = 0;  // 0 off, 1 ultrasonic, 2 water warmer
  float humidifierTargetRH = 70.0f;
  float humidifierMaxTempC = 45.0f;
  uint16_t humidifierPrewarmMinutes = 15;
  float hoseTempDeltaC = 4.0f;
  char bleName[20] = "Ozealis";
  bool bleAdvertise = true;
};

struct ModuleStatus;

extern BLEServer* bleServer;
extern bool bleConnected;
extern bool bleActive;
extern unsigned long bleStartTime;

extern CPAPSettings settings;

extern BLECharacteristic *char_pressure, *char_flow, *char_setpoint,
  *char_vin, *char_mode, *char_fault, *char_ahi,
  *char_humTemp, *char_humRH,
  *char_hoseTemp, *char_modStat,
  *char_oximetry,
  *char_settings, *char_liveCsv, *char_logDl,
  *char_mcfParams;

void startBLE();
void ensureBleAdvertising();
void sendBLEEvent(const char* evt);
void loadSettings();
void saveSettings();
PapLimits settingsToPapLimits();

void updateBLEStream(float diff_hPa,
                     float flow_hPa,
                     float set_hPa,
                     float vin_V,
                     float ahi,
                     const ModuleStatus& humid,
                     const ModuleStatus& hose);

#endif  // BLE_H
