import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Users, 
  ArrowRight, 
  Flame, 
  Building2, 
  MapPin, 
  ShieldAlert, 
  FileQuestion,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const res = await adminApi.getDashboard();
      setData(res);
    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-full pt-32">
        <Loader2 className="animate-spin h-10 w-10 text-red-500 mb-3" />
        <p className="text-sm font-medium text-gray-500">Loading Command Center Telemetry...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const needsVerification = data?.needsVerification || [];
  const criticalQueue = data?.criticalQueue || [];
  const slaAlerts = data?.slaAlerts || [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 uppercase tracking-wider">
              Live Command Center
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Admin Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">System-wide civic issue statistics, SLA monitoring, and administrative actions.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/admin/issues?queue=needs_verification"
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
          >
            <ShieldAlert className="h-4 w-4 mr-2" />
            Review Queue ({kpis.reported || 0})
          </Link>
        </div>
      </div>

      {/* Primary KPI Row (Clickable) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        {/* Total Issues */}
        <div 
          onClick={() => navigate('/admin/issues')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Issues</p>
          <div className="flex items-baseline justify-between mt-3">
            <p className="text-2xl font-black text-gray-900">{kpis.total || 0}</p>
            <div className="p-2 bg-gray-50 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-gray-500" />
            </div>
          </div>
        </div>

        {/* Needs Verification */}
        <div 
          onClick={() => navigate('/admin/issues?queue=needs_verification')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-red-200 hover:border-red-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between border-l-4 border-l-red-500"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Needs Verification</p>
          <div className="flex items-baseline justify-between mt-3">
            <p className="text-2xl font-black text-red-700">{kpis.reported || 0}</p>
            <div className="p-2 bg-red-50 rounded-xl">
              <ShieldAlert className="h-4 w-4 text-red-600" />
            </div>
          </div>
        </div>

        {/* Active Work */}
        <div 
          onClick={() => navigate('/admin/issues?status=IN_PROGRESS')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Active Work</p>
          <div className="flex items-baseline justify-between mt-3">
            <p className="text-2xl font-black text-blue-700">{(kpis.inProgress || 0) + (kpis.assigned || 0)}</p>
            <div className="p-2 bg-blue-50 rounded-xl">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Critical Issues */}
        <div 
          onClick={() => navigate('/admin/issues?queue=critical')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-orange-200 hover:border-orange-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Critical Issues</p>
          <div className="flex items-baseline justify-between mt-3">
            <p className="text-2xl font-black text-orange-700">{kpis.critical || 0}</p>
            <div className="p-2 bg-orange-50 rounded-xl">
              <Flame className="h-4 w-4 text-orange-600" />
            </div>
          </div>
        </div>

        {/* SLA Breached */}
        <div 
          onClick={() => navigate('/admin/sla')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-red-200 hover:border-red-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600">SLA Breached</p>
          <div className="flex items-baseline justify-between mt-3">
            <p className="text-2xl font-black text-red-600">{kpis.slaBreached || 0}</p>
            <div className="p-2 bg-red-50 rounded-xl">
              <Clock className="h-4 w-4 text-red-600" />
            </div>
          </div>
        </div>

        {/* Resolved */}
        <div 
          onClick={() => navigate('/admin/issues?status=RESOLVED')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-green-200 hover:border-green-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Resolved</p>
          <div className="flex items-baseline justify-between mt-3">
            <p className="text-2xl font-black text-green-700">{kpis.resolved || 0}</p>
            <div className="p-2 bg-green-50 rounded-xl">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Quick-Queue Pills */}
      <div className="flex flex-wrap items-center gap-3 mb-8 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Quick Queues:</span>
        <button 
          onClick={() => navigate('/admin/issues?queue=unassigned')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors flex items-center gap-1.5"
        >
          <span>Unassigned</span>
          <span className="px-1.5 py-0.2 bg-white rounded-full text-xs font-bold shadow-xs">{kpis.unassigned || 0}</span>
        </button>

        <button 
          onClick={() => navigate('/admin/issues?queue=more_info')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center gap-1.5"
        >
          <FileQuestion className="h-3.5 w-3.5 text-amber-600" />
          <span>More Info Requested</span>
          <span className="px-1.5 py-0.2 bg-white rounded-full text-xs font-bold shadow-xs">{kpis.moreInfoRequired || 0}</span>
        </button>

        <button 
          onClick={() => navigate('/admin/issues?queue=awaiting_approval')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition-colors flex items-center gap-1.5"
        >
          <span>Resolution Approval</span>
          <span className="px-1.5 py-0.2 bg-white rounded-full text-xs font-bold shadow-xs">{kpis.awaitingApproval || 0}</span>
        </button>

        <button 
          onClick={() => navigate('/admin/workers')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors flex items-center gap-1.5"
        >
          <Users className="h-3.5 w-3.5 text-gray-600" />
          <span>Active Workers</span>
          <span className="px-1.5 py-0.2 bg-white rounded-full text-xs font-bold shadow-xs">{kpis.workers || 0}</span>
        </button>

        <button 
          onClick={() => navigate('/admin/departments')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors flex items-center gap-1.5"
        >
          <Building2 className="h-3.5 w-3.5 text-gray-600" />
          <span>Departments</span>
          <span className="px-1.5 py-0.2 bg-white rounded-full text-xs font-bold shadow-xs">{kpis.departments || 0}</span>
        </button>
      </div>

      {/* Main Grid: Needs Verification & Right-hand Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Needs Verification Feed */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-bold text-gray-900">Needs Verification</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                {needsVerification.length} Pending
              </span>
            </div>
            <Link to="/admin/issues?queue=needs_verification" className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center">
              View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </div>

          {needsVerification.length === 0 ? (
            <div className="p-12 text-center text-gray-500 my-auto">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-gray-700">No new complaints awaiting verification.</p>
              <p className="text-xs text-gray-400 mt-1">All incoming citizen reports have been reviewed or assigned.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {needsVerification.map((issue: any) => (
                <div key={issue.id} className="p-6 hover:bg-gray-50/80 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono text-xs font-bold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded mr-2">
                        {issue.code || 'CC-NEW'}
                      </span>
                      <h3 className="inline font-bold text-gray-900 text-base">{issue.title}</h3>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 uppercase shrink-0">
                      New Report
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{issue.description}</p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>Category: <span className="font-medium text-gray-900">{issue.category || 'Roads'}</span></span>
                      <span>Severity: <span className={`font-semibold ${issue.severity === 'CRITICAL' ? 'text-red-600' : 'text-gray-900'}`}>{issue.severity || 'Normal'}</span></span>
                      {issue.ai_confidence && (
                        <span className="flex items-center text-indigo-600 font-medium">
                          <Sparkles className="h-3 w-3 mr-1" /> AI: {Math.round(issue.ai_confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <Link 
                      to={`/admin/issues/${issue.id}`}
                      className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors shadow-sm"
                    >
                      Review & Verify
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Queues & Quick Actions */}
        <div className="space-y-6">
          {/* Critical / Priority Queue */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-red-500" />
                <h3 className="font-bold text-gray-900 text-sm">Critical Issues Queue</h3>
              </div>
              <Link to="/admin/issues?queue=critical" className="text-xs text-red-600 font-medium hover:underline">
                View all
              </Link>
            </div>

            {criticalQueue.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No active critical emergencies.</p>
            ) : (
              <div className="space-y-3">
                {criticalQueue.map((item: any) => (
                  <Link 
                    key={item.id} 
                    to={`/admin/issues/${item.id}`}
                    className="block p-3 rounded-xl bg-red-50/50 hover:bg-red-50 border border-red-100 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-gray-900 line-clamp-1">{item.title}</p>
                      <span className="text-[10px] font-black text-red-700 bg-red-200/60 px-1.5 py-0.5 rounded uppercase">
                        Critical
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.address || 'Location on map'}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* SLA Alerts */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-gray-900 text-sm">SLA Alerts</h3>
              </div>
              <Link to="/admin/sla" className="text-xs text-red-600 font-medium hover:underline">
                SLA Dashboard
              </Link>
            </div>

            {slaAlerts.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">All active complaints are on track.</p>
            ) : (
              <div className="space-y-3">
                {slaAlerts.map((item: any) => (
                  <Link 
                    key={item.id} 
                    to={`/admin/issues/${item.id}`}
                    className="block p-3 rounded-xl bg-amber-50/40 hover:bg-amber-50 border border-amber-200/60 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-gray-900 line-clamp-1">{item.title}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        item.sla.status === 'BREACHED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.sla.status === 'BREACHED' ? 'Breached' : 'Due Soon'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {item.sla.status === 'BREACHED' 
                        ? `Overdue by ${Math.abs(item.sla.remainingHours)} hrs` 
                        : `${item.sla.remainingHours} hrs remaining`}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Command Shortcuts */}
          <div className="bg-gradient-to-br from-gray-900 to-[#1e293b] rounded-2xl p-6 text-white shadow-lg">
            <h3 className="font-bold text-base mb-1.5 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-red-400" /> Administrative Actions
            </h3>
            <p className="text-gray-300 text-xs mb-5">Access field management, dispatch work crews, or review community spatial hotspots.</p>
            
            <div className="space-y-2.5">
              <Link 
                to="/admin/map" 
                className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-xs flex justify-center items-center transition-colors"
              >
                <MapPin className="h-4 w-4 mr-2 text-red-400" /> Open Community Map
              </Link>
              <Link 
                to="/admin/workers" 
                className="w-full py-2.5 bg-white text-gray-900 hover:bg-gray-100 rounded-xl font-bold text-xs flex justify-center items-center transition-colors"
              >
                <Users className="h-4 w-4 mr-2 text-gray-900" /> Manage Field Workers
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
