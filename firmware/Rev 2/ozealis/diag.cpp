// diag.cpp
#include "diag.h"

static CircularBuffer<FaultSnapshot, 32> s_faults;  // last 32 faults in RAM
static uint16_t s_loop_us = 0;
static constexpr uint8_t DIAG_MODE_FAULT = 4;
static constexpr char FAULT_CSV_HEADER[] =
  "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2\n";
static uint32_t s_fault_generation = 1;

static void bumpFaultGeneration() {
  s_fault_generation++;
  if (s_fault_generation == 0) s_fault_generation = 1;
}

static float finiteOrNan(float value) {
  return isfinite(value) ? value : NAN;
}

static void normalizeNanTokens(char* line) {
  if (!line) return;
  for (char* p = line; p[0] && p[1] && p[2]; ++p) {
    if (p[0] == 'n' && p[1] == 'a' && p[2] == 'n') {
      p[0] = 'N';
      p[1] = 'A';
      p[2] = 'N';
    }
  }
}

static size_t formatFaultRow(const FaultSnapshot& s, char* line, size_t lineSize) {
  if (!line || lineSize == 0) return 0;
  const int written = snprintf(line, lineSize,
    "%lu,%u,%u,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%u,%u,%u,%u,%.2f,%u,%u,%u,%d,%d\n",
    (unsigned long)s.ts_ms, s.sys_mode, s.fault_code, s.vin_V,
    s.pMask_hPa, s.pBlower_hPa, s.ambient_hPa, s.diff_hPa,
    s.setpoint_cm, s.flowProxy_hPa, s.motorAmp, s.motorCmd, s.motorFault, s.motorI2c, s.motorFgHz, s.loop_us,
    s.miss1, s.miss2, s.i2cErr1, s.i2cErr2);
  if (written < 0 || (size_t)written >= lineSize) return 0;
  normalizeNanTokens(line);
  return (size_t)written;
}

static void hashBytes(uint32_t& hash, const char* data, size_t length) {
  for (size_t i = 0; i < length; ++i) {
    hash ^= (uint8_t)data[i];
    hash *= 16777619UL;
  }
}

void diag_init() {
  while (!s_faults.isEmpty()) s_faults.shift();
  s_loop_us = 0;
  bumpFaultGeneration();
}

void diag_note_loop_us(uint16_t us) {
  s_loop_us = us;
}

void diag_capture_fault(const FaultSnapshot& in) {
  FaultSnapshot s = in;
  if (s.fault_code == 0) return;
  s.sys_mode = DIAG_MODE_FAULT;
  s.vin_V = finiteOrNan(s.vin_V);
  s.pMask_hPa = finiteOrNan(s.pMask_hPa);
  s.pBlower_hPa = finiteOrNan(s.pBlower_hPa);
  s.ambient_hPa = finiteOrNan(s.ambient_hPa);
  s.diff_hPa = finiteOrNan(s.diff_hPa);
  s.setpoint_cm = finiteOrNan(s.setpoint_cm);
  s.flowProxy_hPa = finiteOrNan(s.flowProxy_hPa);
  s.motorFgHz = finiteOrNan(s.motorFgHz);
  s.motorFault = s.motorFault ? 1 : 0;
  s.motorI2c = s.motorI2c ? 1 : 0;
  s.loop_us = s_loop_us;
  if (s_faults.isFull()) s_faults.shift();
  s_faults.push(s);
  bumpFaultGeneration();
}

void diag_clear_faults() {
  while (!s_faults.isEmpty()) s_faults.shift();
  bumpFaultGeneration();
}

size_t diag_fault_csv_size() {
  size_t total = strlen(FAULT_CSV_HEADER);
  char line[256];
  for (size_t i = 0; i < s_faults.size(); ++i) {
    total += formatFaultRow(s_faults[i], line, sizeof(line));
  }
  return total;
}

uint32_t diag_fault_csv_hash() {
  uint32_t hash = 2166136261UL;
  hashBytes(hash, FAULT_CSV_HEADER, strlen(FAULT_CSV_HEADER));
  char line[256];
  for (size_t i = 0; i < s_faults.size(); ++i) {
    const size_t length = formatFaultRow(s_faults[i], line, sizeof(line));
    hashBytes(hash, line, length);
  }
  return hash;
}

uint32_t diag_fault_generation() {
  return s_fault_generation;
}

void diag_begin_fault_csv_read(FaultCsvCursor& cursor) {
  cursor.headerOffset = 0;
  cursor.rowIndex = 0;
  cursor.rowOffset = 0;
}

size_t diag_read_next_fault_csv_chunk(FaultCsvCursor& cursor, char* out, size_t maxBytes) {
  if (!out || maxBytes == 0) return 0;
  size_t written = 0;
  const size_t headerLength = strlen(FAULT_CSV_HEADER);
  if (cursor.headerOffset < headerLength) {
    const size_t count = min(headerLength - cursor.headerOffset, maxBytes);
    memcpy(out, FAULT_CSV_HEADER + cursor.headerOffset, count);
    cursor.headerOffset += count;
    written += count;
  }

  char line[256];
  while (cursor.rowIndex < s_faults.size() && written < maxBytes) {
    const size_t length = formatFaultRow(s_faults[cursor.rowIndex], line, sizeof(line));
    if (length == 0) {
      cursor.rowIndex++;
      cursor.rowOffset = 0;
      continue;
    }
    if (cursor.rowOffset >= length) {
      cursor.rowIndex++;
      cursor.rowOffset = 0;
      continue;
    }
    const size_t count = min(length - cursor.rowOffset, maxBytes - written);
    memcpy(out + written, line + cursor.rowOffset, count);
    cursor.rowOffset += count;
    written += count;
    if (cursor.rowOffset == length) {
      cursor.rowIndex++;
      cursor.rowOffset = 0;
    }
  }
  return written;
}
