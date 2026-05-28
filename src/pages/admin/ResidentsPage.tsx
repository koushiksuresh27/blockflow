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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResidentsPage() {
  const toast = useToast();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [tab, setTab]               = useState<TabKey>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);


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


      let query = supabase
        .from('users')
        .select(`
          id, name, phone, status, created_at,
          apartment:apartments!apartment_id(
            flat_number, floor_number,
            tower:towers!tower_id(name)
          )
        `)
        .eq('role', 'resident')
        .order('created_at', { ascending: false });

      if (sid) {
        query = query.eq('society_id', sid);
      }

      const { data, error: e } = await query;
      if (e) throw new Error(e.message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResidents((data ?? []).map((r: any) => ({
        id:           r.id,
        name:         r.name,
        phone:        r.phone,
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
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime on user status changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-residents-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const updateStatus = async (id: string, newStatus: 'active' | 'rejected') => {
    setProcessingId(id);
    try {
      const { error: e } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', id);
      if (e) throw new Error(e.message);
      setResidents(prev =>
        prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
      );
      toast('success', newStatus === 'active' ? 'Resident Approved' : 'Resident Rejected',
        newStatus === 'active' ? 'The resident now has full access.' : 'Resident application has been rejected.');
    } catch (e: unknown) {
      toast('error', 'Update failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setProcessingId(null);
    }
  };

  const approveAll = async () => {
    const pending = residents.filter(r => r.status === 'pending');
    if (pending.length === 0) return;
    setApprovingAll(true);
    try {
      const ids = pending.map(r => r.id);
      const { error: e } = await supabase
        .from('users')
        .update({ status: 'active' })
        .in('id', ids);
      if (e) throw new Error(e.message);
      setResidents(prev =>
        prev.map(r => ids.includes(r.id) ? { ...r, status: 'active' as const } : r)
      );
      toast('success', 'All Approved', `${ids.length} resident${ids.length !== 1 ? 's' : ''} approved successfully.`);
    } catch (e: unknown) {
      toast('error', 'Approve All failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setApprovingAll(false);
    }
  };

  const displayed = residents.filter(r => r.status === tab);
  const pendingCount = residents.filter(r => r.status === 'pending').length;


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
            const count = residents.filter(r => r.status === key).length;
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
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary text-xs font-bold">{r.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="font-medium text-on-surface">{r.name}</span>
                        </div>
                      </td>
                      {/* Phone */}
                      <td className="px-6 py-4 text-on-surface-variant">
                        {r.phone ?? <span className="italic text-on-surface-variant/40">—</span>}
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
                      {/* Date */}
                      <td className="px-6 py-4 text-on-surface-variant">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 opacity-50" />
                          {fmtDate(r.created_at)}
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
