import React, { useState, useEffect, useCallback } from 'react';
import { Eye, WarningTriangle, RefreshDouble } from 'iconoir-react';
import type { CommunityComplaint, CommunityComplaintUpdate } from '../../types/communityComplaint';
import { STATUS_CONFIG, COMMUNITY_ASSETS } from '../../constants/communityAssets';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResidentStatus =
  | 'open' | 'triaged' | 'assigned' | 'accepted' | 'in_progress'
  | 'on_hold' | 'resolved' | 'verified' | 'closed' | 'escalated' | 'reopened';

type ResidentPriority = 'low' | 'medium' | 'high' | 'critical';

interface ResidentComplaint {
  id: string;
  title: string;
  category: string;
  priority: ResidentPriority;
  status: ResidentStatus;
  created_at: string;
  submitted_by_name: string;
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function fmt(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const PRIORITY_BADGE: Record<ResidentPriority, React.CSSProperties> = {
  critical: { background: '#FFF1F2', color: '#BE123C' },
  high:     { background: '#FEF3C7', color: '#92400E' },
  medium:   { background: '#EFF6FF', color: '#1D4ED8' },
  low:      { background: '#F0FDF4', color: '#15803D' },
};

const STATUS_BADGE: Partial<Record<ResidentStatus, React.CSSProperties>> = {
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

// ─── Inline Spinner ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="#D97706" strokeWidth="2"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ─── Community Issue Card ─────────────────────────────────────────────────────

interface CommunityCardProps {
  complaint: CommunityComplaint;
  techName: string | null;
  isExpanded: boolean;
  updates: CommunityComplaintUpdate[] | null;
  onToggle: () => void;
}

function CommunityCard({ complaint, techName, isExpanded, updates, onToggle }: CommunityCardProps) {
  const assetConfig = COMMUNITY_ASSETS.find((a) => a.type === complaint.asset_type);
  const statusConfig = STATUS_CONFIG[complaint.status as keyof typeof STATUS_CONFIG];

  const isBreached =
    complaint.status === 'reported' &&
    complaint.affected_count >= 3 &&
    Date.now() - new Date(complaint.created_at).getTime() > 24 * 60 * 60 * 1000;

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E0DDD9',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Card body */}
      <div style={{ padding: '20px 24px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{assetConfig?.emoji ?? '🏢'}</span>
            <div>
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: 0 }}>
                {complaint.asset_label}
              </p>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '2px 0 0' }}>
                {timeAgo(complaint.created_at)}
              </p>
            </div>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {isBreached && (
              <span style={{
                background: '#FFF1F2', color: '#BE123C',
                borderRadius: 6, padding: '3px 10px',
                fontFamily: 'Inter', fontWeight: 600, fontSize: 11,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                {'⚠️ SLA Breach'}
              </span>
            )}
            {statusConfig && (
              <span style={{
                background: statusConfig.bg,
                color: statusConfig.color,
                borderRadius: 6, padding: '3px 10px',
                fontFamily: 'Inter', fontWeight: 500, fontSize: 12,
              }}>
                {statusConfig.label}
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
          <span style={{ fontFamily: 'Inter', fontSize: 13, color: '#D97706', fontWeight: 600 }}>
            {'👥 '}{complaint.affected_count}{' residents affected'}
          </span>
          <span style={{ fontFamily: 'Inter', fontSize: 13, color: techName ? '#1C1917' : '#DC2626', fontWeight: techName ? 400 : 500 }}>
            {techName ? `🔧 ${techName}` : 'Unassigned'}
          </span>
        </div>

        {/* Toggle button */}
        <button
          onClick={onToggle}
          style={{
            padding: '7px 14px',
            background: isExpanded ? '#1C1917' : '#F5F3F0',
            color: isExpanded ? '#FFFFFF' : '#1C1917',
            border: '1px solid #E0DDD9',
            borderRadius: 8,
            fontFamily: 'Inter', fontWeight: 500, fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {isExpanded ? 'Hide updates' : 'View updates'}
        </button>
      </div>

      {/* Expanded updates */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid #E0DDD9', background: '#FAFAF9', padding: '16px 24px' }}>
          <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 14px' }}>
            Milestone Updates
          </p>
          {updates === null ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              <Spinner />
            </div>
          ) : updates.length === 0 ? (
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: 0 }}>
              No updates yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {updates.map((u) => {
                const uConfig = STATUS_CONFIG[u.status as keyof typeof STATUS_CONFIG];
                return (
                  <div key={u.id} style={{ display: 'flex', gap: 12 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                      background: uConfig?.bg ?? '#E0DDD9',
                      border: `2px solid ${uConfig?.color ?? '#9C9894'}`,
                    }} />
                    <div>
                      <p style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#1C1917', margin: '0 0 2px' }}>
                        {u.message}
                      </p>
                      <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#9C9894', margin: 0 }}>
                        {fmtDate(u.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const SOCIETY_ID = 'eafc59c7-4148-44ee-b66b-256a5338718b';

export default function ComplaintsPage() {
  const [activeTab, setActiveTab] = useState<'community' | 'resident'>('community');

  // ── Community state ──
  const [communityComplaints, setCommunityComplaints] = useState<CommunityComplaint[]>([]);
  const [techNames, setTechNames] = useState<Record<string, string>>({});
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [errorCommunity, setErrorCommunity] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatesMap, setUpdatesMap] = useState<Record<string, CommunityComplaintUpdate[] | null>>({});

  // ── Resident state ──
  const [residentComplaints, setResidentComplaints] = useState<ResidentComplaint[]>([]);
  const [loadingResident, setLoadingResident] = useState(true);
  const [errorResident, setErrorResident] = useState('');

  // ─── Fetch community complaints ───────────────────────────────────────────

  const fetchCommunity = useCallback(async () => {
    setLoadingCommunity(true);
    setErrorCommunity('');
    try {
      const [{ data: complaints, error: cErr }, { data: techs, error: tErr }] = await Promise.all([
        supabase
          .from('community_complaints')
          .select('*')
          .eq('society_id', SOCIETY_ID)
          .order('created_at', { ascending: false }),
        supabase
          .from('technicians')
          .select('id, users(name)')
          .eq('society_id', SOCIETY_ID),
      ]);

      if (cErr) throw new Error(cErr.message);
      if (tErr) throw new Error(tErr.message);

      setCommunityComplaints((complaints ?? []) as CommunityComplaint[]);

      // Build tech name map
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nameMap: Record<string, string> = {};
      for (const t of (techs ?? []) as any[]) {
        if (t.id && t.users?.name) {
          nameMap[t.id] = t.users.name;
        }
      }
      setTechNames(nameMap);
    } catch {
      setErrorCommunity('Failed to load. Please refresh.');
    } finally {
      setLoadingCommunity(false);
    }
  }, []);

  // ─── Fetch updates for a complaint ───────────────────────────────────────

  const fetchUpdates = useCallback(async (complaintId: string) => {
    setUpdatesMap((prev) => ({ ...prev, [complaintId]: null }));
    try {
      const { data, error } = await supabase
        .from('community_complaint_updates')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      setUpdatesMap((prev) => ({
        ...prev,
        [complaintId]: (data ?? []) as CommunityComplaintUpdate[],
      }));
    } catch {
      setUpdatesMap((prev) => ({ ...prev, [complaintId]: [] }));
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!(id in updatesMap)) {
        fetchUpdates(id);
      }
    }
  }, [expandedId, updatesMap, fetchUpdates]);

  // ─── Fetch resident complaints ────────────────────────────────────────────

  const fetchResident = useCallback(async () => {
    setLoadingResident(true);
    setErrorResident('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('users')
        .select('society_id')
        .eq('id', user.id)
        .single();

      const { data, error } = await supabase
        .from('complaints')
        .select(`
          id, title, category, priority, status, created_at,
          submitted_user:users!submitted_by(name)
        `)
        .eq('society_id', profile?.society_id ?? SOCIETY_ID)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw new Error(error.message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResidentComplaints((data ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        priority: r.priority,
        status: r.status,
        created_at: r.created_at,
        submitted_by_name: r.submitted_user?.name ?? 'Unknown',
      })));
    } catch {
      setErrorResident('Failed to load. Please refresh.');
    } finally {
      setLoadingResident(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunity();
    fetchResident();
  }, [fetchCommunity, fetchResident]);

  // ─── Styles ───────────────────────────────────────────────────────────────

  const cardBase: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E0DDD9',
    borderRadius: 16,
  };

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: '10px 0',
      borderBottom: active ? '2px solid #1C1917' : '2px solid transparent',
      fontFamily: 'Space Grotesk',
      fontWeight: 600,
      fontSize: 15,
      color: active ? '#1C1917' : '#9C9894',
      cursor: 'pointer',
      background: 'transparent',
      border: 'none',
      borderBottom: active ? '2px solid #1C1917' : '2px solid transparent',
      transition: 'all 0.2s',
    };
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 28, marginBottom: 24, borderBottom: '1px solid #E0DDD9' }}>
          <button
            onClick={() => setActiveTab('community')}
            style={tabStyle(activeTab === 'community')}
          >
            Community Issues
          </button>
          <button
            onClick={() => setActiveTab('resident')}
            style={tabStyle(activeTab === 'resident')}
          >
            Resident Complaints
          </button>
        </div>

        {/* ══════════════ COMMUNITY ISSUES TAB ══════════════ */}
        {activeTab === 'community' && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, color: '#1C1917', margin: 0 }}>
                  Community Issues
                </h2>
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: '4px 0 0' }}>
                  {communityComplaints.length} total issues
                </p>
              </div>
              <button
                onClick={fetchCommunity}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px',
                  background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 8,
                  fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560',
                  cursor: 'pointer',
                }}
              >
                <RefreshDouble width={15} height={15} />
                Refresh
              </button>
            </div>

            {loadingCommunity ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
                <Spinner />
              </div>
            ) : errorCommunity ? (
              <p style={{ color: 'red', fontFamily: 'Inter', fontSize: 14 }}>{errorCommunity}</p>
            ) : communityComplaints.length === 0 ? (
              <div style={{ ...cardBase, padding: '64px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <WarningTriangle width={36} height={36} style={{ color: '#E0DDD9' }} />
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#9C9894', margin: 0 }}>
                  No community issues found
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {communityComplaints.map((complaint) => (
                  <CommunityCard
                    key={complaint.id}
                    complaint={complaint}
                    techName={complaint.assigned_tech_id ? (techNames[complaint.assigned_tech_id] ?? null) : null}
                    isExpanded={expandedId === complaint.id}
                    updates={updatesMap[complaint.id] ?? (expandedId === complaint.id ? null : undefined as unknown as null)}
                    onToggle={() => handleToggle(complaint.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════════ RESIDENT COMPLAINTS TAB ══════════════ */}
        {activeTab === 'resident' && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, color: '#1C1917', margin: 0 }}>
                  Resident Complaints
                </h2>
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: '4px 0 0' }}>
                  {residentComplaints.length} total complaints
                </p>
              </div>
              <button
                onClick={fetchResident}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px',
                  background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 8,
                  fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560',
                  cursor: 'pointer',
                }}
              >
                <RefreshDouble width={15} height={15} />
                Refresh
              </button>
            </div>

            {loadingResident ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
                <Spinner />
              </div>
            ) : errorResident ? (
              <p style={{ color: 'red', fontFamily: 'Inter', fontSize: 14 }}>{errorResident}</p>
            ) : (
              <div style={{ ...cardBase, overflow: 'hidden' }}>
                {residentComplaints.length === 0 ? (
                  <div style={{ padding: '64px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <WarningTriangle width={36} height={36} style={{ color: '#E0DDD9' }} />
                    <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#9C9894', margin: 0 }}>
                      No complaints found
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F5F3F0', borderBottom: '1px solid #E0DDD9' }}>
                          {['Title', 'Category', 'Priority', 'Status', 'Submitted By', 'Created'].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: '12px 20px', textAlign: 'left',
                                fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12,
                                color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {residentComplaints.map((c, i) => (
                          <tr
                            key={c.id}
                            style={{
                              borderBottom: i < residentComplaints.length - 1 ? '1px solid #F5F3F0' : 'none',
                            }}
                          >
                            <td style={{ padding: '14px 20px', maxWidth: 220 }}>
                              <p style={{
                                fontFamily: 'Inter', fontWeight: 400, fontSize: 14, color: '#1C1917',
                                margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }} title={c.title}>
                                {c.title}
                              </p>
                            </td>
                            <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>
                              {c.category}
                            </td>
                            <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                ...PRIORITY_BADGE[c.priority],
                                borderRadius: 6, padding: '3px 10px',
                                fontFamily: 'Inter', fontWeight: 500, fontSize: 12,
                              }}>
                                {fmt(c.priority)}
                              </span>
                            </td>
                            <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                ...(STATUS_BADGE[c.status] ?? { background: '#F5F3F0', color: '#6B6560' }),
                                borderRadius: 6, padding: '3px 10px',
                                fontFamily: 'Inter', fontWeight: 500, fontSize: 12,
                              }}>
                                {fmt(c.status)}
                              </span>
                            </td>
                            <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', fontFamily: 'Inter', fontSize: 14, color: '#1C1917' }}>
                              {c.submitted_by_name}
                            </td>
                            <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', fontFamily: 'Inter', fontSize: 14, color: '#9C9894' }}>
                              {fmtDate(c.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </AdminLayout>
  );
}
