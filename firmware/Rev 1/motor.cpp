//motor.cpp
#include "motor.h"

/* ────────────────────────────────────────────────────────────── */
/*  8-bit sine lookup table, 0-255  →  0-255 duty                */
/*  (positive-only; phase shift handled in indexing)             */
static const uint8_t sineLUT[256] PROGMEM = {
128, 131, 134, 137, 140, 143, 146, 149, 152, 155, 158, 162, 165, 167, 170, 173,
176, 179, 182, 185, 188, 190, 193, 196, 198, 201, 203, 206, 208, 211, 213, 215,
218, 220, 222, 224, 226, 228, 230, 232, 234, 235, 237, 238, 240, 241, 243, 244,
245, 246, 248, 249, 250, 250, 251, 252, 253, 253, 254, 254, 254, 255, 255, 255,
255, 255, 255, 255, 254, 254, 254, 253, 253, 252, 251, 250, 250, 249, 248, 246,
245, 244, 243, 241, 240, 238, 237, 235, 234, 232, 230, 228, 226, 224, 222, 220,
218, 215, 213, 211, 208, 206, 203, 201, 198, 196, 193, 190, 188, 185, 182, 179,
176, 173, 170, 167, 165, 162, 158, 155, 152, 149, 146, 143, 140, 137, 134, 131,
128, 124, 121, 118, 115, 112, 109, 106, 103, 100, 97, 93, 90, 88, 85, 82,
79, 76, 73, 70, 67, 65, 62, 59, 57, 54, 52, 49, 47, 44, 42, 40,
37, 35, 33, 31, 29, 27, 25, 23, 21, 20, 18, 17, 15, 14, 12, 11,
10, 9, 7, 6, 5, 5, 4, 3, 2, 2, 1, 1, 1, 0, 0, 0,
0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 5, 5, 6, 7, 9,
10, 11, 12, 14, 15, 17, 18, 20, 21, 23, 25, 27, 29, 31, 33, 35,
37, 40, 42, 44, 47, 49, 52, 54, 57, 59, 62, 65, 67, 70, 73, 76,
79, 82, 85, 88, 90, 93, 97, 100, 103, 106, 109, 112, 115, 118, 121, 124
};

volatile uint16_t elecAngle = 0;   // updated by BEMF ISR
static uint8_t   amplitude = 0;    // global 0-255 scaling

/* Map electrical angle to three 120-deg-shifted phase indexes */
static inline uint8_t phaseU(uint16_t ang) { return  ang       & 0xFF; }        //   0°
static inline uint8_t phaseV(uint16_t ang) { return (ang + 85) & 0xFF; }        // +120°
static inline uint8_t phaseW(uint16_t ang) { return (ang +171) & 0xFF; }        // +240°

/* ───── helper: write duty to phase pin (unipolar PWM) ─────── */
static inline void writePhase(uint8_t chan, uint8_t duty)
{
  ledcWrite(chan, ((uint16_t)duty * amplitude) >> 8); // scale by amplitude
}

/* ───── apply current electrical angle to all three phases ─── */
static inline void refreshPWM()
{
  writePhase(CH_U, pgm_read_byte(&sineLUT[ phaseU(elecAngle) ]));
  writePhase(CH_V, pgm_read_byte(&sineLUT[ phaseV(elecAngle) ]));
  writePhase(CH_W, pgm_read_byte(&sineLUT[ phaseW(elecAngle) ]));
}

/* ───────────────────────────────────────────────────────────── */

void setupMotor()
{
  pinMode(MOT_EN, OUTPUT);
  digitalWrite(MOT_EN, HIGH);

  /* LEDC @ 25 kHz, 8-bit on three channels */
  ledcSetup(CH_U, PWM_FREQ, PWM_BITS);
  ledcSetup(CH_V, PWM_FREQ, PWM_BITS);
  ledcSetup(CH_W, PWM_FREQ, PWM_BITS);

  ledcAttachPin(PHASE_U, CH_U);
  ledcAttachPin(PHASE_V, CH_V);
  ledcAttachPin(PHASE_W, CH_W);

  amplitude = 0;
  refreshPWM();
}

/* global amplitude 0-255 (set by PID / GUI) */
void setMotorAmplitude(uint8_t amp)
{
  amplitude = amp;                 // ISR-safe (8-bit)
}

/* ISR hook – advance by 60 electrical degrees per BEMF edge */
void IRAM_ATTR advanceElectricalAngle()
{
  elecAngle += 43;                 // 256 * 60/360 ≈ 43
  refreshPWM();
}

/* BEMF ISR wrappers (attach to U,V,W zero-cross comparators) */
void IRAM_ATTR bemfISR_U(){ advanceElectricalAngle(); }
void IRAM_ATTR bemfISR_V(){ advanceElectricalAngle(); }
void IRAM_ATTR bemfISR_W(){ advanceElectricalAngle(); }

void attachBEMFInterrupts()
{
  pinMode(32, INPUT);
  pinMode(33, INPUT);
  pinMode(25, INPUT);

  attachInterrupt(digitalPinToInterrupt(32), bemfISR_U, RISING);
  attachInterrupt(digitalPinToInterrupt(33), bemfISR_V, RISING);
  attachInterrupt(digitalPinToInterrupt(25), bemfISR_W, RISING);
}

/* ─── Open-loop “forced start” using sine ramp ─────────────── */
void restartMotor()
{
  constexpr uint16_t startAmp   = 30;
  constexpr uint16_t finalAmp   = 128;
  constexpr uint16_t rampSteps  = 120;   // ≈3 revolutions
  uint16_t amp = startAmp;

  for (uint16_t i = 0; i < rampSteps; ++i)
  {
    setMotorAmplitude(amp);
    refreshPWM();
    elecAngle += 2;                       // slow advance
    delayMicroseconds(3000);
    if (amp < finalAmp) amp++;
  }

  attachBEMFInterrupts();                 // hand over to closed loop
  setMotorAmplitude(finalAmp);
}
