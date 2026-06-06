import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Status = 'pending' | 'active' | 'rejected';

export default function PendingPage() {
  const navigate    = useNavigate();
  const [status, setStatus]     = useState<Status>('pending');
  const [name, setName]         = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [userId, setUserId]     = useState<string | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function init() {
      // 1. Verify there IS an active session — only kick to login if truly unauthenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      setUserId(user.id);

      // 2. Try to read the profile row.
      //    Use maybeSingle() so missing rows return null instead of an error.
      const { data: profile, error: profileErr } = await supabase
        .from('users')
        .select('name, role, status')
        .eq('id', user.id)
        .maybeSingle();

      if (profileErr) console.error('[PendingPage] profile fetch error:', profileErr);
      if (cancelled) return;

      // 3. If no profile yet (INSERT RLS issue, timing race, etc.)
      //    → stay on pending page; the user is authenticated and simply
      //      waiting for an admin to create / approve their record.
      if (profile) {
        if (profile.status === 'active') {
          routeByRole(profile.role, navigate);
          return;
        }
        setName(profile.name ?? '');
        setStatus((profile.status as Status) ?? 'pending');
      } else {
        // No profile row readable — show the user's email as fallback name
        setName(user.email ?? '');
      }

      // 4. Set up realtime listener for status changes
      //    (also catches profile creation if INSERT RLS issue is fixed later)
      channel = supabase
        .channel(`pending-status-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
          (payload) => {
            if (cancelled) return;
            const row = payload.new as { status: string; role: string; name?: string };
            const newStatus = row.status as Status;
            if (row.name) setName(row.name);
            setStatus(newStatus);
            if (newStatus === 'active') {
              setTimeout(() => routeByRole(row.role, navigate), 1500);
            }
          }
        )
        .subscribe();
    }

    init();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  // ── Approved state ─────────────────────────────────────────────────────────
  if (status === 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="relative mx-auto w-20 h-20">
            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-[0_8px_30px_rgba(34,197,94,0.35)] animate-bounceIn">
              <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2} />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">You're approved! 🎉</h1>
            <p className="text-gray-500 text-sm">Redirecting you to your dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Rejected state ─────────────────────────────────────────────────────────
  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-red-100 shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <span className="text-3xl">✗</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 mb-2">Application Rejected</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your account application was not approved.
              Please contact your society administrator for more details.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full h-12 flex items-center justify-center gap-2 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-2xl hover:bg-red-100 transition"
          >
            <LogOut className="w-4 h-4" />
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </div>
    );
  }

  // ── Pending state (default) ─────────────────────────────────────────────────
  const displayName = name ? name.split(/[\s@]/)[0] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-8">

        {/* Animated clock icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-amber-200 animate-ping opacity-30" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-[0_8px_30px_rgba(251,191,36,0.4)]">
            <Clock className="w-11 h-11 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Text */}
        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-3">
            {displayName ? `Hi ${displayName}! 👋` : 'Almost there!'}
          </h1>
          <p className="text-gray-500 leading-relaxed text-sm max-w-xs mx-auto">
            Your account is <strong className="text-gray-700">pending admin approval</strong>.
            You'll be automatically redirected once approved.
          </p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2 py-3 px-5 bg-amber-50 border border-amber-200 rounded-2xl mx-auto w-fit">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold text-amber-700">Listening for approval…</span>
        </div>

        {/* Steps */}
        <div className="text-left bg-white/70 backdrop-blur-sm border border-white rounded-2xl p-4 space-y-3 shadow-sm">
          {[
            { n: '1', text: 'Account created successfully', done: true  },
            { n: '2', text: 'Admin review in progress',     done: false },
            { n: '3', text: 'Access granted to dashboard',  done: false },
          ].map(({ n, text, done }) => (
            <div key={n} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                done ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? '✓' : n}
              </div>
              <p className={`text-sm ${done ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{text}</p>
            </div>
          ))}
        </div>

        {/* Sign out & Manual Check */}
        <div className="flex flex-col items-center gap-4 mt-6">
          <button
            onClick={async () => {
              if (!userId) return;
              const { data } = await supabase
                .from('users')
                .select('status, role')
                .eq('id', userId)
                .single();
              
              if (data?.status === 'active') {
                routeByRole(data.role, navigate);
              }
            }}
            className="px-6 py-2 bg-white border border-amber-200 text-amber-700 text-sm font-semibold rounded-xl hover:bg-amber-50 transition shadow-sm"
          >
            Check Approval Status
          </button>

          <button
            id="pending-signout-btn"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            <LogOut className="w-4 h-4" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function routeByRole(role: string, navigate: ReturnType<typeof useNavigate>) {
  switch (role) {
    case 'admin':
    case 'super_admin': navigate('/admin',      { replace: true }); break;
    case 'technician':  navigate('/technician', { replace: true }); break;
    default:            navigate('/resident',   { replace: true }); break;
  }
}
