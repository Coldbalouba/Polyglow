#!/bin/sh
# Hourly: app housekeeping (release unpaid holds, auto-confirm lessons, reminders).
# Daily: compressed Postgres backup to ./backups, keeping BACKUP_KEEP_DAYS days.
set -u
last_backup_day=""
while true; do
  wget -q -O - --header="Authorization: Bearer ${CRON_SECRET}" --post-data="" http://app:3000/api/cron \
    && echo " cron ok $(date -u)" || echo "cron failed $(date -u)"
  today=$(date -u +%F)
  if [ "$today" != "$last_backup_day" ]; then
    if pg_dump -h db -U tutconnect tutconnect | gzip > "/backups/tutconnect-$today.sql.gz.tmp"; then
      mv "/backups/tutconnect-$today.sql.gz.tmp" "/backups/tutconnect-$today.sql.gz"
      find /backups -name 'tutconnect-*.sql.gz' -mtime +"${BACKUP_KEEP_DAYS}" -delete
      last_backup_day="$today"
      echo "backup ok $today"
    else
      rm -f "/backups/tutconnect-$today.sql.gz.tmp"; echo "backup failed $today"
    fi
  fi
  sleep 3600
done
