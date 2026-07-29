// motor.cpp  MCF8316D speed-command wrapper
#include "motor.h"
#include <driver/gpio.h>
#include <driver/ledc.h>
#include <Wire.h>

#ifndef OZEALIS_MOTOR_SERIAL_LOG
#define OZEALIS_MOTOR_SERIAL_LOG 0
#endif

#if OZEALIS_MOTOR_SERIAL_LOG
#define MOTOR_LOG_PRINTLN(message) Serial.println(message)
#define MOTOR_LOG_PRINTF(...) Serial.printf(__VA_ARGS__)
#else
#define MOTOR_LOG_PRINTLN(message) do { } while (0)
#define MOTOR_LOG_PRINTF(...) do { } while (0)
#endif

static MotorProfile g_prof;
static volatile bool g_running = false;
static volatile bool g_faultLatched = false;
static volatile uint32_t g_fgPulses = 0;
static uint8_t g_amplitude = 0;
static uint16_t g_commandProxy = 0;
static bool g_i2cPresent = false;
static bool g_i2cSpeedReadbackValid = false;
static float g_fgHz = 0.0f;
static uint32_t g_fgLastSampleMs = 0;
static uint32_t g_fgLastPulses = 0;

static bool commandTransportReady();
static bool probeDriverI2c();
static bool writeCommand(uint8_t amp);
static bool verifyI2cSpeedReadyIfIdle();
static void writeDrvOff(bool disabled);
static void sampleFg();

static constexpr uint16_t MCF_REG_ALGO_DEBUG1 = 0x00EC;
static constexpr uint16_t MCF_REG_ALGO_CTRL1 = 0x00EA;
static constexpr uint32_t MCF_ALGO_DEBUG1_OVERRIDE = 0x80000000UL;
static constexpr uint32_t MCF_ALGO_CTRL1_CLR_FLT = 0x20000000UL;

void IRAM_ATTR mcfFaultISR() {
  g_faultLatched = true;
}

void IRAM_ATTR mcfFgISR() {
  ++g_fgPulses;
}

static void writeDrvOff(bool disabled) {
#if MCF_DRVOFF_PIN >= 0
  digitalWrite(MCF_DRVOFF_PIN, disabled ? HIGH : LOW);
#else
  (void)disabled;
#endif
}

static bool commandTransportReady() {
#if OZEALIS_MCF8316D_I2C_SPEED
  return g_i2cSpeedReadbackValid;
#else
  return OZEALIS_BENCH_PWM_SPEED_FALLBACK != 0;
#endif
}

static void writeMotorCommandProxy(uint8_t amp) {
  g_amplitude = amp;
  g_commandProxy = map(amp, 0, 255, 0, (1 << MOTOR_PWM_BITS) - 1);
}

static void restoreWireClock() {
  Wire.setClock(OZEALIS_WIRE_DEFAULT_HZ);
}

static bool mcfWrite32(uint16_t reg, uint32_t value) {
  Wire.setClock(MCF_I2C_TRANSACTION_HZ);
  const uint8_t control0 = 0x10;  // write, CRC disabled, 32-bit data length
  const uint8_t control1 = (uint8_t)((reg >> 8) & 0x0f);
  const uint8_t control2 = (uint8_t)(reg & 0xff);
  for (uint8_t attempt = 0; attempt < 5; ++attempt) {
    Wire.beginTransmission(MCF_I2C_ADDR);
    Wire.write(control0);
    delayMicroseconds(100);
    Wire.write(control1);
    delayMicroseconds(100);
    Wire.write(control2);
    delayMicroseconds(100);
    Wire.write((uint8_t)(value & 0xff));
    delayMicroseconds(100);
    Wire.write((uint8_t)((value >> 8) & 0xff));
    delayMicroseconds(100);
    Wire.write((uint8_t)((value >> 16) & 0xff));
    delayMicroseconds(100);
    Wire.write((uint8_t)((value >> 24) & 0xff));
    const uint8_t result = Wire.endTransmission();
    delayMicroseconds(100);
    if (result == 0) {
      restoreWireClock();
      return true;
    }
  }
  restoreWireClock();
  return false;
}

static bool mcfRead32(uint16_t reg, uint32_t& value) {
  Wire.setClock(MCF_I2C_TRANSACTION_HZ);
  const uint8_t control0 = 0x90;  // read, CRC disabled, 32-bit data length
  const uint8_t control1 = (uint8_t)((reg >> 8) & 0x0f);
  const uint8_t control2 = (uint8_t)(reg & 0xff);
  for (uint8_t attempt = 0; attempt < 5; ++attempt) {
    Wire.beginTransmission(MCF_I2C_ADDR);
    Wire.write(control0);
    delayMicroseconds(100);
    Wire.write(control1);
    delayMicroseconds(100);
    Wire.write(control2);
    uint8_t result = Wire.endTransmission(false);
    delayMicroseconds(100);
    if (result != 0) continue;
    const uint8_t got = Wire.requestFrom((uint8_t)MCF_I2C_ADDR, (uint8_t)4, (uint8_t)true);
    if (got == 4) {
      const uint32_t b0 = Wire.read();
      const uint32_t b1 = Wire.read();
      const uint32_t b2 = Wire.read();
      const uint32_t b3 = Wire.read();
      value = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
      restoreWireClock();
      return true;
    }
  }
  restoreWireClock();
  return false;
}

static uint32_t i2cSpeedWord(uint8_t amp) {
  const uint32_t speed = map(amp, 0, 255, 0, 32767);
  return MCF_ALGO_DEBUG1_OVERRIDE | ((speed & 0x7fffUL) << 16);
}

static bool writeI2cSpeedCommand(uint8_t amp) {
  const uint32_t command = i2cSpeedWord(amp);
  if (!mcfWrite32(MCF_REG_ALGO_DEBUG1, command)) return false;
  uint32_t readback = 0;
  if (!mcfRead32(MCF_REG_ALGO_DEBUG1, readback)) return false;
  return (readback & 0xffff0000UL) == command;
}

static bool clearMcfLatchedFaults() {
  if (!probeDriverI2c()) return false;
  if (!mcfWrite32(MCF_REG_ALGO_CTRL1, MCF_ALGO_CTRL1_CLR_FLT)) return false;
  delay(10);
  return probeDriverI2c();
}

static bool verifyI2cSpeedReadyIfIdle() {
#if OZEALIS_MCF8316D_I2C_SPEED
  if (g_running || g_amplitude != 0 || g_faultLatched) return g_i2cSpeedReadbackValid;
  if (!probeDriverI2c()) {
    g_i2cSpeedReadbackValid = false;
    return false;
  }
  g_i2cSpeedReadbackValid = writeI2cSpeedCommand(0);
  writeMotorCommandProxy(0);
  return g_i2cSpeedReadbackValid;
#else
  return commandTransportReady();
#endif
}

static bool writeCommand(uint8_t amp) {
#if OZEALIS_MCF8316D_I2C_SPEED
  if (!probeDriverI2c()) {
    g_i2cSpeedReadbackValid = false;
    amp = 0;
  }
  const bool ok = writeI2cSpeedCommand(amp);
  g_i2cSpeedReadbackValid = ok;
  if (!ok) amp = 0;
  writeMotorCommandProxy(amp);
  return ok;
#else
  if (!commandTransportReady()) amp = 0;
  writeMotorCommandProxy(amp);
  ledc_set_duty(MOTOR_PWM_MODE, MOTOR_SPEED_CH, g_commandProxy);
  ledc_update_duty(MOTOR_PWM_MODE, MOTOR_SPEED_CH);
  return commandTransportReady();
#endif
}

static void configurePwm(uint32_t hz) {
  ledc_timer_config_t timer = {};
  timer.speed_mode = MOTOR_PWM_MODE;
  timer.timer_num = MOTOR_PWM_TIMER;
  timer.duty_resolution = (ledc_timer_bit_t)MOTOR_PWM_BITS;
  timer.freq_hz = hz;
  timer.clk_cfg = LEDC_AUTO_CLK;
  ledc_timer_config(&timer);

  ledc_channel_config_t channel = {};
  channel.gpio_num = MOTOR_SPEED_PWM_PIN;
  channel.speed_mode = MOTOR_PWM_MODE;
  channel.channel = MOTOR_SPEED_CH;
  channel.intr_type = LEDC_INTR_DISABLE;
  channel.timer_sel = MOTOR_PWM_TIMER;
  channel.duty = 0;
  channel.hpoint = 0;
  ledc_channel_config(&channel);
}

static bool probeDriverI2c() {
  Wire.beginTransmission(MCF_I2C_ADDR);
  g_i2cPresent = (Wire.endTransmission() == 0);
  return g_i2cPresent;
}

static void sampleFg() {
#if MCF_FG_PIN >= 0
  const uint32_t now = millis();
  if (g_fgLastSampleMs == 0) {
    g_fgLastSampleMs = now;
    g_fgLastPulses = g_fgPulses;
    g_fgHz = 0.0f;
    return;
  }
  const uint32_t elapsed = now - g_fgLastSampleMs;
  if (elapsed < 250) return;
  const uint32_t pulses = g_fgPulses;
  const uint32_t delta = pulses - g_fgLastPulses;
  g_fgHz = (delta * 1000.0f) / (float)elapsed;
  g_fgLastPulses = pulses;
  g_fgLastSampleMs = now;
#else
  g_fgHz = 0.0f;
#endif
}

void setupMotor(const MotorProfile& prof) {
  g_prof = prof;
  configurePwm(g_prof.command_pwm_hz);

#if MCF_DRVOFF_PIN >= 0
  pinMode(MCF_DRVOFF_PIN, OUTPUT);
  writeDrvOff(true);
#endif

#if MCF_NFAULT_PIN >= 0
  pinMode(MCF_NFAULT_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(MCF_NFAULT_PIN), mcfFaultISR, FALLING);
#endif

#if MCF_FG_PIN >= 0
  pinMode(MCF_FG_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(MCF_FG_PIN), mcfFgISR, FALLING);
#endif

  writeCommand(0);
  probeDriverI2c();
  sampleFg();
#if OZEALIS_MCF8316D_I2C_SPEED
  verifyI2cSpeedReadyIfIdle();
  if (g_i2cSpeedReadbackValid) {
    MOTOR_LOG_PRINTLN("Motor: MCF8316D I2C speed command readback verified");
  } else {
    MOTOR_LOG_PRINTLN("Motor: MCF8316D I2C speed command readback not verified");
  }
#else
  if (commandTransportReady()) {
    MOTOR_LOG_PRINTF("Motor: BENCH PWM fallback on GPIO %d at %lu Hz\n",
                     MOTOR_SPEED_PWM_PIN,
                     (unsigned long)g_prof.command_pwm_hz);
  } else {
    MOTOR_LOG_PRINTLN("Motor: speed command disabled until MCF8316D I2C speed writes are implemented");
  }
#endif
  MOTOR_LOG_PRINTF("Motor: MCF8316D I2C addr=0x%02x present=%u\n",
                   MCF_I2C_ADDR,
                   (unsigned)g_i2cPresent);
}

void startMotor() {
  if (!verifyI2cSpeedReadyIfIdle()) {
    MOTOR_LOG_PRINTLN("Motor: I2C speed command readback not verified, start ignored");
    stopMotor();
    return;
  }
  if (!motorDriverReady()) {
    MOTOR_LOG_PRINTLN("Motor: MCF not ready, start ignored");
    return;
  }
  writeDrvOff(false);
  g_running = true;
}

void motorEmergencyDisable() {
  writeDrvOff(true);
  g_running = false;
}

void stopMotor() {
  motorEmergencyDisable();
  writeCommand(0);
}

void setMotorAmplitude(uint8_t amp) {
  if (!g_running && amp > 0) startMotor();
  if (amp > 0 && !motorDriverReady()) {
    stopMotor();
    return;
  }
  if (g_faultLatched) {
    stopMotor();
    return;
  }
  if (!writeCommand(g_running ? amp : 0)) {
    g_faultLatched = true;
    stopMotor();
  }
}

uint8_t motorGetAmplitude() {
  return g_amplitude;
}

uint16_t motorGetCommand() {
  return g_commandProxy;
}

float motorGetFgHz() {
  sampleFg();
  return g_fgHz;
}

bool motorIsRunning() {
  return g_running;
}

bool motorIsStarting() {
  return false;
}

bool motorHasLock() {
  return g_running && !g_faultLatched;
}

bool motorFaultActive() {
#if MCF_NFAULT_PIN >= 0
  if (digitalRead(MCF_NFAULT_PIN) == LOW) {
    g_faultLatched = true;
  }
#endif
  return g_faultLatched;
}

bool motorDriverI2cPresent() {
  return probeDriverI2c();
}

bool motorDriverReady() {
  if (!verifyI2cSpeedReadyIfIdle()) return false;
  if (!probeDriverI2c()) {
    g_faultLatched = true;
    return false;
  }
  return !motorFaultActive();
}

bool motorClearFault() {
  if (!probeDriverI2c()) return false;
  if (!clearMcfLatchedFaults()) return false;
#if MCF_NFAULT_PIN >= 0
  if (digitalRead(MCF_NFAULT_PIN) == LOW) return false;
#endif
#if OZEALIS_MCF8316D_I2C_SPEED
  g_i2cSpeedReadbackValid = writeI2cSpeedCommand(0);
  writeMotorCommandProxy(0);
  if (!g_i2cSpeedReadbackValid) return false;
#else
  if (!commandTransportReady()) return false;
#endif
#if MCF_NFAULT_PIN >= 0
  if (digitalRead(MCF_NFAULT_PIN) == LOW) return false;
#endif
  g_faultLatched = false;
  return true;
}

static float finiteMcfSnapshotNumber(float value, float fallback, float minValue, float maxValue) {
  if (!isfinite(value)) return fallback;
  if (value < minValue) return fallback;
  if (value > maxValue) return fallback;
  return value;
}

String motorMcfParamsJson() {
  const bool i2cPresent = motorDriverI2cPresent();
  const bool faultActive = motorFaultActive();
  if (i2cPresent && !faultActive) verifyI2cSpeedReadyIfIdle();
  const bool i2cSpeed = OZEALIS_MCF8316D_I2C_SPEED != 0 && g_i2cSpeedReadbackValid;
  const bool benchFallback = OZEALIS_MCF8316D_I2C_SPEED == 0 && commandTransportReady();
  const bool ready = commandTransportReady() && i2cPresent && !faultActive;
  const float statusFgHz = finiteMcfSnapshotNumber(motorGetFgHz(), 0.0f, 0.0f, 100000.0f);
  char out[448];
  snprintf(out, sizeof(out),
           "{\"driver\":\"MCF8316D\",\"state\":\"%s\","
           "\"i2c\":%s,\"fault\":%s,\"i2cAddr\":\"0x%02x\",\"fgHz\":%.2f,"
           "\"commandAmp\":%u,\"commandPwm\":%u,"
           "\"runtimeSpeed\":\"%s\",\"targetSpeed\":\"i2c\","
           "\"commandReady\":%s,\"writesAllowed\":false,\"benchOnly\":%s,"
           "\"pins\":{\"speedPwm\":%d,\"drvOff\":%d,\"nFault\":%d,\"fg\":%d}}",
           i2cSpeed ? "readback_valid" : "register_layer_pending",
           i2cPresent ? "true" : "false",
           faultActive ? "true" : "false",
           MCF_I2C_ADDR,
           statusFgHz,
           (unsigned)motorGetAmplitude(),
           (unsigned)motorGetCommand(),
           i2cSpeed ? "i2c" : (benchFallback ? "bench_pwm_fallback" : "disabled_until_i2c_speed"),
           ready ? "true" : "false",
           benchFallback ? "true" : "false",
           MOTOR_SPEED_PWM_PIN,
           MCF_DRVOFF_PIN,
           MCF_NFAULT_PIN,
           MCF_FG_PIN);
  return String(out);
}

void motorDumpPins() {
#if MCF_NFAULT_PIN >= 0
  int faultLevel = digitalRead(MCF_NFAULT_PIN);
#else
  int faultLevel = -1;
#endif
  MOTOR_LOG_PRINTF("Motor pins: speed_gpio=%d drvOff_gpio=%d nFault_gpio=%d fg_gpio=%d nFault=%d amp=%u cmd=%u fg_hz=%.2f i2c=%u\n",
                   MOTOR_SPEED_PWM_PIN,
                   MCF_DRVOFF_PIN,
                   MCF_NFAULT_PIN,
                   MCF_FG_PIN,
                   faultLevel,
                   (unsigned)g_amplitude,
                   (unsigned)g_commandProxy,
                   motorGetFgHz(),
                   (unsigned)g_i2cPresent);
}
