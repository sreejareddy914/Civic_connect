import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { 
  Loader2, 
  AlertCircle, 
  PlusCircle, 
  Map, 
  MapPin, 
  Activity, 
  Bell, 
  ChevronRight, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  FileQuestion
} from 'lucide-react';
import { citizenApi, type InformationRequest } from '../services/citizenApi';
import AddAdditionalInfoModal from '../components/AddAdditionalInfoModal';

export default function Dashboard({ session }: { session: any }) {
  const [issues, setIssues] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, inProgress: 0, resolved: 0 });

  // Information requests and real notifications state
  const [pendingRequests, setPendingRequests] = useState<InformationRequest[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeRequestForModal, setActiveRequestForModal] = useState<InformationRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (session) {
      fetchDashboardData();

      // Realtime subscription for notifications and status changes
      const channel = supabase
        .channel(`citizen-dashboard-${session.user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `profile_id=eq.${session.user.id}` },
          () => {
            fetchDashboardData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'issues', filter: `reporter_id=eq.${session.user.id}` },
          () => {
            fetchDashboardData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session]);

  const fetchDashboardData = async () => {
    try {
      const [issuesRes, profileRes, notifsRes] = await Promise.all([
        supabase
          .from('issues')
          .select('*')
          .eq('reporter_id', session.user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single(),
        supabase
          .from('notifications')
          .select('*')
          .eq('profile_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      if (issuesRes.error) throw issuesRes.error;
      
      const activeIssues = issuesRes.data || [];
      setIssues(activeIssues.slice(0, 5)); // Just show recent 5 in dashboard
      setProfile(profileRes.data);
      setNotifications(notifsRes.data || []);
      
      setStats({
        total: activeIssues.length,
        inProgress: activeIssues.filter(i => i.status === 'IN_PROGRESS' || i.status === 'ASSIGNED' || i.status === 'ACCEPTED').length,
        resolved: activeIssues.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length
      });

      // Fetch pending information requests for this citizen
      try {
        const reqs = await citizenApi.getMyPendingRequests();
        setPendingRequests(reqs);
      } catch (reqErr) {
        console.warn('Failed to load pending requests:', reqErr);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);

      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  if (!session) {
    return (
      <div className="text-center mt-20">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-medium text-gray-900">Please sign in to view your dashboard</h2>
      </div>
    );
  }

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* A. Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1A3636] font-serif mb-2">
          Good day, {session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Citizen'}
        </h1>
        <p className="text-gray-600 text-lg">
          Your civic engagement helps build a better community. What would you like to do today?
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* B. Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to="/report" className="flex flex-col items-center justify-center p-6 bg-[#1A3636] text-white rounded-xl shadow-sm hover:bg-[#234b4b] transition-colors border border-[#1A3636]">
              <PlusCircle className="h-8 w-8 mb-3 text-[#40E0D0]" />
              <span className="font-semibold text-lg">Report Issue</span>
              <span className="text-sm text-gray-300 mt-1">Found a problem? Let us know.</span>
            </Link>
            <Link to="/track" className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200">
              <Activity className="h-8 w-8 mb-3 text-[#1A3636]" />
              <span className="font-semibold text-lg text-gray-900">Track My Issues</span>
              <span className="text-sm text-gray-500 mt-1">Check status of your reports.</span>
            </Link>
            <Link to="/nearby" className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200">
              <MapPin className="h-8 w-8 mb-3 text-[#1A3636]" />
              <span className="font-semibold text-lg text-gray-900">Nearby Issues</span>
              <span className="text-sm text-gray-500 mt-1">See what's happening locally.</span>
            </Link>
          </div>

          {/* D. Recent Reports */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-[#FAF9F6]">
              <h2 className="text-xl font-bold text-[#1A3636] font-serif flex items-center">
                <Clock className="h-5 w-5 mr-2 text-[#40E0D0]" />
                Recent Reports
              </h2>
              <Link to="/track" className="text-sm font-medium text-[#1A3636] hover:text-[#40E0D0] flex items-center">
                View all <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin h-8 w-8 text-[#1A3636]" />
                </div>
              ) : issues.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">You haven't reported any issues recently.</p>
                  <Link to="/report" className="mt-4 inline-block text-[#1A3636] font-medium hover:underline">
                    Report your first issue
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {issues.map((issue) => {
                    const hasActiveRequest = pendingRequests.some(r => r.issue_id === issue.id && r.status === 'PENDING');
                    const activeReq = pendingRequests.find(r => r.issue_id === issue.id && r.status === 'PENDING');

                    return (
                      <div key={issue.id} className="flex items-start p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1 gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                              {hasActiveRequest && (
                                <button
                                  onClick={() => {
                                    if (activeReq) {
                                      setActiveRequestForModal(activeReq);
                                      setIsModalOpen(true);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                                  title="Admin requested additional information for this complaint"
                                >
                                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  <span>Additional Info Required</span>
                                </button>
                              )}
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(issue.status)}`}>
                              {issue.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 line-clamp-1 mb-2">{issue.description}</p>
                          <div className="flex items-center text-xs text-gray-400 space-x-4">
                            <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                            <span>{issue.code || 'Pending'}</span>
                            <span>{issue.category}</span>
                            <Link to={`/issues/${issue.id}`} className="text-emerald-700 hover:underline font-semibold ml-auto">
                              Details →
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* E. Help Verify */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-[#FAF9F6]">
              <h2 className="text-xl font-bold text-[#1A3636] font-serif flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-[#40E0D0]" />
                Help Verify
              </h2>
            </div>
            <div className="p-6 text-center">
              <p className="text-gray-500 mb-4">Earn civic points by verifying issues reported by others in your neighborhood.</p>
              <Link to="/map?mode=verify" className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors">
                Find issues to verify
              </Link>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* C. My Impact */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-[#1A3636] font-serif mb-4">My Impact</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                <div className="text-3xl font-bold text-[#1A3636]">{stats.total}</div>
                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Total Reports</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                <div className="text-3xl font-bold text-green-700">{stats.resolved}</div>
                <div className="text-xs text-green-600 mt-1 uppercase tracking-wider font-semibold">Resolved</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100 col-span-2">
                <div className="text-3xl font-bold text-blue-700">{stats.inProgress}</div>
                <div className="text-xs text-blue-600 mt-1 uppercase tracking-wider font-semibold">In Progress</div>
              </div>
            </div>
            
            {/* Civic Points */}
            {profile && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Civic Points</h3>
                    <p className="text-2xl font-black text-indigo-600">{profile.civic_points || 0}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Level</h3>
                    <p className="text-indigo-600 font-bold">{profile.civic_level || 'New Citizen'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* F. Notifications Section — Contains dedicated Active Requests */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-[#FAF9F6]">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Bell className="h-5 w-5 mr-2 text-gray-500" />
                Notifications
              </h2>
              <Link to="/notifications" className="text-xs font-medium text-blue-600 hover:text-blue-800">
                All
              </Link>
            </div>

            <div className="p-0 divide-y divide-gray-100">
              {/* 1. DEDICATED ACTION CARDS: Active Information Requests */}
              {pendingRequests.map((req) => (
                <div 
                  key={req.id} 
                  className="p-4 bg-amber-50/90 hover:bg-amber-100/70 transition-colors border-l-4 border-amber-500"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      Additional Information Required
                    </span>
                    <span className="text-[10px] text-amber-700/80 font-medium">
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-gray-800 font-medium">
                    Admin requested more information for: <span className="font-bold text-gray-900">"{req.issue?.title || 'Civic Issue'}"</span>
                  </p>

                  {/* Exact Admin Message */}
                  <div className="mt-2 p-2.5 bg-white rounded-lg border border-amber-200 text-xs text-gray-700 font-medium whitespace-pre-wrap leading-relaxed shadow-2xs">
                    "{req.message}"
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">
                      {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Dedicated Add Additional Info Button: DIRECTLY under the Admin message */}
                    <button
                      onClick={() => {
                        setActiveRequestForModal(req);
                        setIsModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileQuestion className="h-3.5 w-3.5" />
                      Add Additional Info
                    </button>
                  </div>
                </div>
              ))}

              {/* 2. Regular notifications */}
              {notifications.length === 0 && pendingRequests.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    onClick={() => !notif.is_read && handleMarkNotificationRead(notif.id)}
                    className={`p-4 hover:bg-gray-50 transition-colors ${notif.is_read ? 'opacity-70' : 'bg-blue-50/20 font-semibold'}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                      {!notif.is_read && (
                        <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(notif.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* H. Community Map Snippet */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Map className="h-5 w-5 mr-2 text-gray-500" />
                Community Map
              </h2>
            </div>
            <div className="h-48 bg-gray-200 relative">
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <Map className="h-12 w-12 text-gray-300" />
              </div>
              <Link 
                to="/map" 
                className="absolute bottom-4 right-4 bg-white px-3 py-1.5 rounded-md text-sm font-medium text-[#1A3636] shadow-sm border border-gray-200 hover:bg-gray-50"
              >
                Open Map
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Interactive Modal for adding additional information */}
      {activeRequestForModal && (
        <AddAdditionalInfoModal
          request={activeRequestForModal}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setActiveRequestForModal(null);
          }}
          onSuccess={() => {
            fetchDashboardData();
          }}
        />
      )}
    </div>
  );
}
