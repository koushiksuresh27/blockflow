import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Community, Key, Bell, Calendar } from 'iconoir-react';

export default function ResidentLayout() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || (path !== '/resident' && location.pathname.startsWith(path));
  };

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => {
    const active = isActive(path);
    return (
      <Link 
        to={path} 
        className={`relative flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${active ? 'text-[#1C1917]' : 'text-[#9C9894]'}`}
      >
        {active && (
          <span className="absolute top-1 w-1.5 h-1.5 bg-[#D97706] rounded-full" />
        )}
        <Icon strokeWidth={active ? 2 : 1.5} className="w-6 h-6 mt-1" />
        <span className="text-[10px] font-medium font-sans">{label}</span>
      </Link>
    );
  };

  return (
    <div className="bg-[#EDEBE6] min-h-screen font-sans flex justify-center">
      <div className="w-full max-w-[480px] bg-white min-h-screen flex flex-col relative overflow-hidden border-x border-[#E0DDD9] shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_24px_rgba(0,0,0,0.06)]">
        <main className="flex-1 overflow-y-auto pb-[64px]">
          <Outlet />
        </main>
        
        <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E0DDD9] flex justify-around items-center h-[64px] z-10 px-2 pb-safe rounded-b-[16px]">
          <NavItem path="/resident" icon={Home} label="Home" />
          <NavItem path="/resident/community" icon={Community} label="Community" />
          <NavItem path="/resident/bookings" icon={Calendar} label="Bookings" />
          <NavItem path="/resident/gatepass" icon={Key} label="Gate Pass" />
          <NavItem path="/resident/notifications" icon={Bell} label="Alerts" />
        </nav>
      </div>
    </div>
  );
}
