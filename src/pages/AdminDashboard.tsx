import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AdminLayout from '../components/AdminLayout';
import AssignTechnicianModal from '../components/AssignTechnicianModal';
import { useToast } from '../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status =
  | 'open' | 'triaged' | 'assigned' | 'accepted'
  | 'in_progress' | 'on_hold' | 'resolved'
  | 'verified' | 'closed' | 'escalated' | 'reopened';

interface Complaint {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: Status;
  sla_deadline: string;
  created_at: string;
  updated_at: string;
  submitted_by_name: string;
  assigned_tech_name: string | null;
  assigned_tech_id: string | null;
  // local-only field for optimistic assign update
  _assignedLocally?: string;
}

interface AssignTarget {
  complaintId: string;
  category: string;
}

interface Metrics {
  open: number;
  inProgress: number;
  overdue: number;
  resolvedToday: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<Priority, string> = {
  low:      'bg-gray-100 text-gray-600 border-gray-200',
  medium:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  high:     'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const PRIORITY_DOT: Record<Priority, string> = {
  low: 'bg-gray-400', medium: 'bg-yellow-400', high: 'bg-orange-500', critical: 'bg-red-600',
};

const STATUS_PILL: Record<Status, string> = {
  open:        'bg-blue-50 text-blue-700',
  triaged:     'bg-purple-50 text-purple-700',
  assigned:    'bg-indigo-50 text-indigo-700',
  accepted:    'bg-cyan-50 text-cyan-700',
  in_progress: 'bg-amber-50 text-amber-700',
  on_hold:     'bg-gray-100 text-gray-600',
  resolved:    'bg-green-50 text-green-700',
  verified:    'bg-teal-50 text-teal-700',
  closed:      'bg-gray-200 text-gray-500',
  escalated:   'bg-rose-50 text-rose-700',
  reopened:    'bg-orange-50 text-orange-700',
};

function slaClass(deadline: string, status: Status): string {
  if (['closed', 'verified'].includes(status)) return 'text-gray-400';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return 'text-red-600 font-semibold';
  if (diff < 2 * 60 * 60 * 1000) return 'text-amber-600 font-semibold';
  return 'text-gray-600';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function fetchComplaints(): Promise<Complaint[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select(`
      id, title, category, priority, status,
      sla_deadline, created_at, updated_at,
      assigned_tech_id,
      submitted_user:users!submitted_by ( name ),
      assigned_tech:technicians!assigned_tech_id (
        id,
        tech_user:users!user_id ( name )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id:                 row.id,
    title:              row.title,
    category:           row.category,
    priority:           row.priority,
    status:             row.status,
    sla_deadline:       row.sla_deadline,
    created_at:         row.created_at,
    updated_at:         row.updated_at,
    assigned_tech_id:   row.assigned_tech_id,
    submitted_by_name:  row.submitted_user?.name ?? '—',
    assigned_tech_name: row.assigned_tech?.tech_user?.name ?? null,
  }));
}



function computeMetrics(complaints: Complaint[]): Metrics {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = Date.now();

  return {
    open: complaints.filter((c) => ['open', 'triaged'].includes(c.status)).length,
    inProgress: complaints.filter((c) => ['in_progress', 'accepted'].includes(c.status)).length,
    overdue: complaints.filter((c) =>
      !['closed', 'verified'].includes(c.status) &&
      new Date(c.sla_deadline).getTime() < now
    ).length,
    resolvedToday: complaints.filter((c) =>
      c.status === 'closed' &&
      new Date(c.updated_at).getTime() >= today.getTime()
    ).length,
  };
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, color, loading,
}: { label: string; value: number; color: string; loading: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      {loading ? (
        <div className="h-8 w-16 bg-gray-100 rounded animate-pulse mt-1" />
      ) : (
        <p className={`text-3xl font-bold tracking-tight ${color}`}>{value}</p>
      )}
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const toast = useToast();
  const [complaints, setComplaints]   = useState<Complaint[]>([]);
  const [metrics, setMetrics]         = useState<Metrics>({ open: 0, inProgress: 0, overdue: 0, resolvedToday: 0 });
  const [societyId, setSocietyId]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('users')
        .select('society_id')
        .eq('id', user.id)
        .single();

      setSocietyId(profile?.society_id ?? null);

      const rows = await fetchComplaints();
      setComplaints(rows);
      setMetrics(computeMetrics(rows));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Realtime subscription — re-fetch on any complaint change
  useEffect(() => {
    const channel = supabase
      .channel('admin-complaints-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const METRIC_CARDS = [
    { label: 'Open Complaints', value: metrics.open,         color: 'text-blue-600'  },
    { label: 'In Progress',     value: metrics.inProgress,   color: 'text-amber-600' },
    { label: 'Overdue',         value: metrics.overdue,      color: 'text-red-600'   },
    { label: 'Resolved Today',  value: metrics.resolvedToday, color: 'text-green-600' },
  ];

  return (
    <AdminLayout>
      <div className="px-8 py-8 max-w-screen-xl mx-auto">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Real-time overview of all complaints</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {METRIC_CARDS.map((m) => (
            <MetricCard key={m.label} loading={loading} {...m} />
          ))}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-center gap-2 p-3.5 mb-5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Complaints table ── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">
              All Complaints
              <span className="ml-2 text-xs font-normal text-gray-400">({complaints.length})</span>
            </p>
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
              Live
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : complaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
              <ClipboardEmpty />
              <p className="text-sm">No complaints yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['ID', 'Title', 'Category', 'Priority', 'Status', 'Submitted By', 'Assigned To', 'SLA Deadline', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {complaints.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition-colors group">
                      {/* ID */}
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-400 whitespace-nowrap">
                        {c.id.slice(0, 8)}…
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <p className="font-medium text-gray-900 truncate" title={c.title}>{c.title}</p>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{c.category}</td>

                      {/* Priority badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_BADGE[c.priority]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[c.priority]}`} />
                          {c.priority.charAt(0).toUpperCase() + c.priority.slice(1)}
                        </span>
                      </td>

                      {/* Status pill */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {formatStatus(c.status)}
                        </span>
                      </td>

                      {/* Submitted By */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{c.submitted_by_name}</td>

                      {/* Assigned To */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {c.assigned_tech_name
                          ? <span className="text-gray-700">{c.assigned_tech_name}</span>
                          : <span className="text-gray-300 text-xs">Unassigned</span>
                        }
                      </td>

                      {/* SLA Deadline */}
                      <td className={`px-4 py-3.5 whitespace-nowrap text-xs ${slaClass(c.sla_deadline, c.status)}`}>
                        {formatDate(c.sla_deadline)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setAssignTarget({ complaintId: c.id, category: c.category })}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                          >
                            Assign
                          </button>
                          <Link
                            to={`/complaints/${c.id}`}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Assign Modal ── */}
      {assignTarget && societyId && (
        <AssignTechnicianModal
          complaintId={assignTarget.complaintId}
          complaintCategory={assignTarget.category}
          societyId={societyId}
          onClose={() => setAssignTarget(null)}
          onAssigned={(techName) => {
            // Optimistic local update — realtime will also sync
            setComplaints((prev) =>
              prev.map((c) =>
                c.id === assignTarget.complaintId
                  ? { ...c, assigned_tech_name: techName, status: 'assigned' as Status }
                  : c
              )
            );
            toast('success', 'Technician assigned', `Complaint assigned to ${techName}.`);
          }}
          onError={(msg) => toast('error', 'Assignment failed', msg)}
        />
      )}
    </AdminLayout>
  );
}

// Tiny empty-state icon
function ClipboardEmpty() {
  return (
    <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
