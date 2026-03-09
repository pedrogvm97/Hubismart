import React, { useState, useEffect } from 'react';
import { Home, Zap, Settings, Activity, LayoutGrid, Bell } from 'lucide-react';

const App = () => {
  const [devices, setDevices] = useState([]);
  const [activeTab, setActiveTab] = useState('home');

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

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card p-8">
              <h3 className="text-xl font-bold text-white mb-6">Hub Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-500 text-sm font-medium mb-2">Hubitat IP Address</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" defaultValue="192.168.1.128:65" />
                </div>
                <div>
                  <label className="block text-slate-500 text-sm font-medium mb-2">Maker API App ID</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="123" />
                </div>
                <div>
                  <label className="block text-slate-500 text-sm font-medium mb-2">Access Token</label>
                  <input type="password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="••••••••" />
                </div>
                <button className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] mt-4">Save Configuration</button>
              </div>
            </div>

            <div className="glass-card p-8 bg-indigo-600/5">
              <h3 className="text-xl font-bold text-white mb-4">Floor Plan (Beta)</h3>
              <p className="text-slate-400 mb-6">Design your home sketch here. You can add multiple floors and place devices directly on the map.</p>
              <button className="premium-button w-full">Launch Sketcher</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
