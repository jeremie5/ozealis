#ifndef BUZZER_H
#define BUZZER_H

#include <Arduino.h>
// Pins
#define BZR_SIG 27

void setupBuzzer();
void buzz(uint16_t duration_ms);

#endif
