# Деплой Scalefield на Timeweb

Стек: `status-api` (агент из `../agent`, он же коллектор метрик) и `web`
(control-plane + панель, этот репозиторий). Каталог на сервере —
`/opt/apps/status`, домен `status.researcher.uz` через общий Traefik.

## Образы

Сервер слабый (2 vCPU, 2 ГБ), поэтому образы собираем на маке под amd64 и
переносим готовыми:

```bash
# агент
docker buildx build --platform linux/amd64 -t status-api:latest \
  /Users/fayulloyadgarov/scalefield/agent --load
# панель + control-plane
docker buildx build --platform linux/amd64 -t scalefield:latest \
  /Users/fayulloyadgarov/scalefield --load
# перенос
docker save status-api:latest scalefield:latest | gzip | \
  ssh root@81.31.246.252 'gunzip | docker load'
```

## Первый запуск

```bash
ssh root@81.31.246.252 'mkdir -p /opt/apps/status'
scp deploy/docker-compose.yml root@81.31.246.252:/opt/apps/status/
# База control-plane на Postgres бэкенда (сеть backend_internal):
ssh root@81.31.246.252 "docker exec backend-db-1 psql -U postgres -c 'create database scalefield'"
# .env создаётся на сервере (секреты генерируются там же, см. ../.env.example):
#   DATABASE_URL=postgresql://<user>:<pass>@db:5432/scalefield, ENCRYPTION_KEY, BOOTSTRAP_*
ssh root@81.31.246.252 'cd /opt/apps/status && docker compose up -d'
```

Миграции control-plane применяет сам образ `web` на старте (`src/db/migrate.ts`);
при пустой базе он же создаёт первый проект из `STATUS_API_URL`/`STATUS_API_TOKEN`/
`GITHUB_REPOS` (`src/lib/bootstrap.ts`). Дальше проекты живут в базе.

Traefik должен писать JSON access-log в `/var/log/traefik/access.log`
(флаги `--accesslog.filepath`, `--accesslog.format=json` и том в его compose),
иначе разделы Analytics и Logs покажут «not configured».

## Обновление

Пересобрать нужный образ, перенести, `docker compose up -d` в `/opt/apps/status`.
Схему менять так: правка `src/db/schema.ts` → `npm run db:generate` → коммит
файла из `drizzle/` → новый образ применит миграцию сам.
