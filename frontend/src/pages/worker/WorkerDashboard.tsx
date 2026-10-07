import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Loader2, AlertCircle, MapPin, Clock, Navigation, 
  AlertTriangle, Search, ArrowRight, ShieldAlert, CheckSquare, 
  ChevronRight, Calendar, Compass, RefreshCw
} from 'lucide-react';
import { workerApi } from '../../services/workerApi';

export default function WorkerDashboard({ session: _session }: { session?: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [slaFilter, setSlaFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeKpiKey, setActiveKpiKey] = useState<string | null>(null);

  // Worker coordinates for distance calculation
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    // Acquire worker geolocation for accurate distance calculation
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.log('Geolocation not available/denied:', err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [coords]);

  const fetchDashboard = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await workerApi.getDashboard();
      setData(res);
    } catch (err: any) {
      console.error('Error fetching worker dashboard:', err);
      setError(err.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAcceptAssignment = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    try {
      await workerApi.acceptAssignment(taskId);
      // Refresh dashboard after acceptance
      fetchDashboard(true);
    } catch (err: any) {
      alert(`Could not accept assignment: ${err.message}`);
    }
  };

  // KPI card selection filter mapping
  const handleKpiClick = (kpiKey: string, filterVal: { status?: string; severity?: string; sla?: string }) => {
    if (activeKpiKey === kpiKey) {
      // Toggle off
      setActiveKpiKey(null);
      setStatusFilter('ALL');
      setSeverityFilter('ALL');
      setSlaFilter('ALL');
      return;
    }

    setActiveKpiKey(kpiKey);
    if (filterVal.status) setStatusFilter(filterVal.status);
    if (filterVal.severity) setSeverityFilter(filterVal.severity);
    if (filterVal.sla) setSlaFilter(filterVal.sla);
  };

  // Filtered tasks calculation
  const filteredTasks = useMemo(() => {
    if (!data?.allAssignments) return [];
    return data.allAssignments.filter((t: any) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE') {
          if (!['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'REWORK_REQUIRED', 'EVIDENCE_REQUIRED'].includes(t.status)) return false;
        } else if (t.status !== statusFilter) {
          return false;
        }
      }
      // Severity filter
      if (severityFilter !== 'ALL' && t.severity !== severityFilter) return false;
      // Priority filter
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      // SLA filter
      if (slaFilter !== 'ALL' && t.sla?.status !== slaFilter) return false;
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCode = t.code?.toLowerCase().includes(query);
        const matchesTitle = t.title?.toLowerCase().includes(query);
        const matchesAddress = t.address?.toLowerCase().includes(query);
        const matchesCat = t.category?.toLowerCase().includes(query);
        if (!matchesCode && !matchesTitle && !matchesAddress && !matchesCat) return false;
      }
      return true;
    });
  }, [data?.allAssignments, statusFilter, severityFilter, priorityFilter, slaFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">Resolved</span>;
      case 'PENDING_VERIFICATION':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">Pending Review</span>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">In Progress</span>;
      case 'ACCEPTED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">Accepted</span>;
      case 'REWORK_REQUIRED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">Rework Needed</span>;
      case 'EVIDENCE_REQUIRED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">Evidence Needed</span>;
      case 'ASSIGNED':
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-900 border border-yellow-300">New Assigned</span>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">CRITICAL</span>;
      case 'HIGH':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-700">HIGH</span>;
      case 'MEDIUM':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-yellow-100 text-yellow-800">MEDIUM</span>;
      case 'LOW':
      default:
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">LOW</span>;
    }
  };

  const getSlaBadge = (sla: any) => {
    if (!sla) return null;
    if (sla.status === 'BREACHED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white shadow-xs">
          <AlertCircle className="w-3 h-3" /> Breached: {sla.overdueBy || 'Overdue'}
        </span>
      );
    }
    if (sla.status === 'DUE_SOON') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500 text-white shadow-xs">
          <Clock className="w-3 h-3" /> Due Soon: {sla.remainingHours}h left
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
        <Clock className="w-3 h-3" /> On Track: {sla.remainingHours}h left
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 text-[#E67E22] animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Synchronizing Field Assignments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-red-800 mb-1">Failed to Load Dashboard</h2>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchDashboard()}
            className="px-4 py-2 bg-[#2C3E50] text-white rounded-lg hover:bg-[#34495E] text-sm font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const workerInfo = data?.workerInfo;
  const kpis = data?.kpis || {};
  const priorityWork = data?.priorityWork || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header with Personalized Greeting & Operational Details */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-[#2C3E50]">
              {data?.greeting || 'Welcome'}, {workerInfo?.name} 👋
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-600">
            <span className="font-semibold text-[#E67E22] flex items-center gap-1">
              🏢 {workerInfo?.department}
            </span>
            <span className="text-gray-400">•</span>
            <span className="font-mono font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">
              ID: {workerInfo?.workerIdCode}
            </span>
            <span className="text-gray-400">•</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {workerInfo?.status || 'AVAILABLE'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <button
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            className="p-2.5 text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
            title="Refresh Assignments"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#E67E22]' : ''}`} />
          </button>
          <Link
            to="/worker/map"
            className="px-4 py-2.5 bg-[#2C3E50] hover:bg-[#34495E] text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Compass className="w-4 h-4 text-[#E67E22]" /> Field Map View
          </Link>
        </div>
      </div>

      {/* 2. Database-Backed KPI Cards (Clickable for instant filtering) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase font-bold tracking-wider text-gray-500">Field Operations KPI Metrics</p>
          {activeKpiKey && (
            <button
              onClick={() => {
                setActiveKpiKey(null);
                setStatusFilter('ALL');
                setSeverityFilter('ALL');
                setSlaFilter('ALL');
              }}
              className="text-xs font-semibold text-[#E67E22] hover:underline"
            >
              Reset KPI Filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Assigned Today */}
          <div
            onClick={() => handleKpiClick('assignedToday', { status: 'ASSIGNED' })}
            className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-xs hover:border-[#E67E22] ${
              activeKpiKey === 'assignedToday' ? 'ring-2 ring-[#E67E22] bg-orange-50/40' : 'border-gray-200'
            }`}
          >
            <p className="text-xs font-medium text-gray-500 truncate">Assigned Today</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{kpis.assignedToday || 0}</p>
          </div>

          {/* Accepted */}
          <div
            onClick={() => handleKpiClick('accepted', { status: 'ACCEPTED' })}
            className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-xs hover:border-amber-500 ${
              activeKpiKey === 'accepted' ? 'ring-2 ring-amber-500 bg-amber-50/40' : 'border-gray-200'
            }`}
          >
            <p className="text-xs font-medium text-gray-500 truncate">Accepted</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{kpis.accepted || 0}</p>
          </div>

          {/* In Progress */}
          <div
            onClick={() => handleKpiClick('inProgress', { status: 'IN_PROGRESS' })}
            className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-xs hover:border-blue-500 ${
              activeKpiKey === 'inProgress' ? 'ring-2 ring-blue-500 bg-blue-50/40' : 'border-gray-200'
            }`}
          >
            <p className="text-xs font-medium text-gray-500 truncate">In Progress</p>
            <p className="text-2xl font-black text-blue-700 mt-1">{kpis.inProgress || 0}</p>
          </div>

          {/* Critical */}
          <div
            onClick={() => handleKpiClick('critical', { severity: 'CRITICAL' })}
            className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-xs hover:border-red-500 ${
              activeKpiKey === 'critical' ? 'ring-2 ring-red-500 bg-red-50/40' : 'border-gray-200'
            }`}
          >
            <p className="text-xs font-medium text-red-600 font-semibold truncate flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Critical
            </p>
            <p className="text-2xl font-black text-red-700 mt-1">{kpis.critical || 0}</p>
          </div>

          {/* Due Today / SLA Due Soon */}
          <div
            onClick={() => handleKpiClick('slaDueSoon', { sla: 'DUE_SOON' })}
            className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-xs hover:border-yellow-500 ${
              activeKpiKey === 'slaDueSoon' ? 'ring-2 ring-yellow-500 bg-yellow-50/40' : 'border-gray-200'
            }`}
          >
            <p className="text-xs font-medium text-yellow-700 font-semibold truncate flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> SLA Due Soon
            </p>
            <p className="text-2xl font-black text-yellow-800 mt-1">{kpis.slaDueSoon || 0}</p>
          </div>

          {/* SLA Breached */}
          <div
            onClick={() => handleKpiClick('slaBreached', { sla: 'BREACHED' })}
            className={`bg-white rounded-xl p-4 border transition-all cursor-pointer shadow-xs hover:border-red-700 ${
              activeKpiKey === 'slaBreached' ? 'ring-2 ring-red-700 bg-red-50/60' : 'border-gray-200'
            }`}
          >
            <p className="text-xs font-bold text-red-700 truncate flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Breached
            </p>
            <p className="text-2xl font-black text-red-900 mt-1">{kpis.slaBreached || 0}</p>
          </div>
        </div>
      </div>

      {/* 3. Priority Work Queue (High Criticality / Imminent SLA) */}
      {priorityWork.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xs border-2 border-red-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-100 rounded-lg text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Immediate Priority Attention</h2>
                <p className="text-xs text-gray-500">Critical severity or SLA deadline approaching within 2 hours</p>
              </div>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
              {priorityWork.length} Tasks
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {priorityWork.map((task: any) => (
              <div
                key={task.id}
                className="bg-red-50/40 rounded-xl p-4 border border-red-200 flex flex-col justify-between hover:bg-red-50/70 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-gray-600">{task.code}</span>
                    <div className="flex items-center gap-1.5">
                      {getSeverityBadge(task.severity)}
                      {task.priority && (
                        <span className="px-1.5 py-0.5 bg-gray-200 text-gray-800 rounded text-[11px] font-bold">
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{task.title}</h3>
                  <p className="text-xs text-gray-600 flex items-center gap-1 mt-1 truncate">
                    <MapPin className="w-3 h-3 text-gray-400 shrink-0" /> {task.address || 'Reported Location'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {getSlaBadge(task.sla)}
                    {getStatusBadge(task.status)}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-red-200/60 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">
                    {task.distance ? `📍 ${task.distance} away` : '📍 Location ready'}
                  </span>
                  <div className="flex items-center gap-2">
                    {task.latitude && task.longitude && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-white hover:bg-gray-100 text-[#2C3E50] border border-gray-300 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <Navigation className="w-3 h-3 text-blue-600" /> Navigate
                      </a>
                    )}
                    <Link
                      to={`/worker/tasks/${task.assignmentId || task.id}`}
                      className="px-3 py-1 bg-[#E67E22] hover:bg-[#D35400] text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      Handle <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Complete Assignments List with Responsive Filters */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by code, title, address, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#E67E22]"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setActiveKpiKey(null);
                }}
                className="px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-[#E67E22]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">All Active Work</option>
                <option value="ASSIGNED">Assigned (New)</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING_VERIFICATION">Pending Verification</option>
                <option value="REWORK_REQUIRED">Rework Required</option>
                <option value="EVIDENCE_REQUIRED">Evidence Required</option>
                <option value="RESOLVED">Resolved</option>
              </select>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setActiveKpiKey(null);
                }}
                className="px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-[#E67E22]"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              {/* SLA Filter */}
              <select
                value={slaFilter}
                onChange={(e) => {
                  setSlaFilter(e.target.value);
                  setActiveKpiKey(null);
                }}
                className="px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-[#E67E22]"
              >
                <option value="ALL">All SLA States</option>
                <option value="ON_TRACK">On Track</option>
                <option value="DUE_SOON">Due Soon</option>
                <option value="BREACHED">Breached</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
            <span>Showing <strong className="text-gray-900">{filteredTasks.length}</strong> assigned complaints</span>
            {(statusFilter !== 'ALL' || severityFilter !== 'ALL' || priorityFilter !== 'ALL' || slaFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setSeverityFilter('ALL');
                  setPriorityFilter('ALL');
                  setSlaFilter('ALL');
                  setSearchQuery('');
                  setActiveKpiKey(null);
                }}
                className="text-[#E67E22] font-semibold hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Task Cards List (Mobile-Optimized) */}
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center">
            <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800">No Assignments Match Filters</h3>
            <p className="text-sm text-gray-500 mt-1">Try relaxing your search terms or filter criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTasks.map((task: any) => (
              <div
                key={task.id}
                className="p-4 sm:p-5 hover:bg-gray-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-800 rounded">
                      {task.code || 'CC-NEW'}
                    </span>
                    {getStatusBadge(task.status)}
                    {getSeverityBadge(task.severity)}
                    {task.priority && (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[11px] font-bold">
                        {task.priority}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-medium">
                      Category: <strong className="text-gray-700">{task.category || 'General'}</strong>
                    </span>
                  </div>

                  <Link to={`/worker/tasks/${task.assignmentId || task.id}`} className="group block">
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-[#E67E22] transition-colors line-clamp-1">
                      {task.title}
                    </h3>
                  </Link>

                  <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                    {task.description}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate max-w-[240px] sm:max-w-md">{task.address || 'Reported Location'}</span>
                    </span>
                    {task.distance && (
                      <span className="font-semibold text-gray-700">
                        📍 {task.distance}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      Assigned: {new Date(task.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-2">
                    {getSlaBadge(task.sla)}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                  {task.status === 'ASSIGNED' && (
                    <button
                      onClick={(e) => handleAcceptAssignment(e, task.assignmentId || task.id)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      Accept Task
                    </button>
                  )}

                  {task.latitude && task.longitude && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-600 hover:text-blue-600 bg-white hover:bg-blue-50 border border-gray-200 rounded-xl text-xs font-semibold flex items-center justify-center transition-colors"
                      title="Navigate in Google Maps"
                    >
                      <Navigation className="w-4 h-4" />
                    </a>
                  )}

                  <Link
                    to={`/worker/tasks/${task.assignmentId || task.id}`}
                    className="px-4 py-2 bg-[#2C3E50] hover:bg-[#34495E] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
