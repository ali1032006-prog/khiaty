#!/usr/bin/env bash
# Run a browser journey against the instance launch.sh started. Usage: drive.sh <journey> [--headed]
source "$(dirname "$0")/env.sh"
exec node "$SKILL_DIR/scripts/drive.mjs" "$@"
