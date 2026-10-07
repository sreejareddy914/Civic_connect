import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { 
  Loader2, 
  AlertCircle, 
  PlusCircle, 
  Map, 
  MapPin, 
  FileText, 
  Bell, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  FileQuestion,
  Award,
  TrendingUp,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { citizenApi, type InformationRequest } from '../services/citizenApi';
import AddAdditionalInfoModal from '../components/AddAdditionalInfoModal';
import IssueUpvote from '../components/IssueUpvote';
import IssueComments from '../components/IssueComments';
import ComplaintShareButton from '../components/ComplaintShareButton';

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
      setIssues(activeIssues.slice(0, 5)); // Recent 5 in dashboard
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
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-teal-50 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-teal-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to your CivicConnect Account</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-sm">Access your civic reports, track resolution progress, and earn community points.</p>
        <Link
          to="/login"
          className="px-6 py-2.5 bg-[#1A3636] hover:bg-[#254d4d] text-white font-bold rounded-xl text-sm shadow-sm transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
      case 'ACCEPTED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'REPORTED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MORE_INFO_REQUIRED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'CITIZEN_VERIFICATION':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const citizenName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Citizen';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* ============================================================ */}
      {/* 1. GREETING & CITIZEN STATUS BANNER                          */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-gray-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-teal-50 to-transparent rounded-bl-full pointer-events-none -z-0" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <Sparkles className="w-3.5 h-3.5 text-[#0d9488]" />
              Civic Citizen
            </span>
            <span className="text-xs text-gray-400 font-medium">
              Member since {new Date(session.user.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Welcome back, <span className="text-[#1A3636]">{citizenName}</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 max-w-xl">
            Track reported issues in your neighborhood, coordinate with civic workers, and earn points for keeping your city clean.
          </p>
        </div>

        {/* Impact quick pills */}
        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
          <div className="bg-gradient-to-br from-[#1A3636] to-[#264e4e] text-white px-5 py-3 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#40E0D0]" />
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-teal-200/90">Civic Points</p>
                <p className="text-xl font-black text-white leading-tight">{profile?.civic_points || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-teal-50 border border-teal-200 text-teal-900 px-4 py-3 rounded-xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-teal-700">Community Rank</p>
            <p className="text-sm font-bold text-teal-900 leading-tight">{profile?.civic_level || 'New Citizen'}</p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. DEDICATED ACTION ALERTS: PENDING INFORMATION REQUESTS     */}
      {/* ============================================================ */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          {pendingRequests.map((req) => (
            <div 
              key={req.id} 
              className="p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800 shrink-0 mt-0.5">
                  <AlertTriangle className="h-6 w-6 text-amber-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md">
                      Action Required
                    </span>
                    <span className="text-xs text-amber-700 font-medium">
                      Requested {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                    Admin requested additional info for: <span className="text-amber-950 font-extrabold">"{req.issue?.title || 'Civic Issue'}"</span>
                  </h3>
                  <p className="text-xs text-gray-700 mt-1 italic bg-white/70 p-2.5 rounded-lg border border-amber-200 max-w-2xl">
                    "{req.message}"
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveRequestForModal(req);
                  setIsModalOpen(true);
                }}
                className="w-full md:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <FileQuestion className="h-4 w-4" />
                <span>Provide Information Now</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. HERO QUICK ACTIONS ROW                                     */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link 
          to="/report" 
          className="group flex flex-col justify-between p-5 sm:p-6 bg-[#1A3636] hover:bg-[#234b4b] text-white rounded-2xl shadow-xs transition-all border border-[#1A3636] relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#40E0D0]/20 rounded-xl text-[#40E0D0] group-hover:scale-105 transition-transform">
              <PlusCircle className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-teal-300/80 group-hover:translate-x-1 transition-transform" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#FAF9F6] leading-tight">Report an Issue</h3>
            <p className="text-xs text-teal-100/80 mt-1">Found a pothole, leak, or streetlight issue? Submit with AI diagnosis.</p>
          </div>
        </Link>

        <Link 
          to="/track" 
          className="group flex flex-col justify-between p-5 sm:p-6 bg-white hover:bg-gray-50/80 text-gray-900 rounded-2xl shadow-xs transition-all border border-gray-200/90 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-teal-50 rounded-xl text-teal-700 group-hover:scale-105 transition-transform">
              <FileText className="h-6 w-6 text-[#1A3636]" />
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">Track My Issues</h3>
            <p className="text-xs text-gray-500 mt-1">Monitor real-time status, worker progress, and SLA updates.</p>
          </div>
        </Link>

        <Link 
          to="/map" 
          className="group flex flex-col justify-between p-5 sm:p-6 bg-white hover:bg-gray-50/80 text-gray-900 rounded-2xl shadow-xs transition-all border border-gray-200/90 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700 group-hover:scale-105 transition-transform">
              <MapPin className="h-6 w-6 text-emerald-700" />
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">Community Map</h3>
            <p className="text-xs text-gray-500 mt-1">Explore reported issues around you with interactive filters.</p>
          </div>
        </Link>
      </div>

      {/* ============================================================ */}
      {/* 4. MAIN DASHBOARD CONTENT GRID                               */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left 2 Columns: Recent Reports & Feed Link */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          
          {/* Recent Reports Card */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="px-6 py-4.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
                  <Clock className="h-4 w-4 text-[#1A3636]" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Recent Reports</h2>
              </div>
              <Link 
                to="/track" 
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 transition-colors"
              >
                <span>View all reports</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            
            <div className="p-5 sm:p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="animate-spin h-8 w-8 text-[#1A3636] mb-3" />
                  <p className="text-xs text-gray-500 font-medium">Loading your reports...</p>
                </div>
              ) : issues.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl p-6">
                  <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm">No issues reported yet</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Be an active citizen! Report any civic disruptions like road potholes or broken streetlights.
                  </p>
                  <Link 
                    to="/report" 
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A3636] hover:bg-[#234b4b] text-white rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Report Your First Issue</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {issues.map((issue) => {
                    const hasActiveRequest = pendingRequests.some(r => r.issue_id === issue.id && r.status === 'PENDING');
                    const activeReq = pendingRequests.find(r => r.issue_id === issue.id && r.status === 'PENDING');

                    return (
                      <div 
                        key={issue.id} 
                        className="p-4 sm:p-5 border border-gray-200/80 rounded-xl hover:border-gray-300 hover:shadow-xs transition-all bg-white space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
                              {issue.code || 'PENDING'}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(issue.status)}`}>
                              {issue.status}
                            </span>
                            {hasActiveRequest && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeReq) {
                                    setActiveRequestForModal(activeReq);
                                    setIsModalOpen(true);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                              >
                                <AlertTriangle className="h-3 w-3 text-amber-700" />
                                <span>Info Requested</span>
                              </button>
                            )}
                          </div>

                          <span className="text-xs text-gray-400">
                            {new Date(issue.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-gray-900 text-base leading-snug">
                            {issue.title}
                          </h3>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                            {issue.description}
                          </p>
                        </div>

                        {/* Card metadata & actions */}
                        <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {issue.category && (
                              <span className="font-medium text-gray-700">Category: {issue.category}</span>
                            )}
                            {issue.address && (
                              <span className="truncate max-w-[180px] sm:max-w-xs">{issue.address}</span>
                            )}
                          </div>

                          {/* Action button cluster: Details + Upvote + Comments + Share */}
                          <div className="flex items-center gap-3 ml-auto">
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
                            <Link 
                              to={`/issues/${issue.id}`} 
                              className="text-xs font-bold text-teal-800 hover:text-teal-950 hover:underline flex items-center pl-2 border-l border-gray-200"
                            >
                              <span>Details</span>
                              <ChevronRight className="h-3.5 w-3.5" />
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
          
          {/* Community Help Verify Card */}
          <div className="bg-gradient-to-r from-teal-50/70 to-emerald-50/70 rounded-2xl p-6 border border-teal-200/80 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-teal-600 text-white rounded-xl shadow-xs shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-teal-950">Earn Civic Points via Community Verification</h3>
                <p className="text-xs text-teal-800 mt-1 max-w-lg">
                  Verify issues reported by fellow citizens in your neighborhood. Confirm whether problems are solved and earn recognition badges.
                </p>
              </div>
            </div>

            <Link 
              to="/map?mode=verify" 
              className="px-4 py-2.5 bg-[#1A3636] hover:bg-[#254d4d] text-white rounded-xl text-xs font-bold shadow-xs transition-all shrink-0 flex items-center gap-1.5"
            >
              <span>Explore Verifications</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

        </div>

        {/* Right 1 Column: My Impact, Notifications & Community Map Snippet */}
        <div className="space-y-6 sm:space-y-8">
          
          {/* My Impact KPI Block */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#0d9488]" />
                <span>My Impact Summary</span>
              </h2>
              <span className="text-xs font-semibold text-gray-400">Lifetime</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                <div className="text-2xl font-black text-gray-900">{stats.total}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 uppercase tracking-wider font-bold">Total Reports</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                <div className="text-2xl font-black text-emerald-700">{stats.resolved}</div>
                <div className="text-[11px] text-emerald-700 mt-0.5 uppercase tracking-wider font-bold">Resolved</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100 col-span-2">
                <div className="text-2xl font-black text-blue-700">{stats.inProgress}</div>
                <div className="text-[11px] text-blue-700 mt-0.5 uppercase tracking-wider font-bold">In Progress</div>
              </div>
            </div>

            {/* Civic Points Progress */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-gray-700">Citizen Level</span>
                <span className="font-bold text-[#1A3636]">{profile?.civic_level || 'New Citizen'}</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-teal-500 to-[#1A3636] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(15, (profile?.civic_points || 0) % 100))}%` }} 
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 text-right font-medium">
                {profile?.civic_points || 0} Civic Points earned
              </p>
            </div>
          </div>

          {/* Notifications Widget */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Bell className="h-4 w-4 text-gray-600" />
                <span>Notifications</span>
              </h2>
              <Link to="/notifications" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
                View all
              </Link>
            </div>

            <div className="divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  No notifications yet. You're all caught up!
                </div>
              ) : (
                notifications.slice(0, 4).map((notif) => (
                  <div 
                    key={notif.id} 
                    onClick={() => !notif.is_read && handleMarkNotificationRead(notif.id)}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${notif.is_read ? 'opacity-70' : 'bg-teal-50/30'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-gray-900 truncate">{notif.title}</p>
                      {!notif.is_read && (
                        <span className="h-2 w-2 rounded-full bg-teal-600 shrink-0" title="Unread" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-mono">
                      {new Date(notif.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Community Map Widget */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Map className="h-4 w-4 text-[#0d9488]" />
                <span>Community Map</span>
              </h2>
              <Link to="/map" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
                Full Map →
              </Link>
            </div>
            
            <div className="p-5 text-center bg-gray-50/50">
              <p className="text-xs text-gray-600 mb-4">
                View active complaints plotted by severity across your neighborhood.
              </p>
              <Link 
                to="/map" 
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#1A3636] hover:bg-[#234b4b] text-white shadow-xs transition"
              >
                <MapPin className="h-4 w-4 text-[#40E0D0]" />
                <span>Open Interactive Map</span>
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
