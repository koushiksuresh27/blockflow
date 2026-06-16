import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSecurityProfile } from './SecurityLayout';
import { Loader2, User, Wrench } from 'lucide-react';

interface LogEntry {
  id: string;
  name: string;
  kind: 'visitor' | 'staff';
  type: string;
  flat: string | null;
  entry_time: string;
  exit_time: string | null;
  status: string;
}

const FILTERS = ['All', 'Visitors', 'Staff', 'Pre-approved', 'Walk-in'] as const;
type Filter = typeof FILTERS[number];

export default function LogTab() {
  const { profile } = useSecurityProfile();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('All');

  useEffect(() => {
    if (!profile) return;
    fetchLog();
  }, [profile]);

  const fetchLog = async () => {
    if (!profile) return;
    setLoading(true);

    const todayStr = new Date();
    todayStr.setHours(0, 0, 0, 0);

    const [{ data: visitors }, { data: staff }] = await Promise.all([
      supabase
        .from('visitor_log')
        .select('*')
        .eq('society_id', profile.societyId)
        .gte('entry_time', todayStr.toISOString()),
      supabase
        .from('staff_log')
        .select('*')
        .eq('society_id', profile.societyId)
        .gte('entry_time', todayStr.toISOString()),
    ]);

    const visitorEntries: LogEntry[] = (visitors ?? []).map(v => ({
      id: v.id,
      name: v.visitor_name,
      kind: 'visitor',
      type: v.entry_type,
      flat: v.visiting_flat,
      entry_time: v.entry_time,
      exit_time: v.exit_time,
      status: v.status,
    }));

    const staffEntries: LogEntry[] = (staff ?? []).map(s => ({
      id: s.id,
      name: s.staff_name,
      kind: 'staff',
      type: s.staff_type,
      flat: s.visiting_flat,
      entry_time: s.entry_time,
      exit_time: s.exit_time,
      status: s.status,
    }));

    const merged = [...visitorEntries, ...staffEntries].sort(
      (a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime()
    );
    setEntries(merged);
    setLoading(false);
  };

  const filtered = entries.filter(e => {
    if (filter === 'All') return true;
    if (filter === 'Visitors') return e.kind === 'visitor';
    if (filter === 'Staff') return e.kind === 'staff';
    if (filter === 'Pre-approved') return e.type === 'pre_approved';
    if (filter === 'Walk-in') return e.type === 'walk_in';
    return true;
  });

  const insideNow = entries.filter(e => e.status === 'inside').length;
  const enteredToday = entries.length;
  const exitedToday = entries.filter(e => e.status === 'exited').length;

  const fmtTime = (t: string) =>
    new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="px-4 py-5 pb-20 font-inter">
      {/* Stats bar */}
      <div className="flex gap-3 mb-5">
        {[
          { label: 'Inside Now', value: insideNow, color: 'text-green-600 bg-green-50 border-green-100' },
          { label: 'Entered Today', value: enteredToday, color: 'text-[#7C3AED] bg-[#F3E8FF] border-[#E9D5FF]' },
          { label: 'Exited Today', value: exitedToday, color: 'text-[#6B6560] bg-[#F5F3F0] border-[#E0DDD9]' },
        ].map(stat => (
          <div key={stat.label} className={`flex-1 rounded-[16px] border p-3 text-center ${stat.color}`}>
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-[10px] font-medium mt-0.5 leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-[6px] text-xs font-semibold border transition ${
              filter === f ? 'bg-[#7C3AED] text-[#FFFFFF] border-[#7C3AED]' : 'bg-[#FFFFFF] text-[#6B6560] border-[#E0DDD9] hover:bg-[#F5F3F0]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#9C9894]">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-sm">No entries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => (
            <div key={entry.id} className="bg-[#FFFFFF] rounded-[16px] px-4 py-3 shadow-none border border-[#E0DDD9] flex items-center gap-3">
              <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${
                entry.kind === 'visitor' ? 'bg-[#F3E8FF] text-[#7C3AED]' : 'bg-orange-50 text-orange-600'
              }`}>
                {entry.kind === 'visitor' ? <User className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-[#1C1917] font-recoleta truncate">{entry.name}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[6px] shrink-0 ${
                    entry.kind === 'visitor' && entry.type === 'pre_approved' ? 'bg-[#F3E8FF] text-[#7C3AED]' :
                    entry.kind === 'visitor' ? 'bg-orange-100 text-orange-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {entry.type === 'pre_approved' ? 'Pre-approved' : entry.type === 'walk_in' ? 'Walk-in' : entry.type}
                  </span>
                </div>
                {entry.flat && <p className="text-xs text-[#6B6560]">Flat {entry.flat}</p>}
                <p className="text-[11px] text-[#9C9894]">
                  {fmtTime(entry.entry_time)}
                  {entry.exit_time ? ` → ${fmtTime(entry.exit_time)}` : ' → Still inside'}
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-[6px] shrink-0 ${
                entry.status === 'inside' ? 'bg-green-100 text-green-700' : 'bg-[#F5F3F0] text-[#6B6560]'
              }`}>
                {entry.status === 'inside' ? 'Inside' : 'Exited'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
