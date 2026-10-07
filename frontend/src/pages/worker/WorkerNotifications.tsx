import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, ArrowRight, Loader2, RefreshCw, CheckCheck, MailOpen 
} from 'lucide-react';
import { workerApi } from '../../services/workerApi';

export default function WorkerNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await workerApi.getNotifications();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Failed to load worker notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await workerApi.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    for (const n of unread) {
      await workerApi.markNotificationRead(n.id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#E67E22] animate-spin mb-4" />
        <p className="text-gray-600 font-semibold">Loading Field Notifications...</p>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#2C3E50] flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#E67E22]" /> Notifications & Dispatch Alerts
          </h1>
          <p className="text-sm text-gray-600">
            Real-time assignment updates, SLA alarms, and supervisory feedback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadNotifications(true)}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded-xl"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-xs">
          <MailOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">No Notifications</h3>
          <p className="text-xs text-gray-500 mt-1">
            You're all caught up! New dispatch alerts and admin responses will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                notif.is_read
                  ? 'bg-white border-gray-200 shadow-xs hover:border-gray-300'
                  : 'bg-orange-50/50 border-orange-200 shadow-xs hover:bg-orange-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-xl mt-0.5 ${notif.is_read ? 'bg-gray-100 text-gray-500' : 'bg-[#E67E22] text-white'}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">{notif.title}</h4>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{notif.body}</p>
                    <span className="text-[10px] text-gray-400 mt-2 block">
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {notif.link && (
                  <Link
                    to={notif.link}
                    className="p-2 text-gray-400 hover:text-[#E67E22] shrink-0"
                    title="View related issue"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
