import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { EditPencil, Check, LogOut, Lock, Bell, NavArrowDown, NavArrowRight } from 'iconoir-react';
import { format, isAfter, subMonths, parseISO } from 'date-fns';

export default function ResidentProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ filed: 0, resolved: 0 });
  
  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  
  // Maintenance
  const [maintenance, setMaintenance] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Due' | 'Overdue' | null>(null);
  const [arrears, setArrears] = useState(0);
  const [showPayNotice, setShowPayNotice] = useState(false);
  
  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  // Password
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState({ push: true, email: true });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }

    // 1. Fetch Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileData) {
      setProfile(profileData);
      setEditPhone(profileData.phone || '');
      setEditEmail(profileData.email || user.email || '');
      if (profileData.notification_prefs) {
        setNotifPrefs(profileData.notification_prefs);
      }
    }

    // 2. Fetch Complaints Stats
    const { data: complaintsData } = await supabase
      .from('complaints')
      .select('status')
      .eq('submitted_by', user.id);
    
    if (complaintsData) {
      const resolved = complaintsData.filter(c => ['resolved', 'verified', 'closed'].includes(c.status)).length;
      setStats({ filed: complaintsData.length, resolved });
    }

    // 3. Fetch Maintenance (Current Month)
    const currentMonthStr = format(new Date(), 'yyyy-MM');
    const societyId = profileData?.society_id || null;
    
    let feesData = null;
    if (societyId) {
      const { data } = await supabase
        .from('maintenance_fees')
        .select('*')
        .eq('society_id', societyId)
        .order('month', { ascending: false });
      feesData = data;
    }
    
    // We get last 6 months fees
    const feesMap = new Map();
    if (feesData) {
      feesData.forEach(f => feesMap.set(f.month, f));
    }
    
    const currentFee = feesData?.find(f => f.month === currentMonthStr);
    setMaintenance(currentFee || { amount: 0, due_date: format(new Date(), 'yyyy-MM-15') });

    // 4. Fetch Payments
    const { data: paymentsData } = await supabase
      .from('maintenance_payments')
      .select('*')
      .eq('resident_id', user.id)
      .order('payment_date', { ascending: false });
    
    const paymentsMap = new Map();
    if (paymentsData) {
      paymentsData.forEach(p => paymentsMap.set(p.month, p));
    }

    // Determine current month status
    const currentPayment = paymentsData?.find(p => p.month === currentMonthStr && p.status === 'completed');
    let currentStatus: 'Paid' | 'Due' | 'Overdue' = 'Due';
    
    if (currentPayment) {
      currentStatus = 'Paid';
    } else if (currentFee && isAfter(new Date(), new Date(currentFee.due_date))) {
      currentStatus = 'Overdue';
    }
    setPaymentStatus(currentStatus);

    // Calculate arrears (unpaid previous months)
    let arrearsSum = 0;
    const history = [];
    
    for (let i = 1; i <= 6; i++) {
      const mDate = subMonths(new Date(), i);
      const mStr = format(mDate, 'yyyy-MM');
      const fData = feesMap.get(mStr);
      const pData = paymentsMap.get(mStr);
      
      const amt = fData ? fData.amount : 0;
      let stat = 'Paid';
      if (!pData || pData.status !== 'completed') {
        if (fData && isAfter(new Date(), new Date(fData.due_date))) {
          stat = 'Overdue';
          arrearsSum += amt;
        } else {
          stat = 'Unpaid';
        }
      }
      history.push({ month: mStr, amount: amt, status: stat });
    }
    setArrears(arrearsSum);
    setPaymentHistory(history);
    
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({ phone: editPhone, email: editEmail })
      .eq('id', profile.id);
    
    if (!error) {
      setProfile({ ...profile, phone: editPhone, email: editEmail });
      setIsEditing(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg(error.message);
    } else {
      setPasswordMsg('Password updated successfully');
      setNewPassword('');
      setTimeout(() => setChangingPassword(false), 2000);
    }
  };

  const handleToggleNotif = async (key: 'push' | 'email') => {
    const newVal = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(newVal);
    if (profile) {
      await supabase
        .from('profiles')
        .update({ notification_prefs: newVal })
        .eq('id', profile.id);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#E0DDD9] rounded-full"></div>
          <div className="space-y-2">
            <div className="h-6 w-32 bg-[#E0DDD9] rounded"></div>
            <div className="h-4 w-20 bg-[#E0DDD9] rounded"></div>
          </div>
        </div>
        <div className="h-24 bg-[#E0DDD9] rounded-xl"></div>
        <div className="h-40 bg-[#E0DDD9] rounded-xl"></div>
      </div>
    );
  }

  const initials = profile?.full_name ? profile.full_name.split(' ').map((n: string) => n[0]).join('').substring(0,2) : 'U';

  return (
    <div className="p-6 pb-12 font-sans text-[#1C1917]">
      <h1 className="text-2xl font-bold font-serif mb-6" style={{ fontFamily: 'Recoleta, serif' }}>Profile</h1>
      
      {/* 1. Avatar + Name */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-[#16A34A] text-white rounded-full flex items-center justify-center text-xl font-bold">
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{profile?.full_name || 'Resident'}</h2>
          <p className="text-[#6B6560]">{profile?.unit_number || 'Unit Not Set'} • {profile?.role || 'Resident'}</p>
        </div>
      </div>

      {/* 2. Contact Info */}
      <div className="bg-white p-5 rounded-[12px] border border-[#E0DDD9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-[15px]">Contact Information</h3>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="p-2 text-[#9CA3AF] hover:text-[#16A34A] transition-colors">
              <EditPencil width={18} height={18} />
            </button>
          ) : (
            <button onClick={handleSaveProfile} className="p-2 text-[#16A34A] bg-green-50 rounded-full hover:bg-green-100 transition-colors">
              <Check width={18} height={18} />
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wider">Phone</label>
            {isEditing ? (
              <input 
                type="text" 
                value={editPhone} 
                onChange={e => setEditPhone(e.target.value)}
                className="w-full mt-1 p-2 border border-[#E0DDD9] rounded-lg text-sm focus:outline-none focus:border-[#16A34A]"
              />
            ) : (
              <p className="text-sm mt-1">{profile?.phone || 'Not provided'}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wider">Email</label>
            {isEditing ? (
              <input 
                type="email" 
                value={editEmail} 
                onChange={e => setEditEmail(e.target.value)}
                className="w-full mt-1 p-2 border border-[#E0DDD9] rounded-lg text-sm focus:outline-none focus:border-[#16A34A]"
              />
            ) : (
              <p className="text-sm mt-1">{profile?.email || 'Not provided'}</p>
            )}
          </div>
        </div>
      </div>

      {/* 3. Quick Stats */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 bg-white p-4 rounded-[12px] border border-[#E0DDD9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#1C1917]">{stats.filed}</span>
          <span className="text-xs text-[#6B6560] mt-1">Complaints Filed</span>
        </div>
        <div className="flex-1 bg-white p-4 rounded-[12px] border border-[#E0DDD9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#16A34A]">{stats.resolved}</span>
          <span className="text-xs text-[#6B6560] mt-1">Resolved</span>
        </div>
      </div>

      {/* 4. Maintenance Fee Card */}
      <div className="bg-white p-5 rounded-[12px] border border-[#E0DDD9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-[15px]">Maintenance Fee</h3>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' :
            paymentStatus === 'Overdue' ? 'bg-red-100 text-red-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {paymentStatus}
          </span>
        </div>

        <div className="bg-[#F9F8F6] p-4 rounded-xl space-y-2 mb-4 text-sm">
          <div className="flex justify-between text-[#6B6560]">
            <span>Base Fee ({format(new Date(), 'MMM yyyy')})</span>
            <span>₹{maintenance?.amount || 0}</span>
          </div>
          {arrears > 0 && (
            <div className="flex justify-between text-[#6B6560]">
              <span>Previous Arrears</span>
              <span>₹{arrears}</span>
            </div>
          )}
          <div className="pt-2 border-t border-[#E0DDD9] flex justify-between font-semibold text-[#1C1917]">
            <span>Total Due</span>
            <span>₹{(maintenance?.amount || 0) + arrears}</span>
          </div>
          {maintenance?.due_date && paymentStatus !== 'Paid' && (
            <div className="text-xs text-[#9CA3AF] mt-1">
              Due by {format(new Date(maintenance.due_date), 'dd MMM yyyy')}
            </div>
          )}
        </div>

        {(paymentStatus === 'Due' || paymentStatus === 'Overdue') && (
          <button 
            onClick={() => setShowPayNotice(true)}
            className="w-full py-3 bg-[#16A34A] text-white font-medium rounded-[8px] hover:bg-green-700 transition-colors text-sm mb-4"
          >
            Pay Now
          </button>
        )}

        {showPayNotice && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-[8px] text-xs text-amber-800 leading-relaxed">
            Online payments are being set up. Please pay at the society office or via bank transfer and your account will be updated.
          </div>
        )}

        <button 
          onClick={() => setHistoryOpen(!historyOpen)}
          className="w-full flex items-center justify-between text-sm font-medium text-[#6B6560] py-2 border-t border-[#E0DDD9] mt-2 pt-4 hover:text-[#1C1917] transition-colors"
        >
          Payment History
          {historyOpen ? <NavArrowDown width={18} /> : <NavArrowRight width={18} />}
        </button>

        {historyOpen && (
          <div className="mt-4 space-y-3">
            {paymentHistory.map((ph, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-[#6B6560]">{format(parseISO(`${ph.month}-01`), 'MMM yyyy')}</span>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-[#1C1917]">₹{ph.amount}</span>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${
                    ph.status === 'Paid' ? 'text-green-600' :
                    ph.status === 'Overdue' ? 'text-red-500' : 'text-amber-500'
                  }`}>
                    {ph.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Account Section */}
      <div className="bg-white p-5 rounded-[12px] border border-[#E0DDD9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] mb-6 space-y-4">
        <h3 className="font-semibold text-[15px] mb-2">Account Settings</h3>
        
        <div className="border-b border-[#E0DDD9] pb-4">
          <button 
            onClick={() => setChangingPassword(!changingPassword)}
            className="w-full flex items-center gap-3 text-sm text-[#1C1917] hover:text-[#16A34A] transition-colors"
          >
            <div className="w-8 h-8 bg-[#F5F4F0] rounded-full flex items-center justify-center text-[#6B6560]">
              <Lock width={16} height={16} />
            </div>
            <span className="font-medium">Change Password</span>
          </button>
          
          {changingPassword && (
            <div className="mt-3 ml-11">
              <input 
                type="password" 
                placeholder="New password" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full p-2 border border-[#E0DDD9] rounded-lg text-sm mb-2 focus:outline-none focus:border-[#16A34A]"
              />
              <button 
                onClick={handleUpdatePassword}
                className="px-4 py-2 bg-[#1C1917] text-white text-xs font-medium rounded-md hover:bg-black transition-colors"
              >
                Update
              </button>
              {passwordMsg && <p className="text-xs text-green-600 mt-2">{passwordMsg}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-[#1C1917]">
            <div className="w-8 h-8 bg-[#F5F4F0] rounded-full flex items-center justify-center text-[#6B6560]">
              <Bell width={16} height={16} />
            </div>
            <span className="font-medium">Push Notifications</span>
          </div>
          <button 
            onClick={() => handleToggleNotif('push')}
            className={`w-10 h-6 rounded-full flex items-center transition-colors px-1 ${notifPrefs.push ? 'bg-[#16A34A]' : 'bg-[#E0DDD9]'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${notifPrefs.push ? 'translate-x-4' : 'translate-x-0'}`}></div>
          </button>
        </div>
      </div>

      {/* 6. Logout */}
      <button 
        onClick={handleLogout}
        className="w-full py-3 mb-8 border border-[#E0DDD9] text-[#1C1917] font-medium rounded-[12px] hover:bg-[#F5F4F0] transition-colors flex items-center justify-center gap-2 text-sm bg-white"
      >
        <LogOut width={18} height={18} />
        Log Out
      </button>

      {/* 7. Footer */}
      <div className="text-center pb-8">
        <p className="text-xs text-[#9CA3AF] mb-1">BlockFlow Resident App v1.0.0</p>
        <a href="mailto:support@blockflow.com" className="text-xs text-[#16A34A] hover:underline font-medium">Contact Support</a>
      </div>
    </div>
  );
}
