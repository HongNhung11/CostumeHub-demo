#!/bin/sh
# Sao lưu mỗi ngày vào ./backups: CSDL + ảnh sản phẩm + ảnh tình trạng đồ.
# KHÔNG sao lưu ảnh CCCD: bản sao sẽ sống lâu hơn thời hạn lưu đã cam kết.
#   Sao lưu ngay:  docker compose exec backup sh /scripts/backup.sh once
#   Khôi phục:     docker compose exec backup sh /scripts/restore.sh <tên thư mục>
set -u
umask 077
KEEP_DAYS="${KEEP_DAYS:-14}"

backup_once() {
  name="$(date +%Y%m%d-%H%M%S)"
  tmp="/backups/.dang-ghi-$name"
  mkdir -p "$tmp" || return 1
  pg_dump -Fc -f "$tmp/database.dump" || { rm -rf "$tmp"; return 1; }
  pg_restore -l "$tmp/database.dump" >/dev/null || { rm -rf "$tmp"; return 1; }
  tar -czf "$tmp/uploads.tgz" -C /data/uploads . || { rm -rf "$tmp"; return 1; }
  if [ -d /data/private/handover ]; then
    tar -czf "$tmp/handover.tgz" -C /data/private handover || { rm -rf "$tmp"; return 1; }
  fi
  mv "$tmp" "/backups/$name" || return 1
  echo "Da sao luu: $name"
  # Chỉ dọn bản cũ sau khi bản mới thành công, và chỉ thư mục do script này tạo
  find /backups -mindepth 1 -maxdepth 1 -type d -name '20??????-??????' -mtime +"$KEEP_DAYS" -exec rm -rf {} +
}

if [ "${1:-}" = "once" ]; then
  backup_once
  exit $?
fi

trap 'exit 0' TERM INT
while true; do
  if backup_once; then wait_for=86400; else echo "Sao luu that bai, thu lai sau 10 phut"; wait_for=600; fi
  sleep "$wait_for" &
  wait $!
done
