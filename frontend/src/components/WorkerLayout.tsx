import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { HardHat, CheckSquare, Map, User, Bell, Menu, X, LogOut, BarChart2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { workerApi } from '../services/workerApi';

export default function WorkerLayout({ session }: { session: any }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const navItems = [
    { name: 'My Tasks', path: '/worker/dashboard', icon: CheckSquare },
    { name: 'Field Map', path: '/worker/map', icon: Map },
    { name: 'Performance', path: '/worker/performance', icon: BarChart2 },
    { name: 'Profile', path: '/worker/profile', icon: User },
  ];

  useEffect(() => {
    if (!session) {
      navigate('/login');
      return;
    }
    checkWorkerAuth();
  }, [session]);

  const checkWorkerAuth = async () => {
    try {
      // 1. Fetch user profile to verify role
      const { data: userProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileErr) throw profileErr;

      // 2. Protect route: only WORKER or ADMIN allowed
      if (userProfile.role !== 'WORKER' && userProfile.role !== 'ADMIN') {
        alert('Access Restricted: Field Worker privileges required to access the Worker Dashboard.');
        navigate('/dashboard');
        return;
      }

      setProfile(userProfile);

      // 3. Load notifications to show unread count
      try {
        const notifData = await workerApi.getNotifications();
        const unread = (notifData.notifications || []).filter((n: any) => !n.is_read).length;
        setUnreadCount(unread);
      } catch (err) {
        console.error('Failed to load notifications count:', err);
      }

    } catch (error) {
      console.error('Error verifying worker auth:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E67E22] mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading CivicWorker Command...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col font-sans pb-16 md:pb-0">
      {/* Top Navigation - Worker theme (Slate #2C3E50 / Safety Orange #E67E22) */}
      <nav className="bg-[#2C3E50] text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/worker/dashboard" className="flex items-center gap-2">
                <div className="bg-[#E67E22] p-1.5 rounded-lg shadow-sm">
                  <HardHat className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold tracking-tight text-white block leading-tight">CivicWorker</span>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-orange-300">Field Operations</span>
                </div>
              </Link>
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-2 text-sm font-semibold transition-colors border-b-2 py-5 ${
                      isActive ? 'text-[#E67E22] border-[#E67E22]' : 'text-gray-300 border-transparent hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Link 
                to="/worker/notifications" 
                className="relative p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-[#34495E]"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#2C3E50]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              
              <div className="hidden md:flex items-center gap-3 pl-2 border-l border-gray-600">
                <Link to="/worker/profile" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-[#E67E22] text-white flex items-center justify-center text-sm font-bold shadow-sm">
                    {profile?.full_name?.charAt(0).toUpperCase() || 'W'}
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-semibold text-white leading-tight">{profile?.full_name || 'Field Worker'}</p>
                    <p className="text-gray-400 text-[10px]">WRK-{profile?.id?.substring(0, 5).toUpperCase()}</p>
                  </div>
                </Link>
                <button 
                  onClick={handleSignOut}
                  className="p-1.5 text-gray-300 hover:text-white rounded-md hover:bg-[#34495E] transition-colors ml-2"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
              
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-300 hover:text-white"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#34495E] border-t border-gray-700 px-4 pt-2 pb-4 space-y-1">
            <div className="py-2 mb-2 border-b border-gray-600 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{profile?.full_name || 'Field Technician'}</p>
                <p className="text-xs text-orange-400">WRK-{profile?.id?.substring(0, 5).toUpperCase()}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 text-xs bg-red-600/30 text-red-200 px-2.5 py-1 rounded border border-red-500/30"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive ? 'bg-[#E67E22] text-white' : 'text-gray-200 hover:bg-[#465C71]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar - Field worker convenience */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#2C3E50] border-t border-[#34495E] z-40 flex justify-around items-center h-16 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-[#E67E22]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
