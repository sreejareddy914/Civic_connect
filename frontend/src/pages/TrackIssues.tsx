import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  AlertCircle, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  FileQuestion,
  PlusCircle,
  Trash2,
  Edit3
} from 'lucide-react';
import IssueUpvote from '../components/IssueUpvote';
import IssueComments from '../components/IssueComments';
import ComplaintShareButton from '../components/ComplaintShareButton';
import { citizenApi, type InformationRequest } from '../services/citizenApi';
import AddAdditionalInfoModal from '../components/AddAdditionalInfoModal';

export default function TrackIssues({ session }: { session: any }) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [pendingRequests, setPendingRequests] = useState<InformationRequest[]>([]);
  const [activeRequestForModal, setActiveRequestForModal] = useState<InformationRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      fetchIssues();
    }
  }, [session, filter]);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('issues')
        .select(`
          *,
          departments:department_id (name)
        `)
        .eq('reporter_id', session.user.id)
        .order('created_at', { ascending: false });

      if (filter !== 'ALL') {
        if (filter === 'ACTIVE') {
          query = query.in('status', ['REPORTED', 'MORE_INFO_REQUIRED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'CITIZEN_VERIFICATION']);
        } else if (filter === 'RESOLVED') {
          query = query.in('status', ['RESOLVED', 'CLOSED']);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setIssues(data || []);

      // Fetch pending requests
      try {
        const reqs = await citizenApi.getMyPendingRequests();
        setPendingRequests(reqs);
      } catch (e) {
        console.warn('Failed to fetch pending requests in TrackIssues:', e);
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
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

  if (!session) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-teal-50 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-teal-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to track your civic reports</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-sm">You must be logged in to review your reported complaints and status updates.</p>
        <Link 
          to="/login" 
          className="px-6 py-2.5 bg-[#1A3636] hover:bg-[#254d4d] text-white font-bold rounded-xl text-sm shadow-sm transition"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            My Civic Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor real-time progress, municipal worker assignments, and verification statuses
          </p>
        </div>
        
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs self-stretch sm:self-auto justify-between sm:justify-start">
          {[
            { id: 'ALL', label: 'All Issues' },
            { id: 'ACTIVE', label: 'In Progress' },
            { id: 'RESOLVED', label: 'Resolved' },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                filter === tab.id 
                  ? 'bg-[#1A3636] text-white shadow-xs' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Issues Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-[#0d9488] mb-3" />
          <p className="text-xs text-gray-500 font-medium">Retrieving your reports...</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-12 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No complaints found</h3>
          <p className="text-xs text-gray-500 mb-6">
            You don't have any reported issues under the "{filter}" category filter.
          </p>
          <Link 
            to="/report" 
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-xs text-xs font-bold text-white bg-[#1A3636] hover:bg-[#254d4d] transition-all"
          >
            <PlusCircle className="w-4 h-4 text-[#40E0D0]" />
            <span>Submit a New Report</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {issues.map((issue) => {
            const activeReq = pendingRequests.find(r => r.issue_id === issue.id && r.status === 'PENDING');

            return (
              <div 
                key={issue.id} 
                onClick={() => navigate(`/issues/${issue.id}`)}
                className="group cursor-pointer bg-white rounded-2xl shadow-xs border border-gray-200/90 hover:border-teal-300 hover:shadow-sm transition-all overflow-hidden p-5 sm:p-6 space-y-4"
              >
                {/* Active Clarification Request Banner */}
                {activeReq && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveRequestForModal(activeReq);
                      setIsModalOpen(true);
                    }}
                    className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-amber-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                      <span className="text-xs font-bold text-amber-950 truncate">
                        Action Required: "{activeReq.message}"
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 rounded-lg shrink-0 transition-colors shadow-2xs">
                      <FileQuestion className="h-3.5 w-3.5" />
                      <span>Provide Info</span>
                    </span>
                  </div>
                )}

                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono font-bold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md">
                      {issue.code || 'PENDING'}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(issue.status)}`}>
                      {activeReq ? 'INFO REQUIRED' : issue.status}
                    </span>
                    {issue.category && (
                      <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                        {issue.category}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center text-xs text-gray-400 gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(issue.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h2 className="text-lg font-bold text-gray-900 group-hover:text-teal-900 transition-colors leading-snug">
                    {issue.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mt-1 leading-relaxed">
                    {issue.description}
                  </p>
                </div>
                
                {/* Location */}
                {issue.address && (
                  <div className="flex items-center text-xs text-gray-500">
                    <MapPin className="h-3.5 w-3.5 mr-1.5 text-rose-500 shrink-0" />
                    <span className="truncate">{issue.address}</span>
                  </div>
                )}
                
                {/* Card Footer: [ Upvote ] [ Comments ] [ Share ] and Edit/Delete */}
                <div className="pt-3.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <IssueUpvote issueId={issue.id} variant="compact" />
                    <IssueComments issueId={issue.id} variant="compact" />
                    <ComplaintShareButton
                      issueId={issue.id}
                      title={issue.title}
                      code={issue.code}
                      category={issue.category}
                      description={issue.description}
                      variant="compact"
                    />
                  </div>
                  
                  {/* Edit/Delete actions if still in REPORTED status */}
                  <div className="flex items-center gap-2 ml-auto">
                    {issue.status === 'REPORTED' && !activeReq && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/issues/${issue.id}/edit`);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this complaint? This cannot be undone.')) {
                              try {
                                const token = (await supabase.auth.getSession()).data.session?.access_token;
                                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                                const res = await fetch(`${apiUrl}/issues/${issue.id}`, {
                                  method: 'DELETE',
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (res.ok) {
                                  setIssues(issues.filter(i => i.id !== issue.id));
                                } else {
                                  const { error } = await res.json();
                                  alert(`Failed to delete: ${error}`);
                                }
                              } catch (err) {
                                alert('Error deleting complaint');
                              }
                            }
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </>
                    )}

                    <span className="text-xs font-bold text-teal-700 group-hover:translate-x-0.5 transition-transform flex items-center pl-2">
                      View Details →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for adding additional information */}
      {activeRequestForModal && (
        <AddAdditionalInfoModal
          request={activeRequestForModal}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setActiveRequestForModal(null);
          }}
          onSuccess={() => {
            fetchIssues();
          }}
        />
      )}
    </div>
  );
}
