import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, CheckCircle, XCircle, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { WarningCircle } from 'iconoir-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Resident {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  status: 'pending' | 'active' | 'rejected';
  created_at?: string;
  flat_number: string | null;
  floor_number: number | null;
  tower_name: string | null;
}

type TabKey = 'pending' | 'active' | 'rejected';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending',  label: 'Pending Approval' },
  { key: 'active',   label: 'Active Residents' },
  { key: 'rejected', label: 'Rejected' },
];

function fmtDate(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(iso: string | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResidentsPage() {
  const toast = useToast();
  const [residents, setResidents]       = useState<Resident[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [tab, setTab]                   = useState<TabKey>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [removingUser, setRemovingUser] = useState<Resident | null>(null);
  // Separate counts for each tab (since we only load the current tab's rows)
  const [tabCounts, setTabCounts]       = useState<Record<TabKey, number>>({ pending: 0, active: 0, rejected: 0 });


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

      // Fetch ALL users with status matching the current tab.
      // No role filter — pending Google sign-ups may have any role.
      // society_id scoping ensures cross-society isolation.
      let query = supabase
        .from('users')
        .select(`
          id, name, phone, role, status, created_at, flat_number,
          apartment:apartments!apartment_id(
            flat_number, floor_number,
            tower:towers!tower_id(name)
          )
        `)
        .eq('status', tab)
        .order('created_at', { ascending: false });

      if (sid) {
        if (tab === 'pending') {
          query = query.or(`society_id.eq.${sid},society_id.is.null`);
        } else {
          query = query.eq('society_id', sid);
        }
      }

      const { data, error: e } = await query;
      if (e) throw new Error(e.message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResidents((data ?? []).map((r: any) => ({
        id:           r.id,
        name:         r.name ?? 'Unnamed User',
        phone:        r.phone,
        role:         r.role ?? 'resident',
        status:       r.status ?? 'pending',
        created_at:   r.created_at,
        flat_number:  r.flat_number || r.apartment?.flat_number || null,
        floor_number: r.apartment?.floor_number ?? null,
        tower_name:   (r.flat_number ? r.flat_number.split('-')[0] : null) || r.apartment?.tower?.name || null,
      })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load residents.');
    } finally {
      setLoading(false);
    }
  }, [tab]);  // re-fetch when tab changes

  // Lightweight count query for all 3 tabs (so tab badges stay accurate)
  const loadCounts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user.id).single();
      const sid = profile?.society_id ?? null;

      const statuses: TabKey[] = ['pending', 'active', 'rejected'];
      const counts = await Promise.all(
        statuses.map((s) => {
          let q = supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', s);
          if (sid) {
            if (s === 'pending') {
              q = q.or(`society_id.eq.${sid},society_id.is.null`);
            } else {
              q = q.eq('society_id', sid);
            }
          }
          return q;
        })
      );
      setTabCounts({
        pending:  counts[0].count ?? 0,
        active:   counts[1].count ?? 0,
        rejected: counts[2].count ?? 0,
      });
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { load(); loadCounts(); }, [load, loadCounts]);

  // Reload rows when tab switches
  useEffect(() => { setLoading(true); load(); }, [tab, load]);

  // Realtime on user status changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-residents-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => { load(); loadCounts(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, loadCounts]);

  const updateStatus = async (id: string, newStatus: 'active' | 'rejected') => {
    setProcessingId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user?.id).single();
      const adminSocietyId = profile?.society_id;

      const updateData: { status: string; society_id?: string } = { status: newStatus };
      if (newStatus === 'active' && adminSocietyId) {
        updateData.society_id = adminSocietyId;
      }

      const { error: e, data } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select('id');

      if (e) {
        console.error('Approval failed:', e);
        toast('error', 'Approval failed', e.message);
        return;
      }
      
      if (!data || data.length === 0) {
        console.error('Approval failed: User not found or permission denied by RLS');
        toast('error', 'Approval failed', 'Permission denied or user not found');
        return;
      }

      // Remove from current tab list immediately
      setResidents(prev => prev.filter(r => r.id !== id));
      // Update counts: decrement source tab, increment destination tab
      setTabCounts(prev => ({
        ...prev,
        [tab]:      Math.max(0, prev[tab] - 1),
        [newStatus === 'active' ? 'active' : 'rejected']:
          prev[newStatus === 'active' ? 'active' : 'rejected'] + 1,
      }));
      toast('success',
        newStatus === 'active' ? 'Resident approved!' : 'Resident rejected!',
        newStatus === 'active' ? 'The resident now has full access.' : 'Resident application has been rejected.');
    } catch (e: unknown) {
      console.error('Update Status Error:', e);
      toast('error', 'Update failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setProcessingId(null);
    }
  };

  const approveAll = async () => {
    if (residents.length === 0) return;
    setApprovingAll(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user?.id).single();
      const adminSocietyId = profile?.society_id;

      const ids = residents.map(r => r.id);
      const updateData: { status: string; society_id?: string } = { status: 'active' };
      if (adminSocietyId) {
        updateData.society_id = adminSocietyId;
      }

      const { error: e, data } = await supabase
        .from('users')
        .update(updateData)
        .in('id', ids)
        .select('id');

      if (e) {
        console.error('Approve All failed:', e);
        toast('error', 'Approve All failed', e.message);
        return;
      }
      
      const approvedIds = data?.map(d => d.id) || [];
      if (approvedIds.length === 0) {
        console.error('Approve All failed: Permission denied by RLS');
        toast('error', 'Approve All failed', 'Permission denied');
        return;
      }

      // Clear approved users from pending list immediately
      setResidents(prev => prev.filter(r => !approvedIds.includes(r.id)));
      setTabCounts(prev => ({ 
        ...prev, 
        pending: Math.max(0, prev.pending - approvedIds.length), 
        active: prev.active + approvedIds.length 
      }));
      toast('success', 'All Approved', `${approvedIds.length} user${approvedIds.length !== 1 ? 's' : ''} approved successfully.`);
    } catch (e: unknown) {
      console.error('Approve All Error:', e);
      toast('error', 'Approve All failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setApprovingAll(false);
    }
  };

  const removeResident = async (userId: string) => {
    try {
      const { error, data } = await supabase
        .from('users')
        .update({ status: 'rejected', society_id: null })
        .eq('id', userId)
        .select('id');

      if (error) {
        toast('error', 'Failed to remove', error.message);
        return;
      }
      
      if (!data || data.length === 0) {
        toast('error', 'Failed to remove', 'Permission denied or user not found');
        return;
      }

      setResidents(prev => prev.filter(u => u.id !== userId));
      setTabCounts(prev => ({
        ...prev,
        active: Math.max(0, prev.active - 1),
        rejected: prev.rejected + 1,
      }));
      toast('success', 'Resident removed', 'Resident removed successfully.');
    } catch (e: unknown) {
      toast('error', 'Remove failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setRemovingUser(null);
    }
  };

  // Since rows are fetched by status=tab, displayed is the full list
  const displayed    = residents;
  const pendingCount = tabCounts.pending;


  return (
    <AdminLayout>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {TABS.map(({ key, label }) => {
              const count = tabCounts[key];
              const isActive = tab === key;
              return (
                <button
                  key={key}
                  id={`tab-residents-${key}`}
                  onClick={() => setTab(key)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 8,
                    fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13,
                    color: isActive ? '#FFFFFF' : '#6B6560',
                    border: 'none',
                    background: isActive ? '#1C1917' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                  {count > 0 && (
                    <span style={{
                      fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 11,
                      background: isActive ? 'rgba(255,255,255,0.2)' : '#F5F3F0',
                      color: isActive ? '#FFFFFF' : '#6B6560',
                      borderRadius: 4, padding: '1px 6px',
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Approve All */}
          {tab === 'pending' && pendingCount > 0 && (
            <button
              onClick={approveAll}
              disabled={approvingAll}
              id="approve-all-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px',
                background: approvingAll ? '#B45309' : '#D97706',
                color: '#FFFFFF',
                borderRadius: 10, border: 'none',
                fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14,
                cursor: approvingAll ? 'not-allowed' : 'pointer',
                opacity: approvingAll ? 0.8 : 1,
                transition: 'all 0.15s',
              }}
            >
              {approvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {approvingAll ? 'Approving…' : `Approve All (${pendingCount})`}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FFF1F2', border: '1px solid #FCA5A5', borderRadius: 12, marginBottom: 16, fontFamily: 'Inter', fontSize: 14, color: '#BE123C' }}>
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
                <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '80%' }} />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 8 }}>
            <WarningCircle width={40} height={40} style={{ color: '#E0DDD9' }} />
            <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#9C9894', margin: 0 }}>
              {tab === 'pending' ? 'No pending applications' : tab === 'active' ? 'No active residents' : 'No rejected applications'}
            </p>
          </div>
        ) : tab === 'pending' ? (
          /* Card grid for pending */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {displayed.map(r => (
              <div key={r.id} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F5F3F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#6B6560', marginBottom: 12 }}>
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: '0 0 4px' }}>{r.name}</p>
                {r.phone && <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: '0 0 2px' }}>{r.phone}</p>}
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 16px' }}>Applied {timeAgo(r.created_at)}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    id={`approve-${r.id}`}
                    onClick={() => updateStatus(r.id, 'active')}
                    disabled={processingId === r.id}
                    style={{
                      flex: 1, padding: '8px 16px',
                      background: processingId === r.id ? '#2C2925' : '#1C1917',
                      color: '#FFFFFF', borderRadius: 8, border: 'none',
                      fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {processingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                  <button
                    id={`reject-${r.id}`}
                    onClick={() => updateStatus(r.id, 'rejected')}
                    disabled={processingId === r.id}
                    style={{
                      flex: 1, padding: '8px 16px',
                      background: 'transparent', border: '1px solid #E0DDD9', color: '#6B6560',
                      borderRadius: 8,
                      fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#DC2626'; (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E0DDD9'; (e.currentTarget as HTMLButtonElement).style.color = '#6B6560'; }}
                  >
                    {processingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table for active/rejected */
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F5F3F0', borderBottom: '1px solid #E0DDD9' }}>
                    {['Name', 'Phone', 'Flat', 'Tower', 'Date', 'Status', ...(tab === 'active' ? ['Actions'] : [])].map(h => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r, i) => (
                    <tr key={r.id}
                      style={{ borderBottom: i < displayed.length - 1 ? '1px solid #F5F3F0' : 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FAFAF9'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F5F3F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, color: '#6B6560', flexShrink: 0 }}>
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917' }}>{r.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>
                        {r.phone || <span style={{ fontStyle: 'italic', color: '#9C9894' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917' }}>
                        {r.flat_number || <span style={{ fontStyle: 'italic', color: '#9C9894' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>
                        {r.tower_name || <span style={{ fontStyle: 'italic', color: '#9C9894' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: 'Inter', fontSize: 14, color: '#9C9894' }}>
                        {fmtDate(r.created_at)}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          fontFamily: 'Inter', fontWeight: 500, fontSize: 12,
                          background: r.status === 'active' ? '#F0FDF4' : '#FFF1F2',
                          color: r.status === 'active' ? '#15803D' : '#BE123C',
                          borderRadius: 6, padding: '3px 10px',
                        }}>
                          {r.status === 'active' ? 'Active' : 'Rejected'}
                        </span>
                      </td>
                      {tab === 'active' && (
                        <td style={{ padding: '14px 20px' }}>
                          <button
                            onClick={() => setRemovingUser(r)}
                            style={{ background: 'transparent', border: 'none', color: '#9C9894', cursor: 'pointer', padding: 6, borderRadius: 6, transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9C9894'; }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {removingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setRemovingUser(null)}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.15)', width: '100%', maxWidth: 360, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, background: '#FFF1F2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: '#DC2626' }} />
              </div>
              <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 18, color: '#1C1917', margin: '0 0 8px' }}>Remove {removingUser.name}?</h3>
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#6B6560', margin: '0 0 20px', lineHeight: 1.5 }}>
                They will lose access to BlockFlow immediately.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setRemovingUser(null)} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 10, cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => removeResident(removingUser.id)} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: '#FFFFFF', background: '#DC2626', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
