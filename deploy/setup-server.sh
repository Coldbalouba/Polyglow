#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 VPS. Run as root:
#   curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/deploy/setup-server.sh | bash
# or copy this file to the server and run: bash setup-server.sh
set -euo pipefail

apt-get update
apt-get -y upgrade
apt-get install -y ca-certificates curl git ufw unattended-upgrades fail2ban

# Docker (official repository)
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# Firewall: SSH + web only
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Automatic security updates
dpkg-reconfigure -f noninteractive unattended-upgrades

# 1 GB swap so builds don't run out of memory on small servers
if ! swapon --show | grep -q swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo
echo "Server ready. Next:"
echo "  git clone https://github.com/<you>/<repo>.git /opt/app && cd /opt/app"
echo "  cp .env.example .env && nano .env"
echo "  docker compose up -d --build"
