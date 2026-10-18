const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class RecorderService {
    constructor(db, io, cameraService) {
        this.db = db;
        this.io = io;
        this.cameraService = cameraService;
        this.activeRecorders = new Map(); // cameraId -> { process, dir, camera, startedAt }
        this.watchers = new Map(); // cameraId -> watcher/interval
        this.prunerInterval = null;
        this.watchdogInterval = null;
        this.ffmpegBin = this.cameraService ? this.cameraService.ffmpegPath : 'ffmpeg';
        this.storageDir = this.resolveStorageDir();

        this.log('Init', `RecorderService initialized. Storage directory: ${this.storageDir}`);
        this.ensureDir(this.storageDir);

        // Start background tasks
        this.startBackgroundLoops();
    }

    resolveStorageDir() {
        if (process.env.RECORDINGS_DIR && fs.existsSync(process.env.RECORDINGS_DIR)) {
            return process.env.RECORDINGS_DIR;
        }
        if (fs.existsSync('/app/recordings')) {
            return '/app/recordings';
        }
        const localDir = path.join(__dirname, 'recordings');
        this.ensureDir(localDir);
        return localDir;
    }

    ensureDir(dir) {
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (e) {
                console.error(`Failed to create directory ${dir}:`, e.message);
            }
        }
    }

    log(source, message, details = null) {
        const entry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            source: `Recorder:${source}`,
            message,
            details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null
        };
        if (this.cameraService) {
            this.cameraService.debugLogs.unshift(entry);
            if (this.cameraService.debugLogs.length > 200) {
                this.cameraService.debugLogs.pop();
            }
        }
        if (this.io) {
            this.io.emit('recorder_log', entry);
        }
        console.log(`[RecorderService][${source}] ${message}`);
    }

    async getSettings() {
        let settings = await this.db.get('SELECT * FROM recording_settings WHERE id = 1');
        if (!settings) {
            settings = {
                id: 1,
                storage_path: this.storageDir,
                max_storage_gb: 200.0,
                continuous_buffer_minutes: 60,
                retention_mode: 'keep_motion',
                detect_motion: 1,
                detect_human: 1,
                detect_animal: 1,
                auto_record: 1
            };
        }
        return settings;
    }

    async updateSettings(newSettings) {
        await this.db.run(`
            UPDATE recording_settings SET
              max_storage_gb = COALESCE(?, max_storage_gb),
              continuous_buffer_minutes = COALESCE(?, continuous_buffer_minutes),
              retention_mode = COALESCE(?, retention_mode),
              detect_motion = COALESCE(?, detect_motion),
              detect_human = COALESCE(?, detect_human),
              detect_animal = COALESCE(?, detect_animal),
              auto_record = COALESCE(?, auto_record)
            WHERE id = 1
        `, [
            newSettings.max_storage_gb,
            newSettings.continuous_buffer_minutes,
            newSettings.retention_mode,
            newSettings.detect_motion,
            newSettings.detect_human,
            newSettings.detect_animal,
            newSettings.auto_record
        ]);

        const updated = await this.getSettings();
        this.log('Settings', `Updated recording settings: Max ${updated.max_storage_gb}GB, Buffer ${updated.continuous_buffer_minutes}m, Mode: ${updated.retention_mode}`);

        if (updated.auto_record) {
            this.syncRecorders();
        } else {
            this.stopAllRecorders();
        }

        // Trigger an immediate hard cap enforcement and pruner check
        await this.enforceHardDiskCap();
        await this.runPruner();
        return updated;
    }

    startBackgroundLoops() {
        // Initial recorder sync
        setTimeout(() => this.syncRecorders(), 3000);

        // Watchdog to ensure continuous recording stays running 24/7
        this.watchdogInterval = setInterval(() => {
            this.syncRecorders();
        }, 30000);

        // Retention checker runs every 30 seconds
        this.prunerInterval = setInterval(() => {
            this.runPruner();
        }, 30000);

        // Absolute Hard Disk Cap checker runs every 10 seconds
        this.hardCapInterval = setInterval(() => {
            this.enforceHardDiskCap();
        }, 10000);

        setTimeout(() => this.runPruner(), 3000);
    }

    async syncRecorders() {
        const settings = await this.getSettings();
        if (!settings.auto_record) return;

        try {
            // Find valid cameras that have IP and verification code (strictly exclude hub)
            const cameras = await this.db.all(`
                SELECT * FROM cameras 
                WHERE is_hub = 0 
                  AND ip IS NOT NULL 
                  AND ip != '' 
                  AND verification_code IS NOT NULL 
                  AND verification_code != ''
            `);

            for (const camera of cameras) {
                if (!this.activeRecorders.has(camera.id)) {
                    this.startCameraRecorder(camera);
                }
            }

            // Stop recorders for cameras that were deleted or had IP/code removed
            for (const [camId, rec] of this.activeRecorders.entries()) {
                const stillExists = cameras.find(c => c.id === camId);
                if (!stillExists) {
                    this.stopCameraRecorder(camId);
                }
            }
        } catch (err) {
            this.log('Watchdog', `Error syncing recorders: ${err.message}`);
        }
    }

    startCameraRecorder(camera) {
        if (this.activeRecorders.has(camera.id)) return;

        const rtspUrl = this.cameraService.buildRtspUrl(camera);
        const camDir = path.join(this.storageDir, `camera_${camera.id}`);
        this.ensureDir(camDir);

        this.log('Start', `Starting continuous 24/7 recording for ${camera.name} (${camera.ip})`);

        // Segment format: cam_<id>_%Y%m%d_%H%M%S.mp4 (2-minute segments)
        const segmentPattern = path.join(camDir, `cam_${camera.id}_%Y%m%d_%H%M%S.mp4`);

        // Arguments for zero-CPU stream copy and native AAC audio
        const args = [
            '-nostdin',
            '-loglevel', 'warning',
            '-rtsp_transport', 'tcp',
            '-i', rtspUrl,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-f', 'segment',
            '-segment_time', '120', // 120 seconds (2 minutes)
            '-segment_format', 'mp4',
            '-reset_timestamps', '1',
            '-strftime', '1',
            segmentPattern
        ];

        let proc;
        try {
            proc = spawn(this.ffmpegBin, args);
        } catch (err) {
            this.log('Start', `Failed to spawn FFmpeg recorder for ${camera.name}: ${err.message}`);
            return;
        }

        const recorderState = {
            process: proc,
            camera,
            dir: camDir,
            startedAt: Date.now(),
            knownFiles: new Set()
        };

        // Populate existing files so we don't index old ones as newly finished
        try {
            const existing = fs.readdirSync(camDir).filter(f => f.endsWith('.mp4'));
            existing.forEach(f => recorderState.knownFiles.add(f));
        } catch (e) { }

        this.activeRecorders.set(camera.id, recorderState);

        proc.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg.includes('error') || msg.includes('401') || msg.includes('Connection refused')) {
                this.log('FFmpeg', `Warning on ${camera.name}: ${msg.slice(0, 150)}`);
            }
        });

        proc.on('close', (code) => {
            this.log('Process', `Recorder process for ${camera.name} exited with code ${code}`);
            this.activeRecorders.delete(camera.id);
            if (this.watchers.has(camera.id)) {
                clearInterval(this.watchers.get(camera.id));
                this.watchers.delete(camera.id);
            }
        });

        proc.on('error', (err) => {
            this.log('Process', `Recorder error for ${camera.name}: ${err.message}`);
            this.activeRecorders.delete(camera.id);
        });

        // Set up directory watcher to index completed MP4 segments
        const pollInterval = setInterval(() => {
            this.checkCompletedSegments(camera.id);
        }, 10000);
        this.watchers.set(camera.id, pollInterval);
    }

    stopCameraRecorder(cameraId) {
        if (!this.activeRecorders.has(cameraId)) return;
        const rec = this.activeRecorders.get(cameraId);
        this.log('Stop', `Stopping recorder for camera ID ${cameraId}`);
        try {
            rec.process.kill('SIGINT');
            setTimeout(() => {
                try { rec.process.kill('SIGKILL'); } catch (e) { }
            }, 3000);
        } catch (e) { }
        this.activeRecorders.delete(cameraId);
        if (this.watchers.has(cameraId)) {
            clearInterval(this.watchers.get(cameraId));
            this.watchers.delete(cameraId);
        }
    }

    stopAllRecorders() {
        for (const camId of Array.from(this.activeRecorders.keys())) {
            this.stopCameraRecorder(camId);
        }
    }

    async checkCompletedSegments(cameraId) {
        const state = this.activeRecorders.get(cameraId);
        if (!state) return;

        try {
            const camDir = state.dir;
            const files = fs.readdirSync(camDir).filter(f => f.endsWith('.mp4')).sort();

            // All files except the latest one currently being written are completed
            if (files.length <= 1) return;

            const completed = files.slice(0, files.length - 1);

            for (const filename of completed) {
                const fullPath = path.join(camDir, filename);

                // Check if already registered in database
                const existing = await this.db.get('SELECT id FROM recordings WHERE filepath = ?', [fullPath]);
                if (existing) continue;

                // Index this completed segment
                await this.indexSegment(state.camera, fullPath, filename);
            }
        } catch (err) {
            this.log('Indexer', `Error checking completed segments for camera ${cameraId}: ${err.message}`);
        }
    }

    parseFilenameTimestamp(filename) {
        // e.g. cam_1_20261018_170530.mp4
        const match = filename.match(/cam_\d+_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.mp4/);
        if (match) {
            const [_, y, m, d, hh, mm, ss] = match;
            const date = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
            return date;
        }
        return new Date();
    }

    async indexSegment(camera, filePath, filename) {
        try {
            const stats = fs.statSync(filePath);
            if (stats.size < 50000) {
                // Ignore empty or corrupt tiny files (< 50KB)
                return;
            }

            const startTime = this.parseFilenameTimestamp(filename);
            const durationEstimate = 120; // 2 minutes per segment
            const endTime = new Date(startTime.getTime() + durationEstimate * 1000);

            // Generate thumbnail
            const thumbFilename = filename.replace('.mp4', '_thumb.jpg');
            const thumbPath = path.join(path.dirname(filePath), thumbFilename);

            await this.generateThumbnail(filePath, thumbPath);

            // Analyze motion / events
            const motionResult = await this.analyzeMotion(filePath);

            const result = await this.db.run(`
                INSERT INTO recordings (
                    camera_id, filename, filepath, thumbnail_path, 
                    start_time, end_time, duration_seconds, file_size_bytes, 
                    has_motion, motion_type, detected_persons, keep_permanent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                camera.id,
                filename,
                filePath,
                thumbPath,
                startTime.toISOString(),
                endTime.toISOString(),
                durationEstimate,
                stats.size,
                motionResult.hasMotion ? 1 : 0,
                motionResult.motionType,
                JSON.stringify(motionResult.detectedPersons || []),
                0
            ]);

            const newRecord = await this.db.get('SELECT * FROM recordings WHERE id = ?', [result.lastID]);
            this.log('Indexer', `Indexed segment ${filename} (${(stats.size / (1024 * 1024)).toFixed(1)}MB, motion: ${motionResult.motionType})`);

            if (this.io) {
                this.io.emit('new_recording', newRecord);
            }
        } catch (err) {
            this.log('Indexer', `Failed to index segment ${filename}: ${err.message}`);
        }
    }

    async generateThumbnail(videoPath, thumbPath) {
        return new Promise((resolve) => {
            const args = [
                '-y',
                '-ss', '00:00:15',
                '-i', videoPath,
                '-vframes', '1',
                '-q:v', '3',
                '-vf', 'scale=min(640\\,iw):-2',
                thumbPath
            ];

            const proc = spawn(this.ffmpegBin, args);
            proc.on('close', (code) => {
                if (code === 0 && fs.existsSync(thumbPath)) {
                    resolve(true);
                } else {
                    // Fallback to frame 0
                    const fallbackArgs = ['-y', '-i', videoPath, '-vframes', '1', '-q:v', '3', thumbPath];
                    const proc2 = spawn(this.ffmpegBin, fallbackArgs);
                    proc2.on('close', () => resolve(fs.existsSync(thumbPath)));
                }
            });
            proc.on('error', () => resolve(false));
        });
    }

    async analyzeMotion(videoPath) {
        // Fast motion activity detection using FFmpeg scene change filter
        return new Promise((resolve) => {
            const args = [
                '-i', videoPath,
                '-vf', "select='gt(scene,0.025)',metadata=print:file=-",
                '-f', 'null',
                '-'
            ];

            const proc = spawn(this.ffmpegBin, args);
            let output = '';
            proc.stdout.on('data', (d) => { output += d.toString(); });
            proc.stderr.on('data', (d) => { output += d.toString(); });

            proc.on('close', () => {
                // Count scene change detections in metadata
                const matches = output.match(/lavfi\.scene_score=([\d.]+)/g) || [];
                const hasMotion = matches.length >= 2;

                let motionType = 'none';
                let detectedPersons = [];

                if (hasMotion) {
                    // If high scene activity is detected, evaluate human/animal heuristic tags
                    const highActivity = matches.some(m => {
                        const val = parseFloat(m.split('=')[1]);
                        return val > 0.08;
                    });

                    if (highActivity && matches.length >= 5) {
                        motionType = 'human';
                    } else if (matches.length >= 3) {
                        motionType = 'animal';
                    } else {
                        motionType = 'motion';
                    }
                }

                resolve({
                    hasMotion,
                    motionType,
                    detectedPersons
                });
            });

            proc.on('error', () => {
                resolve({ hasMotion: false, motionType: 'none', detectedPersons: [] });
            });
        });
    }

    async runPruner() {
        try {
            const settings = await this.getSettings();
            const now = Date.now();
            const bufferMs = (settings.continuous_buffer_minutes || 60) * 60 * 1000;
            const cutoffTime = new Date(now - bufferMs).toISOString();

            this.log('Pruner', `Checking retention. Continuous Buffer: ${settings.continuous_buffer_minutes}m (Cutoff: ${cutoffTime}), Mode: ${settings.retention_mode}`);

            // 1. Continuous Buffer Retention Policy
            let oldSegments = [];
            if (settings.retention_mode === 'keep_motion') {
                // Prune only segments that do NOT have motion and are NOT marked keep_permanent
                oldSegments = await this.db.all(`
                    SELECT * FROM recordings 
                    WHERE end_time < ? 
                      AND has_motion = 0 
                      AND keep_permanent = 0
                    ORDER BY start_time ASC
                `, [cutoffTime]);
            } else {
                // 'delete_all' mode: prune all segments older than buffer, keeping only locked ones
                oldSegments = await this.db.all(`
                    SELECT * FROM recordings 
                    WHERE end_time < ? 
                      AND keep_permanent = 0
                    ORDER BY start_time ASC
                `, [cutoffTime]);
            }

            for (const seg of oldSegments) {
                this.deleteRecordingFiles(seg);
                await this.db.run('DELETE FROM recordings WHERE id = ?', [seg.id]);
            }

            if (oldSegments.length > 0) {
                this.log('Pruner', `Pruned ${oldSegments.length} segments past rolling buffer`);
            }

            // 2. Enforce Absolute Hard Storage Cap (Strict FIFO Oldest-to-Newest)
            await this.enforceHardDiskCap();
        } catch (err) {
            this.log('Pruner', `Error in retention pruner: ${err.message}`);
        }
    }

    // Measure exact physical byte size of all files on disk in storageDir
    getActualDiskUsage(dir = this.storageDir) {
        let total = 0;
        try {
            if (!fs.existsSync(dir)) return 0;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    total += this.getActualDiskUsage(fullPath);
                } else if (entry.isFile()) {
                    try {
                        total += fs.statSync(fullPath).size;
                    } catch (e) { }
                }
            }
        } catch (e) { }
        return total;
    }

    // Absolute hard disk cap: if even 1 byte over limit, immediately delete from oldest to newest
    async enforceHardDiskCap() {
        try {
            const settings = await this.getSettings();
            const maxAllowedBytes = (parseFloat(settings.max_storage_gb) || 200.0) * 1024 * 1024 * 1024;
            let actualBytes = this.getActualDiskUsage();

            if (actualBytes > maxAllowedBytes) {
                const overBytes = actualBytes - maxAllowedBytes;
                this.log('HardCap', `Storage is ${(overBytes / (1024 * 1024)).toFixed(2)} MB over hard cap (${actualBytes} > ${maxAllowedBytes}). Deleting from oldest to newest...`);

                // 1. Delete from database records strictly from oldest to newest
                const oldestRecordings = await this.db.all('SELECT * FROM recordings ORDER BY start_time ASC');

                for (const rec of oldestRecordings) {
                    if (actualBytes <= maxAllowedBytes) break;

                    this.deleteRecordingFiles(rec);
                    await this.db.run('DELETE FROM recordings WHERE id = ?', [rec.id]);
                    actualBytes = this.getActualDiskUsage();
                    this.log('HardCap', `Evicted oldest recording ${rec.filename}. Current usage: ${(actualBytes / (1024 * 1024 * 1024)).toFixed(3)} GB`);
                }

                // 2. If still over limit (e.g. unindexed or orphaned files), delete oldest files directly on disk
                if (actualBytes > maxAllowedBytes) {
                    this.deleteOldestDiskFiles(maxAllowedBytes);
                }
            }
        } catch (err) {
            this.log('HardCap', `Error enforcing hard disk cap: ${err.message}`);
        }
    }

    deleteOldestDiskFiles(maxAllowedBytes) {
        try {
            const allFiles = [];
            const collectFiles = (dir) => {
                if (!fs.existsSync(dir)) return;
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        collectFiles(full);
                    } else if (entry.isFile()) {
                        try {
                            const stat = fs.statSync(full);
                            allFiles.push({ path: full, size: stat.size, mtime: stat.mtimeMs });
                        } catch (e) { }
                    }
                }
            };

            collectFiles(this.storageDir);
            allFiles.sort((a, b) => a.mtime - b.mtime); // Oldest modified first

            let currentBytes = this.getActualDiskUsage();
            for (const file of allFiles) {
                if (currentBytes <= maxAllowedBytes) break;
                try {
                    fs.unlinkSync(file.path);
                    currentBytes -= file.size;
                    this.log('HardCap', `Unlinked orphaned file ${path.basename(file.path)} (${(file.size / 1024).toFixed(0)} KB)`);
                } catch (e) { }
            }
        } catch (e) { }
    }

    deleteRecordingFiles(recording) {
        try {
            if (fs.existsSync(recording.filepath)) {
                fs.unlinkSync(recording.filepath);
            }
            if (recording.thumbnail_path && fs.existsSync(recording.thumbnail_path)) {
                fs.unlinkSync(recording.thumbnail_path);
            }
        } catch (e) { }
    }

    async calculateTotalStorageBytes() {
        return this.getActualDiskUsage();
    }

    async getStorageStatus() {
        const settings = await this.getSettings();
        const totalUsedBytes = await this.calculateTotalStorageBytes();
        const maxStorageBytes = (settings.max_storage_gb || 200.0) * 1024 * 1024 * 1024;
        const usedPercentage = Math.min(100, (totalUsedBytes / maxStorageBytes) * 100);

        const activeCamerasCount = this.activeRecorders.size;

        // Calculate average bitrate from recent recordings (or fallback ~900 MB/hr)
        const recent = await this.db.all('SELECT file_size_bytes, duration_seconds FROM recordings ORDER BY id DESC LIMIT 20');
        let avgBytesPerSecond = 250000; // default 250 KB/s (~2 Mbps)
        if (recent.length > 0) {
            const totalSec = recent.reduce((acc, r) => acc + (r.duration_seconds || 120), 0);
            const totalBytes = recent.reduce((acc, r) => acc + (r.file_size_bytes || 0), 0);
            if (totalSec > 0 && totalBytes > 0) {
                avgBytesPerSecond = totalBytes / totalSec;
            }
        }

        const avgBytesPerHourPerCamera = avgBytesPerSecond * 3600;
        const totalPerHourAllCameras = Math.max(1, activeCamerasCount) * avgBytesPerHourPerCamera;

        // Continuous recording capacity estimation
        const estimatedContinuousHours = totalPerHourAllCameras > 0
            ? (maxStorageBytes / totalPerHourAllCameras)
            : 0;
        const estimatedContinuousDays = (estimatedContinuousHours / 24).toFixed(1);

        const totalRecordings = (await this.db.get('SELECT COUNT(*) as c FROM recordings')).c;
        const motionRecordings = (await this.db.get('SELECT COUNT(*) as c FROM recordings WHERE has_motion = 1')).c;

        return {
            storagePath: this.storageDir,
            totalUsedBytes,
            totalUsedGb: +(totalUsedBytes / (1024 * 1024 * 1024)).toFixed(2),
            maxStorageGb: settings.max_storage_gb,
            usedPercentage: +usedPercentage.toFixed(1),
            continuousBufferMinutes: settings.continuous_buffer_minutes,
            retentionMode: settings.retention_mode,
            detectMotion: !!settings.detect_motion,
            detectHuman: !!settings.detect_human,
            detectAnimal: !!settings.detect_animal,
            autoRecord: !!settings.auto_record,
            activeCamerasCount,
            estimatedContinuousHours: +estimatedContinuousHours.toFixed(1),
            estimatedContinuousDays: +estimatedContinuousDays,
            totalRecordings,
            motionRecordings,
            isRecordingActive: activeCamerasCount > 0
        };
    }
}

module.exports = RecorderService;
