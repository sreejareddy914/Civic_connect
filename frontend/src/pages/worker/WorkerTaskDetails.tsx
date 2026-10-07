import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Loader2, ArrowLeft, MapPin, Clock, CheckSquare, Camera, Upload, 
  Navigation, AlertTriangle, CheckCircle2, FileText, 
  HelpCircle, XCircle, Send, Sparkles, Layers, Wrench, 
  AlertCircle, Check
} from 'lucide-react';
import { workerApi } from '../../services/workerApi';

export default function WorkerTaskDetails({ session: _session }: { session?: any }) {
  const { id } = useParams<{ id: string }>();

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GPS verification state
  const [verifyingLocation, setVerifyingLocation] = useState(false);
  const [locationResult, setLocationResult] = useState<any>(null);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Evidence capture / upload state
  const [evidenceType, setEvidenceType] = useState<'BEFORE' | 'PROGRESS' | 'AFTER'>('BEFORE');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Field Notes & Resource Form state
  const [showNotesForm, setShowNotesForm] = useState(false);
  const [fieldNotes, setFieldNotes] = useState({
    observation: '',
    work_performed: '',
    materials_used: '',
    equipment_used: '',
    crew_size: 1,
    actual_duration: ''
  });

  // Verification Submission Form state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionData, setCompletionData] = useState({
    resolution_note: '',
    actual_cost: '',
    actual_duration: '',
    crew_size: 1,
    materials_used: ''
  });
  const [completionAfterFile, setCompletionAfterFile] = useState<File | null>(null);
  const [completionAfterPreview, setCompletionAfterPreview] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);

  // Assistance modal state
  const [showAssistanceModal, setShowAssistanceModal] = useState(false);
  const [assistanceData, setAssistanceData] = useState({
    reason: 'Need More Workers',
    description: ''
  });

  // Unable to complete modal state
  const [showUnableModal, setShowUnableModal] = useState(false);
  const [unableData, setUnableData] = useState({
    reason: 'Location Inaccessible',
    note: ''
  });

  // Hidden file inputs for Camera vs File Upload
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const completionCameraInputRef = useRef<HTMLInputElement>(null);
  const completionFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadTaskDetails();
      acquireCurrentPosition();
    }
  }, [id]);

  const acquireCurrentPosition = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.log('Location access error:', err.message),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const loadTaskDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workerApi.getAssignment(id!, currentCoords || undefined);
      const combinedTask = {
        ...(res.issue || {}),
        assignmentId: res.assignment?.id || id,
        assignment: res.assignment,
        media: res.media?.all || res.issue?.media || [],
        resolutionProof: res.resolutionProof || res.issue?.resolutionProof,
        statusHistory: res.history || res.issue?.statusHistory || [],
        sla: res.issue?.sla || res.sla
      };
      setTask(combinedTask);
      if (res.distance) {
        setLocationResult((prev: any) => ({ ...prev, formattedDistance: res.distance }));
      }
    } catch (err: any) {
      console.error('Error loading task details:', err);
      setError(err.message || 'Assignment not found. It may have been removed or reassigned.');
    } finally {
      setLoading(false);
    }
  };

  // 1. Accept Assignment
  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await workerApi.acceptAssignment(id!);
      await loadTaskDetails();
    } catch (err: any) {
      alert(`Acceptance failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. GPS Location Verification
  const handleVerifyLocation = async () => {
    setVerifyingLocation(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentCoords({ latitude: lat, longitude: lng });
          const res = await workerApi.checkLocation(id!, lat, lng);
          setLocationResult(res);
          setVerifyingLocation(false);
        },
        (err) => {
          alert(`Location permission denied or unavailable: ${err.message}`);
          setVerifyingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch (err: any) {
      alert(`Failed to verify location: ${err.message}`);
      setVerifyingLocation(false);
    }
  };

  // 3. Image File Selected for Evidence
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEvidenceFile(file);
      setEvidencePreview(URL.createObjectURL(file));
      setUploadSuccessMsg(null);
    }
  };

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceFile) {
      alert('Please take or select a photo.');
      return;
    }
    setUploadingEvidence(true);
    try {
      const formData = new FormData();
      formData.append('image', evidenceFile);
      formData.append('evidence_type', evidenceType);
      formData.append('observation_note', evidenceNote);
      if (currentCoords) {
        formData.append('latitude', String(currentCoords.latitude));
        formData.append('longitude', String(currentCoords.longitude));
      }

      await workerApi.uploadEvidence(id!, formData);
      setUploadSuccessMsg(`${evidenceType} photo uploaded successfully!`);
      setEvidenceFile(null);
      setEvidencePreview(null);
      setEvidenceNote('');
      await loadTaskDetails();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingEvidence(false);
    }
  };

  // 4. Start Work (requires BEFORE photo)
  const handleStartWork = async () => {
    setActionLoading(true);
    try {
      await workerApi.startWork(id!, currentCoords || undefined);
      await loadTaskDetails();
    } catch (err: any) {
      alert(`Could not start work: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Save Field Notes & Resources
  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await workerApi.recordNotes(id!, fieldNotes);
      setShowNotesForm(false);
      alert('Field operational notes recorded successfully!');
      await loadTaskDetails();
    } catch (err: any) {
      alert(`Failed to record notes: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Submit Completion for Verification
  const handleCompletionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completionData.resolution_note.trim()) {
      alert('Please enter a completion note explaining the repairs conducted.');
      return;
    }

    // Check if AFTER evidence already exists or is being uploaded right now
    const hasExistingAfter = task?.media?.some((m: any) =>
      ['AFTER', 'AFTER_WORK', 'RESOLUTION_AFTER'].includes(m.media_type)
    );
    if (!hasExistingAfter && !completionAfterFile) {
      alert('At least one AFTER repair photo is mandatory before submitting work for verification.');
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('resolution_note', completionData.resolution_note);
      if (completionData.actual_cost) formData.append('actual_cost', completionData.actual_cost);
      if (completionData.actual_duration) formData.append('actual_duration', completionData.actual_duration);
      if (completionData.crew_size) formData.append('crew_size', String(completionData.crew_size));
      if (completionData.materials_used) formData.append('materials_used', completionData.materials_used);
      if (completionAfterFile) formData.append('after_image', completionAfterFile);

      const res = await workerApi.submitCompletion(id!, formData);
      setAiResult(res.aiAssessment);
      setShowCompletionModal(false);
      alert('Work submitted for Admin Verification! Gemini AI verified the evidence advisory.');
      await loadTaskDetails();
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Request Assistance
  const handleRequestAssistance = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await workerApi.requestAssistance(id!, {
        ...assistanceData,
        latitude: currentCoords?.latitude,
        longitude: currentCoords?.longitude
      });
      setShowAssistanceModal(false);
      alert('Assistance request dispatched to supervisors.');
      await loadTaskDetails();
    } catch (err: any) {
      alert(`Request failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Unable to Complete
  const handleUnableToComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unableData.note.trim()) {
      alert('Please provide a detailed note explaining why the work cannot proceed.');
      return;
    }
    setActionLoading(true);
    try {
      await workerApi.reportUnableToComplete(id!, {
        ...unableData,
        latitude: currentCoords?.latitude,
        longitude: currentCoords?.longitude
      });
      setShowUnableModal(false);
      alert('Status reported to administration. Awaiting supervisory direction.');
      await loadTaskDetails();
    } catch (err: any) {
      alert(`Report failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#E67E22] animate-spin mb-4" />
        <p className="text-gray-600 font-semibold">Loading Assignment Details...</p>
      </div>
    );
  }

  if (error || !task) {
    const is403 = error?.toLowerCase().includes('authorized') || error?.toLowerCase().includes('permission') || error?.toLowerCase().includes('forbidden');
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className={`border rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xs ${is403 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
          <AlertCircle className={`w-12 h-12 mx-auto mb-3 ${is403 ? 'text-amber-600' : 'text-rose-500'}`} />
          <h2 className={`text-xl font-bold mb-2 ${is403 ? 'text-amber-900' : 'text-rose-900'}`}>
            {is403 ? 'Access Restricted' : 'Assignment Not Available'}
          </h2>
          <p className={`text-sm mb-6 ${is403 ? 'text-amber-700' : 'text-rose-700'}`}>
            {error || 'Assignment not found. It may have been removed or reassigned.'}
          </p>
          <Link
            to="/worker/dashboard"
            className="px-5 py-2.5 bg-[#2C3E50] hover:bg-[#1a252f] text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Task Board
          </Link>
        </div>
      </div>
    );
  }

  // Media categorizations
  const citizenMedia = (task.media || []).filter((m: any) =>
    !['BEFORE', 'PROGRESS', 'AFTER', 'BEFORE_WORK', 'RESOLUTION_BEFORE', 'RESOLUTION_AFTER'].includes(m.media_type)
  );
  const beforeMedia = (task.media || []).filter((m: any) =>
    ['BEFORE', 'BEFORE_WORK', 'RESOLUTION_BEFORE'].includes(m.media_type)
  );
  const progressMedia = (task.media || []).filter((m: any) =>
    ['PROGRESS', 'IN_PROGRESS'].includes(m.media_type)
  );
  const afterMedia = (task.media || []).filter((m: any) =>
    ['AFTER', 'AFTER_WORK', 'RESOLUTION_AFTER'].includes(m.media_type)
  );

  const hasBefore = beforeMedia.length > 0;
  const hasAfter = afterMedia.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/worker/dashboard"
            className="p-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold px-2.5 py-0.5 bg-gray-100 text-gray-800 rounded">
                {task.code || 'CC-TASK'}
              </span>
              <span className="text-xs uppercase font-bold tracking-wider text-gray-500">
                {task.category}
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#2C3E50] mt-1 leading-tight">{task.title}</h1>
          </div>
        </div>

        {/* Action Controls for Emergency / Blockers */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => setShowAssistanceModal(true)}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-amber-600" /> Need Help
          </button>
          <button
            onClick={() => setShowUnableModal(true)}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <XCircle className="w-4 h-4 text-rose-600" /> Unable to Complete
          </button>
        </div>
      </div>

      {/* Admin Feedback Alerts for REWORK or EVIDENCE REQUIRED */}
      {task.status === 'REWORK_REQUIRED' && (
        <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-5 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-rose-900">Rework Requested by Administrator</h3>
            <p className="text-sm text-rose-700 mt-1">
              Please review the notes in the activity log below. Perform additional field corrections and upload new BEFORE/AFTER evidence to resubmit.
            </p>
          </div>
        </div>
      )}

      {task.status === 'EVIDENCE_REQUIRED' && (
        <div className="bg-orange-50 border-2 border-orange-400 rounded-2xl p-5 flex items-start gap-4">
          <Camera className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-orange-900">Additional Evidence Required</h3>
            <p className="text-sm text-orange-700 mt-1">
              The administrator has requested additional photographic evidence before approval. Use the Field Evidence capture section below to upload the requested images.
            </p>
          </div>
        </div>
      )}

      {/* Operational Lifecycle Status Bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Current Task Lifecycle</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg font-black text-[#2C3E50]">Status:</span>
            <span className="text-base font-bold text-[#E67E22]">
              {task.status === 'CITIZEN_VERIFICATION' || task.status === 'COMPLETED_PENDING_REVIEW'
                ? 'COMPLETED_PENDING_REVIEW'
                : (task.status === 'RESOLVED' ? 'COMPLETED' : task.status)}
            </span>
          </div>
        </div>

        {/* Lifecycle Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {task.status === 'ASSIGNED' && (
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs transition-colors"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Accept Assignment
            </button>
          )}

          {task.status === 'ACCEPTED' && (
            <button
              onClick={handleStartWork}
              disabled={actionLoading}
              className="px-5 py-2.5 bg-[#E67E22] hover:bg-[#D35400] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs transition-colors"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              Start Work
            </button>
          )}

          {(task.status === 'IN_PROGRESS' || task.status === 'REWORK_REQUIRED' || task.status === 'EVIDENCE_REQUIRED') && (
            <>
              <button
                onClick={() => setShowNotesForm(!showNotesForm)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
              >
                <FileText className="w-4 h-4 text-gray-600" /> Field Notes / Resources
              </button>
              <button
                onClick={() => setShowCompletionModal(true)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs transition-colors"
              >
                <CheckSquare className="w-4 h-4" /> Submit Work for Verification
              </button>
            </>
          )}

          {['PENDING_VERIFICATION', 'COMPLETED_PENDING_REVIEW', 'CITIZEN_VERIFICATION'].includes(task.status) && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 animate-spin" /> Submitted for Admin Verification
              </div>
              <div className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                Awaiting Admin Review
              </div>
              {aiResult && (
                <div className="px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Gemini Assessment: {aiResult.completionAssessment || 'LIKELY_COMPLETED'} ({aiResult.confidence || 90}%)
                </div>
              )}
            </div>
          )}

          {['RESOLVED', 'COMPLETED', 'CLOSED'].includes(task.status) && (
            <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> ✓ Approved & Completed by Admin
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout: Details & Field Evidence Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Complaint Details & Location */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Complaint Core Data */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 border-b pb-3">Complaint Information</h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500 block">Severity</span>
                <span className="text-sm font-bold text-gray-900 mt-0.5 block">{task.severity || 'Medium'}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500 block">Priority</span>
                <span className="text-sm font-bold text-gray-900 mt-0.5 block">{task.priority || 'P2'}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500 block">SLA Deadline</span>
                <span className="text-sm font-bold text-gray-900 mt-0.5 block">
                  {task.sla?.remainingHours !== undefined ? `${task.sla.remainingHours}h remaining` : 'Configured'}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500 block">Department</span>
                <span className="text-sm font-bold text-[#E67E22] mt-0.5 block truncate">
                  {task.department?.name || 'Assigned'}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase font-bold text-gray-500 tracking-wider">Description</h3>
              <p className="text-sm text-gray-800 mt-1 leading-relaxed bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                {task.description}
              </p>
            </div>

            {/* AI Estimation Guidance */}
            {task.aiAnalysis && (
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                  <Sparkles className="w-4 h-4 text-blue-600" /> AI Repair Guidance & Estimates
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-blue-950">
                  <div>
                    <span className="text-blue-700 block">Estimated Cost:</span>
                    <strong>{task.aiAnalysis.estimatedCostRange || task.aiAnalysis.estimated_cost || '₹10,000 - ₹25,000'}</strong>
                  </div>
                  <div>
                    <span className="text-blue-700 block">Est. Duration:</span>
                    <strong>{task.aiAnalysis.estimatedDuration || task.aiAnalysis.estimated_duration || '2-4 hours'}</strong>
                  </div>
                  <div>
                    <span className="text-blue-700 block">Crew Required:</span>
                    <strong>{task.aiAnalysis.recommendedCrewSize || task.aiAnalysis.crew_size || '2-3 technicians'}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Citizen Reported Photos */}
            {citizenMedia.length > 0 && (
              <div>
                <h3 className="text-xs uppercase font-bold text-gray-500 tracking-wider mb-2">
                  Citizen Reported Photos ({citizenMedia.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {citizenMedia.map((m: any) => {
                    const imgUrl = `${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${m.storage_path}`;
                    return (
                      <a
                        key={m.id}
                        href={imgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative block aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs"
                      >
                        <img
                          src={imgUrl}
                          alt="Citizen evidence"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e: any) => { e.target.src = 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=500&q=80'; }}
                        />
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          Citizen Photo
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Card: GPS Location & Verification */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#E67E22]" /> Location & Proximity Verification
              </h2>
              {task.latitude && task.longitude && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" /> Navigate
                </a>
              )}
            </div>

            <p className="text-sm text-gray-700">{task.address || 'Address coordinates provided on map'}</p>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-500">Worker Proximity Status</p>
                {locationResult ? (
                  <div className="mt-1">
                    {locationResult.verified ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Location Verified ({locationResult.formattedDistance} from site)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Location Mismatch ({locationResult.formattedDistance} away - 500m tolerance)
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 mt-1">
                    Verify you are at the physical site before commencing repair.
                  </p>
                )}
              </div>

              <button
                onClick={handleVerifyLocation}
                disabled={verifyingLocation}
                className="px-4 py-2 bg-[#2C3E50] hover:bg-[#34495E] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0"
              >
                {verifyingLocation ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5 text-[#E67E22]" /> Verify My GPS Location
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Activity Timeline / History */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-500" /> Operational Audit Trail
            </h2>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {(task.statusHistory || []).map((h: any, idx: number) => {
                const statusName = h.new_status || h.to_status || 'UPDATE';
                const displayStatus = statusName === 'CITIZEN_VERIFICATION' ? 'COMPLETED_PENDING_REVIEW' : (statusName === 'RESOLVED' ? 'COMPLETED' : statusName);
                const commentText = h.notes || h.comment || 'Status transitioned';
                return (
                  <div key={idx} className="text-xs border-l-2 border-[#E67E22] pl-3 py-1 space-y-0.5">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="font-bold text-gray-800">{displayStatus}</span>
                      <span>{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-600">{commentText}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Field Evidence & Work Execution */}
        <div className="space-y-6">
          {/* 1. Evidence Upload & Capture Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#E67E22]" /> Capture Field Evidence
            </h2>

            {uploadSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> {uploadSuccessMsg}
              </div>
            )}

            <form onSubmit={handleUploadEvidence} className="space-y-3">
              {/* Evidence Type Picker */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Evidence Stage</label>
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setEvidenceType('BEFORE')}
                    className={`py-1.5 rounded-lg transition-colors ${
                      evidenceType === 'BEFORE' ? 'bg-[#E67E22] text-white shadow-xs' : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    BEFORE
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenceType('PROGRESS')}
                    className={`py-1.5 rounded-lg transition-colors ${
                      evidenceType === 'PROGRESS' ? 'bg-[#E67E22] text-white shadow-xs' : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    PROGRESS
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenceType('AFTER')}
                    className={`py-1.5 rounded-lg transition-colors ${
                      evidenceType === 'AFTER' ? 'bg-[#E67E22] text-white shadow-xs' : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    AFTER
                  </button>
                </div>
              </div>

              {/* Photo Input Controls (Mobile Camera + File Upload) */}
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-3 px-3 bg-[#2C3E50] hover:bg-[#34495E] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Camera className="w-4 h-4 text-[#E67E22]" /> Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-3 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-gray-300 transition-colors"
                >
                  <Upload className="w-4 h-4 text-gray-600" /> Upload File
                </button>
              </div>

              {/* Photo Preview */}
              {evidencePreview && (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-video bg-black/5">
                  <img src={evidencePreview} alt="Selected preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setEvidenceFile(null);
                      setEvidencePreview(null);
                    }}
                    className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Observation Note */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Observation Note</label>
                <input
                  type="text"
                  placeholder="e.g., Depth 4cm, asphalt base intact..."
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#E67E22] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={!evidenceFile || uploadingEvidence}
                className="w-full py-2.5 bg-[#E67E22] hover:bg-[#D35400] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors shadow-xs"
              >
                {uploadingEvidence ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Save {evidenceType} Evidence
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 2. Before / Progress / After Gallery */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900">Recorded Field Evidence</h2>

            {/* Before Photos */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-700">Before Work Photo(s)</span>
                {hasBefore ? (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-red-500">Required before Start</span>
                )}
              </div>
              {beforeMedia.length === 0 ? (
                <div className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center text-xs text-gray-400">
                  No BEFORE photo captured yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {beforeMedia.map((m: any) => (
                    <img
                      key={m.id}
                      src={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${m.storage_path}`}
                      alt="Before work"
                      className="w-full aspect-video object-cover rounded-lg border border-gray-200"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Progress Photos */}
            <div>
              <span className="text-xs font-bold text-gray-700 block mb-1.5">Progress Photo(s) ({progressMedia.length})</span>
              {progressMedia.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {progressMedia.map((m: any) => (
                    <img
                      key={m.id}
                      src={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${m.storage_path}`}
                      alt="Progress work"
                      className="w-full aspect-video object-cover rounded-lg border border-gray-200"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">None uploaded</p>
              )}
            </div>

            {/* After Photos */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-700">After Work Photo(s)</span>
                {hasAfter ? (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-amber-600">Required for Completion</span>
                )}
              </div>
              {afterMedia.length === 0 ? (
                <div className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center text-xs text-gray-400">
                  No AFTER photo captured yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {afterMedia.map((m: any) => (
                    <img
                      key={m.id}
                      src={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${m.storage_path}`}
                      alt="After work"
                      className="w-full aspect-video object-cover rounded-lg border border-gray-200"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Field Notes Modal / Inline Panel */}
      {showNotesForm && (
        <div className="bg-white rounded-2xl p-6 border-2 border-[#E67E22] shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#2C3E50] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#E67E22]" /> Record Field Notes & Resource Usage
            </h3>
            <button onClick={() => setShowNotesForm(false)} className="text-gray-400 hover:text-black">✕</button>
          </div>

          <form onSubmit={handleSaveNotes} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Field Observation</label>
              <textarea
                rows={2}
                placeholder="e.g., Damaged surface area 4 sq meters..."
                value={fieldNotes.observation}
                onChange={(e) => setFieldNotes({ ...fieldNotes, observation: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Work Performed</label>
              <textarea
                rows={2}
                placeholder="e.g., Excavated loose bitumen and laid cold mix patch..."
                value={fieldNotes.work_performed}
                onChange={(e) => setFieldNotes({ ...fieldNotes, work_performed: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Materials Used</label>
              <input
                type="text"
                placeholder="e.g., 2 bags cold asphalt, 1 gallon sealant"
                value={fieldNotes.materials_used}
                onChange={(e) => setFieldNotes({ ...fieldNotes, materials_used: e.target.value })}
                className="w-full p-2 bg-gray-50 border rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Equipment Used</label>
              <input
                type="text"
                placeholder="e.g., Hand tamper, asphalt rake, safety cones"
                value={fieldNotes.equipment_used}
                onChange={(e) => setFieldNotes({ ...fieldNotes, equipment_used: e.target.value })}
                className="w-full p-2 bg-gray-50 border rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Crew Size</label>
              <input
                type="number"
                min={1}
                max={20}
                value={fieldNotes.crew_size}
                onChange={(e) => setFieldNotes({ ...fieldNotes, crew_size: parseInt(e.target.value) || 1 })}
                className="w-full p-2 bg-gray-50 border rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Actual Duration</label>
              <input
                type="text"
                placeholder="e.g., 2.5 hours"
                value={fieldNotes.actual_duration}
                onChange={(e) => setFieldNotes({ ...fieldNotes, actual_duration: e.target.value })}
                className="w-full p-2 bg-gray-50 border rounded-xl"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNotesForm(false)}
                className="px-4 py-2 border rounded-xl text-gray-600 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 bg-[#E67E22] text-white rounded-xl font-bold flex items-center gap-1.5"
              >
                Save Notes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Completion & Verification Submission Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-black text-[#2C3E50]">Submit Work for Verification</h3>
                <p className="text-xs text-gray-500">Administrator review will verify before marking Resolved</p>
              </div>
              <button onClick={() => setShowCompletionModal(false)} className="text-gray-400 hover:text-black">✕</button>
            </div>

            <form onSubmit={handleCompletionSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-800 block mb-1">
                  Completion Summary / Resolution Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the completed field repair, tests conducted, and current condition..."
                  value={completionData.resolution_note}
                  onChange={(e) => setCompletionData({ ...completionData, resolution_note: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              {/* AFTER Photo Upload if not already uploaded */}
              <div>
                <label className="font-bold text-gray-800 block mb-1">
                  AFTER Work Photo Evidence {!hasAfter && <span className="text-red-500">* (Mandatory)</span>}
                </label>
                <input
                  type="file"
                  ref={completionCameraInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setCompletionAfterFile(f);
                      setCompletionAfterPreview(URL.createObjectURL(f));
                    }
                  }}
                />
                <input
                  type="file"
                  ref={completionFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setCompletionAfterFile(f);
                      setCompletionAfterPreview(URL.createObjectURL(f));
                    }
                  }}
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => completionCameraInputRef.current?.click()}
                    className="py-2.5 px-3 bg-[#2C3E50] text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4 text-[#E67E22]" /> Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => completionFileInputRef.current?.click()}
                    className="py-2.5 px-3 bg-gray-100 text-gray-800 rounded-xl font-bold flex items-center justify-center gap-1.5 border border-gray-300"
                  >
                    <Upload className="w-4 h-4" /> Upload File
                  </button>
                </div>

                {completionAfterPreview && (
                  <div className="mt-2 aspect-video rounded-xl overflow-hidden border">
                    <img src={completionAfterPreview} alt="After preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-800 block mb-1">Actual Cost (₹)</label>
                  <input
                    type="text"
                    placeholder="e.g., 18500"
                    value={completionData.actual_cost}
                    onChange={(e) => setCompletionData({ ...completionData, actual_cost: e.target.value })}
                    className="w-full p-2 bg-gray-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-800 block mb-1">Actual Duration</label>
                  <input
                    type="text"
                    placeholder="e.g., 3 hours"
                    value={completionData.actual_duration}
                    onChange={(e) => setCompletionData({ ...completionData, actual_duration: e.target.value })}
                    className="w-full p-2 bg-gray-50 border rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCompletionModal(false)}
                  className="px-4 py-2 border rounded-xl text-gray-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit to Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Assistance Modal */}
      {showAssistanceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-500" /> Request Field Assistance
              </h3>
              <button onClick={() => setShowAssistanceModal(false)} className="text-gray-400 hover:text-black">✕</button>
            </div>

            <form onSubmit={handleRequestAssistance} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Support Category</label>
                <select
                  value={assistanceData.reason}
                  onChange={(e) => setAssistanceData({ ...assistanceData, reason: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl font-medium"
                >
                  <option value="Need More Workers">Need More Workers</option>
                  <option value="Need Materials">Need Materials</option>
                  <option value="Need Equipment">Need Equipment</option>
                  <option value="Safety Issue">Safety Issue</option>
                  <option value="Location Inaccessible">Location Inaccessible</option>
                  <option value="Another Department Required">Another Department Required</option>
                  <option value="Supervisor Required">Supervisor Required</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Specific Assistance Details</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the exact requirements or challenges..."
                  value={assistanceData.description}
                  onChange={(e) => setAssistanceData({ ...assistanceData, description: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAssistanceModal(false)}
                  className="px-4 py-2 border rounded-xl text-gray-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Dispatch Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unable to Complete Modal */}
      {showUnableModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" /> Report Inability to Complete
              </h3>
              <button onClick={() => setShowUnableModal(false)} className="text-gray-400 hover:text-black">✕</button>
            </div>

            <form onSubmit={handleUnableToComplete} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Primary Reason</label>
                <select
                  value={unableData.reason}
                  onChange={(e) => setUnableData({ ...unableData, reason: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl font-medium"
                >
                  <option value="Location Inaccessible">Location Inaccessible</option>
                  <option value="Material Unavailable">Material Unavailable</option>
                  <option value="Equipment Unavailable">Equipment Unavailable</option>
                  <option value="More Manpower Required">More Manpower Required</option>
                  <option value="Safety Issue">Safety Issue</option>
                  <option value="Incorrect Complaint Information">Incorrect Complaint Information</option>
                  <option value="Another Department Required">Another Department Required</option>
                  <option value="Weather/Environmental Issue">Weather/Environmental Issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Detailed Explanation</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why field repair cannot proceed so supervisors can take action..."
                  value={unableData.note}
                  onChange={(e) => setUnableData({ ...unableData, note: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowUnableModal(false)}
                  className="px-4 py-2 border rounded-xl text-gray-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Report to Supervisors
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
