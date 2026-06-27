import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();

      if (sessErr) console.error('[AuthCallback] getSession error:', sessErr);
      if (cancelled) return;

      console.log('Session email:', session?.user?.email);

      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      // Step 1: Check pre-created profile by EMAIL first (before id check)
      const { data: preCreated, error: preCreatedError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .in('role', ['technician', 'security'])
        .eq('status', 'active')
        .maybeSingle();

      console.log('Pre-created profile by email:', preCreated);
      console.log('Pre-created error:', preCreatedError);

      if (cancelled) return;

      if (preCreated && preCreated.id !== session.user.id) {
        // Link Google auth id to pre-created profile
        await supabase
          .from('users')
          .update({ id: session.user.id })
          .eq('email', session.user.email)
          .in('role', ['technician', 'security']);

        // Delete any wrongly-created resident profile
        await supabase
          .from('users')
          .delete()
          .eq('id', session.user.id)
          .eq('role', 'resident');

        switch (preCreated.role) {
          case 'technician':
            navigate('/technician', { replace: true }); break;
          case 'security':
            navigate('/security', { replace: true }); break;
        }
        return;
      }

      // Step 2: Check existing profile by auth id
      const { data: existingProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      console.log('Existing profile by id:', existingProfile);

      if (cancelled) return;

      if (existingProfile) {
        if (existingProfile.status === 'rejected') {
          navigate('/access-revoked', { replace: true });
        } else if (existingProfile.status === 'pending') {
          navigate('/pending', { replace: true });
        } else {
          switch (existingProfile.role) {
            case 'admin':
            case 'super_admin':
              navigate('/admin', { replace: true }); break;
            case 'technician':
              navigate('/technician', { replace: true }); break;
            case 'security':
              navigate('/security', { replace: true }); break;
            default:
              navigate('/resident', { replace: true }); break;
          }
        }
        return;
      }

      // Step 3: Check pending invite join
      const pendingJoin = localStorage.getItem('pending_join');
      
      if (pendingJoin && !existingProfile) {
        const joinData = JSON.parse(pendingJoin);
        localStorage.removeItem('pending_join');
      
        await supabase.from('users').insert({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email,
          email: session.user.email,
          role: 'resident',
          status: 'pending',
          society_id: joinData.society_id,
          flat_number: joinData.flat_number
        });
      
        navigate('/pending', { replace: true });
        return;
      }

      // Step 4: Brand new user logic
      const pendingSocietyId = localStorage.getItem('pendingSocietyId');
      
      if (pendingSocietyId) {
        // New resident signup
        const pendingName = localStorage.getItem('pendingResidentName');
        const pendingTower = localStorage.getItem('pendingResidentTower');
        const pendingFlat = localStorage.getItem('pendingResidentFlat');

        await supabase.from('users').insert({
          id: session.user.id,
          name: pendingName || session.user.user_metadata?.full_name || session.user.email,
          email: session.user.email,
          role: 'resident',
          status: 'pending',
          society_id: pendingSocietyId,
          tower: pendingTower || null,
          flat_number: pendingFlat || null,
        });

        localStorage.removeItem('pendingSocietyId');
        localStorage.removeItem('pendingResidentName');
        localStorage.removeItem('pendingResidentTower');
        localStorage.removeItem('pendingResidentFlat');

        navigate('/pending', { replace: true });
      } else {
        // Fallback for unexpected case where no profile exists but no pending society ID
        navigate('/onboarding', { replace: true });
      }
    }

    handleCallback();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#EDEBE6] flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-[0_8px_30px_rgba(37,99,235,0.35)]">
        <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#1C1917]" />
        <p className="text-sm font-semibold text-[#1C1917]">Signing you in…</p>
        <p className="text-xs text-[#1C1917]/70">This will only take a moment</p>
      </div>
    </div>
  );
}
