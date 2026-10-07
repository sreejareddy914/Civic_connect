import { useEffect, useState } from 'react';
import { 
  Loader2, 
  UserPlus, 
  Users, 
  Building2, 
  CheckCircle2, 
  Briefcase,
  Phone,
  Mail,
  RefreshCw
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

export default function AdminWorkers() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Worker Form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('worker123');
  const [phone, setPhone] = useState('');
  const [deptId, setDeptId] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [wRes, dRes] = await Promise.all([
        adminApi.getWorkers(),
        adminApi.getDepartments()
      ]);
      setWorkers(wRes.workers || []);
      setDepartments(dRes.departments || []);
      if (dRes.departments && dRes.departments.length > 0) {
        setDeptId(dRes.departments[0].id);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !deptId) return alert('Please fill in required fields');
    setSubmitting(true);
    try {
      await adminApi.createWorker({
        full_name: fullName,
        email,
        password,
        phone_number: phone || null,
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

  const handleStatusChange = async (workerId: string, newStatus: string) => {
    try {
      await adminApi.updateWorker(workerId, { status: newStatus });
      setWorkers(workers.map(w => w.profile_id === workerId ? { ...w, status: newStatus } : w));
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

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
          <p className="text-gray-500 text-sm mt-0.5">Manage municipal field technicians, monitor active tasks, and balance department workloads.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
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

      {/* Workers Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col justify-center items-center py-24">
            <Loader2 className="animate-spin h-8 w-8 text-red-500 mb-2" />
            <p className="text-xs text-gray-400">Loading field staff...</p>
          </div>
        ) : workers.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">No field workers registered</p>
            <p className="text-xs text-gray-400 mt-1">Click "Add Field Worker" above to onboard field technicians.</p>
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
                  <th className="px-6 py-4 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Rating</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {workers.map((worker) => (
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
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                        {worker.performanceScore}% Score
                      </span>
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
                  className="px-4 py-2 bg-gray-900 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Create Worker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
