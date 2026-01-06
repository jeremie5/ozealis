// motor.cpp  DRV8313 EN(PWM) + IN(direction) on ESP32
#include "motor.h"
#include <math.h>
#include <pgmspace.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <driver/gpio.h>
#include <driver/ledc.h>

/* 8-bit sine LUT 0..255 */
static const uint8_t sineLUT[256] PROGMEM = {
  128,131,134,137,140,143,146,149,152,155,158,162,165,167,170,173,
  176,179,182,185,188,190,193,196,198,201,203,206,208,211,213,215,
  218,220,222,224,226,228,230,232,234,235,237,238,240,241,243,244,
  245,246,248,249,250,250,251,252,253,253,254,254,254,255,255,255,
  255,255,255,255,254,254,254,253,253,252,251,250,250,249,248,246,
  245,244,243,241,240,238,237,235,234,232,230,228,226,224,222,220,
  218,215,213,211,208,206,203,201,198,196,193,190,188,185,182,179,
  176,173,170,167,165,162,158,155,152,149,146,143,140,137,134,131,
  128,124,121,118,115,112,109,106,103,100,97,93,90,88,85,82,
  79,76,73,70,67,65,62,59,57,54,52,49,47,44,42,40,
  37,35,33,31,29,27,25,23,21,20,18,17,15,14,12,11,
  10,9,7,6,5,5,4,3,2,2,1,1,1,0,0,0,
  0,0,0,0,1,1,1,2,2,3,4,5,5,6,7,9,
  10,11,12,14,15,17,18,20,21,23,25,27,29,31,33,35,
  37,40,42,44,47,49,52,54,57,59,62,65,67,70,73,76,
  79,82,85,88,90,93,97,100,103,106,109,112,115,118,121,124
};

/* ===== state machine ===== */
enum MotorState : uint8_t {
  MSTATE_IDLE = 0,
  MSTATE_PREKICK,
  MSTATE_ALIGN,
  MSTATE_RAMP,
  MSTATE_BEMF_WAIT,
  MSTATE_RESCUE,
  MSTATE_RUN
};

static volatile MotorState g_state = MSTATE_IDLE;
static bool    g_state_init       = false;

// align state
static uint8_t  g_align_try   = 0;
static uint8_t  g_align_step  = 0;

// ramp state
static uint16_t g_ramp_i      = 0;
static uint8_t  g_ramp_step   = 0;
static uint32_t g_ramp_next_us = 0;

// BEMF handoff
static uint32_t g_handoff_start_ms = 0;
static uint32_t g_bemf_e0          = 0;

// rescue
static uint32_t g_rescue_start_ms = 0;
static uint8_t  g_rescue_step     = 0;

// control task handle
static TaskHandle_t g_ctrlTask = nullptr;

/* public state */
volatile uint16_t elecAngle = 0;
volatile uint32_t bemfEdges = 0;

/* private state */
static uint8_t amplitude = 0;  // 0..255 magnitude

/* LEDC channel and pin maps: 0=U,1=V,2=W */
static const ledc_channel_t CHMAP[3] = { EN_CH_U, EN_CH_V, EN_CH_W };
static const int            ENPIN[3] = { EN_U_PIN, EN_V_PIN, EN_W_PIN };
static const int            INPIN[3] = { IN_U_PIN, IN_V_PIN, IN_W_PIN };

/* profile */
static MotorProfile g_prof;

/* ISR service / IRQ guards */
static bool s_isr_service_installed = false;
static bool s_irq_attached          = false;

/* state flags */
static volatile bool g_running   = false;   // driver awake + EN driving allowed
static volatile bool g_bemfOn    = false;   // logical enable for BEMF ISR gating
static volatile bool g_debug     = false;
static volatile bool g_drvFault = false; /* DRV8313 fault (nFAULT) */

/* commutation helpers */
static TaskHandle_t  g_commTask  = nullptr;
static volatile bool g_commPend  = false;

/* which phase is floating during 6-step (0=U,1=V,2=W) */
static volatile uint8_t g_floatPhase = 2;
static volatile bool    g_trapMode   = false;   // true when using trapStep()

/* BEMF edge debouncers and adaptive ZC */
static volatile uint32_t lastUsU = 0, lastUsV = 0, lastUsW = 0;
static volatile uint32_t lastPeriodUs = 0;      // rough recent ZC period

/* logging config */
static uint16_t      g_log_ms = 200;
static MotorLogFormat g_log_fmt = MLOG_HUMAN;
static uint8_t       g_log_level = 2;
static bool          g_log_enable = false;
static uint32_t      g_log_last = 0;
static uint32_t      g_edges_last = 0;
static uint32_t      g_hold_until = 0;

// ---------------------------------------------------------------
// Forward declarations for internal helpers (static functions)
// ---------------------------------------------------------------

// low-level PWM helpers
static void enWrite(uint8_t ph, uint8_t duty);
static uint32_t enRead(uint8_t ph);

// commutation primitives
static void trapStep(uint8_t step, uint8_t mag);
static void refreshSineVector();

// misc helpers
static void setPwmFreq(uint32_t hz);
static bool in_hold_window();
static int16_t lutSigned(uint8_t idx);
static void drivePolarity(uint8_t ph, bool high_side);

// internal stop
static void motorStopInternal();

/* -------- helpers -------- */
void IRAM_ATTR drvFaultISR() {
  g_drvFault = true;      // set flag, handled next control-task cycle
}

static void motorStopInternal() {
  motorAttachBemf(false);
  g_running = false;
  amplitude = 0;
  enWrite(0,0); enWrite(1,0); enWrite(2,0);
  digitalWrite(IN_U_PIN, LOW);
  digitalWrite(IN_V_PIN, LOW);
  digitalWrite(IN_W_PIN, LOW);
  digitalWrite(NSLEEP_PIN, LOW);
}

static void motorControlTask(void *arg){
  (void)arg;
  Serial.println("Motor: Control alive");
  for(;;){
    MotorState s = g_state;

    // global fault check (latched)
    if (g_drvFault) {
        g_drvFault = false;   // consume event

        Serial.println("DRV FAULT detected! Forcing motor stop.");

        // immediate safe stop using your existing primitive
        motorStopInternal();

        g_state = MSTATE_IDLE;
        g_state_init = false;
        vTaskDelay(pdMS_TO_TICKS(20)); // let the driver settle
        continue;                      // skip state machine this tick
    }

    switch (s) {

      case MSTATE_IDLE:
        // Nothing to do; sleep a bit
        vTaskDelay(pdMS_TO_TICKS(10));
        break;

      case MSTATE_PREKICK:
        if (!g_state_init) {
          g_state_init = true;
          // strong kick then drop to align magnitude
          trapStep(0, 255);
          g_rescue_start_ms = millis();   // reuse as pre-kick timer
        }
        if (millis() - g_rescue_start_ms >= g_prof.start_kick_ms) {
          trapStep(0, g_prof.align_mag);
          vTaskDelay(pdMS_TO_TICKS(10));  // small settle
          g_state      = (g_prof.multi_align_tries ? MSTATE_ALIGN : MSTATE_RAMP);
          g_state_init = false;
        } else {
          vTaskDelay(pdMS_TO_TICKS(1));
        }
        break;

      case MSTATE_ALIGN:
        if (!g_state_init) {
          g_state_init  = true;
          g_align_try   = 0;
          g_align_step  = 0;
          g_rescue_start_ms = millis(); // reused per-try timing
        }

        if (g_align_try >= max<uint8_t>(1, g_prof.multi_align_tries)) {
          // done with align attempts → go ramp
          g_state      = MSTATE_RAMP;
          g_state_init = false;
          break;
        }

        // per-try timing
        if (millis() - g_rescue_start_ms >= (uint32_t)g_prof.align_ms + 15) {
          uint8_t step = g_align_try % 6;
          trapStep(step, g_prof.align_mag);
          g_align_try++;
          g_rescue_start_ms = millis();
        }

        vTaskDelay(pdMS_TO_TICKS(1));
        break;

      case MSTATE_RAMP:
        if (!g_state_init) {
          g_state_init   = true;
          g_ramp_i       = 0;
          g_ramp_step    = 0;
          g_ramp_next_us = micros();
        }

        if (g_ramp_i >= g_prof.ramp_steps) {
          // end of ramp → BEMF handoff
          g_state      = MSTATE_BEMF_WAIT;
          g_state_init = false;
          break;
        }

        {
          uint32_t now_us = micros();
          if ((int32_t)(now_us - g_ramp_next_us) >= 0) {
            // compute dwell & mag for this step
            const int32_t dwell_span = (int32_t)g_prof.ramp_dwell_us0 - (int32_t)g_prof.ramp_dwell_us1;
            const int32_t mag_span   = (int32_t)g_prof.ramp_mag1      - (int32_t)g_prof.ramp_mag0;

            uint32_t dwell = g_prof.ramp_dwell_us0 -
                             (uint32_t)((dwell_span * (int32_t)g_ramp_i) / (int32_t)g_prof.ramp_steps);
            uint8_t  mag   = g_prof.ramp_mag0 +
                             (int32_t)((mag_span   * (int32_t)g_ramp_i) / (int32_t)g_prof.ramp_steps);

            trapStep(g_ramp_step, mag);
            g_ramp_step = (g_ramp_step + 1) % 6;
            g_ramp_i++;

            g_ramp_next_us = now_us + dwell;
          }
        }

        vTaskDelay(pdMS_TO_TICKS(1)); // yield to keep WDT happy
        break;

      case MSTATE_BEMF_WAIT:
        if (!g_state_init) {
          g_state_init       = true;
          motorAttachBemf(true);
          amplitude          = 255;
          refreshSineVector();
          g_hold_until       = millis() + g_prof.hold_ms;
          setPwmFreq(g_prof.run_pwm_hz);
          g_handoff_start_ms = millis();
          g_bemf_e0          = bemfEdges;
        }

        if ((bemfEdges - g_bemf_e0) > 5) {
          // lock acquired
          g_state      = MSTATE_RUN;
          g_state_init = false;
          break;
        }

        if (millis() - g_handoff_start_ms > g_prof.handoff_ms) {
          // no lock within window → rescue
          g_state      = MSTATE_RESCUE;
          g_state_init = false;
          break;
        }

        vTaskDelay(pdMS_TO_TICKS(5));
        break;

      case MSTATE_RESCUE:
        if (!g_state_init) {
          g_state_init        = true;
          g_rescue_start_ms   = millis();
          g_rescue_step       = 0;
        }

        if (millis() - g_rescue_start_ms > g_prof.rescue_ms) {
          // give up, stop the motor
          motorStopInternal();
          g_state      = MSTATE_IDLE;
          g_state_init = false;
          break;
        }

        // simple spinning rescue
        trapStep(g_rescue_step, g_prof.rescue_mag);
        g_rescue_step = (g_rescue_step + 1) % 6;

        // check for lock using your existing heuristic
        if (motorHasLock()) {
            amplitude = 255;
            refreshSineVector();
            g_state = MSTATE_RUN;
            g_state_init = false;
            break;
        }

        vTaskDelay(pdMS_TO_TICKS(1));
        break;

      case MSTATE_RUN:
        // motor is fully started; nothing to do here
        vTaskDelay(pdMS_TO_TICKS(10));
        break;
    }
  }
}

static inline void setPwmFreq(uint32_t hz){
  // one LEDC timer feeds all three channels
  ledc_set_freq(PWM_MODE, PWM_TIMER, hz);
}

static inline bool in_hold_window(){
  return millis() < g_hold_until;
}

static inline int16_t lutSigned(uint8_t idx){
  return (int16_t)pgm_read_byte(&sineLUT[idx]) - 128;
}

static inline void drivePolarity(uint8_t ph, bool high_side){
#if DRV8313_IN_HIGH_SELECTS_HIGHSIDE
  digitalWrite(INPIN[ph], high_side ? HIGH : LOW);
#else
  digitalWrite(INPIN[ph], high_side ? LOW : HIGH);
#endif
}

static inline void enWrite(uint8_t ph, uint8_t duty){
  ledc_set_duty(PWM_MODE, CHMAP[ph], duty);
  ledc_update_duty(PWM_MODE, CHMAP[ph]);
}
static inline uint32_t enRead(uint8_t ph){
  return ledc_get_duty(PWM_MODE, CHMAP[ph]);
}

/* phase driver: select polarity on INx, magnitude on ENx; mag 0 -> float */
static inline void setPhaseSigned(uint8_t ph, int16_t sVal){
  uint8_t mag = (uint8_t)min<int16_t>(abs(sVal), 255);
  if (!g_running || mag == 0) { enWrite(ph, 0); return; }

  // Apply minimums so real current actually flows
  if (g_trapMode) {
    if (mag < g_prof.trap_floor) mag = g_prof.trap_floor;
  } else if (in_hold_window()) {
    if (mag < g_prof.sine_floor) mag = g_prof.sine_floor;
  }

  drivePolarity(ph, sVal >= 0);
  enWrite(ph, mag);
}

/* write the current sine vector to all phases (task context) */
static void refreshSineVector(){
  g_trapMode = false;
  const int16_t u = (int16_t)((lutSigned((uint8_t)elecAngle)       * amplitude) >> 7);
  const int16_t v = (int16_t)((lutSigned((uint8_t)(elecAngle+85))  * amplitude) >> 7);
  const int16_t w = (int16_t)((lutSigned((uint8_t)(elecAngle+171)) * amplitude) >> 7);
  setPhaseSigned(0, u);
  setPhaseSigned(1, v);
  setPhaseSigned(2, w);
}

/* 6-step trapezoid (two phases on, one floating) */
static void trapStep(uint8_t step, uint8_t mag){
  g_trapMode = true;
  switch (step % 6){
    case 0: g_floatPhase = 2; setPhaseSigned(0, +mag); setPhaseSigned(1, -mag); setPhaseSigned(2, 0); break;
    case 1: g_floatPhase = 1; setPhaseSigned(0, +mag); setPhaseSigned(1, 0);    setPhaseSigned(2, -mag); break;
    case 2: g_floatPhase = 0; setPhaseSigned(0, 0);    setPhaseSigned(1, +mag); setPhaseSigned(2, -mag); break;
    case 3: g_floatPhase = 2; setPhaseSigned(0, -mag); setPhaseSigned(1, +mag); setPhaseSigned(2, 0); break;
    case 4: g_floatPhase = 1; setPhaseSigned(0, -mag); setPhaseSigned(1, 0);    setPhaseSigned(2, +mag); break;
    case 5: g_floatPhase = 0; setPhaseSigned(0, 0);    setPhaseSigned(1, -mag); setPhaseSigned(2, +mag); break;
  }
}

/* LEDC setup */
static void setupLEDC(){
  ledc_timer_config_t tcfg = {};
  tcfg.speed_mode      = PWM_MODE;
  tcfg.timer_num       = PWM_TIMER;
  tcfg.duty_resolution = LEDC_TIMER_8_BIT;
  tcfg.freq_hz         = g_prof.run_pwm_hz; // default; we may switch at start
  tcfg.clk_cfg         = LEDC_AUTO_CLK;
  ledc_timer_config(&tcfg);

  ledc_channel_config_t c = {};
  c.speed_mode = PWM_MODE;
  c.intr_type  = LEDC_INTR_DISABLE;
  c.timer_sel  = PWM_TIMER;
  c.hpoint     = 0;

  for (int i = 0; i < 3; ++i){
    c.channel  = CHMAP[i];
    c.gpio_num = ENPIN[i];
    c.duty     = 0;
    ledc_channel_config(&c);
  }

  Serial.printf("Motor: LEDC init: %lu Hz, 8-bit on EN pins (%d,%d,%d)\n",
                (unsigned long)ledc_get_freq(PWM_MODE, PWM_TIMER),
                ENPIN[0], ENPIN[1], ENPIN[2]);
}

/* commutation task: apply PWM in task context to keep ISR lean */
static void motorCommTask(void*){
  Serial.println("Motor: Comm alive");
  for(;;){
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    if (g_commPend){
      g_commPend = false;
      refreshSineVector();
    }
  }
}

/* adaptive ZC debounce */
static inline bool zc_ok(uint32_t now, volatile uint32_t& lastUs) {
  uint32_t dt  = now - lastUs;
  uint32_t dyn = lastPeriodUs ? (lastPeriodUs / 8) : 120;   // ~12.5% of recent period
  uint32_t minZC = dyn;
  if (minZC < g_prof.min_zc_us_floor) minZC = g_prof.min_zc_us_floor;
  if (minZC > g_prof.min_zc_us_ceil)  minZC = g_prof.min_zc_us_ceil;
  if (dt < minZC) return false;
  lastPeriodUs = dt;
  lastUs = now;
  return true;
}

/* ===== public API ===== */
void setupMotor(const MotorProfile& prof){
  g_prof = prof;

  if (!s_isr_service_installed) {
    esp_err_t err = gpio_install_isr_service(ESP_INTR_FLAG_IRAM);
    if (err == ESP_OK || err == ESP_ERR_INVALID_STATE) {
      s_isr_service_installed = true;
    } else {
      Serial.printf("Motor: gpio_install_isr_service err=0x%x\n", (unsigned)err);
    }
  }

  // hold driver asleep so pins can settle
  pinMode(NSLEEP_PIN, OUTPUT);
  digitalWrite(NSLEEP_PIN, LOW);

  // direction pins safe
  pinMode(IN_U_PIN, OUTPUT); digitalWrite(IN_U_PIN, LOW);
  pinMode(IN_V_PIN, OUTPUT); digitalWrite(IN_V_PIN, LOW);
  pinMode(IN_W_PIN, OUTPUT); digitalWrite(IN_W_PIN, LOW);

  #if BEMF_INTERNAL_PULLUP
    pinMode(BEMF_U_IN, INPUT_PULLUP);
    pinMode(BEMF_V_IN, INPUT_PULLUP);
    pinMode(BEMF_W_IN, INPUT_PULLUP);
  #else
    pinMode(BEMF_U_IN, INPUT);       // externals provide the pull-up
    pinMode(BEMF_V_IN, INPUT);
    pinMode(BEMF_W_IN, INPUT);
  #endif

  Serial.printf("Motor: BEMF pull-ups: %s\n",
                BEMF_INTERNAL_PULLUP ? "internal" : "external");

  // EN pins low before LEDC
  pinMode(EN_U_PIN, OUTPUT); digitalWrite(EN_U_PIN, LOW);
  pinMode(EN_V_PIN, OUTPUT); digitalWrite(EN_V_PIN, LOW);
  pinMode(EN_W_PIN, OUTPUT); digitalWrite(EN_W_PIN, LOW);

  setupLEDC();

  // DRV8313 nFAULT input
  pinMode(26, INPUT);                 // already has external 10k pull-up
  attachInterrupt(digitalPinToInterrupt(26),
                  drvFaultISR, FALLING);
  Serial.println("Motor: DRV fault IRQ attached");

  // Wake driver
  delay(2);
  Serial.printf("Motor: NSLEEP before=%d\n", digitalRead(NSLEEP_PIN));

  digitalWrite(NSLEEP_PIN, HIGH);
  delayMicroseconds(50);

  int ns = digitalRead(NSLEEP_PIN);
  if (ns == LOW) {
    Serial.println("Motor: NSLEEP toggle failed");
    return;
  }

  Serial.printf("Motor: NSLEEP after=%d\n", ns);
  delay(2);

  amplitude = 0;
  g_running = false;
  enWrite(0,0); enWrite(1,0); enWrite(2,0);

  // commutation task on core 0
  if (!g_commTask) {
    xTaskCreatePinnedToCore(motorCommTask, "motor_comm", 4096, nullptr, 3, &g_commTask, 0);
    Serial.println("Motor: Pinned commutation to core 0");
  }

  // control state machine task on core 0
  if (!g_ctrlTask) {
    xTaskCreatePinnedToCore(motorControlTask, "motor_ctrl", 4096, nullptr, 4, &g_ctrlTask, 0);
    Serial.println("Motor: Pinned control to core 0");
  }
  Serial.println("Motor: Setup completed");
}

uint8_t motorGetAmplitude(){ return amplitude; }

void setMotorAmplitude(uint8_t amp){
  uint8_t req = amp;
  if (g_running && in_hold_window()) {
    amp = (req < g_prof.hold_amp) ? g_prof.hold_amp : req;
  }
  amplitude = amp;
  if (!g_running) return;
  refreshSineVector();
}

bool motorIsStarting(){
  return (g_state != MSTATE_IDLE && g_state != MSTATE_RUN);
}

/* BEMF advance: +60 electrical deg per edge, ISR very lean */
void IRAM_ATTR advanceElectricalAngle(){
  elecAngle += 43;                 // 256 * 60/360
  g_commPend = true;
  if (g_commTask){
    BaseType_t hpw = pdFALSE;
    vTaskNotifyGiveFromISR(g_commTask, &hpw);
    if (hpw) portYIELD_FROM_ISR();
  }
}

/* ISR wrappers with float-phase gating and debounce */
void IRAM_ATTR bemfISR_U(){
  if (!g_bemfOn || !g_running || g_floatPhase != 0) return;
  uint32_t now = micros();
  if (zc_ok(now, lastUsU)) { bemfEdges++; advanceElectricalAngle(); }
}
void IRAM_ATTR bemfISR_V(){
  if (!g_bemfOn || !g_running || g_floatPhase != 1) return;
  uint32_t now = micros();
  if (zc_ok(now, lastUsV)) { bemfEdges++; advanceElectricalAngle(); }
}
void IRAM_ATTR bemfISR_W(){
  if (!g_bemfOn || !g_running || g_floatPhase != 2) return;
  uint32_t now = micros();
  if (zc_ok(now, lastUsW)) { bemfEdges++; advanceElectricalAngle(); }
}

static void attachBEMFInterruptsOnce() {
  if (s_irq_attached) return;
  attachInterrupt(digitalPinToInterrupt(BEMF_U_IN), bemfISR_U, CHANGE);
  attachInterrupt(digitalPinToInterrupt(BEMF_V_IN), bemfISR_V, CHANGE);
  attachInterrupt(digitalPinToInterrupt(BEMF_W_IN), bemfISR_W, CHANGE);
  s_irq_attached = true;
  Serial.println("BEMF IRQs attached");
}
static void detachBEMFInterrupts() {
  if (!s_irq_attached) return;
  detachInterrupt(digitalPinToInterrupt(BEMF_U_IN));
  detachInterrupt(digitalPinToInterrupt(BEMF_V_IN));
  detachInterrupt(digitalPinToInterrupt(BEMF_W_IN));
  s_irq_attached = false;
}

void motorAttachBemf(bool on) {
  if (on) {
    if (!g_running) return;
    if (digitalRead(NSLEEP_PIN) == LOW) return;
    lastUsU = lastUsV = lastUsW = micros();   // reset debounce
    g_bemfOn = true;
    attachBEMFInterruptsOnce();
  } else {
    g_bemfOn = false;
    detachBEMFInterrupts();
  }
}

void startMotor() {
  Serial.println("Motor: Starting");

  if (digitalRead(26) == LOW) {
      Serial.println("Motor: DRV faulted, refusing to start");
      return;
  }

  g_running = true;      
  g_state = MSTATE_PREKICK;
  g_state_init = false;

  // wake the driver
  digitalWrite(NSLEEP_PIN, HIGH);
}

void stopMotor(){
  g_state      = MSTATE_IDLE;
  g_state_init = false;
  motorStopInternal();
}

/* soft lock detector based on edge rate */
bool motorHasLock() {
  static uint32_t last_edges = 0, last_ms = 0;
  uint32_t now = millis();
  if (now - last_ms >= 200) {
    uint32_t de = bemfEdges - last_edges;
    last_edges = bemfEdges;
    last_ms = now;
    return de > 50;
  }
  return false;
}

/* ===== logging and debug ===== */
void motorLogConfigure(bool enable, uint16_t period_ms, MotorLogFormat fmt, uint8_t level){
  g_log_enable = enable;
  g_log_ms     = period_ms;
  g_log_fmt    = fmt;
  g_log_level  = level;
  g_log_last   = 0;
  g_edges_last = bemfEdges;
}
void motorEnableDebug(bool on){
  motorLogConfigure(on, 200, MLOG_HUMAN, 2);
}

void motorLogOnce(){
  uint32_t du = enRead(0), dv = enRead(1), dw = enRead(2);
  uint8_t  iu = digitalRead(IN_U_PIN), iv = digitalRead(IN_V_PIN), iw = digitalRead(IN_W_PIN);
  uint32_t edges = bemfEdges;
  uint32_t dE = edges >= g_edges_last ? (edges - g_edges_last) : 0;
  g_edges_last = edges;
  int bu = digitalRead(BEMF_U_IN), bv = digitalRead(BEMF_V_IN), bw = digitalRead(BEMF_W_IN);

  if (g_log_fmt == MLOG_CSV) {
    // time,amp,angle,ENu,ENv,ENw,INu,INv,INw,edges,dE,bemfU,bemfV,bemfW
    Serial.printf("%lu,%u,%u,%lu,%lu,%lu,%u,%u,%u,%lu,%lu,%d,%d,%d\n",
      (unsigned long)millis(), amplitude, (unsigned)(elecAngle & 0xFF),
      (unsigned long)du, (unsigned long)dv, (unsigned long)dw,
      iu, iv, iw, (unsigned long)edges, (unsigned long)dE, bu, bv, bw);
  } else {
    if (g_log_level >= 2) {
      Serial.printf("MDBG amp=%u angle=%u EN(U,V,W)=(%lu,%lu,%lu) IN(U,V,W)=(%u,%u,%u) edges=%lu dE=%lu bemf(U,V,W)=(%d,%d,%d)\n",
        amplitude, (unsigned)(elecAngle & 0xFF),
        (unsigned long)du, (unsigned long)dv, (unsigned long)dw,
        iu, iv, iw,
        (unsigned long)edges, (unsigned long)dE,
        bu, bv, bw);
    } else {
      Serial.printf("MDBG amp=%u angle=%u EN=(%lu,%lu,%lu) edges=%lu dE=%lu\n",
        amplitude, (unsigned)(elecAngle & 0xFF),
        (unsigned long)du, (unsigned long)dv, (unsigned long)dw,
        (unsigned long)edges, (unsigned long)dE);
    }
  }
}

void motorDebugService(){
  if (!g_log_enable) return;
  uint32_t now = millis();
  if (now - g_log_last >= g_log_ms) {
    g_log_last = now;
    motorLogOnce();
  }
}

/* Pin dump */
void motorDumpPins(){
  int ns = digitalRead(NSLEEP_PIN);
  int iu = digitalRead(IN_U_PIN), iv = digitalRead(IN_V_PIN), iw = digitalRead(IN_W_PIN);
  uint32_t du = ledc_get_duty(PWM_MODE, EN_CH_U);
  uint32_t dv = ledc_get_duty(PWM_MODE, EN_CH_V);
  uint32_t dw = ledc_get_duty(PWM_MODE, EN_CH_W);
  Serial.printf("PINS nSLEEP=%d IN(U,V,W)=(%d,%d,%d) EN(U,V,W)=(%lu,%lu,%lu)\n",
                ns, iu, iv, iw, (unsigned long)du, (unsigned long)dv, (unsigned long)dw);
}

/* Force one trapezoid step strongly */
void motorForceStep(uint8_t step, uint8_t mag, uint16_t ms){
  setPhaseSigned(0,0); setPhaseSigned(1,0); setPhaseSigned(2,0);
  delay(2);
  trapStep(step, mag);
  Serial.printf("FORCE step=%u mag=%u\n", step%6, mag);
  delay(ms);
  setPhaseSigned(0,0); setPhaseSigned(1,0); setPhaseSigned(2,0);
}
