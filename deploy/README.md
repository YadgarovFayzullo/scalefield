# Деплой Scalefield на Timeweb

Стек: `status-api` (коллектор из репозитория `researcher-uz-status/api`) и `web`
(этот репозиторий). Каталог на сервере — `/opt/apps/status`, домен
`status.researcher.uz` через общий Traefik.

## Образы

Сервер слабый (2 vCPU, 2 ГБ), поэтому образы собираем на маке под amd64 и
переносим готовыми:

```bash
# коллектор
docker buildx build --platform linux/amd64 -t status-api:latest \
  /Users/fayulloyadgarov/researcher-uz-status/api --load
# панель
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
# .env создаётся на сервере (секреты генерируются там же, см. .env.example):
ssh root@81.31.246.252 'cd /opt/apps/status && docker compose up -d'
```

Traefik должен писать JSON access-log в `/var/log/traefik/access.log`
(флаги `--accesslog.filepath`, `--accesslog.format=json` и том в его compose),
иначе разделы Analytics и Logs покажут «not configured».

## Обновление

Пересобрать нужный образ, перенести, `docker compose up -d` в `/opt/apps/status`.
