const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function setupDatabase() {
    const db = await open({
        filename: path.join(__dirname, 'hubismart.db'),
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

    // Default groups
    const groupCount = await db.get('SELECT COUNT(*) as count FROM groups');
    if (groupCount.count === 0) {
        await db.run("INSERT INTO groups (name, type) VALUES ('Living Room', 'room')");
        await db.run("INSERT INTO groups (name, type) VALUES ('Kitchen', 'room')");
        await db.run("INSERT INTO groups (name, type) VALUES ('Bedroom', 'room')");
    }

    return db;
}

module.exports = setupDatabase;
