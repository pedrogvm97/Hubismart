const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class UpdaterService {
    constructor(db, io) {
        this.db = db;
        this.io = io;
        this.currentVersion = this.resolveCurrentVersion();
        this.checkTimer = null;
        this.repo = 'pedrogvm97/Hubismart';
        this.hasDockerSocket = fs.existsSync('/var/run/docker.sock');

        console.log(`[UpdaterService] Initialized. Current Version: ${this.currentVersion}. Docker socket: ${this.hasDockerSocket ? 'AVAILABLE' : 'NOT FOUND'}`);

        // Periodic check loop (every 6 hours)
        this.startPeriodicCheck();
    }

    resolveCurrentVersion() {
        if (process.env.APP_VERSION) {
            return process.env.APP_VERSION.startsWith('v') ? process.env.APP_VERSION : `v${process.env.APP_VERSION}`;
        }
        try {
            const pkgPath = path.join(__dirname, '..', 'package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                if (pkg.version) return `v${pkg.version}`;
            }
        } catch (e) { }

        try {
            const serverPkg = path.join(__dirname, 'package.json');
            if (fs.existsSync(serverPkg)) {
                const pkg = JSON.parse(fs.readFileSync(serverPkg, 'utf8'));
                if (pkg.version) return `v${pkg.version}`;
            }
        } catch (e) { }

        return 'v1.0.3';
    }

    startPeriodicCheck() {
        // Initial check 10 seconds after boot
        setTimeout(() => this.checkForUpdates(true), 10000);

        // Every 6 hours
        this.checkTimer = setInterval(() => {
            this.checkForUpdates(true);
        }, 6 * 60 * 60 * 1000);
    }

    async getSettings() {
        let settings = await this.db.get('SELECT * FROM system_settings WHERE id = 1');
        if (!settings) {
            settings = {
                id: 1,
                auto_update: 0,
                check_interval_hours: 6,
                current_version: this.currentVersion,
                last_checked: new Date().toISOString()
            };
        }
        return settings;
    }

    async updateSettings(newSettings) {
        await this.db.run(`
            UPDATE system_settings SET
              auto_update = COALESCE(?, auto_update),
              check_interval_hours = COALESCE(?, check_interval_hours)
            WHERE id = 1
        `, [
            newSettings.auto_update !== undefined ? (newSettings.auto_update ? 1 : 0) : null,
            newSettings.check_interval_hours
        ]);
        return this.getSettings();
    }

    async fetchGitHubReleases() {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: `/repos/${this.repo}/releases?per_page=30`,
                headers: {
                    'User-Agent': 'Hubismart-Surveillance-Manager'
                }
            };

            https.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (!Array.isArray(parsed)) {
                            return resolve({ success: false, error: parsed.message || 'Failed to parse releases', releases: [] });
                        }
                        resolve({ success: true, releases: parsed });
                    } catch (e) {
                        resolve({ success: false, error: e.message, releases: [] });
                    }
                });
            }).on('error', (err) => {
                resolve({ success: false, error: err.message, releases: [] });
            });
        });
    }

    compareVersions(vA, vB) {
        // Normalize v1.0.3 -> [1, 0, 3]
        const cleanA = (vA || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
        const cleanB = (vB || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);

        for (let i = 0; i < Math.max(cleanA.length, cleanB.length); i++) {
            const a = cleanA[i] || 0;
            const b = cleanB[i] || 0;
            if (a > b) return 1;
            if (a < b) return -1;
        }
        return 0;
    }

    async checkForUpdates(isAutoRun = false) {
        const settings = await this.getSettings();
        await this.db.run('UPDATE system_settings SET last_checked = CURRENT_TIMESTAMP WHERE id = 1');

        const { success, releases, error } = await this.fetchGitHubReleases();
        if (!success || releases.length === 0) {
            return {
                currentVersion: this.currentVersion,
                latestVersion: this.currentVersion,
                updateAvailable: false,
                releases: [],
                error: error || 'No releases found'
            };
        }

        const latestRelease = releases[0];
        const latestTag = latestRelease.tag_name;
        const currentClean = this.currentVersion;
        const cmp = this.compareVersions(latestTag, currentClean);
        const updateAvailable = cmp > 0;

        const formattedReleases = releases.map((rel, idx) => {
            const relCmp = this.compareVersions(rel.tag_name, currentClean);
            return {
                id: rel.id,
                tag: rel.tag_name,
                name: rel.name || rel.tag_name,
                publishedAt: rel.published_at,
                notes: rel.body || 'No release notes provided.',
                htmlUrl: rel.html_url,
                isCurrent: this.compareVersions(rel.tag_name, currentClean) === 0,
                isLatest: idx === 0,
                isUpgrade: relCmp > 0,
                isDowngrade: relCmp < 0
            };
        });

        const status = {
            currentVersion: this.currentVersion,
            latestVersion: latestTag,
            updateAvailable,
            hasDockerSocket: this.hasDockerSocket,
            autoUpdateEnabled: !!settings.auto_update,
            lastChecked: new Date().toISOString(),
            releases: formattedReleases
        };

        if (this.io) {
            this.io.emit('version_status', status);
        }

        // Automatic update if enabled and a newer version exists
        if (isAutoRun && settings.auto_update && updateAvailable) {
            console.log(`[UpdaterService] Auto-update triggered for new version ${latestTag}!`);
            this.executeVersionSwitch(latestTag, true);
        }

        return status;
    }

    // Call Docker API via /var/run/docker.sock
    dockerRequest(method, endpoint, body = null) {
        return new Promise((resolve, reject) => {
            if (!this.hasDockerSocket) {
                return reject(new Error('Docker socket /var/run/docker.sock is not mounted in container.'));
            }

            const options = {
                socketPath: '/var/run/docker.sock',
                path: endpoint,
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
                    } catch (e) {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            });

            req.on('error', reject);
            if (body) {
                req.write(typeof body === 'string' ? body : JSON.stringify(body));
            }
            req.end();
        });
    }

    async executeVersionSwitch(targetTag, isAuto = false) {
        console.log(`[UpdaterService] Initiating version switch to ${targetTag} (Auto: ${isAuto})`);

        if (this.io) {
            this.io.emit('update_progress', {
                status: 'pulling',
                targetTag,
                message: `Pulling image ghcr.io/pedrogvm97/hubismart:${targetTag}...`
            });
        }

        // Fallback command that the user or Unraid host can run directly
        const hostCommand = `docker pull ghcr.io/pedrogvm97/hubismart:${targetTag} && docker stop Hubismart && docker rm Hubismart && docker run -d --name Hubismart --net=host --restart unless-stopped -v /mnt/user/appdata/hubismart/data:/app/data -v /mnt/user/appdata/hubismart/recordings:/app/recordings -v /var/run/docker.sock:/var/run/docker.sock -e PORT=3020 ghcr.io/pedrogvm97/hubismart:${targetTag}`;

        if (!this.hasDockerSocket) {
            return {
                success: false,
                requiresHostAction: true,
                targetTag,
                message: 'Docker socket not mounted. Run the command below on Unraid or update template.',
                command: hostCommand
            };
        }

        try {
            // 1. Pull the requested image tag via Docker socket API
            const pullPath = `/images/create?fromImage=ghcr.io%2Fpedrogvm97%2Fhubismart&tag=${encodeURIComponent(targetTag)}`;
            await this.dockerRequest('POST', pullPath);

            console.log(`[UpdaterService] Image pulled successfully. Launching atomic recreation...`);

            if (this.io) {
                this.io.emit('update_progress', {
                    status: 'restarting',
                    targetTag,
                    message: `Restarting container with version ${targetTag}...`
                });
            }

            // 2. Remove any previous updater runner if present
            await this.dockerRequest('DELETE', '/containers/hubismart-updater?force=true').catch(() => {});

            // 3. Create transient sibling runner container with AutoRemove
            const restartPy = `
import http.client, socket, time, json

def call(method, path, body=None):
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.connect('/var/run/docker.sock')
        conn = http.client.HTTPConnection('localhost')
        conn.sock = s
        headers = {'Content-Type': 'application/json'} if body else {}
        conn.request(method, path, body, headers)
        res = conn.getresponse()
        data = res.read()
        s.close()
        return res.status, data
    except Exception as e:
        return 0, str(e).encode()

time.sleep(2)
call('POST', '/containers/Hubismart/stop?t=10')
call('DELETE', '/containers/Hubismart?force=true')

payload = json.dumps({
    "Image": "ghcr.io/pedrogvm97/hubismart:${targetTag}",
    "HostConfig": {
        "NetworkMode": "host",
        "RestartPolicy": {"Name": "unless-stopped"},
        "Binds": [
            "/mnt/user/appdata/hubismart/data:/app/data:rw",
            "/mnt/user/appdata/hubismart/recordings:/app/recordings:rw",
            "/var/run/docker.sock:/var/run/docker.sock:rw"
        ]
    },
    "Env": ["PORT=3020"]
})

call('POST', '/containers/create?name=Hubismart', payload)
call('POST', '/containers/Hubismart/start')
`;

            const runnerPayload = {
                Image: `ghcr.io/pedrogvm97/hubismart:${targetTag}`,
                Entrypoint: ['python3', '-c'],
                Cmd: [restartPy],
                HostConfig: {
                    AutoRemove: true,
                    Binds: ['/var/run/docker.sock:/var/run/docker.sock:rw']
                }
            };

            const createRes = await this.dockerRequest('POST', '/containers/create?name=hubismart-updater', runnerPayload);
            if (createRes.status === 201) {
                await this.dockerRequest('POST', '/containers/hubismart-updater/start');
                console.log('[UpdaterService] Transient sibling updater container launched successfully.');
            } else {
                throw new Error(`Failed to create updater runner: ${JSON.stringify(createRes.body)}`);
            }

            return {
                success: true,
                targetTag,
                message: `Update initiated! Switching to ${targetTag}. Container will restart in seconds.`
            };
        } catch (err) {
            console.error('[UpdaterService] Error during version switch:', err.message);
            return {
                success: false,
                targetTag,
                error: err.message,
                command: hostCommand
            };
        }
    }
}

module.exports = UpdaterService;
