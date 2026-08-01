#ifndef DATALOG_H
#define DATALOG_H
#include <Arduino.h>
#include <CircularBuffer.hpp>

enum class DatalogSampleKind : uint8_t {
  AirflowRun = 0,
  Calibration = 1,
};

void dl_init();
void dl_push(DatalogSampleKind sampleKind, const char* csvLine);  // call every second
size_t dl_csvSize();
uint32_t dl_csvHash();
uint32_t dl_generation();

struct DatalogCsvCursor {
  size_t headerOffset;
  size_t rowIndex;
  size_t rowOffset;
};

void dl_beginCsvRead(DatalogCsvCursor& cursor);
size_t dl_readNextCsvChunk(DatalogCsvCursor& cursor, char* out, size_t maxBytes);

#endif
