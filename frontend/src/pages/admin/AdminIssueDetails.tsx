import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Loader2, 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  FileQuestion, 
  UserPlus, 
  MapPin, 
  Sparkles, 
  ThumbsUp, 
  MessageSquare, 
  Award, 
  ShieldCheck, 
  AlertTriangle,
  Calendar,
  History,
  RefreshCw,
  Camera,
  Clock
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

export default function AdminIssueDetails() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('Insufficient Evidence');
  const [rejectNotes, setRejectNotes] = useState('');

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [infoCategory, setInfoCategory] = useState('GENERAL_CLARIFICATION');
  const [informationRequests, setInformationRequests] = useState<any[]>([]);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');

  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkReason, setReworkReason] = useState('');

  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceReason, setEvidenceReason] = useState('');
  const [requestedEvidence, setRequestedEvidence] = useState('');
  const [evidenceAdminNote, setEvidenceAdminNote] = useState('');

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');

  // Override Form
  const [isEditingOverride, setIsEditingOverride] = useState(false);
  const [overrideCategory, setOverrideCategory] = useState('');
  const [overrideSeverity, setOverrideSeverity] = useState('');
  const [overridePriority, setOverridePriority] = useState('');

  const fetchDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [res, reqsRes] = await Promise.all([
        adminApi.getIssue(id),
        adminApi.getInformationRequests(id).catch(() => ({ requests: [] }))
      ]);
      setData(res);
      setInformationRequests(reqsRes?.requests || []);
      setOverrideCategory(res.issue?.category || 'Roads');
      setOverrideSeverity(res.issue?.severity || 'MEDIUM');
      setOverridePriority(res.issue?.priority || 'MEDIUM');
      setSelectedDeptId(res.issue?.department_id || '');
      setSelectedWorkerId(res.issue?.assigned_worker_id || '');
    } catch (error) {
      console.error('Error fetching issue detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkers = async () => {
    try {
      const res = await adminApi.getWorkers();
      setWorkers(res.workers || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDetails();
    fetchWorkers();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-full pt-32">
        <Loader2 className="animate-spin h-10 w-10 text-red-500 mb-3" />
        <p className="text-sm font-medium text-gray-500">Loading complaint details...</p>
      </div>
    );
  }

  if (!data || !data.issue) {
    return (
      <div className="p-16 text-center text-gray-500">
        <p className="font-bold text-gray-800 text-lg">Complaint record not found</p>
        <Link to="/admin/issues" className="mt-4 inline-block text-red-600 font-semibold text-sm hover:underline">
          Return to Issues Directory
        </Link>
      </div>
    );
  }

  const { 
    issue, 
    reporter, 
    media, 
    aiAnalysis, 
    communityVerification, 
    upvoteCount, 
    comments, 
    statusHistory, 
    assignedWorker, 
    sla, 
    resolutionProof, 
    duplicate 
  } = data;

  // Actions
  const handleVerify = async () => {
    if (!window.confirm('Officially verify this complaint for municipal processing?')) return;
    setUpdating(true);
    try {
      await adminApi.verifyIssue(issue.id, 'Verified by Administrator');
      await fetchDetails();
    } catch (e: any) {
      alert(`Error verifying: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await adminApi.rejectIssue(issue.id, rejectReason, rejectNotes);
      setShowRejectModal(false);
      await fetchDetails();
    } catch (e: any) {
      alert(`Error rejecting: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!infoMessage.trim()) return alert('Please enter a request message');
    setUpdating(true);
    try {
      await adminApi.requestMoreInfo(issue.id, infoMessage.trim(), infoCategory);
      setShowInfoModal(false);
      setInfoMessage('');
      alert('✓ Additional information requested from the citizen.');
      await fetchDetails();
    } catch (e: any) {
      alert(`Error requesting info: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveOverrides = async () => {
    setUpdating(true);
    try {
      await adminApi.applyOverride(issue.id, {
        category: overrideCategory,
        severity: overrideSeverity,
        priority: overridePriority,
        notes: 'Admin updated classifications'
      });
      setIsEditingOverride(false);
      await fetchDetails();
    } catch (e: any) {
      alert(`Error updating overrides: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId) return alert('Please select a field worker');
    setUpdating(true);
    try {
      if (issue.assigned_worker_id) {
        await adminApi.reassignWorker(issue.id, selectedWorkerId, selectedDeptId, 'Admin reassignment');
      } else {
        await adminApi.assignWorker(issue.id, selectedWorkerId, selectedDeptId);
      }
      setShowAssignModal(false);
      await fetchDetails();
    } catch (e: any) {
      alert(`Error assigning: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkWorkCompleted = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUpdating(true);
    try {
      await adminApi.markWorkCompleted(issue.id, completeNotes);
      setShowCompleteModal(false);
      setCompleteNotes('');
      await fetchDetails();
    } catch (e: any) {
      alert(`Error completing work: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };


  const handleRework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reworkReason.trim()) return alert('Please specify rework instructions');
    setUpdating(true);
    try {
      await adminApi.requestRework(issue.id, reworkReason);
      setShowReworkModal(false);
      await fetchDetails();
    } catch (e: any) {
      alert(`Error requesting rework: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceReason.trim()) return alert('Please specify reason for requesting additional evidence');
    setUpdating(true);
    try {
      await adminApi.requestEvidence(issue.id, evidenceReason, requestedEvidence, evidenceAdminNote);
      setShowEvidenceModal(false);
      await fetchDetails();
    } catch (e: any) {
      alert(`Error requesting evidence: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkDuplicate = async () => {
    if (!duplicate?.duplicate_of_issue_id) return;
    if (!window.confirm(`Confirm complaint as duplicate of ${duplicate.matched_issue?.code || 'original'}?`)) return;
    setUpdating(true);
    try {
      await adminApi.markDuplicate(issue.id, duplicate.duplicate_of_issue_id, 'Confirmed by Administrator');
      await fetchDetails();
    } catch (e: any) {
      alert(`Error marking duplicate: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link to="/admin/issues" className="inline-flex items-center text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Issues Directory
        </Link>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Verify & Reject (for reported or returned from citizen verification) */}
          {(issue.status === 'REPORTED' || (['CITIZEN_VERIFICATION', 'MORE_INFO_REQUIRED'].includes(issue.status) && !informationRequests.some((r: any) => r.status === 'PENDING'))) && (
            <>
              <button 
                onClick={handleVerify}
                disabled={updating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" /> Verify Complaint
              </button>
              <button 
                onClick={() => setShowRejectModal(true)}
                disabled={updating}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </>
          )}

          {/* Request More Info: available when not closed/resolved/rejected and NO request is currently pending */}
          {!informationRequests.some((r: any) => r.status === 'PENDING') && 
           !['CLOSED', 'REJECTED', 'RESOLVED'].includes(issue.status) && (
            <button 
              onClick={() => setShowInfoModal(true)}
              disabled={updating}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileQuestion className="h-4 w-4" /> Request More Info
            </button>
          )}

          {/* If there is an active pending request, show waiting badge */}
          {informationRequests.some((r: any) => r.status === 'PENDING') && (
            <span className="px-3.5 py-2 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 animate-spin" /> Additional Info Pending from Citizen
            </span>
          )}

          {(issue.status === 'VERIFIED' || issue.status === 'ASSIGNED' || issue.status === 'IN_PROGRESS') && (
            <button 
              onClick={() => setShowAssignModal(true)}
              disabled={updating}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
            >
              <UserPlus className="h-4 w-4" /> {issue.assigned_worker_id ? 'Reassign Worker' : 'Assign Worker'}
            </button>
          )}

          {['CITIZEN_VERIFICATION', 'PENDING_VERIFICATION', 'WORK_COMPLETED', 'COMPLETED_PENDING_REVIEW'].includes(issue.status) && (
            <>
              <button 
                onClick={() => setShowCompleteModal(true)}
                disabled={updating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle className="h-4 w-4" /> Mark Work Completed
              </button>
              <button 
                onClick={() => setShowEvidenceModal(true)}
                disabled={updating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Camera className="h-4 w-4" /> Request More Evidence
              </button>
              <button 
                onClick={() => setShowReworkModal(true)}
                disabled={updating}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <RefreshCw className="h-4 w-4" /> Request Rework
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Issue Card Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold bg-gray-100 text-gray-800 px-3 py-1 rounded">
                {issue.code || 'CC-0000'}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                issue.status === 'REPORTED' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                issue.status === 'MORE_INFO_REQUIRED' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                issue.status === 'VERIFIED' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                issue.status === 'ASSIGNED' ? 'bg-indigo-100 text-indigo-800' :
                issue.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800' :
                issue.status === 'RESOLVED' || issue.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {issue.status}
              </span>
            </div>
            <h1 className="text-2xl font-black text-gray-900">{issue.title}</h1>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" /> Reported on {new Date(issue.created_at).toLocaleString()}
            </p>
          </div>

          {/* Upvotes & Comments Quick Counters */}
          <div className="flex items-center gap-4 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <ThumbsUp className="h-4 w-4 text-red-500" />
              <span>{upvoteCount} Upvotes</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span>{comments.length} Comments</span>
            </div>
          </div>
        </div>

        {/* Original Description */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-700 leading-relaxed mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Citizen Description</p>
          {issue.description}
        </div>

        {/* Location & Address */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">
          <span className="flex items-center gap-1 font-medium">
            <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
            {issue.address || 'Address not specified'}
          </span>
          {issue.latitude && (
            <span className="text-gray-400 font-mono text-[11px]">
              ({issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)})
            </span>
          )}
        </div>
      </div>

      {/* 2-Column Grid: Left Details & Right Context */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Photos, AI, Overrides, Community Verification, Resolution */}
        <div className="lg:col-span-2 space-y-8">
          {/* Complaint Media Photos */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Complaint Photos</h2>
            {media.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No media attachments uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {media.map((m: any) => {
                  const url = `${import.meta.env.VITE_SUPABASE_URL || 'https://gcgftzdojxyyjrqftpvv.supabase.co'}/storage/v1/object/public/issues/${m.storage_path}`;
                  return (
                    <div key={m.id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-100 aspect-video">
                      <img src={url} alt="Issue evidence" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        {m.media_type}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Review Panel vs Final Admin Overrides */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">AI Classification & Admin Decision</h2>
              </div>
              {!isEditingOverride ? (
                <button 
                  onClick={() => setIsEditingOverride(true)}
                  className="text-xs font-bold text-red-600 hover:text-red-700"
                >
                  Edit / Override
                </button>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={handleSaveOverrides}
                    className="text-xs font-bold text-green-600 hover:underline"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setIsEditingOverride(false)}
                    className="text-xs font-bold text-gray-400 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/70 p-5 rounded-xl border border-gray-200">
              {/* AI Recommendation */}
              <div className="space-y-3">
                <p className="text-xs font-extrabold uppercase text-indigo-600">AI Recommendation (Advisory)</p>
                <div className="text-xs space-y-1.5 text-gray-600">
                  <p><span className="font-semibold text-gray-800">Category:</span> {aiAnalysis?.category || issue.category || 'Roads'}</p>
                  <p><span className="font-semibold text-gray-800">Severity:</span> {aiAnalysis?.severity || issue.severity || 'Medium'}</p>
                  <p><span className="font-semibold text-gray-800">Priority:</span> {aiAnalysis?.priority || issue.priority || 'Medium'}</p>
                  <p><span className="font-semibold text-gray-800">Confidence:</span> {issue.ai_confidence ? `${Math.round(issue.ai_confidence * 100)}%` : '90%'}</p>
                  {aiAnalysis?.polished_description && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <span className="font-semibold text-gray-800">Polished Summary:</span>
                      <p className="text-gray-600 italic mt-0.5">{aiAnalysis.polished_description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Final Decision */}
              <div className="space-y-3 md:border-l md:border-gray-200 md:pl-6">
                <p className="text-xs font-extrabold uppercase text-gray-900">Final Admin Decision (Binding)</p>
                {isEditingOverride ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block font-semibold text-gray-700">Category</label>
                      <input 
                        type="text" 
                        value={overrideCategory} 
                        onChange={(e) => setOverrideCategory(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs" 
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700">Severity</label>
                      <select 
                        value={overrideSeverity} 
                        onChange={(e) => setOverrideSeverity(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="CRITICAL">CRITICAL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700">Priority</label>
                      <select 
                        value={overridePriority} 
                        onChange={(e) => setOverridePriority(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="CRITICAL">CRITICAL</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs space-y-1.5 text-gray-700">
                    <p><span className="font-semibold text-gray-900">Official Category:</span> {issue.category || 'Roads'}</p>
                    <p><span className="font-semibold text-gray-900">Official Severity:</span> <span className="font-bold text-red-600">{issue.severity || 'Medium'}</span></p>
                    <p><span className="font-semibold text-gray-900">Official Priority:</span> <span className="font-bold text-gray-900">{issue.priority || 'Medium'}</span></p>
                    <p><span className="font-semibold text-gray-900">Department:</span> {issue.department?.name || 'General Municipal Services'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Information Requests History */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <FileQuestion className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                    Additional Information Requests ({informationRequests.length})
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Official requests sent to the reporting citizen and submitted clarifications.
                  </p>
                </div>
              </div>

              {!informationRequests.some((r: any) => r.status === 'PENDING') && !['CLOSED', 'REJECTED', 'RESOLVED'].includes(issue.status) && (
                <button
                  onClick={() => setShowInfoModal(true)}
                  disabled={updating}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <FileQuestion className="h-3.5 w-3.5" />
                  Request More Info
                </button>
              )}
            </div>

            {informationRequests.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">No additional information requested from citizen yet.</p>
            ) : (
              <div className="space-y-4">
                {informationRequests.map((req: any, idx: number) => {
                  const hasResponse = !!req.response;
                  return (
                    <div 
                      key={req.id || idx}
                      className={`p-4 rounded-xl border text-xs space-y-3 transition-all ${
                        req.status === 'PENDING' 
                          ? 'bg-amber-50/50 border-amber-300' 
                          : req.status === 'RESPONDED'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      {/* Top status & request header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold uppercase tracking-wider text-[11px] text-gray-500">
                            REQUEST #{informationRequests.length - idx}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            req.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : req.status === 'RESPONDED'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-gray-200 text-gray-800'
                          }`}>
                            {req.status}
                          </span>
                          {req.request_type && (
                            <span className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-semibold text-gray-600">
                              {req.request_type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-[11px]">
                            {new Date(req.created_at).toLocaleString()}
                          </span>
                          {req.status === 'RESPONDED' && (
                            <button
                              onClick={async () => {
                                if (!window.confirm('Mark this information request as closed?')) return;
                                setUpdating(true);
                                try {
                                  await adminApi.closeInformationRequest(issue.id, req.id);
                                  await fetchDetails();
                                } catch (e: any) {
                                  alert(`Error closing request: ${e.message}`);
                                } finally {
                                  setUpdating(false);
                                }
                              }}
                              className="text-[10px] text-gray-500 hover:text-gray-800 font-bold px-2 py-0.5 bg-white border rounded hover:bg-gray-100 transition"
                            >
                              Close Request
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Admin Message */}
                      <div>
                        <span className="font-bold text-gray-700 block mb-1">Admin Message to Citizen:</span>
                        <p className="bg-white p-3 rounded-lg border border-gray-200 text-gray-800 whitespace-pre-wrap font-medium">
                          "{req.message}"
                        </p>
                      </div>

                      {/* Citizen Response */}
                      {hasResponse ? (
                        <div className="bg-white p-3.5 rounded-lg border border-emerald-300/80 space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                              Citizen Response
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {new Date(req.response.created_at).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-gray-900 whitespace-pre-wrap text-xs leading-relaxed">
                            {req.response.message}
                          </p>

                          {/* Evidence Preview */}
                          {req.response.media?.storage_path && (
                            <div className="pt-2 border-t border-gray-100">
                              <span className="font-bold text-gray-600 block mb-1.5">Additional Evidence / Photo:</span>
                              <div className="flex items-center gap-3">
                                <a
                                  href={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${req.response.media.storage_path}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="group relative inline-block rounded-xl overflow-hidden border border-gray-200 shadow-sm"
                                >
                                  <img
                                    src={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${req.response.media.storage_path}`}
                                    alt="Citizen submitted evidence"
                                    className="h-28 w-44 object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
                                    View Full Size
                                  </div>
                                </a>
                                <a
                                  href={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${req.response.media.storage_path}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-700 hover:text-emerald-800 font-bold underline text-xs"
                                >
                                  Open in New Tab ↗
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : req.status === 'PENDING' ? (
                        <div className="flex items-center gap-2 p-2.5 bg-amber-100/60 rounded-lg text-amber-900 text-xs font-medium">
                          <Clock className="h-4 w-4 text-amber-600 animate-spin" />
                          <span>Waiting for citizen to submit additional information...</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Community Verification Summary (Distinct from Admin Decision) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Citizen Community Verification</h2>
                <p className="text-xs text-gray-400 mt-0.5">Physical observations submitted by neighborhood citizens.</p>
              </div>
              <div className="flex gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                  {communityVerification.confirmedPresent} Present
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                  {communityVerification.couldNotVerify} Unconfirmed
                </span>
              </div>
            </div>

            {communityVerification.records.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">No citizen physical verifications recorded yet.</p>
            ) : (
              <div className="space-y-3 divide-y divide-gray-100">
                {communityVerification.records.map((v: any) => (
                  <div key={v.id} className="pt-3 first:pt-0 flex justify-between items-start text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{v.citizen?.full_name || 'Citizen'}</span>
                        <span className={`px-2 py-0.2 rounded font-bold text-[10px] uppercase ${
                          v.confirmed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {v.confirmed ? 'Confirmed Present' : 'Could Not Verify'}
                        </span>
                      </div>
                      <p className="text-gray-600 mt-1 italic">"{v.reason || 'Verified on site'}"</p>
                    </div>
                    <span className="text-gray-400 text-[11px] shrink-0">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duplicate Comparison Box (If duplicate detected) */}
          {duplicate && duplicate.matched_issue && (
            <div className="bg-amber-50/60 rounded-2xl border border-amber-200 p-6">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-900">Suspected Duplicate Complaint</h3>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleMarkDuplicate}
                    disabled={updating}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                  >
                    Confirm Duplicate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-amber-200 text-xs">
                <div>
                  <p className="font-bold text-gray-500 uppercase text-[10px]">Current Complaint</p>
                  <p className="font-bold text-gray-900 mt-1">{issue.title}</p>
                  <p className="text-gray-500 line-clamp-2 mt-0.5">{issue.description}</p>
                </div>
                <div className="border-l border-gray-200 pl-4">
                  <p className="font-bold text-gray-500 uppercase text-[10px]">Matched Complaint ({duplicate.matched_issue.code})</p>
                  <p className="font-bold text-gray-900 mt-1">{duplicate.matched_issue.title}</p>
                  <p className="text-gray-500 line-clamp-2 mt-0.5">{duplicate.matched_issue.description}</p>
                  <Link to={`/admin/issues/${duplicate.matched_issue.id}`} className="text-red-600 font-semibold mt-1 inline-block hover:underline">
                    View Matched Record
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Resolution Proof Review & Side-by-Side Verification */}
          {resolutionProof && (() => {
            let parsedInfo: any = {};
            try {
              parsedInfo = JSON.parse(resolutionProof.resolution_note);
            } catch {
              parsedInfo = { summary: resolutionProof.resolution_note };
            }

            const beforeProofMedia = media.filter((m: any) =>
              ['BEFORE', 'BEFORE_WORK', 'RESOLUTION_BEFORE'].includes(m.media_type)
            );
            const afterProofMedia = media.filter((m: any) =>
              ['AFTER', 'AFTER_WORK', 'RESOLUTION_AFTER'].includes(m.media_type)
            );
            const progressProofMedia = media.filter((m: any) =>
              ['PROGRESS', 'IN_PROGRESS'].includes(m.media_type)
            );

            return (
              <div className="bg-white rounded-2xl shadow-sm border-2 border-emerald-300 p-6 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                        FIELD WORK COMPLETION
                      </h3>
                      <p className="text-xs text-gray-500">
                        Submitted by Technician at {new Date(resolutionProof.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {['CITIZEN_VERIFICATION', 'PENDING_VERIFICATION', 'WORK_COMPLETED', 'COMPLETED_PENDING_REVIEW'].includes(issue.status) && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-bold animate-pulse">
                      AWAITING ADMIN REVIEW
                    </span>
                  )}
                  {['RESOLVED', 'COMPLETED', 'CLOSED'].includes(issue.status) && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Work Completed
                    </span>
                  )}
                </div>

                {/* Side-by-Side Before vs After Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BEFORE PHOTO */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <span className="text-xs font-bold text-gray-700 block mb-2 uppercase tracking-wide">
                      📸 BEFORE Work Evidence ({beforeProofMedia.length})
                    </span>
                    {beforeProofMedia.length === 0 ? (
                      <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400">
                        No Before photo captured
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {beforeProofMedia.map((m: any) => (
                          <div key={m.id} className="aspect-video rounded-lg overflow-hidden border">
                            <img
                              src={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${m.storage_path}`}
                              alt="Before work"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AFTER PHOTO */}
                  <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-200">
                    <span className="text-xs font-bold text-emerald-900 block mb-2 uppercase tracking-wide">
                      ✅ AFTER Repair Evidence ({afterProofMedia.length})
                    </span>
                    {afterProofMedia.length === 0 ? (
                      <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400">
                        No After photo captured
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {afterProofMedia.map((m: any) => (
                          <div key={m.id} className="aspect-video rounded-lg overflow-hidden border border-emerald-300">
                            <img
                              src={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${m.storage_path}`}
                              alt="After repair"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Evidence if any */}
                {progressProofMedia.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-gray-700 block mb-1">
                      In-Progress Repair Photos ({progressProofMedia.length})
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {progressProofMedia.map((m: any) => (
                        <div key={m.id} className="aspect-video rounded-lg overflow-hidden border">
                          <img
                            src={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${m.storage_path}`}
                            alt="Progress repair"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field Metrics & Report Details */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-gray-500 block text-[11px]">Field Worker:</span>
                      <strong className="text-gray-900">{assignedWorker?.profile?.full_name || 'Assigned Worker'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Department:</span>
                      <strong className="text-gray-900">{assignedWorker?.department_name || issue.department?.name || 'Assigned'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Submitted At:</span>
                      <strong className="text-gray-900">{new Date(resolutionProof.created_at).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Work Duration:</span>
                      <strong className="text-gray-900">{parsedInfo.actual_duration || 'Standard'}</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-gray-700">
                    <div>
                      <span className="text-gray-500 block text-[11px]">Actual Cost:</span>
                      <strong className="text-gray-900">{parsedInfo.actual_cost ? `₹${parsedInfo.actual_cost}` : 'Not reported'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Crew Size:</span>
                      <strong className="text-gray-900">{parsedInfo.crew_size ? `${parsedInfo.crew_size} workers` : '1 worker'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Materials Used:</span>
                      <strong className="text-gray-900 truncate block">{parsedInfo.materials_used || 'Standard'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">AI Verification:</span>
                      <strong className="text-emerald-700">
                        {resolutionProof.confidence_score ? `${Math.round(resolutionProof.confidence_score * 100)}% Confidence` : 'Verified'}
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <span className="font-bold text-gray-900">Completion Summary: </span>
                    <span className="text-gray-800">{parsedInfo.summary || resolutionProof.resolution_note}</span>
                  </div>
                </div>

                {/* Direct Action Review Buttons */}
                {['CITIZEN_VERIFICATION', 'PENDING_VERIFICATION', 'WORK_COMPLETED', 'COMPLETED_PENDING_REVIEW'].includes(issue.status) && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
                    <button
                      onClick={() => setShowReworkModal(true)}
                      disabled={updating}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-4 w-4" /> Request Rework
                    </button>
                    <button
                      onClick={() => setShowEvidenceModal(true)}
                      disabled={updating}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <Camera className="h-4 w-4" /> Request More Evidence
                    </button>
                    <button
                      onClick={() => setShowCompleteModal(true)}
                      disabled={updating}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle className="h-4 w-4" /> Mark Work Completed
                    </button>
                  </div>
                )}
                {['RESOLVED', 'COMPLETED', 'CLOSED'].includes(issue.status) && (
                  <div className="pt-2 border-t text-right">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle className="h-4 w-4" /> Field Work Completed & Approved by Admin
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Comments Feed */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">
              Community Discussion ({comments.length})
            </h2>

            {comments.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No community comments posted yet.</p>
            ) : (
              <div className="space-y-4">
                {comments.map((c: any) => (
                  <div key={c.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-gray-900">{c.profile?.full_name || 'Citizen'}</span>
                      <span className="text-gray-400 text-[10px]">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-700">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Citizen Info, Worker Info, SLA, Status Timeline */}
        <div className="space-y-6">
          {/* Reporter Citizen Card & Civic Reputation */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Reporter Profile</h3>
            <div className="space-y-2 text-xs">
              <p className="font-bold text-sm text-gray-900">{reporter?.full_name || 'Anonymous'}</p>
              <p className="text-gray-500">Phone: {reporter?.phone_number || 'Not provided'}</p>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="flex items-center gap-1 font-semibold text-indigo-700">
                  <Award className="h-4 w-4" /> {reporter?.level || 'Active Citizen'}
                </span>
                <span className="bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded text-[11px]">
                  {reporter?.points || 10} Civic Points
                </span>
              </div>
            </div>
          </div>

          {/* SLA Tracking Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">SLA Tracking</h3>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                sla.status === 'BREACHED' ? 'bg-red-100 text-red-700' :
                sla.status === 'DUE_SOON' ? 'bg-amber-100 text-amber-800' :
                'bg-green-100 text-green-700'
              }`}>
                {sla.status}
              </span>
            </div>

            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Policy Target:</span>
                <span className="font-bold text-gray-900">{sla.allowedHours} Hours</span>
              </div>
              <div className="flex justify-between">
                <span>Deadline:</span>
                <span className="font-mono text-gray-900">{new Date(sla.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(sla.deadline).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-100">
                <span>Time Remaining:</span>
                <span className={`font-bold ${sla.remainingHours < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {sla.remainingHours < 0 ? `Overdue by ${Math.abs(sla.remainingHours)}h` : `${sla.remainingHours}h`}
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Field Worker Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Field Workforce</h3>
            {assignedWorker ? (
              <div className="space-y-2 text-xs">
                <p className="font-bold text-sm text-gray-900">{assignedWorker.profile?.full_name}</p>
                <p className="text-gray-500">Email: {assignedWorker.email}</p>
                <p className="text-gray-500">Status: <span className="font-semibold text-green-600">{assignedWorker.status}</span></p>
                <button 
                  onClick={() => setShowAssignModal(true)}
                  className="w-full mt-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors"
                >
                  Reassign Task
                </button>
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-xs text-gray-400 italic mb-3">No worker assigned</p>
                <button 
                  onClick={() => setShowAssignModal(true)}
                  className="w-full py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  Assign Field Worker
                </button>
              </div>
            )}
          </div>

          {/* Audit Trail & Status Timeline */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
              <History className="h-4 w-4" /> Audit History ({statusHistory.length})
            </h3>

            {statusHistory.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No previous state transitions.</p>
            ) : (
              <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {statusHistory.map((h: any) => (
                  <div key={h.id} className="relative pl-6 text-xs">
                    <div className="absolute left-1 top-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-white" />
                    <p className="font-bold text-gray-900">{h.new_status}</p>
                    <p className="text-gray-500 text-[11px] mt-0.5">{h.notes || 'Status changed'}</p>
                    <p className="text-gray-400 text-[10px] mt-0.5">
                      {h.actor?.full_name ? `By ${h.actor.full_name}` : ''} • {new Date(h.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reject Complaint</h3>
            <p className="text-xs text-gray-500">Provide an administrative justification for declining this complaint.</p>
            
            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reason</label>
                <select 
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                >
                  <option value="Fake Complaint">Fake Complaint</option>
                  <option value="Spam">Spam</option>
                  <option value="Duplicate">Duplicate Report</option>
                  <option value="Invalid Location">Invalid Location</option>
                  <option value="Insufficient Evidence">Insufficient Evidence</option>
                  <option value="Already Resolved">Already Resolved</option>
                  <option value="Not a Civic Issue">Not a Civic Issue</option>
                  <option value="Wrong Category">Wrong Category</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Administrative Note</label>
                <textarea 
                  rows={3}
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Optional details for citizen notification..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={updating}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request More Information Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Request Additional Information</h3>
            <p className="text-xs text-gray-500">Ask the citizen for clearer pictures, exact landmarks, or updated details.</p>
            
            <form onSubmit={handleRequestInfo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Information Category (Optional)</label>
                <select 
                  value={infoCategory}
                  onChange={(e) => setInfoCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-medium"
                >
                  <option value="GENERAL_CLARIFICATION">General Clarification</option>
                  <option value="ADDITIONAL_PHOTO">Additional Photo</option>
                  <option value="LOCATION_CLARIFICATION">Location Clarification</option>
                  <option value="DESCRIPTION_CLARIFICATION">Description Clarification</option>
                  <option value="LANDMARK_REQUIRED">Landmark Required</option>
                  <option value="OTHER_EVIDENCE">Other Evidence</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Message to Citizen</label>
                <textarea 
                  rows={4}
                  required
                  value={infoMessage}
                  onChange={(e) => setInfoMessage(e.target.value)}
                  placeholder="e.g. Please upload a wider-angle photo or clarify the nearby street landmark..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowInfoModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={updating}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg"
                >
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Worker Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Assign Field Worker</h3>
            <p className="text-xs text-gray-500">Select an available technician based on department & workload.</p>
            
            <form onSubmit={handleAssignWorker} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Field Worker</label>
                <select 
                  required
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                >
                  <option value="">-- Select Worker --</option>
                  {workers.map((w: any) => (
                    <option key={w.profile_id} value={w.profile_id}>
                      {w.full_name} ({w.department_name}) - Active: {w.activeTasks}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={updating}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-lg"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rework Modal */}
      {showReworkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Request Rework</h3>
            <p className="text-xs text-gray-500">Specify why the current resolution was declined and what needs fixing.</p>
            
            <form onSubmit={handleRework} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Rework Instructions</label>
                <textarea 
                  rows={4}
                  required
                  value={reworkReason}
                  onChange={(e) => setReworkReason(e.target.value)}
                  placeholder="e.g. Debris on sidewalk not fully cleared..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowReworkModal(false)}
                  className="px-4 py-2 bg-gray-100 text-xs font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={updating}
                  className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg"
                >
                  Submit Rework Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request More Evidence Modal */}
      {showEvidenceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Request Additional Field Evidence</h3>
            <p className="text-xs text-gray-500">Ask the assigned field worker to provide additional photographic evidence before approval.</p>
            
            <form onSubmit={handleRequestEvidence} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Evidence Request <span className="text-red-500">*</span></label>
                <input 
                  type="text"
                  required
                  value={evidenceReason}
                  onChange={(e) => setEvidenceReason(e.target.value)}
                  placeholder="e.g., Unclear angle of final road surface patch"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Specific Evidence / Photos Requested</label>
                <input 
                  type="text"
                  value={requestedEvidence}
                  onChange={(e) => setRequestedEvidence(e.target.value)}
                  placeholder="e.g., Wide-angle shot showing complete street lane cleared"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Administrator Directive / Note</label>
                <textarea 
                  rows={3}
                  value={evidenceAdminNote}
                  onChange={(e) => setEvidenceAdminNote(e.target.value)}
                  placeholder="Additional guidance for the field technician..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowEvidenceModal(false)}
                  className="px-4 py-2 bg-gray-100 text-xs font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={updating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg"
                >
                  Dispatch Evidence Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Mark Work Completed Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Mark Work as Completed?</h3>
                <p className="text-xs text-gray-500">
                  The submitted field evidence will be accepted and the complaint will be moved to Completed.
                </p>
              </div>
            </div>
            
            <form onSubmit={handleMarkWorkCompleted} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Optional Admin Note</label>
                <textarea 
                  rows={3}
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  placeholder="e.g. Field verification approved, pavement reconstructed to standard..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={updating}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Mark Work Completed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
