#!/usr/bin/env bash
set -euo pipefail

# Script de Backup para Grafana e Loki na VPS Oracle Cloud
BACKUP_DIR="/var/backups/velox-logging"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "${BACKUP_DIR}"

echo "[+] Iniciando backup dos volumes Docker de Logging..."

# Exportar volume do Grafana
docker run --rm -v velox-whatsapp-saas-monorepo_grafana-data:/grafana-data -v "${BACKUP_DIR}":/backup alpine \
  tar czf "/backup/grafana_backup_${DATE}.tar.gz" -C /grafana-data .

# Exportar volume do Loki (índices e chunks)
docker run --rm -v velox-whatsapp-saas-monorepo_loki-data:/loki-data -v "${BACKUP_DIR}":/backup alpine \
  tar czf "/backup/loki_backup_${DATE}.tar.gz" -C /loki-data .

# Manter apenas os últimos 7 backups para economizar disco
find "${BACKUP_DIR}" -type f -name "*.tar.gz" -mtime +7 -delete

echo "[✓] Backup concluído com sucesso em: ${BACKUP_DIR}"
