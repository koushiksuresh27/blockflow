import { useNavigate } from 'react-router-dom';
import { Ban, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AccessRevoked() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-rose-100 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-8">
        {/* Animated ban icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-red-200 animate-ping opacity-30" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_8px_30px_rgba(225,29,72,0.4)]">
            <Ban className="w-11 h-11 text-white" strokeWidth={2} />
          </div>
        </div>

        {/* Text */}
        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">
            Access Revoked
          </h1>
          <p className="text-gray-600 leading-relaxed text-sm max-w-[280px] mx-auto">
            Your access to this society has been removed. Please contact your society admin if you believe this is a mistake.
          </p>
        </div>

        {/* Sign out */}
        <div className="flex flex-col items-center gap-4 mt-6">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-red-200 text-red-600 text-sm font-bold rounded-2xl hover:bg-red-50 transition shadow-sm hover:shadow-md active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
