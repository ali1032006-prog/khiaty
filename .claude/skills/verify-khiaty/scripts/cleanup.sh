#!/usr/bin/env bash
# Stop what launch.sh started (by pid file, never by name) and delete the run dir.
# Evidence in $EVIDENCE_DIR is kept.
source "$(dirname "$0")/env.sh"
stop() {
  [ -f "$1" ] || return 0
  local pid; pid="$(cat "$1")"
  pkill -TERM -P "$pid" 2>/dev/null; kill -TERM "$pid" 2>/dev/null
  for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
  pkill -KILL -P "$pid" 2>/dev/null; kill -KILL "$pid" 2>/dev/null
  rm -f "$1"
}
stop "$RUN_DIR/next.pid"
stop "$RUN_DIR/fake-auth.pid"
[ -d "$RUN_DIR/pg" ] && "$PG_BIN/pg_ctl" -D "$RUN_DIR/pg" -m fast stop >/dev/null 2>&1
rm -rf "$RUN_DIR"
echo "CLEAN run dir removed; evidence kept in $EVIDENCE_DIR"
