import "server-only";

/**
 * Что панель кладёт на сервер клиента при «Добавить сервер»: bash-скрипт
 * установки и два compose-файла (Traefik и агент). Это ЕДИНСТВЕННОЕ, что
 * стоит у клиента; панель, control-plane и relay остаются у нас.
 *
 * Скрипт идемпотентен: Docker ставится, если его нет; Traefik — если ещё не
 * стоит (свой Traefik клиента не трогаем); стек агента перезаписывается и
 * поднимается заново. Ключ организации добавляется в authorized_keys, чтобы
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
  installTraefik: boolean;
  acmeEmail: string;
  databaseUrl: string | null; // Postgres проекта на этом сервере для pg_stat_*
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
      - --certificatesresolvers.le.acme.email=${acmeEmail}
      - --certificatesresolvers.le.acme.storage=/letsencrypt/acme.json
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

  if [ '${p.installTraefik ? "1" : "0"}' = "1" ]; then
    if [ -f '${p.appsRoot}/traefik/docker-compose.yml' ]; then
      log "Traefik is already installed in ${p.appsRoot}/traefik — keeping it"
    else
      log "Installing Traefik (Let's Encrypt, JSON access log)"
      mkdir -p '${p.appsRoot}/traefik/letsencrypt'
      cat > '${p.appsRoot}/traefik/docker-compose.yml' <<'SCALEFIELD_EOF'
${traefikComposeYaml(p.acmeEmail)}SCALEFIELD_EOF
      docker compose -f '${p.appsRoot}/traefik/docker-compose.yml' up -d
    fi
  fi

  log "Writing the agent stack to ${p.installRoot}"
  cat > '${p.installRoot}/docker-compose.yml' <<'SCALEFIELD_EOF'
${agentComposeYaml(p)}SCALEFIELD_EOF
  umask 077
  cat > '${p.installRoot}/.env' <<'SCALEFIELD_EOF'
${envLines}
SCALEFIELD_EOF
  umask 022

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
