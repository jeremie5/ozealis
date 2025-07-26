#include "ota_secure.h"
#include <WiFi.h>
#include <esp_https_ota.h>
#include <esp_http_client.h>

static OTAStatus status = OTA_IDLE;
static uint8_t progress = 0;

OTAStatus otaSecure_status() {
  return status;
}
uint8_t otaSecure_progress() {
  return progress;
}

static void setStatus(OTAStatus s) {
  status = s;
}

void otaSecure_begin() {
  setStatus(OTA_IDLE);
}

// ------------------------------------------------------------
void otaSecure_trigger(const char *ssid,
                       const char *pwd,
                       const char *url) {
  if (status != OTA_IDLE) return;
  setStatus(OTA_START);

  // ---- Wi‑Fi ------------------------------------------------
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, pwd);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15'000) delay(100);
  if (WiFi.status() != WL_CONNECTED) {
    setStatus(OTA_ERR);
    return;
  }

  // ---- esp_https_ota()  ------------------------------------
  esp_http_client_config_t http_cfg = {
    .url = url,
    .cert_pem = nullptr,
    .timeout_ms = 120000
  };

  esp_https_ota_config_t ota_cfg = { // <‑‑ struct trimmed
                                     .http_config = &http_cfg,
                                     .partial_http_download = false
  };

  setStatus(OTA_PROG);
  progress = 0;

  esp_err_t ret = esp_https_ota(&ota_cfg);  // <-- pass ota_cfg
  progress = 100;                           // finished

  if (ret == ESP_OK) {
    setStatus(OTA_OK);
    delay(1000);
    esp_restart();
  } else {
    setStatus(OTA_ERR);
  }

  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
}
