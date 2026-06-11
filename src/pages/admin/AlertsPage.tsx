import { useEffect, useState } from 'react';
import type React from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Plus, X, Loader2 } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';

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

  const TYPE_COLORS: Record<string, React.CSSProperties> = {
    emergency: { background: '#FFF1F2', color: '#BE123C' },
    security:  { background: '#FEF3C7', color: '#92400E' },
    maintenance: { background: '#F5F3FF', color: '#6D28D9' },
    event:     { background: '#EFF6FF', color: '#1D4ED8' },
    general:   { background: '#F5F3F0', color: '#6B6560' },
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9C9894', margin: 0 }}>Broadcast alerts to all residents.</p>
        <button
          onClick={() => setShowNewAlert(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#D97706', color: '#FFFFFF', borderRadius: 10, border: 'none', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          <Plus className="w-4 h-4" />
          Send Alert
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
              <div className="skeleton" style={{ height: 16, width: '30%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '80%' }} />
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: '48px 0', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#9C9894', margin: 0 }}>No alerts sent yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map(alert => {
            const typeStyle = TYPE_COLORS[alert.type] ?? TYPE_COLORS.general;
            return (
              <div key={alert.id} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ ...typeStyle, borderRadius: 6, padding: '3px 10px', fontFamily: 'Inter', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {alert.type}
                    </span>
                    <span style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894' }}>
                      {formatDistanceToNow(new Date(alert.created_at))} ago
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: '0 0 4px' }}>{alert.title}</h3>
                  <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#6B6560', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{alert.body}</p>
                </div>
                <button
                  onClick={() => handleDeleteAlert(alert.id)}
                  style={{ padding: 8, borderRadius: 8, background: 'transparent', border: 'none', color: '#9C9894', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9C9894'; }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* New Alert Modal */}
      {showNewAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.15)', width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E0DDD9' }}>
              <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 17, color: '#1C1917', margin: 0 }}>Send New Alert</h2>
              <button onClick={() => setShowNewAlert(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6560', padding: 4 }}><X className="w-4 h-4" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Alert title..."
                  style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Message</label>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Details of the alert..."
                  rows={4}
                  style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 8 }}>Type</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ALERT_TYPES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setFormType(cat.id)}
                      style={{
                        padding: '5px 12px', borderRadius: 6,
                        fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 12,
                        background: formType === cat.id ? '#1C1917' : '#F5F3F0',
                        color: formType === cat.id ? '#FFFFFF' : '#6B6560',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSendAlert}
                disabled={isSubmitting || !formTitle.trim() || !formBody.trim()}
                style={{
                  padding: '12px', background: isSubmitting ? '#B45309' : '#D97706', color: '#FFFFFF',
                  borderRadius: 10, border: 'none', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.8 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Send to All Residents
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
