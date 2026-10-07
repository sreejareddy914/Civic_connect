import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Loader2, 
  UserPlus, 
  Users, 
  Building2, 
  CheckCircle2, 
  Briefcase,
  Phone,
  Mail,
  RefreshCw,
  Edit2,
  Trash2,
  Filter
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { supabase } from '../../lib/supabase';

export default function AdminWorkers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDeptFilter = searchParams.get('department') || 'ALL';

  const [workers, setWorkers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Worker Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('worker123');
  const [phone, setPhone] = useState('');
  const [deptId, setDeptId] = useState('');

  // Edit / Reassign Worker Form state
  const [editWorker, setEditWorker] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editStatus, setEditStatus] = useState('AVAILABLE');
  const [updating, setUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [wRes, dRes] = await Promise.all([
        adminApi.getWorkers(),
        adminApi.getDepartments()
      ]);
      setWorkers(wRes.workers || []);
      setDepartments(dRes.departments || []);
      if (dRes.departments && dRes.departments.length > 0 && !deptId) {
        setDeptId(dRes.departments[0].id);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  }, [deptId]);

  useEffect(() => {
    fetchData();

    // Real-time synchronization
    const channel = supabase
      .channel('admin-workers-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !deptId) return alert('Please fill in required fields');
    setSubmitting(true);
    try {
      await adminApi.createWorker({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        phone_number: phone.trim() || null,
        department_id: deptId
      });
      setShowAddModal(false);
      setFullName('');
      setEmail('');
      setPhone('');
      await fetchData();
    } catch (err: any) {
      alert(`Error creating worker: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWorker || !editDeptId) return alert('Please fill in required fields');
    setUpdating(true);
    try {
      await adminApi.updateWorker(editWorker.profile_id, {
        department_id: editDeptId,
        status: editStatus,
        full_name: editName.trim(),
        phone_number: editPhone.trim() || null
      });
      setEditWorker(null);
      await fetchData();
    } catch (err: any) {
      alert(`Error updating worker: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = async (workerId: string, newStatus: string) => {
    try {
      await adminApi.updateWorker(workerId, { status: newStatus });
      setWorkers(workers.map(w => w.profile_id === workerId ? { ...w, status: newStatus } : w));
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleDeleteWorker = async (worker: any) => {
    if (!window.confirm(`Are you sure you want to remove worker "${worker.full_name}"?`)) {
      return;
    }
    try {
      await adminApi.deleteWorker(worker.profile_id);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove worker');
    }
  };

  const filteredWorkers = selectedDeptFilter === 'ALL'
    ? workers
    : workers.filter(w => w.department_id === selectedDeptFilter);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-800 uppercase tracking-wider">
              Field Operations
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Worker Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Manage municipal field technicians, monitor active tasks, and balance department workloads.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            title="Refresh Workers"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors shadow-sm"
          >
            <UserPlus className="h-4 w-4 mr-2" /> Add Field Worker
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Field Workers</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{workers.length}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <Users className="h-6 w-6 text-gray-700" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Available on Duty</p>
            <p className="text-3xl font-black text-emerald-700 mt-2">
              {workers.filter(w => w.status === 'AVAILABLE').length}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Active Assignments</p>
            <p className="text-3xl font-black text-blue-700 mt-2">
              {workers.reduce((acc, w) => acc + (w.activeTasks || 0), 0)}
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl">
            <Briefcase className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-700">Filter Department:</span>
          <select
            value={selectedDeptFilter}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'ALL') {
                searchParams.delete('department');
              } else {
                searchParams.set('department', val);
              }
              setSearchParams(searchParams);
            }}
            className="text-xs font-bold px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-red-500 bg-white"
          >
            <option value="ALL">All Departments ({workers.length})</option>
            {departments.map((d: any) => {
              const count = workers.filter(w => w.department_id === d.id).length;
              return (
                <option key={d.id} value={d.id}>{d.name} ({count})</option>
              );
            })}
          </select>
        </div>

        {selectedDeptFilter !== 'ALL' && (
          <button
            onClick={() => {
              searchParams.delete('department');
              setSearchParams(searchParams);
            }}
            className="text-xs font-bold text-red-600 hover:text-red-800"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Workers Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading && workers.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-24">
            <Loader2 className="animate-spin h-8 w-8 text-red-500 mb-2" />
            <p className="text-xs text-gray-400">Loading field staff...</p>
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">No field workers found</p>
            <p className="text-xs text-gray-400 mt-1">
              {selectedDeptFilter !== 'ALL' 
                ? 'No workers assigned to this selected department.' 
                : 'Click "Add Field Worker" above to onboard field technicians.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Worker Profile</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Active Tasks</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Completed</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Duty Status</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Rating</th>
                  <th className="px-6 py-4 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredWorkers.map((worker) => (
                  <tr key={worker.profile_id} className="hover:bg-gray-50/80 transition-colors">
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

                    {/* Department */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-gray-800 font-medium">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        <span>{worker.department_name}</span>
                      </div>
                    </td>

                    {/* Active Tasks */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{worker.activeTasks || 0}</span>
                        {worker.criticalTasks > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-red-100 text-red-700">
                            {worker.criticalTasks} CRIT
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Completed */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-semibold text-gray-700">{worker.completedTasks || 0} resolved</span>
                    </td>

                    {/* Status Dropdown */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={worker.status}
                        onChange={(e) => handleStatusChange(worker.profile_id, e.target.value)}
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

                    {/* Performance Rating */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                        {worker.performanceScore}% Score
                      </span>
                    </td>

                    {/* Actions: Edit/Reassign & Delete */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditWorker(worker);
                            setEditName(worker.full_name);
                            setEditPhone(worker.phone_number || '');
                            setEditDeptId(worker.department_id);
                            setEditStatus(worker.status);
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit / Reassign Worker"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteWorker(worker)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remove Worker"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Worker Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Add Municipal Field Worker</h3>
            <p className="text-xs text-gray-500">Create login credentials and allocate the technician to a department.</p>

            <form onSubmit={handleAddWorker} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                <input 
                  type="text" 
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email Address *</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="worker@example.com"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Temporary Password *</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Department *</label>
                <select
                  required
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                >
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-2 bg-gray-900 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Worker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Reassign Worker Modal */}
      {editWorker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Edit / Reassign Worker</h3>
            <p className="text-xs text-gray-500">
              Update worker profile, change duty status, or reassign to another municipal division.
            </p>

            <form onSubmit={handleEditWorker} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                <input 
                  type="text" 
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                <input 
                  type="tel" 
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Assigned Department (Reassign) *</label>
                <select
                  required
                  value={editDeptId}
                  onChange={(e) => setEditDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-red-500"
                >
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {editWorker.department_id !== editDeptId && (
                  <p className="text-[11px] font-semibold text-blue-600 mt-1">
                    Reassigning from {editWorker.department_name} to selected department.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Duty Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-red-500"
                >
                  <option value="AVAILABLE">🟢 Available (On Duty)</option>
                  <option value="BUSY">🟡 Busy (Working on Task)</option>
                  <option value="OFF_DUTY">⚪ Off Duty (Inactive)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditWorker(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={updating}
                  className="px-4 py-2 bg-gray-900 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {updating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
