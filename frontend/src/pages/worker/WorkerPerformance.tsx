import { useEffect, useState } from 'react';
import { 
  BarChart2, CheckCircle2, ShieldCheck, 
  Award, Loader2, RefreshCw 
} from 'lucide-react';
import { workerApi } from '../../services/workerApi';

export default function WorkerPerformance() {
  const [perf, setPerf] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPerformance();
  }, []);

  const loadPerformance = async () => {
    setLoading(true);
    try {
      const data = await workerApi.getPerformance();
      setPerf(data);
    } catch (err) {
      console.error('Failed to load worker performance:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#E67E22] animate-spin mb-4" />
        <p className="text-gray-600 font-semibold">Aggregating Field Performance Metrics...</p>
      </div>
    );
  }

  const p = perf || {};

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#2C3E50] flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-[#E67E22]" /> My Field Operations Performance
          </h1>
          <p className="text-sm text-gray-600">
            Database-backed operational efficacy, SLA compliance score, and resolution quality metrics.
          </p>
        </div>

        <button
          onClick={loadPerformance}
          className="p-2.5 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-xl"
          title="Refresh Metrics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#2C3E50] to-[#34495E] text-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-orange-300">SLA Compliance</span>
            <Award className="w-5 h-5 text-[#E67E22]" />
          </div>
          <div className="my-3">
            <span className="text-4xl font-black">{p.slaComplianceRate || 100}%</span>
            <p className="text-xs text-gray-300 mt-1">Within department SLA target</p>
          </div>
          <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-[#E67E22] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, p.slaComplianceRate || 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-gray-500">Evidence Approval</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="my-3">
            <span className="text-4xl font-black text-gray-900">{p.evidenceApprovalRate || 100}%</span>
            <p className="text-xs text-gray-500 mt-1">First-pass admin verification approval</p>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, p.evidenceApprovalRate || 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-gray-500">Total Completed</span>
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="my-3">
            <span className="text-4xl font-black text-gray-900">{p.completed || 0}</span>
            <p className="text-xs text-gray-500 mt-1">Civic issues repaired and verified</p>
          </div>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block w-fit">
            Active Load: {p.activeAssignments || 0}
          </span>
        </div>
      </div>

      {/* Operational Breakdown Grid */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-gray-900">Task Volume & Lifecycle Breakdown</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded-xl">
            <span className="text-xs font-semibold text-gray-500 block">Total Assigned</span>
            <span className="text-2xl font-black text-gray-900 mt-1 block">{p.totalAssigned || 0}</span>
          </div>

          <div className="p-4 bg-amber-50 rounded-xl">
            <span className="text-xs font-semibold text-amber-700 block">Accepted & Queued</span>
            <span className="text-2xl font-black text-amber-800 mt-1 block">{p.accepted || 0}</span>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl">
            <span className="text-xs font-semibold text-blue-700 block">Currently In Progress</span>
            <span className="text-2xl font-black text-blue-800 mt-1 block">{p.inProgress || 0}</span>
          </div>

          <div className="p-4 bg-purple-50 rounded-xl">
            <span className="text-xs font-semibold text-purple-700 block">Pending Admin Review</span>
            <span className="text-2xl font-black text-purple-800 mt-1 block">{p.pendingVerification || 0}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-xs font-bold text-emerald-800 block">SLA Target Met</span>
            <span className="text-xl font-bold text-emerald-900 mt-1 block">{p.slaCompleted || 0} tasks</span>
            <p className="text-[11px] text-emerald-700 mt-0.5">Repairs completed before deadline</p>
          </div>

          <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
            <span className="text-xs font-bold text-rose-800 block">SLA Breached</span>
            <span className="text-xl font-bold text-rose-900 mt-1 block">{p.slaBreached || 0} tasks</span>
            <p className="text-[11px] text-rose-700 mt-0.5">Tasks exceeded target hours</p>
          </div>

          <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
            <span className="text-xs font-bold text-orange-800 block">Rework Submissions</span>
            <span className="text-xl font-bold text-orange-900 mt-1 block">{p.reworkRequired || 0} tasks</span>
            <p className="text-[11px] text-orange-700 mt-0.5">Returned by admin for correction</p>
          </div>
        </div>
      </div>
    </div>
  );
}
