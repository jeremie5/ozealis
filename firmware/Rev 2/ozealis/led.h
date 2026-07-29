#ifndef LED_H
#define LED_H

#include <Arduino.h>

// Pins
#define LED_SIG 15

#define NUM_LEDS 2

void setupLED();
void setLED(uint8_t r, uint8_t g, uint8_t b);
void ledTogglePairingWave(bool on);   // start/stop wave animation
void ledPairingWaveService();                    // must be called every loop()

#endif
