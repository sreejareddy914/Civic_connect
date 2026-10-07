import { useEffect, useState } from 'react';
import { 
  Loader2, 
  Building2, 
  Plus, 
  RefreshCw
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

export default function AdminDepartments() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getDepartments();
      setDepartments(res.departments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter department name');
    setSubmitting(true);
    try {
      await adminApi.createDepartment({ name, description });
      setShowAddModal(false);
      setName('');
      setDescription('');
      await fetchDepartments();
    } catch (e: any) {
      alert(`Error creating department: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-800 uppercase tracking-wider">
              Administration
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Departments</h1>
          <p className="text-gray-500 text-sm mt-0.5">Municipal service divisions, resource allocations, and SLA resolution compliance.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchDepartments}
            className="p-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Department
          </button>
        </div>
      </div>

      {/* Departments Grid */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-32">
          <Loader2 className="animate-spin h-8 w-8 text-red-500 mb-2" />
          <p className="text-xs text-gray-400">Loading municipal departments...</p>
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-500">
          <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="font-semibold text-gray-700">No departments configured</p>
          <p className="text-xs text-gray-400 mt-1">Create municipal departments using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const stats = dept.stats || {};
            return (
              <div key={dept.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:border-gray-300 transition-all">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-3 bg-red-50 rounded-xl text-red-600">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
                      {stats.compliance || 100}% SLA
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{dept.name}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-6">
                    {dept.description || 'Handles specialized municipal civic operations and maintenance.'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100 text-center">
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Total</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{stats.total || 0}</p>
                  </div>
                  <div className="bg-blue-50 p-2.5 rounded-xl">
                    <p className="text-[10px] font-bold text-blue-600 uppercase">Active</p>
                    <p className="text-base font-bold text-blue-700 mt-0.5">{stats.inProgress || 0}</p>
                  </div>
                  <div className="bg-green-50 p-2.5 rounded-xl">
                    <p className="text-[10px] font-bold text-green-600 uppercase">Done</p>
                    <p className="text-base font-bold text-green-700 mt-0.5">{stats.resolved || 0}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Department Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Add Municipal Department</h3>
            <p className="text-xs text-gray-500">Configure a new service division for complaint routing and field worker dispatch.</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Department Name *</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Water Supply & Sewage"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea 
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Scope of responsibilities and maintenance zones..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
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
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
