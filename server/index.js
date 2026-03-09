const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const HubitatClient = require('./hubitatClient');
const setupDatabase = require('./database');

const app = express();
const server = http.createServer(app);
let db;

// Database and Hubitat Client Initialization
(async () => {
    db = await setupDatabase();
    console.log('Database initialized');
})();

const hubitat = new HubitatClient({
    ip: process.env.HUBITAT_IP,
    appId: process.env.HUBITAT_APP_ID,
    accessToken: process.env.HUBITAT_ACCESS_TOKEN
});

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(helmet({
    contentSecurityPolicy: false, // Disable for development/local ease, can be tightened later
}));
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// Serve static frontend in production
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Basic health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Device Routes
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await hubitat.getDevices();
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

app.get('/api/devices/:id', async (req, res) => {
    try {
        const details = await hubitat.getDeviceDetails(req.params.id);
        res.json(details);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch device details' });
    }
});

app.post('/api/devices/:id/command', async (req, res) => {
    const { command, secondary } = req.body;
    try {
        const result = await hubitat.sendCommand(req.params.id, command, secondary);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to send command' });
    }
});

// Group Routes
app.get('/api/groups', async (req, res) => {
    try {
        const groups = await db.all('SELECT * FROM groups');
        const deviceGroups = await db.all('SELECT * FROM device_groups');
        res.json({ groups, deviceGroups });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

app.post('/api/groups', async (req, res) => {
    const { name, type, description } = req.body;
    try {
        const result = await db.run(
            'INSERT INTO groups (name, type, description) VALUES (?, ?, ?)',
            [name, type, description]
        );
        res.json({ id: result.lastID });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create group' });
    }
});

app.post('/api/groups/:id/devices', async (req, res) => {
    const { deviceId } = req.body;
    try {
        await db.run(
            'INSERT OR REPLACE INTO device_groups (device_id, group_id) VALUES (?, ?)',
            [deviceId, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add device to group' });
    }
});

// Monitoring Routes
app.get('/api/monitoring/:deviceId', async (req, res) => {
    try {
        const history = await db.all(
            'SELECT * FROM device_history WHERE device_id = ? ORDER BY timestamp DESC LIMIT 100',
            [req.params.deviceId]
        );
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch monitoring data' });
    }
});

// Maker API Event Receiver (Webhook)
app.post('/events', async (req, res) => {
    const event = req.body;
    console.log('Received event from Hubitat:', event);

    // Auto-log power and temperature to history
    if (event.name === 'power' || event.name === 'temperature' || event.name === 'energy') {
        try {
            await db.run(
                'INSERT INTO device_history (device_id, attribute, value) VALUES (?, ?, ?)',
                [event.deviceId, event.name, event.value]
            );
        } catch (err) {
            console.error('Failed to log device history:', err.message);
        }
    }

    io.emit('hub_event', event);
    res.status(200).send('Event received');
});

const PORT = process.env.PORT || 3020;
server.listen(PORT, () => {
    console.log(`Hubismart server running on port ${PORT}`);
});
