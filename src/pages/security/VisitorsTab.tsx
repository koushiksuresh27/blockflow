import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSecurityProfile } from './SecurityLayout';
import { useToast } from '../../components/Toast';
import { formatDistanceToNow, isToday } from 'date-fns';
import { Loader2, Plus, X, LogOut } from 'lucide-react';

interface VisitorEntry {
  id: string;
  visitor_name: string;
  visiting_flat: string | null;
  entry_type: string;
  status: string;
  entry_time: string;
  exit_time: string | null;
  purpose: string | null;
}

export default function VisitorsTab() {
  const { profile } = useSecurityProfile();
  const toast = useToast();

  const [subTab, setSubTab] = useState<'inside' | 'today'>('inside');
  const [entries, setEntries] = useState<VisitorEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [showWalkin, setShowWalkin] = useState(false);
  const [walkinName, setWalkinName] = useState('');
  const [walkinFlat, setWalkinFlat] = useState('');
  const [walkinPurpose, setWalkinPurpose] = useState('');
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);

  const fetchEntries = async () => {
    if (!profile) return;
    setLoading(true);

    const { data } = await supabase
      .from('visitor_log')
      .select('*')
      .eq('society_id', profile.societyId)
      .order('entry_time', { ascending: false });

    setEntries(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, [profile]);

  const handleMarkExit = async (id: string) => {
    await supabase
      .from('visitor_log')
      .update({ status: 'exited', exit_time: new Date().toISOString() })
      .eq('id', id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'exited', exit_time: new Date().toISOString() } : e));
    toast('success', 'Visitor marked as exited');
  };

  const handleWalkin = async () => {
    if (!walkinName.trim() || !profile) return;
    setWalkinSubmitting(true);

    const { error } = await supabase.from('visitor_log').insert({
      society_id: profile.societyId,
      visitor_name: walkinName.trim(),
      visiting_flat: walkinFlat.trim() || null,
      purpose: walkinPurpose.trim() || null,
      entry_type: 'walk_in',
      logged_by: profile.userId,
      status: 'inside',
    });

    if (!error) {
      toast('success', 'Walk-in visitor logged');
      setShowWalkin(false);
      setWalkinName('');
      setWalkinFlat('');
      setWalkinPurpose('');
      fetchEntries();
    } else {
      toast('error', 'Failed to log visitor');
    }
    setWalkinSubmitting(false);
  };

  const inside = entries.filter(e => e.status === 'inside');
  const todayAll = entries.filter(e => isToday(new Date(e.entry_time)));

  const displayed = subTab === 'inside' ? inside : todayAll;

  return (
    <div className="px-4 py-5 pb-20">
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-5 bg-gray-100 rounded-2xl p-1">
        {(['inside', 'today'] as const).map(key => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition ${
              subTab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            {key === 'inside' ? `Currently Inside (${inside.length})` : "Today's Log"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <span className="text-4xl block mb-2">👥</span>
          <p className="text-sm">{subTab === 'inside' ? 'No visitors currently inside' : 'No visitors logged today'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(entry => (
            <div key={entry.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{entry.visitor_name}</h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      entry.entry_type === 'pre_approved' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {entry.entry_type === 'pre_approved' ? 'Pre-approved' : 'Walk-in'}
                    </span>
                  </div>
                  {entry.visiting_flat && (
                    <p className="text-sm text-gray-500">Flat: {entry.visiting_flat}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Entered {formatDistanceToNow(new Date(entry.entry_time))} ago
                    {entry.exit_time && ` · Exited ${formatDistanceToNow(new Date(entry.exit_time))} ago`}
                  </p>
                </div>
                {entry.status === 'inside' && (
                  <button
                    onClick={() => handleMarkExit(entry.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    Exit
                  </button>
                )}
                {entry.status === 'exited' && (
                  <span className="text-[10px] font-bold uppercase px-2 py-1 bg-gray-100 text-gray-500 rounded-full">Exited</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Add Walk-in Button */}
      <button
        onClick={() => setShowWalkin(true)}
        className="fixed bottom-[84px] left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[440px] h-12 bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all z-20"
      >
        <Plus className="w-5 h-5" />
        Log Walk-in Visitor
      </button>

      {/* Walk-in sheet */}
      {showWalkin && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[480px] bg-white rounded-t-3xl p-6 animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">Log Walk-in Visitor</h3>
              <button onClick={() => setShowWalkin(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Name *</label>
                <input
                  type="text"
                  value={walkinName}
                  onChange={e => setWalkinName(e.target.value)}
                  placeholder="Full name"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visiting Flat</label>
                <input
                  type="text"
                  value={walkinFlat}
                  onChange={e => setWalkinFlat(e.target.value)}
                  placeholder="e.g. A-704"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <input
                  type="text"
                  value={walkinPurpose}
                  onChange={e => setWalkinPurpose(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleWalkin}
                disabled={walkinSubmitting || !walkinName.trim()}
                className="w-full h-14 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {walkinSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                Log Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
