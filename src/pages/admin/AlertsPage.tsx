import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Plus, X, Loader2 } from 'lucide-react';

interface Alert {
  id: string;
  society_id: string;
  sent_by: string;
  title: string;
  body: string;
  type: 'general' | 'emergency' | 'maintenance' | 'event' | 'security';
  created_at: string;
}

const ALERT_TYPES = [
  { id: 'general', label: '📢 General' },
  { id: 'emergency', label: '🚨 Emergency' },
  { id: 'maintenance', label: '🔧 Maintenance' },
  { id: 'event', label: '🎉 Event' },
  { id: 'security', label: '🔒 Security' }
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  
  const [showNewAlert, setShowNewAlert] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formType, setFormType] = useState<string>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [adminSocietyId, setAdminSocietyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchAlerts = async (societyId: string) => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('society_id', societyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setAlerts(data);
    } catch (err) {
      console.error(err);
      toast('error', 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        supabase
          .from('users')
          .select('society_id')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data?.society_id) {
              setAdminSocietyId(data.society_id);
              fetchAlerts(data.society_id);
            }
          });
      }
    });
  }, []);

  const handleSendAlert = async () => {
    if (!formTitle.trim() || !formBody.trim() || !adminSocietyId || !currentUserId) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('alerts')
        .insert({
          society_id: adminSocietyId,
          sent_by: currentUserId,
          title: formTitle.trim(),
          body: formBody.trim(),
          type: formType
        });

      if (error) throw error;

      toast('success', 'Alert sent to all residents!');
      setShowNewAlert(false);
      setFormTitle('');
      setFormBody('');
      setFormType('general');
      fetchAlerts(adminSocietyId);
    } catch (err) {
      console.error('Error sending alert:', err);
      toast('error', 'Failed to send alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast('success', 'Alert deleted');
    } catch (err) {
      console.error('Error deleting alert:', err);
      toast('error', 'Failed to delete alert');
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'emergency': return 'bg-red-100 text-red-700 border-red-200';
      case 'security': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'maintenance': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'event': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'general': default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="p-gutter max-w-7xl mx-auto animate-fade-in pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-display-sm font-bold text-on-surface tracking-tight mb-2">Society Alerts</h1>
          <p className="text-body-lg text-on-surface-variant">Manage and broadcast alerts to residents.</p>
        </div>
        
        <button
          onClick={() => setShowNewAlert(true)}
          className="bg-primary hover:bg-primary/90 text-on-primary px-6 py-3 rounded-full font-label-lg transition-all shadow-md shadow-primary/20 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Send Alert
        </button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-surface text-center py-12 rounded-3xl border border-outline-variant/30">
            <p className="text-on-surface-variant">No alerts have been sent yet.</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className="bg-surface border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start gap-4 transition-all hover:shadow-md">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${getTypeColor(alert.type)}`}>
                    {alert.type}
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    Sent: {formatDistanceToNow(new Date(alert.created_at))} ago
                  </span>
                </div>
                <h3 className="text-title-lg font-bold text-on-surface mb-1">{alert.title}</h3>
                <p className="text-body-md text-on-surface-variant whitespace-pre-wrap">{alert.body}</p>
              </div>
              
              <button 
                onClick={() => handleDeleteAlert(alert.id)}
                className="text-outline hover:text-status-emergency transition p-2 bg-surface-variant/30 hover:bg-status-emergency/10 rounded-full"
                title="Delete Alert"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))
        )}
      </div>

      {showNewAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface w-full max-w-lg rounded-3xl p-6 shadow-xl relative animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-headline-sm font-bold text-on-surface">Send New Alert</h2>
              <button 
                onClick={() => setShowNewAlert(false)}
                className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-label-md font-medium text-on-surface-variant mb-1">Title</label>
                <input 
                  type="text" 
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Alert title..."
                  className="w-full border border-outline-variant/50 rounded-xl px-4 py-3 bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-on-surface"
                />
              </div>
              
              <div>
                <label className="block text-label-md font-medium text-on-surface-variant mb-1">Message</label>
                <textarea 
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Details of the alert..."
                  rows={4}
                  className="w-full border border-outline-variant/50 rounded-xl px-4 py-3 bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none text-on-surface"
                />
              </div>
              
              <div>
                <label className="block text-label-md font-medium text-on-surface-variant mb-2">Type</label>
                <div className="flex flex-wrap gap-2">
                  {ALERT_TYPES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setFormType(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                        formType === cat.id 
                          ? 'border-primary bg-primary-container text-on-primary-container' 
                          : 'border-outline-variant/50 bg-surface text-on-surface-variant hover:bg-surface-variant/30'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                onClick={handleSendAlert}
                disabled={isSubmitting || !formTitle.trim() || !formBody.trim()}
                className="w-full bg-primary text-on-primary font-label-lg py-3.5 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex justify-center items-center gap-2 shadow-md"
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                Send to All Residents
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
