import React, { useState, useEffect } from 'react';
import { Video, Home, Zap, Settings, Activity, LayoutGrid, Bell, RefreshCw, Film, GitBranch, Cpu, ShieldCheck } from 'lucide-react';
import CameraViewer from './components/CameraViewer';
import GalleryViewer from './components/GalleryViewer';
import VersionManager from './components/VersionManager';
import RoomGridCreator from './components/RoomGridCreator';
import DeviceManager from './components/DeviceManager';

const App = () => {
  const [activeTab, setActiveTab] = useState('cameras');
  const [hubConfig, setHubConfig] = useState({ ip: '', appId: '', token: '', hubUsername: '', hubPassword: '' });
  const [isEditing, setIsEditing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [backupPassword, setBackupPassword] = useState('');
  const [appVersion, setAppVersion] = useState('v1.0.11');

  useEffect(() => {
    // Fetch persisted hubitat configuration on startup
    (async () => {
      try {
        const res = await fetch('/api/config/hubitat');
        const data = await res.json();
        if (data.configured) {
          setHubConfig(prev => ({
            ...prev,
            ip: data.ip || '',
            appId: data.appId || '',
            token: data.token || '',
            hubUsername: data.hubUsername || ''
          }));
          setConnectionStatus('success');
          setIsEditing(false);
        }
      } catch (e) {
        console.warn('Failed to load initial hubitat config:', e);
      }

      try {
        const vRes = await fetch('/api/system/version');
        const vData = await vRes.json();
        if (vData?.currentVersion) {
          setAppVersion(vData.currentVersion);
        }
      } catch (e) {}
    })();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f1d] text-slate-100 text-lg">
      {/* Sidebar - Pure Icons (Symbols Over Text Strict Rule) with Large Hit Targets & No-Scrollbar Overflow Protection */}
      <aside className="w-24 glass-card my-4 ml-4 flex flex-col items-center py-6 px-2.5 rounded-3xl border border-white/10 shadow-2xl flex-shrink-0 max-h-[calc(100vh-2rem)] overflow-y-auto no-scrollbar justify-between gap-6">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Logo / Branding */}
          <div 
            onClick={() => setActiveTab('settings')}
            className="flex items-center justify-center p-2.5 bg-slate-900/80 rounded-2xl border border-white/10 shadow-xl cursor-pointer hover:scale-105 transition-transform shrink-0" 
            title="Homearr Settings & System"
          >
            <img
              src="/logo.png"
              alt="Homearr"
              className="w-12 h-12 object-contain drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]"
              onError={(e) => { e.target.src = '/logo.svg'; }}
            />
          </div>

          {/* Navigation Controls - Strict Symbols Only */}
          <nav className="flex flex-col gap-3.5 w-full items-center">
            {[
              { id: 'cameras', icon: Video, title: 'EZVIZ Live Camera Feeds' },
              { id: 'gallery', icon: Film, title: 'Surveillance Recordings & Gallery' },
              { id: 'dashboard', icon: LayoutGrid, title: 'Dashboard' },
              { id: 'home', icon: Home, title: 'Home Overview & Room Grid Creator' },
              { id: 'devices', icon: Activity, title: 'Connected Devices & Drivers' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-14 h-14 rounded-2xl transition-all duration-200 flex items-center justify-center flex-shrink-0 active:scale-95 shadow-md ${
                  activeTab === item.id
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30 border border-indigo-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
                title={item.title}
              >
                <item.icon size={28} />
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom Settings Navigation Icon */}
        <div className="w-full flex justify-center shrink-0 pt-2 border-t border-white/10">
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-14 h-14 rounded-2xl transition-all duration-200 flex items-center justify-center flex-shrink-0 active:scale-95 shadow-md ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-indigo-600/30 border border-indigo-400'
                : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
            title="System Settings & Version Manager"
          >
            <Settings size={28} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="Homearr Logo"
              className="w-16 h-16 object-contain drop-shadow-[0_0_12px_rgba(99,102,241,0.4)]"
              onError={(e) => { e.target.src = '/logo.svg'; }}
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-extrabold text-white tracking-tight">Homearr</h1>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-3.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-mono font-bold text-base rounded-xl border border-indigo-500/30 transition-colors cursor-pointer"
                  title="View Version Status & Updates in Settings"
                >
                  {appVersion}
                </button>
              </div>
              <p className="text-slate-400 text-xl font-medium">Smart Home & Surveillance Manager</p>
            </div>
          </div>

          {/* Top Right Controls - Releases page icon removed per user request */}
          <div className="flex items-center gap-4">
            {/* Hubitat Live Connection Status Badge */}
            <div
              className={`px-4 py-2.5 rounded-2xl border flex items-center gap-2.5 text-base font-bold shadow-lg transition-all ${
                connectionStatus === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
              title={connectionStatus === 'success' ? 'Hubitat Maker API Connected' : 'Hubitat Maker API Disconnected'}
            >
              <span className={`w-3 h-3 rounded-full ${
                connectionStatus === 'success' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-400'
              }`} />
              <span>{connectionStatus === 'success' ? 'Hubitat Online' : 'Hubitat Offline'}</span>
            </div>

            <button
              className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95"
              title="Notifications"
            >
              <Bell size={26} />
            </button>
          </div>
        </header>

        {/* Tab Views */}
        {activeTab === 'cameras' && <CameraViewer onNavigateToGallery={() => setActiveTab('gallery')} />}
        {activeTab === 'gallery' && <GalleryViewer />}

        {activeTab === 'dashboard' && (
          <div className="p-8 bg-slate-900/60 border border-white/10 rounded-3xl text-center">
            <h3 className="text-2xl font-bold text-white mb-2">Dashboard</h3>
            <p className="text-slate-400">Overview metrics, automation triggers, and room status</p>
          </div>
        )}

        {/* Home Rooms Grid Creator */}
        {activeTab === 'home' && <RoomGridCreator />}

        {/* Connected Devices & Driver Synchronizer */}
        {activeTab === 'devices' && (
          <DeviceManager onNavigateToSettings={() => setActiveTab('settings')} />
        )}

        {/* Settings Tab - Includes Version Manager & System Configs */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-10">
            <VersionManager />

            <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">Hubitat Connection</h3>
                  <p className="text-slate-400 text-sm mt-1">Configure Maker API and Hub Admin credentials</p>
                </div>
                {!isEditing && connectionStatus === 'success' && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl hover:bg-indigo-600/30"
                    title="Edit Hubitat Settings"
                  >
                    <Settings size={22} />
                  </button>
                )}
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-widest">Hub IP Address</label>
                    <input
                      disabled={!isEditing}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-all font-mono"
                      value={hubConfig.ip}
                      onChange={(e) => setHubConfig({ ...hubConfig, ip: e.target.value })}
                      placeholder="e.g. 192.168.1.65"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-widest">Maker App ID</label>
                    <input
                      disabled={!isEditing}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-all font-mono"
                      value={hubConfig.appId}
                      onChange={(e) => setHubConfig({ ...hubConfig, appId: e.target.value })}
                      placeholder="e.g. 119"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-widest">Maker API Access Token</label>
                  <input
                    type="password"
                    disabled={!isEditing}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-all font-mono"
                    value={hubConfig.token}
                    onChange={(e) => setHubConfig({ ...hubConfig, token: e.target.value })}
                    placeholder="Enter Maker API token"
                  />
                </div>

                {/* Hub Administrative Credentials (Optional for local pairing & driver upload) */}
                <div className="pt-2 border-t border-white/10">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block mb-3">
                    Hubitat Admin Access (Optional - for local pairing & driver uploads)
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs font-bold mb-1.5 uppercase">Hub Admin Username</label>
                      <input
                        disabled={!isEditing}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-mono"
                        value={hubConfig.hubUsername}
                        onChange={(e) => setHubConfig({ ...hubConfig, hubUsername: e.target.value })}
                        placeholder="admin email/user"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs font-bold mb-1.5 uppercase">Hub Admin Password</label>
                      <input
                        type="password"
                        disabled={!isEditing}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-mono"
                        value={hubConfig.hubPassword}
                        onChange={(e) => setHubConfig({ ...hubConfig, hubPassword: e.target.value })}
                        placeholder="hub password"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    setConnectionStatus('loading');
                    try {
                      const response = await fetch('/api/config/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(hubConfig)
                      });
                      const data = await response.json();
                      if (data.success) {
                        setConnectionStatus('success');
                        setIsEditing(false);
                        alert(`Connection Successful! ${data.deviceCount !== undefined ? `${data.deviceCount} devices found.` : ''}`);
                      } else {
                        setConnectionStatus('error');
                        alert(data.error || 'Connection Failed');
                      }
                    } catch (e) {
                      setConnectionStatus('error');
                      alert('Network Error');
                    }
                  }}
                  className={`w-full py-5 rounded-2xl font-bold text-xl transition-all active:scale-[0.98] ${
                    connectionStatus === 'success' && !isEditing
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 shadow-lg'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/25'
                  }`}
                  disabled={connectionStatus === 'loading'}
                  title="Verify and Persist Hubitat Connection"
                >
                  {connectionStatus === 'loading' ? 'Verifying...' : connectionStatus === 'success' && !isEditing ? 'Connected & Persisted' : 'Verify & Save Connection'}
                </button>
              </div>
            </div>

            {/* Configuration Persistence Card */}
            <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-xl">
              <h3 className="text-2xl font-bold text-white mb-6">Configuration Persistence</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-widest">Backup Encryption Password</label>
                  <input
                    type="password"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg focus:outline-none focus:border-indigo-500 transition-all font-mono"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={async () => {
                      if (!backupPassword) return alert('Enter a password for the backup file.');
                      try {
                        const res = await fetch('/api/config/export', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ password: backupPassword })
                        });
                        const data = await res.json();
                        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `hubismart-config-${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                      } catch (e) {
                        alert('Export failed');
                      }
                    }}
                    className="py-5 bg-emerald-600/20 text-emerald-400 font-bold text-xl rounded-2xl border border-emerald-500/20 hover:bg-emerald-600/30 transition-all active:scale-[0.98]"
                    title="Export Backup"
                  >
                    Export
                  </button>
                  <button
                    onClick={async () => {
                      if (!backupPassword) return alert('Enter the password for this file.');
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.onchange = async (e) => {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = async (re) => {
                          const encryptedData = JSON.parse(re.target.result);
                          try {
                            const res = await fetch('/api/config/import', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ encryptedData, password: backupPassword })
                            });
                            const data = await res.json();
                            if (data.success) {
                              alert('Configuration imported successfully!');
                              if (data.hubHint) {
                                setHubConfig({ ip: data.hubHint.ip, appId: data.hubHint.appId, token: data.hubHint.token, hubUsername: '', hubPassword: '' });
                                setConnectionStatus('success');
                                setIsEditing(false);
                              }
                            } else {
                              alert(data.error || 'Import failed');
                            }
                          } catch (e) {
                            alert('Network Error');
                          }
                        };
                        reader.readAsText(file);
                      };
                      input.click();
                    }}
                    className="py-5 bg-indigo-600/20 text-indigo-400 font-bold text-xl rounded-2xl border border-indigo-500/20 hover:bg-indigo-600/30 transition-all active:scale-[0.98]"
                    title="Import Backup"
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
