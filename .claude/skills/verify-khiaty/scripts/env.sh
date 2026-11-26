# Shared settings for the verify-khiaty scripts. Source it; do not run it.
# Every value points at this machine. Nothing here can reach the live Supabase project.
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
_tmp="${TMPDIR:-/tmp}"
RUN_DIR="${KHIATY_VERIFY_RUN:-${_tmp%/}/khiaty-verify}"
EVIDENCE_DIR="${KHIATY_VERIFY_EVIDENCE:-$REPO_ROOT/.verify-evidence}"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
PG_PORT="${KHIATY_PG_PORT:-55432}"
AUTH_PORT="${KHIATY_AUTH_PORT:-54399}"
APP_PORT="${KHIATY_APP_PORT:-3100}"
APP_URL="http://127.0.0.1:$APP_PORT"

export DATABASE_URL="postgresql://postgres@127.0.0.1:$PG_PORT/khiaty_verify"
export DIRECT_URL="$DATABASE_URL"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$AUTH_PORT"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="verify-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="verify-service-role-key"
export DEMO_PASSWORD="verify-demo-password"
export FAKE_AUTH_PORT="$AUTH_PORT"
export FAKE_AUTH_STATE="$RUN_DIR/fake-auth.json"
export FAKE_AUTH_SECRET="verify-jwt-secret"
export NEXT_TELEMETRY_DISABLED=1
export APP_URL EVIDENCE_DIR

pid_alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
