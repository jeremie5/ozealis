// ota_secure.h
#pragma once
#include <Arduino.h>

enum OTAStatus : uint8_t {
  OTA_IDLE = 0, OTA_START, OTA_PROG, OTA_OK, OTA_ERR
};

void otaSecure_begin();                               // call once in setup()
OTAStatus otaSecure_status();                         // polled by BLE stream
void otaSecure_trigger(const char* ssid,
                       const char* pass,
                       const char* url);              // called from BLE CB
