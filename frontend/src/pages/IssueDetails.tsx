import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ArrowLeft, MapPin, Clock, Tag, AlertTriangle, User, Send, MessageSquare } from 'lucide-react';
import IssueUpvote from '../components/IssueUpvote';
import IssueComments from '../components/IssueComments';
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
          profiles:reporter_id (full_name)
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
        return 'bg-green-100 text-green-800 border-green-200';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
      case 'ACCEPTED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'REPORTED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'MORE_INFO_REQUIRED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const pendingRequest = informationRequests.find(r => r.status === 'PENDING');
  const pastRequests = informationRequests.filter(r => r.status !== 'PENDING');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="animate-spin h-10 w-10 text-[#40E0D0]" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Issue Not Found</h2>
        <p className="text-gray-500 mb-6">The issue you are looking for does not exist or has been removed.</p>
        <Link to="/dashboard" className="text-[#1A3636] font-medium hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/track" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to issues
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
              {issue.code || 'Pending Code'}
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(issue.status)}`}>
              {issue.status}
            </span>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{issue.title}</h1>
          
          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center">
              <User className="h-4 w-4 mr-1.5 text-gray-400" />
              {issue.profiles?.full_name || 'Citizen'}
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
              {new Date(issue.created_at).toLocaleString()}
            </div>
            {issue.category && (
              <div className="flex items-center">
                <Tag className="h-4 w-4 mr-1.5 text-gray-400" />
                {issue.category}
              </div>
            )}
            {issue.severity && (
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1.5 text-gray-400" />
                {issue.severity} Severity
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Additional Information Required Card (ONLY shown when there is an active pending request) */}
            {pendingRequest && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 space-y-4 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <span>Additional Information Required</span>
                </div>
                <div className="text-sm text-amber-950 bg-amber-100/80 p-4 rounded-lg border border-amber-200">
                  <div className="font-bold text-xs uppercase text-amber-800 tracking-wider mb-1">Admin Message:</div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed font-medium">{pendingRequest.message}</p>
                  <p className="text-[11px] text-amber-700/80 mt-2 font-mono">
                    Requested on {new Date(pendingRequest.created_at).toLocaleString()}
                  </p>
                </div>

                {_session?.user?.id === issue.reporter_id && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAddInfoModal(true)}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Add Additional Info
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Previous Information Requests & Citizen Responses History */}
            {pastRequests.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  Additional Information History ({pastRequests.length})
                </h3>
                <div className="space-y-3">
                  {pastRequests.map(req => (
                    <div key={req.id} className="bg-white p-4 rounded-lg border border-gray-200 text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-700">Admin Request:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.status === 'RESPONDED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-gray-800 bg-gray-50 p-2.5 rounded border border-gray-100 italic">"{req.message}"</p>
                      {req.response && (
                        <div className="pt-2 border-t border-gray-100 space-y-1.5">
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="font-bold text-green-700">Citizen Response:</span>
                            <span className="text-[10px] text-gray-400">{new Date(req.response.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-gray-900 bg-green-50/50 p-2.5 rounded border border-green-100">{req.response.message}</p>
                          {req.response.media?.storage_path && (
                            <div className="mt-2">
                              <p className="text-[10px] font-bold text-gray-500 mb-1">Attached Evidence:</p>
                              <a
                                href={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${req.response.media.storage_path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block rounded-lg overflow-hidden border border-gray-200 max-h-36"
                              >
                                <img
                                  src={`${import.meta.env.VITE_SUPABASE_URL || 'https://xrvflzrqmrcpsqjdyygh.supabase.co'}/storage/v1/object/public/issues/${req.response.media.storage_path}`}
                                  alt="Citizen evidence"
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

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 font-serif">Description</h3>
              <div className="prose prose-sm text-gray-600 max-w-none">
                <p className="whitespace-pre-wrap">{issue.description}</p>
              </div>
            </section>

            {imageUrl && (
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 font-serif">Attached Evidence</h3>
                <div className="rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
                  <img src={imageUrl} alt="Complaint Evidence" className="w-full h-auto object-contain max-h-96" />
                </div>
              </section>
            )}
            
            {issue.ai_confidence && (
              <section className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="text-sm font-semibold text-blue-900 mb-1 flex items-center">
                  <span className="mr-2">✨</span> AI Analysis
                </h3>
                <p className="text-sm text-blue-800">
                  This issue was automatically categorized as <strong>{issue.category}</strong> with a confidence score of {(issue.ai_confidence * 100).toFixed(0)}%.
                </p>
              </section>
            )}
          </div>
          
          <div className="space-y-6">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 font-serif">Location</h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-start text-sm text-gray-700">
                  <MapPin className="h-5 w-5 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{issue.address || `${issue.latitude}, ${issue.longitude}`}</span>
                </div>
              </div>
            </section>
            
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 font-serif">Timeline</h3>
              <div className="relative pl-4 border-l-2 border-gray-200 space-y-4">
                <div className="relative">
                  <div className="absolute -left-[21px] w-3 h-3 bg-[#40E0D0] rounded-full mt-1"></div>
                  <p className="text-sm font-medium text-gray-900">Issue Reported</p>
                  <p className="text-xs text-gray-500">{new Date(issue.created_at).toLocaleString()}</p>
                </div>
                {/* Additional timeline events would go here in a real app */}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 font-serif">Community</h3>
              <div className="flex flex-col gap-3">
                <IssueUpvote issueId={issue.id} variant="button" />
                <IssueComments issueId={issue.id} variant="button" />
              </div>
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
