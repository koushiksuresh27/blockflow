import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WarningTriangle, Check, Eye, EditPencil } from 'iconoir-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

const SOCIETY_ID = 'eafc59c7-4148-44ee-b66b-256a5338718b';

interface ChronicIssue {
  id: string;
  society_id: string;
  fingerprint: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  occurrence_count: number;
  threshold_count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: 'active' | 'monitoring' | 'resolved';
  root_cause_ticket_id: string | null;
  created_at: string;
}

interface RootCauseTicket {
  id: string;
  society_id: string;
  title: string;
  description: string;
  fingerprint: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface IncidentCluster {
  id: string;
  society_id: string;
  fingerprint: string;
  complaint_count: number;
  is_chronic: boolean;
  created_at: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function shortUuid(uuid: string | null): string {
  if (!uuid) return '';
  return uuid.slice(-6).toUpperCase();
}

const SEVERITY_BADGE: Record<string, React.CSSProperties> = {
  critical: { background: '#FEF2F2', color: '#dc2626' },
  high: { background: '#FFF7ED', color: '#ea580c' },
  medium: { background: '#FEF3C7', color: '#D97706' },
  low: { background: '#F5F3F0', color: '#6B6560' },
};

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  active: { background: '#FEF2F2', color: '#dc2626' },
  monitoring: { background: '#FEF3C7', color: '#D97706' },
  resolved: { background: '#F0FDF4', color: '#15803D' },
  open: { background: '#FEF2F2', color: '#dc2626' },
  in_progress: { background: '#FEF3C7', color: '#D97706' },
  closed: { background: '#F5F3F0', color: '#6B6560' },
};


function Spinner() {
  return (
    <svg
      width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

const SkeletonCard = () => (
  <div style={{
    background: '#F5F3F0',
    borderRadius: '16px',
    height: '120px',
    animation: 'pulse 1.5s ease infinite',
  }} />
);


export default function ChronicIssuesPage() {
  const [activeTab, setActiveTab] = useState<'chronic' | 'rootcause' | 'patterns'>('chronic');

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeChronicCount: 0,
    openTicketsCount: 0,
    clustersCount: 0,
    fingerprintedCount: 0,
  });

  const [chronicIssues, setChronicIssues] = useState<ChronicIssue[]>([]);
  const [rootCauseTickets, setRootCauseTickets] = useState<RootCauseTicket[]>([]);
  const [incidentClusters, setIncidentClusters] = useState<IncidentCluster[]>([]);

  // Expand/collapse state for Pattern History
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());

  // Ticket notes edit state
  const [ticketNotes, setTicketNotes] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Parallel fetch for stats and tab data
      const [
        { count: cIssuesCount },
        { count: rcTicketsCount },
        { count: iClustersCount },
        { count: fpCount },
        { data: cIssuesData },
        { data: rcTicketsData },
        { data: iClustersData }
      ] = await Promise.all([
        // Stats
        supabase.from('chronic_issues').select('*', { count: 'exact', head: true })
          .eq('society_id', SOCIETY_ID).eq('status', 'active'),
        supabase.from('root_cause_tickets').select('*', { count: 'exact', head: true })
          .eq('society_id', SOCIETY_ID).eq('status', 'open'),
        supabase.from('incident_clusters').select('*', { count: 'exact', head: true })
          .eq('society_id', SOCIETY_ID).gte('created_at', thirtyDaysAgo),
        supabase.from('complaint_fingerprints').select('*', { count: 'exact', head: true })
          .eq('society_id', SOCIETY_ID),
        // Tab Data
        supabase.from('chronic_issues').select('*')
          .eq('society_id', SOCIETY_ID).order('created_at', { ascending: false }),
        supabase.from('root_cause_tickets').select('*')
          .eq('society_id', SOCIETY_ID).order('created_at', { ascending: false }),
        supabase.from('incident_clusters').select('*')
          .eq('society_id', SOCIETY_ID).order('created_at', { ascending: false }).limit(50),
      ]);

      setStats({
        activeChronicCount: cIssuesCount ?? 0,
        openTicketsCount: rcTicketsCount ?? 0,
        clustersCount: iClustersCount ?? 0,
        fingerprintedCount: fpCount ?? 0,
      });

      setChronicIssues((cIssuesData as unknown as ChronicIssue[]) ?? []);
      setRootCauseTickets((rcTicketsData as unknown as RootCauseTicket[]) ?? []);
      setIncidentClusters((iClustersData as unknown as IncidentCluster[]) ?? []);

      const initialNotes: Record<string, string> = {};
      ((rcTicketsData ?? []) as unknown as RootCauseTicket[]).forEach(t => {
        initialNotes[t.id] = t.resolution_notes ?? '';
      });
      setTicketNotes(initialNotes);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResolveIssue = async (id: string) => {
    try {
      await supabase.from('chronic_issues').update({ status: 'resolved' }).eq('id', id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTicketNotes = async (id: string) => {
    try {
      await supabase.from('root_cause_tickets')
        .update({ resolution_notes: ticketNotes[id] })
        .eq('id', id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTicketStatus = async (id: string, status: 'resolved' | 'in_progress') => {
    try {
      const updateData: { status: string; resolved_at?: string } = { status };
      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }
      await supabase.from('root_cause_tickets').update(updateData).eq('id', id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePattern = (fp: string) => {
    setExpandedPatterns(prev => {
      const next = new Set(prev);
      next.has(fp) ? next.delete(fp) : next.add(fp);
      return next;
    });
  };

  const groupedPatterns = useMemo(() => {
    const groups: Record<string, IncidentCluster[]> = {};
    incidentClusters.forEach(cluster => {
      if (!groups[cluster.fingerprint]) groups[cluster.fingerprint] = [];
      groups[cluster.fingerprint].push(cluster);
    });
    return groups;
  }, [incidentClusters]);


  const pageContainer: React.CSSProperties = {
    maxWidth: 1280, margin: '0 auto', paddingBottom: 64,
  };

  const cardBase: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E0DDD9',
    borderRadius: 16,
    padding: 20,
  };

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: '10px 0',
      fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15,
      color: active ? '#1C1917' : '#9C9894',
      cursor: 'pointer', background: 'transparent',
      border: 'none',
      borderBottom: active ? '2px solid #1C1917' : '2px solid transparent',
      transition: 'color 0.2s, border-color 0.2s',
    };
  }

  const monospacePill: React.CSSProperties = {
    background: '#F5F3F0',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 6,
    color: '#1C1917',
    display: 'inline-block',
  };

  return (
    <AdminLayout>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        body {
          background-color: #EDEBE6;
        }
      `}</style>

      <div style={pageContainer}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 28, color: '#1C1917', margin: '0 0 8px' }}>
            Complaint DNA
          </h1>
          <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>
            Pattern detection &amp; chronic issue intelligence
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
          <div style={cardBase}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: '0 0 8px', fontWeight: 500 }}>Active Chronic Issues</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 32, margin: 0, color: stats.activeChronicCount > 0 ? '#dc2626' : '#9C9894' }}>
              {stats.activeChronicCount}
            </h3>
          </div>
          <div style={cardBase}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: '0 0 8px', fontWeight: 500 }}>Open Root Cause Tickets</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 32, margin: 0, color: stats.openTicketsCount > 0 ? '#D97706' : '#9C9894' }}>
              {stats.openTicketsCount}
            </h3>
          </div>
          <div style={cardBase}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: '0 0 8px', fontWeight: 500 }}>Incident Clusters (30d)</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 32, margin: 0, color: '#1C1917' }}>
              {stats.clustersCount}
            </h3>
          </div>
          <div style={cardBase}>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: '0 0 8px', fontWeight: 500 }}>Complaints Fingerprinted</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 32, margin: 0, color: '#1C1917' }}>
              {stats.fingerprintedCount}
            </h3>
          </div>
        </div>

        {/* Tabs Header */}
        <div style={{ display: 'flex', gap: 28, marginBottom: 24, borderBottom: '1px solid #E0DDD9' }}>
          <button onClick={() => setActiveTab('chronic')} style={tabStyle(activeTab === 'chronic')}>
            Chronic Issues
          </button>
          <button onClick={() => setActiveTab('rootcause')} style={tabStyle(activeTab === 'rootcause')}>
            Root Cause Tickets
          </button>
          <button onClick={() => setActiveTab('patterns')} style={tabStyle(activeTab === 'patterns')}>
            Pattern History
          </button>
        </div>

        {/* Tab 1: Chronic Issues */}
        {activeTab === 'chronic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : chronicIssues.length === 0 ? (
              <div style={{ ...cardBase, padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>
                  🧬 No chronic issues detected yet.<br />The DNA pipeline will flag patterns as complaints come in.
                </p>
              </div>
            ) : (
              chronicIssues.map(issue => (
                <div key={issue.id} style={cardBase}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        {issue.severity && (
                          <span style={{
                            ...SEVERITY_BADGE[issue.severity],
                            borderRadius: 6, padding: '3px 10px',
                            fontFamily: 'Inter', fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                            {(issue.severity === 'critical' || issue.severity === 'high') && <WarningTriangle width={12} height={12} />}
                            {issue.severity}
                          </span>
                        )}
                        <span style={monospacePill}>{issue.fingerprint}</span>
                      </div>
                      <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, color: '#1C1917', margin: '0 0 4px' }}>
                        {issue.category || issue.fingerprint}
                      </h3>
                      <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: 0 }}>
                        First seen: {fmtDate(issue.first_seen_at)} &middot; Last seen: {fmtDate(issue.last_seen_at)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{
                        ...(STATUS_BADGE[issue.status] ?? {}),
                        borderRadius: 6, padding: '3px 10px',
                        fontFamily: 'Inter', fontWeight: 500, fontSize: 12, textTransform: 'capitalize'
                      }}>
                        {issue.status}
                      </span>
                      {issue.status === 'active' && (
                        <button
                          onClick={() => handleResolveIssue(issue.id)}
                          style={{
                            background: '#1C1917', color: '#FFF', border: 'none', borderRadius: 8,
                            padding: '6px 12px', fontFamily: 'Inter', fontSize: 13, fontWeight: 500,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <Check width={16} height={16} /> Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 32, borderTop: '1px solid #E0DDD9', paddingTop: 16 }}>
                    <div>
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 4px' }}>Occurrences</p>
                      <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', fontWeight: 500, margin: 0 }}>
                        {issue.occurrence_count} times in 30 days
                      </p>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 4px' }}>Threshold</p>
                      <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', fontWeight: 500, margin: 0 }}>
                        {issue.threshold_count} times
                      </p>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 4px' }}>Root Cause Ticket</p>
                      <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', fontWeight: 500, margin: 0 }}>
                        {issue.root_cause_ticket_id ? `#RC-${shortUuid(issue.root_cause_ticket_id)}` : 'None'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 4px' }}>Affected Complaints</p>
                      <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', fontWeight: 500, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {issue.occurrence_count} <Eye width={14} height={14} style={{ color: '#D97706', cursor: 'pointer' }} />
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Root Cause Tickets */}
        {activeTab === 'rootcause' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : rootCauseTickets.length === 0 ? (
              <div style={{ ...cardBase, padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>
                  ✅ No open root cause tickets.
                </p>
              </div>
            ) : (
              rootCauseTickets.map(ticket => (
                <div key={ticket.id} style={cardBase}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#1C1917' }}>
                          #RC-{shortUuid(ticket.id)}
                        </span>
                        <span style={{
                          ...(STATUS_BADGE[ticket.status] ?? {}),
                          borderRadius: 6, padding: '3px 10px',
                          fontFamily: 'Inter', fontWeight: 500, fontSize: 12, textTransform: 'uppercase'
                        }}>
                          {ticket.status}
                        </span>
                        <span style={monospacePill}>{ticket.fingerprint}</span>
                      </div>
                      <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#1C1917', margin: '0 0 8px', fontWeight: 500 }}>
                        {ticket.description || ticket.title || 'Root Issue Details'}
                      </p>
                      <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: 0 }}>
                        Created: {fmtDate(ticket.created_at)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {ticket.status === 'open' && (
                        <button
                          onClick={() => handleUpdateTicketStatus(ticket.id, 'in_progress')}
                          style={{
                            background: '#F5F3F0', color: '#1C1917', border: '1px solid #E0DDD9', borderRadius: 8,
                            padding: '6px 12px', fontFamily: 'Inter', fontSize: 13, fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          Mark In Progress
                        </button>
                      )}
                      {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                        <button
                          onClick={() => handleUpdateTicketStatus(ticket.id, 'resolved')}
                          style={{
                            background: '#1C1917', color: '#FFF', border: 'none', borderRadius: 8,
                            padding: '6px 12px', fontFamily: 'Inter', fontSize: 13, fontWeight: 500,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <Check width={16} height={16} /> Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #E0DDD9', paddingTop: 16 }}>
                    <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#1C1917', fontWeight: 500, margin: '0 0 8px' }}>
                      Resolution notes:
                    </p>
                    <textarea
                      value={ticketNotes[ticket.id] ?? ''}
                      onChange={e => setTicketNotes(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                      style={{
                        width: '100%', minHeight: 80, padding: 12,
                        background: '#FAFAF9', border: '1px solid #E0DDD9', borderRadius: 8,
                        fontFamily: 'Inter', fontSize: 14, color: '#1C1917', resize: 'vertical',
                        marginBottom: 12, boxSizing: 'border-box'
                      }}
                    />
                    <button
                      onClick={() => handleSaveTicketNotes(ticket.id)}
                      style={{
                        background: '#F5F3F0', color: '#1C1917', border: '1px solid #E0DDD9', borderRadius: 8,
                        padding: '6px 12px', fontFamily: 'Inter', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <EditPencil width={14} height={14} /> Save Notes
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Pattern History */}
        {activeTab === 'patterns' && (
          <div style={cardBase}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <Spinner />
              </div>
            ) : Object.keys(groupedPatterns).length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>
                  No pattern history yet.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {Object.entries(groupedPatterns).map(([fingerprint, clusters]) => (
                  <div key={fingerprint} style={{ borderBottom: '1px solid #E0DDD9', padding: '16px 0' }}>
                    <div
                      onClick={() => togglePattern(fingerprint)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 14, color: '#9C9894', display: 'inline-block', transform: expandedPatterns.has(fingerprint) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        ▶
                      </span>
                      <span style={monospacePill}>{fingerprint}</span>
                      <span style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894' }}>
                        ({clusters.length} cluster{clusters.length !== 1 ? 's' : ''})
                      </span>
                    </div>

                    {expandedPatterns.has(fingerprint) && (
                      <div style={{ paddingLeft: 28, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {clusters.map(cluster => (
                          <div key={cluster.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round">
                              <circle cx="12" cy="12" r="10" />
                            </svg>
                            <div>
                              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', margin: '0 0 4px', fontWeight: 500 }}>
                                {cluster.complaint_count} complaints clustered &middot; {fmtDate(cluster.created_at)}
                              </p>
                              <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                Chronic:
                                <span style={{
                                  background: cluster.is_chronic ? '#FEF2F2' : '#F5F3F0',
                                  color: cluster.is_chronic ? '#dc2626' : '#6B6560',
                                  padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase'
                                }}>
                                  {cluster.is_chronic ? 'Yes' : 'No'}
                                </span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
