import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Bell, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Notifications({ session }: { session: any }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchNotifications();
    }
  }, [session]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('profile_id', session.user.id)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  if (!session) {
    return (
      <div className="flex justify-center items-center py-20 flex-col text-center">
        <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-medium text-gray-900">Please sign in to view your notifications</h2>
        <Link to="/login" className="mt-4 text-[#40E0D0] hover:underline font-medium">Go to Login</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A3636] font-serif">Notifications</h1>
          <p className="text-gray-600 mt-1">Updates on your issues and community activity</p>
        </div>
        
        {notifications.some(n => !n.is_read) && (
          <button 
            onClick={markAllAsRead}
            className="text-sm font-medium text-[#40E0D0] hover:text-[#32b8aa] transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-[#40E0D0]" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">You're all caught up!</h3>
          <p className="text-gray-500">No new notifications at the moment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-6 transition-colors ${notification.is_read ? 'bg-white' : 'bg-blue-50/30'}`}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${notification.is_read ? 'bg-gray-100' : 'bg-[#1A3636] text-[#40E0D0]'}`}>
                    {notification.title.includes('Resolved') ? <CheckCircle className="h-5 w-5" /> : 
                     notification.title.includes('Alert') ? <AlertTriangle className="h-5 w-5" /> :
                     <Info className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className={`text-base font-semibold ${notification.is_read ? 'text-gray-900' : 'text-[#1A3636]'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className={`text-sm ${notification.is_read ? 'text-gray-600' : 'text-gray-800'}`}>
                      {notification.message}
                    </p>
                    
                    {notification.link && (
                      <Link 
                        to={notification.link} 
                        className="inline-block mt-3 text-sm font-medium text-[#1A3636] hover:text-[#40E0D0] transition-colors"
                      >
                        View Details →
                      </Link>
                    )}
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
