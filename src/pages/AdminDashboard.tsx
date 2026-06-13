import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Timer, Clock, Community, CheckCircle, WarningCircle } from 'iconoir-react';
import { supabase } from '../lib/supabase';
import AdminLayout from '../components/AdminLayout';
import AIDailyBriefing from '../components/admin/AIDailyBriefing';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status =
  | 'open' | 'triaged' | 'assigned' | 'accepted'
  | 'in_progress' | 'on_hold' | 'resolved'
  | 'verified' | 'closed' | 'escalated' | 'reopened';

interface BreachComplaint {
  id: string;
  title: string;
  hoursOverdue: number;
}

interface DashMetrics {
  totalComplaints: number;
  openComplaints: number;
  solvedComplaints: number;
  overdueSlа: number;
  avgResolutionHours: number;
  pendingResidents: number;
  communityIssues: number;
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
    { count: totalComplaints },
    { count: openComplaints },
    { count: solvedComplaints },
    { count: overdueCount },
    { data: resolvedRaw },
    { count: pendingResidents },
    { data: breachRaw },
    { count: communityIssuesCount },
  ] = await Promise.all([
    supabase.from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? ''),

    supabase.from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? '')
      .in('status', ['open', 'triaged', 'assigned', 'accepted', 'in_progress']),

    supabase.from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? '')
      .in('status', ['resolved', 'closed', 'verified']),

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

    supabase.from('complaints').select('id, title, sla_deadline')
      .eq('society_id', societyId ?? '')
      .not('status', 'in', '("closed","verified")')
      .lt('sla_deadline', nowIso)
      .order('sla_deadline', { ascending: true }).limit(10),

    supabase.from('community_complaints')
      .select('id', { count: 'exact', head: true })
      .eq('society_id', societyId ?? '')
      .neq('status', 'resolved'),
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
    totalComplaints: totalComplaints ?? 0,
    openComplaints: openComplaints ?? 0,
    solvedComplaints: solvedComplaints ?? 0,
    overdueSlа: overdueCount ?? 0,
    avgResolutionHours,
    pendingResidents: pendingResidents ?? 0,
    communityIssues: communityIssuesCount ?? 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breachList: BreachComplaint[] = (breachRaw ?? []).map((r: any) => ({
    id: r.id, title: r.title,
    hoursOverdue: Math.floor((Date.now() - new Date(r.sla_deadline).getTime()) / 3600000),
  }));

  return { metrics, breachList };
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

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashMetrics>({
    totalComplaints: 0, openComplaints: 0, solvedComplaints: 0, overdueSlа: 0, avgResolutionHours: 0, pendingResidents: 0, communityIssues: 0,
  });
  const [breachList, setBreachList] = useState<BreachComplaint[]>([]);
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
      setBreachList(result.breachList);
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

      <AIDailyBriefing />

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

      {/* ── Row 2: Complaints Summary + SLA Breaches ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Complaints Summary */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: '0 0 16px' }}>
            Complaints Summary
          </p>
          {loading ? (
            <div style={{ display: 'flex', gap: 16, flex: 1 }}>
              <div className="skeleton" style={{ flex: 1, borderRadius: 12 }} />
              <div className="skeleton" style={{ flex: 1, borderRadius: 12 }} />
              <div className="skeleton" style={{ flex: 1, borderRadius: 12 }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Total</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 36, color: '#1C1917', margin: 0, lineHeight: 1 }}>{metrics.totalComplaints}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Pending</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 36, color: '#D97706', margin: 0, lineHeight: 1 }}>{metrics.openComplaints}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Solved</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 36, color: '#15803D', margin: 0, lineHeight: 1 }}>{metrics.solvedComplaints}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid #E0DDD9', paddingLeft: 16 }}>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px', whiteSpace: 'nowrap' }}>Community Issues</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 36, color: metrics.communityIssues > 0 ? '#D97706' : '#1C1917', margin: 0, lineHeight: 1 }}>{metrics.communityIssues}</p>
              </div>
            </div>
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
