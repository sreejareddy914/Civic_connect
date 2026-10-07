import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Loader2, 
  AlertCircle,
  ArrowLeft, 
  MapPin, 
  Clock, 
  Tag, 
  AlertTriangle, 
  User, 
  Send, 
  MessageSquare,
  Building2,
  Sparkles,
  Calendar
} from 'lucide-react';
import IssueUpvote from '../components/IssueUpvote';
import IssueComments from '../components/IssueComments';
import ComplaintShareButton from '../components/ComplaintShareButton';
import AddAdditionalInfoModal from '../components/AddAdditionalInfoModal';
import { citizenApi, type InformationRequest } from '../services/citizenApi';

export default function IssueDetails({ session: _session }: { session?: any }) {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Persistent Information Requests state
  const [informationRequests, setInformationRequests] = useState<InformationRequest[]>([]);
  const [showAddInfoModal, setShowAddInfoModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchIssueDetails();
    }
  }, [id]);

  const fetchIssueDetails = async () => {
    try {
      const { data: issueData, error } = await supabase
        .from('issues')
        .select(`
          *,
          profiles:reporter_id (full_name),
          departments:department_id (name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setIssue(issueData);

      // Fetch persistent information requests history for this issue
      try {
        const infoReqs = await citizenApi.getIssueInformationRequests(id!);
        setInformationRequests(infoReqs);
      } catch (e) {
        console.error('Failed to load info requests', e);
      }
      
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const response = await fetch(`${apiUrl}/issues/${id}/extra`);
        if (response.ok) {
          const extraData = await response.json();
          if (extraData.media?.storage_path) {
            setImageUrl(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/issues/${extraData.media.storage_path}`);
          }
        }
      } catch (e) {
        console.error('Failed to fetch extra media info', e);
      }
    } catch (error) {
      console.error('Error fetching issue details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
      case 'ACCEPTED':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'REPORTED':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'MORE_INFO_REQUIRED':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'CITIZEN_VERIFICATION':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityBadge = (severity?: string) => {
    const s = severity?.toUpperCase() || 'LOW';
    if (s === 'CRITICAL' || s === 'HIGH') {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (s === 'MEDIUM') {
      return 'bg-orange-50 text-orange-700 border-orange-200';
    }
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const pendingRequest = informationRequests.find(r => r.status === 'PENDING');
  const pastRequests = informationRequests.filter(r => r.status !== 'PENDING');

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[70vh]">
        <Loader2 className="animate-spin h-10 w-10 text-[#0d9488] mb-3" />
        <p className="text-xs text-gray-500 font-medium">Loading complaint details...</p>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Complaint Not Found</h2>
        <p className="text-gray-500 mb-6 text-sm">The civic complaint you are looking for does not exist or has been removed.</p>
        <Link 
          to="/dashboard" 
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A3636] text-white font-bold text-xs rounded-xl hover:bg-[#254d4d] transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  // Preserve anonymous reporting identity if profile is empty or anonymous
  const reporterDisplay = issue.profiles?.full_name || 'Anonymous Citizen';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between gap-4">
        <Link 
          to="/track" 
          className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> 
          <span>Back to My Issues</span>
        </Link>

        {/* Quick Share on Top */}
        <div className="flex items-center gap-2">
          <ComplaintShareButton
            issueId={issue.id}
            title={issue.title}
            code={issue.code}
            category={issue.category}
            description={issue.description}
            variant="compact"
            className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs"
          />
        </div>
      </div>

      {/* Main Complaint Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-bold bg-gray-200/80 text-gray-800">
                {issue.code || 'PENDING CODE'}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(issue.status)}`}>
                {issue.status}
              </span>
              {issue.severity && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getSeverityBadge(issue.severity)}`}>
                  {issue.severity} Priority
                </span>
              )}
            </div>

            <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(issue.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
            {issue.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-gray-600 mt-4 pt-4 border-t border-gray-200/60">
            <div className="flex items-center">
              <User className="h-4 w-4 mr-1.5 text-gray-400" />
              <span className="font-medium text-gray-700">Reported by:</span>
              <span className="ml-1 text-gray-900 font-semibold">{reporterDisplay}</span>
            </div>
            {issue.departments?.name && (
              <div className="flex items-center">
                <Building2 className="h-4 w-4 mr-1.5 text-gray-400" />
                <span className="font-medium text-gray-700">Department:</span>
                <span className="ml-1 text-gray-900 font-semibold">{issue.departments.name}</span>
              </div>
            )}
            {issue.category && (
              <div className="flex items-center">
                <Tag className="h-4 w-4 mr-1.5 text-gray-400" />
                <span className="font-medium text-gray-700">Category:</span>
                <span className="ml-1 text-gray-900 font-semibold">{issue.category}</span>
              </div>
            )}
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
              <span>{new Date(issue.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main 2-column detail column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Active Request for Information Banner */}
            {pendingRequest && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-4 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <span>Additional Information Requested by Authority</span>
                </div>
                
                <div className="text-xs text-amber-950 bg-amber-100/90 p-4 rounded-xl border border-amber-200">
                  <div className="font-extrabold uppercase text-[10px] text-amber-800 tracking-wider mb-1">
                    Official Admin Message:
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed font-medium">"{pendingRequest.message}"</p>
                  <p className="text-[10px] text-amber-800/80 mt-2 font-mono">
                    Requested on {new Date(pendingRequest.created_at).toLocaleString()}
                  </p>
                </div>

                {_session?.user?.id === issue.reporter_id && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAddInfoModal(true)}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Provide Requested Information</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Previous Requests History */}
            {pastRequests.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  <span>Information Clarifications History ({pastRequests.length})</span>
                </h3>
                <div className="space-y-3">
                  {pastRequests.map(req => (
                    <div key={req.id} className="bg-white p-4 rounded-xl border border-gray-200/80 text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-700">Official Request:</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          req.status === 'RESPONDED' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-gray-800 bg-gray-50 p-2.5 rounded-lg border border-gray-100 italic">"{req.message}"</p>
                      {req.response && (
                        <div className="pt-2 border-t border-gray-100 space-y-1.5">
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="font-bold text-teal-800">Your Response:</span>
                            <span className="text-[10px] text-gray-400">{new Date(req.response.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-gray-900 bg-teal-50/40 p-2.5 rounded-lg border border-teal-100/60">{req.response.message}</p>
                          {req.response.media?.storage_path && (
                            <div className="mt-2">
                              <p className="text-[10px] font-bold text-gray-500 mb-1">Attached Clarification Photo:</p>
                              <a
                                href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/issues/${req.response.media.storage_path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block rounded-xl overflow-hidden border border-gray-200 max-h-36"
                              >
                                <img
                                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/issues/${req.response.media.storage_path}`}
                                  alt="Citizen clarification evidence"
                                  className="h-28 w-auto object-cover hover:opacity-90 transition"
                                />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description Section */}
            <section className="space-y-2">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Detailed Description
              </h3>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                {issue.description}
              </div>
            </section>

            {/* Attached Photo Evidence */}
            {imageUrl && (
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Attached Photo Evidence
                </h3>
                <div className="rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 max-h-96 flex items-center justify-center">
                  <img 
                    src={imageUrl} 
                    alt="Complaint Evidence" 
                    className="w-full h-auto max-h-96 object-contain" 
                  />
                </div>
              </section>
            )}
            
            {/* AI Automated Diagnostic Analysis */}
            {issue.ai_confidence && (
              <section className="bg-teal-50/70 p-4.5 rounded-2xl border border-teal-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-teal-950 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-[#0d9488]" />
                  <span>Civic AI Diagnosis</span>
                </div>
                <p className="text-xs text-teal-900 leading-relaxed">
                  This issue was analyzed and categorized automatically under <strong>{issue.category}</strong> with a confidence score of <strong>{(issue.ai_confidence * 100).toFixed(0)}%</strong>.
                </p>
              </section>
            )}
          </div>
          
          {/* Right sidebar column: Location, Timeline, Community Actions */}
          <div className="space-y-6">
            
            {/* Location */}
            <section className="bg-white rounded-xl p-5 border border-gray-200/80 space-y-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-rose-500" />
                <span>Location</span>
              </h3>
              <p className="text-xs text-gray-700 leading-relaxed font-medium">
                {issue.address || `${issue.latitude}, ${issue.longitude}`}
              </p>
              {issue.latitude && issue.longitude && (
                <div className="pt-2 border-t border-gray-100">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${issue.latitude},${issue.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1"
                  >
                    View in Google Maps →
                  </a>
                </div>
              )}
            </section>
            
            {/* Timeline */}
            <section className="bg-white rounded-xl p-5 border border-gray-200/80 space-y-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#0d9488]" />
                <span>Status Timeline</span>
              </h3>
              <div className="relative pl-5 border-l-2 border-teal-200 space-y-4">
                <div className="relative">
                  <div className="absolute -left-[25px] top-1 w-3 h-3 bg-teal-500 rounded-full ring-4 ring-white" />
                  <p className="text-xs font-bold text-gray-900 leading-tight">Issue Reported</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{new Date(issue.created_at).toLocaleString()}</p>
                </div>
                {issue.status !== 'REPORTED' && (
                  <div className="relative">
                    <div className="absolute -left-[25px] top-1 w-3 h-3 bg-emerald-500 rounded-full ring-4 ring-white" />
                    <p className="text-xs font-bold text-gray-900 leading-tight">Current Status: {issue.status}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Updated by Municipal Department</p>
                  </div>
                )}
              </div>
            </section>

            {/* ============================================================ */}
            {/* COMMUNITY ACTION CLUSTER: [ UPVOTE ] [ COMMENTS ] [ SHARE ]  */}
            {/* ============================================================ */}
            <section className="bg-white rounded-2xl p-5 border border-gray-200/80 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Community Engagement
                </h3>
                <span className="text-[10px] text-gray-400">Public visibility</span>
              </div>
              
              <div className="flex flex-col gap-2.5">
                {/* 1. UPVOTE */}
                <IssueUpvote issueId={issue.id} variant="button" />

                {/* 2. COMMENTS */}
                <IssueComments issueId={issue.id} variant="button" />

                {/* 3. SHARE COMPLAINT */}
                <ComplaintShareButton
                  issueId={issue.id}
                  title={issue.title}
                  code={issue.code}
                  category={issue.category}
                  description={issue.description}
                  variant="button"
                />
              </div>

              <p className="text-[11px] text-gray-400 text-center pt-2 border-t border-gray-100">
                Sharing helps neighbors stay informed and prioritize civic resolution.
              </p>
            </section>

          </div>
        </div>
      </div>

      {/* Citizen Additional Information Modal */}
      {pendingRequest && (
        <AddAdditionalInfoModal
          request={pendingRequest}
          isOpen={showAddInfoModal}
          onClose={() => setShowAddInfoModal(false)}
          onSuccess={async () => {
            await fetchIssueDetails();
          }}
        />
      )}
    </div>
  );
}
