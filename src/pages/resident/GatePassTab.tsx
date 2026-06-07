import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { format, endOfDay, addDays } from 'date-fns';
import { Loader2, Copy, Share2, X, Plus, Trash2 } from 'lucide-react';

interface GatePass {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  purpose: string | null;
  otp: string;
  status: string;
  valid_until: string;
  created_at: string;
}

const VALIDITY_OPTIONS = [
  { label: 'Today', getValue: () => endOfDay(new Date()) },
  { label: 'Tomorrow', getValue: () => endOfDay(addDays(new Date(), 1)) },
  { label: 'In 2 days', getValue: () => endOfDay(addDays(new Date(), 2)) },
];

function OtpDisplay({ otp }: { otp: string }) {
  return (
    <div className="flex gap-2 justify-center">
      {otp.split('').map((digit, i) => (
        <div
          key={i}
          className="w-11 h-14 bg-white border-2 border-blue-200 rounded-xl flex items-center justify-center text-2xl font-bold text-blue-700 shadow-sm"
        >
          {digit}
        </div>
      ))}
    </div>
  );
}

export default function GatePassTab() {
  const toast = useToast();

  const [passes, setPasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPurpose, setFormPurpose] = useState('');
  const [formValidity, setFormValidity] = useState(0); // index of VALIDITY_OPTIONS
  const [creating, setCreating] = useState(false);

  const [newPass, setNewPass] = useState<GatePass | null>(null);

  const fetchPasses = async (uid: string) => {
    const { data } = await supabase
      .from('gate_passes')
      .select('*')
      .eq('resident_id', uid)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPasses(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        supabase.from('users').select('society_id').eq('id', user.id).single().then(({ data }) => {
          setSocietyId(data?.society_id ?? null);
        });
        fetchPasses(user.id);
      }
    });
  }, []);

  const handleCreate = async () => {
    if (!formName.trim() || !userId || !societyId) return;
    setCreating(true);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const validUntil = VALIDITY_OPTIONS[formValidity].getValue();

    const { data, error } = await supabase
      .from('gate_passes')
      .insert({
        resident_id: userId,
        society_id: societyId,
        visitor_name: formName.trim(),
        visitor_phone: formPhone.trim() || null,
        purpose: formPurpose.trim() || null,
        otp,
        valid_until: validUntil.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    setCreating(false);
    if (error) {
      toast('error', 'Failed to create gate pass');
      return;
    }

    setNewPass(data);
    setShowCreate(false);
    setFormName('');
    setFormPhone('');
    setFormPurpose('');
    fetchPasses(userId);
  };

  const handleCancelPass = async (passId: string) => {
    await supabase.from('gate_passes').update({ status: 'expired' }).eq('id', passId);
    setPasses(prev => prev.filter(p => p.id !== passId));
    toast('success', 'Pass cancelled');
  };

  const handleCopyOtp = (otp: string) => {
    navigator.clipboard.writeText(otp);
    toast('success', 'OTP copied to clipboard!');
  };

  const handleShareWhatsApp = (pass: GatePass) => {
    const validStr = format(new Date(pass.valid_until), 'dd MMM, h:mm a');
    const msg = encodeURIComponent(
      `Your gate pass for BlockFlow Society: ${pass.otp}\nShow this code to security at the gate.\nValid until: ${validStr}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="px-5 py-6 pb-24 min-h-full bg-gray-50">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gate Passes</h2>
          <p className="text-sm text-gray-500 mt-0.5">Generate codes for your visitors</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition shadow-md shadow-blue-100"
        >
          <Plus className="w-4 h-4" />
          New Pass
        </button>
      </div>

      {/* New pass result card */}
      {newPass && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-5 mb-5 shadow-sm">
          <div className="text-center mb-4">
            <p className="text-sm font-semibold text-blue-700 mb-3">Share this code with your visitor</p>
            <OtpDisplay otp={newPass.otp} />
          </div>
          <div className="text-center text-sm text-gray-700 space-y-1 my-4">
            <p className="font-semibold">Visitor: {newPass.visitor_name}</p>
            <p className="text-gray-500">Valid until: {format(new Date(newPass.valid_until), 'dd MMM yyyy, h:mm a')}</p>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleCopyOtp(newPass.otp)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-blue-300 bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 transition"
            >
              <Copy className="w-4 h-4" />
              Copy Code
            </button>
            <button
              onClick={() => handleShareWhatsApp(newPass)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition"
            >
              <Share2 className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
          <button
            onClick={() => setNewPass(null)}
            className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active passes list */}
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Active Passes</h3>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : passes.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
          <p className="text-2xl mb-2">🎫</p>
          <p className="text-sm text-gray-400">No active passes. Generate one for your visitor.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {passes.map(pass => (
            <div key={pass.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start gap-3 mb-3">
                <div>
                  <h4 className="font-bold text-gray-900">{pass.visitor_name}</h4>
                  {pass.purpose && <p className="text-sm text-gray-500 mt-0.5">{pass.purpose}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    Valid until: {format(new Date(pass.valid_until), 'dd MMM, h:mm a')}
                  </p>
                </div>
                <button
                  onClick={() => handleCancelPass(pass.id)}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {pass.otp.split('').map((d, i) => (
                    <div key={i} className="w-8 h-9 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center font-bold text-gray-800 text-sm">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyOtp(pass.otp)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleShareWhatsApp(pass)}
                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-xl transition"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create pass modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-[480px] bg-white rounded-t-3xl p-6 animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">Generate Gate Pass</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose (optional)</label>
                <input
                  type="text"
                  value={formPurpose}
                  onChange={e => setFormPurpose(e.target.value)}
                  placeholder="Delivery, Guest, Service…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valid For</label>
                <div className="flex gap-2">
                  {VALIDITY_OPTIONS.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setFormValidity(i)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                        formValidity === i ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !formName.trim()}
                className="w-full h-14 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {creating && <Loader2 className="w-5 h-5 animate-spin" />}
                Generate Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
