#ifndef MOTOR_H
#define MOTOR_H

#include <Arduino.h>
#include <driver/ledc.h>

/* ---------------------------------------------------------------
   DRV8313 PIN MAP (Ozealis Rev2)
   --------------------------------------------------------------- */
#define EN_U_PIN   19    // PWM EN1
#define EN_V_PIN   18    // PWM EN2
#define EN_W_PIN    5    // PWM EN3

#define IN_U_PIN   12    // direction select 1
#define IN_V_PIN   14    // direction select 2
#define IN_W_PIN   13    // direction select 3

#define NSLEEP_PIN  17    // DRV8313 nSLEEP

#define BEMF_U_IN  32    // LM339 outputs
#define BEMF_V_IN  33
#define BEMF_W_IN  25

#define DRV_FAULT_PIN 26   // nFAULT, active low

/* Select internal pull-ups ONLY for Rev1 bring-up */
#ifndef BEMF_INTERNAL_PULLUP
# define BEMF_INTERNAL_PULLUP 0
#endif

#ifndef DRV8313_IN_HIGH_SELECTS_HIGHSIDE
# define DRV8313_IN_HIGH_SELECTS_HIGHSIDE 1
#endif

/* ---------------------------------------------------------------
   LEDC CONFIG
   --------------------------------------------------------------- */
constexpr uint8_t        PWM_BITS  = 8;
constexpr ledc_mode_t    PWM_MODE  = LEDC_LOW_SPEED_MODE;
constexpr ledc_timer_t   PWM_TIMER = LEDC_TIMER_0;

constexpr ledc_channel_t EN_CH_U = LEDC_CHANNEL_0;
constexpr ledc_channel_t EN_CH_V = LEDC_CHANNEL_1;
constexpr ledc_channel_t EN_CH_W = LEDC_CHANNEL_2;

/* ---------------------------------------------------------------
   PUBLIC MOTOR STATE (minimal + safe to read)
   --------------------------------------------------------------- */
extern volatile uint16_t elecAngle;   // 0..255 electrical angle
extern volatile uint32_t bemfEdges;   // BEMF edge count

/* ---------------------------------------------------------------
   MotorProfile: tuning knobs for startup, ramp, handoff, rescue
   --------------------------------------------------------------- */
struct MotorProfile {
  uint32_t start_pwm_hz     = 4000;
  uint32_t run_pwm_hz       = 25000;

  uint16_t align_ms         = 120;
  uint8_t  align_mag        = 255;

  uint16_t ramp_steps       = 1800;
  uint16_t ramp_dwell_us0   = 6000;
  uint16_t ramp_dwell_us1   = 300;
  uint8_t  ramp_mag0        = 245;
  uint8_t  ramp_mag1        = 255;

  uint16_t handoff_ms       = 300;
  uint16_t rescue_ms        = 4000;
  uint8_t  rescue_mag       = 255;

  uint8_t  trap_floor       = 140;
  uint8_t  sine_floor       = 100;
  uint8_t  hold_amp         = 255;
  uint16_t hold_ms          = 6000;

  uint8_t  start_kick_ms    = 20;
  uint8_t  multi_align_tries= 6;

  uint16_t min_zc_us_floor  = 60;
  uint16_t min_zc_us_ceil   = 300;
};

/* ---------------------------------------------------------------
   PUBLIC API
   --------------------------------------------------------------- */

// Initialize driver pins, LEDC, tasks
void setupMotor(const MotorProfile& prof = MotorProfile{});

// Non-blocking start (handled by control task)
void startMotor();

// Fully stop and sleep driver
void stopMotor();

// Set target amplitude in sine-commutation mode
void setMotorAmplitude(uint8_t amp);
uint8_t motorGetAmplitude();

// Running = driver awake AND motor not idle (may still be ramping)
bool motorIsRunning();

// Starting = in PREKICK / ALIGN / RAMP / BEMF_WAIT / RESCUE
bool motorIsStarting();

// True if rotor has stable BEMF feedback
bool motorHasLock();

// Attach/detach zero-cross interrupts manually (rare)
void motorAttachBemf(bool on);

/* ---------------------------------------------------------------
   Debug / diagnostics
   --------------------------------------------------------------- */

enum MotorLogFormat : uint8_t { MLOG_HUMAN = 0, MLOG_CSV = 1 };

void motorEnableDebug(bool on);
void motorLogConfigure(bool enable,
                       uint16_t period_ms = 200,
                       MotorLogFormat fmt = MLOG_HUMAN,
                       uint8_t level      = 2);

void motorDebugService();     // call from main loop
void motorLogOnce();          // single snapshot
void motorDumpPins();         // print instantaneous pin states
void motorForceStep(uint8_t step, uint8_t mag, uint16_t ms);

/* ---------------------------------------------------------------
   Compatibility
   --------------------------------------------------------------- */
inline void restartMotor() { startMotor(); }

/* drive enable/disable used by higher-level PAP logic */
inline void motorSetDriveEnabled(bool on) {
  if (on) startMotor();
  else    stopMotor();
}

/* trap keepalive is now a no-op (commutation fully task-based) */
inline void motorTrapKeepalive(uint16_t, uint8_t) {}

#endif  // MOTOR_H
