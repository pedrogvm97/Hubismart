import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Bug,
  Camera as CameraIcon,
  Settings,
  KeyRound,
  Check,
  X,
  Plus,
  Trash2,
  AlertCircle,
  Wifi,
  Radio,
  Search,
  Activity
} from 'lucide-react';
import { cameraApi } from '../api';

const CameraViewer = () => {
  const [cameras, setCameras] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGridView, setIsGridView] = useState(false);
  const [isAutoCycle, setIsAutoCycle] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [streamRefreshKey, setStreamRefreshKey] = useState(Date.now());
  const [inlineVerificationCode, setInlineVerificationCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);

  const autoCycleTimerRef = useRef(null);

  // Load cameras on mount
  useEffect(() => {
    loadCameras();
    loadLogs();
    const interval = setInterval(loadLogs, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto cycle timer
  useEffect(() => {
    if (isAutoCycle && cameras.length > 1 && !isGridView) {
      autoCycleTimerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % cameras.length);
      }, 7000);
    } else {
      if (autoCycleTimerRef.current) clearInterval(autoCycleTimerRef.current);
    }
    return () => {
      if (autoCycleTimerRef.current) clearInterval(autoCycleTimerRef.current);
    };
  }, [isAutoCycle, cameras.length, isGridView]);

  const loadCameras = async () => {
    setLoading(true);
    try {
      const data = await cameraApi.getCameras();
      setCameras(data || []);
      if (data && data.length > 0 && currentIndex >= data.length) {
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Failed to load cameras:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const logs = await cameraApi.getDebugLogs();
      setDebugLogs(logs || []);
    } catch (err) { }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const updated = await cameraApi.scanCameras();
      setCameras(updated || []);
      loadLogs();
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleTestConnection = async (camera, customCode = null) => {
    if (!camera) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await cameraApi.testConnection(camera.id, customCode !== null ? customCode : camera.verification_code);
      setTestResult(res);
      // Reload camera list to reflect updated status
      loadCameras();
      loadLogs();
    } catch (err) {
      setTestResult({
        success: false,
        status: 'error',
        message: err.message || 'Failed to execute test request'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveVerificationCode = async (camera, code) => {
    if (!camera) return;
    setSavingCode(true);
    try {
      const updated = await cameraApi.updateCamera(camera.id, {
        ...camera,
        verification_code: code.trim().toUpperCase()
      });
      // Run quick test
      await handleTestConnection(updated, code.trim().toUpperCase());
      setStreamRefreshKey(Date.now());
      setInlineVerificationCode('');
      loadCameras();
    } catch (err) {
      alert('Failed to save code: ' + err.message);
    } finally {
      setSavingCode(false);
    }
  };

  const handlePrevCamera = () => {
    if (cameras.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + cameras.length) % cameras.length);
    setTestResult(null);
  };

  const handleNextCamera = () => {
    if (cameras.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % cameras.length);
    setTestResult(null);
  };

  const activeCamera = cameras[currentIndex] || null;

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto pb-16">
      {/* Top Header & Icon Action Bar (All buttons have icons ONLY with descriptive titles) */}
      <div className="flex flex-wrap items-center justify-between gap-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30 text-white">
            <Radio size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-wide">
              {activeCamera ? activeCamera.name : 'EZVIZ Camera Feeds'}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <p className="text-slate-400 text-lg font-medium">
                {activeCamera ? `${activeCamera.ip}:${activeCamera.port || 554}` : 'Discovering Cameras'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls - SYMBOLS OVER TEXT STRICT ENFORCEMENT */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="p-4 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-white rounded-2xl border border-white/10 transition-all duration-200 shadow-md active:scale-95 disabled:opacity-50"
            title="Scan local network for EZVIZ cameras and hubs"
          >
            <Search size={28} className={scanning ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => {
              setStreamRefreshKey(Date.now());
              loadCameras();
            }}
            className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all duration-200 shadow-md active:scale-95"
            title="Refresh camera streams and status"
          >
            <RefreshCw size={28} />
          </button>

          <button
            onClick={() => setIsGridView(!isGridView)}
            className={`p-4 rounded-2xl border transition-all duration-200 shadow-md active:scale-95 ${
              isGridView
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-white/10'
            }`}
            title={isGridView ? 'Switch to single camera feed view' : 'Switch to 4-camera grid view'}
          >
            <LayoutGrid size={28} />
          </button>

          <button
            onClick={() => setIsAutoCycle(!isAutoCycle)}
            className={`p-4 rounded-2xl border transition-all duration-200 shadow-md active:scale-95 ${
              isAutoCycle
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-white/10'
            }`}
            title={isAutoCycle ? 'Pause automatic camera cycle loop' : 'Start automatic camera cycle loop (7s)'}
          >
            {isAutoCycle ? <Pause size={28} /> : <Play size={28} />}
          </button>

          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`p-4 rounded-2xl border transition-all duration-200 shadow-md active:scale-95 ${
              showDebug
                ? 'bg-purple-600 text-white border-purple-500 shadow-purple-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-white/10'
            }`}
            title={showDebug ? 'Hide debug and diagnostics console' : 'Show debug and diagnostics console'}
          >
            <Bug size={28} />
          </button>

          <button
            onClick={() => {
              setEditingCamera({
                name: 'New Camera',
                ip: '192.168.1.',
                port: 554,
                channel: 1,
                stream_path: '/h264/ch1/main/av_stream',
                username: 'admin',
                verification_code: ''
              });
              setShowEditModal(true);
            }}
            className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl border border-indigo-400 shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-95"
            title="Add a camera or hub manually"
          >
            <Plus size={28} />
          </button>
        </div>
      </div>

      {/* Main View Area: Single Feed (with large arrows & switchers) OR Grid View */}
      {!isGridView ? (
        <div className="flex flex-col gap-6">
          {/* Main Feed Stage */}
          <div className="relative w-full aspect-video min-h-[520px] max-h-[780px] bg-black/90 rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl flex items-center justify-center group">
            {activeCamera ? (
              <>
                {/* Live Stream MJPEG from Backend */}
                <img
                  key={`${activeCamera.id}-${streamRefreshKey}`}
                  src={cameraApi.getStreamUrl(activeCamera.id, streamRefreshKey)}
                  alt={activeCamera.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // If stream fails to render, show fallback state
                    e.currentTarget.style.display = 'none';
                    const fallbackEl = document.getElementById(`fallback-${activeCamera.id}`);
                    if (fallbackEl) fallbackEl.style.display = 'flex';
                  }}
                  onLoad={(e) => {
                    e.currentTarget.style.display = 'block';
                    const fallbackEl = document.getElementById(`fallback-${activeCamera.id}`);
                    if (fallbackEl) fallbackEl.style.display = 'none';
                  }}
                />

                {/* Stream Fallback & Verification Code Card (shown if stream requires code or is offline) */}
                <div
                  id={`fallback-${activeCamera.id}`}
                  className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-t from-slate-950/95 via-slate-900/90 to-slate-950/95 backdrop-blur-md text-center"
                >
                  <div className="p-6 bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl mb-6 shadow-xl">
                    <KeyRound size={56} className="text-amber-400 animate-pulse" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-white mb-3">
                    {activeCamera.name}
                  </h3>
                  <p className="text-slate-300 text-xl max-w-xl mb-8 leading-relaxed">
                    Camera found at <span className="font-mono text-amber-300 font-bold">{activeCamera.ip}</span>.
                    Enter the 6-letter verification code from the camera label or EZVIZ app to unlock the live feed.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-4 w-full max-w-md">
                    <input
                      type="text"
                      maxLength={12}
                      placeholder="e.g. ABCDEF"
                      value={inlineVerificationCode}
                      onChange={(e) => setInlineVerificationCode(e.target.value.toUpperCase())}
                      className="flex-1 bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-white text-2xl font-mono tracking-widest uppercase focus:outline-none focus:border-indigo-400 shadow-inner"
                    />
                    <button
                      onClick={() => handleSaveVerificationCode(activeCamera, inlineVerificationCode)}
                      disabled={savingCode || !inlineVerificationCode.trim()}
                      className="p-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-40"
                      title="Save Verification Code and Connect Feed"
                    >
                      <Check size={32} />
                    </button>
                    <button
                      onClick={() => handleTestConnection(activeCamera, inlineVerificationCode)}
                      disabled={testing}
                      className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-xl shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-40"
                      title="Test RTSP Handshake"
                    >
                      <Bug size={32} className={testing ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Left Navigation Arrow - LARGE & VISIBLE FOR SIGHT */}
                <button
                  onClick={handlePrevCamera}
                  className="absolute left-6 top-1/2 -translate-y-1/2 p-5 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-full border-2 border-white/20 shadow-2xl transition-all duration-200 active:scale-90 opacity-90 hover:opacity-100 z-10"
                  title="Previous Camera Feed (Left Arrow)"
                >
                  <ChevronLeft size={44} />
                </button>

                {/* Right Navigation Arrow - LARGE & VISIBLE FOR SIGHT */}
                <button
                  onClick={handleNextCamera}
                  className="absolute right-6 top-1/2 -translate-y-1/2 p-5 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-full border-2 border-white/20 shadow-2xl transition-all duration-200 active:scale-90 opacity-90 hover:opacity-100 z-10"
                  title="Next Camera Feed (Right Arrow)"
                >
                  <ChevronRight size={44} />
                </button>

                {/* Floating Bottom Stream Toolbar on hover */}
                <div className="absolute bottom-6 left-1/2 -translate-y-0 -translate-x-1/2 flex items-center gap-4 bg-slate-950/80 backdrop-blur-xl border border-white/20 px-6 py-3.5 rounded-full shadow-2xl z-10">
                  <button
                    onClick={() => setStreamRefreshKey(Date.now())}
                    className="p-3 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
                    title="Reconnect Live Stream"
                  >
                    <RefreshCw size={26} />
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        const url = cameraApi.getSnapshotUrl(activeCamera.id, Date.now());
                        const win = window.open(url, '_blank');
                        if (win) win.focus();
                      } catch (e) {
                        alert('Snapshot failed: ' + e.message);
                      }
                    }}
                    className="p-3 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
                    title="Capture High Resolution Snapshot"
                  >
                    <CameraIcon size={26} />
                  </button>

                  <button
                    onClick={() => handleTestConnection(activeCamera)}
                    disabled={testing}
                    className="p-3 text-amber-400 hover:text-amber-300 hover:bg-white/10 rounded-full transition-colors active:scale-95 disabled:opacity-50"
                    title="Run Diagnostic Connection Test"
                  >
                    <Bug size={26} className={testing ? 'animate-spin' : ''} />
                  </button>

                  <button
                    onClick={() => {
                      setEditingCamera(activeCamera);
                      setShowEditModal(true);
                    }}
                    className="p-3 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
                    title="Edit Camera Settings & Verification Code"
                  >
                    <Settings size={26} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle size={64} className="text-slate-500 mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">No Cameras Found</h3>
                <p className="text-slate-400 text-lg mb-6">Click the scan icon to discover your EZVIZ devices.</p>
                <button
                  onClick={handleScan}
                  className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-xl transition-all"
                  title="Scan for cameras"
                >
                  <Search size={32} />
                </button>
              </div>
            )}
          </div>

          {/* Quick Camera Selector Thumbnails / Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cameras.map((cam, idx) => (
              <button
                key={cam.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setTestResult(null);
                }}
                className={`p-5 rounded-3xl border-2 transition-all duration-200 flex items-center justify-between shadow-xl text-left ${
                  currentIndex === idx
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-indigo-600/10'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/10 text-slate-400 hover:text-white'
                }`}
                title={`Switch to ${cam.name} (${cam.ip})`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-2xl ${
                      currentIndex === idx ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <CameraIcon size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white truncate max-w-[140px]">{cam.name}</h4>
                    <p className="text-base text-slate-400 font-mono">{cam.ip}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`h-4 w-4 rounded-full ${
                      cam.verification_code ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                    }`}
                    title={cam.verification_code ? 'Configured with Code' : 'Awaiting Code'}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Grid View (All 4 Cameras Displayed Simultaneously) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cameras.map((cam, idx) => (
            <div
              key={cam.id}
              onClick={() => {
                setCurrentIndex(idx);
                setIsGridView(false);
              }}
              className="group relative aspect-video bg-black/90 rounded-3xl overflow-hidden border-2 border-white/10 hover:border-indigo-500 shadow-2xl transition-all cursor-pointer"
              title={`Click to focus ${cam.name}`}
            >
              <img
                src={cameraApi.getStreamUrl(cam.id, streamRefreshKey)}
                alt={cam.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fb = document.getElementById(`grid-fallback-${cam.id}`);
                  if (fb) fb.style.display = 'flex';
                }}
              />
              <div
                id={`grid-fallback-${cam.id}`}
                className="hidden absolute inset-0 flex-col items-center justify-center p-4 bg-slate-900/90 text-center"
              >
                <KeyRound size={40} className="text-amber-400 mb-2" />
                <h4 className="text-xl font-bold text-white mb-1">{cam.name}</h4>
                <p className="text-slate-400 text-sm font-mono">{cam.ip}</p>
              </div>

              {/* Header pill on card */}
              <div className="absolute top-4 left-4 flex items-center gap-3 bg-black/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white font-bold text-lg">{cam.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Debug & Diagnostics Panel */}
      {showDebug && (
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600 rounded-2xl text-white">
                <Bug size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Diagnostics & Network Inspector</h3>
                <p className="text-slate-400 text-base">Real-time connection verification and RTSP logs</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => activeCamera && handleTestConnection(activeCamera)}
                disabled={testing || !activeCamera}
                className="p-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
                title="Test connection to active camera"
              >
                <Activity size={24} className={testing ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowDebug(false)}
                className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all"
                title="Close debug inspector"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Test Result Feedback Box */}
          {testResult && (
            <div
              className={`p-6 rounded-2xl border-2 text-left ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle size={28} />
                <h4 className="text-xl font-bold capitalize">
                  Test Status: {testResult.status}
                </h4>
              </div>
              <p className="text-lg text-slate-200 mb-4">{testResult.message}</p>
              {testResult.raw && (
                <pre className="bg-black/60 p-4 rounded-xl font-mono text-sm overflow-x-auto text-slate-300 border border-white/10">
                  {testResult.raw}
                </pre>
              )}
            </div>
          )}

          {/* Diagnostics Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
              <span className="text-slate-400 text-base font-bold uppercase tracking-wider block mb-1">
                Active IP
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {activeCamera ? activeCamera.ip : 'N/A'}
              </span>
            </div>
            <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
              <span className="text-slate-400 text-base font-bold uppercase tracking-wider block mb-1">
                RTSP Port
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {activeCamera ? activeCamera.port || 554 : 'N/A'}
              </span>
            </div>
            <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
              <span className="text-slate-400 text-base font-bold uppercase tracking-wider block mb-1">
                Stream Path
              </span>
              <span className="text-lg font-bold font-mono text-indigo-400 truncate block">
                {activeCamera ? activeCamera.stream_path : 'N/A'}
              </span>
            </div>
            <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
              <span className="text-slate-400 text-base font-bold uppercase tracking-wider block mb-1">
                Verification Code
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {activeCamera && activeCamera.verification_code ? activeCamera.verification_code : 'Not Set'}
              </span>
            </div>
          </div>

          {/* Debug Console Logs */}
          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-base font-bold uppercase tracking-wider">
              Live Event Logs
            </span>
            <div className="h-64 bg-black/80 border border-white/10 rounded-2xl p-4 overflow-y-auto font-mono text-sm flex flex-col gap-1 text-slate-300">
              {debugLogs.length === 0 ? (
                <p className="text-slate-500 italic">No logs recorded yet.</p>
              ) : (
                debugLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 leading-relaxed">
                    <span className="text-slate-500 select-none">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-indigo-400 font-bold">[{log.source}]</span>
                    <span className="text-slate-200">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Camera Modal */}
      {showEditModal && editingCamera && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/15 w-full max-w-xl rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-2xl font-bold text-white">Camera Configuration</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all"
                title="Close modal"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-base font-bold mb-2">Camera Name</label>
                <input
                  type="text"
                  value={editingCamera.name || ''}
                  onChange={(e) => setEditingCamera({ ...editingCamera, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/15 rounded-2xl px-5 py-4 text-white text-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-base font-bold mb-2">IP Address</label>
                  <input
                    type="text"
                    value={editingCamera.ip || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, ip: e.target.value })}
                    className="w-full bg-white/5 border border-white/15 rounded-2xl px-5 py-4 text-white text-xl font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-base font-bold mb-2">RTSP Port</label>
                  <input
                    type="number"
                    value={editingCamera.port || 554}
                    onChange={(e) => setEditingCamera({ ...editingCamera, port: parseInt(e.target.value) || 554 })}
                    className="w-full bg-white/5 border border-white/15 rounded-2xl px-5 py-4 text-white text-xl font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-base font-bold mb-2">Stream Path</label>
                <input
                  type="text"
                  value={editingCamera.stream_path || '/h264/ch1/main/av_stream'}
                  onChange={(e) => setEditingCamera({ ...editingCamera, stream_path: e.target.value })}
                  className="w-full bg-white/5 border border-white/15 rounded-2xl px-5 py-4 text-white text-xl font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-base font-bold mb-2">
                  Verification Code (6-letters from sticker/app)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="e.g. ABCDEF"
                  value={editingCamera.verification_code || ''}
                  onChange={(e) => setEditingCamera({ ...editingCamera, verification_code: e.target.value.toUpperCase() })}
                  className="w-full bg-white/5 border border-white/15 rounded-2xl px-5 py-4 text-white text-2xl font-mono tracking-widest uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              {editingCamera.id ? (
                <button
                  onClick={async () => {
                    if (confirm('Delete this camera?')) {
                      await cameraApi.deleteCamera(editingCamera.id);
                      setShowEditModal(false);
                      loadCameras();
                    }
                  }}
                  className="p-4 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-2xl transition-all"
                  title="Delete camera"
                >
                  <Trash2 size={26} />
                </button>
              ) : <div />}

              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    if (editingCamera.id) {
                      await cameraApi.updateCamera(editingCamera.id, editingCamera);
                    } else {
                      await cameraApi.createCamera(editingCamera);
                    }
                    setShowEditModal(false);
                    loadCameras();
                    setStreamRefreshKey(Date.now());
                  }}
                  className="p-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-xl transition-all active:scale-95"
                  title="Save Camera Settings"
                >
                  <Check size={28} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraViewer;
