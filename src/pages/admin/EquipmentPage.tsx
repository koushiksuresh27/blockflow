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
      <div className="bg-surface-container border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-md animate-slideInRight">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant/20">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Add Equipment</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high transition">
            <X className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Equipment Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lobby AC" className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Tower A" className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Initial Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30">
              <option value="operational">Operational</option>
              <option value="needs_attention">Needs Attention</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-primary hover:brightness-110 disabled:opacity-60 rounded-xl transition">
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
      <div className="px-margin-desktop py-10 max-w-screen-xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Equipment Monitoring</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Monitor health and status of society infrastructure.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-primary hover:brightness-110 transition shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Add Equipment
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-error-container/20 border border-error-container/40 rounded-2xl text-sm text-error">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* Summary Bar */}
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Equipment</p>
              <h3 className="text-2xl font-bold text-on-surface mt-1">{total}</h3>
            </div>
            <Server className="w-8 h-8 text-on-surface-variant/30" />
          </div>
          <div className="glass-card p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-status-available uppercase tracking-wider">Operational</p>
              <h3 className="text-2xl font-bold text-status-available mt-1">{operational}</h3>
            </div>
            <Activity className="w-8 h-8 text-status-available/30" />
          </div>
          <div className="glass-card p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Needs Attention</p>
              <h3 className="text-2xl font-bold text-amber-500 mt-1">{attention}</h3>
            </div>
            <AlertCircle className="w-8 h-8 text-amber-500/30" />
          </div>
          <div className="glass-card p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-status-emergency uppercase tracking-wider">Critical</p>
              <h3 className="text-2xl font-bold text-status-emergency mt-1">{critical}</h3>
            </div>
            <Activity className="w-8 h-8 text-status-emergency/30" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : total === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-20 rounded-2xl text-center space-y-4">
            <Server className="w-12 h-12 text-on-surface-variant/40" />
            <div>
              <h3 className="font-semibold text-on-surface">No equipment tracked</h3>
              <p className="text-sm text-on-surface-variant mt-1">Start by adding default society equipment.</p>
            </div>
            <button onClick={initDefaults} className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary font-semibold rounded-xl hover:bg-primary/20 transition">
              <Zap className="w-4 h-4" /> Pre-populate Defaults
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {equipment.map(e => {
              const Icon = ICONS[e.name] || Server;
              return (
                <div key={e.id} className="glass-card rounded-2xl p-6 flex flex-col gap-4 hover:scale-[1.02] transition-transform duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-on-surface">{e.name}</h4>
                        <p className="text-xs text-on-surface-variant">{e.location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                      e.status === 'operational' ? 'bg-status-available/10 text-status-available border border-status-available/20' :
                      e.status === 'needs_attention' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                      'bg-status-emergency/10 text-status-emergency border border-status-emergency/20'
                    }`}>
                      {e.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20 mt-auto">
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Last Inspected</p>
                      <p className="text-xs font-medium text-on-surface">
                        {e.last_inspected ? new Date(e.last_inspected).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Next Due</p>
                      <p className="text-xs font-medium text-on-surface">
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
