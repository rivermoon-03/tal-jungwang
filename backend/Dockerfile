FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# non-root 사용자로 실행
RUN useradd -m appuser && chown -R appuser:appuser /app
RUN chmod +x /app/entrypoint.sh
USER appuser

EXPOSE 8000

CMD ["/app/entrypoint.sh"]
