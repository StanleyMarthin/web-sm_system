#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$ROOT_DIR/.dev"
REDIS_DIR="$DEV_DIR/redis"
MODE_FILE="$DEV_DIR/mode"
SOURCE_STAMP_FILE="$DEV_DIR/source.stamp"

API_PID_FILE="$DEV_DIR/api.pid"
WEB_PID_FILE="$DEV_DIR/web.pid"
REDIS_PID_FILE="$REDIS_DIR/redis.pid"
TUNNEL_SOCKET="$DEV_DIR/tunnel.sock"

API_LOG_FILE="$DEV_DIR/api.log"
WEB_LOG_FILE="$DEV_DIR/web.log"
REDIS_LOG_FILE="$REDIS_DIR/redis.log"

ACTION="${1:-restart}"
MODE_INPUT="${2:-}"

API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-3203}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"
WEB_PORT="${WEB_PORT:-3103}"
APP_NAME="${NEXT_PUBLIC_APP_NAME:-SM System}"
AUTH_BASE_URL="${SM_LOGIN_BASE_URL:-http://108.136.189.225:8085}"
AUDIT_DB_NAME="${AUDIT_DB_NAME:-sms_log}"

LOCAL_DB_HOST="${LOCAL_DB_HOST:-127.0.0.1}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-3306}"
LOCAL_DB_SOCKET="${LOCAL_DB_SOCKET:-/var/run/mysqld/mysqld.sock}"
LOCAL_DB_USER="${LOCAL_DB_USER:-sarito}"
LOCAL_DB_PASS="${LOCAL_DB_PASS:-SahrulR01}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-sms_db}"
LOCAL_PURCHASE_DB_NAME="${LOCAL_PURCHASE_DB_NAME:-sms_purchase}"
LOCAL_WAREHOUSE_DB_NAME="${LOCAL_WAREHOUSE_DB_NAME:-sms_warehouse}"
LOCAL_REDIS_HOST="${LOCAL_REDIS_HOST:-127.0.0.1}"
LOCAL_REDIS_PORT="${LOCAL_REDIS_PORT:-6379}"
LOCAL_REDIS_DB="${LOCAL_REDIS_DB:-0}"

TUNNEL_DB_HOST="${TUNNEL_DB_HOST:-127.0.0.1}"
TUNNEL_DB_PORT="${TUNNEL_DB_PORT:-3307}"
TUNNEL_DB_USER="${TUNNEL_DB_USER:-root}"
TUNNEL_DB_PASS="${TUNNEL_DB_PASS:-@pds0208}"
TUNNEL_DB_NAME="${TUNNEL_DB_NAME:-sms_db}"
TUNNEL_PURCHASE_DB_NAME="${TUNNEL_PURCHASE_DB_NAME:-sms_purchase}"
TUNNEL_WAREHOUSE_DB_NAME="${TUNNEL_WAREHOUSE_DB_NAME:-sms_warehouse}"
TUNNEL_REDIS_HOST="${TUNNEL_REDIS_HOST:-127.0.0.1}"
TUNNEL_REDIS_PORT="${TUNNEL_REDIS_PORT:-6380}"
TUNNEL_REDIS_DB="${TUNNEL_REDIS_DB:-0}"
SSH_KEY="${SSH_KEY:-/home/sahrulr/Documents/SM-MIS/be_sms/smsystem.pem}"
SSH_TARGET="${SSH_TARGET:-ubuntu@108.136.189.225}"

BUN_BIN="${BUN_BIN:-/home/sahrulr/.bun/bin/bun}"

info() {
  printf '[info] %s\n' "$1"
}

warn() {
  printf '[warn] %s\n' "$1"
}

fail() {
  printf '[error] %s\n' "$1" >&2
  exit 1
}

ensure_dirs() {
  mkdir -p "$DEV_DIR" "$REDIS_DIR"
}

compute_source_stamp() {
  {
    find "$ROOT_DIR/apps" "$ROOT_DIR/packages" -type f \
      \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.json' -o -name '*.sql' -o -name '*.sh' \) \
      -printf '%T@\n' 2>/dev/null
    for file in "$ROOT_DIR/start-dev.sh" "$ROOT_DIR/package.json" "$ROOT_DIR/package-lock.json"; do
      [[ -f "$file" ]] || continue
      stat -c '%Y' "$file"
    done
  } | sort -n | tail -n 1
}

source_changed_since_last_start() {
  [[ -f "$SOURCE_STAMP_FILE" ]] || return 1
  local current_stamp
  current_stamp="$(compute_source_stamp)"
  [[ -n "$current_stamp" ]] || return 1
  [[ "$current_stamp" != "$(cat "$SOURCE_STAMP_FILE" 2>/dev/null || true)" ]]
}

mode_changed_since_last_start() {
  [[ -f "$MODE_FILE" ]] || return 1
  [[ "$MODE" != "$(cat "$MODE_FILE" 2>/dev/null || true)" ]]
}

resolve_mode() {
  if [[ -n "$MODE_INPUT" ]]; then
    printf '%s\n' "$MODE_INPUT"
    return
  fi

  if [[ -f "$MODE_FILE" ]]; then
    cat "$MODE_FILE"
    return
  fi

  printf 'local\n'
}

MODE="$(resolve_mode)"

ensure_mode() {
  case "$MODE" in
    local|tunnel)
      ;;
    *)
      fail "Mode '$MODE' tidak dikenal. Gunakan 'local' atau 'tunnel'."
      ;;
  esac
}

check_tool() {
  command -v "$1" >/dev/null 2>&1 || fail "Tool '$1' belum tersedia di mesin ini."
}

check_bun() {
  [[ -x "$BUN_BIN" ]] || fail "Bun tidak ditemukan di $BUN_BIN."
}

is_pid_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" >/dev/null 2>&1
}

cleanup_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]] && ! is_pid_running "$pid_file"; then
    rm -f "$pid_file"
  fi
}

stop_pid_file() {
  local pid_file="$1"
  local label="$2"

  cleanup_pid_file "$pid_file"
  if ! is_pid_running "$pid_file"; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  info "Menghentikan $label (PID $pid)"
  kill "$pid" >/dev/null 2>&1 || true

  for _ in $(seq 1 20); do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      rm -f "$pid_file"
      return 0
    fi
    sleep 1
  done

  warn "$label belum berhenti rapi, proses dipaksa berhenti."
  kill -9 "$pid" >/dev/null 2>&1 || true
  rm -f "$pid_file"
}

kill_port_listener() {
  local port="$1"
  local label="$2"
  local pids

  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    pids="$(fuser -n tcp "$port" 2>/dev/null | tr ' ' '\n' | sed '/^$/d' || true)"
  fi
  [[ -n "$pids" ]] || return 0

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    info "Menghentikan $label di port $port (PID $pid)"
    kill "$pid" >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    if kill -0 "$pid" >/dev/null 2>&1; then
      warn "$label di port $port belum berhenti rapi, proses dipaksa berhenti."
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  done <<< "$pids"
}

wait_for_http() {
  local url="$1"
  local label="$2"

  for _ in $(seq 1 45); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  fail "$label belum merespons di $url."
}

probe_http() {
  local url="$1"
  curl -fsS --max-time 2 "$url" >/dev/null 2>&1
}

probe_tcp_port() {
  local host="$1"
  local port="$2"
  node -e "
    const host = process.argv[1];
    const port = Number(process.argv[2]);
    const net = require('net');
    const socket = net.createConnection({ host, port });
    socket.setTimeout(1000);
    socket.on('connect', () => { socket.destroy(); process.exit(0); });
    socket.on('timeout', () => { socket.destroy(); process.exit(1); });
    socket.on('error', () => process.exit(1));
  " "$host" "$port" >/dev/null 2>&1
}

api_service_healthy() {
  probe_http "http://${API_HOST}:${API_PORT}/health"
}

web_service_ready() {
  probe_http "http://${WEB_HOST}:${WEB_PORT}/login"
}

wait_for_redis() {
  local host="$1"
  local port="$2"
  local label="$3"

  for _ in $(seq 1 30); do
    if redis-cli -h "$host" -p "$port" ping >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  fail "$label belum siap di $host:$port."
}

check_upstream_auth() {
  info "Memeriksa layanan login mobile di $AUTH_BASE_URL/health"
  curl -fsS --max-time 5 "$AUTH_BASE_URL/health" >/dev/null \
    || fail "Layanan login mobile tidak bisa dihubungi. Cek VPS atau URL auth."
}

check_local_mysql() {
  [[ -S "$LOCAL_DB_SOCKET" ]] \
    || fail "Socket MySQL lokal tidak ditemukan di $LOCAL_DB_SOCKET."

  mysql -u "$LOCAL_DB_USER" "-p$LOCAL_DB_PASS" "$LOCAL_DB_NAME" \
    -e "SELECT 1" >/dev/null 2>&1 \
    || fail "MySQL lokal tidak bisa diakses dengan user $LOCAL_DB_USER."
}

start_local_redis() {
  if redis-cli -h "$LOCAL_REDIS_HOST" -p "$LOCAL_REDIS_PORT" ping >/dev/null 2>&1; then
    info "Redis lokal sudah aktif di ${LOCAL_REDIS_HOST}:${LOCAL_REDIS_PORT}"
    return 0
  fi

  check_tool redis-server
  info "Menyalakan Redis dev ringan di ${LOCAL_REDIS_HOST}:${LOCAL_REDIS_PORT}"
  redis-server \
    --bind "$LOCAL_REDIS_HOST" \
    --port "$LOCAL_REDIS_PORT" \
    --save "" \
    --appendonly no \
    --daemonize yes \
    --dir "$REDIS_DIR" \
    --pidfile "$REDIS_PID_FILE" \
    --logfile "$REDIS_LOG_FILE"

  wait_for_redis "$LOCAL_REDIS_HOST" "$LOCAL_REDIS_PORT" "Redis lokal"
}

start_tunnel() {
  if [[ -S "$TUNNEL_SOCKET" ]] && ssh -S "$TUNNEL_SOCKET" -O check "$SSH_TARGET" >/dev/null 2>&1; then
    info "Tunnel SSH sudah aktif."
    return 0
  fi

  rm -f "$TUNNEL_SOCKET"
  info "Membuka tunnel SSH ke $SSH_TARGET"
  ssh -i "$SSH_KEY" \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -M \
    -S "$TUNNEL_SOCKET" \
    -fnNT \
    -L "${TUNNEL_DB_PORT}:127.0.0.1:3306" \
    -L "${TUNNEL_REDIS_PORT}:127.0.0.1:6379" \
    "$SSH_TARGET"

  wait_for_redis "$TUNNEL_REDIS_HOST" "$TUNNEL_REDIS_PORT" "Redis tunnel"
}

stop_tunnel() {
  if [[ -S "$TUNNEL_SOCKET" ]]; then
    info "Menutup tunnel SSH"
    ssh -S "$TUNNEL_SOCKET" -O exit "$SSH_TARGET" >/dev/null 2>&1 || true
    rm -f "$TUNNEL_SOCKET"
  fi
}

start_api() {
  cleanup_pid_file "$API_PID_FILE"
  if api_service_healthy; then
    if source_changed_since_last_start || mode_changed_since_last_start; then
      if mode_changed_since_last_start; then
        info "Mode berubah sejak start terakhir. API akan dijalankan ulang agar memakai env ${MODE}."
      else
        info "Source berubah sejak start terakhir. API akan dijalankan ulang agar memakai kode terbaru."
      fi
      stop_pid_file "$API_PID_FILE" "API"
      kill_port_listener "$API_PORT" "API"
    else
      info "API sudah aktif di http://${API_HOST}:${API_PORT}"
      printf '[info] API sudah aktif di http://%s:%s\n' "$API_HOST" "$API_PORT" > "$API_LOG_FILE"
      return 0
    fi
  fi
  if api_service_healthy; then
    info "API sudah aktif di http://${API_HOST}:${API_PORT}"
    printf '[info] API sudah aktif di http://%s:%s\n' "$API_HOST" "$API_PORT" > "$API_LOG_FILE"
    return 0
  fi
  if probe_tcp_port "$API_HOST" "$API_PORT"; then
    fail "Port API ${API_PORT} sedang dipakai, tetapi health API tidak valid. Hentikan proses lama di port itu dulu."
  fi
  if is_pid_running "$API_PID_FILE"; then
    info "API sudah berjalan (PID $(cat "$API_PID_FILE"))."
    return 0
  fi

  local db_host db_port db_socket db_user db_pass db_name purchase_db warehouse_db redis_host redis_port redis_db
  if [[ "$MODE" == "local" ]]; then
    db_host="$LOCAL_DB_HOST"
    db_port="$LOCAL_DB_PORT"
    db_socket="$LOCAL_DB_SOCKET"
    db_user="$LOCAL_DB_USER"
    db_pass="$LOCAL_DB_PASS"
    db_name="$LOCAL_DB_NAME"
    purchase_db="$LOCAL_PURCHASE_DB_NAME"
    warehouse_db="$LOCAL_WAREHOUSE_DB_NAME"
    redis_host="$LOCAL_REDIS_HOST"
    redis_port="$LOCAL_REDIS_PORT"
    redis_db="$LOCAL_REDIS_DB"
  else
    db_host="$TUNNEL_DB_HOST"
    db_port="$TUNNEL_DB_PORT"
    db_socket=""
    db_user="$TUNNEL_DB_USER"
    db_pass="$TUNNEL_DB_PASS"
    db_name="$TUNNEL_DB_NAME"
    purchase_db="$TUNNEL_PURCHASE_DB_NAME"
    warehouse_db="$TUNNEL_WAREHOUSE_DB_NAME"
    redis_host="$TUNNEL_REDIS_HOST"
    redis_port="$TUNNEL_REDIS_PORT"
    redis_db="$TUNNEL_REDIS_DB"
  fi

  : > "$API_LOG_FILE"
  info "Menyalakan Bun API di http://${API_HOST}:${API_PORT}"
  cd "$ROOT_DIR"
  setsid env \
    NODE_ENV=development \
    API_HOST="$API_HOST" \
    API_PORT="$API_PORT" \
    SM_LOGIN_BASE_URL="$AUTH_BASE_URL" \
    WEB_ALLOWED_ORIGINS="http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}" \
    AUDIT_DB_NAME="$AUDIT_DB_NAME" \
    DB_HOST="$db_host" \
    DB_PORT="$db_port" \
    DB_SOCKET_PATH="$db_socket" \
    DB_USER="$db_user" \
    DB_PASS="$db_pass" \
    DB_NAME="$db_name" \
    CORE_DB_NAME="$db_name" \
    PURCHASE_DB_NAME="$purchase_db" \
    WAREHOUSE_DB_NAME="$warehouse_db" \
    REDIS_HOST="$redis_host" \
    REDIS_PORT="$redis_port" \
    REDIS_DB="$redis_db" \
    "$BUN_BIN" apps/api/src/index.ts \
    >"$API_LOG_FILE" 2>&1 < /dev/null &
  echo $! > "$API_PID_FILE"
  cd - >/dev/null

  wait_for_http "http://${API_HOST}:${API_PORT}/health" "Bun API"
}

start_web() {
  cleanup_pid_file "$WEB_PID_FILE"
  if web_service_ready; then
    if source_changed_since_last_start || mode_changed_since_last_start; then
      if mode_changed_since_last_start; then
        info "Mode berubah sejak start terakhir. Web akan dijalankan ulang agar memakai env ${MODE}."
      else
        info "Source berubah sejak start terakhir. Web akan dijalankan ulang agar memakai kode terbaru."
      fi
      stop_pid_file "$WEB_PID_FILE" "web"
      kill_port_listener "$WEB_PORT" "web"
    else
      info "Web sudah aktif di http://${WEB_HOST}:${WEB_PORT}/login"
      printf '[info] Web sudah aktif di http://%s:%s/login\n' "$WEB_HOST" "$WEB_PORT" > "$WEB_LOG_FILE"
      return 0
    fi
  fi
  if web_service_ready; then
    info "Web sudah aktif di http://${WEB_HOST}:${WEB_PORT}/login"
    printf '[info] Web sudah aktif di http://%s:%s/login\n' "$WEB_HOST" "$WEB_PORT" > "$WEB_LOG_FILE"
    return 0
  fi
  if probe_tcp_port "$WEB_HOST" "$WEB_PORT"; then
    fail "Port web ${WEB_PORT} sedang dipakai, tetapi halaman login tidak valid. Hentikan proses lama di port itu dulu."
  fi
  if is_pid_running "$WEB_PID_FILE"; then
    info "Web sudah berjalan (PID $(cat "$WEB_PID_FILE"))."
    return 0
  fi

  : > "$WEB_LOG_FILE"
  info "Menyalakan web di http://${WEB_HOST}:${WEB_PORT}"
  cd "$ROOT_DIR"
  setsid env \
    NODE_ENV=development \
    NEXT_PUBLIC_API_BASE_URL="http://${API_HOST}:${API_PORT}" \
    NEXT_PUBLIC_API_URL="http://${API_HOST}:${API_PORT}" \
    BACKEND_API_URL="http://${API_HOST}:${API_PORT}" \
    NEXT_PUBLIC_APP_NAME="$APP_NAME" \
    npm run dev --workspace @smsystem/web -- --webpack --hostname "$WEB_HOST" --port "$WEB_PORT" \
    >"$WEB_LOG_FILE" 2>&1 < /dev/null &
  echo $! > "$WEB_PID_FILE"
  cd - >/dev/null

  wait_for_http "http://${WEB_HOST}:${WEB_PORT}/login" "Web login"
}

show_health() {
  info "Ringkasan service"
  printf '  Web  : http://%s:%s/login\n' "$WEB_HOST" "$WEB_PORT"
  printf '  API  : http://%s:%s\n' "$API_HOST" "$API_PORT"
  printf '  Auth : %s/health\n' "$AUTH_BASE_URL"
  printf '  Log  : %s\n' "$DEV_DIR"
  printf '  Mode : %s\n' "$MODE"
}

render_service_status() {
  local pid_file="$1"
  local healthy="$2"
  local port_open="$3"

  if is_pid_running "$pid_file"; then
    printf 'aktif (dikelola script)'
    return
  fi

  if [[ "$healthy" == "yes" ]]; then
    printf 'aktif (sudah berjalan)'
    return
  fi

  if [[ "$port_open" == "yes" ]]; then
    printf 'port terpakai, tapi service tidak sehat'
    return
  fi

  printf 'mati'
}

status() {
  cleanup_pid_file "$API_PID_FILE"
  cleanup_pid_file "$WEB_PID_FILE"
  local api_healthy="no"
  local web_healthy="no"
  local api_port_open="no"
  local web_port_open="no"
  local redis_host="$LOCAL_REDIS_HOST"
  local redis_port="$LOCAL_REDIS_PORT"
  if [[ "$MODE" == "tunnel" ]]; then
    redis_host="$TUNNEL_REDIS_HOST"
    redis_port="$TUNNEL_REDIS_PORT"
  fi
  local redis_status="mati di ${redis_host}:${redis_port}"

  if api_service_healthy; then
    api_healthy="yes"
  fi

  if web_service_ready; then
    web_healthy="yes"
  fi

  if probe_tcp_port "$API_HOST" "$API_PORT"; then
    api_port_open="yes"
  fi

  if probe_tcp_port "$WEB_HOST" "$WEB_PORT"; then
    web_port_open="yes"
  fi

  if redis-cli -h "$redis_host" -p "$redis_port" ping >/dev/null 2>&1; then
    redis_status="aktif di ${redis_host}:${redis_port}"
  fi

  printf 'Mode terakhir: %s\n' "$MODE"
  printf 'API   : %s\n' "$(render_service_status "$API_PID_FILE" "$api_healthy" "$api_port_open")"
  printf 'Web   : %s\n' "$(render_service_status "$WEB_PID_FILE" "$web_healthy" "$web_port_open")"
  printf 'Redis : %s\n' "$redis_status"

  if [[ -S "$TUNNEL_SOCKET" ]] && ssh -S "$TUNNEL_SOCKET" -O check "$SSH_TARGET" >/dev/null 2>&1; then
    printf 'Tunnel: aktif (%s)\n' "$SSH_TARGET"
  else
    printf 'Tunnel: mati\n'
  fi
}

logs() {
  status
  printf '%s\n' ''
  printf '%s\n' '== API =='
  tail -n 40 "$API_LOG_FILE" 2>/dev/null || true
  printf '%s\n' ''
  printf '%s\n' '== Web =='
  tail -n 40 "$WEB_LOG_FILE" 2>/dev/null || true
  if [[ -f "$REDIS_LOG_FILE" ]]; then
    printf '%s\n' ''
    printf '%s\n' '== Redis =='
    tail -n 20 "$REDIS_LOG_FILE" 2>/dev/null || true
  fi
}

start() {
  ensure_mode
  ensure_dirs
  check_tool npm
  check_tool curl
  check_tool redis-cli
  check_tool mysql
  check_bun
  check_upstream_auth

  if [[ "$MODE" == "local" ]]; then
    check_local_mysql
    start_local_redis
  else
    start_tunnel
  fi

  start_api
  start_web

  printf '%s\n' "$MODE" > "$MODE_FILE"
  compute_source_stamp > "$SOURCE_STAMP_FILE"
  show_health
  info "Login testing sekarang aman memakai API lokal. Script ini memaksa web ke ${API_HOST}:${API_PORT}, jadi tidak lagi nyasar ke API publik."
}

stop() {
  ensure_dirs
  stop_pid_file "$WEB_PID_FILE" "web"
  stop_pid_file "$API_PID_FILE" "API"
  kill_port_listener "$WEB_PORT" "web"
  kill_port_listener "$API_PORT" "API"
  stop_pid_file "$REDIS_PID_FILE" "Redis dev"
  stop_tunnel
  rm -f "$MODE_FILE"
  if api_service_healthy; then
    warn "API masih aktif di port ${API_PORT}. Kemungkinan dijalankan di luar script ini."
  fi
  if web_service_ready; then
    warn "Web masih aktif di port ${WEB_PORT}. Kemungkinan dijalankan di luar script ini."
  fi
  info "Semua proses dev yang dikelola script sudah dihentikan."
}

restart() {
  stop
  start
}

usage() {
  cat <<'EOF'
Pemakaian:
  ./start-dev.sh start [local|tunnel]
  ./start-dev.sh restart [local|tunnel]
  ./start-dev.sh stop
  ./start-dev.sh status
  ./start-dev.sh logs

Mode:
  local   Menjalankan API + web dengan MySQL socket lokal dan Redis dev lokal.
  tunnel  Menjalankan API + web dengan SSH tunnel ke MySQL/Redis VPS.

Default:
  ./start-dev.sh
  -> sama dengan: ./start-dev.sh restart local
EOF
}

case "$ACTION" in
  start)
    start
    ;;
  restart)
    restart
    ;;
  stop)
    stop
    ;;
  status)
    status
    ;;
  logs)
    logs
    ;;
  *)
    usage
    exit 1
    ;;
esac
