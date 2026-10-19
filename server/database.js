const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function setupDatabase() {
    const dataDir = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : __dirname);
    if (!fs.existsSync(dataDir)) {
        try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
    }

    const db = await open({
        filename: path.join(dataDir, 'hubismart.db'),
        driver: sqlite3.Database
    });

    // Device Groups table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT, -- 'room', 'category', 'custom'
      description TEXT
    )
  `);

    // Device to Group mapping
    await db.exec(`
    CREATE TABLE IF NOT EXISTS device_groups (
      device_id TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      PRIMARY KEY (device_id, group_id),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
  `);

    // Floor Plans table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS floor_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      layout_json TEXT -- Stores the SVG/Canvas layout data
    )
  `);

    // Monitoring/History table (Power, Temperature, etc.)
    await db.exec(`
    CREATE TABLE IF NOT EXISTS device_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      attribute TEXT NOT NULL, -- 'power', 'temperature', 'status'
      value TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Hubitat configuration persistence
    await db.exec(`
    CREATE TABLE IF NOT EXISTS hubitat_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ip TEXT,
      app_id TEXT,
      access_token TEXT,
      hub_username TEXT,
      hub_password TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Device metadata (custom name, room assignment, driver code, automations)
    await db.exec(`
    CREATE TABLE IF NOT EXISTS device_metadata (
      device_id TEXT PRIMARY KEY,
      custom_name TEXT,
      room_id INTEGER,
      driver_code TEXT,
      driver_name TEXT,
      automations_json TEXT DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Cameras table for EZVIZ & IP cameras
    await db.exec(`
    CREATE TABLE IF NOT EXISTS cameras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      port INTEGER DEFAULT 554,
      channel INTEGER DEFAULT 1,
      stream_path TEXT DEFAULT '/h264/ch1/main/av_stream',
      sub_stream_path TEXT DEFAULT '/h264/ch1/sub/av_stream',
      username TEXT DEFAULT 'admin',
      verification_code TEXT,
      mac TEXT,
      serial TEXT,
      model TEXT,
      is_hub INTEGER DEFAULT 0,
      status TEXT DEFAULT 'unknown',
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Default groups
    const groupCount = await db.get('SELECT COUNT(*) as count FROM groups');
    if (groupCount.count === 0) {
        await db.run("INSERT INTO groups (name, type) VALUES ('Living Room', 'room')");
        await db.run("INSERT INTO groups (name, type) VALUES ('Kitchen', 'room')");
        await db.run("INSERT INTO groups (name, type) VALUES ('Bedroom', 'room')");
    }

    // Default floor plan if none exist
    const floorPlanCount = await db.get('SELECT COUNT(*) as count FROM floor_plans');
    if (floorPlanCount.count === 0) {
        const defaultRooms = [
            { id: 'room-1', name: 'Living Room', type: 'living_room', x: 60, y: 60, width: 240, height: 200, rotation: 0, color: '#6366f1', doors: [{ id: 'door-1', wall: 'bottom', offset: 50 }] },
            { id: 'room-2', name: 'Kitchen', type: 'kitchen', x: 330, y: 60, width: 200, height: 200, rotation: 0, color: '#10b981', doors: [{ id: 'door-2', wall: 'left', offset: 50 }] },
            { id: 'room-3', name: 'Bedroom', type: 'bedroom', x: 60, y: 290, width: 240, height: 220, rotation: 0, color: '#ec4899', doors: [{ id: 'door-3', wall: 'top', offset: 50 }] }
        ];
        await db.run(
            'INSERT INTO floor_plans (name, level, layout_json) VALUES (?, ?, ?)',
            ['Main Level', 1, JSON.stringify(defaultRooms)]
        );
    }

    // Remove any hub from cameras table
    await db.run("DELETE FROM cameras WHERE is_hub = 1 OR ip = '192.168.1.72' OR name LIKE '%Hub%'");

    // Initialize or update the 4 cameras with their verified verification codes and paths
    const cameraCount = await db.get('SELECT COUNT(*) as count FROM cameras');
    if (cameraCount.count === 0) {
        await db.run(
            `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['EZVIZ Camera 1', '192.168.1.66', 554, 1, '/Streaming/Channels/101', 'admin', 'HEHKYB', '78:f2:35:60:1e:21', 'ec97e0dd435a', 'EZVIZ IP Camera', 0, 'streaming']
        );
        await db.run(
            `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['EZVIZ Camera 2', '192.168.1.67', 554, 1, '/ch1/main/av_stream', 'admin', 'SJNYZI', '78:f2:35:60:43:f9', 'ec97e0d94ea6', 'EZVIZ IP Camera', 0, 'streaming']
        );
        await db.run(
            `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['EZVIZ Camera 3', '192.168.1.69', 554, 1, '/h264/ch1/main/av_stream', 'admin', 'HWGQML', '78:f2:35:60:3b:ce', 'ec97e0dd438a', 'EZVIZ IP Camera', 0, 'streaming']
        );
        await db.run(
            `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['EZVIZ Camera 4', '', 554, 1, '/h264/ch1/main/av_stream', 'admin', 'C9OEMG', '', '', 'EZVIZ IP Camera (Awaiting Pairing)', 0, 'awaiting_reset']
        );
    } else {
        // Update existing cameras with their working codes and paths
        await db.run("UPDATE cameras SET verification_code = 'HEHKYB', stream_path = '/Streaming/Channels/101', status = 'streaming' WHERE ip = '192.168.1.66'");
        await db.run("UPDATE cameras SET verification_code = 'SJNYZI', stream_path = '/ch1/main/av_stream', status = 'streaming' WHERE ip = '192.168.1.67'");
        await db.run("UPDATE cameras SET verification_code = 'HWGQML', stream_path = '/h264/ch1/main/av_stream', status = 'streaming' WHERE ip = '192.168.1.69'");
        const cam4 = await db.get("SELECT * FROM cameras WHERE verification_code = 'C9OEMG' OR name LIKE '%Camera 4%'");
        if (!cam4) {
            await db.run(
                `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                ['EZVIZ Camera 4', '', 554, 1, '/h264/ch1/main/av_stream', 'admin', 'C9OEMG', '', '', 'EZVIZ IP Camera (Awaiting Pairing)', 0, 'awaiting_reset']
            );
        }
    }

    // Continuous & Event Recordings table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      camera_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      thumbnail_path TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      duration_seconds REAL DEFAULT 0,
      file_size_bytes INTEGER DEFAULT 0,
      has_motion INTEGER DEFAULT 0,
      motion_type TEXT DEFAULT 'none',
      detected_persons TEXT DEFAULT '[]',
      keep_permanent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
    )
  `);

    // Storage and Retention Settings table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS recording_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      storage_path TEXT DEFAULT '/app/recordings',
      max_storage_gb REAL DEFAULT 200.0,
      continuous_buffer_minutes INTEGER DEFAULT 60,
      retention_mode TEXT DEFAULT 'keep_motion',
      detect_motion INTEGER DEFAULT 1,
      detect_human INTEGER DEFAULT 1,
      detect_animal INTEGER DEFAULT 1,
      auto_record INTEGER DEFAULT 1
    )
  `);

    // Known / Identified Persons table for facial & body tagging
    await db.exec(`
    CREATE TABLE IF NOT EXISTS known_persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Initialize default recording settings if not already present
    const settingsExist = await db.get('SELECT id FROM recording_settings WHERE id = 1');
    if (!settingsExist) {
        await db.run(`
            INSERT INTO recording_settings (id, storage_path, max_storage_gb, continuous_buffer_minutes, retention_mode, detect_motion, detect_human, detect_animal, auto_record)
            VALUES (1, '/app/recordings', 200.0, 60, 'keep_motion', 1, 1, 1, 1)
        `);
    }

    // System Settings for Updates & Versioning
    await db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      auto_update INTEGER DEFAULT 0,
      check_interval_hours INTEGER DEFAULT 6,
      current_version TEXT DEFAULT 'v1.0.3',
      last_checked DATETIME
    )
  `);

    const sysSettingsExist = await db.get('SELECT id FROM system_settings WHERE id = 1');
    if (!sysSettingsExist) {
        await db.run(`
            INSERT INTO system_settings (id, auto_update, check_interval_hours, current_version, last_checked)
            VALUES (1, 0, 6, 'v1.0.3', CURRENT_TIMESTAMP)
        `);
    }

    return db;
}

module.exports = setupDatabase;

