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
      const { data: existingProfiles } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .limit(1);
      
      const existingProfile = existingProfiles?.[0];

      console.log('Existing profile by id:', existingProfile);

      if (cancelled) return;

      // Step 3: Check pending invite join (takes priority over existing profile)
      const pendingJoin = localStorage.getItem('pending_join');
      
      if (pendingJoin) {
        const joinData = JSON.parse(pendingJoin);
        localStorage.removeItem('pending_join');
      
        // Use upsert WITHOUT ignoreDuplicates: true.
        // This cleanly updates existing users AND inserts brand new ones
        // without ever creating duplicates.
        await supabase.from('users').upsert({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email,
          email: session.user.email,
          role: 'resident',
          status: 'pending',
          society_id: joinData.society_id,
          flat_number: joinData.flat_number
        }, { onConflict: 'id' });
      
        navigate('/pending', { replace: true });
        return;
      }

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

      // Step 4: Brand new user logic
      const pendingSocietyId = localStorage.getItem('pendingSocietyId');
      
      if (pendingSocietyId) {
        // New resident signup
        const pendingName = localStorage.getItem('pendingResidentName');
        const pendingTower = localStorage.getItem('pendingResidentTower');
        const pendingFlat = localStorage.getItem('pendingResidentFlat');

        await supabase.from('users').upsert({
          id: session.user.id,
          name: pendingName || session.user.user_metadata?.full_name || session.user.email,
          email: session.user.email,
          role: 'resident',
          status: 'pending',
          society_id: pendingSocietyId,
          tower: pendingTower || null,
          flat_number: pendingFlat || null,
        }, { onConflict: 'id', ignoreDuplicates: true });

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
      <div className="flex items-center justify-center">
        <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#1C1917]" />
        <p className="text-sm font-semibold text-[#1C1917]">Signing you in…</p>
        <p className="text-xs text-[#1C1917]/70">This will only take a moment</p>
      </div>
    </div>
  );
}
