import "server-only";

/**
 * Что панель кладёт на сервер клиента при «Добавить сервер»: bash-скрипт
 * установки и два compose-файла (Traefik и агент). Это ЕДИНСТВЕННОЕ, что
 * стоит у клиента; панель, control-plane и relay остаются у нас.
 *
 * Скрипт идемпотентен: Docker ставится, если его нет; Traefik — если ещё не
 * стоит (свой Traefik клиента не трогаем); стек агента перезаписывается и
 * поднимается заново.
 *
 * Как у Vercel, от человека нужны только адрес и пароль: остальное скрипт
 * определяет на месте. Traefik в режиме `auto` ставится, только если порты
 * 80/443 свободны (чужой прокси не ломаем). Postgres, если строку не дали,
 * ищется среди контейнеров: учётка берётся из его POSTGRES_*, а агент
 * подключается к его docker-сети через docker-compose.override.yml. Ключ организации добавляется в authorized_keys, чтобы
 * переустановка шла уже без пароля.
 *
 * Подставляемые значения проверяются вызывающим кодом (src/lib/servers.ts):
 * пути — по маске, адрес relay — URL, ключ — одна строка OpenSSH.
 * Секрет (токен агента) уходит только в `.env` с правами 0600.
 */
export type InstallParams = {
  relayUrl: string; // публичный ws(s)://…/agent, к которому подключится агент
  agentToken: string;
  agentImage: string;
  installRoot: string; // каталог стека агента, обычно /opt/scalefield
  appsRoot: string; // корень compose-стеков проектов, обычно /opt/apps
  sshPublicKey: string;
  installTraefik: boolean | "auto"; // auto — только если 80/443 свободны
  acmeEmail: string; // пусто — Let's Encrypt без email
  databaseUrl: string | null; // Postgres для pg_stat_*; null — найти контейнер самому
};

export function traefikComposeYaml(acmeEmail: string): string {
  return `# Traefik сервера — установлен Scalefield. Домены и сертификаты сервисов
# задаются лейблами их контейнеров (сеть edge, entrypoint websecure,
# resolver le); JSON access-log читает агент для разделов Analytics и Logs.
services:
  traefik:
    image: traefik:v3.3
    restart: unless-stopped
    command:
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --providers.docker.network=edge
      - --entrypoints.web.address=:80
      - --entrypoints.web.http.redirections.entrypoint.to=websecure
      - --entrypoints.web.http.redirections.entrypoint.scheme=https
      - --entrypoints.websecure.address=:443
${acmeEmail ? `      - --certificatesresolvers.le.acme.email=${acmeEmail}\n` : ""}      - --certificatesresolvers.le.acme.storage=/letsencrypt/acme.json
      - --certificatesresolvers.le.acme.tlschallenge=true
      - --accesslog=true
      - --accesslog.filepath=/var/log/traefik/access.log
      - --accesslog.format=json
      - --accesslog.fields.headers.names.User-Agent=keep
      - --accesslog.fields.headers.names.Referer=keep
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt
      - /var/log/traefik:/var/log/traefik
    networks: [edge]

networks:
  edge:
    external: true
`;
}

export function agentComposeYaml(p: Pick<InstallParams, "agentImage" | "appsRoot">): string {
  return `# Агент Scalefield — единственное, что стоит на этом сервере от платформы.
# Держит исходящий WebSocket к relay и исполняет команды панели (метрики,
# деплой compose-стеков в ${p.appsRoot}, сборка из Git). Входящих портов нет.
# Секреты — в .env рядом (0600). Файл генерирует панель, править руками
# не нужно: переустановка перезапишет.
services:
  agent:
    image: ${p.agentImage}
    restart: unless-stopped
    env_file: .env
    environment:
      # Прямой режим выключен: токен внутренних ручек = токен агента.
      STATUS_API_TOKEN: \${SCALEFIELD_AGENT_TOKEN}
      DISK_PATH: /host
      PROC_ROOT: /host/proc
      CADDY_ACCESS_LOG: /var/log/traefik/access.log
      APPS_ROOT: ${p.appsRoot}
    volumes:
      - /proc:/host/proc:ro
      - /:/host:ro
      - /var/run/docker.sock:/var/run/docker.sock
      - ${p.appsRoot}:${p.appsRoot}
      - /var/log/traefik:/var/log/traefik:ro
    networks: [edge]
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz').status==200 else 1)"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  # Сеть Traefik этого сервера: в ней живут задеплоенные сервисы с доменами.
  edge:
    external: true
`;
}

/** Bash-скрипт установки. Выполняется как `bash -s` со stdin; секреты только в heredoc'ах. */
export function installScript(p: InstallParams): string {
  const envLines = [
    `SCALEFIELD_RELAY_URL=${p.relayUrl}`,
    `SCALEFIELD_AGENT_TOKEN=${p.agentToken}`,
    p.databaseUrl ? `STATUS_DATABASE_URL=${p.databaseUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Весь скрипт — в функции, а вызов — с </dev/null: bash читает функцию из
  // stdin целиком до её исполнения, и команды внутри (curl | sh, apt) не
  // могут случайно съесть остаток скрипта.
  return `#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
log() { echo "==> $*"; }

# Percent-encoding для пароля в строке подключения.
urlenc() {
  local s="$1" out="" c i
  for ((i = 0; i < \${#s}; i++)); do
    c="\${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) printf -v c '%%%02X' "'$c"; out+="$c" ;;
    esac
  done
  printf '%s' "$out"
}

# Postgres на сервере: первый контейнер на образе postgres/pgvector/postgis/
# timescale. Строка подключения — из его POSTGRES_*, агент подключается к его
# docker-сети (override рядом с compose агента), хост — имя контейнера.
detect_postgres() {
  local dbs db envs user pass name net
  dbs="$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($2) ~ /(postgres|pgvector|postgis|timescale)/ {print $1}')"
  if [ -z "$dbs" ]; then
    log "No Postgres container found — the Database section stays empty (pass a Postgres URL under Advanced)"
    return 0
  fi
  db="$(echo "$dbs" | head -n1)"
  if [ "$(echo "$dbs" | wc -l)" -gt 1 ]; then
    log "Several Postgres containers: $(echo $dbs) — using $db"
  fi
  envs="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$db")"
  user="$(echo "$envs" | sed -n 's/^POSTGRES_USER=//p' | head -n1)"; user="\${user:-postgres}"
  pass="$(echo "$envs" | sed -n 's/^POSTGRES_PASSWORD=//p' | head -n1)"
  name="$(echo "$envs" | sed -n 's/^POSTGRES_DB=//p' | head -n1)"; name="\${name:-$user}"
  if [ -z "$pass" ] && echo "$envs" | grep -q '^POSTGRES_PASSWORD_FILE='; then
    log "Postgres $db keeps its password in a file — pass the Postgres URL under Advanced"
    return 0
  fi
  net="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$db" | grep -vxE 'bridge|host|none|' | head -n1 || true)"
  if [ -z "$net" ]; then
    log "Postgres $db is not on a user-defined docker network — the agent cannot reach it, skipping"
    return 0
  fi
  log "Found Postgres $db (database $name, network $net)"
  umask 077
  echo "STATUS_DATABASE_URL=postgresql://$(urlenc "$user")\${pass:+:$(urlenc "$pass")}@$db:5432/$(urlenc "$name")" >> '${p.installRoot}/.env'
  umask 022
  cat > '${p.installRoot}/docker-compose.override.yml' <<SCALEFIELD_EOF
# Найдено установкой: агент подключается к сети Postgres этого сервера.
services:
  agent:
    networks: [edge, postgres]
networks:
  postgres:
    name: $net
    external: true
SCALEFIELD_EOF
}

main() {
  log "Scalefield agent install on $(hostname) ($(uname -sm))"
  if [ "$(id -u)" != "0" ]; then
    echo "ERROR: the install must run as root" >&2
    exit 1
  fi

  if ! command -v docker >/dev/null 2>&1; then
    log "Installing Docker (get.docker.com)"
    curl -fsSL https://get.docker.com | sh
  fi
  log "Docker $(docker version --format '{{.Server.Version}}'), $(docker compose version)"

  log "Authorizing the Scalefield SSH key for future reinstalls"
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
  grep -qF '${p.sshPublicKey}' ~/.ssh/authorized_keys || echo '${p.sshPublicKey}' >> ~/.ssh/authorized_keys

  mkdir -p '${p.appsRoot}' '${p.installRoot}' /var/log/traefik
  if ! docker network inspect edge >/dev/null 2>&1; then
    log "Creating docker network edge"
    docker network create edge >/dev/null
  fi

  TRAEFIK_MODE='${p.installTraefik === "auto" ? "auto" : p.installTraefik ? "1" : "0"}'
  if [ -f '${p.appsRoot}/traefik/docker-compose.yml' ]; then
    log "Traefik is already installed in ${p.appsRoot}/traefik — keeping it"
    TRAEFIK_MODE=0
  elif [ "$TRAEFIK_MODE" = "auto" ]; then
    # Кто-то уже слушает 80/443 (свой Traefik, nginx, Caddy) — не мешаем ему.
    PROXY="$(docker ps --format '{{.Names}} {{.Ports}}' | grep -E ':(80|443)->' | awk '{print $1}' | head -n1 || true)"
    if [ -z "$PROXY" ] && command -v ss >/dev/null 2>&1 && [ -n "$(ss -ltnH '( sport = :80 or sport = :443 )' 2>/dev/null)" ]; then
      PROXY="a process on the host"
    fi
    if [ -n "$PROXY" ]; then
      log "Ports 80/443 are taken by $PROXY — keeping the existing reverse proxy, Traefik is not installed"
      if docker inspect "$PROXY" >/dev/null 2>&1 && ! docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$PROXY" | grep -qw edge; then
        log "WARNING: $PROXY is not attached to the docker network edge — project domains need it there (docker network connect edge $PROXY)"
      fi
      TRAEFIK_MODE=0
    else
      TRAEFIK_MODE=1
    fi
  fi
  if [ "$TRAEFIK_MODE" = "1" ]; then
    log "Installing Traefik (Let's Encrypt, JSON access log)"
    mkdir -p '${p.appsRoot}/traefik/letsencrypt'
    cat > '${p.appsRoot}/traefik/docker-compose.yml' <<'SCALEFIELD_EOF'
${traefikComposeYaml(p.acmeEmail)}SCALEFIELD_EOF
    docker compose -f '${p.appsRoot}/traefik/docker-compose.yml' up -d
  fi

  log "Writing the agent stack to ${p.installRoot}"
  cat > '${p.installRoot}/docker-compose.yml' <<'SCALEFIELD_EOF'
${agentComposeYaml(p)}SCALEFIELD_EOF
  umask 077
  cat > '${p.installRoot}/.env' <<'SCALEFIELD_EOF'
${envLines}
SCALEFIELD_EOF
  umask 022

  rm -f '${p.installRoot}/docker-compose.override.yml'
  if [ '${p.databaseUrl ? "1" : "0"}' = "0" ]; then
    detect_postgres
  fi

  log "Starting the agent (${p.agentImage})"
  cd '${p.installRoot}'
  docker compose pull --quiet 2>/dev/null || log "Image not pulled — using a local copy if present"
  docker compose up -d --remove-orphans
  docker compose ps --format '{{.Name}} {{.Status}}'
  log "Agent started — waiting for it to connect to the relay"
}

main </dev/null
`;
}
