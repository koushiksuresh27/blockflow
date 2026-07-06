import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, AlertCircle, LogOut, RefreshCw,
  ClipboardList, MapPin, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import CompletionModal from '../components/CompletionModal';
import { useToast } from '../components/Toast';

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
  location_apt?: string | null; // flat label e.g. "Tower A / F3 / 301"
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<Priority, { bg: string; dot: string; label: string }> = {
  low:      { bg: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400',   label: 'Low'      },
  medium:   { bg: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-400', label: 'Medium'   },
  high:     { bg: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500', label: 'High'     },
  critical: { bg: 'bg-red-50 text-red-700',       dot: 'bg-red-600',    label: 'Critical' },
};

const STATUS_PILL: Partial<Record<Status, string>> = {
  assigned:    'bg-indigo-50 text-indigo-700',
  accepted:    'bg-cyan-50 text-cyan-700',
  in_progress: 'bg-amber-50 text-amber-700',
  on_hold:     'bg-gray-100 text-gray-500',
  escalated:   'bg-rose-50 text-rose-700',
};

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Returns a human-readable countdown string, e.g. "6h 20m remaining" or "2d 3h remaining" */
function useCountdown(deadline: string) {
  const [label, setLabel] = useState('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setLabel('Overdue');
        setUrgent(true);
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setUrgent(diff < 2 * 3_600_000);
      if (h >= 48) {
        const d = Math.floor(h / 24);
        setLabel(`${d}d ${h % 24}h remaining`);
      } else if (h >= 1) {
        setLabel(`${h}h ${m}m remaining`);
      } else {
        setLabel(`${m}m remaining`);
      }
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [deadline]);

  return { label, urgent };
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

const CLOSED_STATUSES = ['closed', 'verified', 'resolved'];

async function loadTechnicianTasks(userId: string): Promise<{ techId: string; tasks: Task[] }> {
  // 1. Get technician row for this user
  const { data: techRow, error: techErr } = await supabase
    .from('technicians')
    .select('id')
    .eq('user_id', userId)
    .single();
  if (techErr || !techRow) throw new Error('No technician profile found for this account.');

  // 2. Fetch assigned complaints (not closed/verified/resolved)
  const { data, error } = await supabase
    .from('complaints')
    .select(`
      id, title, category, priority, status, sla_deadline,
      location_apt:apartments!location_apt_id (
        flat_number, floor_number,
        tower:towers!tower_id ( name )
      )
    `)
    .eq('assigned_tech_id', techRow.id)
    .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
    .order('sla_deadline', { ascending: true });

  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: Task[] = (data ?? []).map((row: any) => {
    const apt = row.location_apt;
    const locationLabel = apt
      ? `${apt.tower?.name ?? ''} · F${apt.floor_number} · ${apt.flat_number}`.trim()
      : null;
    return {
      id:           row.id,
      title:        row.title,
      category:     row.category,
      priority:     row.priority,
      status:       row.status,
      sla_deadline: row.sla_deadline,
      location_apt: locationLabel,
    };
  });

  return { techId: techRow.id, tasks };
}

async function updateStatus(
  complaintId: string,
  actorId: string,
  newStatus: Status,
  note: string,
  oldStatus: Status,
) {
  const { error: upErr } = await supabase
    .from('complaints')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', complaintId);
  if (upErr) throw new Error(upErr.message);

  await supabase.from('complaint_logs').insert({
    complaint_id: complaintId,
    actor_id:     actorId,
    action:       newStatus,
    old_status:   oldStatus,
    new_status:   newStatus,
    note,
  });
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function Countdown({ deadline }: { deadline: string }) {
  const { label, urgent } = useCountdown(deadline);
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${urgent ? 'text-red-600' : 'text-gray-500'}`}>
      <Clock className="w-3 h-3 flex-shrink-0" />
      {label}
    </span>
  );
}

function TaskCard({
  task,
  transitioning,
  onStatusChange,
  onOpenCompletion,
}: {
  task: Task;
  transitioning: boolean;
  onStatusChange: (id: string, status: Status) => void;
  onOpenCompletion: (id: string) => void;
}) {
  const p = PRIORITY_BADGE[task.priority];
  const statusPill = STATUS_PILL[task.status] ?? 'bg-gray-100 text-gray-500';

  const actionBtn = (() => {
    if (task.status === 'assigned')    return { label: 'Accept Task',    next: 'accepted'    as Status, note: 'Task accepted by technician.'   };
    if (task.status === 'accepted')    return { label: 'Start Job',      next: 'in_progress' as Status, note: 'Job started by technician.'      };
    if (task.status === 'in_progress') return null; // completion modal
    return null;
  })();

  return (
    <article className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Priority stripe */}
      <div className={`h-1 w-full ${p.dot}`} />

      <div className="p-4 space-y-3">
        {/* Title + category */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 leading-snug">{task.title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{task.category}</p>
        </div>

        {/* Location */}
        {task.location_apt && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{task.location_apt}</span>
          </div>
        )}

        {/* Badges row */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Priority */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${p.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
            {p.label}
          </span>
          {/* Status */}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusPill}`}>
            {formatStatus(task.status)}
          </span>
          {/* Countdown */}
          <Countdown deadline={task.sla_deadline} />
        </div>

        {/* Action */}
        <div className="pt-1">
          {actionBtn ? (
            <button
              id={`action-${task.id}`}
              disabled={transitioning}
              onClick={() => onStatusChange(task.id, actionBtn.next)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl transition"
            >
              {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : actionBtn.label}
            </button>
          ) : task.status === 'in_progress' ? (
            <button
              id={`complete-${task.id}`}
              disabled={transitioning}
              onClick={() => onOpenCompletion(task.id)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 rounded-xl transition"
            >
              {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark Complete'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [userId, setUserId]           = useState<string | null>(null);
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [transitioning, setTrans]     = useState<Record<string, boolean>>({});
  const [completionTarget, setCompletion] = useState<string | null>(null);

  // Store userId in a ref so realtime callback can access it without stale closure
  const userIdRef = useRef<string | null>(null);

  const load = useCallback(async (uid: string) => {
    setError('');
    try {
      const { tasks: rows } = await loadTechnicianTasks(uid);
      setTasks(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);
      userIdRef.current = user.id;
      load(user.id);
    });
  }, [load, navigate]);

  // Realtime: refresh list when a complaint assigned to this tech changes
  useEffect(() => {
    const channel = supabase
      .channel('tech-dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
        if (userIdRef.current) load(userIdRef.current);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const handleStatusChange = async (complaintId: string, nextStatus: Status) => {
    if (!userId) return;
    setTrans((p) => ({ ...p, [complaintId]: true }));
    const task = tasks.find((t) => t.id === complaintId);
    const noteMap: Record<string, string> = {
      accepted:    'Task accepted by technician.',
      in_progress: 'Job started by technician.',
    };
    try {
      await updateStatus(complaintId, userId, nextStatus, noteMap[nextStatus] ?? '', task?.status ?? 'assigned');
      setTasks((prev) => prev.map((t) => t.id === complaintId ? { ...t, status: nextStatus } : t));
      toast('success', 'Status updated', `Task moved to "${formatStatus(nextStatus)}".`);
    } catch (e: unknown) {
      toast('error', 'Update failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setTrans((p) => ({ ...p, [complaintId]: false }));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const completionTask = tasks.find((t) => t.id === completionTarget);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-[480px] mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center">
              <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-sm font-bold text-gray-900">My Tasks</span>
            {!loading && (
              <span className="text-xs text-gray-400 font-medium">({tasks.length})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => userId && load(userId)}
              disabled={loading}
              aria-label="Refresh"
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-[480px] mx-auto px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-28">
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mt-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Failed to load tasks</p>
              <p className="mt-0.5 text-xs">{error}</p>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-gray-400">
            <ClipboardList className="w-10 h-10 text-gray-200" />
            <p className="text-sm font-medium">No active tasks assigned to you</p>
            <p className="text-xs text-center max-w-[240px]">
              When complaints are assigned to you, they'll appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                transitioning={!!transitioning[task.id]}
                onStatusChange={handleStatusChange}
                onOpenCompletion={setCompletion}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Completion Modal ── */}
      {completionTarget && completionTask && (
        <CompletionModal
          complaintId={completionTarget}
          complaintTitle={completionTask.title}
          onClose={() => setCompletion(null)}
          onResolved={() => {
            setTasks((prev) => prev.filter((t) => t.id !== completionTarget));
            toast('success', 'Task resolved', 'Completion submitted successfully.');
          }}
          onError={(msg) => toast('error', 'Submission failed', msg)}
        />
      )}
    </div>
  );
}
