import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Loader2, AlertTriangle } from 'lucide-react';

interface Alert {
  id: string;
  society_id: string;
  sent_by: string;
  title: string;
  body: string;
  type: 'general' | 'emergency' | 'maintenance' | 'event' | 'security';
  created_at: string;
}

export default function Notifications() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [societyId, setSocietyId] = useState<string | null>(null);

  // Request notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('users')
          .select('society_id')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data?.society_id) {
              setSocietyId(data.society_id);
              fetchAlerts(data.society_id);
            }
          });
      }
    });
  }, []);

  useEffect(() => {
    if (!societyId) return;

    const channel = supabase
      .channel('society-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
          filter: `society_id=eq.${societyId}`
        },
        (payload) => {
          const newAlert = payload.new as Alert;
          setAlerts(prev => [newAlert, ...prev]);

          if (newAlert.type === 'emergency' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 Emergency Alert', {
              body: newAlert.title,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [societyId]);

  const fetchAlerts = async (sid: string) => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('society_id', sid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'security': return 'border-l-orange-500';
      case 'maintenance': return 'border-l-yellow-500';
      case 'event': return 'border-l-blue-500';
      case 'general': default: return 'border-l-gray-500';
    }
  };

  return (
    <div className="min-h-full bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white px-6 py-8 rounded-b-[2rem] shadow-md">
        <h1 className="text-2xl font-bold mb-1">Society Alerts</h1>
        <p className="text-blue-100 text-sm">Important updates from your admin</p>
      </header>

      <div className="px-5 mt-6 space-y-4">
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center border border-gray-100">
            <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">All quiet</h2>
            <p className="text-sm text-gray-500">No alerts from your society admin.</p>
          </div>
        ) : (
          alerts.map(alert => {
            const isEmergency = alert.type === 'emergency';
            
            if (isEmergency) {
              return (
                <div key={alert.id} className="bg-red-50 rounded-2xl p-5 shadow-sm border border-red-200 w-full animate-fade-in">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-red-600 animate-pulse bg-red-100 p-2 rounded-full">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <div className="flex-1 mt-1">
                      <h3 className="text-base font-bold text-red-900 leading-tight">{alert.title}</h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-red-700 mt-1 block">Emergency</span>
                    </div>
                  </div>
                  <p className="text-sm text-red-800 ml-12 whitespace-pre-wrap">{alert.body}</p>
                  <div className="text-right mt-3">
                    <span className="text-[10px] text-red-600/70 font-medium">
                      Sent {formatDistanceToNow(new Date(alert.created_at))} ago
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={alert.id} className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 border-l-4 w-full animate-fade-in ${getBorderColor(alert.type)}`}>
                <div className="flex justify-between items-start gap-3 mb-2">
                  <h3 className="text-base font-bold text-gray-900 leading-tight flex-1">{alert.title}</h3>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{alert.body}</p>
                <div className="flex justify-between items-center mt-4">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-gray-50 text-gray-500`}>
                    {alert.type}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Sent {formatDistanceToNow(new Date(alert.created_at))} ago
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
