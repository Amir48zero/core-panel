⚡ Core Panel

VersionNodeXrayLicense

A Modern, Enterprise-Grade VPN Management Panel built on Xray-core.

Core Panel provides a sleek, high-performance UI/UX, a powerful REST API, Role-Based Access Control (RBAC), and a lightweight SQLite database for maximum efficiency and speed.
📋 Table of Contents

    ✨ Features
    🛠 Tech Stack
    🚀 Installation
    🔐 Default Credentials
    📡 API Documentation
    ⚠️ Important Notes

✨ Features
📊 Advanced Dashboard

    Real-time Server Stats: Monitor CPU, RAM, and Disk usage live.
    Network Monitoring: Track Upload/Download speeds and 24-hour traffic charts.
    Xray Status: Instantly see if the Xray core is Running or Stopped.

👥 User Management

    Create, edit, delete, and enable/disable users instantly.
    Set Data Limits (GB) and Expiry Dates.
    Reset traffic and session data with one click.
    View user connection logs, last IP, and total data usage.

🌐 Multi-Protocol Inbounds

    Full support for VLESS (Reality & WebSocket), VMess, Trojan, and Shadowsocks.
    Advanced transport configurations: WebSocket, gRPC, HTTPUpgrade, and TCP.
    Reality settings support (SNI, Dest, Private/Public Key, Short IDs).

🔗 Connection Links & QR Codes

    Instant generation of vless://, vmess://, and trojan:// links.
    High-quality QR Code generation for easy mobile scanning.
    Base64 Subscription Links (/sub/:uuid) for seamless V2RayNG/v2rayN integration.

🔐 Security & Administration

    Role-Based Access Control (RBAC): Owner, Admin, Moderator, and Viewer roles.
    Secure password hashing using bcryptjs.
    JWT (JSON Web Token) authentication.
    API Rate Limiting to prevent brute-force attacks.
    Action Logging (Tracks admin logins, user creation, deletions, etc.).

🤖 Developer Friendly API

A fully structured REST API allowing you to easily build Telegram/Discord bots or mobile apps connected to your panel.
🛠 Tech Stack

    Backend: Node.js, Express.js
    Frontend: Vue 3 (Composition API), TailwindCSS, Chart.js
    Database: SQLite (better-sqlite3)
    Core: Xray-core (Latest Version)
    Web Server: Nginx (Reverse Proxy) + Certbot (Auto SSL)

🚀 Installation

Setting up Core Panel is incredibly easy. Run the following command on your fresh Ubuntu 20.04/22.04/24.04 server as root.

    Prerequisite: Make sure you have a domain name (e.g., panel.yourdomain.com) pointing to your server's IP address before running the script.

bash <(curl -Ls https://raw.githubusercontent.com/Amir48zero/core-panel/main/install.sh)

The installer will automatically:

    Update your system and install prerequisites (Node.js, Nginx, Certbot).
    Clone the repository and install dependencies.
    Download the latest Xray-core binary.
    Configure Nginx as a reverse proxy.
    Obtain a free Let's Encrypt SSL certificate for your domain.
    Set up a systemd service so the panel starts automatically on boot.

🔐 Default Credentials

Once installed, access your panel at https://your-domain.com.

     Username: admin
     Password: admin

(⚠️ Please change your password immediately after logging in from the Settings menu.)
📡 API Documentation

The panel exposes a powerful REST API. Authenticate by sending a POST request to /api/login to receive a JWT token, then pass it in the Authorization: Bearer <token> header for subsequent requests.
Method
	
Endpoint
	
Description
	
Access
POST	/api/login	Authenticate and get JWT Token	Public
GET	/api/status	Get server stats (CPU, RAM, Xray)	All Roles
GET	/api/users	List all users	All Roles
POST	/api/users	Create a new user	Owner, Admin
PATCH	/api/users/:id	Update user (enable, limits)	Owner, Admin
DELETE	/api/users/:id	Delete a user	Owner, Admin
GET	/api/inbounds	List all inbounds	All Roles
POST	/api/inbounds	Create a new inbound	Owner, Admin
GET	/api/users/:id/links	Get user connection links & QR	All Roles
GET	/sub/:uuid	Subscription link for V2RayNG	Public
GET	/api/logs	View panel action logs	Owner, Admin
GET	/api/backup	Download database backup	Owner
  
⚠️ Important Notes

     Reality Keys: For VLESS-Reality inbounds, ensure you generate your own x25519 keys using the command xray x25519 on your server and paste them into the inbound settings via the panel.
     Firewall: Ensure ports 80, 443, and your custom inbound ports are open in your server's firewall (UFW/iptables).
     Updates: To update the panel, simply pull the latest code from GitHub and restart the service: systemctl restart core-panel.

<div align="center">
  <sub>Built with ❤️ by Amir48zero. Feel free to contribute!</sub>
</div>
```
