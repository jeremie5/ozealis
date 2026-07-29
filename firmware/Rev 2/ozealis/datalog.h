#ifndef DATALOG_H
#define DATALOG_H
#include <Arduino.h>
#include <CircularBuffer.hpp>

void dl_init();
void dl_push(const char* csvLine);  // call every second
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
