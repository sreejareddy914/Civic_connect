import { useEffect, useState } from 'react';
import { 
  Mail, Phone, Building2, CheckCircle2, 
  Clock, Shield, Loader2, Save 
} from 'lucide-react';
import { workerApi } from '../../services/workerApi';

export default function WorkerProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>('AVAILABLE');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await workerApi.getProfile();
      setProfile(data);
      setStatus(data.worker?.status || 'AVAILABLE');
    } catch (err) {
      console.error('Failed to load worker profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      await workerApi.updateAvailability(status as any);
      setSuccessMsg('Availability status updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#E67E22] animate-spin mb-4" />
        <p className="text-gray-600 font-semibold">Loading Worker Profile...</p>
      </div>
    );
  }

  const worker = profile?.worker;
  const user = profile?.profile;
  const dept = worker?.department ? (Array.isArray(worker.department) ? worker.department[0] : worker.department) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#2C3E50]">Field Worker Profile</h1>
        <p className="text-sm text-gray-600">Review your operational credentials, department, and duty status.</p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Main Profile Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#2C3E50] to-[#34495E] p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#E67E22] text-white flex items-center justify-center text-2xl font-black shadow-md border-2 border-white/20">
              {user?.full_name?.charAt(0).toUpperCase() || 'W'}
            </div>
            <div>
              <h2 className="text-xl font-bold">{user?.full_name || 'Field Technician'}</h2>
              <p className="text-xs text-orange-200 font-mono mt-0.5">
                Worker Code: WRK-{user?.id?.substring(0, 5).toUpperCase()}
              </p>
              <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                <Shield className="w-3 h-3 text-[#E67E22]" /> {user?.role || 'WORKER'}
              </span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/15 text-center">
            <p className="text-[11px] uppercase tracking-wider text-gray-300 font-bold">Active Load</p>
            <p className="text-2xl font-black text-white">{profile?.activeAssignmentsCount || 0}</p>
            <p className="text-[10px] text-gray-300">Complaints Assigned</p>
          </div>
        </div>

        {/* Detailed Information */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
              <Building2 className="w-5 h-5 text-[#E67E22] shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Assigned Department</span>
                <span className="font-bold text-gray-900 mt-0.5 block">{dept?.name || 'Roads & Infrastructure'}</span>
                <span className="text-xs text-gray-500 block mt-0.5">Default SLA: {dept?.sla_hours || 24} hours</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Email Address</span>
                <span className="font-semibold text-gray-900 mt-0.5 block">{user?.email || 'worker@civicconnect.com'}</span>
                <span className="text-xs text-gray-500 block mt-0.5">Official communication</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
              <Phone className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Contact Phone</span>
                <span className="font-semibold text-gray-900 mt-0.5 block">{user?.phone_number || '+91 98765 43210'}</span>
                <span className="text-xs text-gray-500 block mt-0.5">Dispatch contact</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
              <Clock className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Registered Since</span>
                <span className="font-semibold text-gray-900 mt-0.5 block">
                  {new Date(worker?.created_at || user?.created_at || Date.now()).toLocaleDateString()}
                </span>
                <span className="text-xs text-gray-500 block mt-0.5">CivicConnect Field Operations</span>
              </div>
            </div>
          </div>

          {/* Operational Availability Toggle */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Duty & Availability Status</h3>
            <p className="text-xs text-gray-500 mb-4">
              Update your live status to inform dispatch supervisors whether you are available for new complaint dispatches.
            </p>

            <form onSubmit={handleUpdateAvailability} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#E67E22]"
              >
                <option value="AVAILABLE">🟢 AVAILABLE (Ready for dispatch)</option>
                <option value="BUSY">🟡 BUSY (On active field assignment)</option>
                <option value="ON_LEAVE">🔴 ON_LEAVE (Not on duty)</option>
                <option value="INACTIVE">⚪ INACTIVE (Offline)</option>
              </select>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#E67E22] hover:bg-[#D35400] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Status
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
