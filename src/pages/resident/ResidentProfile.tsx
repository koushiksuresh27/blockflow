import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LogOut, Pencil, Check } from 'lucide-react'; // Using lucide-react since it's in package.json and used elsewhere

export default function ResidentProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Stats
  const [stats, setStats] = useState({ filed: 0, resolved: 0 });
  
  // Edit Flat Number
  const [isEditingFlat, setIsEditingFlat] = useState(false);
  const [flatNumber, setFlatNumber] = useState('');
  const [savingFlat, setSavingFlat] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      navigate('/login');
      return;
    }

    // Fetch user details from public.users
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (userData) {
      setUser(userData);
      setFlatNumber(userData.flat_number || '');
    }

    // Fetch Complaints Stats
    const { data: complaintsData } = await supabase
      .from('complaints')
      .select('status')
      .eq('submitted_by', authUser.id);
    
    if (complaintsData) {
      const resolved = complaintsData.filter(c => ['resolved', 'verified', 'closed'].includes(c.status)).length;
      setStats({ filed: complaintsData.length, resolved });
    }
    
    setLoading(false);
  };

  const handleSaveFlat = async () => {
    if (!user) return;
    setSavingFlat(true);
    const { error } = await supabase
      .from('users')
      .update({ flat_number: flatNumber })
      .eq('id', user.id);
    
    if (!error) {
      setUser({ ...user, flat_number: flatNumber });
      setIsEditingFlat(false);
    }
    setSavingFlat(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-[#F5F3F0] min-h-screen animate-pulse">
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="w-24 h-24 bg-[#E0DDD9] rounded-full"></div>
          <div className="h-6 w-32 bg-[#E0DDD9] rounded"></div>
        </div>
        <div className="h-32 bg-[#E0DDD9] rounded-xl mt-8"></div>
        <div className="h-24 bg-[#E0DDD9] rounded-xl"></div>
      </div>
    );
  }

  const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0,2).toUpperCase() : 'U';

  return (
    <div className="min-h-screen bg-[#F5F3F0] pb-24 font-inter text-[#1C1917]">
      <header className="bg-white px-6 py-4 border-b border-[#E0DDD9] sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-xl font-bold font-['Space_Grotesk'] text-[#1C1917]">Profile</h1>
      </header>

      <div className="px-4 py-8">
        {/* 1. Avatar + Name */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-24 h-24 bg-amber-500 text-white rounded-full flex items-center justify-center text-3xl font-bold font-['Space_Grotesk'] shadow-sm mb-4">
            {initials}
          </div>
          <h2 className="text-2xl font-bold font-['Space_Grotesk']">{user?.name || 'Resident'}</h2>
          <p className="text-sm text-[#6B6560] mt-1">{user?.role || 'Resident'}</p>
        </div>

        {/* 2. Flat Number - Prominent */}
        <div className="bg-white p-6 rounded-[16px] border-2 border-amber-500 shadow-sm mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100 rounded-bl-full -z-10 opacity-50"></div>
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-bold text-[#1C1917] font-['Space_Grotesk'] text-lg">Flat Number</h3>
            {!isEditingFlat ? (
              <button onClick={() => setIsEditingFlat(true)} className="p-2 text-[#9CA3AF] hover:text-amber-600 transition-colors bg-[#F5F3F0] rounded-full">
                <Pencil width={16} height={16} />
              </button>
            ) : (
              <button 
                onClick={handleSaveFlat} 
                disabled={savingFlat}
                className="px-4 py-1.5 text-sm font-bold text-white bg-amber-500 rounded-full hover:bg-amber-600 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Check width={16} height={16} /> Save
              </button>
            )}
          </div>
          
          <div>
            {isEditingFlat ? (
              <input 
                type="text" 
                value={flatNumber} 
                onChange={e => setFlatNumber(e.target.value)}
                placeholder="e.g. B-100"
                className="w-full mt-1 p-3 border-2 border-amber-300 rounded-[10px] text-lg font-bold focus:outline-none focus:border-amber-500 bg-amber-50/30"
                autoFocus
              />
            ) : (
              <p className={`text-2xl mt-1 font-bold font-['Space_Grotesk'] ${user?.flat_number ? 'text-[#1C1917]' : 'text-[#9CA3AF] italic'}`}>
                {user?.flat_number || 'Not set'}
              </p>
            )}
            {!user?.flat_number && !isEditingFlat && (
              <p className="text-xs text-amber-600 mt-2 font-medium">Please set your flat number to submit complaints.</p>
            )}
          </div>
        </div>

        {/* 3. Contact Info (Read-only) */}
        <div className="bg-white p-5 rounded-[16px] border border-[#E0DDD9] shadow-sm mb-6">
          <h3 className="font-bold text-[#1C1917] font-['Space_Grotesk'] mb-4 text-sm">Contact Details</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-wider block mb-1">Email</label>
              <p className="text-sm font-medium text-[#1C1917]">{user?.email || 'Not provided'}</p>
            </div>
            <div className="h-px w-full bg-[#F5F3F0]"></div>
            <div>
              <label className="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-wider block mb-1">Phone</label>
              <p className="text-sm font-medium text-[#1C1917]">{user?.phone || 'Not provided'}</p>
            </div>
          </div>
        </div>

        {/* 4. Quick Stats */}
        <div className="flex gap-4 mb-8">
          <div className="flex-1 bg-white p-4 rounded-[16px] border border-[#E0DDD9] shadow-sm flex flex-col items-center justify-center">
            <span className="text-2xl font-black font-['Space_Grotesk'] text-[#1C1917]">{stats.filed}</span>
            <span className="text-[11px] font-bold text-[#6B6560] mt-1 uppercase tracking-wider">Complaints Filed</span>
          </div>
          <div className="flex-1 bg-white p-4 rounded-[16px] border border-[#E0DDD9] shadow-sm flex flex-col items-center justify-center">
            <span className="text-2xl font-black font-['Space_Grotesk'] text-green-600">{stats.resolved}</span>
            <span className="text-[11px] font-bold text-[#6B6560] mt-1 uppercase tracking-wider">Resolved</span>
          </div>
        </div>

        {/* 5. Logout */}
        <button 
          onClick={handleLogout}
          className="w-full py-4 border border-[#E0DDD9] text-[#1C1917] font-bold rounded-[12px] hover:bg-[#E0DDD9] transition-colors flex items-center justify-center gap-2 text-sm bg-white shadow-sm"
        >
          <LogOut width={18} height={18} />
          Log Out
        </button>
      </div>
    </div>
  );
}
