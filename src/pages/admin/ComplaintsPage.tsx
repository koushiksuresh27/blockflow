import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, X, Loader2, AlertCircle,
  Clock, MapPin, Paperclip, Flag, MessageSquare, AlertTriangle,
} from 'lucide-react';
import { Eye, WarningCircle } from 'iconoir-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status =
  | 'open' | 'triaged' | 'assigned' | 'accepted' | 'in_progress'
  | 'on_hold' | 'resolved' | 'verified' | 'closed' | 'escalated' | 'reopened';

interface Complaint {
  id: string; title: string; category: string; priority: Priority; status: Status;
  description: string; sla_deadline: string; created_at: string; updated_at: string;
  submitted_by_name: string; assigned_tech_name: string | null; assigned_tech_id: string | null;
  location_apt: string | null; society_id: string;
}
interface LogEntry {
  id: string; action: string; note: string | null;
  old_status: string | null; new_status: string | null;
  created_at: string; actor_name: string;
}
interface Attachment { id: string; url: string; attachment_type: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PRIORITY_BADGE_STYLE: Record<Priority, React.CSSProperties> = {
  critical: { background: '#FFF1F2', color: '#BE123C' },
  high:     { background: '#FEF3C7', color: '#92400E' },
  medium:   { background: '#EFF6FF', color: '#1D4ED8' },
  low:      { background: '#F0FDF4', color: '#15803D' },
};
const STATUS_BADGE_STYLE: Partial<Record<Status, React.CSSProperties>> = {
  open:        { background: '#F5F3F0', color: '#6B6560' },
  triaged:     { background: '#F5F3FF', color: '#6D28D9' },
  assigned:    { background: '#F5F3FF', color: '#6D28D9' },
  accepted:    { background: '#EFF6FF', color: '#1D4ED8' },
  in_progress: { background: '#EFF6FF', color: '#1D4ED8' },
  on_hold:     { background: '#F5F3F0', color: '#6B6560' },
  resolved:    { background: '#F0FDF4', color: '#15803D' },
  verified:    { background: '#F0FDF4', color: '#15803D' },
  closed:      { background: '#F5F3F0', color: '#9C9894' },
  escalated:   { background: '#FFF1F2', color: '#BE123C' },
  reopened:    { background: '#FEF3C7', color: '#92400E' },
};
import type React from 'react';
const ALL_STATUSES: Status[] = [
  'open', 'triaged', 'assigned', 'accepted', 'in_progress',
  'on_hold', 'resolved', 'verified', 'closed', 'escalated', 'reopened',
];
const ALL_PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];
const CATEGORIES = [
  'Plumbing', 'Electrical', 'Carpentry', 'HVAC',
  'Civil/Structural', 'Housekeeping', 'Lift/Elevator', 'Common Area', 'Other',
];

const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function slaStyle(dl: string, status: Status): React.CSSProperties {
  if (['closed', 'verified'].includes(status)) return { color: '#9C9894' };
  const diff = new Date(dl).getTime() - Date.now();
  if (diff < 0) return { color: '#DC2626', fontWeight: 700 };
  if (diff < 7200000) return { color: '#D97706', fontWeight: 700 };
  return { color: '#9C9894' };
}

// ─── Data ────────────────────────────────────────────────────────────────────
async function fetchAll(): Promise<{ complaints: Complaint[]; societyId: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile } = await supabase.from('users').select('society_id').eq('id', user.id).single();
  const societyId = profile?.society_id ?? '';

  let query = supabase.from('complaints').select(`
    id, title, category, priority, status, description,
    sla_deadline, created_at, updated_at, assigned_tech_id, society_id,
    submitted_user:users!submitted_by(name),
    assigned_tech:technicians!assigned_tech_id(tech_user:users!user_id(name)),
    location_apt:apartments!location_apt_id(
      flat_number, floor_number, tower:towers!tower_id(name)
    )
  `).order('created_at', { ascending: false }).limit(500);

  if (societyId) query = query.eq('society_id', societyId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { societyId, complaints: (data ?? []).map((r: any) => ({
    id: r.id, title: r.title, category: r.category, priority: r.priority, status: r.status,
    description: r.description, sla_deadline: r.sla_deadline, created_at: r.created_at,
    updated_at: r.updated_at, assigned_tech_id: r.assigned_tech_id, society_id: r.society_id,
    submitted_by_name: r.submitted_user?.name ?? '—',
    assigned_tech_name: r.assigned_tech?.tech_user?.name ?? null,
    location_apt: r.location_apt
      ? `${r.location_apt.tower?.name ?? ''} · F${r.location_apt.floor_number} · ${r.location_apt.flat_number}`
      : null,
  })) };
}

async function fetchDetail(id: string): Promise<{ logs: LogEntry[]; attachments: Attachment[] }> {
  const [{ data: logs }, { data: atts }] = await Promise.all([
    supabase.from('complaint_logs')
      .select('id, action, note, old_status, new_status, created_at, actor:users!actor_id(name)')
      .eq('complaint_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('complaint_attachments')
      .select('id, url, attachment_type')
      .eq('complaint_id', id),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logs: (logs ?? []).map((l: any) => ({ ...l, actor_name: l.actor?.name ?? 'System' })),
    attachments: atts ?? [],
  };
}

// ─── Detail Panel ────────────────────────────────────────────────────────────
function DetailPanel({
  c, onClose, onRefresh,
}: {
  c: Complaint; onClose: () => void; onRefresh: () => void;
}) {
  const toast = useToast();
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [atts, setAtts]         = useState<Attachment[]>([]);
  const [loading, setLoading]   = useState(true);

  // Priority change
  const [newPriority, setNewPriority] = useState<Priority>(c.priority);
  const [savingPriority, setSavingPriority] = useState(false);

  // Note
  const [noteText, setNoteText]   = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Escalate
  const [escalating, setEscalating] = useState(false);

  useEffect(() => {
    fetchDetail(c.id)
      .then(d => { setLogs(d.logs); setAtts(d.attachments); })
      .finally(() => setLoading(false));
  }, [c.id]);

  const savePriority = async () => {
    if (newPriority === c.priority) return;
    setSavingPriority(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('complaints').update({ priority: newPriority }).eq('id', c.id);
      await supabase.from('complaint_logs').insert({
        complaint_id: c.id,
        actor_id: user!.id,
        action: 'priority_change',
        note: `Priority changed from ${c.priority} to ${newPriority}.`,
      });
      toast('success', 'Priority updated', `Changed to ${newPriority}.`);
      onRefresh();
    } catch (e: unknown) {
      toast('error', 'Failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingPriority(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('complaint_logs').insert({
        complaint_id: c.id,
        actor_id: user!.id,
        action: 'admin_note',
        note: noteText.trim(),
      });
      toast('success', 'Note added', 'Admin note recorded in the activity log.');
      setNoteText('');
      // Refresh logs
      fetchDetail(c.id).then(d => { setLogs(d.logs); setAtts(d.attachments); });
    } catch (e: unknown) {
      toast('error', 'Failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingNote(false);
    }
  };

  const escalate = async () => {
    if (c.status === 'escalated') return;
    setEscalating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('complaints')
        .update({ status: 'escalated' })
        .eq('id', c.id);
      await supabase.from('complaint_logs').insert({
        complaint_id: c.id,
        actor_id: user!.id,
        action: 'escalated',
        old_status: c.status,
        new_status: 'escalated',
        note: 'Escalated by admin.',
      });
      toast('success', 'Escalated', 'Complaint has been escalated.');
      onRefresh();
    } catch (e: unknown) {
      toast('error', 'Failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setEscalating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col z-10" style={{ background: '#FFFFFF', borderLeft: '1px solid #E0DDD9' }}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: '#FFFFFF', borderBottom: '1px solid #E0DDD9', padding: '16px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#1C1917', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</h2>
            <p style={{ fontSize: 11, color: '#9C9894', margin: '4px 0 0', fontFamily: 'monospace' }}>{c.id.slice(0, 18)}…</p>
          </div>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B6560', display: 'flex', alignItems: 'center' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ ...PRIORITY_BADGE_STYLE[c.priority], borderRadius: 6, padding: '3px 10px', fontFamily: 'Inter', fontWeight: 500, fontSize: 12 }}>
              {fmt(c.priority)}
            </span>
            <span style={{ ...(STATUS_BADGE_STYLE[c.status] ?? { background: '#F5F3F0', color: '#6B6560' }), borderRadius: 6, padding: '3px 10px', fontFamily: 'Inter', fontWeight: 500, fontSize: 12 }}>
              {fmt(c.status)}
            </span>
            <span style={{ background: '#F5F3F0', color: '#6B6560', borderRadius: 6, padding: '3px 10px', fontFamily: 'Inter', fontWeight: 500, fontSize: 12 }}>
              {c.category}
            </span>
          </div>

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Submitted by', c.submitted_by_name],
              ['Assigned to', c.assigned_tech_name ?? 'Unassigned'],
              ['SLA Deadline', fmtDate(c.sla_deadline)],
              ['Created', fmtDate(c.created_at)],
            ].map(([l, v]) => (
              <div key={l}>
                <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#9C9894', margin: '0 0 2px' }}>{l}</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, margin: 0, ...(l === 'SLA Deadline' ? slaStyle(c.sla_deadline, c.status) : { color: '#1C1917' }) }}>
                  {v}
                </p>
              </div>
            ))}
            {c.location_apt && (
              <div style={{ gridColumn: 'span 2' }}>
                <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#9C9894', margin: '0 0 2px' }}>Location</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin className="w-3 h-3" />{c.location_apt}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 11, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Description</p>
            <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{c.description}</p>
          </div>

          {/* Attachments */}
          {atts.length > 0 && (
            <div>
              <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Paperclip className="w-3 h-3" />Attachments ({atts.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {atts.map(a => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="relative group">
                    <img src={a.url} alt={a.attachment_type}
                      className="w-20 h-20 object-cover rounded-lg border border-outline-variant/20" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 rounded-b-lg">
                      {a.attachment_type}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Admin Actions (read-only + specific actions) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid #E0DDD9', paddingTop: 16 }}>
            <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 11, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>Admin Actions</p>

            {/* Priority change */}
            <div>
              <p className="text-xs font-semibold text-on-surface-variant mb-2 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" /> Change Priority
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as Priority)}
                    className="w-full appearance-none px-3 py-2 text-sm border border-outline-variant/30 rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 pr-8"
                  >
                    {ALL_PRIORITIES.map(p => (
                      <option key={p} value={p}>{fmt(p)}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                </div>
                <button
                  id={`save-priority-${c.id}`}
                  onClick={savePriority}
                  disabled={savingPriority || newPriority === c.priority}
                  className="px-4 py-2 text-sm font-bold text-white bg-primary hover:brightness-110 disabled:opacity-40 rounded-xl transition flex items-center gap-1.5"
                >
                  {savingPriority ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </div>

            {/* Add note */}
            <div>
              <p className="text-xs font-semibold text-on-surface-variant mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Add Note
              </p>
              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add an admin note to the activity log…"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-outline-variant/30 rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <button
                  id={`add-note-${c.id}`}
                  onClick={addNote}
                  disabled={savingNote || !noteText.trim()}
                  className="w-full py-2 text-sm font-bold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 disabled:opacity-40 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                  {savingNote ? 'Adding…' : 'Add Note'}
                </button>
              </div>
            </div>

            {/* Escalate */}
            {c.status !== 'escalated' && c.status !== 'closed' && c.status !== 'verified' && (
              <div>
                <p className="text-xs font-semibold text-on-surface-variant mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Escalate
                </p>
                <button
                  id={`escalate-${c.id}`}
                  onClick={escalate}
                  disabled={escalating}
                  className="w-full py-2.5 text-sm font-bold text-status-emergency bg-status-emergency/10 border border-status-emergency/20 hover:bg-status-emergency/20 disabled:opacity-40 rounded-xl transition flex items-center justify-center gap-2"
                >
                  {escalating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {escalating ? 'Escalating…' : 'Escalate Complaint'}
                </button>
              </div>
            )}

            {c.status === 'escalated' && (
              <div className="flex items-center gap-2 p-3 bg-status-emergency/10 border border-status-emergency/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-status-emergency flex-shrink-0" />
                <p className="text-xs text-status-emergency font-semibold">This complaint is already escalated.</p>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div>
            <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 11, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock className="w-3 h-3" />Activity ({logs.length})
            </p>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#D97706' }} />
            ) : (
              <ol style={{ position: 'relative', borderLeft: '1px solid #E0DDD9', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {logs.map(log => (
                  <li key={log.id} style={{ marginLeft: 16 }}>
                    <div style={{ position: 'absolute', left: -5, width: 10, height: 10, borderRadius: '50%', background: '#D97706', border: '2px solid #FFFFFF' }} />
                    <p style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917', margin: '0 0 2px' }}>
                      {fmt(log.action)}
                      {log.new_status && (
                        <span style={{ fontWeight: 400, color: '#6B6560', marginLeft: 4 }}>→ {fmt(log.new_status)}</span>
                      )}
                    </p>
                    {log.note && (
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#6B6560', fontStyle: 'italic', margin: '0 0 2px' }}>"{log.note}"</p>
                    )}
                    <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#9C9894', margin: 0 }}>
                      {log.actor_name} · {fmtDate(log.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Select ────────────────────────────────────────────────────────────
function Select({
  label, value, options, onChange,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none',
          paddingLeft: 12, paddingRight: 32, paddingTop: 6, paddingBottom: 6,
          fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13,
          background: value ? '#1C1917' : '#FFFFFF',
          color: value ? '#FFFFFF' : '#6B6560',
          border: '1px solid #E0DDD9',
          borderRadius: 8, cursor: 'pointer',
          outline: 'none',
        }}
      >
        <option value="" style={{ background: '#FFFFFF', color: '#6B6560' }}>{label}</option>
        {options.map(o => <option key={o} value={o} style={{ background: '#FFFFFF', color: '#1C1917' }}>{fmt(o)}</option>)}
      </select>
      <ChevronDown className="pointer-events-none" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: value ? '#FFFFFF' : '#9C9894' }} />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selected, setSelected]     = useState<Complaint | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await fetchAll();
      setComplaints(r.complaints);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredComplaints = complaints.filter(c => {
    if (filterStatus   && c.status   !== filterStatus)   return false;
    if (filterPriority && c.priority !== filterPriority) return false;
    if (filterCategory && c.category !== filterCategory) return false;
    return true;
  });

  const hasFilter = filterStatus || filterPriority || filterCategory;

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        {/* ── Filter bar ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <Select label="All statuses"   value={filterStatus}   options={ALL_STATUSES}   onChange={setFilterStatus} />
          <Select label="All priorities" value={filterPriority} options={ALL_PRIORITIES} onChange={setFilterPriority} />
          <Select label="All categories" value={filterCategory} options={CATEGORIES}     onChange={setFilterCategory} />
          {hasFilter && (
            <button
              onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterCategory(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 14px',
                fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13,
                color: '#6B6560',
                background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 8, cursor: 'pointer',
              }}
            >
              <X className="w-3.5 h-3.5" />Clear
            </button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FFF1F2', border: '1px solid #FCA5A5', borderRadius: 12, marginBottom: 16, fontFamily: 'Inter', fontSize: 14, color: '#BE123C' }}>
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* ── Table card ── */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
                  <div className="skeleton" style={{ height: 14, flex: 2 }} />
                  <div className="skeleton" style={{ height: 20, width: 80, borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 20, width: 80, borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 14, flex: 1 }} />
                </div>
              ))}
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 8 }}>
              <WarningCircle width={40} height={40} style={{ color: '#E0DDD9' }} />
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#9C9894', margin: 0 }}>No complaints found</p>
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9C9894', margin: 0 }}>Try adjusting your filters.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F5F3F0', borderBottom: '1px solid #E0DDD9' }}>
                    {['Title', 'Category', 'Priority', 'Status', 'Submitted By', 'Assigned To', 'SLA', 'Created', 'Action'].map(h => (
                      <th key={h} style={{
                        padding: '12px 20px',
                        textAlign: 'left',
                        fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12,
                        color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredComplaints.map((c, i) => (
                    <tr
                      key={c.id}
                      style={{ borderBottom: i < filteredComplaints.length - 1 ? '1px solid #F5F3F0' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                      onClick={() => setSelected(c)}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FAFAF9'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                    >
                      <td style={{ padding: '14px 20px', maxWidth: 200 }}>
                        <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 14, color: '#1C1917', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.title}>{c.title}</p>
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>{c.category}</span>
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span style={{ ...PRIORITY_BADGE_STYLE[c.priority], borderRadius: 6, padding: '3px 10px', fontFamily: 'Inter', fontWeight: 500, fontSize: 12 }}>
                          {fmt(c.priority)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span style={{ ...(STATUS_BADGE_STYLE[c.status] ?? { background: '#F5F3F0', color: '#6B6560' }), borderRadius: 6, padding: '3px 10px', fontFamily: 'Inter', fontWeight: 500, fontSize: 12 }}>
                          {fmt(c.status)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', fontFamily: 'Inter', fontSize: 14, color: '#1C1917' }}>{c.submitted_by_name}</td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', fontFamily: 'Inter', fontSize: 14, color: '#1C1917' }}>
                        {c.assigned_tech_name ?? <span style={{ color: '#9C9894', fontStyle: 'italic' }}>Auto-assigned</span>}
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'Inter', fontSize: 14, ...slaStyle(c.sla_deadline, c.status) }}>{fmtDate(c.sla_deadline)}</span>
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', fontFamily: 'Inter', fontSize: 14, color: '#9C9894' }}>
                        {fmtDate(c.created_at)}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(c); }}
                          style={{ width: 30, height: 30, border: '1px solid #E0DDD9', borderRadius: 8, background: 'transparent', color: '#6B6560', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1C1917'; (e.currentTarget as HTMLButtonElement).style.color = '#1C1917'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E0DDD9'; (e.currentTarget as HTMLButtonElement).style.color = '#6B6560'; }}
                        >
                          <Eye width={14} height={14} strokeWidth={1.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <DetailPanel
          c={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => { load(); setSelected(null); }}
        />
      )}
    </AdminLayout>
  );
}
