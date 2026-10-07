import { useEffect, useState } from 'react';
import { 
  BarChart3, 
  PieChart, 
  Building2, 
  CheckSquare, 
  Loader2, 
  MapPin,
  Clock,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/adminApi';

export default function AdminAnalytics() {
  const [data, setData] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'departments' | 'workers' | 'locality'>('overview');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsRes, workersRes, deptsRes] = await Promise.all([
        adminApi.getAnalytics(),
        adminApi.getWorkers(),
        adminApi.getDepartments()
      ]);
      setData(analyticsRes);
      setWorkers(workersRes.workers || []);
      setDepartments(deptsRes.departments || []);
    } catch (e: any) {
      console.error('Error fetching analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="animate-spin h-10 w-10 text-red-600" />
      </div>
    );
  }

  const overview = data?.overview || {
    total: 0,
    resolved: 0,
    inProgress: 0,
    pending: 0,
    duplicateRate: 0,
    verificationRate: 0,
    avgResolutionHours: 24
  };

  const byCategory = data?.byCategory || {};
  const bySeverity = data?.bySeverity || {};
  const byLocality = data?.byLocality || {};

  const totalCatCount = Object.values(byCategory).reduce((a: any, b: any) => a + b, 0) as number || 1;

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-red-600" />
            CivicConnect Intelligence & Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time municipal performance, department resolution speeds, and civic engagement metrics
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition"
        >
          Refresh Analytics
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Reported</span>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-gray-900">{overview.total}</div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <span className="text-green-600 font-bold">{overview.resolved} Resolved</span> • 
            <span className="text-blue-600 font-bold">{overview.inProgress} Active</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Community Verification</span>
            <CheckSquare className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-3 text-3xl font-black text-green-700">{overview.verificationRate}%</div>
          <p className="text-xs text-gray-400 mt-1">Complaints physically verified by citizens</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Duplicate Rate</span>
            <PieChart className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-3 text-3xl font-black text-amber-600">{overview.duplicateRate}%</div>
          <p className="text-xs text-gray-400 mt-1">Clustered by AI duplicate detection</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Avg Resolution Speed</span>
            <Clock className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-3 text-3xl font-black text-blue-600">~{overview.avgResolutionHours}h</div>
          <p className="text-xs text-gray-400 mt-1">Average time from assignment to close</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setTab('overview')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            tab === 'overview' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Category & Severity Breakdown
        </button>
        <button
          onClick={() => setTab('departments')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            tab === 'departments' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Department Performance ({departments.length})
        </button>
        <button
          onClick={() => setTab('workers')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            tab === 'workers' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Worker Performance ({workers.length})
        </button>
        <button
          onClick={() => setTab('locality')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            tab === 'locality' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Problem Localities
        </button>
      </div>

      {/* Tab 1: Category & Severity Breakdown */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Categories */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center justify-between">
              <span>Complaints by Category</span>
              <span className="text-xs font-medium text-gray-500">Distribution</span>
            </h2>
            <div className="space-y-3 pt-2">
              {Object.keys(byCategory).length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No categories recorded yet.</p>
              ) : (
                Object.entries(byCategory).map(([cat, count]: [string, any]) => {
                  const pct = Math.round((count / totalCatCount) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-gray-700">
                        <span>{cat}</span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-red-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Severity Breakdown */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center justify-between">
              <span>Severity Breakdown</span>
              <ShieldAlert className="h-4 w-4 text-red-600" />
            </h2>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <span className="text-xs font-bold text-red-700 uppercase">Critical</span>
                <div className="text-2xl font-black text-red-900 mt-1">{bySeverity.CRITICAL || 0}</div>
                <p className="text-[11px] text-red-600 mt-0.5">SLA: 4 hours resolution target</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                <span className="text-xs font-bold text-orange-700 uppercase">High</span>
                <div className="text-2xl font-black text-orange-900 mt-1">{bySeverity.HIGH || 0}</div>
                <p className="text-[11px] text-orange-600 mt-0.5">SLA: 24 hours resolution target</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-xs font-bold text-blue-700 uppercase">Medium</span>
                <div className="text-2xl font-black text-blue-900 mt-1">{bySeverity.MEDIUM || 0}</div>
                <p className="text-[11px] text-blue-600 mt-0.5">SLA: 48 hours resolution target</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs font-bold text-gray-700 uppercase">Low</span>
                <div className="text-2xl font-black text-gray-900 mt-1">{bySeverity.LOW || 0}</div>
                <p className="text-[11px] text-gray-500 mt-0.5">SLA: 72 hours resolution target</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Department Performance */}
      {tab === 'departments' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900">Municipal Department Operational Metrics</h2>
            <p className="text-xs text-gray-500 mt-1">Comparative resolution, complaint workload, and SLA compliance</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Total Assigned</th>
                  <th className="px-6 py-3.5">Active</th>
                  <th className="px-6 py-3.5">Resolved</th>
                  <th className="px-6 py-3.5">Resolution Rate</th>
                  <th className="px-6 py-3.5">SLA Standard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No departments configured.</td>
                  </tr>
                ) : (
                  departments.map((d: any) => {
                    const total = d.total_issues || 0;
                    const resolved = d.resolved_issues || 0;
                    const active = d.active_issues || 0;
                    const rate = total > 0 ? Math.round((resolved / total) * 100) : 100;
                    return (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {d.name}
                        </td>
                        <td className="px-6 py-4 text-gray-700 font-semibold">{total}</td>
                        <td className="px-6 py-4 text-blue-600 font-bold">{active}</td>
                        <td className="px-6 py-4 text-green-600 font-bold">{resolved}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 h-2 rounded-full overflow-hidden">
                              <div className="bg-green-600 h-full rounded-full" style={{ width: `${rate}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-700">{rate}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-gray-500">{d.sla_hours || 48}h</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Worker Performance */}
      {tab === 'workers' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900">Field Worker Productivity & Task Allocation</h2>
            <p className="text-xs text-gray-500 mt-1">Live active task count, completed repairs, and on-duty status</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Technician</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Duty Status</th>
                  <th className="px-6 py-3.5">Active Tasks</th>
                  <th className="px-6 py-3.5">Resolved Tasks</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {workers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No field technicians registered.</td>
                  </tr>
                ) : (
                  workers.map((w: any) => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{w.name}</div>
                        <div className="text-xs text-gray-400">{w.phone_number || 'No phone'}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{w.department_name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          w.is_available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {w.is_available ? 'ON DUTY' : 'OFF DUTY'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-blue-600">{w.active_tasks_count}</td>
                      <td className="px-6 py-4 font-bold text-green-600">{w.resolved_tasks_count}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/admin/workers`}
                          className="text-xs text-red-600 hover:text-red-700 font-bold inline-flex items-center gap-1"
                        >
                          Manage <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Problem Localities */}
      {tab === 'locality' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center justify-between">
            <span>Most Problematic Localities & Neighborhoods</span>
            <MapPin className="h-4 w-4 text-red-600" />
          </h2>
          <div className="divide-y divide-gray-100">
            {Object.keys(byLocality).length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">No location coordinates registered yet.</p>
            ) : (
              Object.entries(byLocality)
                .sort((a: any, b: any) => b[1] - a[1])
                .map(([loc, count]: [string, any], idx) => (
                  <div key={loc} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-gray-900 text-sm">{loc}</span>
                    </div>
                    <span className="font-bold text-sm text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                      {count} reports
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
