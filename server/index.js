const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const HubitatClient = require('./hubitatClient');
const setupDatabase = require('./database');
const CameraService = require('./cameraService');
const RecorderService = require('./recorderService');
const UpdaterService = require('./updaterService');

const app = express();
const server = http.createServer(app);
let db;
let cameraService;
let recorderService;
let updaterService;

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Database and Service Initialization
(async () => {
    db = await setupDatabase();
    try {
        const savedConfig = await db.get('SELECT * FROM hubitat_config WHERE id = 1');
        if (savedConfig && savedConfig.ip && savedConfig.access_token) {
            hubitat = new HubitatClient({
                ip: savedConfig.ip,
                appId: savedConfig.app_id,
                accessToken: savedConfig.access_token,
                hubUsername: savedConfig.hub_username,
                hubPassword: savedConfig.hub_password
            });
            console.log('Hubitat client initialized from database config');
        }
    } catch (err) {
        console.warn('Could not load hubitat_config on startup:', err.message);
    }
    cameraService = new CameraService(db, io);
    recorderService = new RecorderService(db, io, cameraService);
    updaterService = new UpdaterService(db, io);
    console.log('Database, CameraService, RecorderService, and UpdaterService initialized');
})();

let hubitat = new HubitatClient({
    ip: process.env.HUBITAT_IP || '',
    appId: process.env.HUBITAT_APP_ID || '',
    accessToken: process.env.HUBITAT_ACCESS_TOKEN || ''
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
        if (!hubitat || !hubitat.isConfigured()) {
            return res.json({ devices: [], configured: false, message: 'Hubitat credentials not configured' });
        }
        const devices = await hubitat.getDevices();

        // Query custom metadata and room names from DB
        const metadataMap = {};
        const roomsMap = {};
        if (db) {
            try {
                const metaRows = await db.all('SELECT * FROM device_metadata');
                metaRows.forEach(r => { metadataMap[r.device_id] = r; });

                const roomRows = await db.all("SELECT id, name FROM groups WHERE type = 'room'");
                roomRows.forEach(rm => { roomsMap[rm.id] = rm.name; });
            } catch (dbErr) {
                console.warn('Error reading device_metadata:', dbErr.message);
            }
        }

        const enrichedDevices = devices.map(d => {
            const meta = metadataMap[d.id] || {};
            let automations = [];
            try {
                automations = meta.automations_json ? JSON.parse(meta.automations_json) : [];
            } catch (e) {}

            return {
                ...d,
                customName: meta.custom_name || '',
                roomId: meta.room_id || null,
                roomName: meta.room_id && roomsMap[meta.room_id] ? roomsMap[meta.room_id] : (d.room || ''),
                driverCode: meta.driver_code || '',
                driverName: meta.driver_name || d.type || '',
                automations
            };
        });

        res.json({ devices: enrichedDevices, configured: true, count: enrichedDevices.length });
    } catch (error) {
        console.error('Error in GET /api/devices:', error.message);
        res.status(200).json({ devices: [], configured: true, error: error.message });
    }
});

app.get('/api/devices/:id', async (req, res) => {
    try {
        const details = await hubitat.getDeviceDetails(req.params.id);
        let meta = null;
        if (db) {
            meta = await db.get('SELECT * FROM device_metadata WHERE device_id = ?', [req.params.id]);
        }
        let automations = [];
        try {
            if (meta?.automations_json) automations = JSON.parse(meta.automations_json);
        } catch (e) {}

        res.json({
            ...details,
            customName: meta?.custom_name || '',
            roomId: meta?.room_id || null,
            driverCode: meta?.driver_code || '',
            driverName: meta?.driver_name || details.type || '',
            automations
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch device details' });
    }
});

app.put('/api/devices/:id/meta', async (req, res) => {
    const { customName, roomId, driverCode, driverName, automations } = req.body;
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const automationsJson = automations !== undefined ? JSON.stringify(automations) : '[]';
        await db.run(`
            INSERT INTO device_metadata (device_id, custom_name, room_id, driver_code, driver_name, automations_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(device_id) DO UPDATE SET
                custom_name = COALESCE(excluded.custom_name, device_metadata.custom_name),
                room_id = COALESCE(excluded.room_id, device_metadata.room_id),
                driver_code = COALESCE(excluded.driver_code, device_metadata.driver_code),
                driver_name = COALESCE(excluded.driver_name, device_metadata.driver_name),
                automations_json = COALESCE(excluded.automations_json, device_metadata.automations_json),
                updated_at = CURRENT_TIMESTAMP
        `, [req.params.id, customName ?? null, roomId ?? null, driverCode ?? null, driverName ?? null, automationsJson]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
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

// Hubitat Configuration & Verification
app.get('/api/config/hubitat', async (req, res) => {
    try {
        let config = null;
        if (db) {
            config = await db.get('SELECT ip, app_id, access_token, hub_username FROM hubitat_config WHERE id = 1');
        }
        const ip = config?.ip || process.env.HUBITAT_IP || '';
        const appId = config?.app_id || process.env.HUBITAT_APP_ID || '';
        const token = config?.access_token || process.env.HUBITAT_ACCESS_TOKEN || '';
        const hubUsername = config?.hub_username || '';

        const isConfigured = !!(ip && appId && token);
        res.json({
            ip,
            appId,
            token,
            hubUsername,
            configured: isConfigured,
            baseUrl: isConfigured ? `http://${ip}/apps/api/${appId}` : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config/verify', async (req, res) => {
    const { ip, appId, token, hubUsername, hubPassword } = req.body;
    const result = await HubitatClient.validateConnection({ ip, appId, token });
    if (result.success) {
        // Update live client
        hubitat = new HubitatClient({
            ip,
            appId,
            accessToken: token,
            hubUsername,
            hubPassword
        });

        // Persist credentials to SQLite database
        if (db) {
            try {
                await db.run(`
                    INSERT INTO hubitat_config (id, ip, app_id, access_token, hub_username, hub_password, updated_at)
                    VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(id) DO UPDATE SET
                        ip = excluded.ip,
                        app_id = excluded.app_id,
                        access_token = excluded.access_token,
                        hub_username = COALESCE(excluded.hub_username, hubitat_config.hub_username),
                        hub_password = COALESCE(excluded.hub_password, hubitat_config.hub_password),
                        updated_at = CURRENT_TIMESTAMP
                `, [ip, appId, token, hubUsername || '', hubPassword || '']);
            } catch (dbErr) {
                console.error('Failed to persist hubitat_config:', dbErr.message);
            }
        }

        res.json({ success: true, deviceCount: result.deviceCount });
    } else {
        res.status(400).json({ error: result.error });
    }
});

// Driver Management & Groovy Code Sync
app.post('/api/hubitat/driver/sync', async (req, res) => {
    const { deviceId, driverCode, driverName } = req.body;
    try {
        const validation = HubitatClient.validateGroovyDriver(driverCode);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Driver code validation failed',
                details: validation.errors,
                warnings: validation.warnings
            });
        }

        // Save locally to device_metadata
        if (db && deviceId) {
            await db.run(`
                INSERT INTO device_metadata (device_id, driver_code, driver_name, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(device_id) DO UPDATE SET
                    driver_code = excluded.driver_code,
                    driver_name = excluded.driver_name,
                    updated_at = CURRENT_TIMESTAMP
            `, [deviceId, driverCode, driverName || 'Custom Driver']);
        }

        // Attempt hub firmware push if admin access is available
        let hubSync = { success: false, note: 'Saved locally. Admin credentials required on hub for firmware installation.' };
        if (hubitat && hubitat.isConfigured()) {
            try {
                hubSync = await hubitat.pushDriverToHub(driverCode, null, driverName);
            } catch (pushErr) {
                hubSync = { success: false, error: pushErr.message };
            }
        }

        res.json({
            success: true,
            validation,
            hubSync,
            message: 'Driver validated and saved successfully'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Zigbee & Z-Wave Pairing / Exclusion Endpoints
app.post('/api/hubitat/pairing/start', async (req, res) => {
    const { type = 'zigbee', seconds = 60 } = req.body;
    try {
        if (!hubitat) return res.status(503).json({ error: 'Hubitat client not initialized' });
        let result;
        if (type === 'zigbee') {
            result = await hubitat.startZigbeePairing(seconds);
        } else if (type === 'zwave_include') {
            result = await hubitat.startZwaveInclusion();
        } else if (type === 'zwave_exclude') {
            result = await hubitat.startZwaveExclusion();
        } else {
            return res.status(400).json({ error: 'Invalid pairing type' });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/hubitat/pairing/stop', async (req, res) => {
    try {
        if (!hubitat) return res.status(503).json({ error: 'Hubitat client not initialized' });
        const result = await hubitat.stopZigbeePairing();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Floor Plans & Rooms Routes
app.get('/api/floorplans', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const plans = await db.all('SELECT * FROM floor_plans ORDER BY level ASC, id ASC');
        res.json(plans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/floorplans', async (req, res) => {
    const { id, name = 'Floor Plan', level = 1, layout_json } = req.body;
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        let resultId = id;
        const layoutStr = typeof layout_json === 'string' ? layout_json : JSON.stringify(layout_json);
        if (id) {
            await db.run(
                'UPDATE floor_plans SET name = ?, level = ?, layout_json = ? WHERE id = ?',
                [name, level, layoutStr, id]
            );
        } else {
            const ins = await db.run(
                'INSERT INTO floor_plans (name, level, layout_json) VALUES (?, ?, ?)',
                [name, level, layoutStr]
            );
            resultId = ins.lastID;
        }
        res.json({ success: true, id: resultId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/rooms', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const rooms = await db.all("SELECT * FROM groups WHERE type = 'room' ORDER BY name ASC");
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rooms', async (req, res) => {
    const { name, description } = req.body;
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const result = await db.run("INSERT INTO groups (name, type, description) VALUES (?, 'room', ?)", [name, description || '']);
        res.json({ id: result.lastID, name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/rooms/:id', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        await db.run('DELETE FROM groups WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config/export', async (req, res) => {
    const { password } = req.body;
    try {
        const groups = await db.all('SELECT * FROM groups');
        const deviceGroups = await db.all('SELECT * FROM device_groups');
        const floorPlans = await db.all('SELECT * FROM floor_plans');

        const configData = {
            hub: {
                ip: process.env.HUBITAT_IP,
                appId: process.env.HUBITAT_APP_ID,
                token: process.env.HUBITAT_ACCESS_TOKEN
            },
            groups,
            deviceGroups,
            floorPlans,
            exportedAt: new Date().toISOString()
        };

        const encrypted = encryptConfig(configData, password);
        res.json(encrypted);
    } catch (error) {
        res.status(500).json({ error: 'Export failed' });
    }
});

app.post('/api/config/import', async (req, res) => {
    const { encryptedData, password } = req.body;
    try {
        const config = decryptConfig(encryptedData, password);

        // Begin transaction for import
        await db.run('BEGIN TRANSACTION');

        // Clear existing (optional, or merge)
        await db.run('DELETE FROM groups');
        await db.run('DELETE FROM device_groups');
        await db.run('DELETE FROM floor_plans');

        for (const g of config.groups) {
            await db.run('INSERT INTO groups (id, name, type, description) VALUES (?, ?, ?, ?)', [g.id, g.name, g.type, g.description]);
        }
        for (const dg of config.deviceGroups) {
            await db.run('INSERT INTO device_groups (device_id, group_id) VALUES (?, ?)', [dg.device_id, dg.group_id]);
        }
        for (const fp of config.floorPlans) {
            await db.run('INSERT INTO floor_plans (id, name, level, layout_json) VALUES (?, ?, ?, ?)', [fp.id, fp.name, fp.level, fp.layout_json]);
        }

        await db.run('COMMIT');
        res.json({ success: true, hubHint: config.hub });
    } catch (error) {
        await db.run('ROLLBACK');
        res.status(400).json({ error: error.message });
    }
});

// ======================== CAMERA ROUTES ========================
app.get('/api/cameras', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const cameras = await db.all('SELECT * FROM cameras ORDER BY is_hub ASC, id ASC');
        res.json(cameras);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cameras/scan', async (req, res) => {
    try {
        if (!cameraService) return res.status(503).json({ error: 'Camera service initializing' });
        const cameras = await cameraService.scanNetwork();
        res.json(cameras);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cameras', async (req, res) => {
    const { name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub } = req.body;
    try {
        const result = await db.run(
            `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name || 'New Camera', ip, port || 554, channel || 1, stream_path || '/h264/ch1/main/av_stream', username || 'admin', verification_code || '', mac || '', serial || '', model || '', is_hub ? 1 : 0, 'online']
        );
        const newCam = await db.get('SELECT * FROM cameras WHERE id = ?', [result.lastID]);
        res.json(newCam);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/cameras/:id', async (req, res) => {
    const { name, ip, port, channel, stream_path, username, verification_code, model } = req.body;
    try {
        await db.run(
            `UPDATE cameras SET name = ?, ip = ?, port = ?, channel = ?, stream_path = ?, username = ?, verification_code = ?, model = ?
             WHERE id = ?`,
            [name, ip, port || 554, channel || 1, stream_path, username || 'admin', verification_code, model, req.params.id]
        );
        const updated = await db.get('SELECT * FROM cameras WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/cameras/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM cameras WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cameras/:id/stream', async (req, res) => {
    try {
        if (!cameraService || !db) return res.status(503).send('Service initializing');
        const camera = await db.get('SELECT * FROM cameras WHERE id = ?', [req.params.id]);
        if (!camera) return res.status(404).send('Camera not found');
        cameraService.handleStream(camera, req, res);
    } catch (error) {
        console.error('Stream error:', error);
        res.status(500).send(error.message);
    }
});

app.get('/api/cameras/:id/snapshot', async (req, res) => {
    try {
        if (!cameraService || !db) return res.status(503).send('Service initializing');
        const camera = await db.get('SELECT * FROM cameras WHERE id = ?', [req.params.id]);
        if (!camera) return res.status(404).send('Camera not found');
        const imageBuffer = await cameraService.getSnapshot(camera);
        res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': imageBuffer.length,
            'Cache-Control': 'no-cache'
        });
        res.end(imageBuffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cameras/:id/test', async (req, res) => {
    try {
        if (!cameraService || !db) return res.status(503).json({ error: 'Service initializing' });
        let camera = await db.get('SELECT * FROM cameras WHERE id = ?', [req.params.id]);
        if (!camera) return res.status(404).json({ error: 'Camera not found' });
        
        // If request includes a temporary code to test with, override it for testing
        if (req.body && req.body.verification_code !== undefined) {
            camera = { ...camera, verification_code: req.body.verification_code };
        }

        const result = await cameraService.testConnection(camera);
        // If test succeeded or failed with auth, update status in DB
        const newStatus = result.success ? 'streaming' : (result.status === 'auth_required' ? 'auth_required' : 'error');
        await db.run('UPDATE cameras SET status = ? WHERE id = ?', [newStatus, camera.id]);
        res.json({ ...result, updatedStatus: newStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cameras/debug/logs', (req, res) => {
    if (!cameraService) return res.json([]);
    res.json(cameraService.getLogs());
});

// ======================== RECORDINGS & GALLERY ROUTES ========================
const fs = require('fs');

app.get('/api/recordings', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const { camera_id, motion_type, has_motion, from_time, to_time, search, limit = 1000, offset = 0, order = 'desc' } = req.query;
        let query = `
            SELECT r.*, c.name as camera_name, c.ip as camera_ip 
            FROM recordings r 
            LEFT JOIN cameras c ON r.camera_id = c.id 
            WHERE 1=1
        `;
        const params = [];

        if (camera_id) {
            query += ' AND r.camera_id = ?';
            params.push(camera_id);
        }
        if (has_motion !== undefined && has_motion !== '') {
            query += ' AND r.has_motion = ?';
            params.push(+has_motion);
        }
        if (motion_type && motion_type !== 'all') {
            query += ' AND r.motion_type = ?';
            params.push(motion_type);
        }
        if (from_time) {
            query += ' AND r.start_time >= ?';
            params.push(from_time);
        }
        if (to_time) {
            query += ' AND r.start_time <= ?';
            params.push(to_time);
        }
        if (search) {
            query += ' AND (r.detected_persons LIKE ? OR r.motion_type LIKE ? OR c.name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const sortDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY r.start_time ${sortDir} LIMIT ? OFFSET ?`;
        params.push(+limit, +offset);

        const rows = await db.all(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/recordings/:id', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const recording = await db.get('SELECT r.*, c.name as camera_name FROM recordings r LEFT JOIN cameras c ON r.camera_id = c.id WHERE r.id = ?', [req.params.id]);
        if (!recording) return res.status(404).json({ error: 'Recording not found' });
        res.json(recording);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stream MP4 video with HTTP 206 Partial Content range requests and AAC audio
app.get('/api/recordings/:id/video', async (req, res) => {
    try {
        if (!db) return res.status(503).send('Database initializing');
        const recording = await db.get('SELECT * FROM recordings WHERE id = ?', [req.params.id]);
        if (!recording || !fs.existsSync(recording.filepath)) {
            return res.status(404).send('Recording video file not found');
        }

        const stat = fs.statSync(recording.filepath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(recording.filepath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(200, head);
            fs.createReadStream(recording.filepath).pipe(res);
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Serve thumbnail image
app.get('/api/recordings/:id/thumbnail', async (req, res) => {
    try {
        if (!db) return res.status(503).send('Database initializing');
        const recording = await db.get('SELECT * FROM recordings WHERE id = ?', [req.params.id]);
        if (!recording || !recording.thumbnail_path || !fs.existsSync(recording.thumbnail_path)) {
            return res.status(404).send('Thumbnail not found');
        }
        res.sendFile(recording.thumbnail_path);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Toggle permanent lock on recording
app.post('/api/recordings/:id/lock', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const rec = await db.get('SELECT * FROM recordings WHERE id = ?', [req.params.id]);
        if (!rec) return res.status(404).json({ error: 'Recording not found' });
        const newLock = rec.keep_permanent ? 0 : 1;
        await db.run('UPDATE recordings SET keep_permanent = ? WHERE id = ?', [newLock, req.params.id]);
        res.json({ success: true, keep_permanent: newLock });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Tag recording with identified person or motion type
app.post('/api/recordings/:id/tag', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const { person, motion_type } = req.body;
        const rec = await db.get('SELECT * FROM recordings WHERE id = ?', [req.params.id]);
        if (!rec) return res.status(404).json({ error: 'Recording not found' });

        let persons = [];
        try { persons = JSON.parse(rec.detected_persons || '[]'); } catch (e) { }
        if (person && !persons.includes(person.trim())) {
            persons.push(person.trim());
        }
        const updatedMotion = motion_type || rec.motion_type;
        await db.run(
            'UPDATE recordings SET detected_persons = ?, motion_type = ?, has_motion = 1 WHERE id = ?',
            [JSON.stringify(persons), updatedMotion, req.params.id]
        );
        res.json({ success: true, detected_persons: persons, motion_type: updatedMotion });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete recording file and record
app.delete('/api/recordings/:id', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const rec = await db.get('SELECT * FROM recordings WHERE id = ?', [req.params.id]);
        if (!rec) return res.status(404).json({ error: 'Recording not found' });
        if (recorderService) {
            recorderService.deleteRecordingFiles(rec);
        }
        await db.run('DELETE FROM recordings WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Storage status and continuous duration estimator
app.get('/api/storage/status', async (req, res) => {
    try {
        if (!recorderService) return res.status(503).json({ error: 'Recorder initializing' });
        const status = await recorderService.getStorageStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update storage settings (max quota, continuous rolling buffer, retention mode)
app.post('/api/storage/settings', async (req, res) => {
    try {
        if (!recorderService) return res.status(503).json({ error: 'Recorder initializing' });
        const updated = await recorderService.updateSettings(req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Known persons endpoints
app.get('/api/persons', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const persons = await db.all('SELECT * FROM known_persons ORDER BY name ASC');
        res.json(persons);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/persons', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Database initializing' });
        const { name, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const result = await db.run('INSERT INTO known_persons (name, notes) VALUES (?, ?)', [name.trim(), notes || '']);
        const person = await db.get('SELECT * FROM known_persons WHERE id = ?', [result.lastID]);
        res.json(person);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================== SYSTEM UPDATES & VERSIONING ROUTES ========================
app.get('/api/system/version', async (req, res) => {
    try {
        if (!updaterService) return res.status(503).json({ error: 'Updater initializing' });
        const status = await updaterService.checkForUpdates(false);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/system/check-updates', async (req, res) => {
    try {
        if (!updaterService) return res.status(503).json({ error: 'Updater initializing' });
        const status = await updaterService.checkForUpdates(false);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/system/update', async (req, res) => {
    try {
        if (!updaterService) return res.status(503).json({ error: 'Updater initializing' });
        const { targetTag } = req.body;
        if (!targetTag) return res.status(400).json({ error: 'targetTag is required' });
        const result = await updaterService.executeVersionSwitch(targetTag, false);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/system/settings', async (req, res) => {
    try {
        if (!updaterService) return res.status(503).json({ error: 'Updater initializing' });
        const settings = await updaterService.getSettings();
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/system/settings', async (req, res) => {
    try {
        if (!updaterService) return res.status(503).json({ error: 'Updater initializing' });
        const updated = await updaterService.updateSettings(req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3020;
server.listen(PORT, () => {
    console.log(`Hubismart server running on port ${PORT}`);
});

