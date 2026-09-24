"""Конфиг статус-сервиса. Всё из окружения (см. ../.env.example).

Это отдельный от основного бэкенда сервис — свои переменные, свой токен.
Он только ЧИТАЕТ метрики (SQL к БД, psutil к хосту, docker.sock, лог Caddy)
и ничего не пишет.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DSN для asyncpg (обычный postgresql://, БЕЗ +asyncpg).
    # На сервере это тот же кластер, что у основного бэкенда.
    STATUS_DATABASE_URL: str = (
        "postgresql://postgres:postgres@db:5432/scientific_db"
    )

    # Общий секрет между этим API и Next.js-прокси. Заголовок X-Status-Token.
    STATUS_API_TOKEN: str = "change-me"

    # Origin'ы для CORS (сам дашборд ходит через свой серверный прокси,
    # так что обычно достаточно локалхоста для отладки). Список через запятую.
    CORS_ORIGINS: str = "http://localhost:3000"

    # Путь, по которому считать использование диска (в контейнере — смонтированный хост).
    DISK_PATH: str = "/"

    # Корень procfs для psutil. В контейнере монтируем host /proc -> /host/proc.
    PROC_ROOT: str | None = None

    # Docker: путь к сокету (монтируется в контейнер). Пусто -> метрики контейнеров off.
    DOCKER_SOCKET: str | None = "unix:///var/run/docker.sock"

    # JSON access-log Caddy для метрик трафика. Пусто -> раздел API "не настроен".
    CADDY_ACCESS_LOG: str | None = None
    # Сколько последних байт лога читать (хвост), чтобы не грузить весь файл.
    CADDY_LOG_TAIL_BYTES: int = 8_000_000
    # Окно агрегации метрик трафика, часов.
    API_WINDOW_HOURS: int = 24

    # Корень compose-стеков проектов для деплоя (на хосте /opt/apps; в
    # контейнер монтируется по тому же пути, чтобы docker compose видел файлы).
    APPS_ROOT: str = "/opt/apps"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = (".env", ".env.local")
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
