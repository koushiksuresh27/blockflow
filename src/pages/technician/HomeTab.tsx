import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Loader2, AlertCircle, ClipboardList, MapPin, Clock, CheckCircle2, AlertTriangle, Play, X } from 'lucide-react';
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

interface Task {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: Status;
  sla_deadline: string;
  location_apt: string | null;
}

interface Stats {
  todayTasks: number;
  completedToday: number;
  slaRisk: number;
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
  on_hold:     'bg-gray-100 text-gray-500',
  escalated:   'bg-rose-100 text-rose-700',
};

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const CLOSED_STATUSES = ['closed', 'verified', 'resolved'];

// ─── SLA Countdown ───────────────────────────────────────────────────────────

function useSlaCountdown(deadline: string) {
  const [label, setLabel] = useState('');
  const [level, setLevel] = useState<'green' | 'amber' | 'red'>('green');

  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setLabel('Overdue');
        setLevel('red');
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLevel(diff < 2 * 3_600_000 ? 'red' : diff < 6 * 3_600_000 ? 'amber' : 'green');
      if (h >= 48) {
        const d = Math.floor(h / 24);
        setLabel(`${d}d ${h % 24}h left`);
      } else if (h >= 1) {
        setLabel(`${h}h ${m}m left`);
      } else {
        setLabel(`${m}m left`);
      }
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [deadline]);

  return { label, level };
}

function SlaChip({ deadline }: { deadline: string }) {
  const { label, level } = useSlaCountdown(deadline);
  const styles = {
    red:   'bg-red-100 text-red-700 border border-red-200',
    amber: 'bg-amber-100 text-amber-700 border border-amber-200',
    green: 'bg-green-100 text-green-700 border border-green-200',
  }[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${styles}`}>
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Greeting ────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  userId,
  techId,
  transitioning,
  onAccept,
  onReject,
  onStart,
  onComplete,
}: {
  task: Task;
  userId: string;
  techId: string;
  transitioning: boolean;
  onAccept: (id: string) => void;
  onReject: (task: Task) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const p = PRIORITY_LABEL[task.priority];
  const bar = PRIORITY_BAR[task.priority];
  const statusPill = STATUS_PILL[task.status] ?? 'bg-gray-100 text-gray-500';

  // Suppress linting warning
  void userId; void techId;

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex">
      {/* Priority left bar */}
      <div className={`w-1.5 shrink-0 ${bar}`} />

      <div className="flex-1 p-4 space-y-3">
        {/* Title + category */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 leading-snug">{task.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.bg} ${p.textColor}`}>
              {p.text}
            </span>
            <span className="text-xs text-gray-400">{task.category}</span>
          </div>
        </div>

        {/* Location */}
        {task.location_apt && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{task.location_apt}</span>
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <SlaChip deadline={task.sla_deadline} />
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusPill}`}>
            {formatStatus(task.status)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="pt-1">
          {task.status === 'assigned' && (
            <div className="flex gap-2">
              <button
                id={`accept-${task.id}`}
                disabled={transitioning}
                onClick={() => onAccept(task.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition min-h-[48px]"
              >
                {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <><CheckCircle2 className="w-4 h-4" />Accept</>
                )}
              </button>
              <button
                id={`reject-${task.id}`}
                disabled={transitioning}
                onClick={() => onReject(task)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50 rounded-xl transition min-h-[48px]"
              >
                <X className="w-4 h-4" />Reject
              </button>
            </div>
          )}
          {task.status === 'accepted' && (
            <button
              id={`start-${task.id}`}
              disabled={transitioning}
              onClick={() => onStart(task.id)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-bold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-xl transition min-h-[48px]"
            >
              {transitioning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Play className="w-4 h-4 fill-white" />Start Job</>
              )}
            </button>
          )}
          {task.status === 'in_progress' && (
            <button
              id={`complete-${task.id}`}
              disabled={transitioning}
              onClick={() => onComplete(task.id)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-xl transition min-h-[48px]"
            >
              {transitioning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><CheckCircle2 className="w-4 h-4" />Mark Complete</>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, accent, icon: Icon,
}: {
  label: string; value: number;
  accent: string; icon: React.ElementType;
}) {
  return (
    <div className={`flex-1 rounded-2xl p-3.5 ${accent}`}>
      <Icon className="w-5 h-5 mb-2 opacity-70" />
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="text-[11px] font-medium mt-1 opacity-80 leading-tight">{label}</p>
    </div>
  );
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function loadHomeData(techId: string): Promise<{ tasks: Task[]; stats: Stats }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  const twoHoursFromNow = new Date(Date.now() + 2 * 3_600_000).toISOString();

  // Active tasks
  const { data: taskData, error: taskErr } = await supabase
    .from('complaints')
    .select(`
      id, title, category, priority, status, sla_deadline,
      location_apt:apartments!location_apt_id (
        flat_number, floor_number,
        tower:towers!tower_id ( name )
      )
    `)
    .eq('assigned_tech_id', techId)
    .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
    .order('sla_deadline', { ascending: true });

  if (taskErr) throw new Error(taskErr.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: Task[] = (taskData ?? []).map((row: any) => {
    const apt = row.location_apt;
    return {
      id:           row.id,
      title:        row.title,
      category:     row.category,
      priority:     row.priority,
      status:       row.status,
      sla_deadline: row.sla_deadline,
      location_apt: apt
        ? `${apt.tower?.name ?? ''} · F${apt.floor_number} · ${apt.flat_number}`.trim()
        : null,
    };
  });

  // Sort: critical first, then by SLA deadline
  tasks.sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime();
  });

  // Stats queries
  const [{ count: completedCount }, { count: slaCount }] = await Promise.all([
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_tech_id', techId)
      .in('status', ['resolved', 'verified', 'closed'])
      .gte('updated_at', todayISO),
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_tech_id', techId)
      .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
      .lt('sla_deadline', twoHoursFromNow),
  ]);

  const stats: Stats = {
    todayTasks:     tasks.length,
    completedToday: completedCount ?? 0,
    slaRisk:        slaCount ?? 0,
  };

  return { tasks, stats };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomeTab() {
  const { profile } = useTechProfile();
  const toast = useToast();

  const [tasks, setTasks]       = useState<Task[]>([]);
  const [stats, setStats]       = useState<Stats>({ todayTasks: 0, completedToday: 0, slaRisk: 0 });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [transitioning, setTrans] = useState<Record<string, boolean>>({});

  // Modals
  const [rejectTarget, setRejectTarget]   = useState<Task | null>(null);
  const [completeTarget, setCompleteTarget] = useState<string | null>(null);

  const techIdRef = useRef<string | null>(null);
  if (profile?.techId) techIdRef.current = profile.techId;

  const load = useCallback(async () => {
    const tid = techIdRef.current;
    if (!tid) return;
    setError('');
    try {
      const data = await loadHomeData(tid);
      setTasks(data.tasks);
      setStats(data.stats);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.techId) {
      techIdRef.current = profile.techId;
      load();
    }
  }, [profile, load]);

  // Realtime refresh
  useEffect(() => {
    const channel = supabase
      .channel('tech-home-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
        if (techIdRef.current) load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // ── Action Handlers ──────────────────────────────────────────────────────────

  const doStatusUpdate = async (
    complaintId: string,
    newStatus: Status,
    note: string,
    oldStatus: Status,
  ) => {
    if (!profile?.userId) return;
    setTrans((p) => ({ ...p, [complaintId]: true }));
    try {
      const { error: upErr } = await supabase
        .from('complaints')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', complaintId);
      if (upErr) throw new Error(upErr.message);

      await supabase.from('complaint_logs').insert({
        complaint_id: complaintId,
        actor_id:     profile.userId,
        action:       newStatus,
        old_status:   oldStatus,
        new_status:   newStatus,
        note,
      });

      setTasks((prev) =>
        prev.map((t) => t.id === complaintId ? { ...t, status: newStatus } : t)
      );
    } catch (e: unknown) {
      toast('error', 'Update failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setTrans((p) => ({ ...p, [complaintId]: false }));
    }
  };

  const handleAccept = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    await doStatusUpdate(id, 'accepted', 'Task accepted by technician.', task?.status ?? 'assigned');
    toast('success', 'Task accepted!', 'You have accepted this task.');
  };

  const handleStart = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    await doStatusUpdate(id, 'in_progress', 'Job started by technician.', task?.status ?? 'accepted');
    toast('info', 'Job started!', 'Upload a before photo to document the issue.');
  };

  const completionTask = tasks.find((t) => t.id === completeTarget);

  if (!profile) return null;

  return (
    <div className="min-h-full bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-blue-600 px-5 pt-8 pb-16 relative overflow-hidden">
        {/* Decorative circle */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-blue-500 opacity-40" />
        <div className="absolute top-4 right-12 w-20 h-20 rounded-full bg-blue-400 opacity-30" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">{getGreeting()},</p>
            <h1 className="text-white text-2xl font-black mt-0.5 leading-tight">
              {profile.name.split(' ')[0]}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="notification-bell"
              aria-label="Notifications"
              className="w-10 h-10 rounded-full bg-blue-500/50 flex items-center justify-center hover:bg-blue-500 transition"
            >
              <Bell className="w-5 h-5 text-white" />
            </button>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
              <span className="text-white text-sm font-bold">{getInitials(profile.name)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Stats Cards (overlap header) ── */}
      <div className="px-4 -mt-10 relative z-10">
        <div className="flex gap-3">
          <StatCard
            label="Today's Tasks"
            value={stats.todayTasks}
            accent="bg-white text-blue-700 shadow-sm border border-blue-100"
            icon={ClipboardList}
          />
          <StatCard
            label="Completed"
            value={stats.completedToday}
            accent="bg-green-500 text-white shadow-sm"
            icon={CheckCircle2}
          />
          <StatCard
            label="SLA Risk"
            value={stats.slaRisk}
            accent={stats.slaRisk > 0 ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-gray-600 shadow-sm border border-gray-100'}
            icon={AlertTriangle}
          />
        </div>
      </div>

      {/* ── Task Queue ── */}
      <div className="px-4 mt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">Task Queue</h2>
          {!loading && (
            <span className="text-xs text-gray-400 font-medium">{tasks.length} active</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Failed to load tasks</p>
              <p className="mt-0.5 text-xs">{error}</p>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <ClipboardList className="w-8 h-8 text-blue-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-700">All clear!</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                No active tasks assigned to you right now.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                userId={profile.userId}
                techId={profile.techId}
                transitioning={!!transitioning[task.id]}
                onAccept={handleAccept}
                onReject={(t) => setRejectTarget(t)}
                onStart={handleStart}
                onComplete={(id) => setCompleteTarget(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Reject Bottom Sheet ── */}
      {rejectTarget && (
        <RejectBottomSheet
          complaintId={rejectTarget.id}
          techId={profile.techId}
          userId={profile.userId}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            setTasks((prev) => prev.filter((t) => t.id !== rejectTarget.id));
            toast('info', 'Task rejected', 'The task has been returned to the pool.');
            load();
          }}
          onError={(msg) => toast('error', 'Rejection failed', msg)}
        />
      )}

      {/* ── Complete Job Modal ── */}
      {completeTarget && completionTask && (
        <CompleteJobModal
          complaintId={completeTarget}
          complaintTitle={completionTask.title}
          onClose={() => setCompleteTarget(null)}
          onResolved={() => {
            setTasks((prev) => prev.filter((t) => t.id !== completeTarget));
            load();
          }}
          onError={(msg) => toast('error', 'Submission failed', msg)}
        />
      )}
    </div>
  );
}
