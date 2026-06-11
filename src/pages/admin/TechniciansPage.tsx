import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, Plus, X, Star, Briefcase,
  Check, TrendingUp, AlertTriangle, ShieldCheck, Info, Trash2
} from 'lucide-react';
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
  avg_rating: number;
  rating_count: number;
  completed_jobs: number;
  sla_misses: number;
  open_tasks: number;
}

interface SecurityStaff {
  id: string;
  name: string;
  phone: string | null;
  status: string;
}

const SPEC_OPTIONS = [
  'Plumbing', 'Electrical', 'Carpentry', 'HVAC',
  'Civil/Structural', 'Housekeeping', 'Lift/Elevator', 'General',
];

// ─── Stars ───────────────────────────────────────────────────────────────────

function Stars({ score }: { score: number }) {
  const filled = Math.round((score / 100) * 5);
  return (
    <span style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ fontSize: 12, color: i < filled ? '#D97706' : '#E0DDD9' }}>★</span>
      ))}
    </span>
  );
}

// ─── Add Technician Modal ─────────────────────────────────────────────────────

function AddTechModal({ societyId, onClose, onAdded }: { societyId: string; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specs, setSpecs] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const toggleSpec = (s: string) => setSpecs(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!email.trim()) e.email = 'Email is required.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    try {
      const newUserId = crypto.randomUUID();
      const { error: userErr } = await supabase.from('users').insert({
        id: newUserId, name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null, role: 'technician', status: 'active',
        ...(societyId && { society_id: societyId }),
      });
      if (userErr) throw new Error(userErr.message);

      const { error: techErr } = await supabase.from('technicians').insert({
        user_id: newUserId, specializations: specs, is_available: true, performance_score: 0,
        ...(societyId && { society_id: societyId }),
      });
      if (techErr) throw new Error(techErr.message);

      toast('success', 'Technician added', 'They can sign in with Google using their phone number.');
      onAdded(); onClose();
    } catch (err: unknown) {
      toast('error', 'Failed', err instanceof Error ? err.message : 'Error');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E0DDD9' }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 17, color: '#1C1917', margin: 0 }}>Add Technician</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6560', padding: 4 }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { id: 'tech-name',  label: 'Full Name',      val: name,  set: setName,  type: 'text',  required: true,  placeholder: 'e.g. Ramesh Kumar'     },
            { id: 'tech-email', label: 'Email *',         val: email, set: setEmail, type: 'email', required: true,  placeholder: 'ramesh@example.com'     },
            { id: 'tech-phone', label: 'Phone (optional)', val: phone, set: setPhone, type: 'tel',   required: false, placeholder: '+91 9876543210'         },
          ].map(f => (
            <div key={f.id}>
              <label htmlFor={f.id} style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input id={f.id} type={f.type} value={f.val} placeholder={f.placeholder}
                onChange={e => f.set(e.target.value)}
                style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: errors[f.id] ? '1px solid #DC2626' : '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors[f.id] && <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#DC2626', margin: '4px 0 0' }}>{errors[f.id]}</p>}
            </div>
          ))}
          <div>
            <p style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 8 }}>Specializations</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SPEC_OPTIONS.map(s => {
                const on = specs.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleSpec(s)}
                    style={{ padding: '5px 12px', borderRadius: 6, fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 12, background: on ? '#1C1917' : '#F5F3F0', color: on ? '#FFFFFF' : '#6B6560', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {on && <Check className="w-3 h-3" />}{s}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ padding: 12, background: '#F5F3F0', borderRadius: 8 }}>
            <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#6B6560', display: 'flex', gap: 8, margin: 0 }}>
              <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#9C9894', marginTop: 1 }} />
              <span>Ask them to sign in with Google using the <strong>same email</strong> registered here.</span>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, padding: '0 24px 20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 10, cursor: 'pointer' }}>Cancel</button>
          <button id="add-tech-submit" onClick={handleSubmit} disabled={saving}
            style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: '#FFFFFF', background: saving ? '#2C2925' : '#1C1917', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Adding…' : 'Add Technician'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Security Staff Modal ─────────────────────────────────────────────────

function AddSecurityModal({ societyId, onClose, onAdded }: { societyId: string; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!email.trim()) e.email = 'Email is required for Google sign-in matching.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('users').insert({
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role: 'security',
        status: 'active',
        ...(societyId && { society_id: societyId }),
      });
      if (error) throw new Error(error.message);

      toast('success', `${name.trim()} added as security staff.`,
        `Ask them to sign in with Google using: ${email.trim()}`);
      onAdded(); onClose();
    } catch (err: unknown) {
      toast('error', 'Failed to add security staff', err instanceof Error ? err.message : 'Error');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className="bg-surface-container border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant/20">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Add Security Staff</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high transition"><X className="w-4 h-4 text-on-surface-variant" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {[
            { id: 'sec-name',  label: 'Full Name',       val: name,  set: setName,  type: 'text',  placeholder: 'e.g. Suresh Kumar'      },
            { id: 'sec-email', label: 'Email *',          val: email, set: setEmail, type: 'email', placeholder: 'suresh@example.com'      },
            { id: 'sec-phone', label: 'Phone (optional)', val: phone, set: setPhone, type: 'tel',   placeholder: '+91 9876543210'          },
          ].map(f => (
            <div key={f.id}>
              <label htmlFor={f.id} className="block text-sm font-semibold text-on-surface-variant mb-1.5">{f.label}</label>
              <input id={f.id} type={f.type} value={f.val} placeholder={f.placeholder}
                onChange={e => f.set(e.target.value)}
                className={`w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition ${errors[f.id] ? 'border-error' : 'border-outline-variant/30'}`}
              />
              {errors[f.id] && <p className="mt-1 text-xs text-error">{errors[f.id]}</p>}
            </div>
          ))}

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-xs text-blue-700 font-medium flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-blue-500" />
              <span><strong>Important:</strong> The email you enter here must match their Google account email. This is how their account gets linked automatically when they sign in.</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-primary hover:brightness-110 disabled:opacity-60 rounded-xl transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {saving ? 'Adding…' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TechniciansPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'technicians' | 'security'>('technicians');

  // Technicians state
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingTech, setLoadingTech] = useState(true);
  const [techError, setTechError] = useState('');
  const [showAddTech, setShowAddTech] = useState(false);

  // Security state
  const [securityStaff, setSecurityStaff] = useState<SecurityStaff[]>([]);
  const [loadingSec, setLoadingSec] = useState(true);
  const [showAddSec, setShowAddSec] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Shared
  const [societyId, setSocietyId] = useState('');

  // ── Load technicians ──────────────────────────────────────────────────────

  const loadTechnicians = useCallback(async () => {
    setTechError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user.id).single();
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
        const allC = r.all_complaints ?? [];
        const completed = allC.filter((c: { status: string }) => ['closed', 'verified', 'resolved'].includes(c.status));
        const slaMisses = completed.filter((c: { sla_deadline: string; updated_at: string }) =>
          new Date(c.updated_at).getTime() > new Date(c.sla_deadline).getTime()).length;
        const openTasks = allC.filter((c: { status: string }) => !['closed', 'verified', 'resolved'].includes(c.status)).length;
        const ratingScores: number[] = (r.ratings_data ?? []).map((x: { score: number }) => x.score);
        const avgRating = ratingScores.length > 0 ? ratingScores.reduce((a: number, b: number) => a + b, 0) / ratingScores.length : 0;
        return {
          id: r.id, user_id: r.user_id,
          name: r.tech_user?.name ?? 'Unknown', phone: r.tech_user?.phone ?? '',
          specializations: r.specializations ?? [], performance_score: r.performance_score ?? 0,
          is_available: r.is_available, avg_rating: avgRating,
          rating_count: ratingScores.length, completed_jobs: completed.length,
          sla_misses: slaMisses, open_tasks: openTasks,
        };
      }));
    } catch (e: unknown) {
      setTechError(e instanceof Error ? e.message : 'Error');
    } finally { setLoadingTech(false); }
  }, []);

  // ── Load security staff ───────────────────────────────────────────────────

  const loadSecurity = useCallback(async () => {
    setLoadingSec(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user.id).single();
      const sid = profile?.society_id ?? '';
      if (sid) setSocietyId(sid);

      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, status')
        .eq('role', 'security')
        .eq('society_id', sid)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSecurityStaff((data ?? []).map((r: any) => ({
        id: r.id, name: r.name, phone: r.phone ?? null,
        status: r.status,
      })));
    } catch (err) {
      console.error(err);
    } finally { setLoadingSec(false); }
  }, []);

  useEffect(() => { loadTechnicians(); loadSecurity(); }, [loadTechnicians, loadSecurity]);

  const toggleAvailable = async (t: Technician) => {
    const newVal = !t.is_available;
    setTechnicians(p => p.map(x => x.id === t.id ? { ...x, is_available: newVal } : x));
    const { error: e } = await supabase.from('technicians').update({ is_available: newVal }).eq('id', t.id);
    if (e) {
      setTechnicians(p => p.map(x => x.id === t.id ? { ...x, is_available: t.is_available } : x));
      toast('error', 'Update failed', e.message);
    } else {
      toast('success', 'Availability updated', `${t.name} marked as ${newVal ? 'available' : 'busy'}.`);
    }
  };

  const handleRemoveSecurity = async (id: string) => {
    await supabase.from('users').update({ status: 'rejected' }).eq('id', id);
    setSecurityStaff(prev => prev.filter(s => s.id !== id));
    setConfirmRemoveId(null);
    toast('success', 'Staff member removed');
  };

  const filteredTechnicians = technicians;
  const filteredSecurity = securityStaff;

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        {/* Header + Tab + Add button row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 10, padding: 4 }}>
            {(['technicians', 'security'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: '7px 20px', borderRadius: 8,
                  fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13,
                  color: activeTab === tab ? '#FFFFFF' : '#6B6560',
                  border: 'none',
                  background: activeTab === tab ? '#1C1917' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {tab === 'technicians' ? 'Technicians' : 'Security Staff'}
              </button>
            ))}
          </div>

          {/* Add button */}
          {activeTab === 'technicians' ? (
            <button id="add-technician-btn" onClick={() => setShowAddTech(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#D97706', color: '#FFFFFF', borderRadius: 10, border: 'none', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              <Plus className="w-4 h-4" /> Add Technician
            </button>
          ) : (
            <button onClick={() => setShowAddSec(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#D97706', color: '#FFFFFF', borderRadius: 10, border: 'none', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              <ShieldCheck className="w-4 h-4" /> Add Security Staff
            </button>
          )}
        </div>

        {/* TECHNICIANS TAB */}
        {activeTab === 'technicians' && (
          <>
            {techError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FFF1F2', border: '1px solid #FCA5A5', borderRadius: 12, marginBottom: 16, fontFamily: 'Inter', fontSize: 14, color: '#BE123C' }}>
                <AlertCircle className="w-4 h-4" />{techError}
              </div>
            )}
            {loadingTech ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
                    <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%', marginBottom: 12 }} />
                    <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 16 }} />
                    <div className="skeleton" style={{ height: 6, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {filteredTechnicians.length === 0 && (
                  <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '48px 0' }}>
                    <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#9C9894' }}>No technicians yet.</p>
                  </div>
                )}
                {filteredTechnicians.map(t => (
                  <div key={t.id} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Name + availability */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F5F3F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#6B6560', flexShrink: 0 }}>
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, color: '#1C1917', margin: 0 }}>{t.name}</p>
                          <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: 0 }}>{t.phone || 'No phone'}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleAvailable(t)}
                        style={{
                          padding: '3px 10px', borderRadius: 20, fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 12, border: 'none', cursor: 'pointer',
                          background: t.is_available ? '#F0FDF4' : '#F5F3F0',
                          color: t.is_available ? '#15803D' : '#6B6560',
                        }}
                      >
                        {t.is_available ? '● Available' : '○ Busy'}
                      </button>
                    </div>

                    {/* Specializations */}
                    {t.specializations.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {t.specializations.map(s => (
                          <span key={s} style={{ fontFamily: 'Inter', fontSize: 11, padding: '2px 8px', background: '#F5F3F0', color: '#6B6560', borderRadius: 4 }}>{s}</span>
                        ))}
                      </div>
                    )}

                    {/* Performance bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 11, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Performance</span>
                        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#D97706' }}>{t.performance_score}/100</span>
                      </div>
                      <div style={{ height: 4, background: '#F5F3F0', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#D97706', borderRadius: 2, width: `${Math.min(t.performance_score, 100)}%`, transition: 'width 0.5s' }} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid #F5F3F0', paddingTop: 12 }}>
                      <div>
                        <p style={{ fontFamily: 'Inter', fontSize: 10, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Rating</p>
                        <Stars score={t.performance_score} />
                      </div>
                      <div>
                        <p style={{ fontFamily: 'Inter', fontSize: 10, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Completed</p>
                        <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#1C1917', margin: 0 }}>{t.completed_jobs} <span style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 12, color: '#9C9894' }}>jobs</span></p>
                      </div>
                      <div>
                        <p style={{ fontFamily: 'Inter', fontSize: 10, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Active</p>
                        <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#1C1917', margin: 0 }}>{t.open_tasks} <span style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 12, color: '#9C9894' }}>open</span></p>
                      </div>
                      <div>
                        <p style={{ fontFamily: 'Inter', fontSize: 10, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>SLA Misses</p>
                        <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: t.sla_misses > 0 ? '#DC2626' : '#1C1917', margin: 0 }}>{t.sla_misses}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <>
            <div style={{ display: 'flex', gap: 12, padding: 16, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, marginBottom: 20, fontFamily: 'Inter', fontSize: 14, color: '#1E40AF' }}>
              <Info className="w-5 h-5 shrink-0" />
              <p style={{ margin: 0 }}>After adding a security staff member, ask them to sign in with Google using the same email registered here.</p>
            </div>

            {loadingSec ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#D97706' }} /></div>
            ) : filteredSecurity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#9C9894', margin: 0 }}>No security staff found.</p>
              </div>
            ) : (
              <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F5F3F0', borderBottom: '1px solid #E0DDD9' }}>
                      {['Name', 'Phone', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSecurity.map((staff, i) => (
                      <tr key={staff.id}
                        style={{ borderBottom: i < filteredSecurity.length - 1 ? '1px solid #F5F3F0' : 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FAFAF9'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F5F3F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#6B6560', flexShrink: 0 }}>
                              {staff.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917' }}>{staff.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>{staff.phone ?? <span style={{ fontStyle: 'italic', color: '#9C9894' }}>—</span>}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 12, background: staff.status === 'active' ? '#F0FDF4' : '#F5F3F0', color: staff.status === 'active' ? '#15803D' : '#6B6560', borderRadius: 6, padding: '3px 10px' }}>
                            {staff.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button onClick={() => setConfirmRemoveId(staff.id)}
                            style={{ background: 'transparent', border: 'none', color: '#9C9894', cursor: 'pointer', padding: 6, borderRadius: 6, transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9C9894'; }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAddTech && <AddTechModal societyId={societyId} onClose={() => setShowAddTech(false)} onAdded={loadTechnicians} />}
      {showAddSec  && <AddSecurityModal societyId={societyId} onClose={() => setShowAddSec(false)} onAdded={loadSecurity} />}

      {/* Remove Confirmation */}
      {confirmRemoveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.15)', width: '100%', maxWidth: 360, padding: 24, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, background: '#FFF1F2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 className="w-6 h-6" style={{ color: '#DC2626' }} />
            </div>
            <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 18, color: '#1C1917', margin: '0 0 8px' }}>Remove Staff Member?</h3>
            <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#6B6560', margin: '0 0 24px', lineHeight: 1.5 }}>This will revoke their access to the security dashboard.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmRemoveId(null)} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 10, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleRemoveSecurity(confirmRemoveId)} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: '#FFFFFF', background: '#DC2626', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
