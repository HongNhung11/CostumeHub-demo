#!/bin/sh
# CostumeHub cho macOS / Linux:  sh chay-web.sh
# Lần đầu tự chuyển dữ liệu của bản cũ (không xóa bản gốc).
set -eu
cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1   # để chạy được cả trong Git Bash
NEW=costumehub
OLD=

[ -f .env ] || cp .env.example .env

docker info >/dev/null 2>&1 || { echo "Hãy mở Docker, đợi chạy xong rồi chạy lại."; exit 1; }

has() { docker volume inspect "$1" >/dev/null 2>&1; }

if ! { has "${NEW}_pgdata" && docker run --rm -v "${NEW}_pgdata:/d:ro" postgres:16-alpine test -f /d/PG_VERSION; }; then
  v=$(docker inspect costumehub_db --format '{{range .Mounts}}{{.Name}} {{end}}' 2>/dev/null | cut -d' ' -f1 || true)
  p=${v%_pgdata}
  if [ -n "$p" ] && [ "$p" != "$NEW" ] && has "${p}_pgdata"; then
    OLD=$p
  else
    for p in costumehub-demo costumehub-demo-main; do
      if has "${p}_pgdata"; then OLD=$p; fi
    done
  fi
fi

if [ -n "$OLD" ]; then
  echo "Tìm thấy dữ liệu bản cũ: $OLD. Đang chuyển sang bản mới, bản gốc vẫn giữ nguyên..."
  docker stop costumehub_web costumehub_backup costumehub_db >/dev/null 2>&1 || true
  for n in uploads private_uploads pgdata; do
    if has "${OLD}_$n"; then
      docker volume create --label com.docker.compose.project=$NEW --label com.docker.compose.volume=$n "${NEW}_$n" >/dev/null
      docker run --rm -v "${OLD}_$n:/from:ro" -v "${NEW}_$n:/to" postgres:16-alpine cp -a /from/. /to/
    fi
  done
  docker rm -f costumehub_web costumehub_backup costumehub_db >/dev/null 2>&1 || true
fi

echo "Đang chạy CostumeHub, lần đầu mất vài phút..."
docker compose up -d --build --wait --wait-timeout 300
echo "XONG: http://$(docker compose port web 3000 | sed 's/0\.0\.0\.0/localhost/; s/127\.0\.0\.1/localhost/')"
echo "Tài khoản thử: khachhang / 123456 - nhanvien / 123456 - admin / admin123"
