import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import EstateManagerAgent from './admin/EstateManagerAgent';
import {
  GridMinus, StatsReport, ClipboardCheck, Community, Wrench,
  Map, Database, Calendar, Bell, Settings,
  LogOut, Search, Refresh, Building, Dna
} from 'iconoir-react';

//  Page title map 
const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/analytics': 'Analytics',
  '/admin/complaints': 'Complaints',
  '/admin/dna': 'Complaint DNA',
  '/admin/residents': 'Residents',
  '/admin/technicians': 'Technicians & Security',
  '/admin/housekeeping': 'Housekeeping',
  '/admin/equipment': 'Equipment',
  '/admin/maintenance': 'Maintenance',
  '/admin/vendors': 'Vendors',
  '/admin/alerts': 'Alerts',
  '/admin/settings': 'Settings',
  '/admin/amenities': 'Amenities',
};

//  Nav groups
const NAV_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [
      { to: '/admin', icon: GridMinus, label: 'Dashboard' },
      { to: '/admin/analytics', icon: StatsReport, label: 'Analytics' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { to: '/admin/complaints', icon: ClipboardCheck, label: 'Complaints' },
      { to: '/admin/dna', icon: Dna, label: 'Complaint DNA' },
      { to: '/admin/residents', icon: Community, label: 'Residents' },
      { to: '/admin/technicians', icon: Wrench, label: 'Technicians & Security' },
      { to: '/admin/housekeeping', icon: Map, label: 'Housekeeping' },
      { to: '/admin/amenities', icon: Building, label: 'Amenities' },
    ],
  },
  {
    label: 'FACILITIES',
    items: [
      { to: '/admin/equipment', icon: Database, label: 'Equipment' },
      { to: '/admin/maintenance', icon: Calendar, label: 'Maintenance' },
      { to: '/admin/vendors', icon: Building, label: 'Vendors' },
    ],
  },
  {
    label: 'COMMUNITY',
    items: [
      { to: '/admin/alerts', icon: Bell, label: 'Alerts' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

// ── Notification bell with data ───────────────────────────────────────────────
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false)
        .then(({ count }) => setUnreadCount(count ?? 0));
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 36, height: 36,
          background: '#FFFFFF',
          border: '1px solid #E0DDD9',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#6B6560',
          transition: 'all 0.15s',
          position: 'relative',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1C1917'; (e.currentTarget as HTMLButtonElement).style.color = '#1C1917'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E0DDD9'; (e.currentTarget as HTMLButtonElement).style.color = '#6B6560'; }}
      >
        <Bell width={16} height={16} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 7, right: 7,
            width: 7, height: 7,
            background: '#D97706',
            borderRadius: '50%',
            border: '1.5px solid #EDEBE6',
          }} />
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 44,
          background: '#FFFFFF',
          border: '1px solid #E0DDD9',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          width: 280,
          zIndex: 50,
          padding: '12px 0',
        }}>
          <p style={{ padding: '4px 16px 8px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: '#1C1917' }}>
            Notifications
          </p>
          {unreadCount === 0 ? (
            <p style={{ padding: '8px 16px', fontFamily: 'Inter', fontSize: 13, color: '#9C9894' }}>No unread notifications.</p>
          ) : (
            <p style={{ padding: '8px 16px', fontFamily: 'Inter', fontSize: 13, color: '#6B6560' }}>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Admin Avatar Dropdown ─────────────────────────────────────────────────────
function AdminAvatarDropdown({ adminName, initials, onLogout }: { adminName: string, initials: string, onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div 
        onClick={() => setOpen(o => !o)}
        style={{
          width: 32, height: 32,
          background: '#1C1917',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: 12,
          color: '#EDEBE6',
          cursor: 'pointer',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        {initials}
      </div>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 40,
          background: '#FFFFFF',
          border: '1px solid #E0DDD9',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          width: 240,
          zIndex: 50,
          padding: '12px 0',
        }}>
          <div style={{ padding: '4px 16px 12px' }}>
            <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, color: '#1C1917', margin: 0 }}>{adminName}</p>
            <p style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 12, color: '#6B6560', margin: '2px 0 0' }}>Society Admin</p>
            <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 11, color: '#9C9894', margin: '2px 0 0' }}>Grand Omaxe</p>
          </div>
          <div style={{ height: 1, background: '#E0DDD9', margin: '0' }} />
          <div style={{ padding: '8px' }}>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px',
                borderRadius: 8,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#DC2626',
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: 13,
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <LogOut width={16} height={16} strokeWidth={1.5} />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────
export default function AdminLayout({
  children,
  onRefresh,
  isRefreshing,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [adminName, setAdminName] = useState('Admin');

  const pageTitle = PAGE_TITLES[pathname] ?? 'Admin';
  const initials = adminName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('users').select('name').eq('id', user.id).single()
        .then(({ data }) => { if (data?.name) setAdminName(data.name); });
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#EDEBE6' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 240,
        minWidth: 240,
        maxWidth: 240,
        height: '100vh',
        background: '#FFFFFF',
        borderRight: '1px solid #E0DDD9',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0, top: 0,
        zIndex: 20,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 1, padding: '24px 20px 0', overflow: 'hidden', width: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" height={28} alt="BlockFlow logo" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span style={{
              fontFamily: 'Space Grotesk',
              fontWeight: 700,
              fontSize: 18,
              color: '#1C1917',
              letterSpacing: '-0.3px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              maxWidth: 140,
              display: 'inline-block'
            }}>BlockFlow</span>
          </div>
          <div style={{ height: 1, background: '#E0DDD9', margin: '16px 0 8px' }} />
        </div>

        {/* Nav Container */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <nav className="sidebar-nav" style={{ padding: '0 12px', flex: 1, overflowY: 'auto' }}>
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                <span style={{
                  fontFamily: 'Inter',
                  fontWeight: 500,
                  fontSize: 10,
                  color: '#9C9894',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  padding: '16px 8px 4px',
                  display: 'block',
                }}>
                  {group.label}
                </span>
                {group.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/admin'}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      borderRadius: 10,
                      fontFamily: 'Space Grotesk',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 13,
                      color: isActive ? '#1C1917' : '#6B6560',
                      textDecoration: 'none',
                      background: isActive ? '#FEF3C7' : 'transparent',
                      marginBottom: 1,
                      userSelect: 'none',
                      position: 'relative',
                      transition: 'all 0.15s ease',
                    })}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      if (!el.classList.contains('active') && el.style.background !== 'rgb(254, 243, 199)') {
                        el.style.background = '#F5F3F0';
                        el.style.color = '#1C1917';
                      }
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      if (el.style.background === 'rgb(245, 243, 240)') {
                        el.style.background = 'transparent';
                        el.style.color = '#6B6560';
                      }
                    }}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span style={{
                            position: 'absolute',
                            left: -12,
                            top: 6,
                            bottom: 6,
                            width: 3,
                            background: '#D97706',
                            borderRadius: '0 3px 3px 0',
                          }} />
                        )}
                        <Icon width={18} height={18} strokeWidth={1.5} style={{ color: 'inherit', flexShrink: 0 }} />
                        <span>{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* Gradient fade */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40px',
            background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.95))',
            pointerEvents: 'none',
            borderRadius: '0 0 0 0'
          }} />
        </div>

        {/* Bottom: admin profile */}
        <div style={{ padding: '16px 16px 20px', background: '#FFFFFF', zIndex: 1 }}>
          <div style={{ height: 1, background: '#E0DDD9', marginBottom: 12 }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 8px',
            borderRadius: 10,
          }}>
            {/* Avatar */}
            <div style={{
              width: 36, height: 36,
              background: '#1C1917',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Space Grotesk',
              fontWeight: 700,
              fontSize: 13,
              color: '#EDEBE6',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: '#1C1917', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {adminName}
              </p>
              <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 11, color: '#9C9894', margin: 0 }}>
                Society Admin
              </p>
            </div>
            {/* Logout */}
            <button
              onClick={handleSignOut}
              title="Logout"
              style={{
                width: 28, height: 28,
                borderRadius: 8,
                background: 'transparent',
                border: 'none',
                color: '#9C9894',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F3F0'; (e.currentTarget as HTMLButtonElement).style.color = '#1C1917'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9C9894'; }}
            >
              <LogOut width={15} height={15} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Header ── */}
      <header style={{
        marginLeft: 240,
        height: 64,
        background: '#EDEBE6',
        borderBottom: '1px solid #E0DDD9',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}>
        {/* Page title */}
        <span style={{
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: 20,
          color: '#1C1917',
          whiteSpace: 'nowrap',
        }}>
          {pageTitle}
        </span>

        {/* Center space (Search removed) */}
        <div style={{ flex: 1 }} />

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh"
              style={{
                width: 36, height: 36,
                background: '#FFFFFF',
                border: '1px solid #E0DDD9',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: '#6B6560',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1C1917'; (e.currentTarget as HTMLButtonElement).style.color = '#1C1917'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E0DDD9'; (e.currentTarget as HTMLButtonElement).style.color = '#6B6560'; }}
            >
              <Refresh width={15} height={15} strokeWidth={1.5} style={{ transition: 'transform 0.3s' }} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Bell */}
          <NotificationBell />

          {/* Admin avatar */}
          <AdminAvatarDropdown adminName={adminName} initials={initials} onLogout={handleSignOut} />
        </div>
      </header>

      {/* ── Page content ── */}
      <main style={{ marginLeft: 240, padding: 28, minHeight: 'calc(100vh - 64px)' }}>
        {children}
      </main>

      <EstateManagerAgent />
    </div>
  );
}
