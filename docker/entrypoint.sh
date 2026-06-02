#!/bin/sh
set -eu

if [ -z "${APP_PASSWORD:-}" ]; then
  echo "ERROR: APP_PASSWORD is required." >&2
  exit 1
fi

if [ -z "${SESSION_SECRET:-}" ]; then
  echo "ERROR: SESSION_SECRET is required." >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Deploying database migrations..."
  npm run prisma:deploy
else
  echo "WARNING: DATABASE_URL is not set. The API will fail unless a database URL is provided." >&2
fi

npm --workspace server run start:prod &
api_pid=$!
nginx_pid=""

cleanup() {
  echo "Stopping Subtrack..."
  kill "$api_pid" 2>/dev/null || true
  if [ -n "$nginx_pid" ]; then
    kill "$nginx_pid" 2>/dev/null || true
    wait "$nginx_pid" 2>/dev/null || true
  fi
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup INT TERM

echo "Waiting for API on http://127.0.0.1:3000..."
for i in $(seq 1 30); do
  if wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "API exited before becoming healthy." >&2
    wait "$api_pid"
    exit 1
  fi

  if [ "$i" -eq 30 ]; then
    echo "API did not become healthy in time." >&2
    exit 1
  fi

  sleep 1
done

echo "Starting NGINX..."
nginx -g 'daemon off;' &
nginx_pid=$!

while true; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "API process exited." >&2
    kill "$nginx_pid" 2>/dev/null || true
    wait "$api_pid"
    exit $?
  fi

  if ! kill -0 "$nginx_pid" 2>/dev/null; then
    echo "NGINX process exited." >&2
    kill "$api_pid" 2>/dev/null || true
    wait "$nginx_pid"
    exit $?
  fi

  sleep 2
done
