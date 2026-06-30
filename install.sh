#!/bin/bash

GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}      Core Enterprise Panel Installer     ${NC}"
echo -e "${CYAN}========================================${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root${NC}"
  exit
fi

read -p "Enter Domain (e.g., panel.domain.com): " DOMAIN
read -p "Enter Email for SSL: " EMAIL
GITHUB_REPO="https://github.com/Amir48zero/core-panel.git"
INSTALL_DIR="/opt/core-panel"

echo -e "${CYAN}[1/5] Updating system...${NC}"
DEBIAN_FRONTEND=noninteractive apt update && DEBIAN_FRONTEND=noninteractive apt upgrade -y
apt install git nginx certbot python3-certbot-nginx curl unzip -y

echo -e "${CYAN}[2/5] Installing Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

echo -e "${CYAN}[3/5] Cloning Project...${NC}"
rm -rf $INSTALL_DIR
git clone $GITHUB_REPO $INSTALL_DIR
cd $INSTALL_DIR/backend
npm install

echo -e "${CYAN}[4/5] Downloading Xray-Core...${NC}"
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then XARCH="64"; elif [ "$ARCH" = "aarch64" ]; then XARCH="arm64-v8a"; else XARCH="64"; fi
XRAY_URL=$(curl -s https://api.github.com/repos/XTLS/Xray-core/releases/latest | grep browser_download_url | grep "linux-${XARCH}.zip" | cut -d '"' -f 4)
curl -L -o xray.zip $XRAY_URL
unzip xray.zip xray
chmod +x xray
rm xray.zip

echo -e "${CYAN}[5/5] Configuring Nginx & SSL...${NC}"
cat <<EOF > /etc/nginx/sites-available/$DOMAIN
server {
    listen 80;
    server_name $DOMAIN;
    
    location / {
        root $INSTALL_DIR/frontend;
        try_files /index.html =404;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    
    location /sub/ {
        proxy_pass http://127.0.0.1:3000;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect

cat <<EOF > /etc/systemd/system/core-panel.service
[Unit]
Description=Core Panel Enterprise
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR/backend
Environment=DOMAIN=$DOMAIN
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable core-panel
systemctl restart core-panel

echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}   Installation Successful!${NC}"
echo -e "Panel URL: ${CYAN}https://$DOMAIN${NC}"
echo -e "Login: admin / admin"
echo -e "${CYAN}========================================${NC}"
