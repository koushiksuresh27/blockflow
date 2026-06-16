import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSecurityProfile } from './SecurityLayout';
import { useToast } from '../../components/Toast';
import { formatDistanceToNow, isToday } from 'date-fns';
import { Loader2, Plus, X, LogOut } from 'lucide-react';

interface StaffEntry {
  id: string;
  staff_name: string;
  staff_type: string;
  visiting_flat: string | null;
  status: string;
  entry_time: string;
  exit_time: string | null;
}

const STAFF_TYPES = ['housekeeping', 'technician', 'security', 'other'];

const staffTypeColor: Record<string, string> = {
  housekeeping: 'bg-[#F3E8FF] text-[#7C3AED]',
  technician: 'bg-[#EFF6FF] text-[#2563EB]',
  security: 'bg-yellow-100 text-yellow-700',
  other: 'bg-[#F5F3F0] text-[#6B6560]',
};

export default function StaffTab() {
  const { profile } = useSecurityProfile();
  const toast = useToast();

  const [entries, setEntries] = useState<StaffEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('housekeeping');
  const [formFlat, setFormFlat] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchEntries = async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('staff_log')
      .select('*')
      .eq('society_id', profile.societyId)
      .order('entry_time', { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [profile]);

  const handleMarkExit = async (id: string) => {
    await supabase
      .from('staff_log')
      .update({ status: 'exited', exit_time: new Date().toISOString() })
      .eq('id', id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'exited', exit_time: new Date().toISOString() } : e));
    toast('success', 'Staff member marked as exited');
  };

  const handleSubmit = async () => {
    if (!formName.trim() || !profile) return;
    setSubmitting(true);
    const { error } = await supabase.from('staff_log').insert({
      society_id: profile.societyId,
      staff_name: formName.trim(),
      staff_type: formType,
      visiting_flat: formFlat.trim() || null,
      logged_by: profile.userId,
      status: 'inside',
    });
    if (!error) {
      toast('success', 'Staff entry logged');
      setShowForm(false);
      setFormName('');
      setFormType('housekeeping');
      setFormFlat('');
      fetchEntries();
    } else {
      toast('error', 'Failed to log staff entry');
    }
    setSubmitting(false);
  };

  const inside = entries.filter(e => e.status === 'inside');
  const todayAll = entries.filter(e => isToday(new Date(e.entry_time)));

  return (
    <div className="px-4 py-5 pb-24 font-inter">
      {/* Currently Inside */}
      <h2 className="text-sm font-bold text-[#6B6560] uppercase tracking-wider mb-3 font-recoleta">
        Currently Inside ({inside.length})
      </h2>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" /></div>
      ) : inside.length === 0 ? (
        <div className="text-center py-8 text-[#9C9894] text-sm">No staff currently inside</div>
      ) : (
        <div className="space-y-3 mb-6">
          {inside.map(entry => (
            <div key={entry.id} className="bg-[#FFFFFF] rounded-[16px] p-4 shadow-none border border-[#E0DDD9] flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-[#1C1917] font-recoleta">{entry.staff_name}</h3>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-[6px] ${staffTypeColor[entry.staff_type] ?? 'bg-[#F5F3F0] text-[#6B6560]'}`}>
                    {entry.staff_type}
                  </span>
                </div>
                {entry.visiting_flat && <p className="text-sm text-[#6B6560]">Flat: {entry.visiting_flat}</p>}
                <p className="text-xs text-[#9C9894] mt-0.5">Entered {formatDistanceToNow(new Date(entry.entry_time))} ago</p>
              </div>
              <button
                onClick={() => handleMarkExit(entry.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#7C3AED] border border-[#E9D5FF] rounded-[10px] hover:bg-[#F3E8FF] transition shrink-0"
              >
                <LogOut className="w-4 h-4" />
                Exit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Today's staff log */}
      <h2 className="text-sm font-bold text-[#6B6560] uppercase tracking-wider mb-3 font-recoleta">
        Today's Log ({todayAll.length})
      </h2>
      <div className="space-y-2">
        {todayAll.map(entry => (
          <div key={entry.id} className="bg-[#FFFFFF] rounded-[10px] px-4 py-3 shadow-none border border-[#E0DDD9] flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#1C1917] font-recoleta">{entry.staff_name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[6px] ${staffTypeColor[entry.staff_type] ?? 'bg-[#F5F3F0] text-[#6B6560]'}`}>
                  {entry.staff_type}
                </span>
              </div>
              <p className="text-[11px] text-[#9C9894] mt-0.5">
                {new Date(entry.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {entry.exit_time ? ` → ${new Date(entry.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' → Still inside'}
              </p>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-[6px] ${
              entry.status === 'inside' ? 'bg-green-100 text-green-700' : 'bg-[#F5F3F0] text-[#6B6560]'
            }`}>
              {entry.status}
            </span>
          </div>
        ))}
      </div>

      {/* Floating button */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-[84px] left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[440px] h-12 bg-[#7C3AED] text-[#FFFFFF] font-bold rounded-[10px] flex items-center justify-center gap-2 shadow-none hover:bg-[#6D28D9] transition-all z-20"
      >
        <Plus className="w-5 h-5" />
        Log Staff Entry
      </button>

      {/* Form sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[480px] bg-[#FFFFFF] rounded-t-[16px] p-6 animate-[slideUp_0.3s_ease-out] font-inter">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold font-recoleta text-[#1C1917]">Log Staff Entry</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-[#F5F3F0] rounded-full">
                <X className="w-5 h-5 text-[#6B6560]" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1C1917] mb-1">Staff Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Full name"
                  className="w-full border border-[#E0DDD9] bg-[#F5F3F0] rounded-[10px] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1C1917] mb-1">Type</label>
                <div className="flex flex-wrap gap-2">
                  {STAFF_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setFormType(t)}
                      className={`px-3 py-1.5 rounded-[6px] text-sm font-medium border capitalize transition ${
                        formType === t ? 'border-[#7C3AED] bg-[#F3E8FF] text-[#7C3AED]' : 'border-[#E0DDD9] text-[#6B6560] hover:bg-[#F5F3F0]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1C1917] mb-1">Visiting Flat (optional)</label>
                <input
                  type="text"
                  value={formFlat}
                  onChange={e => setFormFlat(e.target.value)}
                  placeholder="e.g. B-102"
                  className="w-full border border-[#E0DDD9] bg-[#F5F3F0] rounded-[10px] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formName.trim()}
                className="w-full h-14 bg-[#7C3AED] text-[#FFFFFF] font-bold rounded-[10px] hover:bg-[#6D28D9] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                Log Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
