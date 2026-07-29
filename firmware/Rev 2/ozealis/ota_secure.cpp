#include "ota_secure.h"
#include <WiFi.h>
#include <esp_https_ota.h>
#include <esp_http_client.h>
#include <string.h>

static volatile OTAStatus status = OTA_IDLE;
static volatile uint8_t progress = 0;
static TaskHandle_t otaTaskHandle = nullptr;
static char pendingSsid[33] = {};
static char pendingPwd[65] = {};
static char pendingUrl[256] = {};

static void clearPendingOtaCredentials() {
  memset(pendingSsid, 0, sizeof(pendingSsid));
  memset(pendingPwd, 0, sizeof(pendingPwd));
  memset(pendingUrl, 0, sizeof(pendingUrl));
}

OTAStatus otaSecure_status() {
  return status;
}

uint8_t otaSecure_progress() {
  return progress;
}

static void setStatus(OTAStatus s) {
  status = s;
}

bool otaSecure_inProgress() {
  return status == OTA_START || status == OTA_PROG || status == OTA_OK;
}

static bool isSupportedOtaUrl(const char* url) {
  if (!url) return false;
  const char* body = nullptr;
  if (strncmp(url, "https://", 8) == 0) {
    body = url + 8;
  } else if (strncmp(url, "http://", 7) == 0) {
    body = url + 7;
  } else {
    return false;
  }
  if (*body == '\0' || *body == '/' || *body == '?' || *body == '#') return false;
  for (const char* p = url; *p; ++p) {
    const unsigned char c = (unsigned char)*p;
    if (c <= 0x20 || c == 0x7f) return false;
  }
  return true;
}

static bool copyField(char* dst, size_t dstLen, const char* src) {
  if (!dst || dstLen == 0 || !src) return false;
  const size_t len = strlen(src);
  if (len == 0 || len >= dstLen) return false;
  memcpy(dst, src, len + 1);
  return true;
}

static void otaWorker(void*) {
  char ssid[sizeof(pendingSsid)];
  char pwd[sizeof(pendingPwd)];
  char url[sizeof(pendingUrl)];
  strlcpy(ssid, pendingSsid, sizeof(ssid));
  strlcpy(pwd, pendingPwd, sizeof(pwd));
  strlcpy(url, pendingUrl, sizeof(url));
  clearPendingOtaCredentials();

  // ---- Wi-Fi ------------------------------------------------
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, pwd);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) delay(100);
  memset(ssid, 0, sizeof(ssid));
  memset(pwd, 0, sizeof(pwd));
  if (WiFi.status() != WL_CONNECTED) {
    memset(url, 0, sizeof(url));
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    setStatus(OTA_ERR);
    otaTaskHandle = nullptr;
    vTaskDelete(nullptr);
    return;
  }

  // ---- esp_https_ota() -------------------------------------
  esp_http_client_config_t http_cfg = {
    .url = url,
    .cert_pem = nullptr,
    .timeout_ms = 120000
  };

  setStatus(OTA_PROG);
  progress = 0;

  esp_err_t ret = esp_https_ota(&http_cfg);
  progress = 100;
  memset(url, 0, sizeof(url));

  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);

  if (ret == ESP_OK) {
    setStatus(OTA_OK);
    delay(1000);
    esp_restart();
  } else {
    setStatus(OTA_ERR);
  }

  otaTaskHandle = nullptr;
  vTaskDelete(nullptr);
}

void otaSecure_begin() {
  setStatus(OTA_IDLE);
  progress = 0;
  otaTaskHandle = nullptr;
}

void otaSecure_markError() {
  if (otaSecure_inProgress()) return;
  setStatus(OTA_ERR);
}

void otaSecure_trigger(const char* ssid,
                       const char* pwd,
                       const char* url) {
  if (otaSecure_inProgress()) return;
  clearPendingOtaCredentials();
  if (!ssid || !pwd || !isSupportedOtaUrl(url)) {
    setStatus(OTA_ERR);
    return;
  }
  if (!copyField(pendingSsid, sizeof(pendingSsid), ssid) ||
      !copyField(pendingPwd, sizeof(pendingPwd), pwd) ||
      !copyField(pendingUrl, sizeof(pendingUrl), url)) {
    clearPendingOtaCredentials();
    setStatus(OTA_ERR);
    return;
  }
  setStatus(OTA_START);
  progress = 0;

  if (xTaskCreate(otaWorker, "otaSecure", 8192, nullptr, 1, &otaTaskHandle) != pdPASS) {
    otaTaskHandle = nullptr;
    clearPendingOtaCredentials();
    setStatus(OTA_ERR);
    return;
  }
}
