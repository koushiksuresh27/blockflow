import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSecurityProfile } from './SecurityLayout';
import { useToast } from '../../components/Toast';
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GatePassResult {
  id: string;
  visitor_name: string;
  purpose: string | null;
  valid_until: string;
  resident_id: string;
  users: {
    name: string;
    apartments: {
      flat_number: string;
      towers: { name: string };
    } | null;
  } | null;
}

// ─── OTP Input ────────────────────────────────────────────────────────────────

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = digit;
    const next = arr.join('').padEnd(6, ' ').slice(0, 6);
    onChange(next.trimEnd());
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!value[i] && i > 0) {
        inputs.current[i - 1]?.focus();
        const arr = value.split('');
        arr[i - 1] = '';
        onChange(arr.join(''));
      } else {
        const arr = value.split('');
        arr[i] = '';
        onChange(arr.join(''));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el; }}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-[10px] focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D5FF] bg-[#FFFFFF] transition-all text-[#1C1917] border-[#E0DDD9]"
        />
      ))}
    </div>
  );
}

// ─── Verify Tab ───────────────────────────────────────────────────────────────

export default function VerifyTab() {
  const { profile } = useSecurityProfile();
  const toast = useToast();

  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [foundPass, setFoundPass] = useState<GatePassResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Emergency state
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyDesc, setEmergencyDesc] = useState('');
  const [sendingEmergency, setSendingEmergency] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6 || !profile) return;
    setVerifying(true);
    setFoundPass(null);
    setNotFound(false);

    const { data: pass, error } = await supabase
      .from('gate_passes')
      .select('*, users!resident_id(name, apartments(flat_number, towers(name)))')
      .eq('otp', otp)
      .eq('status', 'pending')
      .eq('society_id', profile.societyId)
      .gte('valid_until', new Date().toISOString())
      .single();

    setVerifying(false);
    if (error || !pass) {
      setNotFound(true);
    } else {
      setFoundPass(pass as any);
    }
  };

  const reset = () => {
    setOtp('');
    setFoundPass(null);
    setNotFound(false);
  };

  const handleAllow = async () => {
    if (!foundPass || !profile) return;
    setProcessing(true);
    const apt = foundPass.users?.apartments;

    await supabase.from('gate_passes').update({ status: 'approved' }).eq('id', foundPass.id);
    await supabase.from('visitor_log').insert({
      society_id: profile.societyId,
      visitor_name: foundPass.visitor_name,
      visiting_flat: apt ? `${apt.towers?.name}-${apt.flat_number}` : null,
      resident_id: foundPass.resident_id,
      gate_pass_id: foundPass.id,
      entry_type: 'pre_approved',
      logged_by: profile.userId,
      purpose: foundPass.purpose,
      status: 'inside',
    });

    toast('success', 'Entry allowed ✅');
    setProcessing(false);
    reset();
  };

  const handleDeny = async () => {
    if (!foundPass) return;
    setProcessing(true);
    await supabase.from('gate_passes').update({ status: 'denied' }).eq('id', foundPass.id);
    toast('error', 'Entry denied ❌');
    setProcessing(false);
    reset();
  };

  const handleEmergency = async () => {
    if (!profile) return;
    setSendingEmergency(true);
    await supabase.from('alerts').insert({
      type: 'emergency',
      title: 'EMERGENCY at Main Gate',
      body: emergencyDesc.trim() || 'Emergency reported by security staff',
      sent_by: profile.userId,
      society_id: profile.societyId,
    });
    toast('success', 'Emergency alert sent to all admins!');
    setSendingEmergency(false);
    setShowEmergency(false);
    setEmergencyDesc('');
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-130px)] pb-6 font-inter">
      {/* Main verify area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {!foundPass && !notFound && (
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#F3E8FF] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔍</span>
              </div>
              <h2 className="text-xl font-bold text-[#1C1917] font-recoleta">Verify Gate Pass</h2>
              <p className="text-sm text-[#6B6560] mt-1">Enter 6-digit code from resident</p>
            </div>

            <OtpInput value={otp} onChange={setOtp} />

            <button
              onClick={handleVerify}
              disabled={otp.length !== 6 || verifying}
              className="w-full mt-8 h-14 bg-[#7C3AED] text-[#FFFFFF] font-bold text-base rounded-[10px] disabled:opacity-40 hover:bg-[#6D28D9] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-none"
            >
              {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : ''}
              {verifying ? 'Verifying…' : 'Verify Pass'}
            </button>
          </div>
        )}

        {/* Valid pass card */}
        {foundPass && (
          <div className="w-full max-w-sm">
            <div className="bg-green-50 border border-green-200 rounded-[16px] p-6 mb-5 animate-[slideUp_0.3s_ease-out]">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <span className="font-bold text-green-800 text-lg">Valid Pass</span>
              </div>
              <h3 className="text-2xl font-bold text-[#1C1917] font-recoleta mb-4">{foundPass.visitor_name}</h3>
              <div className="space-y-2 text-sm text-[#1C1917]">
                {foundPass.purpose && (
                  <div className="flex gap-2">
                    <span className="text-[#6B6560] w-24 shrink-0">Purpose:</span>
                    <span className="font-medium">{foundPass.purpose}</span>
                  </div>
                )}
                {foundPass.users?.apartments && (
                  <div className="flex gap-2">
                    <span className="text-[#6B6560] w-24 shrink-0">Visiting:</span>
                    <span className="font-medium">
                      Flat {foundPass.users.apartments.flat_number}, {foundPass.users.apartments.towers?.name}
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-[#6B6560] w-24 shrink-0">Approved by:</span>
                  <span className="font-medium">{foundPass.users?.name ?? 'Resident'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#6B6560] w-24 shrink-0">Valid until:</span>
                  <span className="font-medium">{format(new Date(foundPass.valid_until), 'dd MMM, h:mm a')}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAllow}
                disabled={processing}
                className="w-full h-14 bg-green-600 text-white font-bold rounded-[10px] hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-none"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : '✅'}
                Allow Entry
              </button>
              <button
                onClick={handleDeny}
                disabled={processing}
                className="w-full h-14 bg-red-600 text-white font-bold rounded-[10px] hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                ❌ Deny Entry
              </button>
              <button onClick={reset} className="w-full h-10 text-[#6B6560] text-sm underline">
                Try another code
              </button>
            </div>
          </div>
        )}

        {/* Not found */}
        {notFound && (
          <div className="w-full max-w-sm">
            <div className="bg-red-50 border border-red-200 rounded-[16px] p-8 text-center mb-5 animate-[slideUp_0.3s_ease-out]">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="font-bold text-red-800 text-lg mb-1 font-recoleta">Invalid or Expired Pass</h3>
              <p className="text-sm text-red-600">The code was not found or has already been used.</p>
            </div>
            <button
              onClick={reset}
              className="w-full h-14 bg-[#1C1917] text-[#FFFFFF] font-bold rounded-[10px] hover:bg-[#2C2925] transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Emergency button */}
      <div className="px-5 pb-2">
        <button
          onClick={() => setShowEmergency(true)}
          className="w-full h-12 bg-red-600 text-white font-bold rounded-[10px] hover:bg-red-700 active:scale-[0.98] transition-all text-sm shadow-none flex items-center justify-center gap-2"
        >
          EMERGENCY ALERT
        </button>
      </div>

      {/* Emergency sheet */}
      {showEmergency && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[480px] bg-[#FFFFFF] rounded-t-[16px] p-6 animate-[slideUp_0.3s_ease-out] font-inter">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-red-700 font-recoleta">🚨 Emergency Alert</h3>
              <button onClick={() => setShowEmergency(false)} className="p-2 hover:bg-[#F5F3F0] rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#6B6560] mb-4">Send emergency alert to all admins?</p>
            <textarea
              value={emergencyDesc}
              onChange={e => setEmergencyDesc(e.target.value)}
              placeholder="Describe the emergency (optional)…"
              rows={3}
              className="w-full border border-[#E0DDD9] bg-[#F5F3F0] rounded-[10px] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-4 text-[#1C1917]"
            />
            <button
              onClick={handleEmergency}
              disabled={sendingEmergency}
              className="w-full h-14 bg-red-600 text-white font-bold rounded-[10px] hover:bg-red-700 flex items-center justify-center gap-2"
            >
              {sendingEmergency ? <Loader2 className="w-5 h-5 animate-spin" /> : '🚨'}
              CONFIRM EMERGENCY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
