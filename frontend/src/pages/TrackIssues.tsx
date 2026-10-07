import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, MapPin, Clock, AlertTriangle, FileQuestion } from 'lucide-react';
import IssueUpvote from '../components/IssueUpvote';
import IssueComments from '../components/IssueComments';
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
        .select('*')
        .eq('reporter_id', session.user.id)
        .order('created_at', { ascending: false });

      if (filter !== 'ALL') {
        if (filter === 'ACTIVE') {
          query = query.in('status', ['REPORTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'CITIZEN_VERIFICATION']);
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
        return 'bg-green-100 text-green-800 border-green-200';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
      case 'ACCEPTED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'REPORTED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'CITIZEN_VERIFICATION':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!session) {
    return (
      <div className="flex justify-center items-center py-20 flex-col text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-medium text-gray-900">Please sign in to view your tracked issues</h2>
        <Link to="/login" className="mt-4 text-[#40E0D0] hover:underline font-medium">Go to Login</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A3636] font-serif">Track My Issues</h1>
          <p className="text-gray-600 mt-1">Monitor the progress of your civic reports</p>
        </div>
        
        <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
          <button 
            onClick={() => setFilter('ALL')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'ALL' ? 'bg-[#1A3636] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('ACTIVE')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'ACTIVE' ? 'bg-[#1A3636] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Active
          </button>
          <button 
            onClick={() => setFilter('RESOLVED')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'RESOLVED' ? 'bg-[#1A3636] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Resolved
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-[#40E0D0]" />
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No issues found</h3>
          <p className="text-gray-500 mb-6">You haven't reported any issues that match this filter.</p>
          <Link to="/report" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#1A3636] hover:bg-[#234b4b]">
            Report an Issue
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {issues.map((issue) => {
            const activeReq = pendingRequests.find(r => r.issue_id === issue.id && r.status === 'PENDING');

            return (
              <div 
                key={issue.id} 
                onClick={() => navigate(`/issues/${issue.id}`)}
                className="block cursor-pointer bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  {/* Active Request Indicator on THIS specific complaint only */}
                  {activeReq && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRequestForModal(activeReq);
                        setIsModalOpen(true);
                      }}
                      className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 hover:bg-amber-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-bold text-amber-900 truncate">
                          Additional Information Required: "{activeReq.message}"
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-200/90 hover:bg-amber-300 px-3 py-1 rounded-lg shrink-0 transition-colors">
                        <FileQuestion className="h-3.5 w-3.5" />
                        View Request
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1A3636] text-white flex items-center justify-center font-bold">
                        {session.user.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">You</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(issue.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(issue.status)}`}>
                      {activeReq ? 'INFO REQUIRED' : issue.status}
                    </span>
                  </div>
                  
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{issue.title}</h2>
                  <p className="text-gray-600 mb-4 line-clamp-2">{issue.description}</p>
                  
                  {issue.address && (
                    <div className="flex items-center text-sm text-gray-500 mb-4">
                      <MapPin className="h-4 w-4 mr-1 text-[#40E0D0]" />
                      {issue.address}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-6 pt-4 border-t border-gray-100 flex-wrap">
                    <div className="flex items-center text-gray-500 text-sm">
                      <span className="font-medium mr-1 text-gray-700">Code:</span> {issue.code || 'Pending'}
                    </div>
                    <IssueUpvote issueId={issue.id} variant="compact" />
                    <IssueComments issueId={issue.id} variant="compact" />
                    
                    {issue.status === 'REPORTED' && !activeReq && (
                      <div className="ml-auto flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/issues/${issue.id}/edit`);
                          }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-md"
                        >
                          Edit
                        </button>
                        <button
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
                          className="text-sm font-medium text-red-600 hover:text-red-800 bg-red-50 px-3 py-1 rounded-md"
                        >
                          Delete
                        </button>
                      </div>
                    )}
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
