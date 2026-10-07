import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ListTodo, 
  CheckSquare, 
  UserCheck, 
  Building2, 
  Users, 
  Clock, 
  MapPin, 
  Flame, 
  BarChart3, 
  Sparkles, 
  Bell, 
  Settings, 
  LogOut, 
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adminApi } from '../services/adminApi';

export default function AdminLayout({ session }: { session: any }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    if (!session) {
      navigate('/login');
      return;
    }

    const checkAdmin = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (error || data?.role !== 'ADMIN') {
          console.warn('Unauthorized admin access attempt');
          navigate(data?.role === 'WORKER' ? '/worker/dashboard' : '/dashboard');
          return;
        }

        setIsAdmin(true);

        // Fetch notifications count
        try {
          const notifs = await adminApi.getNotifications();
          const unread = (notifs.notifications || []).filter((n: any) => !n.is_read).length;
          setUnreadNotifs(unread);
        } catch (e) {
          // ignore
        }
      } catch (err) {
        navigate('/dashboard');
      }
    };

    checkAdmin();
  }, [session, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Issues', path: '/admin/issues', icon: ListTodo },
    { name: 'Verification', path: '/admin/issues?queue=needs_verification', icon: CheckSquare },
    { name: 'Assignments', path: '/admin/issues?queue=unassigned', icon: UserCheck },
    { name: 'Departments', path: '/admin/departments', icon: Building2 },
    { name: 'Workers', path: '/admin/workers', icon: Users },
    { name: 'SLA Management', path: '/admin/sla', icon: Clock },
    { name: 'Community Map', path: '/admin/map', icon: MapPin },
    { name: 'Hotspots', path: '/admin/hotspots', icon: Flame },
    { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { name: 'AI Predictions', path: '/admin/predictions', icon: Sparkles },
    { name: 'Notifications', path: '/admin/notifications', icon: Bell, badge: unreadNotifs },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="animate-spin h-10 w-10 mx-auto text-red-500 mb-4" />
          <p className="text-sm font-medium text-gray-300">Authenticating CivicAdmin Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-[#1e293b] text-white flex flex-col shadow-xl z-20 shrink-0">
        <div className="p-5 flex items-center gap-3 border-b border-gray-700">
          <div className="bg-red-500 p-2 rounded-lg shrink-0 shadow-md">
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">CivicAdmin</h1>
            <p className="text-xs text-red-400 font-semibold uppercase tracking-wider">Command Center</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const currentFull = location.pathname + location.search;
            const isActive = item.path.includes('?')
              ? currentFull === item.path
              : location.pathname === item.path || (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path) && !location.search);

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm ${
                  isActive 
                    ? 'bg-red-500 text-white font-semibold shadow-md' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white font-medium'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700 bg-[#16202e]">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
              A
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-200 truncate">Administrator</p>
              <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto h-screen relative">
        <main className="pb-16 min-h-full bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
