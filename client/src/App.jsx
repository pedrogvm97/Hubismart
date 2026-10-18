import React, { useState } from 'react';
import { Video, Home, Zap, Settings, Activity, LayoutGrid, Bell, RefreshCw, Film } from 'lucide-react';
import CameraViewer from './components/CameraViewer';
import GalleryViewer from './components/GalleryViewer';

const App = () => {
  const [activeTab, setActiveTab] = useState('cameras');
  const [hubConfig, setHubConfig] = useState({ ip: '', appId: '', token: '' });
  const [isEditing, setIsEditing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [backupPassword, setBackupPassword] = useState('');

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f1d] text-slate-100 text-lg">
      {/* Sidebar - Pure Icons (Symbols Over Text Strict Rule) with Large Hit Targets */}
      <aside className="w-24 glass-card m-4 mr-0 flex flex-col items-center py-8 px-3 gap-8 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-center p-3.5 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/30" title="Hubismart Central">
          <Zap className="text-white" size={32} />
        </div>

        <nav className="flex flex-col gap-4 w-full items-center">
          {[
            { id: 'cameras', icon: Video, title: 'EZVIZ Live Camera Feeds' },
            { id: 'gallery', icon: Film, title: 'Surveillance Recordings & Gallery' },
            { id: 'dashboard', icon: LayoutGrid, title: 'Dashboard' },
            { id: 'home', icon: Home, title: 'Home Overview' },
            { id: 'devices', icon: Activity, title: 'Connected Devices' },
            { id: 'settings', icon: Settings, title: 'System Settings' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-4 rounded-2xl transition-all duration-200 flex items-center justify-center active:scale-95 shadow-md ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white shadow-indigo-600/30 border border-indigo-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title={item.title}
            >
              <item.icon size={30} />
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Hubismart</h1>
            <p className="text-slate-400 text-xl font-medium">Smart Home & Surveillance Manager</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95"
              title="Notifications"
            >
              <Bell size={26} />
            </button>
            <div
              className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white/20 shadow-xl flex items-center justify-center"
              title="System Profile"
            >
              <Zap size={24} className="text-white" />
            </div>
          </div>
        </header>

        {/* Tab Views */}
        {activeTab === 'cameras' && <CameraViewer onNavigateToGallery={() => setActiveTab('gallery')} />}
        {activeTab === 'gallery' && <GalleryViewer />}

        {activeTab === 'dashboard' && (
          <div className="p-8 bg-slate-900/60 border border-white/10 rounded-3xl text-center">
            <h3 className="text-2xl font-bold text-white mb-2">Dashboard</h3>
            <p className="text-slate-400">Overview metrics and shortcuts</p>
          </div>
        )}

        {activeTab === 'home' && (
          <div className="p-8 bg-slate-900/60 border border-white/10 rounded-3xl text-center">
            <h3 className="text-2xl font-bold text-white mb-2">Home Rooms</h3>
            <p className="text-slate-400">Room management and zones</p>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="flex flex-col gap-6">
            <div className="flex gap-4 border-b border-white/10 pb-3">
              <button
                className="text-white font-bold border-b-4 border-indigo-500 px-6 py-3 text-xl hover:bg-white/5 transition-all"
                title="View added devices"
              >
                Added Devices
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="glass-card p-8 rounded-3xl border border-white/10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">Hubitat Connection</h3>
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
                    <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-widest">Hub IP</label>
                    <input
                      disabled={!isEditing}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-all font-mono"
                      value={hubConfig.ip}
                      onChange={(e) => setHubConfig({ ...hubConfig, ip: e.target.value })}
                      placeholder="e.g. 192.168.1.65"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-widest">App ID</label>
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
                  <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-widest">Access Token</label>
                  <input
                    type="password"
                    disabled={!isEditing}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-all font-mono"
                    value={hubConfig.token}
                    onChange={(e) => setHubConfig({ ...hubConfig, token: e.target.value })}
                    placeholder="Enter token from Maker API"
                  />
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
                  title="Verify Hubitat Connection"
                >
                  {connectionStatus === 'loading' ? 'Verifying...' : connectionStatus === 'success' && !isEditing ? 'Connected' : 'Verify Connection'}
                </button>
              </div>
            </div>

            <div className="glass-card p-8 rounded-3xl border border-white/10">
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
                                setHubConfig({ ip: data.hubHint.ip, appId: data.hubHint.appId, token: data.hubHint.token });
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
