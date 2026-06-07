import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, Loader2, Plus, X, AlertTriangle, Trash2 } from 'lucide-react';
import { useToast } from '../../components/Toast';

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

  const fetchUserDataAndPosts = async (uid: string) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('society_id')
        .eq('id', uid)
        .single();
        
      if (userData) {
        setSocietyId(userData.society_id);
      }
      
      await fetchPosts(uid);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchPosts = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select(`
          *,
          users!posted_by (
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
          
          return {
            ...p,
            upvotes: upvotesArray.length,
            user_upvoted: upvotesArray.some((u: any) => u.user_id === uid),
            tower_name: towerName
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
      case 'general': return 'bg-gray-100 text-gray-700';
      case 'complaint': return 'bg-orange-100 text-orange-700';
      case 'event': return 'bg-purple-100 text-purple-700';
      case 'sale': return 'bg-green-100 text-green-700';
      case 'help': return 'bg-blue-100 text-blue-700';
      case 'emergency': return 'bg-red-100 text-red-700 font-bold';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-full bg-gray-50 pb-20 relative">
      <header className="bg-blue-600 text-white px-6 py-6 rounded-b-[2rem] shadow-md flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold mb-1">Community Board</h1>
          <p className="text-blue-100 text-sm">Connect with your neighbors</p>
        </div>
        <button 
          onClick={() => setShowNewPost(true)}
          className="bg-white/20 hover:bg-white/30 transition text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          New Post
        </button>
      </header>

      <div className="px-5 mt-6 space-y-4">
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <h2 className="text-lg font-bold text-gray-900 mb-1">It's quiet here</h2>
            <p className="text-sm text-gray-500">Be the first to post something in the community.</p>
          </div>
        ) : (
          posts.map(post => {
            const isEmergency = post.category === 'emergency';
            const isExpanded = expandedPosts.has(post.id);
            
            return (
              <div 
                key={post.id} 
                className={`bg-white rounded-2xl p-5 shadow-sm border ${
                  isEmergency ? 'border-l-4 border-l-red-500 border-y-red-100 border-r-red-100' : 'border-gray-100'
                }`}
              >
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="flex-1">
                    {isEmergency && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-1 rounded-md mb-2">
                        <AlertTriangle className="w-3 h-3" /> URGENT
                      </span>
                    )}
                    <h3 className="font-semibold text-gray-900">{post.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEmergency && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${getCategoryColor(post.category)}`}>
                        {post.category}
                      </span>
                    )}
                    {post.posted_by === userId && (
                      <button 
                        onClick={() => setPostToDelete(post.id)}
                        className="text-gray-400 hover:text-red-500 transition p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className={`text-sm text-gray-600 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`}>
                    {post.body}
                  </p>
                  {post.body.length > 150 && !isExpanded && (
                    <button 
                      onClick={() => toggleExpand(post.id)}
                      className="text-blue-600 text-sm font-medium mt-1 hover:underline"
                    >
                      Read more
                    </button>
                  )}
                  {isExpanded && (
                    <button 
                      onClick={() => toggleExpand(post.id)}
                      className="text-gray-500 text-sm font-medium mt-1 hover:underline"
                    >
                      Show less
                    </button>
                  )}
                </div>
                
                <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-700">Resident, Tower {post.tower_name}</span>
                    <span className="text-[10px] text-gray-400">
                      {formatDistanceToNow(new Date(post.created_at))} ago
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => handleUpvote(post.id, !!post.user_upvoted)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      post.user_upvoted 
                      ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${post.user_upvoted ? 'fill-blue-600 text-blue-600' : ''}`} />
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
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/50">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Create Post</h2>
              <button 
                onClick={() => setShowNewPost(false)}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What's this about?"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
                <textarea 
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Share the details... (min 20 characters)"
                  rows={4}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="text-right mt-1">
                  <span className={`text-xs ${newBody.length < 20 ? 'text-red-500' : 'text-green-500'}`}>
                    {newBody.length}/20 chars
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setNewCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                        newCategory === cat.id 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
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
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex justify-center items-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold mb-2">Delete this post?</h2>
            <p className="text-gray-500 mb-6">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPostToDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeletePost}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition flex items-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
