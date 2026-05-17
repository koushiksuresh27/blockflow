import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Role = 'resident' | 'technician' | 'admin' | 'super_admin';

const ROLE_ROUTES: Record<Role, string> = {
  admin:       '/admin',
  super_admin: '/admin',
  technician:  '/technician',
  resident:    '/complaints/new',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function redirect() {
      // 1. Confirm session
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) { navigate('/login', { replace: true }); return; }

      // 2. Fetch role from public.users
      const { data: profile, error: profileErr } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      if (profileErr || !profile) {
        // Profile may not exist yet (e.g. first login before DB row created)
        setError('Your profile is not set up yet. Please contact your administrator.');
        return;
      }

      const dest = ROLE_ROUTES[profile.role as Role] ?? '/complaints/new';
      navigate(dest, { replace: true });
    }

    redirect();
    return () => { cancelled = true; };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white border border-red-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-base font-bold text-gray-900 mb-1">Profile not found</h1>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={() => supabase.auth.signOut().then(() => navigate('/login', { replace: true }))}
            className="mt-5 w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Loading / redirecting spinner
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        <p className="text-sm">Loading your dashboard…</p>
      </div>
    </div>
  );
}
