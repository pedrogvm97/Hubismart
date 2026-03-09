import React, { useState } from 'react';
import { Home, Zap, Settings, Activity, LayoutGrid, Bell } from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('settings');
  const [hubConfig, setHubConfig] = useState({ ip: '', appId: '', token: '' });
  const [isEditing, setIsEditing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('idle'); // idle, loading, success, error
  const [backupPassword, setBackupPassword] = useState('');

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a] text-slate-200">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 glass-card m-4 mr-0 flex flex-col items-center lg:items-start py-8 px-4 gap-8">
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <Zap className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold hidden lg:block bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Hubismart</h1>
        </div>

        <nav className="flex flex-col gap-2 w-full">
          {[
            { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard' },
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'automation', icon: Zap, label: 'Automation' },
            { id: 'devices', icon: Activity, label: 'Devices' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group ${activeTab === item.id
                ? 'bg-white/10 text-white shadow-inner shadow-white/5'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <item.icon size={22} className={activeTab === item.id ? 'text-indigo-400' : 'group-hover:text-indigo-400'} />
              <span className="hidden lg:block font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 capitalize">{activeTab}</h2>
            <p className="text-slate-400">Hubismart Control Interface</p>
          </div>
          <div className="flex gap-4">
            <button className="p-3 glass-card text-slate-400 hover:text-white transition-colors">
              <Bell size={20} />
            </button>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white/10 shadow-lg"></div>
          </div>
        </header>

        {activeTab === 'dashboard' && null}
        {activeTab === 'home' && null}
        {activeTab === 'automation' && null}

        {activeTab === 'devices' && (
          <div className="flex flex-col gap-6">
            <div className="flex gap-4 border-b border-white/5 pb-2">
              <button className="text-white font-bold border-b-2 border-indigo-500 px-4 py-2 hover:bg-white/5 transition-all">Added Devices</button>
              <button className="text-slate-400 hover:text-white px-4 py-2 hover:bg-white/5 transition-all">New Devices</button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="glass-card p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Hubitat Connection</h3>
                {!isEditing && connectionStatus === 'success' && (
                  <button onClick={() => setIsEditing(true)} className="text-indigo-400 text-sm font-bold hover:text-indigo-300 transition-colors">Edit</button>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 text-xs font-bold mb-2 uppercase tracking-widest">Hub IP</label>
                    <input
                      disabled={!isEditing}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 transition-all font-mono"
                      value={hubConfig.ip}
                      onChange={(e) => setHubConfig({ ...hubConfig, ip: e.target.value })}
                      placeholder="e.g. 192.168.1.65"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-xs font-bold mb-2 uppercase tracking-widest">App ID</label>
                    <input
                      disabled={!isEditing}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 transition-all font-mono"
                      value={hubConfig.appId}
                      onChange={(e) => setHubConfig({ ...hubConfig, appId: e.target.value })}
                      placeholder="e.g. 119"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-2 uppercase tracking-widest">Access Token</label>
                  <input
                    type="password"
                    disabled={!isEditing}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 transition-all font-mono"
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
                  className={`w-full py-4 rounded-xl font-bold transition-all active:scale-[0.98] ${connectionStatus === 'success' && !isEditing
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25'
                    }`}
                  disabled={connectionStatus === 'loading'}
                >
                  {connectionStatus === 'loading' ? 'Verifying...' : connectionStatus === 'success' && !isEditing ? 'Success!' : 'Verify Connection'}
                </button>
                {isEditing && hubConfig.ip && (
                  <button onClick={() => setIsEditing(false)} className="w-full py-2 text-slate-500 text-sm hover:text-white transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="glass-card p-8 border-dashed border-2 border-white/5">
              <h3 className="text-xl font-bold text-white mb-6">Configuration Persistence</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-2 uppercase tracking-widest">Export/Import Password</label>
                  <input
                    type="password"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-mono"
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
                    className="py-4 bg-emerald-600/20 text-emerald-400 font-bold rounded-xl border border-emerald-500/20 hover:bg-emerald-600/30 transition-all active:scale-[0.98]"
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
                    className="py-4 bg-indigo-600/20 text-indigo-400 font-bold rounded-xl border border-indigo-500/20 hover:bg-indigo-600/30 transition-all active:scale-[0.98]"
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
