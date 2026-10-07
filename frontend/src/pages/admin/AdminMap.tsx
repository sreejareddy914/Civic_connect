import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { 
  MapPin, 
  Loader2, 
  Filter, 
  ArrowUpRight 
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

const createAdminIcon = (severity: string) => {
  let color = '#22c55e'; // LOW
  if (severity === 'CRITICAL') color = '#dc2626'; // Deep Red
  else if (severity === 'HIGH') color = '#ea580c'; // Orange
  else if (severity === 'MEDIUM') color = '#2563eb'; // Blue
  
  const html = `
    <div style="
      background-color: ${color}; 
      width: 24px; 
      height: 24px; 
      border-radius: 50%; 
      border: 3px solid white; 
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="background-color: white; width: 6px; height: 6px; border-radius: 50%;"></div>
    </div>`;
  return L.divIcon({ html, className: 'custom-admin-marker', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });
};

export default function AdminMap() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getIssues({ limit: 100 });
      setIssues(res.issues || []);
    } catch (e: any) {
      console.error('Error fetching issues for map:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredIssues = issues.filter(i => {
    if (!i.latitude || !i.longitude) return false;
    if (filterSeverity !== 'ALL' && i.severity !== filterSeverity) return false;
    if (filterStatus !== 'ALL' && i.status !== filterStatus) return false;
    return true;
  });

  const defaultCenter = [17.3850, 78.4867] as [number, number]; // Hyderabad center

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-red-600" />
            CivicConnect Municipal GIS Operations Map
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time geospatial distribution of active civic reports, field hazard zones, and department allocations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Critical ({issues.filter(i => i.severity === 'CRITICAL').length})
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> High ({issues.filter(i => i.severity === 'HIGH').length})
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Medium
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
            <Filter className="h-4 w-4 text-gray-400" /> Filters:
          </div>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="LOW">Low Only</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="REPORTED">Needs Verification (Reported)</option>
            <option value="VERIFIED">Verified</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <span className="text-xs text-gray-500 font-medium">
          Showing <strong>{filteredIssues.length}</strong> geolocated complaints
        </span>
      </div>

      {/* Map Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-[680px] relative z-0">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="animate-spin h-10 w-10 text-red-600" />
          </div>
        ) : (
          <MapContainer
            center={defaultCenter}
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filteredIssues.map((issue) => (
              <Marker
                key={issue.id}
                position={[issue.latitude, issue.longitude]}
                icon={createAdminIcon(issue.severity)}
              >
                <Popup>
                  <div className="p-1 max-w-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-gray-500">{issue.code}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                        issue.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {issue.severity}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-gray-900 leading-tight">{issue.title}</div>
                    <div className="text-xs text-gray-600 line-clamp-2">{issue.description}</div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-red-500 flex-shrink-0" />
                      <span className="truncate">{issue.address || 'Hyderabad'}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase">{issue.status}</span>
                      <Link
                        to={`/admin/issues/${issue.id}`}
                        className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-0.5"
                      >
                        Review Issue <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
