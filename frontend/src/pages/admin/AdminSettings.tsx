import { useEffect, useState } from 'react';
import { 
  Settings, 
  Save, 
  Clock, 
  Award, 
  CheckSquare, 
  Loader2, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

export default function AdminSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSettings();
      setSettings(res.settings || {});
    } catch (e: any) {
      console.error('Error fetching settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await adminApi.updateSettings(settings);
      setSettings(res.settings);
      setSuccessMsg('Settings saved successfully and applied to municipal dispatch rules.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      setErrorMsg(`Failed to save settings: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="animate-spin h-10 w-10 text-red-600" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-red-600" />
            CivicConnect Municipal System Configurations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Global SLA resolution targets, citizen verification radiuses, and civic points reward matrices
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-2 text-sm font-semibold">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* SLA Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Clock className="h-5 w-5 text-red-600" />
            <h2 className="text-base font-bold text-gray-900">SLA Resolution Target Deadlines (Hours)</h2>
          </div>
          <p className="text-xs text-gray-500">
            Defines maximum permitted elapsed time from complaint submission to field resolution before escalation.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-red-700 uppercase mb-1">Critical (Hours)</label>
              <input
                type="number"
                min="1"
                required
                value={settings?.sla?.CRITICAL || 4}
                onChange={(e) => setSettings({
                  ...settings,
                  sla: { ...settings.sla, CRITICAL: parseInt(e.target.value) || 4 }
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-orange-700 uppercase mb-1">High (Hours)</label>
              <input
                type="number"
                min="1"
                required
                value={settings?.sla?.HIGH || 24}
                onChange={(e) => setSettings({
                  ...settings,
                  sla: { ...settings.sla, HIGH: parseInt(e.target.value) || 24 }
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Medium (Hours)</label>
              <input
                type="number"
                min="1"
                required
                value={settings?.sla?.MEDIUM || 48}
                onChange={(e) => setSettings({
                  ...settings,
                  sla: { ...settings.sla, MEDIUM: parseInt(e.target.value) || 48 }
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Low (Hours)</label>
              <input
                type="number"
                min="1"
                required
                value={settings?.sla?.LOW || 72}
                onChange={(e) => setSettings({
                  ...settings,
                  sla: { ...settings.sla, LOW: parseInt(e.target.value) || 72 }
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Civic Points Reputation Matrix */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Award className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-bold text-gray-900">Civic Points Reward Matrix</h2>
          </div>
          <p className="text-xs text-gray-500">
            Points awarded to citizens for positive civic participation. Civic Points represent community reputation.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">New Verified Issue Reported</label>
              <input
                type="number"
                min="0"
                required
                value={settings?.points?.NEW_ISSUE || 25}
                onChange={(e) => setSettings({
                  ...settings,
                  points: { ...settings.points, NEW_ISSUE: parseInt(e.target.value) || 25 }
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Valid Community Verification</label>
              <input
                type="number"
                min="0"
                required
                value={settings?.points?.VALID_VERIFICATION || 10}
                onChange={(e) => setSettings({
                  ...settings,
                  points: { ...settings.points, VALID_VERIFICATION: parseInt(e.target.value) || 10 }
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">First Hazard Reporter Bonus</label>
              <input
                type="number"
                min="0"
                required
                value={settings?.points?.FIRST_REPORTER || 50}
                onChange={(e) => setSettings({
                  ...settings,
                  points: { ...settings.points, FIRST_REPORTER: parseInt(e.target.value) || 50 }
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Citizen Verification Parameters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <CheckSquare className="h-5 w-5 text-green-600" />
            <h2 className="text-base font-bold text-gray-900">Community Verification Parameters</h2>
          </div>
          <p className="text-xs text-gray-500">
            Thresholds governing how close a citizen must be to physically confirm an issue.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Maximum Verification Radius (Meters)
              </label>
              <input
                type="number"
                min="50"
                step="50"
                required
                value={settings?.verification?.radiusMeters || 500}
                onChange={(e) => setSettings({
                  ...settings,
                  verification: { ...settings.verification, radiusMeters: parseInt(e.target.value) || 500 }
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Required Confirmations for Consensus
              </label>
              <input
                type="number"
                min="1"
                required
                value={settings?.verification?.requiredCount || 3}
                onChange={(e) => setSettings({
                  ...settings,
                  verification: { ...settings.verification, requiredCount: parseInt(e.target.value) || 3 }
                })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50 transition"
          >
            {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save Municipal Configurations
          </button>
        </div>
      </form>
    </div>
  );
}
