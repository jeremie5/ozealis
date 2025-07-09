//motor.h
#ifndef MOTOR_H
#define MOTOR_H

#include <Arduino.h>

/* ─── Phase pins  (high-side FET inputs or INx on DRV8313) ───── */
#define PHASE_U  12
#define PHASE_V  14
#define PHASE_W  13
#define MOT_EN    4

/* ─── LEDC setup ─────────────────────────────────────────────── */
constexpr uint8_t  PWM_BITS   = 8;            // 0-255 duty
constexpr uint32_t PWM_FREQ   = 25'000;       // 25 kHz keeps out of audio band
constexpr uint8_t  CH_U       = 0;
constexpr uint8_t  CH_V       = 1;
constexpr uint8_t  CH_W       = 2;

extern volatile uint16_t elecAngle;           // 0-255   (one turn = 256)
void   setupMotor();
void   setMotorAmplitude(uint8_t amp);        // 0-255 global scaling
void   restartMotor();                        // forced open-loop start-up
void   advanceElectricalAngle();              // called by BEMF ISR

#endif
