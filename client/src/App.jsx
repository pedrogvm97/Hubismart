import React, { useState, useEffect } from 'react';
import { Home, Zap, Settings, Activity, LayoutGrid, Bell } from 'lucide-react';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const App = () => {
  const [devices, setDevices] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [monitoringData, setMonitoringData] = useState([
    { name: '12:00', power: 45 },
    { name: '13:00', power: 52 },
    { name: '14:00', power: 38 },
    { name: '15:00', power: 65 },
    { name: '16:00', power: 48 },
    { name: '17:00', power: 55 },
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
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
            { id: 'home', icon: LayoutGrid, label: 'Home' },
            { id: 'devices', icon: Home, label: 'Devices' },
            { id: 'automations', icon: Zap, label: 'Automations' },
            { id: 'monitoring', icon: Activity, label: 'Monitoring' },
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
            <p className="text-slate-400">Welcome back to your smart home command center.</p>
          </div>
          <div className="flex gap-4">
            <button className="p-3 glass-card text-slate-400 hover:text-white transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-3 right-3 w-2 h-2 bg-pink-500 rounded-full border-2 border-[#0f172a]"></span>
            </button>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white/10 shadow-lg"></div>
          </div>
        </header>

        {activeTab === 'home' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Stats Cards */}
            {[
              { label: 'Active Devices', value: '12', color: 'indigo' },
              { label: 'Routine Checks', value: '1,240', color: 'emerald' },
              { label: 'Power Usage', value: '2.4 kWh', color: 'amber' },
              { label: 'Alerts', value: '0', color: 'pink' }
            ].map((stat, i) => (
              <div key={i} className="glass-card p-6 border-l-4" style={{ borderColor: `var(--${stat.color}-500)` }}>
                <p className="text-slate-400 text-sm font-medium mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}

            {/* Placeholder for Device Grid */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Favorite Devices</h3>
                <button className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">View All</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="glass-card p-6 flex flex-col gap-4 group cursor-pointer hover:bg-white/10 transition-all duration-300">
                    <div className="flex justify-between items-start">
                      <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 shadow-inner">
                        <Home size={20} />
                      </div>
                      <div className="w-12 h-6 bg-slate-700 rounded-full relative p-1 transition-colors group-hover:bg-indigo-500/30">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-slate-400 rounded-full group-hover:bg-indigo-400 shadow-md"></div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1">Smart Light {i}</h4>
                      <p className="text-slate-500 text-sm">Living Room</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="flex flex-col gap-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Your Devices</h3>
                <p className="text-slate-400">Manage and control all paired hardware.</p>
              </div>
              <button className="premium-button flex items-center gap-2">
                <Zap size={18} />
                Add Group
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Device Card Template */}
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="glass-card p-6 flex flex-col gap-6 hover:bg-white/10 transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400">
                        <Home size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">Smart Plug {i}</h4>
                        <p className="text-slate-500">Living Room • Kitchen</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-bold uppercase tracking-wider">
                      Online
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-xs uppercase font-bold tracking-widest">Power</span>
                      <span className="text-white font-medium">42.5 W</span>
                    </div>
                    <button className="h-10 w-20 bg-slate-800 rounded-full relative p-1 transition-all duration-300 hover:bg-slate-700">
                      <div className="absolute left-1 top-1 w-8 h-8 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/40"></div>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'automations' && (
          <div className="flex flex-col gap-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Automations</h3>
                <p className="text-slate-400">Create powerful rules and schedules.</p>
              </div>
              <button className="premium-button">Create New</button>
            </div>
            <div className="glass-card p-12 flex flex-col items-center text-center gap-4">
              <div className="p-6 bg-indigo-500/10 rounded-full text-indigo-400 mb-2">
                <Zap size={48} />
              </div>
              <h4 className="text-xl font-bold text-white">No Automations Yet</h4>
              <p className="text-slate-400 max-w-sm">The automation engine is being primed. Soon you'll be able to create complex logic using triggers and groups.</p>
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="flex flex-col gap-8">
            <div className="flex justify-between items-center text-white">
              <div>
                <h3 className="text-xl font-bold mb-1">Advanced Monitoring</h3>
                <p className="text-slate-400">Total power consumption and history across all floors.</p>
              </div>
              <div className="flex gap-2">
                {['1h', '6h', '24h', '7d', '30d'].map(time => (
                  <button key={time} className="px-4 py-2 glass-card hover:bg-white/10 text-sm font-medium transition-colors">
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card p-8 min-h-[400px] relative overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <h4 className="text-white font-bold text-lg">Real-time Energy Flux</h4>
                <div className="flex items-center gap-2 text-indigo-400 text-sm">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                  Streaming Live
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monitoringData}>
                    <defs>
                      <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}W`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                      }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="power"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorPower)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Peak Usage', value: '450W', time: '2:15 PM' },
                { label: 'Avg Daily', value: '12.4kWh', status: '+2% from yesterday' },
                { label: 'Most Active', value: 'Kitchen', sub: 'Oven / Dishwasher' }
              ].map((card, i) => (
                <div key={i} className="glass-card p-6">
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-2">{card.label}</p>
                  <p className="text-2xl font-bold text-white mb-1">{card.value}</p>
                  <p className="text-xs text-indigo-400 font-medium">{card.time || card.status || card.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card p-8">
              <h3 className="text-xl font-bold text-white mb-6">Hub Connection</h3>
              <div className="space-y-6">
                <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10 mb-4">
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Simply paste your **Maker API Access Token** below.
                    <br /><span className="text-xs opacity-60">You can also paste the full "Local URL" from Hubitat to auto-detect settings.</span>
                  </p>
                </div>
                <div>
                  <label className="block text-slate-500 text-sm font-medium mb-2">Maker API Token / API Key</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 transition-colors shadow-inner" defaultValue="b22b356d-9474-43b6-adc7-6271fc1c9997" />
                </div>
                <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98]">
                  Connect Hubitat
                </button>
              </div>
            </div>

            <div className="space-y-8">
              <div className="glass-card p-8 bg-indigo-600/5">
                <h3 className="text-xl font-bold text-white mb-4">Floor Plan (Beta)</h3>
                <p className="text-slate-400 mb-6 font-light">Design your home map with multiple floors. Place your devices on the sketch to control them visually.</p>
                <button className="premium-button w-full border border-white/5 shadow-xl">
                  Open Floor Plan Editor
                </button>
              </div>
              <div className="glass-card p-8 bg-slate-800/20">
                <h3 className="text-xl font-bold text-white mb-4">Device Sync</h3>
                <p className="text-slate-400 mb-4 text-sm">Synchronize paired devices from Hubitat into Hubismart groups.</p>
                <div className="flex gap-4">
                  <button className="flex-1 py-3 px-4 glass-card hover:bg-white/10 text-white text-sm font-bold transition-all">Full Resync</button>
                </div>
              </div>

              <div className="glass-card p-8 border-dashed border-2 border-white/5">
                <h3 className="text-xl font-bold text-white mb-4">Backup & Restore</h3>
                <p className="text-slate-400 mb-6 text-sm">Export your configuration (API keys, groups, layout) to a file. Protect it with a password for security.</p>
                <div className="grid grid-cols-2 gap-4">
                  <button className="py-3 px-4 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm font-bold rounded-xl border border-emerald-500/20 transition-all">Export Config</button>
                  <button className="py-3 px-4 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-sm font-bold rounded-xl border border-indigo-500/20 transition-all">Import Config</button>
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
