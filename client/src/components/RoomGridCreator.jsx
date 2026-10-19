import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  RotateCw,
  Maximize2,
  Save,
  Grid,
  Layers,
  DoorOpen,
  Home,
  Check,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Move,
  Palette,
  RefreshCw
} from 'lucide-react';
import { floorPlanApi, roomsApi, hubApi } from '../api';

const ROOM_PRESETS = [
  { type: 'living_room', name: 'Living Room', color: '#6366f1', w: 240, h: 200 },
  { type: 'kitchen', name: 'Kitchen', color: '#10b981', w: 200, h: 200 },
  { type: 'bedroom', name: 'Bedroom', color: '#ec4899', w: 220, h: 200 },
  { type: 'bathroom', name: 'Bathroom', color: '#06b6d4', w: 160, h: 160 },
  { type: 'dining', name: 'Dining Room', color: '#f59e0b', w: 200, h: 180 },
  { type: 'office', name: 'Office', color: '#8b5cf6', w: 180, h: 160 },
  { type: 'hallway', name: 'Hallway', color: '#64748b', w: 260, h: 100 },
  { type: 'custom', name: 'Custom Room', color: '#3b82f6', w: 180, h: 180 }
];

const WALL_NAMES = ['top', 'right', 'bottom', 'left'];

const RoomGridCreator = () => {
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [devices, setDevices] = useState([]);
  const [floorPlanId, setFloorPlanId] = useState(null);
  const [planName, setPlanName] = useState('Main Floor');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);

  useEffect(() => {
    loadFloorPlan();
    loadDevices();
  }, []);

  const loadFloorPlan = async () => {
    setLoading(true);
    try {
      const plans = await floorPlanApi.getFloorPlans();
      if (plans && plans.length > 0) {
        const first = plans[0];
        setFloorPlanId(first.id);
        setPlanName(first.name || 'Main Floor');
        const parsed = JSON.parse(first.layout_json || '[]');
        setRooms(parsed);
        if (parsed.length > 0) setSelectedRoomId(parsed[0].id);
      } else {
        // Fallback default starter rooms
        const initial = [
          { id: 'room-1', name: 'Living Room', type: 'living_room', x: 80, y: 80, width: 260, height: 220, rotation: 0, color: '#6366f1', doors: [{ id: 'door-1', wall: 'bottom', offset: 50 }] },
          { id: 'room-2', name: 'Kitchen', type: 'kitchen', x: 380, y: 80, width: 220, height: 220, rotation: 0, color: '#10b981', doors: [{ id: 'door-2', wall: 'left', offset: 50 }] }
        ];
        setRooms(initial);
        setSelectedRoomId('room-1');
      }
    } catch (err) {
      console.error('Failed to load floor plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const data = await hubApi.getDevices();
      setDevices(Array.isArray(data) ? data : (data.devices || []));
    } catch (err) {
      console.warn('Could not load devices for rooms:', err);
    }
  };

  const saveCurrentPlan = async () => {
    setSaving(true);
    try {
      await floorPlanApi.saveFloorPlan({
        id: floorPlanId,
        name: planName,
        level: 1,
        layout_json: rooms
      });
      // Also sync room names to groups database for device assignment
      for (const r of rooms) {
        try {
          await roomsApi.createRoom({ name: r.name, description: `Floor plan ${r.type}` });
        } catch (e) {}
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      alert('Failed to save floor plan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addRoom = (preset) => {
    const newId = `room-${Date.now()}`;
    // Position staggered based on current room count
    const offset = (rooms.length % 5) * 40;
    const newRoom = {
      id: newId,
      name: `${preset.name} ${rooms.filter(r => r.type === preset.type).length + 1 || ''}`.trim(),
      type: preset.type,
      x: 100 + offset,
      y: 100 + offset,
      width: preset.w,
      height: preset.h,
      rotation: 0,
      color: preset.color,
      doors: []
    };
    setRooms([...rooms, newRoom]);
    setSelectedRoomId(newId);
  };

  const deleteSelectedRoom = () => {
    if (!selectedRoomId) return;
    setRooms(rooms.filter(r => r.id !== selectedRoomId));
    setSelectedRoomId(null);
  };

  const updateSelectedRoom = (updates) => {
    if (!selectedRoomId) return;
    setRooms(rooms.map(r => r.id === selectedRoomId ? { ...r, ...updates } : r));
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  // Rotation handler (90 degree snapping)
  const rotateRoom = () => {
    if (!selectedRoom) return;
    const nextRot = (selectedRoom.rotation + 90) % 360;
    updateSelectedRoom({ rotation: nextRot });
  };

  // Door Management
  const addDoorToWall = (wallName) => {
    if (!selectedRoom) return;
    const currentDoors = selectedRoom.doors || [];
    const newDoor = {
      id: `door-${Date.now()}`,
      wall: wallName,
      offset: 50 // percentage along the wall (0-100)
    };
    updateSelectedRoom({ doors: [...currentDoors, newDoor] });
  };

  const removeDoor = (doorId) => {
    if (!selectedRoom) return;
    const currentDoors = selectedRoom.doors || [];
    updateSelectedRoom({ doors: currentDoors.filter(d => d.id !== doorId) });
  };

  // Canvas Drag & Move
  const handleMouseDown = (e, roomId) => {
    e.stopPropagation();
    setSelectedRoomId(roomId);
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - room.x,
      y: e.clientY - room.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !selectedRoomId) return;
    // Snap to 10px grid
    const rawX = e.clientX - dragOffset.x;
    const rawY = e.clientY - dragOffset.y;
    const snappedX = Math.max(20, Math.round(rawX / 10) * 10);
    const snappedY = Math.max(20, Math.round(rawY / 10) * 10);

    setRooms(rooms.map(r => r.id === selectedRoomId ? { ...r, x: snappedX, y: snappedY } : r));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Devices inside selected room
  const assignedDevices = devices.filter(d => 
    (selectedRoom && (d.roomName === selectedRoom.name || d.room === selectedRoom.name))
  );

  return (
    <div 
      className="flex flex-col gap-6 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Action & Mode Toolbar - Strict Symbols Over Text */}
      <div className="glass-card p-6 rounded-3xl border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600/30 text-indigo-300 rounded-2xl border border-indigo-500/30">
            <Home size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">{planName}</h2>
            <p className="text-slate-400 text-lg">Intelligent Room Grid & Wall Constructor</p>
          </div>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={saveCurrentPlan}
            disabled={saving}
            className={`p-4 rounded-2xl font-bold transition-all shadow-xl active:scale-95 flex items-center justify-center ${
              savedSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-600/30 border border-emerald-400'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
            }`}
            title="Save Floor Plan Layout to System"
          >
            {savedSuccess ? <Check size={28} /> : <Save size={28} />}
          </button>

          <button
            onClick={loadFloorPlan}
            className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95"
            title="Reload Floor Plan"
          >
            <RefreshCw size={28} />
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Control Palette (Room Creator & Properties) */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          {/* Add Room Presets */}
          <div className="glass-card p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <h3 className="text-xl font-bold text-white uppercase tracking-wider">Add Room Shape</h3>
            <div className="grid grid-cols-2 gap-3">
              {ROOM_PRESETS.map((preset) => (
                <button
                  key={preset.type}
                  onClick={() => addRoom(preset)}
                  className="p-4 rounded-2xl border border-white/10 bg-slate-900/60 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2 group active:scale-95 shadow-md"
                  title={`Add scalable ${preset.name} shape`}
                >
                  <div
                    className="w-7 h-7 rounded-lg shadow-md group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: preset.color }}
                  />
                  <span className="text-base font-semibold text-slate-200">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Room Inspector & Scaler */}
          {selectedRoom ? (
            <div className="glass-card p-6 rounded-3xl border border-white/10 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-5 h-5 rounded-full shadow-lg"
                    style={{ backgroundColor: selectedRoom.color }}
                  />
                  <input
                    type="text"
                    value={selectedRoom.name}
                    onChange={(e) => updateSelectedRoom({ name: e.target.value })}
                    className="bg-transparent text-2xl font-bold text-white focus:outline-none focus:border-b-2 border-indigo-500 w-40"
                    title="Edit Room Name"
                  />
                </div>
                <button
                  onClick={deleteSelectedRoom}
                  className="p-3 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-md active:scale-95"
                  title="Delete Selected Room"
                >
                  <Trash2 size={24} />
                </button>
              </div>

              {/* Scalable Dimensions (Width & Height) */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 font-bold uppercase text-sm">Width: {selectedRoom.width}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSelectedRoom({ width: Math.max(100, selectedRoom.width - 20) })}
                      className="p-3 bg-slate-900/80 border border-white/10 rounded-xl text-white hover:bg-slate-800"
                      title="Decrease Width"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <input
                      type="range"
                      min="100"
                      max="600"
                      step="10"
                      value={selectedRoom.width}
                      onChange={(e) => updateSelectedRoom({ width: parseInt(e.target.value) })}
                      className="flex-1 accent-indigo-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                    />
                    <button
                      onClick={() => updateSelectedRoom({ width: Math.min(600, selectedRoom.width + 20) })}
                      className="p-3 bg-slate-900/80 border border-white/10 rounded-xl text-white hover:bg-slate-800"
                      title="Increase Width"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 font-bold uppercase text-sm">Height: {selectedRoom.height}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSelectedRoom({ height: Math.max(100, selectedRoom.height - 20) })}
                      className="p-3 bg-slate-900/80 border border-white/10 rounded-xl text-white hover:bg-slate-800"
                      title="Decrease Height"
                    >
                      <ChevronDown size={20} />
                    </button>
                    <input
                      type="range"
                      min="100"
                      max="600"
                      step="10"
                      value={selectedRoom.height}
                      onChange={(e) => updateSelectedRoom({ height: parseInt(e.target.value) })}
                      className="flex-1 accent-indigo-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                    />
                    <button
                      onClick={() => updateSelectedRoom({ height: Math.min(600, selectedRoom.height + 20) })}
                      className="p-3 bg-slate-900/80 border border-white/10 rounded-xl text-white hover:bg-slate-800"
                      title="Increase Height"
                    >
                      <ChevronUp size={20} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Rotation & Angle Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-slate-400 font-bold uppercase text-sm">Rotate: {selectedRoom.rotation}°</span>
                <button
                  onClick={rotateRoom}
                  className="p-4 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-2xl border border-indigo-500/20 transition-all shadow-md active:scale-95"
                  title="Rotate Room 90 Degrees"
                >
                  <RotateCw size={26} />
                </button>
              </div>

              {/* Intelligent Wall & Door Placement */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <span className="text-slate-400 font-bold uppercase text-sm block">Add Door to Wall</span>
                <div className="grid grid-cols-4 gap-2">
                  {WALL_NAMES.map((wall) => (
                    <button
                      key={wall}
                      onClick={() => addDoorToWall(wall)}
                      className="p-3 bg-slate-900/80 border border-white/10 hover:border-indigo-500 rounded-xl text-slate-200 hover:text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 flex flex-col items-center gap-1"
                      title={`Add Door to ${wall.toUpperCase()} wall`}
                    >
                      <DoorOpen size={20} className="text-indigo-400" />
                      <span>{wall}</span>
                    </button>
                  ))}
                </div>

                {/* Existing doors list */}
                {selectedRoom.doors && selectedRoom.doors.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <span className="text-slate-400 text-xs font-semibold uppercase">Active Doors</span>
                    {selectedRoom.doors.map((door, idx) => (
                      <div key={door.id} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 text-sm">
                        <span className="text-slate-300 font-medium">Door {idx + 1} ({door.wall})</span>
                        <button
                          onClick={() => removeDoor(door.id)}
                          className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600/30 rounded-lg transition-all"
                          title="Remove Door"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Devices in this room */}
              <div className="pt-2 border-t border-white/10">
                <span className="text-slate-400 font-bold uppercase text-sm block mb-2">
                  Assigned Devices ({assignedDevices.length})
                </span>
                {assignedDevices.length === 0 ? (
                  <p className="text-slate-500 text-sm">No devices assigned to this room yet. Assign devices from the Connected Devices tab.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {assignedDevices.map(d => (
                      <div key={d.id} className="px-3 py-2 bg-slate-900/70 rounded-xl border border-white/5 text-sm text-slate-200 flex items-center justify-between">
                        <span className="truncate">{d.customName || d.label || d.name}</span>
                        <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md font-mono">{d.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-card p-8 rounded-3xl border border-white/10 text-center shadow-xl text-slate-400">
              <Move size={48} className="mx-auto mb-3 opacity-30 text-indigo-400" />
              <p className="font-semibold text-lg text-slate-300">Select a room</p>
              <p className="text-sm text-slate-500 mt-1">Click any room on the blueprint grid to scale, rotate, and add doors.</p>
            </div>
          )}
        </div>

        {/* Blueprint Interactive Canvas */}
        <div className="xl:col-span-3">
          <div 
            ref={canvasRef}
            className="w-full h-[720px] bg-[#070b14] rounded-3xl border-2 border-white/10 relative overflow-hidden shadow-2xl cursor-crosshair"
            style={{
              backgroundImage: `
                radial-gradient(circle, rgba(255,255,255,0.06) 1.5px, transparent 1.5px),
                linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px, 30px 30px, 30px 30px'
            }}
            onClick={() => setSelectedRoomId(null)}
          >
            {/* Grid Measurement Overlay / Scale Watermark */}
            <div className="absolute top-4 left-6 pointer-events-none flex items-center gap-3">
              <span className="px-3 py-1 bg-slate-900/90 text-indigo-400 text-xs font-mono font-bold rounded-lg border border-white/10 shadow-lg">
                GRID SNAP: 10px
              </span>
              <span className="px-3 py-1 bg-slate-900/90 text-slate-400 text-xs font-mono font-bold rounded-lg border border-white/10 shadow-lg">
                ROOMS: {rooms.length}
              </span>
            </div>

            {/* Render Each Room Shape */}
            {rooms.map((room) => {
              const isSelected = room.id === selectedRoomId;
              const doors = room.doors || [];

              return (
                <div
                  key={room.id}
                  onMouseDown={(e) => handleMouseDown(e, room.id)}
                  style={{
                    position: 'absolute',
                    left: `${room.x}px`,
                    top: `${room.y}px`,
                    width: `${room.width}px`,
                    height: `${room.height}px`,
                    transform: `rotate(${room.rotation || 0}deg)`,
                    transformOrigin: 'center center',
                    backgroundColor: `${room.color}15`,
                    borderColor: isSelected ? '#ffffff' : `${room.color}aa`,
                    borderWidth: isSelected ? '4px' : '3px'
                  }}
                  className={`rounded-2xl transition-shadow cursor-grab active:cursor-grabbing flex flex-col justify-between p-4 shadow-2xl ${
                    isSelected ? 'ring-4 ring-indigo-500/50 shadow-indigo-500/20' : 'hover:border-white/50'
                  }`}
                  title={`Click and drag ${room.name}`}
                >
                  {/* Intelligent Structural Wall Outlines */}
                  {/* North Wall Doors */}
                  {doors.filter(d => d.wall === 'top').map(d => (
                    <div
                      key={d.id}
                      style={{ left: `${d.offset}%` }}
                      className="absolute -top-3 -translate-x-1/2 w-10 h-6 bg-[#070b14] border-2 border-amber-400 rounded-sm flex items-center justify-center shadow-lg pointer-events-none"
                    >
                      <div className="w-1.5 h-4 bg-amber-400 rounded-full" />
                    </div>
                  ))}

                  {/* South Wall Doors */}
                  {doors.filter(d => d.wall === 'bottom').map(d => (
                    <div
                      key={d.id}
                      style={{ left: `${d.offset}%` }}
                      className="absolute -bottom-3 -translate-x-1/2 w-10 h-6 bg-[#070b14] border-2 border-amber-400 rounded-sm flex items-center justify-center shadow-lg pointer-events-none"
                    >
                      <div className="w-1.5 h-4 bg-amber-400 rounded-full" />
                    </div>
                  ))}

                  {/* West Wall Doors */}
                  {doors.filter(d => d.wall === 'left').map(d => (
                    <div
                      key={d.id}
                      style={{ top: `${d.offset}%` }}
                      className="absolute -left-3 -translate-y-1/2 w-6 h-10 bg-[#070b14] border-2 border-amber-400 rounded-sm flex items-center justify-center shadow-lg pointer-events-none"
                    >
                      <div className="w-4 h-1.5 bg-amber-400 rounded-full" />
                    </div>
                  ))}

                  {/* East Wall Doors */}
                  {doors.filter(d => d.wall === 'right').map(d => (
                    <div
                      key={d.id}
                      style={{ top: `${d.offset}%` }}
                      className="absolute -right-3 -translate-y-1/2 w-6 h-10 bg-[#070b14] border-2 border-amber-400 rounded-sm flex items-center justify-center shadow-lg pointer-events-none"
                    >
                      <div className="w-4 h-1.5 bg-amber-400 rounded-full" />
                    </div>
                  ))}

                  {/* Room Label & Size */}
                  <div className="pointer-events-none">
                    <span 
                      className="text-lg font-black tracking-wide drop-shadow-md block"
                      style={{ color: room.color }}
                    >
                      {room.name}
                    </span>
                    <span className="text-xs font-mono text-slate-400 font-semibold">
                      {room.width} × {room.height}px
                    </span>
                  </div>

                  {/* Device Count / Presence Badge */}
                  <div className="pointer-events-none flex items-center justify-between">
                    <span className="px-2.5 py-1 bg-black/60 rounded-lg text-xs font-bold text-slate-300 backdrop-blur-sm border border-white/10">
                      {devices.filter(d => d.roomName === room.name || d.room === room.name).length} devices
                    </span>
                    {doors.length > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-md text-[11px] font-bold">
                        {doors.length} {doors.length === 1 ? 'door' : 'doors'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomGridCreator;
