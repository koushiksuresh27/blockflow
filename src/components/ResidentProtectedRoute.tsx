import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

type ResidentStatus = 'pending' | 'active' | 'rejected' | null;

// ─── Pending Approval Screen ──────────────────────────────────────────────────
function PendingApprovalScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ResidentStatus>('pending');

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      // Watch for realtime status change
      channel = supabase
        .channel(`resident-status-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const newStatus = (payload.new as { status: string }).status as ResidentStatus;
            setStatus(newStatus);
            if (newStatus === 'active') {
              // Auto-redirect without refresh
              navigate('/resident', { replace: true });
            }
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <span className="text-3xl">✗</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white mb-2">Application Rejected</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Your resident application has been rejected by the admin.
              Please contact your society administrator for more information.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full py-3 px-4 bg-red-500/10 border border-red-500/20 text-red-400 font-semibold rounded-xl hover:bg-red-500/20 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Pending screen
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">

        {/* Animated icon */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <span className="text-amber-400 text-3xl">⏳</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white mb-3">Application Pending</h1>
          <p className="text-gray-400 leading-relaxed text-sm">
            Your resident application has been submitted and is awaiting admin approval.
            You'll be automatically redirected to your dashboard once approved.
          </p>
        </div>

        {/* Live status indicator */}
        <div className="flex items-center justify-center gap-2 py-3 px-5 bg-amber-500/5 border border-amber-500/10 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-amber-400 font-semibold">Listening for approval in real-time…</span>
        </div>

        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-300 transition underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Protected Route ──────────────────────────────────────────────────────────
export default function ResidentProtectedRoute() {
  const [loading, setLoading]             = useState(true);
  const [isResident, setIsResident]       = useState(false);
  const [residentStatus, setResidentStatus] = useState<ResidentStatus>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }

      supabase
        .from('users')
        .select('role, status')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.role === 'resident') {
            setIsResident(true);
            setResidentStatus((data.status as ResidentStatus) ?? 'pending');
          }
          setLoading(false);
        });
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EDEBE6]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1C1917]" />
      </div>
    );
  }

  if (!isResident) {
    return <Navigate to="/login" replace />;
  }

  if (residentStatus === 'pending' || residentStatus === 'rejected') {
    return <PendingApprovalScreen />;
  }

  // status === 'active'
  return <Outlet />;
}
