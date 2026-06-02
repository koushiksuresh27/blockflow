import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import NotificationDropdown from './NotificationDropdown';

const NAV = [
  { to: '/admin',              icon: 'dashboard',   label: 'Dashboard'    },
  { to: '/admin/residents',    icon: 'group',        label: 'Residents'    },
  { to: '/admin/complaints',   icon: 'handyman',     label: 'Complaints'   },
  { to: '/admin/technicians',  icon: 'engineering',  label: 'Technicians'  },
  { to: '/admin/housekeeping', icon: 'cleaning_services', label: 'Housekeeping'},
  { to: '/admin/equipment',    icon: 'precision_manufacturing', label: 'Equipment'  },
  { to: '/admin/maintenance',  icon: 'build_circle', label: 'Maintenance'  },
  { to: '/admin/analytics',    icon: 'assessment',   label: 'Analytics'    },
  { to: '/admin/settings',     icon: 'settings',     label: 'Settings'     },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-background text-on-surface">
      {/* Background Ambient Blobs */}
      <div className="ambient-blob bg-primary-container top-[-200px] left-[-200px]"></div>
      <div className="ambient-blob bg-on-primary-fixed-variant bottom-[-100px] right-[-100px]"></div>

      {/* ── SideNavBar ── */}
      <aside className="w-64 h-screen fixed left-0 top-0 border-r border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-xl flex flex-col py-margin-desktop z-50">
        <div className="px-gutter mb-12">
          <h1 className="font-display-lg text-display-lg text-primary tracking-tighter">BlockFlow</h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest opacity-80">Admin Console</p>
        </div>

        <nav className="flex-grow">
          <ul className="space-y-1">
            {NAV.map(({ to, icon, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/admin'}
                  className={({ isActive }) =>
                    `flex items-center gap-4 px-gutter py-3 transition-all duration-300 ${
                      isActive
                        ? 'sidebar-active text-primary font-bold'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20'
                    }`
                  }
                >
                  <span className="material-symbols-outlined">{icon}</span>
                  <span className="font-body-md text-body-md">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto px-gutter space-y-6">
          <ul className="space-y-1">
            <li>
              <a className="flex items-center gap-4 py-2 text-on-surface-variant hover:text-primary transition-colors" href="#">
                <span className="material-symbols-outlined">help</span>
                <span className="font-label-sm">Support</span>
              </a>
            </li>
            <li>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-4 py-2 text-on-surface-variant hover:text-status-emergency transition-colors bg-transparent text-left focus:outline-none"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="font-label-sm">Logout</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="ml-64 flex-1 flex flex-col min-w-0">
        {/* ── TopAppBar ── */}
        <header className="h-20 fixed top-0 right-0 left-64 z-40 bg-background/80 backdrop-blur-md border-b border-outline-variant/20 flex justify-between items-center px-gutter">
          <div className="flex items-center gap-6 flex-grow max-w-2xl">
            <div className="relative w-full group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                className="w-full bg-surface-container-lowest/50 border border-outline-variant/30 rounded-full py-2.5 pl-12 pr-4 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-body-md text-on-surface"
                placeholder="Search residents, complaints, technicians…"
                type="text"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <NotificationDropdown />
            
            <div className="h-10 w-10 rounded-full border border-primary/20 overflow-hidden cursor-pointer hover:border-primary transition-all bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">admin_panel_settings</span>
            </div>
          </div>
        </header>

        {/* ── Dynamic Content ── */}
        <div className="pt-20 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
