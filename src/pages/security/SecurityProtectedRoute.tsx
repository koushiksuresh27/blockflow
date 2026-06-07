import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function SecurityProtectedRoute() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSecurity, setIsSecurity] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) {
            navigate('/login', { replace: true });
            return;
          }
          if (data.role === 'security') {
            setIsSecurity(true);
          } else {
            const routes: Record<string, string> = {
              admin: '/admin',
              super_admin: '/admin',
              resident: '/resident',
              technician: '/technician',
            };
            navigate(routes[data.role] ?? '/login', { replace: true });
          }
          setLoading(false);
        });
    });
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm text-slate-400 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isSecurity) return <Navigate to="/login" replace />;
  return <Outlet />;
}
