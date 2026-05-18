import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Clock, Loader2 } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('notifications')
          .select('id, title, body, is_read, created_at')
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
          .then(({ data }) => {
            if (data) setNotifications(data);
            setLoading(false);
          });
          
        // Mark all as read after fetching
        supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false)
          .then();
      }
    });
  }, []);

  return (
    <div className="min-h-full bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white px-6 py-8 rounded-b-[2rem] shadow-md">
        <h1 className="text-2xl font-bold mb-1">Notifications</h1>
        <p className="text-blue-100 text-sm">Updates on your complaints</p>
      </header>

      <div className="px-5 mt-6">
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">No notifications yet</h2>
            <p className="text-sm text-gray-500">We'll notify you when there's an update.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
            {notifications.map(n => (
              <div key={n.id} className={`p-4 transition ${!n.is_read ? 'bg-blue-50/30' : ''}`}>
                <div className="flex gap-3">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{n.body}</p>
                    <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
