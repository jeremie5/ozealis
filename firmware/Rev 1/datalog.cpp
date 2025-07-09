#include "datalog.h"
static CircularBuffer<String, 3600*8> buf; // 8-hr @1 Hz (≈160 kB)

void dl_init() { buf.clear(); }

void dl_push(const char* line) {
  if (buf.isFull()) buf.shift();
  buf.push(String(line));
}
std::string dl_getCsv() {
  std::string out;
  for (size_t i=0;i<buf.size();++i) {
    out += buf[i].c_str();
    out += "\n";
  }
  return out;
}
