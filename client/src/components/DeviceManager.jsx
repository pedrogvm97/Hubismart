import React, { useState, useEffect } from 'react';
import {
  Lightbulb,
  ToggleLeft,
  ToggleRight,
  Activity,
  DoorClosed,
  Lock,
  Thermometer,
  Zap,
  RefreshCw,
  Search,
  Code,
  Sliders,
  Check,
  AlertTriangle,
  X,
  Plus,
  Radio,
  Wifi,
  Layers,
  Settings,
  Edit2,
  Cpu,
  Clock,
  Send,
  ShieldCheck,
  Power,
  ChevronRight
} from 'lucide-react';
import { hubApi, roomsApi } from '../api';

const FAMILIES = [
  { id: 'all', name: 'All Devices', icon: Layers },
  { id: 'lights', name: 'Lights & Dimmers', icon: Lightbulb },
  { id: 'switches', name: 'Switches & Outlets', icon: Zap },
  { id: 'motion', name: 'Motion & Sensors', icon: Activity },
  { id: 'contact', name: 'Doors & Contact', icon: DoorClosed },
  { id: 'climate', name: 'Climate & Temp', icon: Thermometer },
  { id: 'locks', name: 'Smart Locks', icon: Lock }
];

const DEFAULT_DRIVER_TEMPLATE = `/**
 *  Custom Hubitat Groovy Driver
 *  Device Driver Template for Hubismart
 */
metadata {
    definition (name: "Custom Zigbee / Z-Wave Driver", namespace: "hubismart", author: "User") {
        capability "Switch"
        capability "Refresh"
        capability "Configuration"

        command "toggle"
    }

    preferences {
        input name: "logEnable", type: "bool", title: "Enable debug logging", defaultValue: true
    }
}

def installed() {
    log.info "Driver installed"
}

def updated() {
    log.info "Driver updated"
}

def parse(String description) {
    log.debug "Parsing: \${description}"
}

def on() {
    log.info "Turn ON"
    sendEvent(name: "switch", value: "on")
}

def off() {
    log.info "Turn OFF"
    sendEvent(name: "switch", value: "off")
}

def refresh() {
    log.info "Refresh requested"
}
`;

const DeviceManager = ({ onNavigateToSettings }) => {
  const [devices, setDevices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [selectedFamily, setSelectedFamily] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [driverModalDevice, setDriverModalDevice] = useState(null);
  const [driverCode, setDriverCode] = useState('');
  const [driverValidation, setDriverValidation] = useState(null);
  const [syncingDriver, setSyncingDriver] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const [editModalDevice, setEditModalDevice] = useState(null);
  const [editForm, setEditForm] = useState({ customName: '', roomId: '' });

  const [automationModalDevice, setAutomationModalDevice] = useState(null);
  const [automations, setAutomations] = useState([]);

  // Pairing State
  const [pairingActive, setPairingActive] = useState(false);
  const [pairingType, setPairingType] = useState('zigbee');
  const [pairingCountdown, setPairingCountdown] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let timer;
    if (pairingCountdown > 0) {
      timer = setTimeout(() => setPairingCountdown(prev => prev - 1), 1000);
    } else if (pairingActive && pairingCountdown === 0) {
      setPairingActive(false);
    }
    return () => clearTimeout(timer);
  }, [pairingCountdown, pairingActive]);

  const loadData = async () => {
    setLoading(true);
    try {
      const config = await hubApi.getConfig();
      setIsConfigured(!!config.configured);

      const devRes = await hubApi.getDevices();
      const list = Array.isArray(devRes) ? devRes : (devRes.devices || []);
      setDevices(list);

      const roomList = await roomsApi.getRooms();
      setRooms(Array.isArray(roomList) ? roomList : []);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshDevices = async () => {
    setRefreshing(true);
    try {
      const devRes = await hubApi.getDevices();
      const list = Array.isArray(devRes) ? devRes : (devRes.devices || []);
      setDevices(list);
    } catch (err) {
      console.error('Error refreshing devices:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const getDeviceFamily = (device) => {
    const type = (device.type || '').toLowerCase();
    const name = (device.name || '').toLowerCase();
    const label = (device.label || '').toLowerCase();
    const str = `${type} ${name} ${label}`;

    if (str.includes('dimmer') || str.includes('light') || str.includes('bulb') || str.includes('rgb')) {
      return 'lights';
    }
    if (str.includes('motion') || str.includes('multi') || str.includes('sensor')) {
      return 'motion';
    }
    if (str.includes('contact') || str.includes('door') || str.includes('window') || str.includes('presence')) {
      return 'contact';
    }
    if (str.includes('thermostat') || str.includes('temp') || str.includes('climate')) {
      return 'climate';
    }
    if (str.includes('lock')) {
      return 'locks';
    }
    if (str.includes('switch') || str.includes('plug') || str.includes('outlet') || str.includes('relay')) {
      return 'switches';
    }
    return 'other';
  };

  const getFamilyIcon = (family) => {
    switch (family) {
      case 'lights': return Lightbulb;
      case 'switches': return Zap;
      case 'motion': return Activity;
      case 'contact': return DoorClosed;
      case 'climate': return Thermometer;
      case 'locks': return Lock;
      default: return Cpu;
    }
  };

  const handleToggleCommand = async (device) => {
    const isCurrentlyOn = device.attributes?.find(a => a.name === 'switch')?.currentValue === 'on';
    const nextCommand = isCurrentlyOn ? 'off' : 'on';
    try {
      await hubApi.sendCommand(device.id, nextCommand);
      // Optimistic update
      setDevices(devices.map(d => {
        if (d.id === device.id) {
          const attrs = (d.attributes || []).map(a => a.name === 'switch' ? { ...a, currentValue: nextCommand } : a);
          return { ...d, attributes: attrs };
        }
        return d;
      }));
    } catch (err) {
      alert('Failed to send command to device: ' + err.message);
    }
  };

  // Driver Editor Modal Handlers
  const openDriverModal = (device) => {
    setDriverModalDevice(device);
    setDriverCode(device.driverCode || DEFAULT_DRIVER_TEMPLATE);
    setDriverValidation(null);
    setSyncResult(null);
  };

  const handleValidateDriver = () => {
    // Client side quick verification
    const errors = [];
    const warnings = [];

    let braces = 0;
    for (const char of driverCode) {
      if (char === '{') braces++;
      if (char === '}') braces--;
    }
    if (braces !== 0) errors.push(`Mismatched curly braces: count difference is ${braces}`);

    if (!driverCode.includes('metadata') || !driverCode.includes('definition')) {
      warnings.push("Missing 'metadata { definition(...) }' block required for Hubitat drivers.");
    }
    if (!driverCode.includes('capability')) {
      warnings.push("No capability definitions found (e.g. capability 'Switch').");
    }
    if (driverCode.includes('physicalgraph.')) {
      warnings.push("Contains 'physicalgraph' references (SmartThings). Hubitat uses native namespace.");
    }

    setDriverValidation({
      valid: errors.length === 0,
      errors,
      warnings
    });
  };

  const handleSyncDriver = async () => {
    if (!driverModalDevice) return;
    setSyncingDriver(true);
    setSyncResult(null);
    try {
      const res = await hubApi.syncDriver({
        deviceId: driverModalDevice.id,
        driverCode: driverCode,
        driverName: driverModalDevice.driverName || driverModalDevice.type
      });

      setSyncResult({ success: true, message: res.message || 'Driver synced successfully!' });
      // Update local state
      setDevices(devices.map(d => d.id === driverModalDevice.id ? { ...d, driverCode } : d));
    } catch (err) {
      setSyncResult({ success: false, message: err.response?.data?.error || err.message });
    } finally {
      setSyncingDriver(false);
    }
  };

  // Edit Device & Assign Room Handlers
  const openEditModal = (device) => {
    setEditModalDevice(device);
    setEditForm({
      customName: device.customName || device.label || device.name,
      roomId: device.roomId || ''
    });
  };

  const handleSaveDeviceMeta = async () => {
    if (!editModalDevice) return;
    try {
      await hubApi.updateDeviceMeta(editModalDevice.id, {
        customName: editForm.customName,
        roomId: editForm.roomId ? parseInt(editForm.roomId) : null
      });

      const assignedRoom = rooms.find(r => r.id === parseInt(editForm.roomId));
      setDevices(devices.map(d => d.id === editModalDevice.id ? {
        ...d,
        customName: editForm.customName,
        roomId: editForm.roomId ? parseInt(editForm.roomId) : null,
        roomName: assignedRoom ? assignedRoom.name : ''
      } : d));

      setEditModalDevice(null);
    } catch (err) {
      alert('Failed to save device settings: ' + err.message);
    }
  };

  // Automations Modal
  const openAutomationModal = (device) => {
    setAutomationModalDevice(device);
    setAutomations(device.automations || []);
  };

  const handleToggleAutoOff = async (minutes) => {
    if (!automationModalDevice) return;
    const existingIndex = automations.findIndex(a => a.type === 'auto_off');
    let nextAutomations = [...automations];
    if (existingIndex >= 0) {
      if (nextAutomations[existingIndex].minutes === minutes) {
        nextAutomations.splice(existingIndex, 1); // remove
      } else {
        nextAutomations[existingIndex].minutes = minutes; // update
      }
    } else {
      nextAutomations.push({ type: 'auto_off', minutes });
    }
    setAutomations(nextAutomations);
    try {
      await hubApi.updateDeviceMeta(automationModalDevice.id, { automations: nextAutomations });
      setDevices(devices.map(d => d.id === automationModalDevice.id ? { ...d, automations: nextAutomations } : d));
    } catch (err) {
      alert('Failed to save automation: ' + err.message);
    }
  };

  // Pairing Trigger
  const triggerPairing = async (type) => {
    try {
      setPairingType(type);
      setPairingActive(true);
      setPairingCountdown(60);
      await hubApi.startPairing(type, 60);
    } catch (err) {
      alert('Failed to start pairing: ' + err.message);
      setPairingActive(false);
    }
  };

  const cancelPairing = async () => {
    try {
      await hubApi.stopPairing();
    } catch (e) {}
    setPairingActive(false);
    setPairingCountdown(0);
  };

  // Filtering
  const filteredDevices = devices.filter(d => {
    const family = getDeviceFamily(d);
    if (selectedFamily !== 'all' && family !== selectedFamily) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (d.customName || '').toLowerCase().includes(q) ||
                    (d.name || '').toLowerCase().includes(q) ||
                    (d.label || '').toLowerCase().includes(q) ||
                    (d.type || '').toLowerCase().includes(q) ||
                    (d.roomName || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Top Banner / Device Discovery & Pairing Bar */}
      <div className="glass-card p-6 lg:p-8 rounded-3xl border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="p-5 bg-indigo-600/30 text-indigo-300 rounded-2xl border border-indigo-500/30 shadow-lg">
            <Cpu size={36} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Connected Devices ({devices.length})
            </h2>
            <p className="text-slate-400 text-lg">
              Hubitat Maker API & Driver Synchronization Manager
            </p>
          </div>
        </div>

        {/* Action Controls - Pure Icons (Symbols Over Text Rule) */}
        <div className="flex items-center gap-3">
          {/* Zigbee Pairing Button */}
          <button
            onClick={() => triggerPairing('zigbee')}
            disabled={pairingActive}
            className={`p-4 rounded-2xl font-bold transition-all shadow-xl active:scale-95 flex items-center justify-center ${
              pairingActive && pairingType === 'zigbee'
                ? 'bg-amber-600 text-white animate-pulse'
                : 'bg-slate-900/80 border border-white/10 hover:border-indigo-500 text-slate-200 hover:text-white'
            }`}
            title="Start Zigbee Device Pairing (60s Discovery)"
          >
            <Radio size={28} className={pairingActive ? 'animate-spin' : ''} />
          </button>

          {/* Z-Wave Inclusion Button */}
          <button
            onClick={() => triggerPairing('zwave_include')}
            disabled={pairingActive}
            className="p-4 bg-slate-900/80 border border-white/10 hover:border-indigo-500 text-slate-200 hover:text-white rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center"
            title="Start Z-Wave Device Inclusion"
          >
            <Wifi size={28} />
          </button>

          {/* Refresh Devices Button */}
          <button
            onClick={refreshDevices}
            disabled={refreshing}
            className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-xl shadow-indigo-600/30 active:scale-95 flex items-center justify-center"
            title="Refresh All Devices from Hubitat"
          >
            <RefreshCw size={28} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Active Pairing Alert Banner */}
      {pairingActive && (
        <div className="p-6 bg-amber-500/20 border-2 border-amber-500/40 rounded-3xl flex items-center justify-between shadow-2xl animate-fade-in">
          <div className="flex items-center gap-4">
            <Radio size={32} className="text-amber-400 animate-ping" />
            <div>
              <h4 className="text-2xl font-black text-amber-200">
                {pairingType === 'zigbee' ? 'Zigbee Discovery Active' : 'Z-Wave Inclusion Active'}
              </h4>
              <p className="text-amber-300 text-base font-medium">
                Put your device into pairing mode now. Time remaining: {pairingCountdown}s
              </p>
            </div>
          </div>
          <button
            onClick={cancelPairing}
            className="p-4 bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white rounded-2xl transition-all"
            title="Cancel Pairing Mode"
          >
            <X size={26} />
          </button>
        </div>
      )}

      {/* Not Configured Alert */}
      {!isConfigured && (
        <div className="glass-card p-8 rounded-3xl border border-rose-500/30 bg-rose-500/10 shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AlertTriangle size={36} className="text-rose-400" />
            <div>
              <h3 className="text-2xl font-bold text-white">Hubitat Not Connected</h3>
              <p className="text-slate-300 text-lg">Please configure your Hubitat IP and Maker API token in System Settings.</p>
            </div>
          </div>
          <button
            onClick={onNavigateToSettings}
            className="p-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center"
            title="Open System Settings to Configure Hubitat"
          >
            <Settings size={28} />
          </button>
        </div>
      )}

      {/* Family / Type Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Family Pills - Large Hit Targets */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 no-scrollbar">
          {FAMILIES.map((family) => {
            const Icon = family.icon;
            const count = family.id === 'all' 
              ? devices.length 
              : devices.filter(d => getDeviceFamily(d) === family.id).length;

            return (
              <button
                key={family.id}
                onClick={() => setSelectedFamily(family.id)}
                className={`px-5 py-3.5 rounded-2xl font-bold text-base transition-all flex items-center gap-3 shrink-0 active:scale-95 shadow-md ${
                  selectedFamily === family.id
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30 border border-indigo-400'
                    : 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
                title={`Filter by ${family.name}`}
              >
                <Icon size={24} />
                <span>{family.name}</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-black/40 text-xs font-mono">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search devices or rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/60 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white text-base focus:outline-none focus:border-indigo-500 transition-all font-medium"
          />
        </div>
      </div>

      {/* Devices Grid */}
      {loading ? (
        <div className="p-16 text-center glass-card rounded-3xl border border-white/10">
          <RefreshCw size={48} className="mx-auto text-indigo-400 animate-spin mb-4" />
          <p className="text-xl text-slate-300 font-bold">Loading devices from Hubitat...</p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="p-16 text-center glass-card rounded-3xl border border-white/10">
          <Cpu size={56} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">No Devices Found</h3>
          <p className="text-slate-400 text-lg mb-6">
            {searchQuery 
              ? 'No devices match your search query.' 
              : 'No devices found in this family or Maker API device list is empty.'}
          </p>
          <button
            onClick={refreshDevices}
            className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg active:scale-95 inline-flex items-center justify-center"
            title="Refresh Devices"
          >
            <RefreshCw size={26} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDevices.map((device) => {
            const family = getDeviceFamily(device);
            const FamilyIcon = getFamilyIcon(family);
            const isSwitch = device.capabilities?.includes('Switch');
            const switchAttr = device.attributes?.find(a => a.name === 'switch');
            const isOn = switchAttr?.currentValue === 'on';
            const tempAttr = device.attributes?.find(a => a.name === 'temperature');
            const batteryAttr = device.attributes?.find(a => a.name === 'battery');

            return (
              <div
                key={device.id}
                className="glass-card p-6 rounded-3xl border border-white/10 hover:border-white/25 transition-all shadow-xl flex flex-col justify-between gap-6 group"
              >
                {/* Header: Icon, Name, and Room */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl shadow-md ${
                      isOn 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                        : 'bg-slate-900/80 text-slate-400 border border-white/10'
                    }`}>
                      <FamilyIcon size={32} />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-white tracking-tight leading-tight">
                        {device.customName || device.label || device.name}
                      </h4>
                      <p className="text-slate-400 text-sm font-mono mt-0.5">
                        ID: {device.id} • {device.name}
                      </p>
                    </div>
                  </div>

                  {/* Power Toggle Button (if switch capable) */}
                  {isSwitch && (
                    <button
                      onClick={() => handleToggleCommand(device)}
                      className={`p-3.5 rounded-2xl transition-all shadow-lg active:scale-90 ${
                        isOn
                          ? 'bg-amber-500 text-slate-950 shadow-amber-500/30'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title={isOn ? 'Turn Device OFF' : 'Turn Device ON'}
                    >
                      <Power size={26} />
                    </button>
                  )}
                </div>

                {/* Badges: Assigned Room & Current Driver */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                  {/* Room Tag */}
                  <span className="px-3.5 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-sm font-semibold">
                    {device.roomName || 'Unassigned Room'}
                  </span>

                  {/* Driver Tag */}
                  <span className="px-3 py-1.5 bg-slate-900/80 text-slate-300 border border-white/10 rounded-xl text-xs font-mono truncate max-w-[180px]" title={`Driver: ${device.type}`}>
                    {device.type}
                  </span>

                  {/* Live Telemetry Badges */}
                  {tempAttr && (
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-xl text-xs font-bold">
                      {tempAttr.currentValue}°C
                    </span>
                  )}
                  {batteryAttr && (
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs font-bold">
                      {batteryAttr.currentValue}%
                    </span>
                  )}
                </div>

                {/* Footer Action Icons - Pure Icons (Symbols Over Text Rule) */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    {/* Edit Name & Room */}
                    <button
                      onClick={() => openEditModal(device)}
                      className="p-3 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-white/5 transition-all active:scale-95"
                      title="Edit Custom Name & Assign to Room"
                    >
                      <Edit2 size={20} />
                    </button>

                    {/* Driver Inspector & Code Editor */}
                    <button
                      onClick={() => openDriverModal(device)}
                      className="p-3 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl border border-indigo-500/20 transition-all active:scale-95"
                      title="Inspect & Edit Groovy Driver Code"
                    >
                      <Code size={20} />
                    </button>

                    {/* Automations */}
                    <button
                      onClick={() => openAutomationModal(device)}
                      className="p-3 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-xl border border-purple-500/20 transition-all active:scale-95"
                      title="Configure Device Automations"
                    >
                      <Sliders size={20} />
                    </button>
                  </div>

                  {/* Device Status indicator */}
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <span className="text-xs text-slate-400 font-mono font-medium">Ready</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Driver Code Editor Modal */}
      {driverModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card w-full max-w-4xl p-8 rounded-3xl border border-white/20 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600/30 text-indigo-300 rounded-2xl">
                  <Code size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    Driver Code Editor: {driverModalDevice.customName || driverModalDevice.name}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Current Hub Driver: <span className="font-mono text-indigo-300">{driverModalDevice.type}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDriverModalDevice(null)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-all"
                title="Close Driver Editor"
              >
                <X size={24} />
              </button>
            </div>

            {/* Validation Notice Banner */}
            {driverValidation && (
              <div className={`p-4 rounded-2xl border ${
                driverValidation.valid 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-center gap-3 font-bold mb-1">
                  {driverValidation.valid ? <ShieldCheck size={22} /> : <AlertTriangle size={22} />}
                  <span>{driverValidation.valid ? 'Syntax & Structural Checks Passed' : 'Compatibility Issues Detected'}</span>
                </div>
                {driverValidation.errors.length > 0 && (
                  <ul className="list-disc list-inside text-sm mt-1 space-y-0.5">
                    {driverValidation.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                )}
                {driverValidation.warnings.length > 0 && (
                  <ul className="list-disc list-inside text-sm mt-1 space-y-0.5 text-amber-300">
                    {driverValidation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Code Sync Result Banner */}
            {syncResult && (
              <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
                syncResult.success 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200' 
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-200'
              }`}>
                {syncResult.success ? <Check size={24} /> : <AlertTriangle size={24} />}
                <span className="font-semibold">{syncResult.message}</span>
              </div>
            )}

            {/* Code Textarea Editor */}
            <div>
              <label className="block text-slate-400 text-sm font-bold uppercase mb-2">Groovy Driver Code</label>
              <textarea
                rows="16"
                value={driverCode}
                onChange={(e) => {
                  setDriverCode(e.target.value);
                  setDriverValidation(null);
                }}
                className="w-full bg-slate-950/90 border border-white/10 rounded-2xl p-5 text-indigo-100 font-mono text-sm focus:outline-none focus:border-indigo-500 leading-relaxed transition-all shadow-inner"
                placeholder="Paste or write Hubitat Groovy driver code here..."
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                onClick={handleValidateDriver}
                className="px-6 py-4 bg-slate-900 border border-white/10 hover:border-indigo-400 text-white font-bold rounded-2xl transition-all shadow-md active:scale-95"
                title="Verify Code Compatibility"
              >
                Validate Compatibility
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDriverModalDevice(null)}
                  className="px-6 py-4 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold rounded-2xl transition-all"
                  title="Cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSyncDriver}
                  disabled={syncingDriver}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-2xl shadow-xl shadow-indigo-600/30 transition-all active:scale-95 flex items-center gap-3"
                  title="Save Code and Sync with Hubitat"
                >
                  {syncingDriver ? <RefreshCw size={22} className="animate-spin" /> : <Send size={22} />}
                  <span>Sync to Hubitat</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Device Meta & Room Modal */}
      {editModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card w-full max-w-lg p-8 rounded-3xl border border-white/20 shadow-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-2xl font-bold text-white">Edit Device Details</h3>
              <button
                onClick={() => setEditModalDevice(null)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm font-bold uppercase mb-2">Custom Display Name</label>
                <input
                  type="text"
                  value={editForm.customName}
                  onChange={(e) => setEditForm({ ...editForm, customName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg focus:outline-none focus:border-indigo-500 font-semibold"
                  placeholder="e.g. Master Bedroom Ceiling Light"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm font-bold uppercase mb-2">Assign to Room</label>
                <select
                  value={editForm.roomId}
                  onChange={(e) => setEditForm({ ...editForm, roomId: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="">No Room Assigned</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setEditModalDevice(null)}
                className="px-6 py-4 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-2xl"
                title="Cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDeviceMeta}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl active:scale-95"
                title="Save Changes"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Automations Modal */}
      {automationModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card w-full max-w-lg p-8 rounded-3xl border border-white/20 shadow-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-600/30 text-purple-300 rounded-2xl">
                  <Sliders size={26} />
                </div>
                <h3 className="text-2xl font-bold text-white">Automations</h3>
              </div>
              <button
                onClick={() => setAutomationModalDevice(null)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-bold text-slate-200">
                Auto Turn-Off Inactivity Timer
              </h4>
              <p className="text-slate-400 text-sm">
                Automatically switches off the device after a set period of time:
              </p>
              <div className="grid grid-cols-4 gap-3">
                {[5, 15, 30, 60].map((mins) => {
                  const isActive = automations.some(a => a.type === 'auto_off' && a.minutes === mins);
                  return (
                    <button
                      key={mins}
                      onClick={() => handleToggleAutoOff(mins)}
                      className={`p-4 rounded-2xl font-bold text-lg border transition-all active:scale-95 flex flex-col items-center justify-center gap-1 ${
                        isActive
                          ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30'
                          : 'bg-slate-900/80 border-white/10 text-slate-300 hover:text-white'
                      }`}
                      title={`Toggle ${mins} minutes auto-off timer`}
                    >
                      <Clock size={22} />
                      <span>{mins}m</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-white/10">
              <button
                onClick={() => setAutomationModalDevice(null)}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl"
                title="Done"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceManager;
