#!/bin/bash
# Satlync Node - Silent Post-Install Script
# Called by the .deb installer after files are placed

set -e
IFACES="${1:-}"
API_BASE="${2:-https://432b9c4f-5fca-46c5-b93e-2aed5a2be436-00-umx4k3ul4rnm.janeway.replit.dev}"
INSTALL_DIR="/opt/satlync-node"
SERVICE_NAME="satlync-node"
LOG="/var/log/satlync-install.log"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

log "=== Satlync Node Install Start ==="

# Node.js 20
if ! node --version 2>/dev/null | grep -q "v20"; then
  log "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG" 2>&1
  apt-get install -y nodejs >> "$LOG" 2>&1
fi
log "Node.js: $(node --version)"

# ZeroTier
if ! command -v zerotier-cli &>/dev/null; then
  log "Installing ZeroTier..."
  curl -s https://install.zerotier.com | bash >> "$LOG" 2>&1
  systemctl enable zerotier-one >> "$LOG" 2>&1
  systemctl start zerotier-one >> "$LOG" 2>&1
fi
log "ZeroTier installed"

# Create install dir
mkdir -p "$INSTALL_DIR"

# Install daemon dependencies
if [ -f "$INSTALL_DIR/package.json" ]; then
  log "Installing daemon dependencies..."
  cd "$INSTALL_DIR" && npm install --production >> "$LOG" 2>&1
fi

# IP forwarding
log "Enabling IP forwarding..."
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-satlync.conf
sysctl -p /etc/sysctl.d/99-satlync.conf >> "$LOG" 2>&1

# Create systemd service
log "Creating systemd service..."
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Satlync Network Bonding Daemon
After=network.target zerotier-one.service
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=API_BASE=$API_BASE
StandardOutput=journal
StandardError=journal
SyslogIdentifier=satlync-node

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload >> "$LOG" 2>&1
systemctl enable "$SERVICE_NAME" >> "$LOG" 2>&1
systemctl start "$SERVICE_NAME" >> "$LOG" 2>&1
log "Service started"

# Desktop shortcut
cat > /usr/share/applications/satlync-dashboard.desktop << EOF
[Desktop Entry]
Name=Satlync Dashboard
Comment=Open Satlync Node Dashboard
Exec=xdg-open http://localhost:3456
Icon=network-wired
Terminal=false
Type=Application
Categories=Network;
EOF

# Auto-open browser after short delay
log "Opening dashboard in browser..."
(sleep 5 && xdg-open http://localhost:3456 2>/dev/null || true) &

log "=== Satlync Node Install Complete ==="
exit 0
