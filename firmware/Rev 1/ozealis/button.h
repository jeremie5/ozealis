#ifndef BUTTON_H
#define BUTTON_H

#include <Arduino.h>

#define BTN_SIG 34

void  setupButton();      // call once from setup()
void  pollButton();       // call every 50 ms in loop()

#endif
