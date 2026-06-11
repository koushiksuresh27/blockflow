import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Timer, Clock, Community, CheckCircle, WarningCircle } from 'iconoir-react';
import { supabase } from '../lib/supabase';
import AdminLayout from '../components/AdminLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status =
  | 'open' | 'triaged' | 'assigned' | 'accepted'
  | 'in_progress' | 'on_hold' | 'resolved'
  | 'verified' | 'closed' | 'escalated' | 'reopened';

interface RecentComplaint {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: Status;
  created_at: string;
}

interface BreachComplaint {
  id: string;
  title: string;
  hoursOverdue: number;
}

interface TechLeader {
  id: string;
  name: string;
  performance_score: number;
  avg_rating: number;
  completed_jobs: number;
  sla_compliance: number;
  specializations: string[];
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
  openComplaints: number;
  overdueSlа: number;
  avgResolutionHours: number;
  pendingResidents: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmt(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const PRIORITY_DOT: Record<Priority, string> = {
  critical: '#DC2626',
  high: '#D97706',
  medium: '#2563EB',
  low: '#9C9894',
};

const STATUS_BADGE: Partial<Record<Status, { bg: string; text: string }>> = {
  open:        { bg: '#FEF3C7', text: '#92400E' },
  in_progress: { bg: '#EFF6FF', text: '#1D4ED8' },
  resolved:    { bg: '#F0FDF4', text: '#15803D' },
  escalated:   { bg: '#FFF1F2', text: '#BE123C' },
  closed:      { bg: '#F5F3F0', text: '#6B6560' },
};

// ─── Data Fetch ──────────────────────────────────────────────────────────────

async function fetchDashboard(societyId: string | null) {
  const now = new Date();
  const nowIso = now.toISOString();

  const [
    { count: openComplaints },
    { count: overdueCount },
    { data: resolvedRaw },
    { count: pendingResidents },
    { data: recentRaw },
    { data: breachRaw },
    { data: techRaw },
    { data: activityRaw },
  ] = await Promise.all([
    supabase.from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? '')
      .in('status', ['open', 'triaged', 'assigned', 'accepted', 'in_progress']),

    supabase.from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? '')
      .not('status', 'in', '("closed","verified")')
      .lt('sla_deadline', nowIso),

    supabase.from('complaints')
      .select('created_at, updated_at')
      .eq('society_id', societyId ?? '')
      .eq('status', 'closed')
      .gte('updated_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),

    supabase.from('users')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    supabase.from('complaints').select(`
      id, title, category, priority, status, created_at,
      submitted_user:users!submitted_by(name)
    `).eq('society_id', societyId ?? '').order('created_at', { ascending: false }).limit(6),

    supabase.from('complaints').select('id, title, sla_deadline')
      .eq('society_id', societyId ?? '')
      .not('status', 'in', '("closed","verified")')
      .lt('sla_deadline', nowIso)
      .order('sla_deadline', { ascending: true }).limit(10),

    supabase.from('technicians').select(`
      id, performance_score, specializations,
      tech_user:users!user_id(name),
      completed:complaints!assigned_tech_id(status, sla_deadline, updated_at),
      ratings_data:ratings!technician_id(score)
    `).eq('society_id', societyId ?? '').order('performance_score', { ascending: false }).limit(5),

    supabase.from('complaint_logs').select(`
      id, action, note, created_at,
      complaint:complaints!complaint_id(title),
      actor:users!actor_id(name)
    `).order('created_at', { ascending: false }).limit(20),
  ]);

  // Avg resolution hours
  const resolvedList = resolvedRaw ?? [];
  let avgResolutionHours = 0;
  if (resolvedList.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalMs = resolvedList.reduce((sum: number, r: any) =>
      sum + (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()), 0);
    avgResolutionHours = totalMs / resolvedList.length / 3600000;
  }

  const metrics: DashMetrics = {
    openComplaints: openComplaints ?? 0,
    overdueSlа: overdueCount ?? 0,
    avgResolutionHours,
    pendingResidents: pendingResidents ?? 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentComplaints: RecentComplaint[] = (recentRaw ?? []).map((r: any) => ({
    id: r.id, title: r.title, category: r.category,
    priority: r.priority, status: r.status, created_at: r.created_at,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breachList: BreachComplaint[] = (breachRaw ?? []).map((r: any) => ({
    id: r.id, title: r.title,
    hoursOverdue: Math.floor((Date.now() - new Date(r.sla_deadline).getTime()) / 3600000),
  }));

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
      specializations: r.specializations ?? [],
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activity: ActivityEntry[] = (activityRaw ?? []).map((r: any) => ({
    id: r.id, action: r.action, note: r.note,
    complaint_title: r.complaint?.title ?? '—',
    actor_name: r.actor?.name ?? 'System',
    created_at: r.created_at,
  }));

  return { metrics, recentComplaints, breachList, leaderboard, activity };
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, icon: Icon, sub, loading, accentValue,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ width?: number; height?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  sub: string;
  loading: boolean;
  accentValue?: boolean;
}) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E0DDD9',
      borderRadius: 16,
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <span style={{
          fontFamily: 'Inter',
          fontWeight: 500,
          fontSize: 12,
          color: '#9C9894',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
        }}>{label}</span>
        <div style={{
          width: 32, height: 32,
          background: '#F5F3F0',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon width={16} height={16} style={{ color: '#6B6560' }} />
        </div>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 44, width: '60%', marginBottom: 8 }} />
      ) : (
        <div style={{
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: 36,
          color: accentValue ? '#D97706' : '#1C1917',
          lineHeight: 1,
          marginBottom: 8,
        }}>
          {value}
        </div>
      )}
      <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 12, color: '#9C9894', margin: 0 }}>{sub}</p>
    </div>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────

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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashMetrics>({
    openComplaints: 0, overdueSlа: 0, avgResolutionHours: 0, pendingResidents: 0,
  });
  const [recentComplaints, setRecentComplaints] = useState<RecentComplaint[]>([]);
  const [breachList, setBreachList] = useState<BreachComplaint[]>([]);
  const [leaderboard, setLeaderboard] = useState<TechLeader[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('users').select('name').eq('id', user.id).single()
        .then(({ data }) => { if (data?.name) setAdminName(data.name); });
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user.id).single();
      const sid = profile?.society_id ?? null;
      const result = await fetchDashboard(sid);
      setMetrics(result.metrics);
      setRecentComplaints(result.recentComplaints);
      setBreachList(result.breachList);
      setLeaderboard(result.leaderboard);
      setActivity(result.activity);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel('admin-dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaint_logs' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = adminName.split(' ')[0] || 'Admin';

  const avgResText = metrics.avgResolutionHours > 0
    ? metrics.avgResolutionHours >= 24
      ? `${(metrics.avgResolutionHours / 24).toFixed(1)}d`
      : `${Math.round(metrics.avgResolutionHours)}h`
    : '—';

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E0DDD9',
    borderRadius: 16,
    padding: 24,
  };

  return (
    <AdminLayout onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      {/* ── Greeting ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{
          fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 22,
          color: '#1C1917', margin: '0 0 6px',
        }}>
          {greeting}, {firstName} 👋
        </h2>
        <p style={{
          fontFamily: 'Inter', fontWeight: 400, fontSize: 14,
          color: '#9C9894', margin: 0,
        }}>
          Here's what's happening in your society today.
        </p>
      </div>

      {/* ── Row 1: Metric Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <MetricCard
          label="Open Complaints"
          value={metrics.openComplaints}
          icon={ClipboardCheck}
          sub="Active complaints"
          loading={loading}
          accentValue={metrics.openComplaints > 10}
        />
        <MetricCard
          label="Overdue SLA"
          value={metrics.overdueSlа}
          icon={Timer}
          sub="Past deadline"
          loading={loading}
          accentValue={metrics.overdueSlа > 0}
        />
        <MetricCard
          label="Avg Resolution"
          value={avgResText}
          icon={Clock}
          sub="Average this month"
          loading={loading}
        />
        <MetricCard
          label="Pending Approvals"
          value={metrics.pendingResidents}
          icon={Community}
          sub="Awaiting your approval"
          loading={loading}
          accentValue={metrics.pendingResidents > 0}
        />
      </div>

      {/* ── Row 2: Recent Complaints + Activity Feed ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Recent Complaints */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917' }}>
              Recent Complaints
            </span>
            <Link to="/admin/complaints" style={{
              fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#D97706',
              textDecoration: 'none',
            }}>
              View All
            </Link>
          </div>

          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #F5F3F0', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                <div className="skeleton" style={{ flex: 1, height: 14 }} />
                <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 6 }} />
              </div>
            ))
          ) : recentComplaints.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 8 }}>
              <WarningCircle width={40} height={40} style={{ color: '#E0DDD9' }} />
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9C9894', margin: 0 }}>No complaints yet</p>
            </div>
          ) : (
            recentComplaints.map((c, i) => {
              const badge = STATUS_BADGE[c.status] ?? { bg: '#F5F3F0', text: '#6B6560' };
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < recentComplaints.length - 1 ? '1px solid #F5F3F0' : 'none',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[c.priority], flexShrink: 0, display: 'block' }} />
                  <span style={{
                    fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13,
                    color: '#1C1917', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.title}
                  </span>
                  <span style={{
                    fontFamily: 'Inter', fontWeight: 500, fontSize: 11,
                    background: '#F5F3F0', color: '#6B6560',
                    borderRadius: 6, padding: '2px 8px', flexShrink: 0,
                  }}>
                    {c.category}
                  </span>
                  <span style={{
                    fontFamily: 'Inter', fontWeight: 500, fontSize: 11,
                    background: badge.bg, color: badge.text,
                    borderRadius: 6, padding: '2px 8px', flexShrink: 0,
                  }}>
                    {fmt(c.status)}
                  </span>
                  <span style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 11, color: '#9C9894', flexShrink: 0 }}>
                    {timeAgo(c.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Activity Feed */}
        <div style={{ ...cardStyle, overflowY: 'auto', maxHeight: 480 }}>
          <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: '0 0 16px' }}>
            Activity Feed
          </p>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 14, marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 12, width: '60%' }} />
                </div>
              </div>
            ))
          ) : activity.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 8 }}>
              <WarningCircle width={32} height={32} style={{ color: '#E0DDD9' }} />
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: 0 }}>No activity yet</p>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {activity.map((entry) => (
                <div key={entry.id} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706', border: '2px solid #FFFFFF', flexShrink: 0 }} />
                    <div style={{ flex: 1, width: 1, background: '#E0DDD9', minHeight: 24, marginTop: 2 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#1C1917', margin: '0 0 2px' }}>
                      {fmt(entry.action)} on <span style={{ color: '#D97706' }}>{entry.complaint_title}</span>
                    </p>
                    <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 12, color: '#9C9894', margin: 0 }}>
                      by {entry.actor_name} · {timeAgo(entry.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Leaderboard + SLA Breaches ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Technician Leaderboard */}
        <div style={cardStyle}>
          <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: '0 0 16px' }}>
            Technician Performance
          </p>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F5F3F0' }}>
                <div className="skeleton" style={{ width: 20, height: 16, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 14, marginBottom: 4 }} />
                  <div className="skeleton" style={{ height: 12, width: '50%' }} />
                </div>
              </div>
            ))
          ) : leaderboard.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 8 }}>
              <WarningCircle width={40} height={40} style={{ color: '#E0DDD9' }} />
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9C9894', margin: 0 }}>No technicians yet</p>
            </div>
          ) : (
            leaderboard.map((t, i) => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i < leaderboard.length - 1 ? '1px solid #F5F3F0' : 'none',
              }}>
                <span style={{
                  fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14,
                  color: i === 0 ? '#D97706' : '#9C9894',
                  width: 20, flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#1C1917',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: '#D7DADC',
                  flexShrink: 0,
                }}>
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </p>
                  <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 11, color: '#9C9894', margin: 0 }}>
                    {t.specializations[0] ?? 'General'}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#1C1917', margin: '0 0 2px' }}>
                    {t.performance_score}
                  </p>
                  <Stars score={t.performance_score} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* SLA Breaches */}
        <div style={cardStyle}>
          <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: '0 0 16px' }}>
            SLA Breaches
          </p>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F5F3F0' }}>
                <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                <div className="skeleton" style={{ flex: 1, height: 14 }} />
                <div className="skeleton" style={{ width: 70, height: 20, borderRadius: 6 }} />
              </div>
            ))
          ) : breachList.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 8 }}>
              <CheckCircle width={32} height={32} style={{ color: '#9C9894' }} />
              <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 14, color: '#9C9894', margin: 0 }}>
                No SLA breaches 🎉
              </p>
            </div>
          ) : (
            breachList.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0',
                borderBottom: i < breachList.length - 1 ? '1px solid #F5F3F0' : 'none',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', flexShrink: 0, display: 'block' }} />
                <span style={{
                  fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917',
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.title}
                </span>
                <span style={{
                  fontFamily: 'Inter', fontWeight: 500, fontSize: 11,
                  background: '#FFF1F2', color: '#BE123C',
                  borderRadius: 6, padding: '2px 8px', flexShrink: 0,
                }}>
                  {c.hoursOverdue >= 24 ? `${Math.floor(c.hoursOverdue / 24)}d overdue` : `${c.hoursOverdue}h overdue`}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
