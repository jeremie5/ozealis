#include "led.h"
#include <driver/rmt.h>

#ifndef OZEALIS_LED_SERIAL_LOG
#define OZEALIS_LED_SERIAL_LOG 0
#endif

#if OZEALIS_LED_SERIAL_LOG
#define LED_LOG(message) Serial.println(message)
#else
#define LED_LOG(message) do { } while (0)
#endif

static constexpr uint8_t kBrightness = 3;  // roughly 1% of full scale
static constexpr rmt_channel_t kLedRmtChannel = RMT_CHANNEL_0;
static constexpr uint16_t kT0HighTicks = 4;  // 0.4 us at 10 MHz
static constexpr uint16_t kT0LowTicks = 9;   // 0.9 us
static constexpr uint16_t kT1HighTicks = 8;  // 0.8 us
static constexpr uint16_t kT1LowTicks = 5;   // 0.5 us
static uint8_t pixels[NUM_LEDS][3] = {};
static bool pairingActive = false;
static bool rmtReady = false;
static uint8_t wavePhase = 0;

static inline uint8_t scale(uint8_t value) {
  return (uint16_t)value * kBrightness / 255;
}

static void appendByte(uint8_t value, rmt_item32_t* items, size_t& itemCount) {
  for (int8_t bit = 7; bit >= 0; --bit) {
    const bool one = (value & (1 << bit)) != 0;
    rmt_item32_t& item = items[itemCount++];
    item.level0 = 1;
    item.duration0 = one ? kT1HighTicks : kT0HighTicks;
    item.level1 = 0;
    item.duration1 = one ? kT1LowTicks : kT0LowTicks;
  }
}

static void showPixels() {
  if (!rmtReady) return;
  rmt_item32_t items[NUM_LEDS * 24] = {};
  size_t itemCount = 0;
  for (uint8_t i = 0; i < NUM_LEDS; ++i) {
    appendByte(pixels[i][1], items, itemCount);  // GRB order
    appendByte(pixels[i][0], items, itemCount);
    appendByte(pixels[i][2], items, itemCount);
  }
  if (rmt_write_items(kLedRmtChannel, items, (int)itemCount, true) != ESP_OK) return;
  delayMicroseconds(80);
}

static void setPixel(uint8_t index, uint8_t r, uint8_t g, uint8_t b) {
  if (index >= NUM_LEDS) return;
  pixels[index][0] = scale(r);
  pixels[index][1] = scale(g);
  pixels[index][2] = scale(b);
}

void setupLED() {
  pinMode(LED_SIG, OUTPUT);
  digitalWrite(LED_SIG, LOW);
  rmt_config_t config = RMT_DEFAULT_CONFIG_TX((gpio_num_t)LED_SIG, kLedRmtChannel);
  config.clk_div = 8;  // 80 MHz APB / 8 = 10 MHz timing ticks
  if (rmt_config(&config) != ESP_OK) return;
  if (rmt_driver_install(kLedRmtChannel, 0, 0) != ESP_OK) return;
  rmtReady = true;
  showPixels();
}

void setLED(uint8_t r, uint8_t g, uint8_t b) {
  for (uint8_t i = 0; i < NUM_LEDS; ++i) setPixel(i, r, g, b);
  showPixels();
}

void ledTogglePairingWave(bool on) {
  pairingActive = on;
  if (!on) {
    LED_LOG("LED: BT pairing ended");
  }
}

void ledPairingWaveService() {
  if (!pairingActive) return;
  wavePhase += 5;
  uint8_t a = wavePhase < 128 ? wavePhase * 2 : 255 - ((wavePhase - 128) * 2);
  uint8_t b = 255 - a;
  setPixel(0, 0, 0, a);
  setPixel(1, 0, 0, b);
  showPixels();
}
