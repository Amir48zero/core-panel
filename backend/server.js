const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const si = require('systeminformation');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const xrayManager = require('./xrayManager');

const app = express();
const PORT = 3000;
const SECRET_KEY = "core_enterprise_secret_99";
const DOMAIN = process.env.DOMAIN || "YOUR_DOMAIN.COM";

app.use(cors());
app.use(bodyParser.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const db = new Database('core.db');
db.exec(`
    CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, role TEXT, secret TEXT);
    CREATE TABLE IF NOT EXISTS inbounds (id INTEGER PRIMARY KEY AUTOINCREMENT, remark TEXT, port INTEGER, protocol TEXT, network TEXT, security TEXT, path TEXT, sni TEXT, flow TEXT, dest TEXT, private_key TEXT, short_id TEXT, cert_path TEXT, key_path TEXT);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, uuid TEXT, inbound_id INTEGER, used_traffic INTEGER DEFAULT 0, data_limit INTEGER, expiry INTEGER, enable INTEGER DEFAULT 1, last_ip TEXT, last_online INTEGER);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER, action TEXT, target TEXT, time INTEGER);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`);

const owner = db.prepare('SELECT * FROM admins WHERE role = ?').get('Owner');
if (!owner) db.prepare('INSERT INTO admins (username, password, role) VALUES (?, ?, ?)').run('admin', bcrypt.hashSync('admin', 8), 'Owner');

const auth = (roles = []) => (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.admin = jwt.verify(token, SECRET_KEY);
        if (roles.length && !roles.includes(req.admin.role)) return res.status(403).json({ error: 'Forbidden' });
        next();
    } catch { res.status(401).json({ error: 'Invalid Token' }); }
};

const logAction = (admin_id, action, target) => db.prepare('INSERT INTO logs (admin_id, action, target, time) VALUES (?, ?, ?, ?)').run(admin_id, action, target, Date.now());

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (admin && bcrypt.compareSync(password, admin.password)) {
        logAction(admin.id, 'Login', username);
        res.json({ token: jwt.sign({ id: admin.id, role: admin.role }, SECRET_KEY) });
    } else { res.status(401).json({ error: 'Invalid credentials' }); }
});

app.get('/api/status', auth(), async (req, res) => {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();
    const net = await si.networkStats();
    res.json({
        cpu: cpu.currentLoad.toFixed(1),
        ram: ((mem.active / mem.total) * 100).toFixed(1),
        disk: disk[0]?.use || 0,
        netUp: net[0]?.tx_sec || 0,
        netDown: net[0]?.rx_sec || 0,
        uptime: (await si.time()).uptime,
        xrayStatus: xrayManager.getXrayStatus() ? 'Running' : 'Stopped'
    });
});

app.get('/api/inbounds', auth(), (req, res) => res.json(db.prepare('SELECT * FROM inbounds').all()));
app.post('/api/inbounds', auth(['Owner', 'Admin']), (req, res) => {
    const { remark, port, protocol, network, security, path, sni, flow, dest } = req.body;
    db.prepare(`INSERT INTO inbounds (remark, port, protocol, network, security, path, sni, flow, dest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(remark, port, protocol, network, security, path, sni, flow, dest);
    logAction(req.admin.id, 'Create Inbound', remark);
    syncXray();
    res.json({ msg: 'Inbound created' });
});

app.get('/api/users', auth(), (req, res) => res.json(db.prepare('SELECT * FROM users').all()));
app.post('/api/users', auth(['Owner', 'Admin']), (req, res) => {
    const { username, inbound_id, data_limit, expiry } = req.body;
    const uuid = uuidv4();
    db.prepare(`INSERT INTO users (username, uuid, inbound_id, data_limit, expiry) VALUES (?, ?, ?, ?, ?)`).run(username, uuid, inbound_id, data_limit, expiry);
    logAction(req.admin.id, 'Create User', username);
    syncXray();
    res.json({ msg: 'User created', uuid });
});
app.delete('/api/users/:id', auth(['Owner', 'Admin']), (req, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    logAction(req.admin.id, 'Delete User', req.params.id);
    syncXray();
    res.json({ msg: 'User deleted' });
});
app.patch('/api/users/:id', auth(['Owner', 'Admin']), (req, res) => {
    const { enable, data_limit, expiry } = req.body;
    db.prepare('UPDATE users SET enable = ?, data_limit = ?, expiry = ? WHERE id = ?').run(enable, data_limit, expiry, req.params.id);
    logAction(req.admin.id, 'Update User', req.params.id);
    syncXray();
    res.json({ msg: 'User updated' });
});

app.get('/api/users/:id/links', auth(), async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    const inb = db.prepare('SELECT * FROM inbounds WHERE id = ?').get(user.inbound_id);
    let link = '';
    if (inb.protocol === 'vless') link = `vless://${user.uuid}@${DOMAIN}:${inb.port}?type=${inb.network}&security=${inb.security}&path=%2F${inb.path}#${user.username}`;
    else if (inb.protocol === 'vmess') link = `vmess://${Buffer.from(JSON.stringify({ v:"2", ps:user.username, add:DOMAIN, port:inb.port.toString(), id:user.uuid, aid:"0", net:inb.network, path:`/${inb.path}` })).toString('base64')}`;
    else if (inb.protocol === 'trojan') link = `trojan://${user.uuid}@${DOMAIN}:${inb.port}?security=${inb.security}&sni=${inb.sni}#${user.username}`;
    
    const qr = await QRCode.toDataURL(link);
    const subLink = `${DOMAIN}/sub/${user.uuid}`;
    res.json({ link, qr, subLink });
});

app.get('/api/logs', auth(['Owner', 'Admin']), (req, res) => res.json(db.prepare('SELECT * FROM logs ORDER BY time DESC LIMIT 100').all()));
app.get('/api/settings', auth(['Owner']), (req, res) => res.json(db.prepare('SELECT * FROM settings').all()));
app.post('/api/settings', auth(['Owner']), (req, res) => {
    const { key, value } = req.body;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    res.json({ msg: 'Setting updated' });
});

app.get('/api/backup', auth(['Owner']), (req, res) => {
    const backup = db.prepare('SELECT * FROM users').all();
    res.json({ backup });
});

const syncXray = () => {
    const inbounds = db.prepare('SELECT * FROM inbounds').all();
    const users = db.prepare('SELECT * FROM users').all();
    xrayManager.updateConfig(inbounds, users);
};

xrayManager.startXray();
app.listen(PORT, () => console.log(`Core Enterprise Backend running on ${PORT}`));