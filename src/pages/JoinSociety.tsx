import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Building, AlertCircle } from 'lucide-react';

export default function JoinSociety() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [society, setSociety] = useState<{ id: string, name: string } | null>(null);
  const [flatNumber, setFlatNumber] = useState('');

  useEffect(() => {
    async function loadSociety() {
      if (!inviteCode) {
        setError('No invite code provided.');
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('societies')
        .select('id, name')
        .eq('invite_code', inviteCode)
        .single();
        
      if (error || !data) {
        setError('Invalid invite link. Please check the URL and try again.');
      } else {
        setSociety(data);
      }
      setLoading(false);
    }
    
    loadSociety();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!society || !flatNumber.trim()) return;
    
    localStorage.setItem('pending_join', JSON.stringify({
      society_id: society.id,
      flat_number: flatNumber.trim()
    }));
    
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDEBE6] flex flex-col items-center justify-center p-4">
        <div className="text-[#1C1917] font-semibold">Loading...</div>
      </div>
    );
  }

  if (error || !society) {
    return (
      <div className="min-h-screen bg-[#EDEBE6] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#1C1917] mb-2">Invalid Invite Link</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-[#1C1917] text-white py-3 rounded-xl font-semibold"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDEBE6] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#E0DDD9] max-w-md w-full text-center">
        <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
          <Building className="w-8 h-8 text-[#1C1917]" />
        </div>
        
        <h1 className="text-2xl font-bold text-[#1C1917] mb-2">
          Join {society.name}
        </h1>
        <p className="text-[#6B6560] mb-8">
          Enter your flat number to continue.
        </p>

        <div className="text-left mb-6">
          <label className="block text-sm font-medium text-[#1C1917] mb-2">
            What's your flat number?
          </label>
          <input
            type="text"
            value={flatNumber}
            onChange={(e) => setFlatNumber(e.target.value)}
            placeholder="e.g. B-204"
            className="w-full p-3 border border-[#E0DDD9] rounded-xl focus:outline-none focus:border-[#D97706] focus:ring-1 focus:ring-[#D97706]"
          />
        </div>

        <button 
          onClick={handleJoin}
          disabled={!flatNumber.trim()}
          className="w-full bg-[#D97706] hover:bg-[#B45309] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
