import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, ClipboardList, MapPin, Clock, Star, CheckCircle2, Play, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTechProfile } from './TechnicianLayout';
import { useToast } from '../../components/Toast';
import CompleteJobModal from './CompleteJobModal';
import RejectBottomSheet from './RejectBottomSheet';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status =
  | 'open' | 'triaged' | 'assigned' | 'accepted'
  | 'in_progress' | 'on_hold' | 'resolved'
  | 'verified' | 'closed' | 'escalated' | 'reopened';

interface ActiveTask {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: Status;
  sla_deadline: string;
  location_apt: string | null;
  flat_number: string | null;
}

interface CompletedTask {
  id: string;
  title: string;
  category: string;
  updated_at: string;
  rating: number | null;
  ratingComment: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const PRIORITY_BAR: Record<Priority, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-400',
  low:      'bg-gray-300',
};

const PRIORITY_LABEL: Record<Priority, { text: string; bg: string; textColor: string }> = {
  critical: { text: 'Critical', bg: 'bg-red-100',    textColor: 'text-red-700'    },
  high:     { text: 'High',     bg: 'bg-orange-100', textColor: 'text-orange-700' },
  medium:   { text: 'Medium',   bg: 'bg-amber-100',  textColor: 'text-amber-700'  },
  low:      { text: 'Low',      bg: 'bg-gray-100',   textColor: 'text-gray-600'   },
};

const STATUS_PILL: Partial<Record<Status, string>> = {
  assigned:    'bg-indigo-100 text-indigo-700',
  accepted:    'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-amber-100 text-amber-700',
};

const CLOSED_STATUSES = ['closed', 'verified', 'resolved'];

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── SLA countdown chip ──────────────────────────────────────────────────────

function useSla(deadline: string) {
  const [label, setLabel] = useState('');
  const [level, setLevel] = useState<'green' | 'amber' | 'red'>('green');
  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setLabel('Overdue'); setLevel('red'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLevel(diff < 2 * 3_600_000 ? 'red' : diff < 6 * 3_600_000 ? 'amber' : 'green');
      if (h >= 48) { const d = Math.floor(h / 24); setLabel(`${d}d ${h % 24}h left`); }
      else if (h >= 1) setLabel(`${h}h ${m}m left`);
      else setLabel(`${m}m left`);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [deadline]);
  return { label, level };
}

function SlaChip({ deadline }: { deadline: string }) {
  const { label, level } = useSla(deadline);
  const styles = {
    red:   'bg-red-100 text-red-700 border border-red-200',
    amber: 'bg-amber-100 text-amber-700 border border-amber-200',
    green: 'bg-green-100 text-green-700 border border-green-200',
  }[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${styles}`}>
      <Clock className="w-3 h-3" />{label}
    </span>
  );
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

function Stars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= score ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'}`}
        />
      ))}
    </div>
  );
}

// ─── Active Task Card ────────────────────────────────────────────────────────

function ActiveTaskCard({
  task, userId, transitioning, onAccept, onReject, onStart, onComplete,
}: {
  task: ActiveTask; userId: string; transitioning: boolean;
  onAccept: (id: string) => void; onReject: (task: ActiveTask) => void;
  onStart: (id: string) => void; onComplete: (id: string) => void;
}) {
  const p = PRIORITY_LABEL[task.priority];
  const bar = PRIORITY_BAR[task.priority];
  const statusPill = STATUS_PILL[task.status] ?? 'bg-gray-100 text-gray-500';
  void userId;

  return (
    <article className="bg-[#FFFFFF] rounded-[16px] shadow-none border border-[#E0DDD9] overflow-hidden flex font-inter">
      <div className={`w-1.5 shrink-0 ${bar}`} />
      <div className="flex-1 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[#1C1917] font-inter">
            {task.title}
            {task.flat_number ? <span className="text-[#6B6560] font-normal"> · {task.flat_number}</span> : null}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[6px] ${p.bg} ${p.textColor}`}>{p.text}</span>
            <span className="text-xs text-[#9C9894]">{task.category}</span>
          </div>
        </div>
        {task.location_apt && (
          <div className="flex items-center gap-1.5 text-xs text-[#6B6560]">
            <MapPin className="w-3.5 h-3.5 text-[#9C9894] shrink-0" />
            <span>{task.location_apt}</span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <SlaChip deadline={task.sla_deadline} />
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-[6px] ${statusPill}`}>
            {formatStatus(task.status)}
          </span>
        </div>
        <div className="pt-1">
          {task.status === 'assigned' && (
            <div className="flex gap-2">
              <button
                id={`jobs-accept-${task.id}`}
                disabled={transitioning}
                onClick={() => onAccept(task.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-[12px] px-[20px] text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 rounded-[10px] transition min-h-[48px]"
              >
                {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" />Accept</>}
              </button>
              <button
                id={`jobs-reject-${task.id}`}
                disabled={transitioning}
                onClick={() => onReject(task)}
                className="flex-1 flex items-center justify-center gap-1.5 py-[12px] px-[20px] text-sm font-bold text-[#1C1917] bg-[#FFFFFF] hover:bg-[#F5F3F0] border border-[#1C1917] disabled:opacity-50 rounded-[10px] transition min-h-[48px]"
              >
                <X className="w-4 h-4" />Reject
              </button>
            </div>
          )}
          {task.status === 'accepted' && (
            <button
              id={`jobs-start-${task.id}`}
              disabled={transitioning}
              onClick={() => onStart(task.id)}
              className="w-full flex items-center justify-center gap-1.5 py-[12px] px-[20px] text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 rounded-[10px] transition min-h-[48px]"
            >
              {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4 fill-white" />Start Job</>}
            </button>
          )}
          {task.status === 'in_progress' && (
            <button
              id={`jobs-complete-${task.id}`}
              disabled={transitioning}
              onClick={() => onComplete(task.id)}
              className="w-full flex items-center justify-center gap-1.5 py-[12px] px-[20px] text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 rounded-[10px] transition min-h-[48px]"
            >
              {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" />Mark Complete</>}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Priority filter chips ────────────────────────────────────────────────────

const FILTER_CHIPS = [
  { value: '', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function loadActive(techId: string): Promise<ActiveTask[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select(`
      id, title, category, priority, status, sla_deadline, flat_number,
      location_apt:apartments!location_apt_id (
        flat_number, floor_number, tower:towers!tower_id ( name )
      )
    `)
    .eq('assigned_tech_id', techId)
    .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
    .order('sla_deadline', { ascending: true });

  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: ActiveTask[] = (data ?? []).map((row: any) => {
    const apt = row.location_apt;
    return {
      id: row.id, title: row.title, category: row.category,
      priority: row.priority, status: row.status, sla_deadline: row.sla_deadline,
      flat_number: row.flat_number,
      location_apt: apt
        ? `${apt.tower?.name ?? ''} · F${apt.floor_number} · ${apt.flat_number}`.trim()
        : null,
    };
  });

  tasks.sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime();
  });
  return tasks;
}

async function loadCompleted(techId: string): Promise<CompletedTask[]> {
  const { data: complaints, error } = await supabase
    .from('complaints')
    .select('id, title, category, updated_at')
    .eq('assigned_tech_id', techId)
    .in('status', ['resolved', 'verified', 'closed'])
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  if (!complaints || complaints.length === 0) return [];

  const ids = complaints.map((c: { id: string }) => c.id);
  const { data: ratings } = await supabase
    .from('ratings')
    .select('complaint_id, score, comment')
    .in('complaint_id', ids);

  const ratingMap = new Map<string, { score: number; comment: string | null }>();
  (ratings ?? []).forEach((r: { complaint_id: string; score: number; comment: string | null }) => {
    ratingMap.set(r.complaint_id, { score: r.score, comment: r.comment });
  });

  return complaints.map((c: { id: string; title: string; category: string; updated_at: string }) => {
    const r = ratingMap.get(c.id);
    return {
      id: c.id, title: c.title, category: c.category, updated_at: c.updated_at,
      rating: r?.score ?? null,
      ratingComment: r?.comment ?? null,
    };
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobsTab() {
  const { profile } = useTechProfile();
  const toast = useToast();

  const [subTab, setSubTab] = useState<'active' | 'completed'>('active');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeTasks, setActiveTasks]     = useState<ActiveTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [transitioning, setTrans]         = useState<Record<string, boolean>>({});

  const [rejectTarget, setRejectTarget]   = useState<ActiveTask | null>(null);
  const [completeTarget, setCompleteTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.techId) return;
    setError('');
    setLoading(true);
    try {
      const [active, completed] = await Promise.all([
        loadActive(profile.techId),
        loadCompleted(profile.techId),
      ]);
      setActiveTasks(active);
      setCompletedTasks(completed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [profile?.techId]);

  useEffect(() => { load(); }, [load]);

  const doStatusUpdate = async (id: string, newStatus: Status, note: string, oldStatus: Status) => {
    if (!profile?.userId) return;
    setTrans((p) => ({ ...p, [id]: true }));
    try {
      await supabase.from('complaints')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      await supabase.from('complaint_logs').insert({
        complaint_id: id, actor_id: profile.userId,
        action: newStatus, old_status: oldStatus, new_status: newStatus, note,
      });
      setActiveTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: newStatus } : t));
    } catch (e: unknown) {
      toast('error', 'Update failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setTrans((p) => ({ ...p, [id]: false }));
    }
  };

  const handleAccept = async (id: string) => {
    const t = activeTasks.find((x) => x.id === id);
    await doStatusUpdate(id, 'accepted', 'Task accepted.', t?.status ?? 'assigned');
    toast('success', 'Task accepted!', '');
  };
  const handleStart = async (id: string) => {
    const t = activeTasks.find((x) => x.id === id);
    await doStatusUpdate(id, 'in_progress', 'Job started.', t?.status ?? 'accepted');
    toast('info', 'Job started!', '');
  };

  const filtered = priorityFilter
    ? activeTasks.filter((t) => t.priority === priorityFilter)
    : activeTasks;

  const completionTask = activeTasks.find((t) => t.id === completeTarget);

  return (
    <div className="min-h-full bg-[#F5F3F0] font-inter pb-24">
      {/* Header */}
      <header className="bg-white px-6 pt-12 pb-0 border-b border-[#E0DDD9] sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#1C1917] mb-4 font-['Space_Grotesk']">My Jobs</h1>

        {/* Sub-tabs */}
        <div className="flex">
          {(['active', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              id={`jobs-tab-${tab}`}
              onClick={() => setSubTab(tab)}
              className={`flex-1 py-3 text-sm font-bold capitalize transition border-b-2 ${
                subTab === tab
                  ? 'text-[#2563EB] border-[#2563EB]'
                  : 'text-[#9C9894] border-transparent hover:text-[#6B6560]'
              }`}
            >
              {tab === 'active' ? `Active (${activeTasks.length})` : `Completed (${completedTasks.length})`}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-4">
        {/* Active sub-tab */}
        {subTab === 'active' && (
          <>
            {/* Priority filter chips */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {FILTER_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => setPriorityFilter(chip.value)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-[10px] text-xs font-bold transition ${
                    priorityFilter === chip.value
                      ? 'bg-[#2563EB] text-[#FFFFFF] shadow-none'
                      : 'bg-[#FFFFFF] text-[#6B6560] border border-[#E0DDD9]'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
            ) : error ? (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-16 h-16 rounded-[16px] bg-[#EFF6FF] flex items-center justify-center">
                  <ClipboardList className="w-8 h-8 text-[#2563EB]" />
                </div>
                <p className="text-sm font-bold text-[#1C1917] font-['Space_Grotesk']">No active tasks</p>
                <p className="text-xs text-[#9C9894]">{priorityFilter ? `No ${priorityFilter} priority tasks` : 'All done for now!'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((task) => (
                  <ActiveTaskCard
                    key={task.id}
                    task={task}
                    userId={profile?.userId ?? ''}
                    transitioning={!!transitioning[task.id]}
                    onAccept={handleAccept}
                    onReject={(t) => setRejectTarget(t)}
                    onStart={handleStart}
                    onComplete={(id) => setCompleteTarget(id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Completed sub-tab */}
        {subTab === 'completed' && (
          <>
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
            ) : completedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-300" />
                </div>
                <p className="text-sm font-bold text-gray-600">No completed jobs yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <article key={task.id} className="bg-[#FFFFFF] rounded-[16px] shadow-none border border-[#E0DDD9] p-4 font-inter">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[#1C1917] font-inter truncate">{task.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[#9C9894]">{task.category}</span>
                          <span className="w-1 h-1 rounded-full bg-[#E0DDD9]" />
                          <span className="text-xs text-[#9C9894]">{fmtDate(task.updated_at)}</span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                    </div>
                    {task.rating !== null && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <Stars score={task.rating} />
                        {task.ratingComment && (
                          <p className="text-xs text-gray-500 mt-1 italic">"{task.ratingComment}"</p>
                        )}
                      </div>
                    )}
                    {task.rating === null && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <p className="text-[11px] text-gray-300 italic">No rating yet</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {rejectTarget && profile && (
        <RejectBottomSheet
          complaintId={rejectTarget.id}
          techId={profile.techId}
          userId={profile.userId}
          onClose={() => setRejectTarget(null)}
          onRejected={() => { setActiveTasks((p) => p.filter((t) => t.id !== rejectTarget.id)); toast('info', 'Task rejected', ''); }}
          onError={(msg) => toast('error', 'Rejection failed', msg)}
        />
      )}
      {completeTarget && completionTask && profile && (
        <CompleteJobModal
          complaintId={completeTarget}
          complaintTitle={completionTask.title}
          onClose={() => setCompleteTarget(null)}
          onResolved={() => { load(); }}
          onError={(msg) => toast('error', 'Submission failed', msg)}
        />
      )}
    </div>
  );
}
