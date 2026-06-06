import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Role = 'admin' | 'super_admin' | 'technician' | 'security' | 'resident';

const ROLE_ROUTES: Record<Role, string> = {
  admin:       '/admin',
  super_admin: '/admin',
  technician:  '/technician',
  security:    '/security',
  resident:    '/resident',
};

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      // Wait for Supabase to exchange the OAuth code for a session.
      // getSession() reads from localStorage / URL hash — no network needed.
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();

      if (sessErr) console.error('[AuthCallback] getSession error:', sessErr);
      if (cancelled) return;

      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      // Check if user already has a profile row
      const { data: profile, error: profileErr } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', session.user.id)
        .maybeSingle(); // maybeSingle → null (not error) when 0 rows

      if (profileErr) console.error('[AuthCallback] profile fetch error:', profileErr);
      if (cancelled) return;

      if (!profile) {
        // New Google OAuth user — look up the first available society
        // (in a multi-tenant setup this would use an invite code or domain matching)
        const { data: society } = await supabase
          .from('societies')
          .select('id')
          .limit(1)
          .maybeSingle();

        // Create a default resident profile pending approval.
        // Use upsert so repeated redirects (e.g. browser back) don't error.
        const { error: insertErr } = await supabase.from('users').upsert(
          {
            id:         session.user.id,
            name:       session.user.user_metadata?.full_name
                          ?? session.user.user_metadata?.name
                          ?? session.user.email
                          ?? 'New User',
            role:       'resident',
            status:     'pending',
            society_id: society?.id ?? null,
          },
          { onConflict: 'id', ignoreDuplicates: false }
        );

        if (insertErr) {
          console.error('[AuthCallback] profile upsert error:', insertErr);
          // Profile creation failed (likely missing INSERT RLS policy).
          // Still navigate to /pending — the page handles the no-profile case gracefully.
        }

        navigate('/pending', { replace: true });
        return;
      }

      // Existing user — check status first, then route by role
      if (profile.status === 'pending' || profile.status === 'rejected') {
        navigate('/pending', { replace: true });
        return;
      }

      const dest = ROLE_ROUTES[profile.role as Role] ?? '/resident';
      navigate(dest, { replace: true });
    }

    handleCallback();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-[0_8px_30px_rgba(37,99,235,0.35)]">
        <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <p className="text-sm font-semibold text-gray-600">Signing you in…</p>
        <p className="text-xs text-gray-400">This will only take a moment</p>
      </div>
    </div>
  );
}
