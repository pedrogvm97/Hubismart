const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

class CameraService {
    constructor(db, io) {
        this.db = db;
        this.io = io;
        this.activeStreams = new Map();
        this.debugLogs = [];
        this.ffmpegPath = this.resolveFFmpeg();
        this.log('CameraService', `Initialized. FFmpeg path: ${this.ffmpegPath || 'NOT FOUND'}`);
    }

    resolveFFmpeg() {
        if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
            return process.env.FFMPEG_PATH;
        }

        try {
            execSync('ffmpeg -version', { stdio: 'ignore' });
            return 'ffmpeg';
        } catch (e) { }

        const linuxPaths = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
        for (const p of linuxPaths) {
            if (fs.existsSync(p)) return p;
        }

        if (process.platform === 'win32') {
            const localAppData = process.env.LOCALAPPDATA;
            if (localAppData) {
                const wingetPackages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
                if (fs.existsSync(wingetPackages)) {
                    try {
                        const findFFmpeg = (dir) => {
                            const entries = fs.readdirSync(dir, { withFileTypes: true });
                            for (const entry of entries) {
                                const fullPath = path.join(dir, entry.name);
                                if (entry.isDirectory()) {
                                    const found = findFFmpeg(fullPath);
                                    if (found) return found;
                                } else if (entry.name.toLowerCase() === 'ffmpeg.exe') {
                                    return fullPath;
                                }
                            }
                            return null;
                        };
                        const found = findFFmpeg(wingetPackages);
                        if (found) return found;
                    } catch (err) { }
                }
            }
        }

        return 'ffmpeg';
    }

    log(source, message, details = null) {
        const entry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            source,
            message,
            details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null
        };
        this.debugLogs.unshift(entry);
        if (this.debugLogs.length > 200) {
            this.debugLogs.pop();
        }
        if (this.io) {
            this.io.emit('camera_log', entry);
        }
        console.log(`[CameraService][${source}] ${message}`);
    }

    getLogs() {
        return this.debugLogs;
    }

    buildRtspUrl(camera) {
        const user = camera.username || 'admin';
        const code = (camera.verification_code || '').trim();
        const ip = camera.ip;
        const port = camera.port || 554;
        let streamPath = camera.stream_path || '/h264/ch1/main/av_stream';
        if (!streamPath.startsWith('/')) {
            streamPath = '/' + streamPath;
        }

        if (code) {
            return `rtsp://${encodeURIComponent(user)}:${encodeURIComponent(code)}@${ip}:${port}${streamPath}`;
        }
        return `rtsp://${encodeURIComponent(user)}@${ip}:${port}${streamPath}`;
    }

    async testConnection(camera) {
        const ip = camera.ip;
        const port = camera.port || 554;
        const user = camera.username || 'admin';
        const code = (camera.verification_code || '').trim();
        const streamPath = camera.stream_path || '/h264/ch1/main/av_stream';

        if (!ip) {
            return {
                success: false,
                status: 'awaiting_reset',
                message: 'Camera has no IP assigned yet. Reset the camera and follow the pairing procedure.'
            };
        }

        this.log('Tester', `Starting connection test for ${camera.name} (${ip}:${port}${streamPath})`);

        return new Promise((resolve) => {
            const socket = new net.Socket();
            let resolved = false;
            let optionsSuccess = false;

            socket.setTimeout(4000);

            socket.on('connect', () => {
                this.log('Tester', `TCP handshake to ${ip}:${port} succeeded. Sending RTSP OPTIONS.`);
                const req = `OPTIONS rtsp://${ip}:${port}/ RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: Hubismart/1.0\r\n\r\n`;
                socket.write(req);
            });

            socket.on('data', (data) => {
                const response = data.toString('utf-8', 0, Math.min(data.length, 2048));
                this.log('Tester', `Received RTSP response from ${ip}:\n${response.split('\r\n')[0]}`);

                if (!optionsSuccess && response.includes('200 OK')) {
                    optionsSuccess = true;
                    let authHeader = '';
                    if (code) {
                        const token = Buffer.from(`${user}:${code}`).toString('base64');
                        authHeader = `Authorization: Basic ${token}\r\n`;
                    }
                    const describeReq = `DESCRIBE rtsp://${ip}:${port}${streamPath} RTSP/1.0\r\nCSeq: 2\r\nAccept: application/sdp\r\n${authHeader}User-Agent: Hubismart/1.0\r\n\r\n`;
                    socket.write(describeReq);
                    return;
                }

                if (response.includes('200 OK') && (response.includes('application/sdp') || response.includes('m=video') || response.includes('a=control'))) {
                    this.log('Tester', `Authentication SUCCESS on ${camera.name}! Stream SDP received.`);
                    finish({
                        success: true,
                        status: 'authenticated',
                        message: 'Connection and authentication successful! Stream is ready.',
                        raw: response.substring(0, 1000)
                    });
                } else if (response.includes('401 Unauthorized')) {
                    const realmMatch = response.match(/realm="([^"]+)"/);
                    const realm = realmMatch ? realmMatch[1] : '';
                    this.log('Tester', `401 Unauthorized for ${camera.name}. Verification code required (realm: ${realm}).`);
                    finish({
                        success: false,
                        status: 'auth_required',
                        realm,
                        message: code
                            ? `Verification code '${code}' was rejected. Please double-check the 6-letter code.`
                            : `Camera is online! Enter the 6-letter verification code from the camera label to stream.`,
                        raw: response.substring(0, 1000)
                    });
                } else if (response.includes('404 Not Found')) {
                    finish({
                        success: false,
                        status: 'path_not_found',
                        message: `RTSP stream path '${streamPath}' not found on this device.`,
                        raw: response.substring(0, 1000)
                    });
                } else {
                    finish({
                        success: false,
                        status: 'warning',
                        message: `RTSP response: ${response.split('\r\n')[0]}`,
                        raw: response.substring(0, 1000)
                    });
                }
            });

            socket.on('timeout', () => {
                this.log('Tester', `Connection timeout to ${ip}:${port}`);
                finish({
                    success: false,
                    status: 'timeout',
                    message: `Connection timed out reaching ${ip}:${port}. Check if device is powered on.`
                });
            });

            socket.on('error', (err) => {
                this.log('Tester', `Connection error to ${ip}:${port}: ${err.message}`);
                finish({
                    success: false,
                    status: 'error',
                    message: `TCP Connection failed: ${err.message}`
                });
            });

            const finish = (result) => {
                if (!resolved) {
                    resolved = true;
                    try { socket.destroy(); } catch (e) { }
                    resolve(result);
                }
            };

            socket.connect(port, ip);
        });
    }

    async getSnapshot(camera) {
        return new Promise((resolve, reject) => {
            const rtspUrl = this.buildRtspUrl(camera);
            const ffmpegBin = this.ffmpegPath || 'ffmpeg';

            this.log('Snapshot', `Fetching snapshot for ${camera.name}`);

            const args = [
                '-y',
                '-rtsp_transport', 'tcp',
                '-i', rtspUrl,
                '-frames:v', '1',
                '-q:v', '2',
                '-f', 'image2',
                'pipe:1'
            ];

            const proc = spawn(ffmpegBin, args);
            const chunks = [];
            let errBuf = '';

            proc.stdout.on('data', (d) => chunks.push(d));
            proc.stderr.on('data', (d) => { errBuf += d.toString(); });

            proc.on('close', (code) => {
                if (code === 0 && chunks.length > 0) {
                    resolve(Buffer.concat(chunks));
                } else {
                    this.log('Snapshot', `Snapshot failed for ${camera.name} (exit code ${code})`, errBuf.slice(-300));
                    reject(new Error(`Snapshot failed: ${errBuf.slice(-200) || 'Unknown error'}`));
                }
            });

            proc.on('error', (err) => {
                this.log('Snapshot', `FFmpeg spawn error for ${camera.name}: ${err.message}`);
                reject(err);
            });
        });
    }

    handleStream(camera, req, res) {
        const cameraId = camera.id;
        const rtspUrl = this.buildRtspUrl(camera);
        const ffmpegBin = this.ffmpegPath || 'ffmpeg';

        this.log('Stream', `Client connected to real-time stream for ${camera.name} (ID: ${cameraId})`);

        res.writeHead(200, {
            'Content-Type': 'multipart/x-mixed-replace; boundary=ffserver',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'close',
            'Pragma': 'no-cache'
        });

        // Fast, low-latency, real-time 15 fps stream with no buffering and fast bilinear scaling to 960px
        const args = [
            '-nostdin',
            '-threads', '1',
            '-fflags', 'nobuffer',
            '-flags', 'low_delay',
            '-rtsp_transport', 'tcp',
            '-i', rtspUrl,
            '-an',
            '-f', 'mpjpeg',
            '-boundary_tag', 'ffserver',
            '-q:v', '6',
            '-r', '15',
            '-vf', 'scale=960:-2:flags=fast_bilinear',
            'pipe:1'
        ];

        let ffmpegProcess;
        try {
            ffmpegProcess = spawn(ffmpegBin, args);
        } catch (err) {
            this.log('Stream', `Failed to start FFmpeg for camera ${camera.name}: ${err.message}`);
            res.end();
            return;
        }

        ffmpegProcess.stdout.pipe(res);

        ffmpegProcess.stderr.on('data', (data) => {
            const str = data.toString();
            if (str.includes('401 Unauthorized') || str.includes('Invalid data found')) {
                this.log('Stream', `FFmpeg warning for ${camera.name}:`, str.trim());
            }
        });

        ffmpegProcess.on('close', (code) => {
            this.log('Stream', `FFmpeg closed for ${camera.name} with code ${code}`);
            try { res.end(); } catch (e) { }
        });

        ffmpegProcess.on('error', (err) => {
            this.log('Stream', `FFmpeg process error for ${camera.name}: ${err.message}`);
            try { res.end(); } catch (e) { }
        });

        req.on('close', () => {
            this.log('Stream', `Client disconnected from ${camera.name}`);
            try {
                ffmpegProcess.kill('SIGKILL');
            } catch (e) { }
        });
    }

    async scanNetwork() {
        this.log('Discovery', 'Scanning local network for EZVIZ standalone cameras (excluding hub)...');

        const discovered = [];
        const baseIps = [];
        for (let i = 1; i < 255; i++) {
            baseIps.push(`192.168.1.${i}`);
        }

        const checkPort = (ip, port) => {
            return new Promise((resolve) => {
                const s = new net.Socket();
                s.setTimeout(300);
                s.on('connect', () => {
                    s.destroy();
                    resolve(true);
                });
                s.on('timeout', () => {
                    s.destroy();
                    resolve(false);
                });
                s.on('error', () => {
                    resolve(false);
                });
                s.connect(port, ip);
            });
        };

        const checkDevice = async (ip) => {
            // Strictly exclude the EZVIZ Hub
            if (ip === '192.168.1.72') return null;

            // Standalone cameras must have RTSP port 554 open
            const hasRtsp = await checkPort(ip, 554);
            if (hasRtsp) {
                return { ip, hasRtsp };
            }
            return null;
        };

        const chunkSize = 30;
        for (let i = 0; i < baseIps.length; i += chunkSize) {
            const chunk = baseIps.slice(i, i + chunkSize);
            const results = await Promise.all(chunk.map(ip => checkDevice(ip)));
            for (const r of results) {
                if (r) discovered.push(r);
            }
        }

        this.log('Discovery', `Discovered ${discovered.length} standalone camera devices:`, discovered);

        for (const dev of discovered) {
            const existing = await this.db.get('SELECT * FROM cameras WHERE ip = ?', [dev.ip]);
            if (!existing) {
                const count = (await this.db.get('SELECT COUNT(*) as count FROM cameras')).count;
                const name = `EZVIZ Camera ${count + 1}`;
                await this.db.run(
                    `INSERT INTO cameras (name, ip, port, channel, stream_path, username, verification_code, is_hub, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [name, dev.ip, 554, 1, '/h264/ch1/main/av_stream', 'admin', '', 0, 'online']
                );
                this.log('Discovery', `Added discovered camera: ${name} at ${dev.ip}`);
            } else {
                await this.db.run('UPDATE cameras SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?', ['online', existing.id]);
            }
        }

        // Return only non-hub cameras
        const allCameras = await this.db.all('SELECT * FROM cameras WHERE is_hub = 0 ORDER BY id ASC');
        return allCameras;
    }
}

module.exports = CameraService;
