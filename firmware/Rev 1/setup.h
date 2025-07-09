//setup.h
#ifndef SETUP_H
#define SETUP_H

#include <Arduino.h>
#include <Adafruit_NeoPixel.h>

// === Pin Definitions ===
#define BTN_SIG       34
#define LED_SIG       15
#define VIN_SEN       35
#define ACC_EN        16
#define BZR_SIG       27

#define VIN_DIVIDER_RATIO (11.0)  // Adjust to match resistor values

extern Adafruit_NeoPixel led;

void setupLED() {
  led.begin();
  led.setBrightness(50);
  led.show();
}

void setLED(uint8_t r, uint8_t g, uint8_t b) {
  led.setPixelColor(0, led.Color(r, g, b));
  led.show();
}

void setupButtonBuzzer() {
  pinMode(BTN_SIG, INPUT);
  pinMode(BZR_SIG, OUTPUT);
  digitalWrite(BZR_SIG, LOW);
}

void buzz(uint16_t duration_ms) {
  digitalWrite(BZR_SIG, HIGH);
  delay(duration_ms);
  digitalWrite(BZR_SIG, LOW);
}

float readVIN() {
  uint16_t raw = analogRead(VIN_SEN);
  return raw * (3.3 / 4095.0) * VIN_DIVIDER_RATIO;
}

#endif // SETUP_H
