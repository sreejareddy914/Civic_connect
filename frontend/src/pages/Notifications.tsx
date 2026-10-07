import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Bell, CheckCircle, Info, AlertTriangle, ArrowRight, Check } from 'lucide-react';
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
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-teal-50 rounded-full mb-4">
          <AlertTriangle className="h-10 w-10 text-teal-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Please sign in to view your notifications</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-sm">Stay informed with updates regarding your complaints and resolution milestones.</p>
        <Link 
          to="/login" 
          className="px-6 py-2.5 bg-[#1A3636] hover:bg-[#254d4d] text-white font-bold rounded-xl text-sm shadow-sm transition"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time notifications about your reported issues, municipal assignments, and community requests
          </p>
        </div>
        
        {unreadCount > 0 && (
          <button 
            type="button"
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors self-start sm:self-auto"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-[#0d9488] mb-3" />
          <p className="text-xs text-gray-500 font-medium">Retrieving notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-12 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <Bell className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">You're all caught up!</h3>
          <p className="text-xs text-gray-500">
            No new notifications right now. We'll update you as soon as there are updates on your issues.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`p-5 sm:p-6 transition-colors cursor-pointer ${
                notification.is_read ? 'bg-white hover:bg-gray-50/60' : 'bg-teal-50/40 hover:bg-teal-50/60 font-semibold'
              }`}
              onClick={() => !notification.is_read && markAsRead(notification.id)}
            >
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-2xs ${
                  notification.is_read ? 'bg-gray-100 text-gray-500' : 'bg-[#1A3636] text-[#40E0D0]'
                }`}>
                  {notification.title.includes('Resolved') ? <CheckCircle className="h-5 w-5" /> : 
                   notification.title.includes('Alert') ? <AlertTriangle className="h-5 w-5" /> :
                   <Info className="h-5 w-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap justify-between items-start gap-1 mb-1">
                    <h3 className={`text-sm font-bold ${notification.is_read ? 'text-gray-900' : 'text-[#1A3636]'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {new Date(notification.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className={`text-xs ${notification.is_read ? 'text-gray-600' : 'text-gray-800 font-normal'} leading-relaxed`}>
                    {notification.message}
                  </p>
                  
                  {notification.link && (
                    <div className="mt-2.5">
                      <Link 
                        to={notification.link} 
                        className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>View Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>

                {!notification.is_read && (
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-600 mt-2 shrink-0 ring-4 ring-teal-100" title="Unread" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
