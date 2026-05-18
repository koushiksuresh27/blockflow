import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Users, Bell } from 'lucide-react';

export default function ResidentLayout() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || (path !== '/resident' && location.pathname.startsWith(path));
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <div className="max-w-[480px] mx-auto bg-white min-h-screen shadow-2xl flex flex-col relative">
        <main className="flex-1 overflow-y-auto pb-20">
          <Outlet />
        </main>
        
        <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-10 px-4 pb-safe">
          <Link 
            to="/resident" 
            className={`flex flex-col items-center gap-1 ${isActive('/resident') && location.pathname === '/resident' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link 
            to="/resident/community" 
            className={`flex flex-col items-center gap-1 ${isActive('/resident/community') ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Users className="w-6 h-6" />
            <span className="text-[10px] font-medium">Community</span>
          </Link>
          <Link 
            to="/resident/notifications" 
            className={`flex flex-col items-center gap-1 ${isActive('/resident/notifications') ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Bell className="w-6 h-6" />
            <span className="text-[10px] font-medium">Alerts</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
