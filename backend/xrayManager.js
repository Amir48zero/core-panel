const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const XRAY_BINARY = path.join(__dirname, 'xray');
const CONFIG_PATH = path.join(__dirname, 'config.json');
let xrayProcess = null;

const generateBaseConfig = () => ({
    log: { loglevel: "warning" },
    api: { tag: "api", services: ["HandlerService", "LoggerService", "StatsService"] },
    stats: {},
    policy: { levels: { "0": { statsUserUplink: true, statsUserDownlink: true } } },
    inbounds: [
        { tag: "api", listen: "127.0.0.1", port: 10085, protocol: "dokodemo-door", settings: { address: "127.0.0.1" } }
    ],
    outbounds: [{ protocol: "freedom" }],
    routing: { rules: [{ type: "field", inboundTag: ["api"], outboundTag: "api" }] }
});

const startXray = () => {
    if (xrayProcess) xrayProcess.kill('SIGKILL');
    if (!fs.existsSync(CONFIG_PATH)) fs.writeFileSync(CONFIG_PATH, JSON.stringify(generateBaseConfig()));
    xrayProcess = spawn(XRAY_BINARY, ['run', '-config', CONFIG_PATH]);
    xrayProcess.stdout.on('data', (data) => console.log(`Xray: ${data}`));
    xrayProcess.stderr.on('data', (data) => console.error(`Xray Error: ${data}`));
    console.log('Xray Core Started...');
};

const updateConfig = (inbounds, users) => {
    const config = generateBaseConfig();
    
    inbounds.forEach(inb => {
        let streamSettings = {};
        let settings = { clients: [] };

        users.filter(u => u.inbound_id === inb.id && u.enable === 1).forEach(u => {
            if (inb.protocol === 'vless') settings.clients.push({ id: u.uuid, flow: inb.flow || "", email: u.username });
            else if (inb.protocol === 'vmess') settings.clients.push({ id: u.uuid, alterId: 0, email: u.username });
            else if (inb.protocol === 'trojan') settings.clients.push({ password: u.uuid, email: u.username });
            else if (inb.protocol === 'shadowsocks') settings.clients.push({ password: u.uuid, email: u.username });
        });

        if (inb.protocol === 'shadowsocks') settings.method = "aes-256-gcm";

        if (inb.network === 'ws') streamSettings = { network: "ws", security: inb.security, wsSettings: { path: `/${inb.path}` } };
        else if (inb.network === 'grpc') streamSettings = { network: "grpc", security: inb.security, grpcSettings: { serviceName: inb.path } };
        else if (inb.network === 'tcp' && inb.security === 'reality') {
            streamSettings = { network: "tcp", security: "reality", realitySettings: { dest: inb.dest, serverNames: [inb.sni], privateKey: inb.private_key, shortIds: [inb.short_id] } };
        } else if (inb.network === 'httpupgrade') {
            streamSettings = { network: "httpupgrade", security: inb.security, httpupgradeSettings: { path: `/${inb.path}` } };
        }

        if (inb.security === 'tls') streamSettings.tlsSettings = { serverName: inb.sni, certificates: [{ certificateFile: inb.cert_path, keyFile: inb.key_path }] };

        config.inbounds.push({
            listen: "0.0.0.0", port: inb.port, protocol: inb.protocol, settings, streamSettings,
            sniffing: { enabled: true, destOverride: ["http", "tls"] }
        });
    });

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    startXray();
};

module.exports = { startXray, updateConfig, getXrayStatus: () => xrayProcess !== null };