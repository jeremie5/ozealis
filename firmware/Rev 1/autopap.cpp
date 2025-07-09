#include "autopap.h"
#include "sensor.h"
#include "ble.h"    
#include "logic.h"

// ─── Internal state ────────────────────────────────────────────────────
static float  epap_cm      = 5.0f;          // titrated baseline
static float  ipap_cm      = 9.0f;          // epap + Δ
static float  lastDiff     = 0.0f;          // signed flow proxy

static TherapyMode mode    = MODE_CpapAuto;
static const uint16_t BUF_SZ = 120;         // ≈2 min @1 Hz
static float  peakBuf[BUF_SZ];
static uint8_t peakIdx     = 0;
static bool   bufFilled    = false;

static uint32_t lastEventMs  = 0;
static uint32_t lastBreathMs = 0;
static uint8_t  flowLimCtr   = 0;

// phase tracker
enum Phase : uint8_t { EXP = 0, INSP };
static Phase phase = EXP;

// helpers (≈1 hPa = 1.02 cm H₂O)
static inline float cm2hPa(float cm)  { return cm * 0.98f; }
static inline float hPa2cm(float hPa) { return hPa * 1.02f; }

// ─── Public API ────────────────────────────────────────────────────────
void setupAutoPap() {
  mode      = settings.mode;        // flash-stored user pref
  epap_cm   = constrain(5.0f, settings.pMin, settings.pMax);
  ipap_cm   = epap_cm + settings.deltaCm;
}

TherapyMode getTherapyMode()          { return mode;        }
void setTherapyMode(TherapyMode m)    { mode = m;           }
float getDeltaCm()                    { return settings.deltaCm; }
void  setDeltaCm(float d)             { settings.deltaCm = d; }

float getEstimatedFlow()              { return lastDiff;    }

float getPressureSetpoint()
{
  if (mode == MODE_BiPapAuto)
    return (phase == INSP) ? ipap_cm : epap_cm;
  else
    return epap_cm;                   // single-pressure Auto-CPAP
}

// ─── Main update loop (call every control tick) ‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐‐
void updateAutoPap(float diff_hPa)
{
  /* ---------- Breath segmentation ---------- */
  static float lp = 0.0f;             // simple low-pass
  static bool  lastSign = false;      // true = inhale
  static float peakFlow = 0.0f;

  lp = lp * 0.8f + diff_hPa * 0.2f;
  bool signNow = lp >= 0;
  if (signNow && lp > peakFlow) peakFlow = lp;

  uint32_t now = millis();

  // Inhale → exhale: store peak, update baseline, flow-limit decisions
  if (!signNow && lastSign) {
    peakBuf[peakIdx++] = peakFlow;
    if (peakIdx >= BUF_SZ) { peakIdx = 0; bufFilled = true; }
    peakFlow = 0;
    lastBreathMs = now;

    // baseline
    uint16_t count = bufFilled ? BUF_SZ : peakIdx;
    float sum = 0;
    for (uint16_t i = 0; i < count; ++i) sum += peakBuf[i];
    float baseline = (count ? sum / count : 1.0f);
    float ratio = (baseline > 0.01f) ?
                  peakBuf[(peakIdx + BUF_SZ - 1) % BUF_SZ] / baseline : 1.0f;

    /* ----- Rise decisions (flow limit) ----- */
    bool didRise = false;
    if (ratio < FLOW_LIMIT_RATIO) {
      if (++flowLimCtr >= 3) {         // three bad breaths in a row
        epap_cm += HYPO_RISE_CM;
        didRise = true;
        flowLimCtr = 0;
      }
    } else flowLimCtr = 0;

    /* rate-limit */
    if (didRise && (now - lastEventMs < MAX_RISE_RATE_MS))
      epap_cm -= HYPO_RISE_CM;         // undo if too soon
    if (didRise) lastEventMs = now;
  }

  // Phase transitions
  if (signNow && !lastSign)            // exhale → inhale
    phase = INSP;
  else if (!signNow && lastSign)       // inhale → exhale
    phase = EXP;

  lastSign = signNow;
  lastDiff = diff_hPa;

  /* ---------- Apnea bump ---------- */
  if (now - lastBreathMs > APNEA_TIMEOUT_MS &&
      now - lastEventMs  > MAX_RISE_RATE_MS)
  {
    epap_cm += APNEA_RISE_CM;
    lastEventMs = now;
  }

  /* ---------- Comfort decay ---------- */
  if (epap_cm > settings.pMin + DECAY_STEP_CM &&
      now - lastEventMs > DECAY_AFTER_MS)
  {
    epap_cm -= DECAY_STEP_CM;
    lastEventMs = now;
  }

  /* ---------- Clamp + propagate ---------- */
  epap_cm = constrain(epap_cm, settings.pMin, settings.pMax);
  ipap_cm = constrain(epap_cm + settings.deltaCm,
                      epap_cm + 1.0f, settings.pMax + settings.deltaCm);

  // optional: safety guard
  if (ipap_cm > settings.pMax + 2.0f) fault(F_OVR_PRESS);
}

void logFlowState()
{
  Serial.printf("%s | Flow %+5.2f | EPAP %.2f | IPAP %.2f | buf %u\n",
                (mode == MODE_BiPapAuto && phase == INSP) ? "INSP" : "EXP ",
                lastDiff, epap_cm, ipap_cm, peakIdx);
}
