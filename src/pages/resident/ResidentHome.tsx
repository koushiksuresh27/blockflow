import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronRight, Clock, CheckCircle2, AlertCircle, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Complaint {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────
function ConfirmDeleteDialog({
  title,
  onConfirm,
  onCancel,
  deleting,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-card shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease-out]">
        <div className="flex justify-center pt-7 pb-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-red-500" />
          </div>
        </div>
        <div className="px-6 pb-2 text-center">
          <h2 className="text-base font-display font-bold text-[#1C1917] mb-2">Delete Request?</h2>
          <p className="text-sm text-[#6B6560] leading-relaxed font-sans">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-[#1C1917]">"{title}"</span>?
            {' '}This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 p-5">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-3 rounded-button border border-[#E0DDD9] text-sm font-semibold text-[#1C1917] hover:bg-[#F5F3F0] disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Keep it
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-3 rounded-button bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition flex items-center justify-center gap-2"
          >
            {deleting
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ResidentHome() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete state
  const [confirmTarget, setConfirmTarget] = useState<Complaint | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      case 'accepted': return 'text-[#1C1917] border-[#1C1917] bg-[#1C1917]/5';
      case 'in_progress': return 'text-[#D97706] border-[#D97706] bg-[#D97706]/5';
      case 'resolved':
      case 'verified':
      case 'closed': return 'text-green-600 border-green-600 bg-green-50';
      case 'escalated': return 'text-red-500 border-red-500 bg-red-50';
      default: return 'text-[#6B6560] border-[#6B6560] bg-[#6B6560]/5';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'verified':
      case 'closed': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'escalated': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress': return <Clock className="w-5 h-5 text-[#D97706]" />;
      default: return <Clock className="w-5 h-5 text-[#1C1917]" />;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    setDeleteError('');

    // Optimistic remove
    setComplaints(prev => prev.filter(c => c.id !== confirmTarget.id));

    const { error } = await supabase
      .from('complaints')
      .delete()
      .eq('id', confirmTarget.id);

    if (error) {
      // Rollback optimistic update
      setComplaints(prev => [confirmTarget, ...prev].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      setDeleteError('Failed to delete. Please try again.');
    }

    setDeleting(false);
    setConfirmTarget(null);
  };

  return (
    <div className="relative min-h-full pb-24 bg-[#F5F3F0]">
      <header className="bg-white px-6 pt-6 pb-6 border-b border-[#E0DDD9] sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-4">
          <img
            src="/logo.png"
            alt="BlockFlow"
            style={{ height: 24, width: 'auto', objectFit: 'contain' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span style={{
            fontFamily: 'Space Grotesk',
            fontWeight: 700,
            fontSize: 18,
            color: '#1C1917',
            letterSpacing: '-0.3px',
          }}>BlockFlow</span>
        </div>
        <div className="w-full h-[2px] bg-[#1C1917] mb-4" />
        <h1 className="text-2xl font-display font-bold text-[#1C1917] mb-1">My Complaints</h1>
        <p className="text-[#6B6560] text-sm font-sans">Track and manage your requests</p>
      </header>

      <div className="p-4">
        {/* Inline delete error */}
        {deleteError && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-card text-sm text-red-600 font-sans">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {deleteError}
            <button
              onClick={() => setDeleteError('')}
              className="ml-auto p-0.5 rounded-lg hover:bg-red-100 transition"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-card p-6 shadow-sm border border-[#E0DDD9] flex justify-center">
            <div className="w-6 h-6 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : complaints.length === 0 ? (
          <div className="bg-white rounded-card p-8 shadow-sm border border-[#E0DDD9] text-center">
            <div className="w-16 h-16 bg-[#F5F3F0] text-[#1C1917] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-display font-bold text-[#1C1917] mb-1">All clear!</h2>
            <p className="text-sm text-[#6B6560] font-sans">You have no active complaints right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.map(complaint => (
              <div key={complaint.id} className="relative group">
                <Link
                  to={`/resident/complaints/${complaint.id}`}
                  className="bg-white p-4 rounded-card shadow-sm border border-[#E0DDD9] flex items-center gap-4 active:scale-[0.98] transition-transform"
                >
                  <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${getStatusColor(complaint.status)}`}>
                    {getStatusIcon(complaint.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-sans font-semibold text-[#1C1917] truncate pr-8">
                      {complaint.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-display font-medium uppercase tracking-wider text-[#6B6560]">
                        {complaint.status.replace('_', ' ')}
                      </span>
                      <span className="w-1 h-1 bg-[#EDEBE6] rounded-full"></span>
                      <span className="text-xs text-[#9C9894] font-sans">
                        {formatDistanceToNow(new Date(complaint.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#9C9894] shrink-0" />
                </Link>

                {/* Delete button — only for 'open' status */}
                {complaint.status === 'open' && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteError('');
                      setConfirmTarget(complaint);
                    }}
                    aria-label={`Delete complaint: ${complaint.title}`}
                    className="absolute top-1/2 -translate-y-1/2 right-12 p-2 rounded-xl text-[#9C9894] hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <Link
        to="/resident/complaints/new"
        className="fixed bottom-[88px] right-1/2 translate-x-[200px] w-14 h-14 bg-[#1C1917] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#2C2925] active:scale-95 transition-all z-20"
      >
        <Plus className="w-6 h-6" />
      </Link>

      {/* Confirmation dialog */}
      {confirmTarget && (
        <ConfirmDeleteDialog
          title={confirmTarget.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { if (!deleting) setConfirmTarget(null); }}
          deleting={deleting}
        />
      )}
    </div>
  );
}
