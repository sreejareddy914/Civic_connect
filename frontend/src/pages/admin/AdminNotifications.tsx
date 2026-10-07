import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Clock, 
  Loader2, 
  ArrowUpRight,
  Inbox
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getNotifications();
      setNotifications(res.notifications || []);
    } catch (e: any) {
      console.error('Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await adminApi.markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e: any) {
      console.error('Error marking notification read:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await adminApi.markAllNotificationsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (e: any) {
      console.error('Error marking all read:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="animate-spin h-10 w-10 text-red-600" />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filteredNotifs = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.is_read;
    return true;
  });

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-6 w-6 text-red-600" />
            CivicAdmin System Notifications & Alerts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time administrative alerts for citizen clarifications, SLA escalations, and worker resolution proof submissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm flex items-center gap-1.5 transition"
            >
              <CheckCheck className="h-4 w-4 text-green-600" /> Mark All as Read
            </button>
          )}
          <button
            onClick={fetchNotifications}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            filter === 'ALL'
              ? 'bg-[#1e293b] text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Notifications ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            filter === 'UNREAD'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        {filteredNotifs.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <Inbox className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold">No notifications found.</p>
            <p className="text-xs text-gray-400 mt-1">You are all caught up on administrative dispatches.</p>
          </div>
        ) : (
          filteredNotifs.map((n) => (
            <div
              key={n.id}
              className={`p-5 flex items-start justify-between gap-4 transition ${
                !n.is_read ? 'bg-red-50/20' : 'hover:bg-gray-50/60'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  !n.is_read ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-bold ${!n.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                      {n.title}
                    </h3>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-red-600"></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 max-w-2xl">{n.message}</p>
                  <div className="text-[11px] text-gray-400 flex items-center gap-1 pt-1">
                    <Clock className="h-3 w-3" /> {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {n.link && (
                  <Link
                    to={n.link}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                  >
                    View <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
                {!n.is_read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    title="Mark as read"
                    className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-gray-100 transition"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
