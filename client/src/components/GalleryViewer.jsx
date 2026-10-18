import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Film,
  Play,
  Pause,
  RefreshCw,
  HardDrive,
  Trash2,
  Download,
  Lock,
  Unlock,
  Tag,
  User,
  PawPrint,
  Activity,
  Layers,
  Calendar,
  Clock,
  Volume2,
  VolumeX,
  X,
  Check,
  Search,
  AlertCircle,
  Info,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Radio,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { recordingsApi, storageApi, cameraApi } from '../api';

const GalleryViewer = () => {
  const [recordings, setRecordings] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [persons, setPersons] = useState([]);
  const [storageStatus, setStorageStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // View Mode: 'timeline' (default continuous timeline player) or 'grid' (segment cards)
  const [viewMode, setViewMode] = useState('timeline');

  // Filters
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMotionType, setSelectedMotionType] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [selectedPerson, setSelectedPerson] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Continuous Timeline Player State
  const [currentRecording, setCurrentRecording] = useState(null);
  const [currentPlayheadMs, setCurrentPlayheadMs] = useState(Date.now());
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState('24h'); // '24h', '12h', '6h', '2h', '30m'
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  const videoRef = useRef(null);
  const timelineBarRef = useRef(null);
  const pendingSeekRef = useRef(null);

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [storageSettings, setStorageSettings] = useState({
    max_storage_gb: 200,
    continuous_buffer_minutes: 60,
    retention_mode: 'keep_motion',
    detect_motion: 1,
    detect_human: 1,
    detect_animal: 1,
    auto_record: 1
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Tagging Modal
  const [taggingRecording, setTaggingRecording] = useState(null);
  const [newPersonName, setNewPersonName] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadRecordings, 15000);
    return () => clearInterval(interval);
  }, [selectedCamera, selectedMotionType, selectedDate, selectedPerson, searchKeyword]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadCameras(),
      loadRecordings(),
      loadStorageStatus(),
      loadPersons()
    ]);
    setLoading(false);
  };

  const loadCameras = async () => {
    try {
      const data = await cameraApi.getCameras();
      const clean = (data || []).filter(c => !c.is_hub && c.ip !== '192.168.1.72' && !c.name.toLowerCase().includes('hub'));
      setCameras(clean);
      if (clean.length > 0 && !selectedCamera) {
        setSelectedCamera(String(clean[0].id));
      }
    } catch (e) {
      console.error('Failed to load cameras:', e);
    }
  };

  const loadRecordings = async () => {
    try {
      const params = { limit: 1000, order: 'asc' };
      if (selectedCamera) params.camera_id = selectedCamera;
      if (selectedMotionType !== 'all') {
        if (selectedMotionType === 'motion_any') {
          params.has_motion = 1;
        } else {
          params.motion_type = selectedMotionType;
        }
      }
      if (selectedDate) {
        params.from_time = `${selectedDate}T00:00:00.000Z`;
        params.to_time = `${selectedDate}T23:59:59.999Z`;
      }
      if (selectedPerson) {
        params.search = selectedPerson;
      } else if (searchKeyword) {
        params.search = searchKeyword;
      }

      const list = await recordingsApi.getRecordings(params);
      const cleanList = list || [];
      setRecordings(cleanList);

      // If no recording is currently loaded, initialize with the latest recording
      if (!currentRecording && cleanList.length > 0) {
        const latest = cleanList[cleanList.length - 1];
        setCurrentRecording(latest);
        const startMs = new Date(latest.start_time).getTime();
        setCurrentPlayheadMs(startMs);
      }
    } catch (e) {
      console.error('Failed to load recordings:', e);
    }
  };

  const loadStorageStatus = async () => {
    try {
      const status = await storageApi.getStatus();
      setStorageStatus(status);
      if (status) {
        setStorageSettings({
          max_storage_gb: status.maxStorageGb,
          continuous_buffer_minutes: status.continuousBufferMinutes,
          retention_mode: status.retentionMode,
          detect_motion: status.detectMotion ? 1 : 0,
          detect_human: status.detectHuman ? 1 : 0,
          detect_animal: status.detectAnimal ? 1 : 0,
          auto_record: status.autoRecord ? 1 : 0
        });
      }
    } catch (e) {
      console.error('Failed to load storage status:', e);
    }
  };

  const loadPersons = async () => {
    try {
      const p = await recordingsApi.getPersons();
      setPersons(p || []);
    } catch (e) { }
  };

  // Timeline Window Calculation based on selectedDate and zoomLevel
  const { windowStart, windowEnd, windowDuration } = useMemo(() => {
    const dStr = selectedDate || new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${dStr}T00:00:00`).getTime();
    const dayEnd = new Date(`${dStr}T23:59:59.999`).getTime();

    if (timelineZoom === '24h') {
      return { windowStart: dayStart, windowEnd: dayEnd, windowDuration: dayEnd - dayStart };
    }

    let zoomMs = 24 * 3600 * 1000;
    if (timelineZoom === '12h') zoomMs = 12 * 3600 * 1000;
    else if (timelineZoom === '6h') zoomMs = 6 * 3600 * 1000;
    else if (timelineZoom === '2h') zoomMs = 2 * 3600 * 1000;
    else if (timelineZoom === '30m') zoomMs = 30 * 60 * 1000;

    const center = Math.max(dayStart, Math.min(dayEnd, currentPlayheadMs || dayStart));
    let wStart = center - zoomMs / 2;
    let wEnd = center + zoomMs / 2;

    if (wStart < dayStart) {
      wStart = dayStart;
      wEnd = Math.min(dayEnd, dayStart + zoomMs);
    } else if (wEnd > dayEnd) {
      wEnd = dayEnd;
      wStart = Math.max(dayStart, dayEnd - zoomMs);
    }

    return { windowStart: wStart, windowEnd: wEnd, windowDuration: Math.max(1000, wEnd - wStart) };
  }, [selectedDate, timelineZoom, currentPlayheadMs]);

  // Seek continuous timeline to a specific absolute timestamp in ms
  const seekToTimestamp = (targetMs, startPlaying = true) => {
    setCurrentPlayheadMs(targetMs);

    // Find the recording segment covering targetMs
    let matching = recordings.find(r => {
      if (selectedCamera && r.camera_id !== parseInt(selectedCamera)) return false;
      const s = new Date(r.start_time).getTime();
      const dur = (r.duration_seconds || 7200) * 1000;
      const e = new Date(r.end_time || (s + dur)).getTime();
      return targetMs >= s && targetMs <= e;
    });

    if (!matching && recordings.length > 0) {
      // Find closest recording segment
      const pool = selectedCamera ? recordings.filter(r => r.camera_id === parseInt(selectedCamera)) : recordings;
      if (pool.length > 0) {
        matching = pool.reduce((prev, curr) => {
          const prevDiff = Math.abs(new Date(prev.start_time).getTime() - targetMs);
          const currDiff = Math.abs(new Date(curr.start_time).getTime() - targetMs);
          return currDiff < prevDiff ? curr : prev;
        });
      }
    }

    if (matching) {
      const segStart = new Date(matching.start_time).getTime();
      const offsetSeconds = Math.max(0, (targetMs - segStart) / 1000);

      if (currentRecording?.id === matching.id && videoRef.current) {
        videoRef.current.currentTime = offsetSeconds;
        if (startPlaying) {
          videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setAudioBlocked(true));
        }
      } else {
        setCurrentRecording(matching);
        pendingSeekRef.current = offsetSeconds;
        if (startPlaying) setIsPlaying(true);
      }
    }
  };

  // Timeline scrubber interaction handlers
  const handleTimelineScrub = (e) => {
    if (!timelineBarRef.current) return;
    const rect = timelineBarRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = clickX / rect.width;
    const targetMs = windowStart + pct * windowDuration;
    seekToTimestamp(targetMs, isPlaying);
  };

  // Jump by relative seconds (+/- 15 min, +/- 1 hour)
  const handleJumpTime = (deltaSeconds) => {
    const targetMs = (currentPlayheadMs || Date.now()) + deltaSeconds * 1000;
    seekToTimestamp(targetMs, true);
  };

  // Jump to Next / Previous detected event
  const handleJumpEvent = (direction) => {
    const events = recordings
      .filter(r => r.has_motion && (!selectedCamera || r.camera_id === parseInt(selectedCamera)))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    if (events.length === 0) return;

    if (direction === 'next') {
      const next = events.find(e => new Date(e.start_time).getTime() > (currentPlayheadMs + 2000));
      if (next) seekToTimestamp(new Date(next.start_time).getTime(), true);
    } else {
      const prev = [...events].reverse().find(e => new Date(e.start_time).getTime() < (currentPlayheadMs - 2000));
      if (prev) seekToTimestamp(new Date(prev.start_time).getTime(), true);
    }
  };

  // Jump to latest available recording
  const handleJumpToLatest = () => {
    const pool = selectedCamera ? recordings.filter(r => r.camera_id === parseInt(selectedCamera)) : recordings;
    if (pool.length > 0) {
      const latest = pool[pool.length - 1];
      const startMs = new Date(latest.start_time).getTime();
      const endMs = new Date(latest.end_time || (startMs + (latest.duration_seconds || 7200) * 1000)).getTime();
      seekToTimestamp(endMs - 10000, true);
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setAudioBlocked(false);
      }).catch(() => {
        setAudioBlocked(true);
      });
    }
  };

  const handleToggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted) {
        videoRef.current.volume = volume || 0.8;
      }
    }
    setAudioBlocked(false);
  };

  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      if (newVol > 0 && isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const handleToggleLock = async (rec, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await recordingsApi.toggleLock(rec.id);
      setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, keep_permanent: res.keep_permanent } : r));
      if (currentRecording && currentRecording.id === rec.id) {
        setCurrentRecording(prev => ({ ...prev, keep_permanent: res.keep_permanent }));
      }
    } catch (err) {
      alert('Error updating lock: ' + err.message);
    }
  };

  const handleDeleteRecording = async (rec, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this recording permanently?')) return;
    try {
      await recordingsApi.deleteRecording(rec.id);
      setRecordings(prev => prev.filter(r => r.id !== rec.id));
      if (currentRecording && currentRecording.id === rec.id) {
        setCurrentRecording(null);
      }
      loadStorageStatus();
    } catch (err) {
      alert('Error deleting recording: ' + err.message);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await storageApi.updateSettings(storageSettings);
      await loadStorageStatus();
      setShowSettingsModal(false);
      loadRecordings();
    } catch (e) {
      alert('Failed to save settings: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddPersonTag = async () => {
    if (!taggingRecording || !newPersonName.trim()) return;
    try {
      const res = await recordingsApi.tagRecording(taggingRecording.id, {
        person: newPersonName.trim()
      });
      await recordingsApi.addPerson({ name: newPersonName.trim() });
      await loadPersons();
      setRecordings(prev => prev.map(r => r.id === taggingRecording.id ? { ...r, detected_persons: JSON.stringify(res.detected_persons), has_motion: 1 } : r));
      if (currentRecording && currentRecording.id === taggingRecording.id) {
        setCurrentRecording(prev => ({ ...prev, detected_persons: JSON.stringify(res.detected_persons), has_motion: 1 }));
      }
      setTaggingRecording(null);
      setNewPersonName('');
    } catch (e) {
      alert('Failed to tag person: ' + e.message);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatTimeOnly = (ms) => {
    if (!ms) return '00:00:00';
    const d = new Date(ms);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const calculateDynamicEstimate = (maxGb, activeCams = 3) => {
    const gb = parseFloat(maxGb) || 200;
    const cams = Math.max(1, activeCams || 1);
    const hours = gb / (cams * 0.9);
    const days = hours / 24;
    return {
      hours: hours.toFixed(1),
      days: days.toFixed(1)
    };
  };

  const dynamicEst = calculateDynamicEstimate(
    storageSettings.max_storage_gb,
    storageStatus?.activeCamerasCount || cameras.length || 3
  );

  // Playhead percentage along the current timeline window
  const playheadPct = useMemo(() => {
    if (!currentPlayheadMs || windowDuration <= 0) return 0;
    const pct = ((currentPlayheadMs - windowStart) / windowDuration) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [currentPlayheadMs, windowStart, windowDuration]);

  // Detected events for the selected date & camera
  const timelineEvents = useMemo(() => {
    return recordings.filter(r => r.has_motion && (!selectedCamera || r.camera_id === parseInt(selectedCamera)));
  }, [recordings, selectedCamera]);

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto pb-24">
      {/* Top Header & Tool Bar - Pure Symbols Over Text */}
      <div className="flex flex-wrap items-center justify-between gap-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30 text-white">
            <Film size={34} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-wide">
              Continuous Surveillance & Timeline
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <p className="text-slate-400 text-lg font-medium font-mono">
                {storageStatus?.isRecordingActive
                  ? `${storageStatus.activeCamerasCount} Cameras 24/7 (2-Hour Segments & Synchronous Audio)`
                  : 'Recorder Engine Ready'}
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Global Actions (Strict Symbols Over Text) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode(viewMode === 'timeline' ? 'grid' : 'timeline')}
            className={`p-3.5 rounded-2xl border transition-all active:scale-95 ${
              viewMode === 'timeline'
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-300 hover:text-white border-white/10'
            }`}
            title={viewMode === 'timeline' ? 'Switch to Segment Cards View' : 'Switch to Continuous Timeline View'}
          >
            {viewMode === 'timeline' ? <Clock size={28} /> : <Layers size={28} />}
          </button>

          <button
            onClick={loadRecordings}
            className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
            title="Refresh Recordings"
          >
            <RefreshCw size={28} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-3.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-2xl border border-white/10 shadow-lg transition-all active:scale-95"
            title="Storage Cap & Continuous Buffer Settings"
          >
            <Sliders size={28} />
          </button>
        </div>
      </div>

      {/* Camera Selection Bar & Date Navigator */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 border border-white/10 p-5 rounded-3xl">
        {/* Camera Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedCamera('')}
            className={`px-5 py-3 rounded-2xl font-bold text-lg border transition-all active:scale-95 ${
              selectedCamera === ''
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-300 hover:text-white border-white/10'
            }`}
          >
            All Cameras
          </button>
          {cameras.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCamera(String(c.id))}
              className={`px-5 py-3 rounded-2xl font-bold text-lg border transition-all active:scale-95 ${
                selectedCamera === String(c.id)
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white border-white/10'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Date Selector & Step Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const cur = new Date(selectedDate || Date.now());
              cur.setDate(cur.getDate() - 1);
              setSelectedDate(cur.toISOString().slice(0, 10));
            }}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
            title="Previous Day"
          >
            <ChevronLeft size={24} />
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-800 text-white text-lg font-bold border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-indigo-500 cursor-pointer"
            title="Select Timeline Date"
          />

          <button
            onClick={() => {
              const cur = new Date(selectedDate || Date.now());
              cur.setDate(cur.getDate() + 1);
              setSelectedDate(cur.toISOString().slice(0, 10));
            }}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
            title="Next Day"
          >
            <ChevronRight size={24} />
          </button>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 text-base font-bold transition-all"
            title="Jump to Today"
          >
            Today
          </button>
        </div>
      </div>

      {/* CONTINUOUS TIMELINE PLAYER VIEW (PRIMARY MODE) */}
      {viewMode === 'timeline' && (
        <div className="flex flex-col gap-6 bg-slate-950 border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl">
          {/* Main Video Player Container */}
          <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
            {currentRecording ? (
              <video
                ref={videoRef}
                key={currentRecording.id}
                src={recordingsApi.getVideoUrl(currentRecording.id)}
                autoPlay={isPlaying}
                muted={isMuted}
                playsInline
                className="w-full h-full object-contain"
                onLoadedMetadata={() => {
                  if (pendingSeekRef.current !== null && videoRef.current) {
                    videoRef.current.currentTime = pendingSeekRef.current;
                    pendingSeekRef.current = null;
                  }
                  if (videoRef.current) {
                    videoRef.current.volume = volume;
                    if (isPlaying) {
                      videoRef.current.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
                    }
                  }
                }}
                onTimeUpdate={() => {
                  if (videoRef.current && currentRecording) {
                    const segStart = new Date(currentRecording.start_time).getTime();
                    const newPlayheadMs = segStart + videoRef.current.currentTime * 1000;
                    setCurrentPlayheadMs(newPlayheadMs);
                  }
                }}
                onEnded={() => {
                  // Seamless transition to next 2-hour segment
                  const curStart = new Date(currentRecording.start_time).getTime();
                  const pool = selectedCamera ? recordings.filter(r => r.camera_id === parseInt(selectedCamera)) : recordings;
                  const nextRec = pool
                    .filter(r => new Date(r.start_time).getTime() > curStart)
                    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];

                  if (nextRec) {
                    setCurrentRecording(nextRec);
                    pendingSeekRef.current = 0;
                    setIsPlaying(true);
                  } else {
                    setIsPlaying(false);
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8">
                <Clock size={64} className="text-slate-600 mb-4 animate-pulse" />
                <h3 className="text-2xl font-bold text-white mb-2">No Recorded Footage Available for this Date</h3>
                <p className="text-slate-400 text-lg max-w-md">
                  Select another date or camera to explore recorded continuous segments.
                </p>
              </div>
            )}

            {/* In-Video HUD: Camera Name & Time Display */}
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3 z-10">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-white font-bold text-xl">
                {currentRecording?.camera_name || (selectedCamera ? `Camera ${selectedCamera}` : 'Live Timeline')}
              </span>
              <span className="text-indigo-400 font-mono font-bold text-xl">
                {formatTimeOnly(currentPlayheadMs)}
              </span>
            </div>

            {/* Audio Blocked Overlay (Unmute Click Prompt) */}
            {audioBlocked && (
              <button
                onClick={handleToggleSound}
                className="absolute inset-0 m-auto w-fit h-fit z-30 px-6 py-4 bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-xl rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-lg animate-bounce cursor-pointer"
                title="Click to Enable Audio Playback"
              >
                <Volume2 size={32} />
                Click to Unmute Audio
              </button>
            )}

            {/* Action Symbols (Top Right of Player) */}
            {currentRecording && (
              <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                <button
                  onClick={(e) => handleToggleLock(currentRecording, e)}
                  className={`p-3 rounded-2xl border transition-all active:scale-95 ${
                    currentRecording.keep_permanent
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-black/60 text-slate-300 hover:text-white border-white/10'
                  }`}
                  title={currentRecording.keep_permanent ? 'Protected (Click to Unlock)' : 'Lock Segment from Auto-Deletion'}
                >
                  {currentRecording.keep_permanent ? <Lock size={22} /> : <Unlock size={22} />}
                </button>

                <button
                  onClick={() => setTaggingRecording(currentRecording)}
                  className="p-3 bg-black/60 hover:bg-slate-800 text-indigo-400 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Tag Identified Person (Pedro, Family, Visitor)"
                >
                  <Tag size={22} />
                </button>

                <a
                  href={recordingsApi.getVideoUrl(currentRecording.id)}
                  download={currentRecording.filename}
                  className="p-3 bg-black/60 hover:bg-slate-800 text-emerald-400 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Download 2-Hour Segment (MP4 with Audio)"
                >
                  <Download size={22} />
                </a>

                <button
                  onClick={() => {
                    if (videoRef.current) {
                      if (videoRef.current.requestFullscreen) videoRef.current.requestFullscreen();
                    }
                  }}
                  className="p-3 bg-black/60 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Full Screen"
                >
                  <Maximize2 size={22} />
                </button>
              </div>
            )}
          </div>

          {/* CONTINUOUS TIMELINE SCRUBBER SECTION */}
          <div className="flex flex-col gap-4 bg-slate-900/80 border border-white/10 p-6 rounded-3xl shadow-xl">
            {/* Scrubber Controls & Time Display */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Play / Pause (Strict Symbol) */}
                <button
                  onClick={handleTogglePlay}
                  className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                  title={isPlaying ? 'Pause' : 'Play Continuous Feed'}
                >
                  {isPlaying ? <Pause size={30} /> : <Play size={30} />}
                </button>

                {/* Event Jump Controls (Strict Symbols) */}
                <button
                  onClick={() => handleJumpEvent('prev')}
                  className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Jump to Previous Detected Event"
                >
                  <ChevronLeft size={26} />
                </button>

                <button
                  onClick={() => handleJumpEvent('next')}
                  className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Jump to Next Detected Event"
                >
                  <ChevronRight size={26} />
                </button>

                {/* Step Controls (Strict Symbols) */}
                <button
                  onClick={() => handleJumpTime(-3600)}
                  className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Rewind 1 Hour"
                >
                  <RotateCcw size={24} />
                </button>

                <button
                  onClick={() => handleJumpTime(-900)}
                  className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Rewind 15 Minutes"
                >
                  <SkipBack size={24} />
                </button>

                <button
                  onClick={() => handleJumpTime(900)}
                  className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Forward 15 Minutes"
                >
                  <SkipForward size={24} />
                </button>

                <button
                  onClick={() => handleJumpTime(3600)}
                  className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Forward 1 Hour"
                >
                  <RotateCw size={24} />
                </button>

                <button
                  onClick={handleJumpToLatest}
                  className="p-3.5 bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Jump to Most Recent Recording"
                >
                  <Radio size={24} />
                </button>
              </div>

              {/* Sound Controls (Strict Symbols & Slider) */}
              <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-white/10">
                <button
                  onClick={handleToggleSound}
                  className="p-2 text-slate-300 hover:text-white transition-all active:scale-95"
                  title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
                >
                  {isMuted ? <VolumeX size={26} className="text-rose-400" /> : <Volume2 size={26} className="text-emerald-400" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-24 md:w-32 h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  title="Adjust Volume"
                />
              </div>

              {/* Timeline Zoom Presets */}
              <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-white/10">
                {['24h', '12h', '6h', '2h', '30m'].map(z => (
                  <button
                    key={z}
                    onClick={() => setTimelineZoom(z)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-sm uppercase transition-all ${
                      timelineZoom === z
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={`Zoom Timeline to ${z.toUpperCase()} Window`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Marker Labels along Top of Timeline */}
            <div className="flex justify-between text-slate-400 font-mono text-base px-2">
              <span>{formatTimeOnly(windowStart)}</span>
              <span>{formatTimeOnly(windowStart + windowDuration * 0.25)}</span>
              <span>{formatTimeOnly(windowStart + windowDuration * 0.5)}</span>
              <span>{formatTimeOnly(windowStart + windowDuration * 0.75)}</span>
              <span>{formatTimeOnly(windowEnd)}</span>
            </div>

            {/* The Interactive Continuous Scrubber Track */}
            <div
              ref={timelineBarRef}
              onClick={handleTimelineScrub}
              className="relative w-full h-16 bg-slate-950 border border-white/20 rounded-2xl overflow-hidden cursor-pointer select-none group"
              title="Click or Drag anywhere on the Continuous Timeline to scrub video"
            >
              {/* Subtle Hour Grid Lines */}
              <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
                {Array.from({ length: 13 }).map((_, i) => (
                  <div key={i} className="w-px h-full bg-white"></div>
                ))}
              </div>

              {/* Recorded Continuous Spans (Indigo Bands) */}
              {recordings
                .filter(r => !selectedCamera || r.camera_id === parseInt(selectedCamera))
                .map(r => {
                  const s = new Date(r.start_time).getTime();
                  const dur = (r.duration_seconds || 7200) * 1000;
                  const e = new Date(r.end_time || (s + dur)).getTime();

                  const clampedStart = Math.max(windowStart, s);
                  const clampedEnd = Math.min(windowEnd, e);
                  if (clampedEnd <= clampedStart) return null;

                  const leftPct = ((clampedStart - windowStart) / windowDuration) * 100;
                  const widthPct = ((clampedEnd - clampedStart) / windowDuration) * 100;

                  return (
                    <div
                      key={r.id}
                      style={{ left: `${leftPct}%`, width: `${Math.max(0.3, widthPct)}%` }}
                      className={`absolute top-0 bottom-0 transition-opacity ${
                        currentRecording?.id === r.id
                          ? 'bg-indigo-600/90 border-t-2 border-indigo-300'
                          : 'bg-indigo-900/60 hover:bg-indigo-800/80'
                      }`}
                    />
                  );
                })}

              {/* Event Markers Overlay along Timeline */}
              {timelineEvents.map(ev => {
                const evTime = new Date(ev.start_time).getTime();
                if (evTime < windowStart || evTime > windowEnd) return null;
                const leftPct = ((evTime - windowStart) / windowDuration) * 100;

                const colorClass = ev.motion_type === 'human'
                  ? 'bg-purple-500 shadow-purple-500/50'
                  : ev.motion_type === 'animal'
                  ? 'bg-emerald-500 shadow-emerald-500/50'
                  : 'bg-amber-400 shadow-amber-400/50';

                return (
                  <div
                    key={ev.id}
                    style={{ left: `${leftPct}%` }}
                    className={`absolute top-0 bottom-0 w-2.5 ${colorClass} shadow-lg z-10 pointer-events-none`}
                    title={`${ev.motion_type.toUpperCase()} event at ${formatTimeOnly(evTime)}`}
                  />
                );
              })}

              {/* The Vertical Needle / Playhead */}
              <div
                style={{ left: `${playheadPct}%` }}
                className="absolute top-0 bottom-0 w-1 bg-rose-500 shadow-xl shadow-rose-500/60 z-20 pointer-events-none transform -translate-x-1/2"
              >
                {/* Floating Needle Head Badge */}
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-rose-500 rounded-full border-2 border-white shadow-lg"></div>
              </div>
            </div>

            {/* Current Scrubbed Time & Status HUD */}
            <div className="flex flex-wrap items-center justify-between text-slate-300 text-lg font-mono">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">Playhead:</span>
                <span className="text-white font-bold text-xl">{formatTimestamp(new Date(currentPlayheadMs).toISOString())}</span>
              </div>

              {/* Event Legend */}
              <div className="flex items-center gap-5 text-base">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-indigo-600"></span>
                  <span>Recorded</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-purple-500"></span>
                  <span>Human</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500"></span>
                  <span>Animal</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-400"></span>
                  <span>Motion</span>
                </div>
              </div>
            </div>
          </div>

          {/* DETECTED EVENTS QUICK STRIP (BELOW TIMELINE) */}
          <div className="flex flex-col gap-4 bg-slate-900/60 border border-white/10 p-6 rounded-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity size={26} className="text-indigo-400" />
                <h3 className="text-2xl font-bold text-white">Detected Events Timeline Strip</h3>
              </div>
              <span className="text-slate-400 text-lg font-mono">
                {timelineEvents.length} Events on this Date
              </span>
            </div>

            {timelineEvents.length > 0 ? (
              <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-thin">
                {timelineEvents.map(ev => {
                  let personsList = [];
                  try { personsList = JSON.parse(ev.detected_persons || '[]'); } catch (e) { }

                  return (
                    <div
                      key={ev.id}
                      onClick={() => seekToTimestamp(new Date(ev.start_time).getTime(), true)}
                      className="flex-shrink-0 w-64 bg-slate-900 hover:bg-slate-800 border border-white/10 hover:border-indigo-500/60 rounded-2xl p-4 cursor-pointer transition-all active:scale-95 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold uppercase flex items-center gap-1.5 ${
                          ev.motion_type === 'human'
                            ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                            : ev.motion_type === 'animal'
                            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-600/30 text-amber-300 border border-amber-500/30'
                        }`}>
                          {ev.motion_type === 'human' ? <User size={16} /> : ev.motion_type === 'animal' ? <PawPrint size={16} /> : <Activity size={16} />}
                          {ev.motion_type}
                        </span>
                        <span className="text-slate-400 font-mono text-sm">
                          {formatTimeOnly(new Date(ev.start_time).getTime())}
                        </span>
                      </div>

                      <p className="text-white font-bold text-base truncate">
                        {ev.camera_name || `Camera ${ev.camera_id}`}
                      </p>

                      {personsList.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {personsList.map((p, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-indigo-600/30 text-indigo-300 text-xs font-bold rounded">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-lg">No motion or tagged events recorded on this date.</p>
            )}
          </div>
        </div>
      )}

      {/* SEGMENT CARDS VIEW (ALTERNATIVE MODE) */}
      {viewMode === 'grid' && (
        <div className="flex flex-col gap-6">
          {recordings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recordings.map((rec) => {
                let personsList = [];
                try { personsList = JSON.parse(rec.detected_persons || '[]'); } catch (e) { }

                return (
                  <div
                    key={rec.id}
                    onClick={() => {
                      setCurrentRecording(rec);
                      setCurrentPlayheadMs(new Date(rec.start_time).getTime());
                      setViewMode('timeline');
                    }}
                    className="group relative bg-slate-900/60 hover:bg-slate-900/90 border border-white/10 hover:border-indigo-500/50 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 hover:scale-[1.01] cursor-pointer flex flex-col"
                  >
                    <div className="relative aspect-video w-full bg-black/90 overflow-hidden flex items-center justify-center">
                      <img
                        src={recordingsApi.getThumbnailUrl(rec.id)}
                        alt={rec.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />

                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                        <div className="p-5 bg-indigo-600/90 group-hover:bg-indigo-600 text-white rounded-full shadow-2xl group-hover:scale-110 transition-transform">
                          <Play size={36} className="translate-x-0.5" />
                        </div>
                      </div>

                      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                        {rec.keep_permanent ? (
                          <span className="p-2.5 bg-amber-600/90 text-white rounded-xl shadow-lg" title="Locked (Protected)">
                            <Lock size={20} />
                          </span>
                        ) : null}

                        {rec.motion_type === 'human' ? (
                          <span className="p-2.5 bg-purple-600/90 text-white rounded-xl shadow-lg" title="Human Detected">
                            <User size={20} />
                          </span>
                        ) : rec.motion_type === 'animal' ? (
                          <span className="p-2.5 bg-emerald-600/90 text-white rounded-xl shadow-lg" title="Animal / Pet Detected">
                            <PawPrint size={20} />
                          </span>
                        ) : rec.has_motion ? (
                          <span className="p-2.5 bg-amber-600/90 text-white rounded-xl shadow-lg" title="Motion Event">
                            <Activity size={20} />
                          </span>
                        ) : null}
                      </div>

                      <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/80 text-white text-base font-mono font-bold rounded-xl border border-white/20">
                        {Math.round((rec.duration_seconds || 7200) / 60)}m
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                            {rec.camera_name || `Camera ${rec.camera_id}`}
                          </h4>
                          <span className="text-slate-400 font-mono text-base">
                            {formatFileSize(rec.file_size_bytes)}
                          </span>
                        </div>
                        <p className="text-slate-400 text-lg font-mono">
                          {formatTimestamp(rec.start_time)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        <div className="flex flex-wrap items-center gap-2">
                          {personsList.map((p, i) => (
                            <span key={i} className="px-3 py-1 bg-indigo-600/30 text-indigo-300 text-sm font-bold rounded-lg border border-indigo-500/30">
                              {p}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleToggleLock(rec, e)}
                            className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                              rec.keep_permanent
                                ? 'bg-amber-600 text-white border-amber-400'
                                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-transparent'
                            }`}
                            title={rec.keep_permanent ? 'Unlock recording' : 'Lock recording to prevent deletion'}
                          >
                            {rec.keep_permanent ? <Lock size={20} /> : <Unlock size={20} />}
                          </button>

                          <button
                            onClick={(e) => handleDeleteRecording(rec, e)}
                            className="p-2.5 bg-white/5 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all active:scale-95"
                            title="Delete recording"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 bg-slate-900/40 border border-white/10 rounded-3xl text-center">
              <Film size={64} className="text-slate-600 mb-4" />
              <h3 className="text-3xl font-bold text-white mb-2">No Recordings Found</h3>
              <p className="text-slate-400 text-xl max-w-md mb-6">
                Recordings will automatically appear here as the background 24/7 continuous recorder captures 2-hour segments with audio.
              </p>
            </div>
          )}
        </div>
      )}

      {/* RECORDING & STORAGE SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-3xl max-h-[88vh] bg-slate-950 border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Sticky Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-900/95 flex-shrink-0 z-20">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/30">
                  <Sliders size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Recording & Storage Settings</h3>
                  <p className="text-slate-400 text-base">Define absolute storage cap, continuous buffer, and retention</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-all"
                title="Close Modal"
              >
                <X size={26} />
              </button>
            </div>

            {/* Scrollable Body Container */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Max Storage Limit Slider & Direct Input */}
              <div className="p-6 bg-slate-900/60 border border-white/10 rounded-2xl">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-3">
                  <div>
                    <label className="text-white font-bold text-xl block">
                      Maximum Occupied Space on Disk (Absolute Cap)
                    </label>
                    <p className="text-amber-400 text-sm font-semibold mt-0.5">
                      Strict Hard Ceiling: Deletion from oldest to newest occurs immediately if over by even 1 byte.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="5"
                      max="10000"
                      step="5"
                      value={storageSettings.max_storage_gb}
                      onChange={(e) => setStorageSettings({ ...storageSettings, max_storage_gb: parseFloat(e.target.value) || 20 })}
                      className="w-28 bg-slate-800 border-2 border-indigo-500 rounded-xl px-3 py-2 text-white text-2xl font-mono font-black text-right focus:outline-none"
                    />
                    <span className="text-indigo-400 font-bold text-xl font-mono">GB</span>
                  </div>
                </div>

                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="10"
                  value={storageSettings.max_storage_gb}
                  onChange={(e) => setStorageSettings({ ...storageSettings, max_storage_gb: parseFloat(e.target.value) })}
                  className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-slate-500 text-sm font-mono mt-1">
                  <span>20 GB</span>
                  <span>100 GB</span>
                  <span>250 GB</span>
                  <span>500 GB</span>
                  <span>1000 GB (1 TB)</span>
                </div>
              </div>

              {/* Dynamic Continuous Recording Capacity Estimate */}
              <div className="p-5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex items-center gap-5">
                <Clock size={36} className="text-indigo-400 flex-shrink-0" />
                <div>
                  <h4 className="text-xl font-bold text-white mb-1">
                    Continuous Recording Duration Estimate
                  </h4>
                  <p className="text-slate-300 text-lg">
                    With <strong className="text-white">{storageSettings.max_storage_gb} GB</strong> cap for <strong className="text-white">{storageStatus?.activeCamerasCount || 3} cameras</strong>, you can continuously save approximately <strong className="text-emerald-400 font-mono font-bold text-xl">{dynamicEst.hours} Hours (~{dynamicEst.days} Days)</strong> of 24/7 video.
                  </p>
                </div>
              </div>

              {/* Continuous Buffer Time Selector */}
              <div>
                <label className="block text-slate-300 font-bold text-lg mb-2">
                  Continuous Rolling Buffer (Always Keep Last X Time)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: '15 Min', val: 15 },
                    { label: '30 Min', val: 30 },
                    { label: '1 Hour', val: 60 },
                    { label: '2 Hours', val: 120 },
                    { label: '6 Hours', val: 360 },
                    { label: '12 Hours', val: 720 },
                    { label: '24 Hours', val: 1440 },
                    { label: '7 Days', val: 10080 }
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setStorageSettings({ ...storageSettings, continuous_buffer_minutes: opt.val })}
                      className={`py-3.5 px-4 rounded-2xl font-bold text-lg border transition-all active:scale-95 ${
                        storageSettings.continuous_buffer_minutes === opt.val
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                          : 'bg-slate-800 text-slate-300 hover:text-white border-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-slate-400 text-base mt-2">
                  Everything within the last {storageSettings.continuous_buffer_minutes} minutes is preserved continuously regardless of motion.
                </p>
              </div>

              {/* Retention Mode After Buffer */}
              <div>
                <label className="block text-slate-300 font-bold text-lg mb-3">
                  Retention Policy for Recordings Older than Buffer
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => setStorageSettings({ ...storageSettings, retention_mode: 'keep_motion' })}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      storageSettings.retention_mode === 'keep_motion'
                        ? 'bg-indigo-600/20 border-indigo-500 shadow-lg'
                        : 'bg-slate-900 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Activity size={24} className="text-amber-400" />
                      <h4 className="text-xl font-bold text-white">Keep Motion & Tags</h4>
                    </div>
                    <p className="text-slate-400 text-base">
                      Deletes non-motion segments older than the buffer, keeping human, animal, and motion events indefinitely (subject to the hard disk cap).
                    </p>
                  </div>

                  <div
                    onClick={() => setStorageSettings({ ...storageSettings, retention_mode: 'delete_all' })}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      storageSettings.retention_mode === 'delete_all'
                        ? 'bg-indigo-600/20 border-indigo-500 shadow-lg'
                        : 'bg-slate-900 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Clock size={24} className="text-indigo-400" />
                      <h4 className="text-xl font-bold text-white">Strict Rolling Buffer</h4>
                    </div>
                    <p className="text-slate-400 text-base">
                      Automatically deletes all recordings older than the specified buffer period, maintaining a strict rolling window.
                    </p>
                  </div>
                </div>
              </div>

              {/* Hardware Insights: IR Night Vision & Audio */}
              <div className="p-5 bg-slate-900/80 border border-white/10 rounded-2xl flex flex-col gap-2 text-base text-slate-300">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Info size={20} className="text-indigo-400" />
                  Hardware Notes: IR Night Vision & Synchronous Audio
                </div>
                <p>
                  <strong>IR Night Vision:</strong> Automated by the EZVIZ camera's optical sensor and infrared ICR hardware. When ambient light drops, the camera automatically switches to IR flood illumination and night-vision RTSP video.
                </p>
                <p>
                  <strong>Audio:</strong> Recorded 2-hour MP4 files contain synchronous AAC audio starting at 0.0s. Use the volume slider and unmute icon in the player to listen.
                </p>
              </div>
            </div>

            {/* Sticky Modal Actions Footer - Always Visible */}
            <div className="flex justify-end gap-4 p-6 border-t border-white/10 bg-slate-900/95 flex-shrink-0 z-20 shadow-2xl">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xl rounded-2xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xl rounded-2xl shadow-xl shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAG PERSON MODAL */}
      {taggingRecording && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-950 border border-white/20 rounded-3xl p-7 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Tag size={26} className="text-indigo-400" />
                <h3 className="text-2xl font-bold text-white">Tag Identified Person</h3>
              </div>
              <button
                onClick={() => setTaggingRecording(null)}
                className="p-2 text-slate-400 hover:text-white"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div>
              <label className="block text-slate-300 text-lg font-bold mb-2">
                Enter Person / Entity Name
              </label>
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="e.g. Pedro, Family Member, Courier..."
                className="w-full bg-slate-900 border border-white/20 rounded-2xl px-5 py-4 text-white text-xl focus:outline-none focus:border-indigo-500"
                autoFocus
              />
            </div>

            {persons.length > 0 && (
              <div>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">Quick Select</p>
                <div className="flex flex-wrap gap-2">
                  {persons.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setNewPersonName(p.name)}
                      className="px-4 py-2 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-xl text-base font-medium transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setTaggingRecording(null)}
                className="px-5 py-3 bg-slate-800 text-slate-300 font-bold text-lg rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPersonTag}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-xl shadow-lg"
              >
                Apply Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryViewer;
