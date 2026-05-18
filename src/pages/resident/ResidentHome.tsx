import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Complaint {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
}

export default function ResidentHome() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('complaints')
          .select('id, title, status, priority, created_at')
          .eq('submitted_by', user.id)
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            if (data) setComplaints(data);
            setLoading(false);
          });
      }
    });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'assigned':
      case 'accepted': return 'text-blue-500 border-blue-500';
      case 'in_progress': return 'text-yellow-500 border-yellow-500';
      case 'resolved':
      case 'verified':
      case 'closed': return 'text-green-500 border-green-500';
      case 'escalated': return 'text-red-500 border-red-500';
      default: return 'text-gray-500 border-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'verified':
      case 'closed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'escalated': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="relative min-h-full pb-24 bg-gray-50">
      <header className="bg-blue-600 text-white px-6 py-12 rounded-b-[2rem] shadow-md">
        <h1 className="text-2xl font-bold mb-1">My Complaints</h1>
        <p className="text-blue-100 text-sm">Track and manage your requests</p>
      </header>

      <div className="px-5 -mt-6">
        {loading ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm flex justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : complaints.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">All clear!</h2>
            <p className="text-sm text-gray-500">You have no active complaints right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {complaints.map(complaint => (
              <Link 
                key={complaint.id} 
                to={`/resident/complaints/${complaint.id}`}
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-[0.98] transition-transform"
              >
                <div className={`shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center ${getStatusColor(complaint.status)} bg-opacity-10`}>
                  {getStatusIcon(complaint.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{complaint.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      {complaint.status.replace('_', ' ')}
                    </span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(complaint.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <Link 
        to="/resident/complaints/new"
        className="fixed bottom-20 right-1/2 translate-x-[200px] w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(37,99,235,0.3)] hover:bg-blue-700 active:scale-95 transition-all z-20"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}
