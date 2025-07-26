#ifndef LED_H
#define LED_H

#include <Arduino.h>
#include <NeoPixelBus.h>

// Pins
#define LED_SIG 15

#define NUM_LEDS 2

// NeoPixelBus LED declaration
extern NeoPixelBus<NeoGrbFeature, NeoEsp32Rmt0Ws2812xMethod> led;

void setupLED();
void setLED(uint8_t r, uint8_t g, uint8_t b);
void ledTogglePairingWave(bool on);   // start/stop wave animation
void ledPairingWaveService();                    // must be called every loop()

#endif
