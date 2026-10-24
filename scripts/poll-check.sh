#!/usr/bin/env bash
# Long-running poll: 6 iterations × 10s interval; appends to artifacts/poll.log
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/artifacts/poll.log"
ITERATIONS=6
INTERVAL_SEC=10

mkdir -p "$ROOT/artifacts"
: > "$LOG"

echo "poll-check start $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
echo "iterations=$ITERATIONS interval_sec=$INTERVAL_SEC" | tee -a "$LOG"

for i in $(seq 1 "$ITERATIONS"); do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # Lightweight health-style check: repo root readable + node present
  if [[ -r "$ROOT/package.json" ]] && command -v node >/dev/null 2>&1; then
    status="ok"
  else
    status="fail"
  fi
  echo "[$i/$ITERATIONS] $ts status=$status" | tee -a "$LOG"
  sleep "$INTERVAL_SEC"
done

echo "poll-check done $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
