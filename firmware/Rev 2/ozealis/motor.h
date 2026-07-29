#ifndef MOTOR_H
#define MOTOR_H

#include <Arduino.h>
#include <driver/ledc.h>

/* ---------------------------------------------------------------
   MCF8316D COMMAND PIN MAP
   --------------------------------------------------------------- */
#ifndef MOTOR_SPEED_PWM_PIN
# define MOTOR_SPEED_PWM_PIN 19
#endif

#ifndef MCF_DRVOFF_PIN
# define MCF_DRVOFF_PIN 17
#endif

#ifndef MCF_NFAULT_PIN
# define MCF_NFAULT_PIN 26
#endif

#ifndef MCF_FG_PIN
# define MCF_FG_PIN 33
#endif

#ifndef MCF_I2C_ADDR
# define MCF_I2C_ADDR 0x01
#endif

#ifndef OZEALIS_BENCH_PWM_SPEED_FALLBACK
# define OZEALIS_BENCH_PWM_SPEED_FALLBACK 0
#endif

#ifndef OZEALIS_MCF8316D_I2C_SPEED
# define OZEALIS_MCF8316D_I2C_SPEED 1
#endif

#ifndef MCF_I2C_TRANSACTION_HZ
# define MCF_I2C_TRANSACTION_HZ 10000
#endif

#ifndef OZEALIS_WIRE_DEFAULT_HZ
# define OZEALIS_WIRE_DEFAULT_HZ 100000
#endif

/* ---------------------------------------------------------------
   LEDC CONFIG
   --------------------------------------------------------------- */
constexpr uint8_t        MOTOR_PWM_BITS  = 8;
constexpr ledc_mode_t    MOTOR_PWM_MODE  = LEDC_LOW_SPEED_MODE;
constexpr ledc_timer_t   MOTOR_PWM_TIMER = LEDC_TIMER_0;
constexpr ledc_channel_t MOTOR_SPEED_CH  = LEDC_CHANNEL_0;

struct MotorProfile {
  uint32_t command_pwm_hz = 25000;
};

void setupMotor(const MotorProfile& prof = MotorProfile{});
void startMotor();
// Immediately assert the hardware disable pin without waiting for I2C.
// Fault handling uses this before any best-effort diagnostic work.
void motorEmergencyDisable();
void stopMotor();

void setMotorAmplitude(uint8_t amp);
uint8_t motorGetAmplitude();
uint16_t motorGetCommand();
float motorGetFgHz();

bool motorIsRunning();
bool motorIsStarting();
bool motorHasLock();
bool motorFaultActive();
bool motorDriverI2cPresent();
// Command readiness, not just chip presence: false when the speed-command transport is disabled.
bool motorDriverReady();
bool motorClearFault();
String motorMcfParamsJson();

void motorDumpPins();

inline void restartMotor() { startMotor(); }

inline void motorSetDriveEnabled(bool on) {
  if (on) startMotor();
  else    stopMotor();
}

#endif  // MOTOR_H
