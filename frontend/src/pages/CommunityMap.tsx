import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { 
  Loader2, 
  AlertCircle, 
  X, 
  MapPin, 
  Clock, 
  Info, 
  CheckCircle, 
  Image as ImageIcon,
  Filter,
  SlidersHorizontal,
  RotateCcw,
  Building2,
  Tag,
  ShieldAlert,
  Activity
} from 'lucide-react';
import IssueUpvote from '../components/IssueUpvote';
import IssueComments from '../components/IssueComments';
import ComplaintShareButton from '../components/ComplaintShareButton';
import { useSearchParams } from 'react-router-dom';
import IssueVerificationForm from '../components/IssueVerificationForm';

function MapBounds({ issues, isLoading, verifyMode }: { issues: any[], isLoading: boolean, verifyMode: boolean }) {
  const map = useMap();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (isLoading || hasInitialized) return;

    if (verifyMode) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 13);
            setHasInitialized(true);
          },
          (err) => {
            console.warn('Geolocation failed or denied. Falling back to default view.', err);
            applyFallbackView();
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
        return;
      } else {
        applyFallbackView();
      }
    } else {
      applyFallbackView();
    }

    function applyFallbackView() {
      if (issues.length > 0) {
        const sortedLats = [...issues].map(i => i.latitude).sort((a, b) => a - b);
        const sortedLngs = [...issues].map(i => i.longitude).sort((a, b) => a - b);
        const medianLat = sortedLats[Math.floor(sortedLats.length / 2)];
        const medianLng = sortedLngs[Math.floor(sortedLngs.length / 2)];

        const clusterIssues = issues.filter(i => 
          Math.abs(i.latitude - medianLat) <= 0.5 && 
          Math.abs(i.longitude - medianLng) <= 0.5
        );
        
        const targetIssues = clusterIssues.length > 0 ? clusterIssues : issues;
        
        if (targetIssues.length === 1) {
          map.setView([targetIssues[0].latitude, targetIssues[0].longitude], 14);
        } else {
          const bounds = L.latLngBounds(targetIssues.map(i => [i.latitude, i.longitude]));
          if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
            map.setView(bounds.getCenter(), 14);
          } else {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          }
        }
      } else {
        const defaultCenter = L.latLng(17.3850, 78.4867);
        map.setView([defaultCenter.lat, defaultCenter.lng], 13);
      }
      setHasInitialized(true);
    }
  }, [issues, isLoading, hasInitialized, map, verifyMode]);

  return null;
}

const createIcon = (severity: string) => {
  let color = '#22c55e'; // LOW - Green
  const s = severity?.toUpperCase();
  if (s === 'HIGH' || s === 'CRITICAL') color = '#ef4444'; // RED
  else if (s === 'MEDIUM') color = '#f97316'; // ORANGE
  
  const html = `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.35); transition: transform 0.2s;"></div>`;
  return L.divIcon({ html, className: 'custom-leaflet-icon', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -11] });
};

export default function CommunityMap({ session }: { session?: any }) {
  const [searchParams] = useSearchParams();
  const verifyMode = searchParams.get('mode') === 'verify';

  const [issues, setIssues] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [onlyMyIssues, setOnlyMyIssues] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Details Modal states
  const [viewingDetails, setViewingDetails] = useState(false);
  const [detailedData, setDetailedData] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showVerifyForm, setShowVerifyForm] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch all mapped issues with department details
      const [issuesRes, deptsRes] = await Promise.all([
        supabase
          .from('issues')
          .select(`
            *,
            departments:department_id (id, name)
          `)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('id, name')
          .order('name', { ascending: true })
      ]);

      if (issuesRes.error) throw issuesRes.error;
      setIssues(issuesRes.data || []);

      if (deptsRes.data) {
        setDepartments(deptsRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching map issues:', err);
      setError('Unable to load community complaints. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Distinct categories dynamically derived from data + standard defaults
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => {
      if (i.category && i.category.trim()) {
        set.add(i.category.trim());
      }
    });
    // Add common defaults if not present
    ['Roads', 'Lighting', 'Water', 'Sanitation', 'Drainage', 'Traffic', 'Other'].forEach(c => set.add(c));
    return Array.from(set).sort();
  }, [issues]);

  // Combined Multi-Filter evaluation
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // 1. Department filter
      if (departmentFilter !== 'ALL') {
        const issueDeptId = issue.department_id || issue.departments?.id;
        const issueDeptName = issue.departments?.name;
        if (issueDeptId !== departmentFilter && issueDeptName !== departmentFilter) {
          return false;
        }
      }

      // 2. Category filter
      if (categoryFilter !== 'ALL') {
        if ((issue.category || 'Other').toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Status filter
      if (statusFilter !== 'ALL') {
        if (issue.status !== statusFilter) {
          return false;
        }
      }

      // 4. Severity filter
      if (severityFilter !== 'ALL') {
        if ((issue.severity || 'LOW').toUpperCase() !== severityFilter.toUpperCase()) {
          return false;
        }
      }

      // 5. My issues filter
      if (onlyMyIssues && session?.user?.id) {
        if (issue.reporter_id !== session.user.id) {
          return false;
        }
      }

      return true;
    });
  }, [issues, departmentFilter, categoryFilter, statusFilter, severityFilter, onlyMyIssues, session]);

  // Active filter count for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (departmentFilter !== 'ALL') count++;
    if (categoryFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    if (severityFilter !== 'ALL') count++;
    if (onlyMyIssues) count++;
    return count;
  }, [departmentFilter, categoryFilter, statusFilter, severityFilter, onlyMyIssues]);

  const clearAllFilters = () => {
    setDepartmentFilter('ALL');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setSeverityFilter('ALL');
    setOnlyMyIssues(false);
  };

  const handleViewDetails = async (issue: any) => {
    setViewingDetails(true);
    setDetailsLoading(true);
    setShowVerifyForm(false);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      
      const response = await fetch(`${apiUrl}/issues/${issue.id}/extra`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      let extraData: any = {};
      if (response.ok) {
        extraData = await response.json();
      }
      setDetailedData({
        ...issue,
        ai: extraData.ai,
        media: extraData.media,
        hasCurrentUserVerified: extraData.hasCurrentUserVerified
      });
    } catch (err) {
      console.error("Failed to load details", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const defaultCenter: [number, number] = [17.3850, 78.4867];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-4.5rem)] flex flex-col relative font-sans">
      {/* ============================================================ */}
      {/* 1. TOP HEADER & FILTER CONTROLS BAR                          */}
      {/* ============================================================ */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A3636] tracking-tight">
                Community Map
              </h1>
              {verifyMode && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Verification Mode
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Explore civic issues, monitor live resolution progress, and verify local complaints
            </p>
          </div>

          {/* Quick results counter & mobile filter button */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold px-3 py-1.5 bg-white rounded-xl border border-gray-200 text-gray-700 shadow-2xs">
              {filteredIssues.length} {filteredIssues.length === 1 ? 'complaint' : 'complaints'} found
            </span>

            {/* Mobile Filter Button */}
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1A3636] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#254d4d] transition-all"
            >
              <Filter className="w-3.5 h-3.5 text-[#40E0D0]" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#40E0D0] text-[#1A3636] text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DESKTOP FILTER BAR (Visible on lg and larger screens)        */}
        {/* ============================================================ */}
        <div className="hidden lg:flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center gap-2.5 flex-wrap flex-1">
            {/* Department Filter */}
            <div className="flex items-center gap-1.5 min-w-[150px]">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 min-w-[140px]">
              <Tag className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="ALL">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 min-w-[140px]">
              <Activity className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="REPORTED">Reported (Pending)</option>
                <option value="MORE_INFO_REQUIRED">More Info Required</option>
                <option value="VERIFIED">Verified</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CITIZEN_VERIFICATION">Resolution Approval</option>
                <option value="RESOLVED">Resolved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 min-w-[130px]">
              <ShieldAlert className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Only My Reports Checkbox */}
            {session?.user && (
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={onlyMyIssues}
                  onChange={(e) => setOnlyMyIssues(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                />
                <span className="select-none">My Reports</span>
              </label>
            )}
          </div>

          {/* Clear Filters Button */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* ============================================================ */}
        {/* ACTIVE FILTER CHIPS ROW                                      */}
        {/* ============================================================ */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-gray-400 font-semibold text-[11px] uppercase tracking-wider">
              Active Filters:
            </span>

            {departmentFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-medium">
                Dept: {departments.find(d => d.id === departmentFilter)?.name || departmentFilter}
                <button 
                  type="button" 
                  onClick={() => setDepartmentFilter('ALL')}
                  className="hover:text-teal-950 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            )}

            {categoryFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-medium">
                Category: {categoryFilter}
                <button 
                  type="button" 
                  onClick={() => setCategoryFilter('ALL')}
                  className="hover:text-teal-950 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            )}

            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-medium">
                Status: {statusFilter}
                <button 
                  type="button" 
                  onClick={() => setStatusFilter('ALL')}
                  className="hover:text-blue-950 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            )}

            {severityFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-800 border border-orange-200 font-medium">
                Severity: {severityFilter}
                <button 
                  type="button" 
                  onClick={() => setSeverityFilter('ALL')}
                  className="hover:text-orange-950 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            )}

            {onlyMyIssues && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-medium">
                My Reports Only
                <button 
                  type="button" 
                  onClick={() => setOnlyMyIssues(false)}
                  className="hover:text-purple-950 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-gray-500 hover:text-gray-800 underline font-medium ml-1"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. MAP CONTAINER                                             */}
      {/* ============================================================ */}
      <div className="flex-grow bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden relative z-0">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-3" />
            <p className="text-teal-950 font-bold text-sm">Loading community complaints...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 bg-white flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
            <p className="text-gray-800 font-bold text-sm max-w-sm">{error}</p>
            <button 
              type="button"
              onClick={fetchInitialData} 
              className="mt-4 px-4 py-2 bg-[#1A3636] text-white rounded-xl font-bold text-xs hover:bg-[#254d4d] transition-colors"
            >
              Retry Loading Map
            </button>
          </div>
        )}

        {!loading && !error && filteredIssues.length === 0 && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[400] bg-white/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-gray-200 text-center max-w-sm">
            <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-900">No complaints match the selected filters.</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Try loosening your criteria or resetting filters.</p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-3 px-3.5 py-1.5 bg-[#1A3636] text-white rounded-lg text-xs font-bold hover:bg-[#254d4d] transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds issues={filteredIssues} isLoading={loading} verifyMode={verifyMode} />
          
          {filteredIssues.map(issue => (
            <Marker 
              key={issue.id} 
              position={[issue.latitude, issue.longitude]} 
              icon={createIcon(issue.severity || 'LOW')}
              eventHandlers={{
                click: () => { handleViewDetails(issue); }
              }}
            >
              <Popup className="custom-popup" minWidth={280}>
                <div className="p-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      (issue.severity || 'LOW') === 'HIGH' || issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                      issue.severity === 'MEDIUM' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {issue.severity || 'LOW'} SEVERITY
                    </span>
                    <span className="text-[10px] text-gray-600 font-medium bg-gray-100 px-2 py-0.5 rounded-md">
                      {issue.category || 'Civic'}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-1">{issue.title}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{issue.description}</p>
                  
                  <div className="space-y-1 text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                    {issue.address && (
                      <div className="flex items-start">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-rose-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{issue.address}</span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-gray-400 shrink-0" />
                      <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => handleViewDetails(issue)}
                      className="flex-1 bg-[#1A3636] hover:bg-[#254d4d] text-white font-bold text-xs py-2 rounded-xl transition-colors shadow-2xs text-center"
                    >
                      Details of Complaint
                    </button>
                    <ComplaintShareButton
                      issueId={issue.id}
                      title={issue.title}
                      code={issue.code}
                      category={issue.category}
                      description={issue.description}
                      variant="icon"
                    />
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-5 right-5 bg-white/95 backdrop-blur-xs px-4 py-3 rounded-2xl shadow-lg border border-gray-200 z-[400] select-none pointer-events-none">
          <h4 className="font-extrabold text-[10px] text-gray-400 uppercase tracking-wider mb-2">Severity</h4>
          <div className="space-y-1.5 text-xs font-semibold text-gray-700">
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-red-500 mr-2 shadow-2xs border-2 border-white ring-1 ring-red-300"></span> 
              <span>Critical / High</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-orange-500 mr-2 shadow-2xs border-2 border-white ring-1 ring-orange-300"></span> 
              <span>Medium</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-2xs border-2 border-white ring-1 ring-emerald-300"></span> 
              <span>Low</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. MOBILE FILTER DRAWER (Slide-up modal on mobile)          */}
      {/* ============================================================ */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-[1200] lg:hidden flex flex-col justify-end">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileFilterOpen(false)}
          />

          <div className="relative bg-white rounded-t-3xl shadow-2xl p-6 z-10 max-h-[85vh] overflow-y-auto space-y-5 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-teal-700" />
                <h3 className="font-bold text-base text-gray-900">Map Filter Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-800"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-800"
              >
                <option value="ALL">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-800"
              >
                <option value="ALL">All Statuses</option>
                <option value="REPORTED">Reported (Pending)</option>
                <option value="MORE_INFO_REQUIRED">More Info Required</option>
                <option value="VERIFIED">Verified</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CITIZEN_VERIFICATION">Resolution Approval</option>
                <option value="RESOLVED">Resolved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Severity
              </label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-800"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* My Issues toggle */}
            {session?.user && (
              <label className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer text-xs font-bold text-gray-800">
                <input
                  type="checkbox"
                  checked={onlyMyIssues}
                  onChange={(e) => setOnlyMyIssues(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span>Show Only My Reported Issues</span>
              </label>
            )}

            {/* Mobile Actions */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 py-3 bg-[#1A3636] hover:bg-[#254d4d] text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                Apply Filters ({filteredIssues.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. COMPLAINT DETAILS MODAL                                   */}
      {/* ============================================================ */}
      {viewingDetails && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setViewingDetails(false)}
          />
          
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col relative z-10 animate-in fade-in zoom-in-95 duration-150 border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 bg-[#1A3636] text-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-[#40E0D0]" />
                <h2 className="text-base font-bold text-[#FAF9F6]">Complaint Details</h2>
              </div>
              <button 
                type="button"
                onClick={() => setViewingDetails(false)}
                className="p-1.5 text-gray-300 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600 mb-3" />
                  <p className="text-xs text-gray-500 font-medium">Loading full details...</p>
                </div>
              ) : detailedData ? (
                <div className="space-y-6">
                  {/* Verification Workflow */}
                  {verifyMode && !showVerifyForm && (
                    <div>
                      {detailedData.status === 'RESOLVED' ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                          <p className="text-xs font-bold text-emerald-800">This complaint has already been resolved.</p>
                        </div>
                      ) : detailedData.reporter_id === session?.user?.id ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                          <p className="text-xs font-bold text-amber-800">You cannot verify your own reported complaint.</p>
                        </div>
                      ) : detailedData.hasCurrentUserVerified ? (
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                          <p className="text-xs font-bold text-teal-800">You have already verified this complaint.</p>
                        </div>
                      ) : (
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center space-y-2">
                          <h3 className="font-bold text-teal-950 text-sm">Help verify this complaint</h3>
                          <p className="text-xs text-teal-800 max-w-md mx-auto">
                            Confirm whether the issue is still ongoing at this location and earn Civic Points.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowVerifyForm(true)}
                            className="px-5 py-2 bg-[#1A3636] hover:bg-[#254d4d] text-white font-bold text-xs rounded-xl shadow-xs transition"
                          >
                            <CheckCircle className="w-4 h-4 mr-1.5 inline-block" />
                            <span>Verify This Complaint</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {showVerifyForm && (
                    <IssueVerificationForm 
                      issueId={detailedData.id} 
                      onClose={() => setShowVerifyForm(false)} 
                      onSuccess={(points) => {
                        setShowVerifyForm(false);
                        alert(`Verification submitted successfully! You earned ${points} Civic Points.`);
                        fetchInitialData();
                        setViewingDetails(false);
                      }} 
                    />
                  )}

                  {/* Image Section */}
                  {detailedData.media ? (
                    <div className="rounded-xl overflow-hidden bg-gray-100 border border-gray-200 max-h-72">
                      <img 
                        src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/issues/${detailedData.media.storage_path}`} 
                        alt="Issue" 
                        className="w-full h-auto max-h-72 object-cover"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl bg-gray-50 border border-gray-200 border-dashed flex flex-col items-center justify-center py-8 text-gray-400">
                      <ImageIcon className="w-10 h-10 mb-1 opacity-50" />
                      <span className="text-xs font-medium">No photo evidence attached</span>
                    </div>
                  )}

                  {/* Header Title & Badges */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 leading-snug">{detailedData.title}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-gray-100 text-gray-700 rounded-md">
                        {detailedData.category || 'General'}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-md border
                        ${(detailedData.severity || 'LOW') === 'HIGH' || detailedData.severity === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                        ${detailedData.severity === 'MEDIUM' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                        ${detailedData.severity === 'LOW' || !detailedData.severity ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                      `}>
                        Severity: {detailedData.severity || 'LOW'}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                        Status: {detailedData.status}
                      </span>
                      {detailedData.departments?.name && (
                        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 rounded-md">
                          Dept: {detailedData.departments.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Description
                    </h4>
                    <p className="text-xs text-gray-700 bg-gray-50 p-3.5 rounded-xl border border-gray-200/80 leading-relaxed whitespace-pre-wrap">
                      {detailedData.ai?.raw_response?.originalDescription || detailedData.description}
                    </p>
                  </div>

                  {/* Location & Report Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-1">
                      <h4 className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Location Details</h4>
                      <p className="text-gray-600">{detailedData.address || 'Address unlisted'}</p>
                      <p className="font-mono text-[10px] text-gray-400">
                        {detailedData.latitude?.toFixed(6)}, {detailedData.longitude?.toFixed(6)}
                      </p>
                    </div>

                    <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-1">
                      <h4 className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Tracking Code</h4>
                      <p className="font-mono font-bold text-gray-800">{detailedData.code || detailedData.id.split('-')[0]}</p>
                      <p className="text-[10px] text-gray-400">Reported on {new Date(detailedData.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* ============================================================ */}
                  {/* COMMUNITY ACTION CLUSTER: [ UPVOTE ] [ COMMENTS ] [ SHARE ]  */}
                  {/* ============================================================ */}
                  <div className="pt-3 border-t border-gray-100">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                      Community Actions
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <IssueUpvote issueId={detailedData.id} variant="button" />
                      <IssueComments issueId={detailedData.id} variant="button" />
                      <ComplaintShareButton
                        issueId={detailedData.id}
                        title={detailedData.title}
                        code={detailedData.code}
                        category={detailedData.category}
                        description={detailedData.description}
                        variant="button"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400 text-xs">Failed to load issue details.</div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end">
              <button 
                type="button"
                onClick={() => setViewingDetails(false)}
                className="px-5 py-2 bg-white border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition shadow-2xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
