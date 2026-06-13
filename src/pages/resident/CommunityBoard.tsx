import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, Loader2, Plus, X, AlertTriangle, Trash2, UserCircle2 } from 'lucide-react';
import { useToast } from '../../components/Toast';
import type { CommunityComplaint } from '../../types/communityComplaint';
import CommunityComplaintCard from '../../components/resident/CommunityComplaintCard';
import ReportCommunityIssue from '../../components/resident/ReportCommunityIssue';

interface CommunityPost {
  id: string;
  society_id: string;
  posted_by: string;
  title: string;
  body: string;
  category: 'general' | 'complaint' | 'event' | 'sale' | 'help' | 'emergency';
  upvotes: number;
  created_at: string;
  user_upvoted?: boolean;
  tower_name?: string;
  author_name?: string;
}

const CATEGORIES = [
  { id: 'general', label: '📢 General' },
  { id: 'complaint', label: '🚨 Complaint' },
  { id: 'event', label: '🎉 Event' },
  { id: 'sale', label: '💰 Sale' },
  { id: 'help', label: '🆘 Help' },
  { id: 'emergency', label: '⚠️ Emergency' }
];

export default function CommunityBoard() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);
  
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState<string>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  
  const toast = useToast();
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New state for Community Issues
  const [communityComplaints, setCommunityComplaints] = useState<CommunityComplaint[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [showReportIssue, setShowReportIssue] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchUserDataAndPosts(user.id);
      }
    });

    const channel = supabase
      .channel('community_posts_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts' },
        () => {
          if (userId) {
            // Re-fetch everything to get the latest upvotes and relations easily
            fetchPosts(userId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!societyId) return;

    const complaintsChannel = supabase
      .channel('community-complaints-resident')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_complaints',
        filter: `society_id=eq.${societyId}`
      }, () => { fetchCommunityComplaints(societyId) })
      .subscribe();

    const updatesChannel = supabase
      .channel('community-updates-resident')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'community_complaint_updates',
      }, () => { fetchCommunityComplaints(societyId) })
      .subscribe();

    return () => {
      supabase.removeChannel(complaintsChannel);
      supabase.removeChannel(updatesChannel);
    };
  }, [societyId]);

  const fetchCommunityComplaints = async (sid: string) => {
    try {
      const { data } = await supabase
        .from('community_complaints')
        .select('*')
        .eq('society_id', sid)
        .neq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setCommunityComplaints(data as CommunityComplaint[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComplaints(false);
    }
  };

  const fetchUserDataAndPosts = async (uid: string) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('society_id')
        .eq('id', uid)
        .single();
        
      if (userData) {
        setSocietyId(userData.society_id);
        fetchCommunityComplaints(userData.society_id);
      }
      
      await fetchPosts(uid);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setLoadingComplaints(false);
    }
  };

  const fetchPosts = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select(`
          *,
          users!posted_by (
            name,
            apartments (
              towers (
                name
              )
            )
          ),
          community_post_upvotes(user_id)
        `);

      if (error) throw error;

      if (data) {
        const mapped = data.map((p: any) => {
          const upvotesArray = p.community_post_upvotes || [];
          const towerName = p.users?.apartments?.towers?.name || 'Unknown';
          const authorName = p.users?.name || 'Resident';
          
          return {
            ...p,
            upvotes: upvotesArray.length,
            user_upvoted: upvotesArray.some((u: any) => u.user_id === uid),
            tower_name: towerName,
            author_name: authorName
          };
        });
        
        // Feed ordering:
        // 1. Emergency always on top
        // 2. By upvotes desc
        // 3. By created_at desc
        mapped.sort((a, b) => {
          if (a.category === 'emergency' && b.category !== 'emergency') return -1;
          if (b.category === 'emergency' && a.category !== 'emergency') return 1;
          if (a.upvotes !== b.upvotes) return b.upvotes - a.upvotes;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setPosts(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async (postId: string, currentlyUpvoted: boolean) => {
    if (!userId) return;

    const targetPost = posts.find(p => p.id === postId);
    if (!targetPost) return;

    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          user_upvoted: !currentlyUpvoted,
          upvotes: p.upvotes + (currentlyUpvoted ? -1 : 1)
        };
      }
      return p;
    }));

    if (currentlyUpvoted) {
      await supabase
        .from('community_post_upvotes')
        .delete()
        .match({ post_id: postId, user_id: userId });
        
      // Decrement main upvotes count
      await supabase
        .from('community_posts')
        .update({ upvotes: targetPost.upvotes - 1 })
        .eq('id', postId);
    } else {
      await supabase
        .from('community_post_upvotes')
        .insert({ post_id: postId, user_id: userId });
        
      // Increment main upvotes count
      await supabase
        .from('community_posts')
        .update({ upvotes: targetPost.upvotes + 1 })
        .eq('id', postId);
    }
  };

  const handleCreatePost = async () => {
    if (!newTitle.trim() || newBody.trim().length < 20 || !userId || !societyId) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('community_posts').insert({
        society_id: societyId,
        posted_by: userId,
        title: newTitle.trim(),
        body: newBody.trim(),
        category: newCategory
      });
      
      if (error) throw error;
      
      setShowNewPost(false);
      setNewTitle('');
      setNewBody('');
      setNewCategory('general');
    } catch (err) {
      console.error('Error creating post:', err);
      toast('error', 'Failed to create post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!postToDelete || !userId) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', postToDelete)
        .eq('posted_by', userId);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postToDelete));
      toast('success', 'Post deleted');
    } catch (err) {
      console.error('Error deleting post:', err);
      toast('error', 'Failed to delete post');
    } finally {
      setIsDeleting(false);
      setPostToDelete(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'general': return 'bg-[#F5F3F0] text-[#6B6560] border border-[#E0DDD9]';
      case 'complaint': return 'bg-orange-50 text-orange-700 border border-orange-200';
      case 'event': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'sale': return 'bg-green-50 text-green-700 border border-green-200';
      case 'help': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'emergency': return 'bg-red-50 text-red-700 border border-red-200 font-bold';
      default: return 'bg-[#F5F3F0] text-[#6B6560] border border-[#E0DDD9]';
    }
  };

  return (
    <div className="min-h-full bg-[#F5F3F0] pb-24 relative">
      <header className="bg-white px-4 py-4 border-b border-[#E0DDD9] sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-xl font-display font-bold text-[#1C1917]">Community</h1>
        <button 
          onClick={() => setShowNewPost(true)}
          className="w-10 h-10 bg-[#1C1917] hover:bg-[#2C2925] text-white rounded-full flex justify-center items-center transition shadow-sm active:scale-95"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {/* Community Issues Section */}
      <div className="px-4 mt-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-display font-bold text-[#1C1917]">Community Issues</h2>
          <button 
            onClick={() => setShowReportIssue(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D97706] hover:bg-[#B45309] text-white rounded-[10px] text-sm font-sans font-semibold transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Report a community issue
          </button>
        </div>

        {loadingComplaints ? (
          <div className="flex justify-center py-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{animation:'spin 1s linear infinite'}}>
              <style>{`@keyframes spin{from{transform:rotate(0deg)} to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
        ) : communityComplaints.length === 0 ? (
          <div className="text-center py-8 bg-white border border-[#E0DDD9] rounded-card shadow-sm">
            <p className="text-[#6B6560] font-sans text-sm">✅ No active community issues. Your society is running smoothly!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {communityComplaints.map(complaint => (
              <CommunityComplaintCard
                key={complaint.id}
                complaint={complaint}
                currentUserId={userId!}
                onAffectedJoined={() => fetchCommunityComplaints(societyId!)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 mb-4">
        <h2 className="text-lg font-display font-bold text-[#1C1917]">Community Board</h2>
      </div>

      <div className="px-4 space-y-4">
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-[#1C1917]" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-card p-8 shadow-sm text-center border border-[#E0DDD9]">
            <h2 className="text-lg font-display font-bold text-[#1C1917] mb-1">It's quiet here</h2>
            <p className="text-sm font-sans text-[#6B6560]">Be the first to post something in the community.</p>
          </div>
        ) : (
          posts.map(post => {
            const isEmergency = post.category === 'emergency';
            const isExpanded = expandedPosts.has(post.id);
            
            return (
              <div 
                key={post.id} 
                className={`bg-white rounded-card p-5 shadow-sm border ${
                  isEmergency ? 'border-2 border-red-500' : 'border-[#E0DDD9]'
                }`}
              >
                {/* Author Info */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#F5F3F0] rounded-full flex items-center justify-center text-[#9C9894]">
                      <UserCircle2 className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-sans font-bold text-[#1C1917] leading-none">{post.author_name}</span>
                      <span className="text-[10px] font-sans text-[#6B6560] mt-1">Tower {post.tower_name} • {formatDistanceToNow(new Date(post.created_at))} ago</span>
                    </div>
                  </div>
                  {post.posted_by === userId && (
                    <button 
                      onClick={() => setPostToDelete(post.id)}
                      className="text-[#9C9894] hover:text-red-500 transition p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="mb-2">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {isEmergency && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white bg-red-600 px-2.5 py-1 rounded-badge">
                        <AlertTriangle className="w-3 h-3" /> URGENT
                      </span>
                    )}
                    {!isEmergency && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-badge ${getCategoryColor(post.category)}`}>
                        {post.category}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-bold text-lg text-[#1C1917] mb-1">{post.title}</h3>
                </div>
                
                <div className="mb-4">
                  <p className={`text-sm font-sans text-[#6B6560] whitespace-pre-wrap leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
                    {post.body}
                  </p>
                  {post.body.length > 150 && !isExpanded && (
                    <button 
                      onClick={() => toggleExpand(post.id)}
                      className="text-[#D97706] text-sm font-sans font-semibold mt-1 hover:underline"
                    >
                      Read more
                    </button>
                  )}
                  {isExpanded && (
                    <button 
                      onClick={() => toggleExpand(post.id)}
                      className="text-[#9C9894] text-sm font-sans font-semibold mt-1 hover:underline"
                    >
                      Show less
                    </button>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex items-center justify-between border-t border-[#E0DDD9] pt-3">
                  <button 
                    onClick={() => handleUpvote(post.id, !!post.user_upvoted)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-sans font-semibold transition active:scale-95 ${
                      post.user_upvoted 
                      ? 'bg-[#1C1917] text-white border border-[#1C1917]' 
                      : 'bg-[#F5F3F0] text-[#6B6560] border border-[#E0DDD9] hover:bg-[#E0DDD9]'
                    }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${post.user_upvoted ? 'fill-white' : ''}`} />
                    {post.upvotes}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Post Modal / Bottom Sheet */}
      {showNewPost && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-[#1C1917]/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[480px] rounded-t-[24px] sm:rounded-[24px] p-6 shadow-xl animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-display font-bold text-[#1C1917]">Create Post</h2>
              <button 
                onClick={() => setShowNewPost(false)}
                className="p-2 bg-[#F5F3F0] rounded-full hover:bg-[#E0DDD9] transition"
              >
                <X className="w-5 h-5 text-[#6B6560]" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-sans font-semibold text-[#1C1917] mb-1.5">Title</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What's this about?"
                  className="w-full border border-[#E0DDD9] bg-[#F5F3F0] rounded-button px-4 py-3.5 text-[#1C1917] font-sans placeholder:text-[#9C9894] focus:outline-none focus:ring-2 focus:ring-[#1C1917] focus:bg-white transition"
                />
              </div>
              
              <div>
                <label className="block text-sm font-sans font-semibold text-[#1C1917] mb-1.5">Details</label>
                <textarea 
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Share the details... (min 20 characters)"
                  rows={4}
                  className="w-full border border-[#E0DDD9] bg-[#F5F3F0] rounded-button px-4 py-3.5 text-[#1C1917] font-sans placeholder:text-[#9C9894] focus:outline-none focus:ring-2 focus:ring-[#1C1917] focus:bg-white transition resize-none"
                />
                <div className="text-right mt-1">
                  <span className={`text-xs font-sans ${newBody.length < 20 ? 'text-red-500' : 'text-green-600'}`}>
                    {newBody.length}/20 chars
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-sans font-semibold text-[#1C1917] mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setNewCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-sans font-semibold transition border ${
                        newCategory === cat.id 
                          ? 'border-[#1C1917] bg-[#1C1917] text-white' 
                          : 'border-[#E0DDD9] bg-white text-[#6B6560] hover:bg-[#F5F3F0]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                onClick={handleCreatePost}
                disabled={isSubmitting || !newTitle.trim() || newBody.trim().length < 20}
                className="w-full h-14 bg-[#1C1917] text-white font-sans font-bold rounded-button hover:bg-[#2C2925] disabled:opacity-50 disabled:cursor-not-allowed mt-6 flex justify-center items-center gap-2 active:scale-95 transition-transform"
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                Post to Community
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {postToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-xl animate-[slideUp_0.2s_ease-out]">
            <h2 className="text-xl font-display font-bold text-[#1C1917] mb-2">Delete this post?</h2>
            <p className="text-sm font-sans text-[#6B6560] mb-6">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPostToDelete(null)}
                className="px-5 py-2.5 rounded-button text-sm font-sans font-semibold text-[#1C1917] bg-[#F5F3F0] hover:bg-[#E0DDD9] transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeletePost}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-button text-sm font-sans font-semibold text-white bg-red-600 hover:bg-red-700 transition flex items-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {userId && societyId && (
        <ReportCommunityIssue
          isOpen={showReportIssue}
          onClose={() => setShowReportIssue(false)}
          onSubmitted={() => fetchCommunityComplaints(societyId)}
          currentUserId={userId}
          societyId={societyId}
        />
      )}
    </div>
  );
}
