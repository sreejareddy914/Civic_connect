import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { 
  Loader2, Navigation, MapPin, ArrowRight 
} from 'lucide-react';
import { workerApi } from '../../services/workerApi';

// Custom Map Centering Controller
function MapAutoCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center[0] && center[1]) {
      map.setView(center, 13);
    }
  }, [center, map]);
  return null;
}

// Marker Icon Creators
function getTaskIcon(severity: string, status: string) {
  let color = '#3498db'; // blue default
  if (severity === 'CRITICAL') color = '#e74c3c'; // red
  else if (severity === 'HIGH') color = '#e67e22'; // orange
  else if (status === 'IN_PROGRESS') color = '#9b59b6'; // purple

  const html = `
    <div style="
      background-color: ${color};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 13px;
      font-weight: bold;
    ">
      📍
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-worker-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

const workerLocationIcon = L.divIcon({
  html: `
    <div style="position: relative; width: 32px; height: 32px;">
      <div style="
        position: absolute;
        inset: 0;
        background-color: #3b82f6;
        opacity: 0.35;
        border-radius: 50%;
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        position: absolute;
        top: 6px;
        left: 6px;
        width: 20px;
        height: 20px;
        background-color: #2563eb;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    </div>
  `,
  className: 'worker-gps-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

export default function WorkerMap() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workerCoords, setWorkerCoords] = useState<[number, number]>([17.385044, 78.486671]); // Default Hyderabad center
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'IN_PROGRESS' | 'DUE_SOON'>('ALL');

  useEffect(() => {
    // 1. Get worker GPS location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setWorkerCoords([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => console.log('Geolocation error:', err.message),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await workerApi.getDashboard();
      const allTasks = res.allAssignments || [];
      setTasks(allTasks);
      // If worker coordinates default, and there's a task with valid coords, center to it
      if (allTasks.length > 0 && allTasks[0].latitude && allTasks[0].longitude) {
        setWorkerCoords([allTasks[0].latitude, allTasks[0].longitude]);
      }
    } catch (err) {
      console.error('Error loading worker map tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t: any) => {
    if (!t.latitude || !t.longitude) return false;
    if (filter === 'CRITICAL') return t.severity === 'CRITICAL';
    if (filter === 'IN_PROGRESS') return t.status === 'IN_PROGRESS';
    if (filter === 'DUE_SOON') return t.sla?.status === 'DUE_SOON';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-5rem)] flex flex-col space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-[#2C3E50]">Field Operations Map</h1>
          <p className="text-xs text-gray-500">Live geographic distribution of your assigned civic repairs.</p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl transition-colors ${
              filter === 'ALL' ? 'bg-[#2C3E50] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Assigned ({tasks.filter(t => t.latitude && t.longitude).length})
          </button>
          <button
            onClick={() => setFilter('CRITICAL')}
            className={`px-3 py-1.5 rounded-xl transition-colors ${
              filter === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Critical ({tasks.filter(t => t.severity === 'CRITICAL').length})
          </button>
          <button
            onClick={() => setFilter('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-xl transition-colors ${
              filter === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            In Progress ({tasks.filter(t => t.status === 'IN_PROGRESS').length})
          </button>
          <button
            onClick={() => setFilter('DUE_SOON')}
            className={`px-3 py-1.5 rounded-xl transition-colors ${
              filter === 'DUE_SOON' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            SLA Due Soon ({tasks.filter(t => t.sla?.status === 'DUE_SOON').length})
          </button>
        </div>
      </div>

      {/* Main Map Area with Floating Task List */}
      <div className="relative flex-grow rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-30 bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#E67E22] animate-spin" />
          </div>
        )}

        <MapContainer
          center={workerCoords}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <MapAutoCenter center={workerCoords} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Worker's Current Position */}
          <Marker position={workerCoords} icon={workerLocationIcon}>
            <Popup>
              <div className="text-xs p-1">
                <strong className="text-blue-600 block">Your Current GPS Position</strong>
                <span className="text-gray-500">Live field location</span>
              </div>
            </Popup>
          </Marker>

          {/* Assigned Complaint Pins */}
          {filteredTasks.map((task: any) => (
            <Marker
              key={task.id}
              position={[task.latitude, task.longitude]}
              icon={getTaskIcon(task.severity, task.status)}
              eventHandlers={{
                click: () => setSelectedTask(task)
              }}
            >
              <Popup>
                <div className="text-xs p-1 space-y-1.5 min-w-[200px]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-gray-700">{task.code}</span>
                    <span className="font-bold text-red-600 uppercase text-[10px]">{task.severity}</span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">{task.title}</h4>
                  <p className="text-gray-600 text-[11px] truncate">{task.address}</p>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t">
                    <span className="text-[#E67E22] font-semibold">{task.status}</span>
                    {task.distance && <span className="text-gray-500">📍 {task.distance}</span>}
                  </div>
                  <div className="flex items-center gap-1 pt-1">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-gray-100 text-gray-800 rounded font-semibold text-[10px] flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3 text-blue-600" /> Navigate
                    </a>
                    <Link
                      to={`/worker/tasks/${task.assignmentId || task.id}`}
                      className="px-2.5 py-1 bg-[#E67E22] text-white rounded font-bold text-[10px] flex-1 text-center"
                    >
                      Handle
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Selected Task Bottom Drawer on Mobile */}
        {selectedTask && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-gray-200 z-30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                {selectedTask.code}
              </span>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-black text-xs">✕</button>
            </div>
            <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{selectedTask.title}</h3>
            <p className="text-xs text-gray-600 flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {selectedTask.address}
            </p>
            <div className="flex items-center justify-between pt-2 border-t text-xs">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedTask.latitude},${selectedTask.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-semibold flex items-center gap-1"
              >
                <Navigation className="w-3 h-3" /> Navigate
              </a>
              <Link
                to={`/worker/tasks/${selectedTask.assignmentId || selectedTask.id}`}
                className="px-4 py-1.5 bg-[#E67E22] text-white rounded-lg font-bold flex items-center gap-1 shadow-xs"
              >
                View Details <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
