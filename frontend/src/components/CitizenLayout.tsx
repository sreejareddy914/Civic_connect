import { Outlet, Link, useLocation } from 'react-router-dom';
import { Shield, Map, Activity, User, Bell, Menu } from 'lucide-react';


export default function CitizenLayout({ session }: { session: any }) {
  const location = useLocation();
  
  const navItems = [
    { name: 'Feed', path: '/dashboard', icon: Activity },
    { name: 'Map', path: '/map', icon: Map },
    { name: 'Track', path: '/track', icon: Shield },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col font-sans">
      {/* Top Navigation */}
      <nav className="bg-[#1A3636] text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-[#40E0D0]" />
                <span className="text-xl font-bold font-serif tracking-tight text-[#FAF9F6]">CivicConnect</span>
              </Link>
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                      isActive ? 'text-[#40E0D0]' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <Link to="/notifications" className="relative p-2 text-gray-300 hover:text-white transition-colors">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#1A3636]" />
              </Link>
              
              <div className="hidden md:flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#2A4A4A] flex items-center justify-center text-sm font-bold border border-[#3A5A5A]">
                  {session?.user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              </div>
              
              <button className="md:hidden p-2 text-gray-300 hover:text-white">
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow">
        <Outlet />
      </main>
    </div>
  );
}
