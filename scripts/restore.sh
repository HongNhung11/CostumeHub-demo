#!/bin/sh
# Khôi phục CSDL từ 1 bản sao lưu. GHI ĐÈ dữ liệu hiện tại.
#   docker compose stop web
#   docker compose exec backup sh /scripts/restore.sh 20261122-230000 --yes
#   docker compose start web
set -eu
name="${1:-}"
case "$name" in
  ''|*[!0-9-]*) echo "Cach dung: restore.sh <YYYYMMDD-HHMMSS> --yes"; ls /backups; exit 1 ;;
esac
file="/backups/$name/database.dump"
[ -f "$file" ] || { echo "Khong co $file"; exit 1; }
if [ "${2:-}" != "--yes" ]; then
  echo "Lenh nay GHI DE du lieu hien tai cua database $PGDATABASE. Them --yes neu chac chan."
  exit 1
fi
pg_restore --clean --if-exists --no-owner --single-transaction -d "$PGDATABASE" "$file"
echo "Da khoi phuc CSDL tu $name. Anh: giai nen uploads.tgz / handover.tgz neu can."
