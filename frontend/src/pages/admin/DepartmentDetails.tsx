import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Building2, 
  Users, 
  CheckSquare, 
  Clock, 
  UserPlus, 
  Edit2, 
  ExternalLink, 
  CheckCircle2, 
  Loader2, 
  RefreshCw, 
  Briefcase, 
  Mail, 
  Phone,
  Layers
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { supabase } from '../../lib/supabase';
import type { 
  DepartmentDetailsResponse, 
  DepartmentWorker
} from '../../types/department';

export default function DepartmentDetails() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<DepartmentDetailsResponse | null>(null);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerPassword, setWorkerPassword] = useState('worker123');
  const [workerPhone, setWorkerPhone] = useState('');
  const [savingWorker, setSavingWorker] = useState(false);

  const [reassignWorkerItem, setReassignWorkerItem] = useState<DepartmentWorker | null>(null);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const fetchDepartmentData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [res, deptsRes] = await Promise.all([
        adminApi.getDepartment(id),
        adminApi.getDepartments()
      ]);
      setData(res);
      setAllDepartments(deptsRes.departments || []);
      setEditName(res.department.name);
      setEditDesc(res.department.description || '');
    } catch (err: any) {
      console.error('Error fetching department details:', err);
      setError(err.message || 'Department not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDepartmentData();

    // Supabase Realtime subscriptions for real-time synchronization
    const channel = supabase
      .channel(`admin-dept-details-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workers' },
        () => {
          fetchDepartmentData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'departments', filter: `id=eq.${id}` },
        () => {
          fetchDepartmentData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues', filter: `department_id=eq.${id}` },
        () => {
          fetchDepartmentData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchDepartmentData]);

  // Handle Edit Department
  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editName.trim()) return alert('Department name is required');
    try {
      setSavingDept(true);
      await adminApi.updateDepartment(id, {
        name: editName.trim(),
        description: editDesc.trim() || null
      });
      setShowEditModal(false);
      await fetchDepartmentData();
    } catch (err: any) {
      alert(`Error updating department: ${err.message}`);
    } finally {
      setSavingDept(false);
    }
  };

  // Handle Add Worker to this department
  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !workerName || !workerEmail) return alert('Please enter all required fields');
    try {
      setSavingWorker(true);
      await adminApi.createWorker({
        full_name: workerName.trim(),
        email: workerEmail.trim(),
        password: workerPassword,
        phone_number: workerPhone.trim() || null,
        department_id: id
      });
      setShowAddWorkerModal(false);
      setWorkerName('');
      setWorkerEmail('');
      setWorkerPhone('');
      await fetchDepartmentData();
    } catch (err: any) {
      alert(`Error adding worker: ${err.message}`);
    } finally {
      setSavingWorker(false);
    }
  };

  // Handle Reassign Worker to another department
  const handleReassignWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignWorkerItem || !targetDeptId) return alert('Select target department');
    try {
      setReassigning(true);
      await adminApi.updateWorker(reassignWorkerItem.profile_id, {
        department_id: targetDeptId
      });
      setReassignWorkerItem(null);
      await fetchDepartmentData();
    } catch (err: any) {
      alert(`Error reassigning worker: ${err.message}`);
    } finally {
      setReassigning(false);
    }
  };

  // Handle Worker status toggle
  const handleWorkerStatusChange = async (workerId: string, newStatus: string) => {
    try {
      await adminApi.updateWorker(workerId, { status: newStatus });
      await fetchDepartmentData();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // Loading State
  if (loading && !data) {
    return (
      <div className="flex flex-col justify-center items-center py-40 min-h-[70vh]">
        <Loader2 className="animate-spin h-10 w-10 text-red-600 mb-3" />
        <p className="text-sm font-semibold text-gray-700">Loading department intelligence...</p>
        <p className="text-xs text-gray-400 mt-1">Aggregating live field personnel, task logs, and SLA compliance metrics</p>
      </div>
    );
  }

  // Error / Not Found State
  if (error || !data) {
    return (
      <div className="p-8 max-w-5xl mx-auto py-24 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm">
          <Building2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Department Not Found</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          {error || "The municipal department you requested could not be located or may have been removed."}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/admin/departments"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Departments
          </Link>
        </div>
      </div>
    );
  }

  const { department, statistics, workers, recentTasks, sla, analytics } = data;
  const activeWorkerPercent = statistics.totalWorkers > 0 
    ? Math.round((statistics.activeWorkers / statistics.totalWorkers) * 100) 
    : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Breadcrumb & Actions Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/admin/departments"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Departments
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDepartmentData}
              className="p-2 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
              title="Refresh Department Data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 hover:text-gray-900 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Edit2 className="h-3.5 w-3.5 text-gray-500" /> Edit Department
            </button>
            <button
              onClick={() => setShowAddWorkerModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors shadow-sm"
            >
              <UserPlus className="h-3.5 w-3.5" /> Add Worker
            </button>
          </div>
        </div>

        {/* Department Info Header Banner */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 shrink-0">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {department.name}
                </h1>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active Division
                </span>
              </div>
              <p className="text-gray-500 text-sm mt-1 max-w-2xl">
                {department.description || 'Dedicated municipal division for civic maintenance, emergency complaints, and field worker dispatch.'}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-400 mt-3 font-mono">
                <span>ID: {department.id}</span>
                <span>•</span>
                <span>Established: {new Date(department.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 shrink-0">
            <Link
              to={`/admin/issues?department_id=${department.id}`}
              className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition flex items-center gap-1.5 border border-gray-200"
            >
              <CheckSquare className="h-3.5 w-3.5 text-gray-500" /> View Tasks ({statistics.totalAssignedTasks || 0})
            </Link>
            <Link
              to="/admin/workers"
              className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition flex items-center gap-1.5 border border-gray-200"
            >
              <Users className="h-3.5 w-3.5 text-gray-500" /> Manage Staff
            </Link>
          </div>
        </div>
      </div>

      {/* KPI SUMMARY CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Workers */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Workers</p>
            <div className="p-2.5 bg-gray-50 rounded-xl text-gray-700">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-gray-900">{statistics.totalWorkers}</div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <span>{statistics.activeWorkers} active</span>
              <span>•</span>
              <span className="text-gray-400">{statistics.inactiveWorkers || 0} off duty</span>
            </p>
          </div>
        </div>

        {/* Active Workers */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 border-l-4 border-l-emerald-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Active Workers</p>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-emerald-700">
              {statistics.activeWorkers} <span className="text-base font-semibold text-gray-400">/ {statistics.totalWorkers}</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${activeWorkerPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Assigned Tasks */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 border-l-4 border-l-blue-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Assigned Tasks</p>
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-blue-700">{statistics.totalAssignedTasks}</div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <span className="text-blue-600 font-bold">{statistics.inProgress || 0} In Progress</span>
              <span>•</span>
              <span className="text-green-600 font-bold">{(statistics.resolved || 0) + (statistics.closed || 0)} Done</span>
            </p>
          </div>
        </div>

        {/* SLA Performance */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 border-l-4 border-l-indigo-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">SLA Performance</p>
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-indigo-700">{sla.complianceRate}%</div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-bold">{sla.onTrack + sla.resolvedWithin} On Track</span>
              <span>•</span>
              <span className="text-red-600 font-bold">{sla.breached} Breached</span>
            </p>
          </div>
        </div>
      </div>

      {/* TASK LIFECYCLE & SLA DETAILS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Lifecycle Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-red-600" /> Task Lifecycle Distribution
              </h3>
              <p className="text-xs text-gray-500">Real tasks categorised by current civic workflow state</p>
            </div>
            <span className="text-xs font-black text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md">
              {statistics.completionRate}% Completed
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Pending Review</p>
              <p className="text-xl font-black text-gray-800 mt-1">{statistics.pending || 0}</p>
              <span className="text-[10px] text-gray-400">Reported/Verified</span>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-[10px] font-bold text-blue-600 uppercase">Active Working</p>
              <p className="text-xl font-black text-blue-800 mt-1">
                {(statistics.assigned || 0) + (statistics.accepted || 0) + (statistics.inProgress || 0)}
              </p>
              <span className="text-[10px] text-blue-500">{statistics.inProgress || 0} in progress</span>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-[10px] font-bold text-amber-600 uppercase">Verification</p>
              <p className="text-xl font-black text-amber-800 mt-1">{statistics.citizenVerification || 0}</p>
              <span className="text-[10px] text-amber-500">Citizen check</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase">Resolved</p>
              <p className="text-xl font-black text-emerald-800 mt-1">
                {(statistics.resolved || 0) + (statistics.closed || 0)}
              </p>
              <span className="text-[10px] text-emerald-600">{statistics.resolved || 0} resolved</span>
            </div>
          </div>

          {/* Severity Progress Indicators */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Tasks By Severity</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center justify-between p-2.5 bg-red-50/50 rounded-lg border border-red-100">
                <span className="text-xs font-bold text-red-700">Critical</span>
                <span className="text-xs font-black text-red-800 bg-red-100 px-2 py-0.5 rounded">
                  {analytics.bySeverity.CRITICAL || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-orange-50/50 rounded-lg border border-orange-100">
                <span className="text-xs font-bold text-orange-700">High</span>
                <span className="text-xs font-black text-orange-800 bg-orange-100 px-2 py-0.5 rounded">
                  {analytics.bySeverity.HIGH || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-amber-50/50 rounded-lg border border-amber-100">
                <span className="text-xs font-bold text-amber-700">Medium</span>
                <span className="text-xs font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  {analytics.bySeverity.MEDIUM || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-xs font-bold text-gray-700">Low</span>
                <span className="text-xs font-black text-gray-800 bg-gray-200 px-2 py-0.5 rounded">
                  {analytics.bySeverity.LOW || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SLA Health Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600" /> SLA Compliance
              </h3>
              <span className={`text-xs font-black px-2.5 py-1 rounded-md ${
                sla.complianceRate >= 90 ? 'bg-emerald-50 text-emerald-700' :
                sla.complianceRate >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
              }`}>
                {sla.complianceRate}% Target
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Service Level Agreement health calculated against dynamic severity thresholds.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> On Track
                </span>
                <span className="font-bold text-gray-900">{sla.onTrack} tasks</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Due Soon (&lt; 25% Time)
                </span>
                <span className="font-bold text-gray-900">{sla.dueSoon} tasks</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span> Breached SLA
                </span>
                <span className="font-bold text-red-600">{sla.breached} tasks</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Resolved Within Target
                </span>
                <span className="font-bold text-emerald-700">{sla.resolvedWithin} tasks</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <Link
              to="/admin/sla"
              className="w-full block text-center py-2 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-700 rounded-xl transition"
            >
              Open SLA Management &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* DEPARTMENT WORKERS SECTION */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-700" />
              Department Staff ({workers.length})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Assigned field technicians, live duty status, and task workload.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/workers"
              className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            >
              View All Workers
            </Link>
            <button
              onClick={() => setShowAddWorkerModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition shadow-sm"
            >
              <UserPlus className="h-3.5 w-3.5" /> + Add Worker
            </button>
          </div>
        </div>

        {workers.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">No field technicians assigned</p>
            <p className="text-xs text-gray-400 mt-1">Add staff to this department to dispatch civic complaints.</p>
            <button
              onClick={() => setShowAddWorkerModal(true)}
              className="mt-4 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-red-600 transition"
            >
              Onboard Technician
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Worker Profile</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Active Tasks</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Resolved</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Performance</th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {workers.map((worker) => (
                  <tr key={worker.profile_id} className="hover:bg-gray-50/70 transition-colors">
                    {/* Worker Profile */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {worker.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{worker.full_name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {worker.email}</span>
                            {worker.phone_number && (
                              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {worker.phone_number}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status Dropdown */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={worker.status}
                        onChange={(e) => handleWorkerStatusChange(worker.profile_id, e.target.value)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border appearance-none cursor-pointer ${
                          worker.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          worker.status === 'BUSY' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        <option value="AVAILABLE">🟢 Available</option>
                        <option value="BUSY">🟡 Busy</option>
                        <option value="OFF_DUTY">⚪ Off Duty</option>
                      </select>
                    </td>

                    {/* Active Tasks */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-900">{worker.activeTasks}</span>
                      <span className="text-xs text-gray-400 ml-1">in progress</span>
                    </td>

                    {/* Completed Tasks */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {worker.completedTasks} completed
                      </span>
                    </td>

                    {/* Performance */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                        {worker.performanceScore}% Score
                      </span>
                    </td>

                    {/* Reassign / Manage Action */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => {
                          setReassignWorkerItem(worker);
                          setTargetDeptId('');
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                      >
                        Reassign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECENT ASSIGNED TASKS SECTION */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-gray-700" />
              Recent Tasks & Assignments ({recentTasks.length})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Live municipal tickets assigned to {department.name} with real-time status and SLA timers.
            </p>
          </div>

          <Link
            to={`/admin/issues?department_id=${department.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
          >
            All Department Issues <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentTasks.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <CheckSquare className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">No tasks currently assigned</p>
            <p className="text-xs text-gray-400 mt-1">Issues assigned to this department or its field workers will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Ticket Code & Title</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Severity</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Assigned Worker</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">SLA Status</th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {recentTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50/70 transition-colors">
                    {/* Code & Title */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                            {task.code || 'CC-NEW'}
                          </span>
                          <span className="text-sm font-bold text-gray-900 line-clamp-1">{task.title}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                          <span>{task.category || 'General'}</span>
                          <span>•</span>
                          <span>{new Date(task.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </td>

                    {/* Severity */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                        task.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                        task.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                        task.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {task.severity || 'MEDIUM'}
                      </span>
                    </td>

                    {/* Assigned Worker */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-700">
                      {task.worker_name ? (
                        <span className="font-bold text-gray-900">{task.worker_name}</span>
                      ) : (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        task.status === 'RESOLVED' || task.status === 'CLOSED' ? 'bg-emerald-50 text-emerald-800' :
                        task.status === 'IN_PROGRESS' || task.status === 'ASSIGNED' ? 'bg-blue-50 text-blue-800' :
                        task.status === 'CITIZEN_VERIFICATION' ? 'bg-purple-50 text-purple-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* SLA Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {task.sla ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          task.sla.status === 'ON_TRACK' || task.sla.status === 'RESOLVED_WITHIN_SLA'
                            ? 'bg-emerald-50 text-emerald-700'
                            : task.sla.status === 'DUE_SOON'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {task.sla.status.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        to={`/admin/issues/${task.id}`}
                        className="text-xs font-bold text-gray-900 hover:text-red-600 transition"
                      >
                        Inspect &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT DEPARTMENT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Edit Department Details</h3>
            <p className="text-xs text-gray-500">Update division title and maintenance responsibilities.</p>

            <form onSubmit={handleUpdateDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDept}
                  className="px-4 py-2 bg-gray-900 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {savingDept && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD WORKER MODAL */}
      {showAddWorkerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Add Worker to {department.name}</h3>
            <p className="text-xs text-gray-500">Create login credentials and allocate the technician to this department.</p>

            <form onSubmit={handleAddWorker} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="e.g. Anand Sharma"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={workerEmail}
                  onChange={(e) => setWorkerEmail(e.target.value)}
                  placeholder="technician@civicconnect.com"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={workerPassword}
                  onChange={(e) => setWorkerPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={workerPhone}
                  onChange={(e) => setWorkerPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWorkerModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWorker}
                  className="px-4 py-2 bg-gray-900 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {savingWorker && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Worker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASSIGN WORKER MODAL */}
      {reassignWorkerItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reassign Worker</h3>
            <p className="text-xs text-gray-500">
              Transfer <strong>{reassignWorkerItem.full_name}</strong> from <strong>{department.name}</strong> to another municipal department.
            </p>

            <form onSubmit={handleReassignWorker} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Target Department *</label>
                <select
                  required
                  value={targetDeptId}
                  onChange={(e) => setTargetDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-red-500"
                >
                  <option value="">Select Department...</option>
                  {allDepartments
                    .filter((d: any) => d.id !== department.id)
                    .map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                <p className="font-semibold">Notice:</p>
                <p className="mt-0.5">
                  Worker statistics for both {department.name} and the target department will update immediately.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignWorkerItem(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning || !targetDeptId}
                  className="px-4 py-2 bg-gray-900 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {reassigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
