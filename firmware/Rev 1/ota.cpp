// ota.cpp
#include "ota.h"
#include <ArduinoOTA.h>

void setupOTA(const char* hostname) {
  ArduinoOTA.setHostname(hostname);

  ArduinoOTA.onStart([]() {
    Serial.println("OTA: Start");
  });

  ArduinoOTA.onEnd([]() {
    Serial.println("OTA: End");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("OTA: Progress: %u%%\n", (progress * 100) / total);
  });

  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("OTA: Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
    else if (error == OTA_END_ERROR) Serial.println("End Failed");
  });

  ArduinoOTA.begin();
  Serial.println("OTA: Ready");
}

void handleOTA() {
  ArduinoOTA.handle();
}
