#include "buzzer.h"

// ── Buzzer handling ──
void setupBuzzer() {
  pinMode(BZR_SIG, OUTPUT);
  digitalWrite(BZR_SIG, LOW);
}

void buzz(uint16_t ms) {
  Serial.println("Buzzer: playing");
  digitalWrite(BZR_SIG, HIGH);
  delay(ms);
  digitalWrite(BZR_SIG, LOW);
}
