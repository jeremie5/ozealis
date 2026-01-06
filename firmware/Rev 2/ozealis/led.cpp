#include "led.h"
#include <NeoPixelBus.h>

/* ------- user‑configurable ------- */
#define NUM_LEDS 2
#define LED_SIG 15
float brightness = 0.05f;  // exported if you already use it
/* --------------------------------- */

NeoPixelBus<NeoGrbFeature, NeoEsp32Rmt0Ws2812xMethod> led(NUM_LEDS, LED_SIG);

static bool pairingActive = false;
static float wavePhase = 0.0f;  // 0–1, advances each frame

//-------------------------------------
void setupLED() {
  led.Begin();
  led.Show();  // all off
}

void setLED(uint8_t r, uint8_t g, uint8_t b) {
  RgbColor c((uint8_t)(r * brightness),
             (uint8_t)(g * brightness),
             (uint8_t)(b * brightness));
  for (int i = 0; i < NUM_LEDS; ++i) led.SetPixelColor(i, c);
  led.Show();
}

void ledTogglePairingWave(bool on) {
  pairingActive = on;
  if (!on){
    Serial.println("LED: BT pairing ended, resetting");
    setLED(0, 0, 255);  // restore idle blue when stopping
  }
}

void ledPairingWaveService() {
  if (!pairingActive) return;
  wavePhase += 0.02f;
  if (wavePhase >= 1.0f) wavePhase -= 1.0f;
  float a = wavePhase < 0.5f ? (wavePhase * 2.0f) : (2.0f - wavePhase * 2.0f);
  float b = 1.0f - a;
  const uint8_t base = 255;
  RgbColor c0(0, 0, base * a * brightness);
  RgbColor c1(0, 0, base * b * brightness);
  led.SetPixelColor(0, c0);
  led.SetPixelColor(1, c1);
  led.Show();
}