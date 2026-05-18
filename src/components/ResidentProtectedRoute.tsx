import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function ResidentProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [isResident, setIsResident] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.role === 'resident') {
            setIsResident(true);
          }
          setLoading(false);
        });
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return isResident ? <Outlet /> : <Navigate to="/login" replace />;
}
