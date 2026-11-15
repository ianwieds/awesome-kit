#!/usr/bin/env bash
# read_verdict <report file> <label>: print `pass` or `fail` from the report's
# last line. Any other last line shows the report on stderr and returns 1; the
# caller runs it in $(...), so stdout would be swallowed.
read_verdict() {
  local line
  line=$(tail -n 1 "$1")
  case "$line" in
    "verdict: pass" | "verdict: fail") echo "${line#verdict: }" ;;
    *) { echo "$2 ended without a verdict"; cat "$1"; } >&2; return 1 ;;
  esac
}
