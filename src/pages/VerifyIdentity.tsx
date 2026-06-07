import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ShieldCheck, UserPlus, Phone, ArrowLeft, CheckCircle2 } from 'lucide-react';

type Step = 'choice' | 'phone-verify' | 'new-resident';

export default function VerifyIdentity() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('choice');
  const [phone, setPhone] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [creatingResident, setCreatingResident] = useState(false);

  const handlePhoneVerify = async () => {
    if (!phone.trim()) return;
    setVerifying(true);
    setPhoneError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/login', { replace: true }); return; }

    const { data: preCreated } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone.trim())
      .in('role', ['technician', 'security'])
      .eq('status', 'active')
      .maybeSingle();

    if (!preCreated) {
      setPhoneError('No account found with this number. Contact your admin.');
      setVerifying(false);
      return;
    }

    await supabase
      .from('users')
      .update({ id: session.user.id })
      .eq('id', preCreated.id);

    setVerifying(false);

    switch (preCreated.role) {
      case 'technician': navigate('/technician', { replace: true }); break;
      case 'security':   navigate('/security',   { replace: true }); break;
    }
  };

  const handleNewResident = async () => {
    setCreatingResident(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/login', { replace: true }); return; }

    const { data: society } = await supabase
      .from('societies')
      .select('id')
      .limit(1)
      .maybeSingle();

    await supabase.from('users').insert({
      id: session.user.id,
      name: session.user.user_metadata?.full_name || session.user.email,
      role: 'resident',
      status: 'pending',
      society_id: society?.id || null,
    });

    navigate('/pending', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-[0_8px_30px_rgba(37,99,235,0.35)]">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
        </div>

        {/* ── Choice Screen ─────────────────────────────────── */}
        {step === 'choice' && (
          <div className="bg-white rounded-3xl shadow-xl p-7">
            <h1 className="text-xl font-bold text-gray-900 text-center mb-1">Welcome to BlockFlow</h1>
            <p className="text-sm text-gray-500 text-center mb-8">How would you like to continue?</p>

            <div className="space-y-3">
              <button
                onClick={() => setStep('phone-verify')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-blue-100 bg-blue-50 hover:border-blue-300 hover:bg-blue-100 transition-all text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-200 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Yes, I was added by admin</p>
                  <p className="text-xs text-gray-500 mt-0.5">I'm a technician or security staff</p>
                </div>
              </button>

              <button
                onClick={handleNewResident}
                disabled={creatingResident}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-gray-300 hover:bg-gray-100 transition-all text-left group disabled:opacity-60"
              >
                <div className="w-11 h-11 rounded-xl bg-gray-700 flex items-center justify-center shrink-0 shadow-md shadow-gray-200 group-hover:scale-105 transition-transform">
                  {creatingResident
                    ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                    : <UserPlus className="w-6 h-6 text-white" />
                  }
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">No, I'm a new resident</p>
                  <p className="text-xs text-gray-500 mt-0.5">Register and wait for admin approval</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Phone Verify Screen ───────────────────────────── */}
        {step === 'phone-verify' && (
          <div className="bg-white rounded-3xl shadow-xl p-7">
            <button
              onClick={() => { setStep('choice'); setPhoneError(''); setPhone(''); }}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition mb-5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Phone className="w-7 h-7 text-blue-600" />
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-900 text-center mb-1">Verify Your Account</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              Enter the phone number your admin registered for you
            </p>

            <div className="space-y-4">
              <div>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setPhoneError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handlePhoneVerify()}
                  placeholder="+91 9876543210"
                  className={`w-full border-2 rounded-2xl px-4 py-3.5 text-base font-medium focus:outline-none transition-all ${
                    phoneError
                      ? 'border-red-300 bg-red-50 focus:border-red-400'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50'
                  }`}
                />
                {phoneError && (
                  <p className="text-xs text-red-600 mt-2 flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">⚠️</span>
                    {phoneError}
                  </p>
                )}
              </div>

              <button
                onClick={handlePhoneVerify}
                disabled={verifying || !phone.trim()}
                className="w-full h-13 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
              >
                {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {verifying ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
