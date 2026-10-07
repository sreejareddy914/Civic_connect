import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Shield, 
  LayoutDashboard, 
  Flame, 
  MapPin, 
  FileText, 
  Bell, 
  User, 
  PlusCircle, 
  LogOut, 
  Menu, 
  X,
  Award
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CitizenLayout({ session }: { session: any }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [profile, setProfile] = useState<any>(null);

  // Close mobile drawer whenever location changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Load profile and unread notifications
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadUserData = async () => {
      try {
        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
        }

        // Fetch unread notifications count
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', session.user.id)
          .eq('is_read', false);

        if (!error && count !== null) {
          setUnreadNotifs(count);
        }
      } catch (err) {
        console.warn('Failed to load citizen layout data:', err);
      }
    };

    loadUserData();

    // Subscribe to realtime notification changes
    const channel = supabase
      .channel(`citizen-layout-notifs-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${session.user.id}`,
        },
        () => {
          loadUserData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Community Feed', path: '/nearby', icon: Flame },
    { name: 'Community Map', path: '/map', icon: MapPin },
    { name: 'My Issues', path: '/track', icon: FileText },
    { name: 'Notifications', path: '/notifications', icon: Bell, badge: unreadNotifs },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      {/* ============================================================ */}
      {/* MOBILE TOP NAVIGATION BAR (Visible on screens < md)          */}
      {/* ============================================================ */}
      <header className="md:hidden bg-[#1A3636] text-white sticky top-0 z-40 border-b border-[#254646] shadow-sm">
        <div className="px-4 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="bg-[#40E0D0]/20 p-1.5 rounded-lg border border-[#40E0D0]/30">
              <Shield className="h-5 w-5 text-[#40E0D0]" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-[#FAF9F6] block leading-tight">CivicConnect</span>
              <span className="text-[10px] text-teal-300 font-semibold uppercase tracking-wider">Citizen Portal</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="relative p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="View notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#1A3636]">
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* MOBILE DRAWER OVERLAY (Slide-over on mobile)                 */}
      {/* ============================================================ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer container */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#1A3636] text-white shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="p-5 flex items-center justify-between border-b border-[#254646]">
              <div className="flex items-center gap-2.5">
                <div className="bg-[#40E0D0]/20 p-2 rounded-xl border border-[#40E0D0]/30">
                  <Shield className="h-6 w-6 text-[#40E0D0]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white leading-tight">CivicConnect</h2>
                  <p className="text-[11px] text-teal-300 font-semibold uppercase tracking-wider">Citizen Portal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Report CTA */}
            <div className="p-4 border-b border-[#254646]">
              <Link
                to="/report"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-[#40E0D0] hover:bg-[#38c8b9] text-[#1A3636] shadow-sm transition-all"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Report an Issue</span>
              </Link>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-150 text-sm ${
                      isActive
                        ? 'bg-[#40E0D0]/20 text-[#40E0D0] font-bold border border-[#40E0D0]/30 shadow-xs'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#40E0D0]' : 'text-gray-400'}`} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Profile footer */}
            <div className="p-4 border-t border-[#254646] bg-[#142B2B]">
              <div className="flex items-center gap-3 px-2 py-2 mb-2">
                <div className="w-9 h-9 rounded-full bg-[#40E0D0] text-[#1A3636] flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                  {profile?.full_name?.charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="text-xs font-bold text-gray-200 truncate">
                    {profile?.full_name || 'Citizen User'}
                  </p>
                  <p className="text-[11px] text-teal-300/80 truncate">
                    {profile?.civic_points || 0} Civic Points
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-red-400 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DESKTOP LEFT SIDEBAR (Visible on screens >= md)              */}
      {/* Matching Admin & Worker architecture                         */}
      {/* ============================================================ */}
      <aside className="hidden md:flex w-64 bg-[#1A3636] text-white flex-col shadow-xl z-20 shrink-0 h-screen sticky top-0">
        {/* Brand header */}
        <div className="p-5 flex items-center gap-3 border-b border-[#254646]">
          <div className="bg-[#40E0D0]/20 p-2 rounded-xl border border-[#40E0D0]/30 shrink-0 shadow-xs">
            <Shield className="h-6 w-6 text-[#40E0D0]" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold tracking-tight text-[#FAF9F6] leading-tight">CivicConnect</h1>
            <p className="text-xs text-teal-300 font-semibold uppercase tracking-wider">Citizen Portal</p>
          </div>
        </div>

        {/* Quick Report Issue Button */}
        <div className="p-3.5 border-b border-[#254646]">
          <Link
            to="/report"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-[#40E0D0] hover:bg-[#38c8b9] text-[#1A3636] shadow-sm hover:shadow transition-all group"
          >
            <PlusCircle className="h-4 w-4 text-[#1A3636] group-hover:scale-110 transition-transform" />
            <span>Report an Issue</span>
          </Link>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium ${
                  isActive
                    ? 'bg-[#40E0D0]/20 text-[#40E0D0] font-semibold border border-[#40E0D0]/30 shadow-xs'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#40E0D0]' : 'text-gray-400'}`} />
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white shadow-2xs">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile & sign out */}
        <div className="p-4 border-t border-[#254646] bg-[#142B2B]">
          <Link
            to="/profile"
            className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg hover:bg-white/5 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-[#40E0D0] text-[#1A3636] flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              {profile?.full_name?.charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-bold text-gray-200 truncate group-hover:text-teal-300 transition-colors">
                {profile?.full_name || 'Citizen'}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-teal-300/80">
                <Award className="w-3 h-3 text-[#40E0D0]" />
                <span>{profile?.civic_points || 0} pts</span>
                <span>•</span>
                <span className="truncate">{profile?.civic_level || 'New Citizen'}</span>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN CONTENT AREA                                            */}
      {/* ============================================================ */}
      <div className="flex-1 overflow-y-auto min-h-screen relative">
        <main className="pb-16 min-h-full bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
