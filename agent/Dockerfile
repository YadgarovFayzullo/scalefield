FROM python:3.12-slim

WORKDIR /app

# psutil компилируется — нужны заголовки; docker SDK чистый python.
# docker CLI + compose-плагин — для деплоя (app/deploy.py): агент зовёт
# `docker compose` через смонтированный /var/run/docker.sock.
RUN apt-get update && apt-get install -y --no-install-recommends gcc ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && echo "deb [signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin docker-buildx-plugin git \
    && rm -rf /var/lib/apt/lists/*

# Railpack — сборка репозитория без Dockerfile (app/deploy.py): `prepare`
# определяет стек и пишет план, `docker buildx` собирает его BuildKit-фронтендом
# той же версии (ghcr.io/railwayapp/railpack-frontend:v<версия>).
ARG RAILPACK_VERSION=0.40.0
ARG TARGETARCH
RUN case "$TARGETARCH" in arm64) arch=arm64 ;; *) arch=x86_64 ;; esac \
    && curl -fsSL "https://github.com/railwayapp/railpack/releases/download/v${RAILPACK_VERSION}/railpack-v${RAILPACK_VERSION}-${arch}-unknown-linux-musl.tar.gz" \
       | tar -xz -C /usr/local/bin railpack \
    && railpack --version
ENV RAILPACK_VERSION=${RAILPACK_VERSION}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
