#include "datalog.h"
#include <string>
static CircularBuffer<String, 600> buf;  // 10 min @1 Hz  ≈ 2.6 kB

void dl_init() {
  buf.clear();
}

void dl_push(const char* line) {
  if (buf.isFull()) buf.shift();
  buf.push(String(line));
}
std::string dl_getCsv() {
  std::string out;
  for (size_t i = 0; i < buf.size(); ++i) {
    out += buf[i].c_str();
    out += "\n";
  }
  return out;
}
