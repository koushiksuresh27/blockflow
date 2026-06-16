import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Role = 'resident' | 'technician' | 'admin' | 'super_admin';

const ROLE_ROUTES: Record<Role, string> = {
  admin: '/admin',
  super_admin: '/admin',
  resident: '/resident',
  technician: '/technician',
};

export default function TechnicianProtectedRoute() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isTechnician, setIsTechnician] = useState(false);

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
          if (data.role === 'technician') {
            setIsTechnician(true);
          } else {
            const dest = ROLE_ROUTES[data.role as Role] ?? '/login';
            navigate(dest, { replace: true });
          }
          setLoading(false);
        });
    });
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDEBE6] flex items-center justify-center font-inter">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
          <p className="text-sm text-[#6B6560] font-medium font-inter">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isTechnician) return <Navigate to="/login" replace />;
  return <Outlet />;
}
