import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Home, ClipboardList, User, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Tech Context ─────────────────────────────────────────────────────────────

export interface TechProfile {
  userId: string;
  techId: string;
  name: string;
  specializations: string[];
  isAvailable: boolean;
}

interface TechContextValue {
  profile: TechProfile | null;
  refreshProfile: () => Promise<void>;
}

const TechContext = createContext<TechContextValue>({
  profile: null,
  refreshProfile: async () => {},
});

export function useTechProfile() {
  return useContext(TechContext);
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/technician',         label: 'Home',    Icon: Home          },
  { to: '/technician/jobs',    label: 'My Jobs', Icon: ClipboardList },
  { to: '/technician/profile', label: 'Profile', Icon: User          },
];

function BottomNav() {
  const { pathname } = useLocation();

  const isActive = (to: string) => {
    if (to === '/technician') return pathname === '/technician';
    return pathname.startsWith(to);
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-100 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch h-[68px]">
        {NAV_ITEMS.map(({ to, label, Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              id={`tab-${label.toLowerCase().replace(' ', '-')}`}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <div className={`relative flex flex-col items-center gap-1 transition-all duration-200 ${
                active ? 'text-blue-600' : 'text-gray-400'
              }`}>
                <Icon
                  className={`transition-all duration-200 ${active ? 'w-[22px] h-[22px]' : 'w-5 h-5'}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className={`text-[10px] font-semibold transition-all duration-200 ${
                  active ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  {label}
                </span>
                {active && (
                  <span className="absolute -bottom-2.5 w-1 h-1 rounded-full bg-blue-600" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TechnicianLayout() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<TechProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/login'); return; }

    const [{ data: userRow }, { data: techRow }] = await Promise.all([
      supabase.from('users').select('name').eq('id', user.id).single(),
      supabase.from('technicians')
        .select('id, specializations, is_available')
        .eq('user_id', user.id)
        .single(),
    ]);

    if (!techRow) { navigate('/login'); return; }

    setProfile({
      userId:          user.id,
      techId:          techRow.id,
      name:            userRow?.name ?? 'Technician',
      specializations: techRow.specializations ?? [],
      isAvailable:     techRow.is_available,
    });
  }, [navigate]);

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));
  }, [refreshProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-500 font-medium">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <TechContext.Provider value={{ profile, refreshProfile }}>
      {/* Gray outer background — visible on desktop */}
      <div className="min-h-screen bg-gray-100 flex justify-center">
        {/* White app shell — max 480px */}
        <div className="relative w-full max-w-[480px] bg-white min-h-screen flex flex-col shadow-xl">
          {/* Scrollable content area above bottom nav */}
          <div className="flex-1 overflow-y-auto pb-[72px]">
            <Outlet />
          </div>
          <BottomNav />
        </div>
      </div>
    </TechContext.Provider>
  );
}
