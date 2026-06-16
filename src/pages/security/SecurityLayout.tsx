import { createContext, useContext, useEffect, useState } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

// ─── Security Context ─────────────────────────────────────────────────────────

export interface SecurityProfile {
  userId: string;
  name: string;
  societyId: string;
  societyName: string;
}

interface SecurityContextValue {
  profile: SecurityProfile | null;
}

const SecurityContext = createContext<SecurityContextValue>({ profile: null });

export function useSecurityProfile() {
  return useContext(SecurityContext);
}

// ─── Live Clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono font-bold text-[#1C1917] text-sm tabular-nums">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/security',           emoji: '🔍', label: 'Verify'   },
  { to: '/security/visitors',  emoji: '👥', label: 'Visitors' },
  { to: '/security/staff',     emoji: '👷', label: 'Staff'    },
  { to: '/security/log',       emoji: '📋', label: 'Log'      },
];

function BottomNav() {
  const { pathname } = useLocation();

  const isActive = (to: string) => {
    if (to === '/security') return pathname === '/security';
    return pathname.startsWith(to);
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-[#FFFFFF] border-t border-[#E0DDD9] z-30 shadow-none font-inter">
      <div className="flex items-stretch h-[68px]">
        {NAV_ITEMS.map(({ to, emoji, label }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            >
              <span className={`text-xl transition-all duration-200 ${active ? 'scale-110' : 'opacity-60'}`}>
                {emoji}
              </span>
              <span className={`text-[10px] font-semibold transition-colors ${active ? 'text-[#7C3AED]' : 'text-[#9C9894]'}`}>
                {label}
              </span>
              {active && <span className="w-1 h-1 rounded-full bg-[#7C3AED] mt-0.5" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function SecurityLayout() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<SecurityProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { navigate('/login'); return; }

      const { data: userRow } = await supabase
        .from('users')
        .select('name, society_id, societies(name)')
        .eq('id', user.id)
        .single();

      if (!userRow) { navigate('/login'); return; }

      setProfile({
        userId: user.id,
        name: userRow.name,
        societyId: userRow.society_id,
        societyName: (userRow.societies as any)?.name ?? 'Society',
      });
      setLoading(false);
    });
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDEBE6] flex items-center justify-center font-inter">
        <Loader2 className="w-8 h-8 animate-spin text-[#7C3AED]" />
      </div>
    );
  }

  return (
    <SecurityContext.Provider value={{ profile }}>
      <div className="min-h-screen bg-[#EDEBE6] flex justify-center font-inter">
        <div className="relative w-full max-w-[480px] bg-[#FFFFFF] min-h-screen flex flex-col border-x border-[#E0DDD9] shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_24px_rgba(0,0,0,0.06)]">
          {/* Header */}
          <header className="bg-[#FFFFFF] border-b border-[#E0DDD9] px-5 py-4 flex justify-between items-start">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#1C1917] font-recoleta">BlockFlow Security</h1>
              <p className="text-[#6B6560] text-xs mt-0.5">{profile?.societyName}</p>
            </div>
            <LiveClock />
          </header>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto pb-[68px]">
            <Outlet />
          </div>

          <BottomNav />
        </div>
      </div>
    </SecurityContext.Provider>
  );
}
