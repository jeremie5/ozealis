// diag.cpp
#include "diag.h"

static CircularBuffer<FaultSnapshot, 32> s_faults;  // last 32 faults in RAM
static uint16_t s_loop_us = 0;

void diag_init() {
  while (!s_faults.isEmpty()) s_faults.shift();
  s_loop_us = 0;
}

void diag_note_loop_us(uint16_t us) {
  s_loop_us = us;
}

void diag_capture_fault(const FaultSnapshot& in) {
  FaultSnapshot s = in;
  s.loop_us = s_loop_us;
  if (s_faults.isFull()) s_faults.shift();
  s_faults.push(s);
}

String diag_fault_csv() {
  String out;
  out.reserve(1024);
  out += "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,loop_us,miss1,miss2,i2cErr1,i2cErr2\n";
  for (size_t i = 0; i < s_faults.size(); ++i) {
    const auto& s = s_faults[i];
    char line[256];
    snprintf(line, sizeof(line),
      "%lu,%u,%u,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%u,%u,%u,%u,%d,%d\n",
      (unsigned long)s.ts_ms, s.sys_mode, s.fault_code, s.vin_V,
      s.pMask_hPa, s.pBlower_hPa, s.ambient_hPa, s.diff_hPa,
      s.setpoint_cm, s.flowProxy_hPa, s.motorAmp, s.loop_us,
      s.miss1, s.miss2, s.i2cErr1, s.i2cErr2);
    out += line;
  }
  return out;
}

void diag_clear_faults() {
  while (!s_faults.isEmpty()) s_faults.shift();
}
