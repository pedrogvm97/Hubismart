import React, { useState, useEffect, useRef } from 'react';
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
  Maximize2
} from 'lucide-react';
import { recordingsApi, storageApi, cameraApi } from '../api';

const GalleryViewer = () => {
  const [recordings, setRecordings] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [persons, setPersons] = useState([]);
  const [storageStatus, setStorageStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMotionType, setSelectedMotionType] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Active playing video modal
  const [activeRecording, setActiveRecording] = useState(null);
  const videoRef = useRef(null);

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
    } catch (e) {
      console.error('Failed to load cameras:', e);
    }
  };

  const loadRecordings = async () => {
    try {
      const params = {};
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
      setRecordings(list || []);
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

  const handleToggleLock = async (rec, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await recordingsApi.toggleLock(rec.id);
      setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, keep_permanent: res.keep_permanent } : r));
      if (activeRecording && activeRecording.id === rec.id) {
        setActiveRecording(prev => ({ ...prev, keep_permanent: res.keep_permanent }));
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
      if (activeRecording && activeRecording.id === rec.id) {
        setActiveRecording(null);
      }
      loadStorageStatus();
    } catch (err) {
      alert('Error deleting recording: ' + err.message);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await storageApi.updateSettings(storageSettings);
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
      // Also register into known_persons
      await recordingsApi.addPerson({ name: newPersonName.trim() });
      await loadPersons();
      setRecordings(prev => prev.map(r => r.id === taggingRecording.id ? { ...r, detected_persons: JSON.stringify(res.detected_persons), has_motion: 1 } : r));
      if (activeRecording && activeRecording.id === taggingRecording.id) {
        setActiveRecording(prev => ({ ...prev, detected_persons: JSON.stringify(res.detected_persons), has_motion: 1 }));
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

  // Dynamic estimate calculation based on current settings slider
  const calculateDynamicEstimate = (maxGb, activeCams = 3) => {
    const gb = parseFloat(maxGb) || 200;
    const cams = Math.max(1, activeCams || 1);
    // Average 1080p camera: ~0.9 GB / hr
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

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto pb-20">
      {/* Top Header & Tool Bar - Pure Symbols Over Text */}
      <div className="flex flex-wrap items-center justify-between gap-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30 text-white">
            <Film size={34} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-wide">
              Surveillance Recordings & Gallery
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <p className="text-slate-400 text-lg font-medium font-mono">
                {storageStatus?.isRecordingActive
                  ? `${storageStatus.activeCamerasCount} Cameras 24/7 Recording Active (Audio & IR Auto)`
                  : 'Recorder Engine Ready'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls - Strictly Symbols with Large Touch Targets and Tooltips */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-4 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl border border-indigo-500/30 transition-all duration-200 shadow-md active:scale-95"
            title="Storage Cap, Continuous Rolling Buffer & Retention Settings"
          >
            <Sliders size={28} />
          </button>

          <button
            onClick={() => {
              loadRecordings();
              loadStorageStatus();
            }}
            className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all duration-200 shadow-md active:scale-95"
            title="Refresh Recordings & Storage Status"
          >
            <RefreshCw size={28} />
          </button>
        </div>
      </div>

      {/* Storage Quota & Capacity Overview Card */}
      {storageStatus && (
        <div className="p-7 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/20">
                <HardDrive size={30} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Storage Capacity & Estimate</h3>
                <p className="text-slate-400 text-lg">
                  {storageStatus.totalUsedGb} GB Used of {storageStatus.maxStorageGb} GB Cap ({storageStatus.usedPercentage}%)
                </p>
              </div>
            </div>

            {/* Calculated Continuous Duration Estimate Badge */}
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-3.5 rounded-2xl">
              <Clock size={28} className="text-emerald-400" />
              <div>
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Continuous Estimate</p>
                <p className="text-emerald-400 text-2xl font-black font-mono">
                  ~{storageStatus.estimatedContinuousHours} Hours ({storageStatus.estimatedContinuousDays} Days)
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden p-0.5 border border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                storageStatus.usedPercentage > 90
                  ? 'bg-rose-500'
                  : storageStatus.usedPercentage > 75
                  ? 'bg-amber-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, storageStatus.usedPercentage)}%` }}
            ></div>
          </div>

          {/* Quick Metrics & Strategy Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-slate-300 text-lg pt-1 border-t border-white/5">
            <div className="flex items-center gap-6">
              <span>
                <strong className="text-white">{storageStatus.totalRecordings}</strong> Total Segments
              </span>
              <span>
                <strong className="text-amber-400">{storageStatus.motionRecordings}</strong> Motion Events
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">Rolling Buffer:</span>
              <span className="bg-indigo-600/30 text-indigo-300 font-mono font-bold px-3 py-1 rounded-xl border border-indigo-500/30">
                {storageStatus.continuousBufferMinutes >= 1440
                  ? `${storageStatus.continuousBufferMinutes / 1440} Days`
                  : storageStatus.continuousBufferMinutes >= 60
                  ? `${storageStatus.continuousBufferMinutes / 60} Hours`
                  : `${storageStatus.continuousBufferMinutes} Minutes`}
              </span>
              <span className="text-slate-400">Retention:</span>
              <span className="bg-emerald-600/30 text-emerald-300 font-bold px-3 py-1 rounded-xl border border-emerald-500/30">
                {storageStatus.retentionMode === 'keep_motion' ? 'Keep Motion & Tags' : 'Strict Buffer'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar - Strictly Symbols Over Text on Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 border border-white/10 p-5 rounded-3xl">
        {/* Motion Tag Filters (Pure Icons with Large Targets) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedMotionType('all')}
            className={`p-4 rounded-2xl border transition-all active:scale-95 ${
              selectedMotionType === 'all'
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-300 hover:text-white border-white/10'
            }`}
            title="Show All Recordings"
          >
            <Layers size={28} />
          </button>

          <button
            onClick={() => setSelectedMotionType('motion_any')}
            className={`p-4 rounded-2xl border transition-all active:scale-95 ${
              selectedMotionType === 'motion_any'
                ? 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-600/30'
                : 'bg-slate-800 text-slate-300 hover:text-white border-white/10'
            }`}
            title="Filter Motion-Tagged Events"
          >
            <Activity size={28} />
          </button>

          <button
            onClick={() => setSelectedMotionType('human')}
            className={`p-4 rounded-2xl border transition-all active:scale-95 ${
              selectedMotionType === 'human'
                ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30'
                : 'bg-slate-800 text-slate-300 hover:text-white border-white/10'
            }`}
            title="Filter Human Detections"
          >
            <User size={28} />
          </button>

          <button
            onClick={() => setSelectedMotionType('animal')}
            className={`p-4 rounded-2xl border transition-all active:scale-95 ${
              selectedMotionType === 'animal'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30'
                : 'bg-slate-800 text-slate-300 hover:text-white border-white/10'
            }`}
            title="Filter Animal / Pet Detections"
          >
            <PawPrint size={28} />
          </button>
        </div>

        {/* Dropdowns & Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Camera Selector */}
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="bg-slate-800 text-white text-lg font-medium border border-white/10 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
            title="Select Camera"
          >
            <option value="">All Cameras</option>
            {cameras.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Date Picker */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-800 text-white text-lg font-medium border border-white/10 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              title="Filter by Date"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="absolute right-3 p-1.5 text-slate-400 hover:text-white"
                title="Clear Date Filter"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Identified Person Selector */}
          {persons.length > 0 && (
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="bg-slate-800 text-white text-lg font-medium border border-white/10 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              title="Filter by Identified Person"
            >
              <option value="">All Identified Persons</option>
              {persons.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          )}

          {/* Search Keyword */}
          <div className="relative flex items-center">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Search tag..."
              className="bg-slate-800 text-white text-lg font-medium border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-indigo-500 w-44 md:w-56"
            />
            <Search size={22} className="absolute left-4 text-slate-400 pointer-events-none" />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-3 p-1.5 text-slate-400 hover:text-white"
                title="Clear Search"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video Playback Modal (Active Stage) */}
      {activeRecording && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8">
          <div className="relative w-full max-w-5xl bg-slate-950 border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-900/80">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white">
                  <Film size={26} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {activeRecording.camera_name || `Camera ${activeRecording.camera_id}`}
                  </h3>
                  <p className="text-slate-400 text-lg font-mono">
                    {formatTimestamp(activeRecording.start_time)} ({activeRecording.duration_seconds || 120}s - {formatFileSize(activeRecording.file_size_bytes)})
                  </p>
                </div>
              </div>

              {/* Action Icons in Video Header (Strict Symbols Only) */}
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => handleToggleLock(activeRecording, e)}
                  className={`p-3.5 rounded-2xl border transition-all active:scale-95 ${
                    activeRecording.keep_permanent
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-800 text-slate-300 hover:text-white border-white/10'
                  }`}
                  title={activeRecording.keep_permanent ? 'Protected from deletion (Click to Unlock)' : 'Lock recording to protect from auto-pruning'}
                >
                  {activeRecording.keep_permanent ? <Lock size={26} /> : <Unlock size={26} />}
                </button>

                <button
                  onClick={() => {
                    setTaggingRecording(activeRecording);
                  }}
                  className="p-3.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Tag Identified Person (Pedro, Family, Visitor)"
                >
                  <Tag size={26} />
                </button>

                <a
                  href={recordingsApi.getVideoUrl(activeRecording.id)}
                  download={activeRecording.filename}
                  className="p-3.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Download MP4 Video with Audio"
                >
                  <Download size={26} />
                </a>

                <button
                  onClick={(e) => handleDeleteRecording(activeRecording, e)}
                  className="p-3.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-2xl border border-rose-500/30 transition-all active:scale-95"
                  title="Delete Recording Permanently"
                >
                  <Trash2 size={26} />
                </button>

                <button
                  onClick={() => setActiveRecording(null)}
                  className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                  title="Close Video Player"
                >
                  <X size={26} />
                </button>
              </div>
            </div>

            {/* Video Player Stage */}
            <div className="relative w-full aspect-video bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                key={activeRecording.id}
                src={recordingsApi.getVideoUrl(activeRecording.id)}
                controls
                autoPlay
                className="w-full h-full object-contain"
                preload="auto"
              >
                Your browser does not support HTML5 MP4 video.
              </video>
            </div>

            {/* Video Info Footer */}
            <div className="p-6 bg-slate-900/80 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-lg">Detected Event:</span>
                <span className={`px-4 py-1.5 rounded-xl font-bold text-lg capitalize ${
                  activeRecording.motion_type === 'human'
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                    : activeRecording.motion_type === 'animal'
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                    : activeRecording.has_motion
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border border-white/10'
                }`}>
                  {activeRecording.motion_type !== 'none' ? activeRecording.motion_type : 'Continuous 24/7 Buffer'}
                </span>

                {/* Identified Persons Tags */}
                {(() => {
                  let personsList = [];
                  try { personsList = JSON.parse(activeRecording.detected_persons || '[]'); } catch (e) { }
                  return personsList.map((p, i) => (
                    <span key={i} className="bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3.5 py-1.5 rounded-xl font-bold text-lg flex items-center gap-2">
                      <User size={18} />
                      {p}
                    </span>
                  ));
                })()}
              </div>

              <div className="flex items-center gap-4 text-slate-400 text-lg">
                <span className="flex items-center gap-2">
                  <Volume2 size={22} className="text-emerald-400" />
                  AAC Audio Track Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recording Grid Cards */}
      {recordings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recordings.map((rec) => {
            let personsList = [];
            try { personsList = JSON.parse(rec.detected_persons || '[]'); } catch (e) { }

            return (
              <div
                key={rec.id}
                onClick={() => setActiveRecording(rec)}
                className="group relative bg-slate-900/60 hover:bg-slate-900/90 border border-white/10 hover:border-indigo-500/50 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 hover:scale-[1.01] cursor-pointer flex flex-col"
              >
                {/* Thumbnail Preview with Play Overlay */}
                <div className="relative aspect-video w-full bg-black/90 overflow-hidden flex items-center justify-center">
                  <img
                    src={recordingsApi.getThumbnailUrl(rec.id)}
                    alt={rec.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      // Fallback visual
                      e.target.style.display = 'none';
                    }}
                  />

                  {/* Play Overlay Icon (Symbols Rule) */}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                    <div className="p-5 bg-indigo-600/90 group-hover:bg-indigo-600 text-white rounded-full shadow-2xl group-hover:scale-110 transition-transform">
                      <Play size={36} className="translate-x-0.5" />
                    </div>
                  </div>

                  {/* Top-Right Badges */}
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

                  {/* Duration Badge Bottom-Right */}
                  <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/80 text-white text-base font-mono font-bold rounded-xl border border-white/20">
                    {rec.duration_seconds || 120}s
                  </div>
                </div>

                {/* Card Meta Content */}
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

                  {/* Tags & Action Icons (Strict Symbols Over Text) */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      {personsList.map((p, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-600/30 text-indigo-300 text-sm font-bold rounded-lg border border-indigo-500/30">
                          {p}
                        </span>
                      ))}
                      {personsList.length === 0 && !rec.has_motion && (
                        <span className="px-3 py-1 bg-white/5 text-slate-400 text-sm font-medium rounded-lg">
                          Buffer
                        </span>
                      )}
                    </div>

                    {/* Action Symbols */}
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
            Recordings will automatically appear here as the background 24/7 continuous recorder captures 2-minute segments with audio.
          </p>
          <button
            onClick={loadRecordings}
            className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-xl transition-all"
            title="Refresh Recordings"
          >
            <RefreshCw size={28} />
          </button>
        </div>
      )}

      {/* Storage & Retention Settings Modal - Fixed Height & Scrollable with Sticky Save */}
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
                  Hardware Notes: IR Night Vision & Audio
                </div>
                <p>
                  <strong>IR Night Vision:</strong> Automated by the EZVIZ camera's optical sensor and infrared ICR hardware. When ambient light drops, the camera automatically switches to IR flood illumination and night-vision RTSP video.
                </p>
                <p>
                  <strong>Audio:</strong> Recorded MP4 files preserve camera AAC audio. When viewing recordings in the Gallery, sound is enabled with volume controls.
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

      {/* Tag Person Modal */}
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

            {/* Existing Known Persons Quick Pick */}
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
