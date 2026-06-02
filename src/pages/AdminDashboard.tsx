import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AdminLayout from '../components/AdminLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status =
  | 'open' | 'triaged' | 'assigned' | 'accepted'
  | 'in_progress' | 'on_hold' | 'resolved'
  | 'verified' | 'closed' | 'escalated' | 'reopened';

interface BreachComplaint {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: Status;
  sla_deadline: string;
  assigned_tech_name: string | null;
  hoursOverdue: number;
}

interface TechLeader {
  id: string;
  name: string;
  performance_score: number;
  avg_rating: number;
  completed_jobs: number;
  sla_compliance: number;
}

interface ActivityEntry {
  id: string;
  action: string;
  note: string | null;
  complaint_title: string;
  actor_name: string;
  created_at: string;
}

interface DashMetrics {
  pendingResidents: number;
  openComplaints: number;
  slaBreachesThisMonth: number;
  avgTechRating: number;
  equipmentCritical: number;
  maintenanceOverdue: number;
  housekeepingDueToday: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<Priority, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
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

function fmt(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Stars({ score, size = 'sm' }: { score: number; size?: 'sm' | 'xs' }) {
  const filled = Math.round((score / 100) * 5);
  const sz = size === 'xs' ? 'text-[10px]' : 'text-xs';
  return (
    <span className={`flex gap-0.5 ${sz}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < filled ? 'text-amber-400' : 'text-surface-container-highest'}>★</span>
      ))}
    </span>
  );
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function fetchDashboard(societyId: string | null) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const nowIso = now.toISOString();

  const queries = await Promise.all([
    // 1. Pending residents
    supabase.from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'resident')
      .eq('status', 'pending')
      .eq('society_id', societyId ?? ''),

    // 2. Open complaints
    supabase.from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? '')
      .in('status', ['open', 'triaged', 'assigned', 'accepted', 'in_progress']),

    // 3. SLA breaches this month
    supabase.from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? '')
      .not('status', 'in', '("closed","verified")')
      .lt('sla_deadline', nowIso)
      .gte('created_at', startOfMonth),

    // 4. Avg technician rating
    supabase.from('ratings').select('score'),

    // 5. SLA breach list
    supabase.from('complaints')
      .select(`
        id, title, category, priority, status, sla_deadline,
        assigned_tech:technicians!assigned_tech_id(
          tech_user:users!user_id(name)
        )
      `)
      .eq('society_id', societyId ?? '')
      .not('status', 'in', '("closed","verified")')
      .lt('sla_deadline', nowIso)
      .order('sla_deadline', { ascending: true })
      .limit(20),

    // 6. Technician leaderboard
    supabase.from('technicians')
      .select(`
        id, performance_score, specializations,
        tech_user:users!user_id(name),
        completed:complaints!assigned_tech_id(status, sla_deadline, updated_at),
        ratings_data:ratings!technician_id(score)
      `)
      .eq('society_id', societyId ?? '')
      .order('performance_score', { ascending: false })
      .limit(10),

    // 7. Activity feed
    supabase.from('complaint_logs')
      .select(`
        id, action, note, created_at,
        complaint:complaints!complaint_id(title),
        actor:users!actor_id(name)
      `)
      .order('created_at', { ascending: false })
      .limit(20),

    // 8. Equipment critical count
    supabase.from('equipment')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? '')
      .eq('status', 'critical'),

    // 9. Maintenance overdue count
    supabase.from('maintenance_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? '')
      .not('status', 'eq', 'completed')
      .lt('next_due', nowIso),

    // 10. Housekeeping tasks due today
    supabase.from('housekeeping_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? '')
      .not('status', 'eq', 'completed')
      .lt('next_due', new Date(now.setHours(23, 59, 59, 999)).toISOString()),
  ]);

  const [
    { count: pendingResidents },
    { count: openComplaints },
    { count: slaBreachesThisMonth },
    { data: ratingsData },
    { data: breachRaw },
    { data: techRaw },
    { data: activityRaw },
    { count: equipmentCritical },
    { count: maintenanceOverdue },
    { count: housekeepingDueToday },
  ] = queries;

  // Avg rating
  const scores = (ratingsData ?? []).map((r: { score: number }) => r.score);
  const avgTechRating = scores.length > 0
    ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
    : 0;

  const metrics: DashMetrics = {
    pendingResidents: pendingResidents ?? 0,
    openComplaints: openComplaints ?? 0,
    slaBreachesThisMonth: slaBreachesThisMonth ?? 0,
    avgTechRating,
    equipmentCritical: equipmentCritical ?? 0,
    maintenanceOverdue: maintenanceOverdue ?? 0,
    housekeepingDueToday: housekeepingDueToday ?? 0,
  };

  // SLA breach list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breachList: BreachComplaint[] = (breachRaw ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    priority: r.priority,
    status: r.status,
    sla_deadline: r.sla_deadline,
    assigned_tech_name: r.assigned_tech?.tech_user?.name ?? null,
    hoursOverdue: Math.floor((Date.now() - new Date(r.sla_deadline).getTime()) / 3600000),
  }));

  // Leaderboard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leaderboard: TechLeader[] = (techRaw ?? []).map((r: any) => {
    const completed = (r.completed ?? []).filter((c: { status: string }) =>
      ['closed', 'verified', 'resolved'].includes(c.status));
    const slaCompliant = completed.filter((c: { sla_deadline: string; updated_at: string }) =>
      new Date(c.updated_at).getTime() <= new Date(c.sla_deadline).getTime()).length;
    const rScores: number[] = (r.ratings_data ?? []).map((x: { score: number }) => x.score);
    const avgRating = rScores.length > 0 ? rScores.reduce((a: number, b: number) => a + b, 0) / rScores.length : 0;
    return {
      id: r.id,
      name: r.tech_user?.name ?? 'Unknown',
      performance_score: r.performance_score ?? 0,
      avg_rating: avgRating,
      completed_jobs: completed.length,
      sla_compliance: completed.length > 0 ? Math.round((slaCompliant / completed.length) * 100) : 0,
    };
  });

  // Activity feed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activity: ActivityEntry[] = (activityRaw ?? []).map((r: any) => ({
    id: r.id,
    action: r.action,
    note: r.note,
    complaint_title: r.complaint?.title ?? '—',
    actor_name: r.actor?.name ?? 'System',
    created_at: r.created_at,
  }));

  return { metrics, breachList, leaderboard, activity };
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, icon, accent, sub, loading,
}: {
  label: string;
  value: string | number;
  icon: string;
  accent: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
      <div className={`absolute -right-3 -top-3 opacity-[0.06] ${accent}`}>
        <span className="material-symbols-outlined text-[100px]">{icon}</span>
      </div>
      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-3">{label}</p>
      {loading ? (
        <div className="h-9 w-16 bg-surface-variant/20 rounded-lg animate-pulse mt-1" />
      ) : (
        <h3 className={`font-headline-md text-headline-md ${accent}`}>{value}</h3>
      )}
      {sub && <p className="font-label-sm text-label-sm text-on-surface-variant/60 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashMetrics>({
    pendingResidents: 0, openComplaints: 0, slaBreachesThisMonth: 0, avgTechRating: 0,
    equipmentCritical: 0, maintenanceOverdue: 0, housekeepingDueToday: 0
  });
  const [breachList, setBreachList] = useState<BreachComplaint[]>([]);
  const [leaderboard, setLeaderboard] = useState<TechLeader[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

      const sid = profile?.society_id ?? null;


      const result = await fetchDashboard(sid);
      setMetrics(result.metrics);
      setBreachList(result.breachList);
      setLeaderboard(result.leaderboard);
      setActivity(result.activity);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription — refresh on complaint or user changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaint_logs' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return (
    <AdminLayout>
      <div className="px-margin-desktop py-10 max-w-screen-2xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Monitoring Dashboard</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Real-time overview of your society's maintenance operations.</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-xl hover:bg-surface-variant/20 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-error-container/20 border border-error-container/40 rounded-2xl text-sm text-error">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Row 1: Metric Cards ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            label="Pending Approvals"
            value={metrics.pendingResidents}
            icon="pending_actions"
            accent="text-amber-400"
            sub="Residents awaiting review"
            loading={loading}
          />
          <MetricCard
            label="Open Complaints"
            value={metrics.openComplaints}
            icon="handyman"
            accent="text-primary"
            sub="Active across all stages"
            loading={loading}
          />
          <MetricCard
            label="SLA Breaches (Month)"
            value={metrics.slaBreachesThisMonth}
            icon="warning"
            accent="text-status-emergency"
            sub="Overdue this month"
            loading={loading}
          />
          <MetricCard
            label="Avg Tech Rating"
            value={metrics.avgTechRating > 0 ? `${metrics.avgTechRating.toFixed(1)} / 5` : '—'}
            icon="star"
            accent="text-tertiary"
            sub="Across all ratings"
            loading={loading}
          />
        </section>

        {/* ── Row 2: SLA Breach List + Leaderboard ── */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* SLA Breach List */}
          <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-outline-variant/20 flex items-center justify-between">
              <div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface">SLA Breach List</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Complaints past their deadline</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-status-emergency/10 text-status-emergency border border-status-emergency/20">
                {loading ? '…' : breachList.length} overdue
              </span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[380px]">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : breachList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/40 gap-2">
                  <span className="material-symbols-outlined text-[40px]">check_circle</span>
                  <p className="text-sm font-medium">No SLA breaches — great work!</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-container-lowest/80 backdrop-blur-sm">
                    <tr className="border-b border-outline-variant/20">
                      {['Title', 'Priority', 'Assigned To', 'Overdue', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {breachList.map(c => (
                      <tr key={c.id} className="hover:bg-surface-variant/10 transition-colors">
                        <td className="px-4 py-3 max-w-[140px]">
                          <p className="text-on-surface font-medium text-xs truncate" title={c.title}>{c.title}</p>
                          <p className="text-on-surface-variant/50 text-[10px] capitalize">{c.category}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${PRIORITY_BADGE[c.priority]}`}>
                            {c.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">
                          {c.assigned_tech_name ?? <span className="italic text-on-surface-variant/40">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-status-emergency font-bold text-xs">{c.hoursOverdue}h</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_PILL[c.status] ?? 'bg-surface-variant/20 text-on-surface-variant'}`}>
                            {fmt(c.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-3 border-t border-outline-variant/10">
              <Link to="/admin/complaints" className="text-xs text-primary font-bold hover:underline">
                View all complaints →
              </Link>
            </div>
          </div>

          {/* Technician Leaderboard */}
          <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-outline-variant/20">
              <h4 className="font-headline-sm text-headline-sm text-on-surface">Technician Leaderboard</h4>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Ranked by performance score</p>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[380px]">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/40 gap-2">
                  <span className="material-symbols-outlined text-[40px]">engineering</span>
                  <p className="text-sm font-medium">No technicians yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {leaderboard.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-variant/10 transition-colors">
                      {/* Rank */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                        ${i === 0 ? 'bg-amber-400/20 text-amber-400' :
                          i === 1 ? 'bg-gray-400/20 text-gray-400' :
                          i === 2 ? 'bg-orange-400/20 text-orange-400' :
                          'bg-surface-container-high text-on-surface-variant'}`}>
                        {i + 1}
                      </div>
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-sm">{t.name.charAt(0).toUpperCase()}</span>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">{t.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Stars score={t.performance_score} size="xs" />
                          {t.avg_rating > 0 && (
                            <span className="text-[10px] text-on-surface-variant ml-1">
                              {t.avg_rating.toFixed(1)} avg
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Stats */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-on-surface">{t.completed_jobs} jobs</p>
                        <p className={`text-[10px] font-medium mt-0.5 ${t.sla_compliance >= 80 ? 'text-status-available' : t.sla_compliance >= 60 ? 'text-amber-400' : 'text-status-emergency'}`}>
                          {t.sla_compliance}% SLA
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-outline-variant/10">
              <Link to="/admin/technicians" className="text-xs text-primary font-bold hover:underline">
                Manage technicians →
              </Link>
            </div>
          </div>

        </section>

        {/* ── Row 3: Quick Status Cards ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link to="/admin/equipment" className="glass-card p-6 rounded-2xl flex items-center justify-between group hover:bg-surface-variant/10 transition-colors">
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Equipment Critical</p>
              <h3 className={`text-2xl font-bold ${metrics.equipmentCritical > 0 ? 'text-status-emergency' : 'text-on-surface'}`}>{metrics.equipmentCritical}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-status-emergency/10 border border-status-emergency/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertCircle className="w-6 h-6 text-status-emergency" />
            </div>
          </Link>
          <Link to="/admin/maintenance" className="glass-card p-6 rounded-2xl flex items-center justify-between group hover:bg-surface-variant/10 transition-colors">
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Maintenance Overdue</p>
              <h3 className={`text-2xl font-bold ${metrics.maintenanceOverdue > 0 ? 'text-status-emergency' : 'text-on-surface'}`}>{metrics.maintenanceOverdue}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-amber-500">build_circle</span>
            </div>
          </Link>
          <Link to="/admin/housekeeping" className="glass-card p-6 rounded-2xl flex items-center justify-between group hover:bg-surface-variant/10 transition-colors">
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Housekeeping Tasks Due</p>
              <h3 className={`text-2xl font-bold ${metrics.housekeepingDueToday > 0 ? 'text-primary' : 'text-on-surface'}`}>{metrics.housekeepingDueToday}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-primary">cleaning_services</span>
            </div>
          </Link>
        </section>

        {/* ── Row 3: Activity Feed ── */}
        <section className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-outline-variant/20">
            <h4 className="font-headline-sm text-headline-sm text-on-surface">Activity Feed</h4>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Latest 20 actions across all complaints</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/40 gap-2">
              <span className="material-symbols-outlined text-[40px]">inbox</span>
              <p className="text-sm font-medium">No activity yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {activity.map((entry, idx) => (
                <div key={entry.id} className="flex items-start gap-4 px-6 py-4 hover:bg-surface-variant/5 transition-colors">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center mt-1 flex-shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-primary' : 'bg-surface-container-highest'}`} />
                    {idx < activity.length - 1 && (
                      <div className="w-px flex-1 bg-outline-variant/20 mt-1" style={{ minHeight: '24px' }} />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-on-surface">{fmt(entry.action)}</span>
                      <span className="text-xs text-on-surface-variant">on</span>
                      <span className="text-xs font-medium text-primary truncate max-w-[200px]" title={entry.complaint_title}>
                        {entry.complaint_title}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-xs text-on-surface-variant/70 mt-0.5 italic">"{entry.note}"</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-medium text-on-surface-variant/60">{entry.actor_name}</span>
                      <span className="text-on-surface-variant/30">·</span>
                      <span className="text-[10px] text-on-surface-variant/50">{timeAgo(entry.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </AdminLayout>
  );
}
