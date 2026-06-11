import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Google Button ────────────────────────────────────────────────────────────

function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setLoading(false);
    }
    // On success the browser navigates away — no need to reset loading
  };

  return (
    <div className="space-y-2">
      <button
        id="google-signin-btn"
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 h-12 px-4 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-60 rounded-xl text-sm font-semibold text-gray-700 shadow-sm transition-all active:scale-[0.98]"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        ) : (
          <img src="/google-icon.svg" alt="Google" className="w-5 h-5 shrink-0" />
        )}
        <span>{loading ? 'Redirecting…' : 'Continue with Google'}</span>
      </button>
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs font-medium text-gray-400 tracking-wide">or sign in with email</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

// ─── Email Form ───────────────────────────────────────────────────────────────

function EmailPasswordForm() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [open, setOpen]         = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Collapsed toggle */}
      {!open ? (
        <button
          type="button"
          id="email-signin-expand"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 h-12 px-4 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl text-sm font-medium text-gray-500 transition-all"
        >
          <Mail className="w-4 h-4" />
          Sign in with email & password
          <ChevronDown className="w-4 h-4 ml-auto" />
        </button>
      ) : (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          {/* Header */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
          >
            <Mail className="w-4 h-4" />
            Email & password
            <ChevronUp className="w-4 h-4 ml-auto" />
          </button>

          <form onSubmit={handleSubmit} noValidate className="p-4 space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-600 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="email-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-11 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</>
              ) : 'Sign in'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="BlockFlow Logo" className="h-14 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">BlockFlow</h1>
          <p className="mt-1.5 text-sm text-gray-500">Apartment maintenance, simplified</p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-sm border border-white shadow-xl shadow-black/5 rounded-3xl p-6 space-y-3">
          <p className="text-xs font-semibold text-gray-400 text-center uppercase tracking-widest mb-4">
            Sign in to continue
          </p>

          {/* Google — primary */}
          <GoogleSignInButton />

          {/* Divider */}
          <OrDivider />

          {/* Email — secondary (collapsed by default) */}
          <EmailPasswordForm />
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-xs text-gray-400">
          © {new Date().getFullYear()} BlockFlow. All rights reserved.
        </p>
      </div>
    </div>
  );
}
