import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, MapPin, Loader2 } from 'lucide-react';

interface CommunityComplaint {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  upvotes: number;
  user_upvoted: boolean;
}

export default function CommunityBoard() {
  const [complaints, setComplaints] = useState<CommunityComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchCommunityComplaints = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          id, title, description, category, status, created_at,
          complaint_upvotes(user_id)
        `)
        .eq('type', 'community')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped = data.map((c: any) => {
          const upvotesArray = c.complaint_upvotes || [];
          return {
            ...c,
            upvotes: upvotesArray.length,
            user_upvoted: upvotesArray.some((u: any) => u.user_id === uid)
          };
        });
        setComplaints(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchCommunityComplaints(user.id);
      }
    });
  }, []);

  const handleUpvote = async (complaintId: string, currentlyUpvoted: boolean) => {
    if (!userId) return;

    // Optimistic update
    setComplaints(prev => prev.map(c => {
      if (c.id === complaintId) {
        return {
          ...c,
          user_upvoted: !currentlyUpvoted,
          upvotes: c.upvotes + (currentlyUpvoted ? -1 : 1)
        };
      }
      return c;
    }));

    if (currentlyUpvoted) {
      await supabase
        .from('complaint_upvotes')
        .delete()
        .match({ complaint_id: complaintId, user_id: userId });
    } else {
      await supabase
        .from('complaint_upvotes')
        .insert({ complaint_id: complaintId, user_id: userId });
    }
  };

  return (
    <div className="min-h-full bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white px-6 py-8 rounded-b-[2rem] shadow-md">
        <h1 className="text-2xl font-bold mb-1">Community Board</h1>
        <p className="text-blue-100 text-sm">Common area issues and upvotes</p>
      </header>

      <div className="px-5 mt-6 space-y-4">
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : complaints.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">All clear!</h2>
            <p className="text-sm text-gray-500">No community complaints reported yet.</p>
          </div>
        ) : (
          complaints.map(complaint => (
            <div key={complaint.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start gap-3 mb-2">
                <h3 className="font-semibold text-gray-900">{complaint.title}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {complaint.category}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{complaint.description}</p>
              
              <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-full ${
                    complaint.status === 'resolved' || complaint.status === 'closed' 
                    ? 'bg-green-50 text-green-700' 
                    : 'bg-blue-50 text-blue-700'
                  }`}>
                    {complaint.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(complaint.created_at))} ago
                  </span>
                </div>
                
                <button 
                  onClick={() => handleUpvote(complaint.id, complaint.user_upvoted)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    complaint.user_upvoted 
                    ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <ThumbsUp className={`w-4 h-4 ${complaint.user_upvoted ? 'fill-blue-600' : ''}`} />
                  {complaint.upvotes}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
