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

    // Default cameras seed based on local discovery
    const cameraCount = await db.get('SELECT COUNT(*) as count FROM cameras');
    if (cameraCount.count === 0) {
        await db.run(
            `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['EZVIZ Camera 1', '192.168.1.66', 554, 1, '/h264/ch1/main/av_stream', 'admin', '', '78:f2:35:60:1e:21', 'ec97e0dd435a', 'EZVIZ IP Camera', 0, 'online']
        );
        await db.run(
            `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['EZVIZ Camera 2', '192.168.1.67', 554, 1, '/h264/ch1/main/av_stream', 'admin', '', '78:f2:35:60:43:f9', 'ec97e0d94ea6', 'EZVIZ IP Camera', 0, 'online']
        );
        await db.run(
            `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['EZVIZ Camera 3', '192.168.1.69', 554, 1, '/h264/ch1/main/av_stream', 'admin', '', '78:f2:35:60:3b:ce', 'ec97e0dd438a', 'EZVIZ IP Camera', 0, 'online']
        );
        await db.run(
            `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, mac, serial, model, is_hub, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['EZVIZ Hub Feed (Ch 1)', '192.168.1.72', 554, 1, '/Streaming/Channels/101', 'admin', '', '64:f2:fb:f3:13:86', 'EZVIZ_X5S', 'CS-X5S-8W Hub', 1, 'online']
        );
    }

    return db;
}

module.exports = setupDatabase;

