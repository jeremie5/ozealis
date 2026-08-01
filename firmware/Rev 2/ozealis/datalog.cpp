#include "datalog.h"
#include <cstring>
#include <limits.h>
#include <math.h>
#include <stdlib.h>

struct DatalogSample {
  uint32_t ms;
  uint32_t motorFgCentiHz;
  int16_t setpointCentiCm;
  int16_t pressureCentiCm;
  int16_t errorCentiCm;
  int16_t flowProxyCentiHpa;
  int16_t controllerErrorCentiCm;
  int16_t spo2DeciPercent;
  int16_t pulseDeciBpm;
  int16_t humidifierTempDeciC;
  int16_t humidifierRhDeciPercent;
  int16_t hoseTempDeciC;
  uint16_t motorCommand;
  uint8_t motorAmp;
  uint8_t controllerAmp;
  uint8_t motorFault;
  uint8_t motorI2c;
  uint8_t oximeterSource;
  DatalogSampleKind sampleKind;
};

static constexpr size_t DATALOG_CAPACITY = 1800;
static_assert(sizeof(DatalogSampleKind) == 1, "Retained sample kind must remain byte-sized");
static_assert(sizeof(DatalogSample) <= 36, "Retained row exceeded the 64.8 KB heap budget");
static constexpr int16_t OPTIONAL_NAN = INT16_MIN;
static DatalogSample* samples = nullptr;
static size_t sampleHead = 0;
static size_t sampleCount = 0;
static constexpr size_t MAX_DATALOG_INPUT_ROW_LEN = 219;
static constexpr size_t MAX_DATALOG_ROW_LEN =
  MAX_DATALOG_INPUT_ROW_LEN + sizeof(",airflow_run") - 1;
static constexpr char CSV_HEADER[] =
  "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c,sample_kind\n";
static uint32_t generation = 1;

static void bumpGeneration() {
  generation++;
  if (generation == 0) generation = 1;
}

static const DatalogSample& sampleAt(size_t index) {
  return samples[(sampleHead + index) % DATALOG_CAPACITY];
}

static bool fixedCenti(float value, int16_t& out) {
  if (!isfinite(value)) return false;
  const long scaled = lroundf(value * 100.0f);
  if (scaled <= INT16_MIN || scaled > INT16_MAX) return false;
  out = (int16_t)scaled;
  return true;
}

static bool fixedCentiUnsigned(float value, uint32_t& out) {
  if (!isfinite(value) || value < 0.0f || value > 100000.0f) return false;
  const double scaled = round((double)value * 100.0);
  if (scaled < 0.0 || scaled > 10000000.0) return false;
  out = (uint32_t)scaled;
  return true;
}

static bool optionalFixedDeci(float value, int16_t& out) {
  if (!isfinite(value)) {
    out = OPTIONAL_NAN;
    return true;
  }
  const long scaled = lroundf(value * 10.0f);
  if (scaled <= INT16_MIN || scaled > INT16_MAX) return false;
  out = (int16_t)scaled;
  return true;
}

static void optionalFloatText(char* out, size_t outSize, int16_t deciValue) {
  if (!out || outSize == 0) return;
  if (deciValue == OPTIONAL_NAN) {
    snprintf(out, outSize, "NAN");
    return;
  }
  snprintf(out, outSize, "%.1f", deciValue / 10.0f);
}

static const char* sampleKindText(DatalogSampleKind sampleKind) {
  switch (sampleKind) {
    case DatalogSampleKind::AirflowRun:
      return "airflow_run";
    case DatalogSampleKind::Calibration:
      return "calibration";
  }
  return nullptr;
}

static size_t formatRow(const DatalogSample& sample, char* out, size_t outSize) {
  if (!out || outSize == 0) return 0;
  const char* sampleKind = sampleKindText(sample.sampleKind);
  if (!sampleKind) return 0;
  char spo2Text[12];
  char pulseText[12];
  char humidTempText[12];
  char humidRhText[12];
  char hoseTempText[12];
  optionalFloatText(spo2Text, sizeof(spo2Text), sample.spo2DeciPercent);
  optionalFloatText(pulseText, sizeof(pulseText), sample.pulseDeciBpm);
  optionalFloatText(humidTempText, sizeof(humidTempText), sample.humidifierTempDeciC);
  optionalFloatText(humidRhText, sizeof(humidRhText), sample.humidifierRhDeciPercent);
  optionalFloatText(hoseTempText, sizeof(hoseTempText), sample.hoseTempDeciC);
  const int written = snprintf(
    out,
    outSize,
    "%lu,%.2f,%.2f,%.2f,%.2f,%u,%.2f,%u,%u,%u,%u,%.2f,%s,%s,%u,%s,%s,%s,%s\n",
    (unsigned long)sample.ms,
    sample.setpointCentiCm / 100.0f,
    sample.pressureCentiCm / 100.0f,
    sample.errorCentiCm / 100.0f,
    sample.flowProxyCentiHpa / 100.0f,
    (unsigned)sample.motorAmp,
    sample.controllerErrorCentiCm / 100.0f,
    (unsigned)sample.controllerAmp,
    (unsigned)sample.motorCommand,
    (unsigned)sample.motorFault,
    (unsigned)sample.motorI2c,
    sample.motorFgCentiHz / 100.0f,
    spo2Text,
    pulseText,
    (unsigned)sample.oximeterSource,
    humidTempText,
    humidRhText,
    hoseTempText,
    sampleKind);
  if (written < 0 || (size_t)written >= outSize) return 0;
  return (size_t)written;
}

static void hashBytes(uint32_t& hash, const char* data, size_t length) {
  for (size_t i = 0; i < length; ++i) {
    hash ^= (uint8_t)data[i];
    hash *= 16777619UL;
  }
}

void dl_init() {
  if (!samples) {
    samples = (DatalogSample*)calloc(DATALOG_CAPACITY, sizeof(DatalogSample));
  }
  sampleHead = 0;
  sampleCount = 0;
  bumpGeneration();
}

void dl_push(DatalogSampleKind sampleKind, const char* line) {
  if (!line) return;
  if (!samples) return;
  if (!sampleKindText(sampleKind)) return;
  const size_t len = strlen(line);
  if (len == 0 || len > MAX_DATALOG_INPUT_ROW_LEN) return;
  for (size_t i = 0; i < len; ++i) {
    if (line[i] == '\n' || line[i] == '\r') return;
  }

  float setpointCm = NAN;
  float pressureCm = NAN;
  float errorCm = NAN;
  float flowProxyHpa = NAN;
  float controllerErrorCm = NAN;
  float motorFgHz = NAN;
  float spo2Percent = NAN;
  float pulseBpm = NAN;
  float humidifierTempC = NAN;
  float humidifierRhPercent = NAN;
  float hoseTempC = NAN;
  unsigned long ms = 0;
  unsigned motorAmp = 0;
  unsigned controllerAmp = 0;
  unsigned motorCommand = 0;
  unsigned motorFault = 0;
  unsigned motorI2c = 0;
  unsigned oximeterSource = 0;
  int consumed = 0;
  const int fields = sscanf(
    line,
    "%lu,%f,%f,%f,%f,%u,%f,%u,%u,%u,%u,%f,%f,%f,%u,%f,%f,%f%n",
    &ms,
    &setpointCm,
    &pressureCm,
    &errorCm,
    &flowProxyHpa,
    &motorAmp,
    &controllerErrorCm,
    &controllerAmp,
    &motorCommand,
    &motorFault,
    &motorI2c,
    &motorFgHz,
    &spo2Percent,
    &pulseBpm,
    &oximeterSource,
    &humidifierTempC,
    &humidifierRhPercent,
    &hoseTempC,
    &consumed);
  if (fields != 18 || consumed != (int)len) return;
  if (motorAmp > 255 || controllerAmp > 255 || motorCommand > 65535 ||
      motorFault > 1 || motorI2c > 1 || oximeterSource > 2) {
    return;
  }
  const bool oximetryPresent = isfinite(spo2Percent) && isfinite(pulseBpm);
  if ((oximetryPresent && oximeterSource == 0) || (!oximetryPresent && oximeterSource != 0)) return;
  if (isfinite(spo2Percent) != isfinite(pulseBpm)) return;

  DatalogSample sample{};
  if (!fixedCenti(setpointCm, sample.setpointCentiCm) ||
      !fixedCenti(pressureCm, sample.pressureCentiCm) ||
      !fixedCenti(errorCm, sample.errorCentiCm) ||
      !fixedCenti(flowProxyHpa, sample.flowProxyCentiHpa) ||
      !fixedCenti(controllerErrorCm, sample.controllerErrorCentiCm) ||
      !fixedCentiUnsigned(motorFgHz, sample.motorFgCentiHz) ||
      !optionalFixedDeci(spo2Percent, sample.spo2DeciPercent) ||
      !optionalFixedDeci(pulseBpm, sample.pulseDeciBpm) ||
      !optionalFixedDeci(humidifierTempC, sample.humidifierTempDeciC) ||
      !optionalFixedDeci(humidifierRhPercent, sample.humidifierRhDeciPercent) ||
      !optionalFixedDeci(hoseTempC, sample.hoseTempDeciC)) {
    return;
  }

  sample.ms = (uint32_t)ms;
  sample.motorAmp = (uint8_t)motorAmp;
  sample.controllerAmp = (uint8_t)controllerAmp;
  sample.motorCommand = (uint16_t)motorCommand;
  sample.motorFault = (uint8_t)motorFault;
  sample.motorI2c = (uint8_t)motorI2c;
  sample.oximeterSource = (uint8_t)oximeterSource;
  sample.sampleKind = sampleKind;
  if (!samples) return;
  if (sampleCount < DATALOG_CAPACITY) {
    samples[(sampleHead + sampleCount) % DATALOG_CAPACITY] = sample;
    sampleCount++;
  } else {
    samples[sampleHead] = sample;
    sampleHead = (sampleHead + 1) % DATALOG_CAPACITY;
  }
  bumpGeneration();
}

size_t dl_csvSize() {
  if (!samples) return 0;
  size_t total = strlen(CSV_HEADER);
  char line[MAX_DATALOG_ROW_LEN + 2];
  for (size_t i = 0; i < sampleCount; ++i) {
    total += formatRow(sampleAt(i), line, sizeof(line));
  }
  return total;
}

uint32_t dl_csvHash() {
  if (!samples) return 0;
  uint32_t hash = 2166136261UL;
  hashBytes(hash, CSV_HEADER, strlen(CSV_HEADER));
  char line[MAX_DATALOG_ROW_LEN + 2];
  for (size_t i = 0; i < sampleCount; ++i) {
    const size_t length = formatRow(sampleAt(i), line, sizeof(line));
    hashBytes(hash, line, length);
  }
  return hash;
}

uint32_t dl_generation() {
  return generation;
}

void dl_beginCsvRead(DatalogCsvCursor& cursor) {
  cursor.headerOffset = 0;
  cursor.rowIndex = 0;
  cursor.rowOffset = 0;
}

size_t dl_readNextCsvChunk(DatalogCsvCursor& cursor, char* out, size_t maxBytes) {
  if (!samples || !out || maxBytes == 0) return 0;
  size_t written = 0;
  const size_t headerLength = strlen(CSV_HEADER);
  if (cursor.headerOffset < headerLength) {
    const size_t count = min(headerLength - cursor.headerOffset, maxBytes);
    memcpy(out, CSV_HEADER + cursor.headerOffset, count);
    cursor.headerOffset += count;
    written += count;
  }

  char line[MAX_DATALOG_ROW_LEN + 2];
  while (cursor.rowIndex < sampleCount && written < maxBytes) {
    const size_t length = formatRow(sampleAt(cursor.rowIndex), line, sizeof(line));
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
