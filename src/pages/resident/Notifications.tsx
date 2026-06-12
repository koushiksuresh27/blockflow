import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Loader2, AlertTriangle, AlertCircle, Info, ShieldAlert, Hammer } from 'lucide-react';

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

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'security': return <ShieldAlert className="w-5 h-5 text-orange-600" />;
      case 'maintenance': return <Hammer className="w-5 h-5 text-[#D97706]" />;
      case 'emergency': return <AlertTriangle className="w-6 h-6 text-red-600" />;
      case 'event': return <Bell className="w-5 h-5 text-blue-600" />;
      case 'general': default: return <Info className="w-5 h-5 text-[#6B6560]" />;
    }
  };

  const getAlertBg = (type: string) => {
    switch (type) {
      case 'security': return 'bg-orange-50';
      case 'maintenance': return 'bg-[#FFFBEB]'; // light amber
      case 'event': return 'bg-blue-50';
      case 'general': default: return 'bg-[#F5F3F0]';
    }
  };

  return (
    <div className="min-h-full bg-[#F5F3F0] pb-24">
      <header className="bg-white px-4 py-4 border-b border-[#E0DDD9] sticky top-0 z-10">
        <h1 className="text-xl font-display font-bold text-[#1C1917]">Alerts</h1>
        <p className="text-sm font-sans text-[#6B6560] mt-0.5">Important updates from admin</p>
      </header>

      <div className="px-4 mt-6 space-y-4">
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-[#1C1917]" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-card p-8 shadow-sm text-center border border-[#E0DDD9]">
            <div className="w-16 h-16 bg-[#F5F3F0] text-[#9C9894] rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-display font-bold text-[#1C1917] mb-1">All quiet</h2>
            <p className="text-sm font-sans text-[#6B6560]">No alerts from your society admin.</p>
          </div>
        ) : (
          alerts.map(alert => {
            const isEmergency = alert.type === 'emergency';
            
            if (isEmergency) {
              return (
                <div key={alert.id} className="bg-red-50 rounded-card p-5 shadow-sm border-2 border-red-500 w-full animate-[slideUp_0.3s_ease-out] relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="flex items-start gap-3 mb-3 relative z-10">
                    <span className="text-red-600 animate-pulse bg-red-100 p-2.5 rounded-full shadow-sm">
                      {getAlertIcon(alert.type)}
                    </span>
                    <div className="flex-1 mt-1">
                      <span className="text-[10px] uppercase font-bold font-sans tracking-widest text-red-700 bg-red-100 px-2 py-0.5 rounded-sm inline-block mb-1.5">Emergency</span>
                      <h3 className="text-lg font-display font-bold text-red-950 leading-tight">{alert.title}</h3>
                    </div>
                  </div>
                  <div className="bg-white/60 rounded-xl p-3 mb-2 relative z-10 border border-red-100">
                    <p className="text-sm font-sans font-medium text-red-900 whitespace-pre-wrap">{alert.body}</p>
                  </div>
                  <div className="text-right mt-3 relative z-10">
                    <span className="text-[10px] font-sans font-semibold text-red-700/60 uppercase tracking-wide">
                      Sent {formatDistanceToNow(new Date(alert.created_at))} ago
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={alert.id} className="bg-white rounded-card p-4 shadow-sm border border-[#E0DDD9] w-full animate-[slideUp_0.3s_ease-out]">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getAlertBg(alert.type)} border border-[#E0DDD9]/50`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="text-base font-display font-bold text-[#1C1917] leading-tight">{alert.title}</h3>
                    </div>
                    <p className="text-sm font-sans text-[#6B6560] whitespace-pre-wrap leading-relaxed mb-3">{alert.body}</p>
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-sans uppercase font-bold tracking-wider px-2 py-0.5 rounded-[4px] ${getAlertBg(alert.type)} text-[#1C1917]`}>
                        {alert.type}
                      </span>
                      <span className="text-[10px] font-sans font-semibold text-[#9C9894] uppercase tracking-wide">
                        {formatDistanceToNow(new Date(alert.created_at))} ago
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
