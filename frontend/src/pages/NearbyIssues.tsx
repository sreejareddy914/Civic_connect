import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Loader2, MapPin, Clock, AlertCircle, Flame, ArrowRight, Tag } from 'lucide-react';
import IssueUpvote from '../components/IssueUpvote';
import IssueComments from '../components/IssueComments';
import ComplaintShareButton from '../components/ComplaintShareButton';

export default function NearbyIssues({ session: _session }: { session?: any }) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNearbyIssues();
  }, []);

  const fetchNearbyIssues = async () => {
    setLoading(true);
    try {
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
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
      case 'ACCEPTED':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'REPORTED':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200/80 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
            <Flame className="w-5 h-5 text-amber-600" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Community Issues Feed
          </h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Stay informed about municipal complaints and civic actions happening in your neighborhood.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-[#0d9488] mb-3" />
          <p className="text-xs text-gray-500 font-medium">Loading community feed...</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-12 text-center max-w-md mx-auto">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-base font-bold text-gray-900 mb-1">No community issues</h3>
          <p className="text-xs text-gray-500">
            No complaints recorded in this neighborhood yet. Your community is looking great!
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {issues.map((issue) => {
            const reporterName = issue.profiles?.full_name || 'Anonymous Citizen';

            return (
              <div 
                key={issue.id} 
                className="bg-white rounded-2xl shadow-xs border border-gray-200/90 overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Reporter header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#1A3636] text-[#40E0D0] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {reporterName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 leading-tight">{reporterName}</p>
                        <div className="flex items-center text-[11px] text-gray-400 mt-0.5">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>{new Date(issue.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(issue.status)}`}>
                        {issue.status}
                      </span>
                    </div>
                  </div>
                  
                  {/* Title & Description */}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-snug">
                      {issue.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 line-clamp-3 mt-1.5 leading-relaxed">
                      {issue.description}
                    </p>
                  </div>
                  
                  {/* Evidence Image */}
                  {issue.issue_media && issue.issue_media.length > 0 && (
                    <div className="rounded-xl overflow-hidden bg-gray-50 border border-gray-200 max-h-72">
                      <img 
                        src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/issues/${issue.issue_media[0].storage_path}`} 
                        alt="Complaint Evidence" 
                        className="w-full h-auto object-cover max-h-72" 
                      />
                    </div>
                  )}
                  
                  {/* Location & Category */}
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-500">
                    {issue.category && (
                      <div className="flex items-center">
                        <Tag className="h-3.5 w-3.5 mr-1 text-gray-400" />
                        <span className="font-medium text-gray-700">{issue.category}</span>
                      </div>
                    )}
                    {issue.address && (
                      <div className="flex items-center">
                        <MapPin className="h-3.5 w-3.5 mr-1 text-rose-500 shrink-0" />
                        <span className="truncate max-w-xs">{issue.address}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Card actions: Upvote + Comments + Share + View Details */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-gray-100">
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

                    <Link 
                      to={`/issues/${issue.id}`}
                      className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 transition-colors ml-auto"
                    >
                      <span>View Details</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
