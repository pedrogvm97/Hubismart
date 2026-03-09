const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const HubitatClient = require('./hubitatClient');

const app = express();
const server = http.createServer(app);

// Hubitat Client Initialization
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

app.use(helmet());
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

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

// Maker API Event Receiver (Webhook)
app.post('/events', (req, res) => {
    const event = req.body;
    console.log('Received event from Hubitat:', event);
    io.emit('hub_event', event);
    res.status(200).send('Event received');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Hubismart server running on port ${PORT}`);
});
