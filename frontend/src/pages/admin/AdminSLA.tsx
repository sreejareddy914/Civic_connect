import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  Building2,
  UserCheck
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

export default function AdminSLA() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'BREACHED' | 'DUE_SOON' | 'ON_TRACK'>('ALL');

  useEffect(() => {
    fetchSLA();
  }, []);

  const fetchSLA = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSLA();
      setData(res);
    } catch (e: any) {
      console.error('Error fetching SLA:', e);
    } finally {
      setLoading(false);
    }
  };

  const getSlaBadge = (status: string) => {
    switch (status) {
      case 'BREACHED':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> SLA BREACHED</span>;
      case 'DUE_SOON':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"><Clock className="h-3 w-3" /> DUE SOON</span>;
      case 'ON_TRACK':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1"><Clock className="h-3 w-3" /> ON TRACK</span>;
      case 'RESOLVED_WITHIN_SLA':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> RESOLVED ON TIME</span>;
      case 'RESOLVED_AFTER_SLA':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> RESOLVED LATE</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="animate-spin h-10 w-10 text-red-600" />
      </div>
    );
  }

  const summary = data?.summary || { total: 0, onTrack: 0, dueSoon: 0, breached: 0, complianceRate: 100 };
  const issues = (data?.issues || []).filter((i: any) => {
    if (filter === 'ALL') return true;
    return i.sla?.status === filter;
  });

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-red-600" />
            Service Level Agreement (SLA) Operations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time compliance monitoring, breach tracking, and resolution deadlines based on severity
          </p>
        </div>
        <button
          onClick={fetchSLA}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition"
        >
          Refresh SLA Metrics
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Compliance Rate</span>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-3 text-3xl font-black text-gray-900">{summary.complianceRate}%</div>
          <p className="text-xs text-gray-400 mt-1">Compliant with resolution deadlines</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">On Track</span>
            <CheckCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-3 text-3xl font-black text-blue-600">{summary.onTrack}</div>
          <p className="text-xs text-gray-400 mt-1">Within normal time margins</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Due Soon</span>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-3 text-3xl font-black text-amber-700">{summary.dueSoon}</div>
          <p className="text-xs text-amber-600 mt-1">Within 20% of SLA deadline</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-red-200 bg-red-50/30 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-800">SLA Breached</span>
            <ShieldAlert className="h-5 w-5 text-red-600" />
          </div>
          <div className="mt-3 text-3xl font-black text-red-600">{summary.breached}</div>
          <p className="text-xs text-red-500 mt-1">Overdue complaints requiring escalation</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Monitored</span>
            <Clock className="h-5 w-5 text-gray-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-gray-900">{summary.total}</div>
          <p className="text-xs text-gray-400 mt-1">Active and closed complaints</p>
        </div>
      </div>

      {/* SLA Policy Standard Information */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-4 flex items-center gap-2">
          Municipal Resolution Service Standards (SLA Target Thresholds)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-red-50 rounded-lg border border-red-100">
            <div className="text-xs font-bold text-red-700">CRITICAL</div>
            <div className="text-xl font-black text-red-900 mt-1">4 Hours</div>
            <div className="text-[11px] text-red-600 mt-0.5">Life safety, severe hazards</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
            <div className="text-xs font-bold text-orange-700">HIGH</div>
            <div className="text-xl font-black text-orange-900 mt-1">24 Hours</div>
            <div className="text-[11px] text-orange-600 mt-0.5">Major arterial roads, main bursts</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-xs font-bold text-blue-700">MEDIUM</div>
            <div className="text-xl font-black text-blue-900 mt-1">48 Hours</div>
            <div className="text-[11px] text-blue-600 mt-0.5">Streetlights, garbage dumps</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs font-bold text-gray-700">LOW</div>
            <div className="text-xl font-black text-gray-900 mt-1">72 Hours</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Minor beautification, signage</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Complaint Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                filter === 'ALL' ? 'bg-[#1e293b] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              All Complaints ({summary.total})
            </button>
            <button
              onClick={() => setFilter('BREACHED')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                filter === 'BREACHED' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
              }`}
            >
              Breached ({summary.breached})
            </button>
            <button
              onClick={() => setFilter('DUE_SOON')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                filter === 'DUE_SOON' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              Due Soon ({summary.dueSoon})
            </button>
            <button
              onClick={() => setFilter('ON_TRACK')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                filter === 'ON_TRACK' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
              }`}
            >
              On Track ({summary.onTrack})
            </button>
          </div>
          <span className="text-xs text-gray-500 font-medium">Showing {issues.length} entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Code / Complaint</th>
                <th className="px-6 py-3.5">Severity / Target</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Assigned Worker</th>
                <th className="px-6 py-3.5">Elapsed Time</th>
                <th className="px-6 py-3.5">SLA Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {issues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No complaints match the selected SLA filter.
                  </td>
                </tr>
              ) : (
                issues.map((item: any) => {
                  const dept = Array.isArray(item.department) ? item.department[0]?.name : item.department?.name;
                  const worker = item.assigned_worker?.profile?.full_name || 'Unassigned';
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs font-bold text-gray-600">{item.code || 'PENDING'}</div>
                        <div className="font-medium text-gray-900 line-clamp-1">{item.title}</div>
                        <div className="text-xs text-gray-400">Reported {new Date(item.created_at).toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          item.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                          item.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          item.severity === 'LOW' ? 'bg-gray-100 text-gray-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {item.severity}
                        </span>
                        <div className="text-xs text-gray-500 mt-1 font-semibold">{item.sla?.targetHours}h Target</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Building2 className="h-3.5 w-3.5 text-gray-400" />
                          <span className="font-medium">{dept || 'General'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <UserCheck className="h-3.5 w-3.5 text-gray-400" />
                          <span className={worker === 'Unassigned' ? 'text-amber-600 italic font-semibold' : 'font-medium'}>
                            {worker}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">{item.sla?.elapsedHours}h</div>
                        <div className="text-xs text-gray-400">of {item.sla?.targetHours}h allowed</div>
                      </td>
                      <td className="px-6 py-4">
                        {getSlaBadge(item.sla?.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/admin/issues/${item.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-md transition"
                        >
                          Review <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
