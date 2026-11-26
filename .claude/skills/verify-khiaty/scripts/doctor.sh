#!/usr/bin/env bash
# Read-only: is this instance ours, local-only, seeded, and worth driving? Exit 0 only if all pass.
source "$(dirname "$0")/env.sh"
ok=0
check() { if eval "$2" >/dev/null 2>&1; then echo "PASS $1"; else echo "FAIL $1"; ok=1; fi; }
check "postgres up on 127.0.0.1:$PG_PORT" "'$PG_BIN/pg_isready' -h 127.0.0.1 -p $PG_PORT"
check "fake auth process is ours" "pid_alive '$RUN_DIR/fake-auth.pid'"
check "next dev process is ours" "pid_alive '$RUN_DIR/next.pid'"
check "app port $APP_PORT owned by our next dev" "lsof -nP -iTCP:$APP_PORT -sTCP:LISTEN -t | xargs -I{} ps -o ppid=,pid= -p {} | grep -qw \"\$(cat '$RUN_DIR/next.pid')\""
check "5 demo users in fake auth" "curl -fsS $NEXT_PUBLIC_SUPABASE_URL/auth/v1/health | grep -q '\"users\":5'"
check "seeded requests in local DB" "'$PG_BIN/psql' -h 127.0.0.1 -p $PG_PORT -U postgres -d khiaty_verify -tAc 'select count(*) from \"Request\"' | grep -qv '^0$'"
# The CSP header names the auth host the app was started with: proves it talks to the fake, not prod.
check "app points at local auth, not supabase.co" "curl -fsSI $APP_URL/login | grep -i content-security-policy | grep -q '127.0.0.1:$AUTH_PORT' && ! curl -fsSI $APP_URL/login | grep -qi 'supabase.co'"
check "login page renders" "curl -fsS $APP_URL/login | grep -q 'Sign in'"
exit $ok
