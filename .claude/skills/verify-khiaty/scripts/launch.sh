#!/usr/bin/env bash
# Start a throwaway Khiaty: local Postgres + fake Supabase Auth + `next dev`, seeded with demo data.
set -euo pipefail
source "$(dirname "$0")/env.sh"
cd "$REPO_ROOT"

for port in "$PG_PORT" "$AUTH_PORT" "$APP_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "FAIL port $port is already in use. Run cleanup.sh, or set KHIATY_*_PORT." >&2; exit 1
  fi
done
if pgrep -f "next dev" >/dev/null; then
  echo "WARN another 'next dev' is running. Two dev servers in one checkout corrupt .next; stop yours first." >&2
fi
mkdir -p "$RUN_DIR" "$EVIDENCE_DIR"

echo "== postgres ($RUN_DIR/pg, port $PG_PORT)"
[ -d "$RUN_DIR/pg" ] || LC_ALL=C "$PG_BIN/initdb" -U postgres --auth=trust --locale=C --encoding=UTF8 -D "$RUN_DIR/pg" >"$RUN_DIR/initdb.log"
LC_ALL=C "$PG_BIN/pg_ctl" -D "$RUN_DIR/pg" -l "$RUN_DIR/pg.log" -w -o "-p $PG_PORT -k $RUN_DIR -c listen_addresses=127.0.0.1" start >/dev/null
"$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -tAc "select 1 from pg_database where datname='khiaty_verify'" | grep -q 1 \
  || "$PG_BIN/createdb" -h 127.0.0.1 -p "$PG_PORT" -U postgres khiaty_verify

echo "== schema"
npx prisma db push --skip-generate >"$RUN_DIR/prisma.log" 2>&1
npx prisma generate >>"$RUN_DIR/prisma.log" 2>&1

echo "== fake auth (port $AUTH_PORT)"
nohup node "$SKILL_DIR/scripts/fake-auth.mjs" >"$RUN_DIR/fake-auth.log" 2>&1 &
echo $! >"$RUN_DIR/fake-auth.pid"
for _ in $(seq 1 50); do curl -fsS "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/health" >/dev/null 2>&1 && break; sleep 0.2; done
curl -fsS "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/health" >/dev/null || { echo "FAIL fake auth did not start, see $RUN_DIR/fake-auth.log" >&2; exit 1; }

echo "== seed"
npm run -s db:seed >"$RUN_DIR/seed.log" 2>&1 || { echo "FAIL seed, see $RUN_DIR/seed.log" >&2; exit 1; }

echo "== next dev ($APP_URL)"
nohup "$REPO_ROOT/node_modules/.bin/next" dev -H 127.0.0.1 -p "$APP_PORT" >"$RUN_DIR/next.log" 2>&1 &
echo $! >"$RUN_DIR/next.pid"
# Ready = the login page renders (first request compiles it), not just an open port.
for _ in $(seq 1 120); do
  curl -fsS "$APP_URL/login" 2>/dev/null | grep -q "Sign in" && { echo "READY $APP_URL"; exit 0; }
  sleep 1
done
echo "FAIL app not ready after 120s, see $RUN_DIR/next.log" >&2; exit 1
