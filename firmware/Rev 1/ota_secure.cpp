/* ota_secure.cpp  – HTTPS pull using esp-idf's esp_https_ota() */
#include "ota_secure.h"
#include <WiFi.h>
#include <esp_https_ota.h>

static OTAStatus  status     = OTA_IDLE;
static uint8_t    progress   = 0;          // 0-100
static uint32_t   lastTick   = 0;

OTAStatus otaSecure_status() { return status; }
uint8_t   otaSecure_progress() { return progress; }

static void _setStatus(OTAStatus s) {
  status   = s;
  lastTick = millis();
}

void otaSecure_begin() { _setStatus(OTA_IDLE); }

void otaSecure_trigger(const char* ssid,
                       const char* pass,
                       const char* url)
{
  if (status != OTA_IDLE) return;          // already running
  _setStatus(OTA_START);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, pass);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000)
    delay(100);

  if (WiFi.status() != WL_CONNECTED) {
    _setStatus(OTA_ERR);  return;
  }

  esp_http_client_config_t cfg = {
      .url = url,
      .cert_pem = nullptr,           // ← PEM cert here for full TLS
      .timeout_ms = 120000,
  };

  _setStatus(OTA_PROG);
  esp_err_t ret = esp_https_ota(&cfg, [](esp_ota_handle_t, size_t total,
                                         size_t read, void*) {
        progress = (uint8_t)((read * 100) / total);
      });

  if (ret == ESP_OK) {
    _setStatus(OTA_OK);
    delay(1000);
    esp_restart();
  } else {
    _setStatus(OTA_ERR);
  }
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
}
