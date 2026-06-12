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
    <div className="flex gap-2 justify-center my-6">
      {otp.split('').map((digit, i) => (
        <div
          key={i}
          className="w-12 h-16 bg-[#1C1917] border border-[#2C2925] rounded-[10px] flex items-center justify-center text-3xl font-display font-bold text-white shadow-lg"
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
    <div className="px-5 py-6 pb-24 min-h-full bg-[#F5F3F0]">
      <div className="flex justify-between items-center mb-6 mt-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-[#1C1917]">Gate Passes</h2>
          <p className="text-sm font-sans text-[#6B6560] mt-0.5">Generate codes for your visitors</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#1C1917] text-white px-4 py-2.5 rounded-button text-sm font-sans font-bold hover:bg-[#2C2925] transition shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4" />
          New Pass
        </button>
      </div>

      {/* New pass result card */}
      {newPass && (
        <div className="bg-white border-2 border-[#1C1917] rounded-card p-6 mb-6 shadow-xl relative overflow-hidden animate-[slideUp_0.3s_ease-out]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D97706]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="text-center relative z-10">
            <p className="text-sm font-sans font-semibold text-[#6B6560] uppercase tracking-wide">Share this code</p>
            <OtpDisplay otp={newPass.otp} />
          </div>
          <div className="text-center text-sm font-sans text-[#1C1917] space-y-1 mb-6 relative z-10 bg-[#F5F3F0] p-4 rounded-xl border border-[#E0DDD9]">
            <p className="font-bold text-base">{newPass.visitor_name}</p>
            <p className="text-[#6B6560]">Valid until: {format(new Date(newPass.valid_until), 'dd MMM yyyy, h:mm a')}</p>
          </div>
          <div className="flex gap-3 relative z-10">
            <button
              onClick={() => handleCopyOtp(newPass.otp)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-button border border-[#E0DDD9] bg-white text-[#1C1917] font-sans font-semibold text-sm hover:bg-[#F5F3F0] transition active:scale-95"
            >
              <Copy className="w-4 h-4" />
              Copy Code
            </button>
            <button
              onClick={() => handleShareWhatsApp(newPass)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-button bg-green-600 text-white font-sans font-semibold text-sm hover:bg-green-700 transition active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
          <button
            onClick={() => setNewPass(null)}
            className="w-full mt-4 py-2 text-sm font-sans text-[#9C9894] hover:text-[#6B6560] transition relative z-10"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active passes list */}
      <h3 className="text-xs font-display font-bold text-[#9C9894] uppercase tracking-widest mb-3 pl-1">Active Passes</h3>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#1C1917]" /></div>
      ) : passes.length === 0 ? (
        <div className="bg-white rounded-card p-8 text-center border border-[#E0DDD9] shadow-sm">
          <p className="text-3xl mb-3">🎫</p>
          <p className="text-sm font-sans text-[#6B6560]">No active passes. Generate one for your visitor.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {passes.map(pass => (
            <div key={pass.id} className="bg-white rounded-card p-4 shadow-sm border border-[#E0DDD9] relative group">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                  <h4 className="font-display font-bold text-lg text-[#1C1917] leading-none">{pass.visitor_name}</h4>
                  {pass.purpose && <p className="text-sm font-sans text-[#6B6560] mt-1">{pass.purpose}</p>}
                  <p className="text-xs font-sans text-[#9C9894] mt-2">
                    Valid: {format(new Date(pass.valid_until), 'dd MMM, h:mm a')}
                  </p>
                </div>
                <button
                  onClick={() => handleCancelPass(pass.id)}
                  className="p-2 text-[#9C9894] hover:text-red-500 hover:bg-red-50 rounded-xl transition absolute top-3 right-3"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-[#E0DDD9]">
                <div className="flex gap-1.5">
                  {pass.otp.split('').map((d, i) => (
                    <div key={i} className="w-8 h-10 bg-[#F5F3F0] border border-[#E0DDD9] rounded-[6px] flex items-center justify-center font-display font-bold text-[#1C1917] text-base">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleCopyOtp(pass.otp)}
                    className="p-2.5 text-[#6B6560] hover:text-[#1C1917] hover:bg-[#F5F3F0] rounded-xl transition"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleShareWhatsApp(pass)}
                    className="p-2.5 text-[#6B6560] hover:text-green-600 hover:bg-green-50 rounded-xl transition"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create pass modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1C1917]/50 backdrop-blur-sm">
          <div className="w-full max-w-[480px] bg-white rounded-t-[24px] p-6 animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-display font-bold text-[#1C1917]">Generate Gate Pass</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-[#F5F3F0] rounded-full transition">
                <X className="w-5 h-5 text-[#6B6560]" />
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-sans font-semibold text-[#1C1917] mb-1.5">Visitor Name <span className="text-[#D97706]">*</span></label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full border border-[#E0DDD9] bg-[#F5F3F0] rounded-button px-4 py-3.5 text-[#1C1917] font-sans placeholder:text-[#9C9894] focus:outline-none focus:ring-2 focus:ring-[#1C1917] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-semibold text-[#1C1917] mb-1.5">Phone (optional)</label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full border border-[#E0DDD9] bg-[#F5F3F0] rounded-button px-4 py-3.5 text-[#1C1917] font-sans placeholder:text-[#9C9894] focus:outline-none focus:ring-2 focus:ring-[#1C1917] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-semibold text-[#1C1917] mb-1.5">Purpose (optional)</label>
                <input
                  type="text"
                  value={formPurpose}
                  onChange={e => setFormPurpose(e.target.value)}
                  placeholder="Delivery, Guest, Service…"
                  className="w-full border border-[#E0DDD9] bg-[#F5F3F0] rounded-button px-4 py-3.5 text-[#1C1917] font-sans placeholder:text-[#9C9894] focus:outline-none focus:ring-2 focus:ring-[#1C1917] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-semibold text-[#1C1917] mb-2">Valid For</label>
                <div className="flex gap-2 bg-[#F5F3F0] p-1 rounded-button">
                  {VALIDITY_OPTIONS.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setFormValidity(i)}
                      className={`flex-1 py-2.5 rounded-[8px] text-sm font-sans font-semibold transition ${
                        formValidity === i 
                        ? 'bg-white text-[#1C1917] shadow-sm' 
                        : 'text-[#6B6560] hover:text-[#1C1917]'
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
                className="w-full h-14 bg-[#1C1917] text-white font-sans font-bold rounded-button hover:bg-[#2C2925] disabled:opacity-50 flex items-center justify-center gap-2 mt-4 active:scale-95 transition-transform"
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
