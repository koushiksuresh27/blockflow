import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  complaint_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const [userId, setUserId] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return

    // Fetch initial notifications
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, complaint_id, title, body, is_read, created_at')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifications(data)
    }

    fetchNotifications()

    // Set up realtime — .on() MUST come before .subscribe()
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const markAllRead = async () => {
    if (!userId || unreadCount === 0) return;
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setOpen(false);

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white"></span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden flex flex-col max-h-[32rem]">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                No notifications yet.
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map((n) => (
                  <li key={n.id} className={`p-4 hover:bg-gray-50 transition ${!n.is_read ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex gap-3">
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 leading-snug">{n.body}</p>
                        <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
