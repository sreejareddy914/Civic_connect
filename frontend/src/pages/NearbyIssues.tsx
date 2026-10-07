import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Loader2, MapPin, Clock, AlertCircle } from 'lucide-react';
import IssueUpvote from '../components/IssueUpvote';
import IssueComments from '../components/IssueComments';

export default function NearbyIssues({ session: _session }: { session?: any }) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNearbyIssues();
  }, []);

  const fetchNearbyIssues = async () => {
    setLoading(true);
    try {
      // In a real app, this would use PostGIS or Haversine formula to filter by distance
      // For now, we just fetch recent issues not reported by the current user to simulate a feed
      const { data, error } = await supabase
        .from('issues')
        .select(`
          *,
          profiles:reporter_id (full_name),
          issue_media (storage_path)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIssues(data || []);
    } catch (error) {
      console.error('Error fetching nearby issues:', error);
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
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1A3636] font-serif">Community Issues Feed</h1>
        <p className="text-gray-600 mt-1">See what's being reported in your area</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-[#40E0D0]" />
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No nearby issues</h3>
          <p className="text-gray-500">Your community is looking great!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {issues.map((issue) => (
            <div key={issue.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2A4A4A] text-white flex items-center justify-center font-bold">
                      {issue.profiles?.full_name?.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{issue.profiles?.full_name || 'Citizen'}</p>
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(issue.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(issue.status)}`}>
                    {issue.status}
                  </span>
                </div>
                
                <h2 className="text-xl font-bold text-gray-900 mb-2">{issue.title}</h2>
                <p className="text-gray-600 mb-4">{issue.description}</p>
                
                {issue.issue_media && issue.issue_media.length > 0 && (
                  <div className="mb-4 rounded-lg overflow-hidden bg-gray-50 border border-gray-200">
                    <img 
                      src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/issues/${issue.issue_media[0].storage_path}`} 
                      alt="Complaint Evidence" 
                      className="w-full h-auto object-cover max-h-64" 
                    />
                  </div>
                )}
                
                {issue.address && (
                  <div className="flex items-center text-sm text-gray-500 mb-4">
                    <MapPin className="h-4 w-4 mr-1 text-[#40E0D0]" />
                    {issue.address}
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-6">
                    <IssueUpvote issueId={issue.id} variant="compact" />
                    <IssueComments issueId={issue.id} variant="compact" />
                  </div>
                  <Link 
                    to={`/issues/${issue.id}`}
                    className="text-sm font-medium text-[#1A3636] hover:text-[#40E0D0] transition-colors"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
