import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Plus, X, Server, Activity, Zap, Droplets, ShieldCheck, Waves, Lightbulb, Flame } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Equipment {
  id: string;
  name: string;
  location: string;
  status: 'operational' | 'needs_attention' | 'critical';
  last_inspected: string | null;
  next_inspection: string | null;
  notes: string | null;
}

const DEFAULT_EQUIPMENT = [
  { name: 'Lift/Elevator', location: 'Tower A, Tower B', icon: Server },
  { name: 'Generator', location: 'Basement', icon: Zap },
  { name: 'Water Pump', location: 'Terrace', icon: Droplets },
  { name: 'Security System', location: 'Main Gate', icon: ShieldCheck },
  { name: 'Sewage Pump', location: 'Basement', icon: Waves },
  { name: 'Common Area Lighting', location: 'All Towers', icon: Lightbulb },
  { name: 'Fire Safety System', location: 'All Floors', icon: Flame },
];

const ICONS: Record<string, any> = {
  'Lift/Elevator': Server,
  'Generator': Zap,
  'Water Pump': Droplets,
  'Security System': ShieldCheck,
  'Sewage Pump': Waves,
  'Common Area Lighting': Lightbulb,
  'Fire Safety System': Flame,
};

// ─── Modal ───────────────────────────────────────────────────────────────────
function AddEquipmentModal({ societyId, onClose, onAdded }: { societyId: string; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<'operational'|'needs_attention'|'critical'>('operational');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return toast('error', 'Name is required');
    setSaving(true);
    try {
      const { error } = await supabase.from('equipment').insert({
        society_id: societyId,
        name: name.trim(),
        location: location.trim(),
        status
      });
      if (error) throw new Error(error.message);
      toast('success', 'Equipment added');
      onAdded();
      onClose();
    } catch (e: unknown) {
      toast('error', 'Failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E0DDD9' }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 17, color: '#1C1917', margin: 0 }}>Add Equipment</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6560', padding: 4 }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Equipment Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lobby AC" style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Tower A" style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Initial Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}>
              <option value="operational">Operational</option>
              <option value="needs_attention">Needs Attention</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, padding: '0 24px 20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 10, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: '#FFFFFF', background: saving ? '#2C2925' : '#1C1917', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function EquipmentPage() {
  const toast = useToast();
  const [societyId, setSocietyId] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user.id).single();
      const sid = profile?.society_id ?? '';
      setSocietyId(sid);

      if (sid) {
        const { data, error } = await supabase.from('equipment').select('*').eq('society_id', sid).order('created_at', { ascending: true });
        if (error) throw new Error(error.message);
        setEquipment(data || []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const initDefaults = async () => {
    setLoading(true);
    try {
      const inserts = DEFAULT_EQUIPMENT.map(e => ({
        society_id: societyId,
        name: e.name,
        location: e.location,
        status: 'operational',
      }));
      const { error } = await supabase.from('equipment').insert(inserts);
      if (error) throw new Error(error.message);
      toast('success', 'Default equipment added');
      loadData();
    } catch (e: unknown) {
      toast('error', 'Failed to initialize', e instanceof Error ? e.message : 'Error');
      setLoading(false);
    }
  };

  const total = equipment.length;
  const operational = equipment.filter(e => e.status === 'operational').length;
  const attention = equipment.filter(e => e.status === 'needs_attention').length;
  const critical = equipment.filter(e => e.status === 'critical').length;

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 24, color: '#1C1917', margin: '0 0 4px' }}>Equipment Monitoring</h2>
            <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>Monitor health and status of society infrastructure.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#D97706', color: '#FFFFFF', borderRadius: 10, border: 'none', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            <Plus className="w-4 h-4" /> Add Equipment
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FFF1F2', border: '1px solid #FCA5A5', borderRadius: 12, marginBottom: 16, fontFamily: 'Inter', fontSize: 14, color: '#BE123C' }}>
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* Summary Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' }}>Total Equipment</p>
              <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 28, color: '#1C1917', margin: 0 }}>{total}</h3>
            </div>
            <Server className="w-8 h-8" style={{ color: '#E0DDD9' }} />
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' }}>Operational</p>
              <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 28, color: '#15803D', margin: 0 }}>{operational}</h3>
            </div>
            <Activity className="w-8 h-8" style={{ color: '#DCFCE7' }} />
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' }}>Needs Attention</p>
              <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 28, color: '#D97706', margin: 0 }}>{attention}</h3>
            </div>
            <AlertCircle className="w-8 h-8" style={{ color: '#FEF3C7' }} />
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' }}>Critical</p>
              <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 28, color: '#DC2626', margin: 0 }}>{critical}</h3>
            </div>
            <Activity className="w-8 h-8" style={{ color: '#FEE2E2' }} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
                <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 20 }} />
                <div className="skeleton" style={{ height: 32, borderRadius: 16, width: 100 }} />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: '64px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Server className="w-12 h-12" style={{ color: '#E0DDD9' }} />
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 18, color: '#1C1917', margin: '0 0 4px' }}>No equipment tracked</h3>
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9C9894', margin: 0 }}>Start by adding default society equipment.</p>
            </div>
            <button onClick={initDefaults} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#F5F3F0', color: '#1C1917', borderRadius: 8, border: 'none', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
              <Zap className="w-4 h-4" /> Pre-populate Defaults
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {equipment.map(e => {
              const Icon = ICONS[e.name] || Server;
              return (
                <div key={e.id} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F5F3F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon className="w-6 h-6" style={{ color: '#1C1917' }} />
                    </div>
                    <div>
                      <h4 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: '0 0 2px' }}>{e.name}</h4>
                      <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: 0 }}>{e.location}</p>
                    </div>
                  </div>

                  <div>
                    <span style={{
                      padding: '4px 12px', borderRadius: 20, fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px',
                      background: e.status === 'operational' ? '#F0FDF4' : e.status === 'needs_attention' ? '#FFFBEB' : '#FFF1F2',
                      color: e.status === 'operational' ? '#15803D' : e.status === 'needs_attention' ? '#D97706' : '#BE123C',
                    }}>
                      {e.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid #F5F3F0', paddingTop: 16, marginTop: 'auto' }}>
                    <div>
                      <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 10, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Last Inspected</p>
                      <p style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#1C1917', margin: 0 }}>
                        {e.last_inspected ? new Date(e.last_inspected).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 10, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Next Due</p>
                      <p style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#1C1917', margin: 0 }}>
                        {e.next_inspection ? new Date(e.next_inspection).toLocaleDateString() : 'Unscheduled'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && <AddEquipmentModal societyId={societyId} onClose={() => setShowAdd(false)} onAdded={loadData} />}
    </AdminLayout>
  );
}
