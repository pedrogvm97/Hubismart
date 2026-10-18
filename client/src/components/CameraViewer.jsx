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
  Activity,
  HelpCircle,
  Layers,
  Film
} from 'lucide-react';
import { cameraApi } from '../api';

const CameraViewer = ({ onNavigateToGallery }) => {
  const [cameras, setCameras] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGridView, setIsGridView] = useState(false);
  const [isAutoCycle, setIsAutoCycle] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [streamRefreshKey, setStreamRefreshKey] = useState(Date.now());
  const [streamError, setStreamError] = useState(false);

  const autoCycleTimerRef = useRef(null);

  useEffect(() => {
    loadCameras();
    loadLogs();
    const interval = setInterval(loadLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAutoCycle && cameras.length > 1 && !isGridView) {
      autoCycleTimerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % cameras.length);
        setStreamError(false);
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
      // Ensure Hub is filtered out in case any legacy record exists
      const cleanCameras = (data || []).filter(c => !c.is_hub && c.ip !== '192.168.1.72' && !c.name.toLowerCase().includes('hub'));
      setCameras(cleanCameras);
      if (cleanCameras.length > 0 && currentIndex >= cleanCameras.length) {
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
      const cleanCameras = (updated || []).filter(c => !c.is_hub && c.ip !== '192.168.1.72' && !c.name.toLowerCase().includes('hub'));
      setCameras(cleanCameras);
      loadLogs();
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleTestConnection = async (camera) => {
    if (!camera) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await cameraApi.testConnection(camera.id, camera.verification_code);
      setTestResult(res);
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

  const handlePrevCamera = () => {
    if (cameras.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + cameras.length) % cameras.length);
    setTestResult(null);
    setStreamError(false);
  };

  const handleNextCamera = () => {
    if (cameras.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % cameras.length);
    setTestResult(null);
    setStreamError(false);
  };

  const activeCamera = cameras[currentIndex] || null;

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto pb-16">
      {/* Top Header & Icon Action Bar (Symbols Over Text Strict Rule) */}
      <div className="flex flex-wrap items-center justify-between gap-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30 text-white">
            <Radio size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-wide">
              {activeCamera ? activeCamera.name : 'EZVIZ Surveillance Feeds'}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex h-3.5 w-3.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${activeCamera?.ip ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${activeCamera?.ip ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <p className="text-slate-400 text-lg font-medium font-mono">
                {activeCamera?.ip ? `${activeCamera.ip}:${activeCamera.port || 554}` : (activeCamera ? 'Awaiting Wi-Fi Setup' : 'Discovering Cameras')}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Icons (Symbols Only with Large Hit Targets) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPairingModal(true)}
            className="p-4 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl border border-indigo-500/30 transition-all duration-200 shadow-md active:scale-95"
            title="Camera Reset & Standalone Pairing Procedure (Ditch Hub)"
          >
            <HelpCircle size={28} />
          </button>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="p-4 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-white rounded-2xl border border-white/10 transition-all duration-200 shadow-md active:scale-95 disabled:opacity-50"
            title="Scan local network for standalone cameras"
          >
            <Search size={28} className={scanning ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => {
              setStreamRefreshKey(Date.now());
              setStreamError(false);
              loadCameras();
            }}
            className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all duration-200 shadow-md active:scale-95"
            title="Refresh camera feeds and reconnect"
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
            title={isGridView ? 'Switch to single feed view' : 'Switch to multi-camera grid view'}
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
            title={isAutoCycle ? 'Pause camera cycle loop' : 'Start camera auto-cycle loop (7s)'}
          >
            {isAutoCycle ? <Pause size={28} /> : <Play size={28} />}
          </button>

          {onNavigateToGallery && (
            <button
              onClick={onNavigateToGallery}
              className="p-4 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl border border-indigo-500/30 transition-all duration-200 shadow-md active:scale-95"
              title="Open Surveillance Recordings & Gallery"
            >
              <Film size={28} />
            </button>
          )}

          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`p-4 rounded-2xl border transition-all duration-200 shadow-md active:scale-95 ${
              showDebug
                ? 'bg-purple-600 text-white border-purple-500 shadow-purple-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-white/10'
            }`}
            title={showDebug ? 'Hide debug diagnostics' : 'Show debug diagnostics and event logs'}
          >
            <Bug size={28} />
          </button>

          <button
            onClick={() => {
              setEditingCamera({
                name: `EZVIZ Camera ${cameras.length + 1}`,
                ip: '192.168.1.',
                port: 554,
                channel: 1,
                stream_path: '/h264/ch1/main/av_stream',
                username: 'admin',
                verification_code: 'C9OEMG'
              });
              setShowEditModal(true);
            }}
            className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl border border-indigo-400 shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-95"
            title="Add a camera manually"
          >
            <Plus size={28} />
          </button>
        </div>
      </div>

      {/* Primary Video Stage */}
      {!isGridView ? (
        <div className="flex flex-col gap-6">
          <div className="relative w-full aspect-video min-h-[520px] max-h-[820px] bg-black/95 rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl flex items-center justify-center group">
            {activeCamera ? (
              <>
                {/* When camera is online with an IP */}
                {activeCamera.ip ? (
                  !streamError ? (
                    <img
                      key={`${activeCamera.id}-${streamRefreshKey}`}
                      src={cameraApi.getStreamUrl(activeCamera.id, streamRefreshKey)}
                      alt={activeCamera.name}
                      className="w-full h-full object-contain"
                      onError={() => setStreamError(true)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <AlertCircle size={56} className="text-amber-400 mb-4 animate-bounce" />
                      <h3 className="text-2xl font-bold text-white mb-2">Connecting to Live Feed...</h3>
                      <p className="text-slate-400 text-lg mb-6 max-w-md">
                        Establishing RTSP TCP connection to {activeCamera.ip}...
                      </p>
                      <button
                        onClick={() => {
                          setStreamError(false);
                          setStreamRefreshKey(Date.now());
                        }}
                        className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-xl transition-all"
                        title="Retry Live Stream"
                      >
                        <RefreshCw size={28} />
                      </button>
                    </div>
                  )
                ) : (
                  /* Camera 4 - Awaiting Pairing / Reset Mode */
                  <div className="flex flex-col items-center justify-center p-8 text-center max-w-xl">
                    <div className="p-6 bg-indigo-600/20 border-2 border-indigo-500/30 rounded-3xl mb-6 shadow-xl text-indigo-400">
                      <Wifi size={56} className="animate-pulse" />
                    </div>
                    <h3 className="text-3xl font-extrabold text-white mb-3">
                      {activeCamera.name} (Awaiting Direct Pairing)
                    </h3>
                    <p className="text-slate-300 text-xl mb-6 leading-relaxed">
                      Verification code <span className="font-mono text-emerald-400 font-bold bg-white/5 px-3 py-1 rounded-xl">{activeCamera.verification_code}</span> is ready.
                      Reset the camera so it pairs directly to your Wi-Fi router instead of through the hub.
                    </p>
                    <button
                      onClick={() => setShowPairingModal(true)}
                      className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center"
                      title="Open Reset & Pairing Procedure"
                    >
                      <HelpCircle size={32} />
                    </button>
                  </div>
                )}

                {/* Left Arrow (Large for Sight) */}
                <button
                  onClick={handlePrevCamera}
                  className="absolute left-6 top-1/2 -translate-y-1/2 p-5 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-full border-2 border-white/20 shadow-2xl transition-all duration-200 active:scale-90 z-20"
                  title="Previous Camera Feed (Left Arrow)"
                >
                  <ChevronLeft size={44} />
                </button>

                {/* Right Arrow (Large for Sight) */}
                <button
                  onClick={handleNextCamera}
                  className="absolute right-6 top-1/2 -translate-y-1/2 p-5 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-full border-2 border-white/20 shadow-2xl transition-all duration-200 active:scale-90 z-20"
                  title="Next Camera Feed (Right Arrow)"
                >
                  <ChevronRight size={44} />
                </button>

                {/* Bottom Floating Control Bar */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-950/85 backdrop-blur-xl border border-white/20 px-6 py-3.5 rounded-full shadow-2xl z-20">
                  <button
                    onClick={() => {
                      setStreamRefreshKey(Date.now());
                      setStreamError(false);
                    }}
                    className="p-3 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
                    title="Reconnect Live Stream"
                  >
                    <RefreshCw size={26} />
                  </button>

                  {activeCamera.ip && (
                    <button
                      onClick={async () => {
                        try {
                          const url = cameraApi.getSnapshotUrl(activeCamera.id, Date.now());
                          window.open(url, '_blank');
                        } catch (e) {
                          alert('Snapshot error: ' + e.message);
                        }
                      }}
                      className="p-3 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
                      title="Capture High Resolution Still Frame"
                    >
                      <CameraIcon size={26} />
                    </button>
                  )}

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
                <h3 className="text-2xl font-bold text-white mb-2">No Standalone Cameras Configured</h3>
                <p className="text-slate-400 text-lg mb-6">Scan your network to detect connected cameras.</p>
                <button
                  onClick={handleScan}
                  className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-xl transition-all"
                  title="Scan for Cameras"
                >
                  <Search size={32} />
                </button>
              </div>
            )}
          </div>

          {/* Quick Camera Selector Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cameras.map((cam, idx) => (
              <button
                key={cam.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setTestResult(null);
                  setStreamError(false);
                }}
                className={`p-5 rounded-3xl border-2 transition-all duration-200 flex items-center justify-between shadow-xl text-left ${
                  currentIndex === idx
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-indigo-600/10'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/10 text-slate-400 hover:text-white'
                }`}
                title={`Switch to ${cam.name} (${cam.ip || 'Pending Pairing'})`}
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
                    <p className="text-base text-slate-400 font-mono">
                      {cam.ip || 'Reset & Pair'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`h-4 w-4 rounded-full ${
                      cam.ip && cam.verification_code ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                    }`}
                    title={cam.ip ? 'Connected' : 'Pending Pairing'}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Grid View (Simultaneous Feeds) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cameras.map((cam, idx) => (
            <div
              key={cam.id}
              onClick={() => {
                setCurrentIndex(idx);
                setIsGridView(false);
                setStreamError(false);
              }}
              className="group relative aspect-video bg-black/95 rounded-3xl overflow-hidden border-2 border-white/10 hover:border-indigo-500 shadow-2xl transition-all cursor-pointer flex items-center justify-center"
              title={`Click to view ${cam.name}`}
            >
              {cam.ip ? (
                <img
                  src={cameraApi.getStreamUrl(cam.id, streamRefreshKey)}
                  alt={cam.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const el = document.getElementById(`grid-err-${cam.id}`);
                    if (el) el.style.display = 'flex';
                  }}
                />
              ) : null}

              <div
                id={`grid-err-${cam.id}`}
                className={`${cam.ip ? 'hidden' : 'flex'} absolute inset-0 flex-col items-center justify-center p-4 bg-slate-900/90 text-center`}
              >
                <Wifi size={40} className="text-indigo-400 mb-2 animate-pulse" />
                <h4 className="text-xl font-bold text-white mb-1">{cam.name}</h4>
                <p className="text-slate-400 text-base font-mono">{cam.ip || 'Awaiting Reset / Pairing'}</p>
              </div>

              <div className="absolute top-4 left-4 flex items-center gap-3 bg-black/75 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                <span className={`h-3 w-3 rounded-full ${cam.ip ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                <span className="text-white font-bold text-lg">{cam.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Diagnostics & Debug Inspector */}
      {showDebug && (
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600 rounded-2xl text-white">
                <Bug size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Diagnostics & RTSP Inspector</h3>
                <p className="text-slate-400 text-base">Real-time socket verification and streaming logs</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => activeCamera && handleTestConnection(activeCamera)}
                disabled={testing || !activeCamera}
                className="p-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
                title="Test active camera RTSP stream"
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

          {/* Test Result Box */}
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
                Camera IP
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {activeCamera?.ip || 'Pending Pairing'}
              </span>
            </div>
            <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
              <span className="text-slate-400 text-base font-bold uppercase tracking-wider block mb-1">
                RTSP Port
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {activeCamera?.port || 554}
              </span>
            </div>
            <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
              <span className="text-slate-400 text-base font-bold uppercase tracking-wider block mb-1">
                Stream Path
              </span>
              <span className="text-lg font-bold font-mono text-indigo-400 truncate block">
                {activeCamera?.stream_path || 'N/A'}
              </span>
            </div>
            <div className="bg-black/40 border border-white/10 p-5 rounded-2xl">
              <span className="text-slate-400 text-base font-bold uppercase tracking-wider block mb-1">
                Verification Code
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {activeCamera?.verification_code || 'Not Set'}
              </span>
            </div>
          </div>

          {/* Event Logs Console */}
          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-base font-bold uppercase tracking-wider">
              Live Backend Event Logs
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

      {/* Camera Reset & Standalone Pairing Guide Modal */}
      {showPairingModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/15 w-full max-w-2xl rounded-3xl p-8 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white">
                  <Wifi size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Reset & Pair Standalone</h3>
                  <p className="text-slate-400 text-base">Procedure to remove cameras from Hub and pair directly</p>
                </div>
              </div>
              <button
                onClick={() => setShowPairingModal(false)}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6 text-slate-200 text-lg leading-relaxed">
              <div className="flex gap-4 items-start bg-white/5 p-5 rounded-2xl border border-white/10">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold shrink-0">1</span>
                <div>
                  <h4 className="font-bold text-white mb-1">Factory Reset the Camera</h4>
                  <p className="text-slate-300">
                    Locate the small rubber flap covering the <strong>RESET button</strong> (next to the microSD slot). While powered on, press and hold the button for <strong>10–15 seconds</strong> until the camera voice announces <em>"Reset successfully"</em> and the status indicator begins flashing blue.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start bg-white/5 p-5 rounded-2xl border border-white/10">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold shrink-0">2</span>
                <div>
                  <h4 className="font-bold text-white mb-1">Join Your Home Network Directly</h4>
                  <p className="text-slate-300">
                    Connect an Ethernet cable directly from your router/switch to the camera, or open the EZVIZ app to join it to your normal Wi-Fi (select <strong>Standalone Device / Camera</strong>, not Hub).
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start bg-white/5 p-5 rounded-2xl border border-white/10">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold shrink-0">3</span>
                <div>
                  <h4 className="font-bold text-white mb-1">One-Click Auto-Bind</h4>
                  <p className="text-slate-300">
                    Once on your home network, click the <strong>Scan</strong> icon in Hubismart. The camera will be discovered automatically, and will bind with its verification code <strong className="font-mono text-emerald-400">C9OEMG</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setShowPairingModal(false);
                  handleScan();
                }}
                className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-xl transition-all flex items-center justify-center"
                title="Trigger Network Scan Now"
              >
                <Search size={28} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Camera Modal */}
      {showEditModal && editingCamera && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-6">
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
                  Verification Code
                </label>
                <input
                  type="text"
                  maxLength={12}
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
