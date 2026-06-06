import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, CheckCircle, XCircle, Users, Clock } from 'lucide-react';
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

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'pending',  label: 'Pending',  icon: 'pending' },
  { key: 'active',   label: 'Approved', icon: 'check_circle' },
  { key: 'rejected', label: 'Rejected', icon: 'cancel' },
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
          id, name, phone, role, status, created_at,
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
        flat_number:  r.apartment?.flat_number ?? null,
        floor_number: r.apartment?.floor_number ?? null,
        tower_name:   r.apartment?.tower?.name ?? null,
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

  // Since rows are fetched by status=tab, displayed is the full list
  const displayed    = residents;
  const pendingCount = tabCounts.pending;


  return (
    <AdminLayout>
      <div className="px-margin-desktop py-10 max-w-screen-xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Resident Management</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Review and approve resident applications for your society.
            </p>
          </div>

          {tab === 'pending' && pendingCount > 0 && (
            <button
              onClick={approveAll}
              disabled={approvingAll}
              id="approve-all-btn"
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-status-available hover:brightness-110 disabled:opacity-60 transition shadow-lg shadow-status-available/20"
            >
              {approvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {approvingAll ? 'Approving…' : `Approve All (${pendingCount})`}
            </button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-error-container/20 border border-error-container/40 rounded-2xl text-sm text-error">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl w-fit">
          {TABS.map(({ key, label, icon }) => {
            const count = tabCounts[key];
            return (
              <button
                key={key}
                id={`tab-residents-${key}`}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  tab === key
                    ? 'bg-surface-container-highest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                {label}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    key === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                    key === 'active'  ? 'bg-status-available/20 text-status-available' :
                    'bg-status-emergency/20 text-status-emergency'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Table ── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant/40 gap-3">
              <Users className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">
                {tab === 'pending' ? 'No pending applications.' :
                 tab === 'active'  ? 'No approved residents yet.' :
                 'No rejected applications.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container-lowest/60">
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Phone</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Flat</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tower</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      {tab === 'pending' ? 'Applied On' : 'Updated On'}
                    </th>
                    {tab === 'pending' && (
                      <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Actions</th>
                    )}
                    {tab === 'active' && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                    )}
                    {tab === 'rejected' && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {displayed.map(r => (
                    <tr key={r.id} className="hover:bg-surface-variant/10 transition-colors">
                    {/* Name + role badge */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary text-xs font-bold">{r.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium text-on-surface">{r.name}</p>
                            {r.role !== 'resident' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">
                                {r.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Phone / sign-in method */}
                      <td className="px-6 py-4 text-on-surface-variant">
                        {r.phone
                          ? r.phone
                          : <span className="inline-flex items-center gap-1 text-xs">
                              <img src="/google-icon.svg" alt="Google" className="w-3.5 h-3.5" />
                              <span className="text-on-surface-variant/60 italic">Google user</span>
                            </span>
                        }
                      </td>
                      {/* Flat */}
                      <td className="px-6 py-4 text-on-surface-variant">
                        {r.flat_number
                          ? <span className="font-medium text-on-surface">{r.flat_number}</span>
                          : <span className="italic text-on-surface-variant/40">—</span>}
                      </td>
                      {/* Tower */}
                      <td className="px-6 py-4 text-on-surface-variant">
                        {r.tower_name ?? <span className="italic text-on-surface-variant/40">—</span>}
                      </td>
                      {/* Date — show relative time for pending, absolute for others */}
                      <td className="px-6 py-4 text-on-surface-variant">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 opacity-50" />
                          {tab === 'pending'
                            ? <span title={fmtDate(r.created_at)}>{timeAgo(r.created_at)}</span>
                            : fmtDate(r.created_at)
                          }
                        </div>
                      </td>
                      {/* Actions (pending tab) */}
                      {tab === 'pending' && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              id={`approve-${r.id}`}
                              onClick={() => updateStatus(r.id, 'active')}
                              disabled={processingId === r.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-status-available hover:brightness-110 disabled:opacity-50 transition"
                            >
                              {processingId === r.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </button>
                            <button
                              id={`reject-${r.id}`}
                              onClick={() => updateStatus(r.id, 'rejected')}
                              disabled={processingId === r.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-status-emergency bg-status-emergency/10 border border-status-emergency/20 hover:bg-status-emergency/20 disabled:opacity-50 transition"
                            >
                              {processingId === r.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              Reject
                            </button>
                          </div>
                        </td>
                      )}
                      {/* Status badge (non-pending tabs) */}
                      {tab !== 'pending' && (
                        <td className="px-6 py-4">
                          {r.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-status-available/10 text-status-available border border-status-available/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-status-available inline-block" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-status-emergency/10 text-status-emergency border border-status-emergency/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-status-emergency inline-block" />
                              Rejected
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
