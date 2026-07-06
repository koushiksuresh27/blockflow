import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Loader2, ArrowRight, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SelectRole() {
  const navigate = useNavigate();
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Pre-load the user's display name from their Google metadata
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login', { replace: true }); return; }
      const displayName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email ??
        '';
      setName(displayName);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired. Please sign in again.');

      // Fetch the first available society to assign
      const { data: society } = await supabase
        .from('societies')
        .select('id')
        .limit(1)
        .maybeSingle();

      // Create (or update) the user profile
      const { error: upsertErr } = await supabase.from('users').upsert(
        {
          id:         user.id,
          name:       user.user_metadata?.full_name
                        ?? user.user_metadata?.name
                        ?? user.email
                        ?? 'New Resident',
          role:       'resident',
          status:     'pending',
          society_id: society?.id ?? null,
        },
        { onConflict: 'id', ignoreDuplicates: false }
      );

      if (upsertErr) throw new Error(upsertErr.message);

      navigate('/pending', { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const firstName = name.split(/[\s@]/)[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand mark */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center justify-center">
            <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
          </div>
        </div>

        {/* Welcome text */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Welcome to BlockFlow{firstName ? `, ${firstName}` : ''}!
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            You're signing up as a <strong className="text-gray-700">Resident</strong>
          </p>
        </div>

        {/* Role card */}
        <div className="bg-white border-2 border-blue-200 rounded-3xl p-6 shadow-xl shadow-blue-500/10 mb-5">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-5">
            <Home className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
          </div>

          {/* Label */}
          <p className="text-center text-xs font-bold uppercase tracking-widest text-blue-500 mb-2">
            Resident
          </p>
          <p className="text-center text-sm text-gray-500 leading-relaxed">
            I live in an apartment society and want to submit maintenance requests,
            book amenities, and stay updated on my community.
          </p>

          {/* Checklist */}
          <ul className="mt-5 space-y-2.5">
            {[
              'Submit & track maintenance complaints',
              'View community announcements',
              'Access society documents & notices',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700">
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          id="continue-as-resident-btn"
          onClick={handleContinue}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold rounded-2xl shadow-[0_8px_25px_rgba(37,99,235,0.35)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.45)] transition-all active:scale-[0.98]"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" />Setting up your account…</>
          ) : (
            <>Continue as Resident <ArrowRight className="w-4 h-4" /></>
          )}
        </button>

        {/* Sign out fallback */}
        <div className="flex justify-center mt-5">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
