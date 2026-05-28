import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, Search, X, Loader2, AlertCircle,
  Clock, MapPin, Paperclip, Flag, MessageSquare, AlertTriangle,
} from 'lucide-react';
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
const PRIORITY_BADGE: Record<Priority, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
};
const PRIORITY_DOT: Record<Priority, string> = {
  low: 'bg-emerald-400', medium: 'bg-amber-400', high: 'bg-orange-400', critical: 'bg-red-500',
};
const STATUS_PILL: Partial<Record<Status, string>> = {
  open: 'bg-blue-500/10 text-blue-400',
  triaged: 'bg-purple-500/10 text-purple-400',
  assigned: 'bg-indigo-500/10 text-indigo-400',
  accepted: 'bg-cyan-500/10 text-cyan-400',
  in_progress: 'bg-amber-500/10 text-amber-400',
  on_hold: 'bg-gray-500/10 text-gray-400',
  resolved: 'bg-emerald-500/10 text-emerald-400',
  verified: 'bg-teal-500/10 text-teal-400',
  closed: 'bg-gray-500/10 text-gray-500',
  escalated: 'bg-red-500/10 text-red-400',
  reopened: 'bg-orange-500/10 text-orange-400',
};
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

function slaClass(dl: string, status: Status) {
  if (['closed', 'verified'].includes(status)) return 'text-on-surface-variant/40';
  const diff = new Date(dl).getTime() - Date.now();
  if (diff < 0) return 'text-status-emergency font-semibold';
  if (diff < 7200000) return 'text-amber-400 font-semibold';
  return 'text-on-surface-variant';
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
      <div className="relative bg-surface-container border-l border-outline-variant/20 w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col z-10">

        {/* Header */}
        <div className="sticky top-0 bg-surface-container border-b border-outline-variant/20 px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-on-surface leading-snug truncate">{c.title}</h2>
            <p className="text-xs text-on-surface-variant/50 mt-0.5 font-mono">{c.id.slice(0, 18)}…</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high transition flex-shrink-0">
            <X className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${PRIORITY_BADGE[c.priority]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[c.priority]}`} />
              {fmt(c.priority)}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[c.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
              {fmt(c.status)}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-container-high text-on-surface-variant">
              {c.category}
            </span>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              ['Submitted by', c.submitted_by_name],
              ['Assigned to', c.assigned_tech_name ?? 'Unassigned'],
              ['SLA Deadline', fmtDate(c.sla_deadline)],
              ['Created', fmtDate(c.created_at)],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-on-surface-variant/60 mb-0.5">{l}</p>
                <p className={`font-medium ${l === 'SLA Deadline' ? slaClass(c.sla_deadline, c.status) : 'text-on-surface'}`}>
                  {v}
                </p>
              </div>
            ))}
            {c.location_apt && (
              <div className="col-span-2">
                <p className="text-on-surface-variant/60 mb-0.5">Location</p>
                <p className="font-medium text-on-surface flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{c.location_apt}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest mb-2">Description</p>
            <p className="text-sm text-on-surface/80 leading-relaxed whitespace-pre-wrap">{c.description}</p>
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
          <div className="space-y-4 border-t border-outline-variant/15 pt-4">
            <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest">Admin Actions</p>

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
            <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest mb-3 flex items-center gap-1">
              <Clock className="w-3 h-3" />Activity ({logs.length})
            </p>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <ol className="relative border-l border-outline-variant/20 space-y-4 ml-2">
                {logs.map(log => (
                  <li key={log.id} className="ml-4">
                    <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary border-2 border-surface-container" />
                    <p className="text-xs font-semibold text-on-surface">
                      {fmt(log.action)}
                      {log.new_status && (
                        <span className="ml-1 font-normal text-on-surface-variant">→ {fmt(log.new_status)}</span>
                      )}
                    </p>
                    {log.note && (
                      <p className="text-xs text-on-surface-variant/70 mt-0.5 italic">"{log.note}"</p>
                    )}
                    <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
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
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none pl-3 pr-8 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition bg-surface-container-lowest text-on-surface ${
          value ? 'border-primary/30' : 'border-outline-variant/30'
        }`}
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o} value={o}>{fmt(o)}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/50" />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
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

  const filtered = complaints.filter(c => {
    if (filterStatus   && c.status   !== filterStatus)   return false;
    if (filterPriority && c.priority !== filterPriority) return false;
    if (filterCategory && c.category !== filterCategory) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hasFilter = filterStatus || filterPriority || filterCategory || search;

  return (
    <AdminLayout>
      <div className="px-margin-desktop py-10 max-w-screen-xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Complaints</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {filtered.length} complaint{filtered.length !== 1 ? 's' : ''} {hasFilter ? '(filtered)' : ''}
            <span className="ml-2 text-sm text-on-surface-variant/50">— View only. Auto-assignment handles technician routing.</span>
          </p>
        </div>

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-outline-variant/30 rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <Select label="All statuses"   value={filterStatus}   options={ALL_STATUSES}   onChange={setFilterStatus} />
          <Select label="All priorities" value={filterPriority} options={ALL_PRIORITIES} onChange={setFilterPriority} />
          <Select label="All categories" value={filterCategory} options={CATEGORIES}     onChange={setFilterCategory} />
          {hasFilter && (
            <button
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterCategory(''); }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition"
            >
              <X className="w-3.5 h-3.5" />Clear
            </button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-error-container/20 border border-error-container/40 rounded-2xl text-sm text-error">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* ── Table ── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant/40 gap-2">
              <span className="material-symbols-outlined text-[40px]">inbox</span>
              <p className="text-sm">No complaints match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container-lowest/60">
                    {['ID', 'Title', 'Category', 'Priority', 'Status', 'Submitted By', 'Assigned To', 'SLA', 'Created'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filtered.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="hover:bg-surface-variant/10 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5 font-mono text-xs text-on-surface-variant/40">{c.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3.5 max-w-[160px]">
                        <p className="font-medium text-on-surface truncate" title={c.title}>{c.title}</p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-on-surface-variant text-xs">{c.category}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_BADGE[c.priority]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[c.priority]}`} />
                          {fmt(c.priority)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_PILL[c.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                          {fmt(c.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-on-surface-variant text-xs">{c.submitted_by_name}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        {c.assigned_tech_name ?? <span className="text-on-surface-variant/30 italic">Auto-assigned</span>}
                      </td>
                      <td className={`px-4 py-3.5 whitespace-nowrap text-xs ${slaClass(c.sla_deadline, c.status)}`}>
                        {fmtDate(c.sla_deadline)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-on-surface-variant/50">
                        {fmtDate(c.created_at)}
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
