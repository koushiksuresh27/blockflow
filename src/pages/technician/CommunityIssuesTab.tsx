import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useTechProfile } from './TechnicianLayout';
import type { CommunityComplaint } from '../../types/communityComplaint';

export default function CommunityIssuesTab() {
  const { profile } = useTechProfile();
  const [complaints, setComplaints] = useState<CommunityComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchComplaints = useCallback(async () => {
    if (!profile?.techId) return;
    
    try {
      const { data, error } = await supabase
        .from('community_complaints')
        .select('*')
        .eq('assigned_tech_id', profile.techId)
        .neq('status', 'resolved')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      if (data) {
        setComplaints(data as CommunityComplaint[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile?.techId]);

  useEffect(() => {
    fetchComplaints();
    
    const channel = supabase
      .channel('community-complaints-tech')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_complaints',
      }, () => {
        fetchComplaints();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchComplaints]);

  if (!profile) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F3F0] pb-24 font-inter">
      <div className="bg-white px-6 pt-12 pb-6 border-b border-[#E0DDD9] sticky top-0 z-10 shadow-none">
        <h1 className="text-[22px] font-bold text-[#1C1917] tracking-tight font-['Space_Grotesk']">
          Community Issues
        </h1>
        <p className="text-sm font-medium text-[#6B6560] mt-1">
          Assigned to you
        </p>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" style={{animation:'spin 1s linear infinite'}}>
              <style>{`@keyframes spin{from{transform:rotate(0deg)} to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#6B6560] font-medium font-inter">No active community issues.</p>
          </div>
        ) : (
          complaints.map(complaint => (
            <CommunityComplaintTechCard 
              key={complaint.id} 
              complaint={complaint} 
              currentUserId={profile.userId}
              onUpdate={fetchComplaints}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CommunityComplaintTechCard({ 
  complaint, 
  currentUserId, 
  onUpdate 
}: { 
  complaint: CommunityComplaint, 
  currentUserId: string,
  onUpdate: () => void 
}) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isReported = complaint.status === 'reported';
  const isInProgress = complaint.status === 'in_progress';
  const isResolved = complaint.status === 'resolved';

  const handleUpdate = async () => {
    if (!message.trim() || submitting) return;
    
    setSubmitting(true);
    const nextStatus = isReported ? 'in_progress' : 'resolved';
    
    try {
      await supabase.from('community_complaint_updates').insert({
        complaint_id: complaint.id,
        status: nextStatus,
        message: message.trim(),
        updated_by: currentUserId,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = { status: nextStatus };
      if (nextStatus === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }

      await supabase
        .from('community_complaints')
        .update(updateData)
        .eq('id', complaint.id);

      setMessage('');
      onUpdate();
    } catch (e) {
      console.error(e);
      alert('Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const assetEmoji = getAssetEmoji(complaint.asset_type);

  return (
    <div className="bg-[#FFFFFF] rounded-[16px] border border-[#E0DDD9] p-4 flex flex-col gap-3 font-inter">
      <div>
        <h3 className="font-semibold text-[#1C1917] text-base font-['Space_Grotesk']">
          {assetEmoji} {complaint.asset_label}
        </h3>
        <p className="text-[#1C1917] text-sm font-semibold mt-1">{complaint.title}</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-amber-600 text-sm font-medium bg-amber-50 px-2 py-1 rounded-[6px]">
          👥 {complaint.affected_count} residents affected
        </span>
        <span className="text-[#6B6560] text-sm font-medium">
          Status: {isReported ? 'Reported' : isInProgress ? 'In Progress' : 'Resolved'}
        </span>
      </div>

      {!isResolved && (
        <div className="mt-2 border-t border-[#E0DDD9] pt-3">
          <p className="text-sm font-medium text-[#1C1917] mb-2">Post next update:</p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe what you found / what was done..."
            className="w-full border border-[#E0DDD9] rounded-[10px] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] mb-3 resize-none bg-[#F5F3F0]"
            rows={2}
          />
          
          <button
            onClick={handleUpdate}
            disabled={!message.trim() || submitting}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] font-medium text-[15px] transition-colors ${
              isReported 
                ? 'bg-[#2563EB] text-[#FFFFFF] hover:bg-[#1D4ED8] disabled:opacity-50' 
                : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
            }`}
          >
            {submitting && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation:'spin 1s linear infinite'}}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            )}
            {isReported ? 'Mark as In Progress' : 'Mark as Resolved'}
          </button>
        </div>
      )}
      
      {isResolved && (
        <div className="mt-2 flex justify-center py-2 bg-green-50 rounded-xl">
          <span className="text-green-700 font-medium text-sm">✓ Resolved</span>
        </div>
      )}
    </div>
  );
}

function getAssetEmoji(type: string) {
  const map: Record<string, string> = {
    lift: '🛗', gym: '🏋️', pool: '🏊', generator: '⚡', corridor: '🚶',
    parking: '🅿️', terrace: '🏗️', water: '💧', power: '🔌', other: '🔧'
  };
  return map[type] || '🔧';
}
