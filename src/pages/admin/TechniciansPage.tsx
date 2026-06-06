import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Plus, X, Star, Briefcase, Check, TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Technician {
  id: string;
  name: string;
  phone: string;
  specializations: string[];
  performance_score: number;
  is_available: boolean;
  user_id: string;
  // extended metrics
  avg_rating: number;
  rating_count: number;
  completed_jobs: number;
  sla_misses: number;
  open_tasks: number;
}

const SPEC_OPTIONS = [
  'Plumbing', 'Electrical', 'Carpentry', 'HVAC',
  'Civil/Structural', 'Housekeeping', 'Lift/Elevator', 'General',
];

function Stars({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const filled = Math.round((score / 100) * 5);
  return (
    <span className={`flex gap-0.5 ${size === 'md' ? '' : ''}`} aria-label={`${filled} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${
            i < filled ? 'text-amber-400 fill-amber-400' : 'text-surface-container-highest fill-surface-container-highest'
          }`}
        />
      ))}
    </span>
  );
}

// ─── Add Technician Modal ────────────────────────────────────────────────────
function AddTechModal({
  societyId, onClose, onAdded,
}: {
  societyId: string; onClose: () => void; onAdded: () => void;
}) {
  const toast = useToast();
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [specs, setSpecs] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const toggleSpec = (s: string) => setSpecs(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const newUserId = crypto.randomUUID();
      const { error: userErr } = await supabase.from('users').insert({
        id: newUserId,
        name: name.trim(),
        phone: phone.trim() || null,
        role: 'technician',
        status: 'active',
        ...(societyId && { society_id: societyId }),
      });
      if (userErr) throw new Error(userErr.message);

      const { error: techErr } = await supabase.from('technicians').insert({
        user_id: newUserId,
        specializations: specs,
        is_available: true,
        performance_score: 0,
        ...(societyId && { society_id: societyId }),
      });
      if (techErr) throw new Error(techErr.message);

      toast('success', 'Technician added', 'They can be invited to the app later.');
      onAdded();
      onClose();
    } catch (e: unknown) {
      toast('error', 'Failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-surface-container border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-md animate-slideInRight"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant/20">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Add Technician</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high transition">
            <X className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {[
            { id: 'tech-name', label: 'Full Name', val: name, set: setName, type: 'text', placeholder: 'e.g. Ramesh Kumar' },
            { id: 'tech-phone', label: 'Phone', val: phone, set: setPhone, type: 'tel', placeholder: '+91 9876543210' },
          ].map(f => (
            <div key={f.id}>
              <label htmlFor={f.id} className="block text-sm font-semibold text-on-surface-variant mb-1.5">{f.label}</label>
              <input
                id={f.id}
                type={f.type}
                value={f.val}
                placeholder={f.placeholder}
                onChange={e => f.set(e.target.value)}
                className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition ${
                  errors[f.id] ? 'border-error' : 'border-outline-variant/30'
                }`}
              />
              {errors[f.id] && <p className="mt-1 text-xs text-error">{errors[f.id]}</p>}
            </div>
          ))}

          <div>
            <p className="text-sm font-semibold text-on-surface-variant mb-2">Specializations</p>
            <div className="flex flex-wrap gap-2">
              {SPEC_OPTIONS.map(s => {
                const on = specs.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpec(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      on
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:border-outline-variant'
                    }`}
                  >
                    {on && <Check className="w-3 h-3" />}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
            <p className="text-xs text-primary font-medium flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Note:</strong> Send them the app link and ask them to sign in with Google using their phone number. Their account will be automatically activated and linked.
              </span>
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition"
          >
            Cancel
          </button>
          <button
            id="add-tech-submit"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-primary hover:brightness-110 disabled:opacity-60 rounded-xl transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Adding…' : 'Add Technician'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function TechniciansPage() {
  const toast = useToast();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [societyId, setSocietyId]     = useState('');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showAdd, setShowAdd]         = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('users').select('society_id').eq('id', user.id).single();

      const sid = profile?.society_id ?? '';
      setSocietyId(sid);

      let query = supabase.from('technicians').select(`
        id, specializations, performance_score, is_available, user_id,
        tech_user:users!user_id(name, phone),
        all_complaints:complaints!assigned_tech_id(status, sla_deadline, updated_at),
        ratings_data:ratings!technician_id(score)
      `);

      if (sid) query = query.eq('society_id', sid);

      const { data, error: e } = await query;
      if (e) throw new Error(e.message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTechnicians((data ?? []).map((r: any) => {
        const allComplaints = r.all_complaints ?? [];
        const completed = allComplaints.filter((c: { status: string }) =>
          ['closed', 'verified', 'resolved'].includes(c.status));
        const slaMisses = completed.filter((c: { sla_deadline: string; updated_at: string }) =>
          new Date(c.updated_at).getTime() > new Date(c.sla_deadline).getTime()).length;
        const openTasks = allComplaints.filter((c: { status: string }) =>
          !['closed', 'verified', 'resolved'].includes(c.status)).length;
        const ratingScores: number[] = (r.ratings_data ?? []).map((x: { score: number }) => x.score);
        const avgRating = ratingScores.length > 0
          ? ratingScores.reduce((a: number, b: number) => a + b, 0) / ratingScores.length
          : 0;

        return {
          id: r.id,
          user_id: r.user_id,
          name: r.tech_user?.name ?? 'Unknown',
          phone: r.tech_user?.phone ?? '',
          specializations: r.specializations ?? [],
          performance_score: r.performance_score ?? 0,
          is_available: r.is_available,
          avg_rating: avgRating,
          rating_count: ratingScores.length,
          completed_jobs: completed.length,
          sla_misses: slaMisses,
          open_tasks: openTasks,
        };
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAvailable = async (t: Technician) => {
    const newVal = !t.is_available;
    setTechnicians(p => p.map(x => x.id === t.id ? { ...x, is_available: newVal } : x));
    const { error: e } = await supabase
      .from('technicians').update({ is_available: newVal }).eq('id', t.id);
    if (e) {
      setTechnicians(p => p.map(x => x.id === t.id ? { ...x, is_available: t.is_available } : x));
      toast('error', 'Update failed', e.message);
    } else {
      toast('success', 'Availability updated', `${t.name} marked as ${newVal ? 'available' : 'busy'}.`);
    }
  };

  return (
    <AdminLayout>
      <div className="px-margin-desktop py-10 max-w-screen-xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Technicians</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              {technicians.length} technician{technicians.length !== 1 ? 's' : ''} in your society
            </p>
          </div>
          <button
            id="add-technician-btn"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-primary hover:brightness-110 transition shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Add Technician
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-error-container/20 border border-error-container/40 rounded-2xl text-sm text-error">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* ── Cards ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {technicians.length === 0 && (
              <p className="col-span-3 text-center py-20 text-sm text-on-surface-variant/50">
                No technicians added yet.
              </p>
            )}
            {technicians.map(t => (
              <div
                key={t.id}
                className="glass-card rounded-2xl p-5 flex flex-col gap-4 hover:scale-[1.01] transition-transform duration-200"
              >
                {/* Top: Name + Availability toggle */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">{t.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-on-surface text-sm">{t.name}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{t.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAvailable(t)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold transition ${
                      t.is_available
                        ? 'bg-status-available/10 text-status-available border border-status-available/20 hover:bg-status-available/20'
                        : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-highest'
                    }`}
                  >
                    {t.is_available ? '● Available' : '○ Busy'}
                  </button>
                </div>

                {/* Specialization tags */}
                {t.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.specializations.map(s => (
                      <span key={s} className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Performance bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Performance</span>
                    <span className="text-[10px] font-bold text-on-surface">{t.performance_score}/100</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(t.performance_score, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-outline-variant/15">
                  {/* Rating */}
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Rating</p>
                    <div className="flex items-center gap-1">
                      <Stars score={t.performance_score} />
                      {t.rating_count > 0 && (
                        <span className="text-[10px] text-on-surface-variant ml-1">
                          {t.avg_rating.toFixed(1)} ({t.rating_count})
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Completed jobs */}
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Completed</p>
                    <div className="flex items-center gap-1 text-on-surface">
                      <Briefcase className="w-3 h-3 text-on-surface-variant" />
                      <span className="text-sm font-bold">{t.completed_jobs}</span>
                      <span className="text-xs text-on-surface-variant">jobs</span>
                    </div>
                  </div>
                  {/* Open tasks */}
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Active Tasks</p>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-on-surface-variant" />
                      <span className="text-sm font-bold text-on-surface">{t.open_tasks}</span>
                      <span className="text-xs text-on-surface-variant">open</span>
                    </div>
                  </div>
                  {/* SLA misses */}
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">SLA Misses</p>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className={`w-3 h-3 ${t.sla_misses > 0 ? 'text-status-emergency' : 'text-on-surface-variant'}`} />
                      <span className={`text-sm font-bold ${t.sla_misses > 0 ? 'text-status-emergency' : 'text-on-surface'}`}>
                        {t.sla_misses}
                      </span>
                      <span className="text-xs text-on-surface-variant">total</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddTechModal
          societyId={societyId}
          onClose={() => setShowAdd(false)}
          onAdded={load}
        />
      )}
    </AdminLayout>
  );
}
