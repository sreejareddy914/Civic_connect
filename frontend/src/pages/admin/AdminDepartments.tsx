import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  Building2, 
  Plus, 
  RefreshCw,
  Users,
  CheckCircle2,
  Briefcase,
  Edit2,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { supabase } from '../../lib/supabase';
import type { Department } from '../../types/department';

export default function AdminDepartments() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit modal state
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getDepartments();
      setDepartments(res.departments || []);
    } catch (e) {
      console.error('Error fetching departments:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();

    // Real-time synchronization
    const channel = supabase
      .channel('admin-departments-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, () => {
        fetchDepartments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () => {
        fetchDepartments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDepartments]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter department name');
    setSubmitting(true);
    try {
      await adminApi.createDepartment({ name: name.trim(), description: description.trim() || null });
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDept || !editName.trim()) return alert('Department name is required');
    setUpdating(true);
    try {
      await adminApi.updateDepartment(editDept.id, {
        name: editName.trim(),
        description: editDesc.trim() || null
      });
      setEditDept(null);
      await fetchDepartments();
    } catch (e: any) {
      alert(`Error updating department: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    if (!window.confirm(`Are you sure you want to delete ${dept.name}? This action cannot be undone.`)) {
      return;
    }
    try {
      await adminApi.deleteDepartment(dept.id);
      await fetchDepartments();
    } catch (e: any) {
      alert(e.message || 'Failed to delete department');
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
          <p className="text-gray-500 text-sm mt-0.5">
            Municipal service divisions, field technician resource allocations, and SLA resolution compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchDepartments}
            className="p-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            title="Refresh Departments"
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
      {loading && departments.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-32">
          <Loader2 className="animate-spin h-8 w-8 text-red-500 mb-2" />
          <p className="text-xs text-gray-400">Loading municipal departments and personnel...</p>
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
            const stats = dept.stats || {
              totalWorkers: dept.totalWorkers || 0,
              activeWorkers: dept.activeWorkers || 0,
              total: 0,
              compliance: 100
            };
            const totalWorkers = dept.totalWorkers ?? stats.totalWorkers ?? 0;
            const activeWorkers = dept.activeWorkers ?? stats.activeWorkers ?? 0;
            const assignedTasks = stats.total || 0;
            const compliance = stats.compliance || 100;

            return (
              <div 
                key={dept.id} 
                onClick={() => navigate(`/admin/departments/${dept.id}`)}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:border-gray-400 hover:shadow-md transition-all cursor-pointer group relative"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-3 bg-red-50 rounded-xl text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                      <Building2 className="h-6 w-6" />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
                        {compliance}% SLA
                      </span>

                      {/* Quick Edit and Delete buttons */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditDept(dept);
                          setEditName(dept.name);
                          setEditDesc(dept.description || '');
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                        title="Edit Department"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(dept);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete Department"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-red-600 transition-colors flex items-center justify-between">
                    <span>{dept.name}</span>
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-red-600" />
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-6">
                    {dept.description || 'Handles specialized municipal civic operations and maintenance.'}
                  </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100 text-center">
                  {/* Total Workers */}
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center justify-center gap-1">
                      <Users className="h-2.5 w-2.5" /> Total
                    </p>
                    <p className="text-base font-black text-gray-900 mt-0.5">{totalWorkers}</p>
                    <span className="text-[9px] text-gray-400">Workers</span>
                  </div>

                  {/* Active Workers */}
                  <div className="bg-emerald-50 p-2.5 rounded-xl">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Active
                    </p>
                    <p className="text-base font-black text-emerald-700 mt-0.5">{activeWorkers}</p>
                    <span className="text-[9px] text-emerald-600">On Duty</span>
                  </div>

                  {/* Assigned Tasks */}
                  <div className="bg-blue-50 p-2.5 rounded-xl">
                    <p className="text-[10px] font-bold text-blue-600 uppercase flex items-center justify-center gap-1">
                      <Briefcase className="h-2.5 w-2.5" /> Tasks
                    </p>
                    <p className="text-base font-black text-blue-700 mt-0.5">{assignedTasks}</p>
                    <span className="text-[9px] text-blue-600">Assigned</span>
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
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea 
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Scope of responsibilities and maintenance zones..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
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
                  className="px-4 py-2 bg-gray-900 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {editDept && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Edit Department</h3>
            <p className="text-xs text-gray-500">Update division information and scope.</p>

            <form onSubmit={handleUpdate} className="space-y-4">
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
                  onClick={() => setEditDept(null)}
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
