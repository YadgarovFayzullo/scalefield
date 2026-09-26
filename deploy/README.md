# Деплой Scalefield

Два разных стека:

- **control-plane** (`docker-compose.yml` в этом каталоге): `web` — панель +
  API, `relay` — точка, к которой подключаются агенты, и пока control-plane
  стоит на том же сервере, что и researcher.uz, — его агент `status-api`.
  Каталог на сервере — `/opt/apps/status`, домены `status.researcher.uz` и
  `relay.researcher.uz` через общий Traefik.
- **агент клиента** (`agent/docker-compose.yml`): единственное, что стоит на
  сервере проекта. Держит исходящий WebSocket к relay, входящих портов нет.
  Каталог — `/opt/scalefield`. Это эталон того, что будет класть на сервер
  установка из панели («Добавить сервер»).

## Образы

Сервер слабый (2 vCPU, 2 ГБ), поэтому образы собираем на маке под amd64 и
переносим готовыми:

```bash
# агент
docker buildx build --platform linux/amd64 -t status-api:latest \
  /Users/fayulloyadgarov/scalefield/agent --load
# relay
docker buildx build --platform linux/amd64 -t scalefield-relay:latest \
  /Users/fayulloyadgarov/scalefield/relay --load
# панель + control-plane
docker buildx build --platform linux/amd64 -t scalefield:latest \
  /Users/fayulloyadgarov/scalefield --load
# перенос
docker save status-api:latest scalefield-relay:latest scalefield:latest | gzip | \
  ssh root@81.31.246.252 'gunzip | docker load'
```

## Первый запуск control-plane

```bash
ssh root@81.31.246.252 'mkdir -p /opt/apps/status'
scp deploy/docker-compose.yml root@81.31.246.252:/opt/apps/status/
# База control-plane на Postgres бэкенда (сеть backend_internal):
ssh root@81.31.246.252 "docker exec backend-db-1 psql -U postgres -c 'create database scalefield'"
# .env создаётся на сервере (секреты генерируются там же, см. ../.env.example):
#   DATABASE_URL=postgresql://<user>:<pass>@db:5432/scalefield, ENCRYPTION_KEY,
#   RELAY_SECRET (общий для web и relay), RELAY_HOST, BOOTSTRAP_*,
#   STATUS_API_TOKEN (токен локального агента; STATUS_API_URL НЕ задавать —
#   агент идёт через relay), BOOTSTRAP_DATABASE_URL (редактор таблиц)
ssh root@81.31.246.252 'cd /opt/apps/status && docker compose up -d'
```

Миграции control-plane применяет сам образ `web` на старте (`src/db/migrate.ts`);
при пустой базе он же создаёт первый проект из `STATUS_API_TOKEN`/
`GITHUB_REPOS` (`src/lib/bootstrap.ts`) и досчитывает `agent_token_hash`
серверам, заведённым до relay. Дальше проекты живут в базе.

Traefik должен писать JSON access-log в `/var/log/traefik/access.log`
(флаги `--accesslog.filepath`, `--accesslog.format=json` и том в его compose),
иначе разделы Analytics и Logs покажут «not configured».

## Агент на сервере клиента

```bash
ssh root@<сервер> 'mkdir -p /opt/scalefield /opt/apps'
scp deploy/agent/docker-compose.yml root@<сервер>:/opt/scalefield/
# /opt/scalefield/.env: SCALEFIELD_RELAY_URL=wss://relay.researcher.uz/agent,
#   SCALEFIELD_AGENT_TOKEN=<токен из servers.agent_token_enc>, STATUS_DATABASE_URL (если есть Postgres)
ssh root@<сервер> 'cd /opt/scalefield && docker compose up -d'
```

Токен агента — тот, что зашифрован в `servers.agent_token_enc`; relay ищет
сервер по его sha256 (`agent_token_hash`). После подключения в `servers`
появляются `agent_version`, `agent_hostname`, `last_seen_at`. Пока установка
руками; кнопка «Добавить сервер» (SSH из панели) — следующий шаг фазы 1.5.

## Деплой сервисов через панель

Агент пишет compose-стек проекта в `/opt/apps/<project>/docker-compose.yml`
(том `/opt/apps` и docker.sock без `:ro` в его compose) и поднимает сервис
`docker compose -p <project> up -d --pull always`. Стек живёт рядом с
остальными и правится руками так же; сервисы с доменами получают лейблы
Traefik и сеть `edge`. Сборка из Git идёт на том же хосте
(`/opt/apps/.builds/<project>/<service>`), образ остаётся локальным; логи задач —
`/opt/apps/.jobs/<id>.log`. Webhook GitHub: `https://status.researcher.uz/api/hooks/github/<serviceId>`,
секрет — из формы сервиса, событие push, content type JSON.

## Обновление

Пересобрать нужный образ, перенести, `docker compose up -d` в `/opt/apps/status`.
Схему менять так: правка `src/db/schema.ts` → `npm run db:generate` → коммит
файла из `drizzle/` → новый образ применит миграцию сам.

## Локальная разработка

Три процесса: `npx next dev -p 3002` (панель + control-plane), `npm run relay`
(порт 3003, секрет и адрес берёт из `.env.local`), агент из `agent/` —
`SCALEFIELD_RELAY_URL=ws://localhost:3003/agent STATUS_API_TOKEN=dev-status-token
… uvicorn app.main:app --port 8001`. Локальному серверу в базе `agent_url`
должен быть NULL — тогда запросы идут через relay.
