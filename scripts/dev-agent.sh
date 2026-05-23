#!/usr/bin/env bash
set -euo pipefail

host="${HOST:-127.0.0.1}"
api_port="${PORT:-3300}"
client_port="${CLIENT_PORT:-5174}"

printf 'Starting alternate dev stack: API http://%s:%s, client http://%s:%s\n' \
  "$host" "$api_port" "$host" "$client_port"

exec env HOST="$host" PORT="$api_port" CLIENT_PORT="$client_port" bun run dev
