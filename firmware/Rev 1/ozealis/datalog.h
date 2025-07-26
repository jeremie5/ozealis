#ifndef DATALOG_H
#define DATALOG_H
#include <Arduino.h>
#include <CircularBuffer.hpp>
#include <string>

void dl_init();
void dl_push(const char* csvLine);  // call every second
std::string dl_getCsv();            // whole log as string

#endif
