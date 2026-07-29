#ifndef MOTOR_CALIBRATION_H
#define MOTOR_CALIBRATION_H

#include <Arduino.h>

struct MotorCalibrationProfile {
  bool valid = false;
  bool curveValid = false;
  uint8_t minAmp = 30;
  uint8_t maxAmp = 180;
  float gainCmPerAmp = 1.0f / 16.0f;
  float maxPressureCm = 0.0f;
  uint32_t calibratedAtMs = 0;
  uint8_t curveAmp[17] = {};
};

struct MotorCalibrationPlan {
  uint8_t minAmp = 30;
  uint8_t maxAmp = 180;
  uint8_t stepAmp = 10;
  uint16_t dwellMs = 5000;
  float maxPressureCm = 18.0f;
};

void motorCalLoad();
void motorCalService();
bool motorCalStart(const MotorCalibrationPlan& plan = MotorCalibrationPlan{});
bool motorCalWaterStart(const MotorCalibrationPlan& plan = MotorCalibrationPlan{});
bool motorCalCapturePoint();
void motorCalAbort();
bool motorCalIsActive();
bool motorCalIsWaterActive();
bool motorCalHasProfile();
float motorCalLogTargetCm();
uint8_t motorCalDutyForCm(float targetCm);
String motorCalStatusJson();
MotorCalibrationProfile motorCalProfile();

#endif  // MOTOR_CALIBRATION_H
