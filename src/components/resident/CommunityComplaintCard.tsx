import React, { useState, useEffect, useCallback } from 'react';
import type { CommunityComplaint, CommunityComplaintUpdate } from '../../types/communityComplaint';
import { STATUS_CONFIG, COMMUNITY_ASSETS } from '../../constants/communityAssets';
import { supabase } from '../../lib/supabase';

interface Props {
  complaint: CommunityComplaint;
  currentUserId: string;
  onAffectedJoined: () => void;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

export default function CommunityComplaintCard({ complaint, currentUserId, onAffectedJoined }: Props) {
  const [updates, setUpdates] = useState<CommunityComplaintUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(true);

  const fetchDetails = useCallback(async () => {
    try {
      setLoadingUpdates(true);
      const [updatesRes, joinRes] = await Promise.all([
        supabase
          .from('community_complaint_updates')
          .select('*')
          .eq('complaint_id', complaint.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('community_complaint_affected')
          .select('id')
          .eq('complaint_id', complaint.id)
          .eq('resident_id', currentUserId)
          .single()
      ]);

      if (updatesRes.data) {
        setUpdates(updatesRes.data as CommunityComplaintUpdate[]);
      }
      if (joinRes.data) {
        setHasJoined(true);
      }
    } catch (e) {
      // Intentionally ignoring error to silently fail and not crash the card
    } finally {
      setLoadingUpdates(false);
      setLoadingJoin(false);
    }
  }, [complaint.id, currentUserId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await supabase.from('community_complaint_affected').insert([
        { complaint_id: complaint.id, resident_id: currentUserId }
      ]);
      setHasJoined(true);
      onAffectedJoined();
    } catch (e) {
      console.error(e);
    } finally {
      setJoining(false);
    }
  };

  const assetConfig = COMMUNITY_ASSETS.find(a => a.type === complaint.asset_type) || COMMUNITY_ASSETS[COMMUNITY_ASSETS.length - 1];
  const emoji = assetConfig.emoji;
  
  const currentStep = STATUS_CONFIG[complaint.status].step;
  const accentColor = complaint.status === 'resolved' ? '#16a34a' : complaint.status === 'in_progress' ? '#D97706' : '#9C9894';

  // Find the exact row updates to map chronologically
  const reportedUpdate = updates.find(u => u.status === 'reported');
  const inProgressUpdate = updates.find(u => u.status === 'in_progress');
  const resolvedUpdate = updates.find(u => u.status === 'resolved');

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 16,
      border: '1px solid #E0DDD9',
      borderLeft: `4px solid ${accentColor}`,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }}>
      {/* Header */}
      <div>
        <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#1C1917', margin: '0 0 4px' }}>
          {emoji} {complaint.asset_label}
        </p>
        <p style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 14, color: '#6B6560', margin: '0 0 4px' }}>
          {complaint.title}
        </p>
        <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 12, color: '#9C9894', margin: 0 }}>
          Reported {timeAgo(complaint.created_at)}
        </p>
      </div>

      {/* Progress Tracker */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        {/* Background empty track */}
        <div style={{ position: 'absolute', top: 6, left: 16, right: 16, height: 2, background: '#E0DDD9', zIndex: 0 }} />
        {/* Filled amber track */}
        <div style={{ position: 'absolute', top: 6, left: 16, right: 16, height: 2, background: '#D97706', zIndex: 1, width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%', transition: 'width 0.3s ease-in-out' }} />

        {[
          { label: 'Reported', step: 1 },
          { label: 'Working', step: 2 },
          { label: 'Resolved', step: 3 },
        ].map(item => {
          const isCompleted = currentStep >= item.step;
          const isCurrent = currentStep === item.step;
          
          return (
            <div key={item.step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 2, width: 60 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: isCompleted ? '#D97706' : '#FFFFFF',
                border: `2px solid ${isCompleted ? '#D97706' : '#E0DDD9'}`,
                position: 'relative',
              }}>
                {isCurrent && (
                  <div style={{
                    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
                    border: '2px solid #D97706', borderRadius: '50%',
                    animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                )}
              </div>
              <span style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 11, color: isCompleted ? '#1C1917' : '#9C9894' }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Need dynamic styles for the animations since not using a CSS file */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes pulse-opacity {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Affected Count */}
      <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 13, color: '#6B6560', margin: 0 }}>
        👥 {complaint.affected_count} residents affected
      </p>

      {/* Updates List */}
      <div>
        <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, color: '#1C1917', margin: '0 0 12px' }}>
          Updates:
        </p>
        
        {loadingUpdates ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 18, background: '#F5F3F0', borderRadius: 4, width: '90%', animation: 'pulse-opacity 2s infinite' }} />
            <div style={{ height: 18, background: '#F5F3F0', borderRadius: 4, width: '70%', animation: 'pulse-opacity 2s infinite' }} />
            <div style={{ height: 18, background: '#F5F3F0', borderRadius: 4, width: '80%', animation: 'pulse-opacity 2s infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Row 1: Reported */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: reportedUpdate ? '#16a34a' : '#9C9894', fontSize: 14, lineHeight: '20px' }}>
                {reportedUpdate ? '✓' : '○'}
              </span>
              <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 13, color: reportedUpdate ? '#1C1917' : '#9C9894', margin: 0, lineHeight: '20px' }}>
                {reportedUpdate ? `${formatTime(reportedUpdate.created_at)} ${reportedUpdate.message}` : 'Reported. Technician being assigned.'}
              </p>
            </div>
            
            {/* Row 2: In Progress */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: inProgressUpdate ? '#16a34a' : '#9C9894', fontSize: 14, lineHeight: '20px' }}>
                {inProgressUpdate ? '✓' : '○'}
              </span>
              <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 13, color: inProgressUpdate ? '#1C1917' : '#9C9894', margin: 0, lineHeight: '20px' }}>
                {inProgressUpdate ? `${formatTime(inProgressUpdate.created_at)} ${inProgressUpdate.message}` : 'Pending — work not started yet'}
              </p>
            </div>
            
            {/* Row 3: Resolved */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: resolvedUpdate ? '#16a34a' : '#9C9894', fontSize: 14, lineHeight: '20px' }}>
                {resolvedUpdate ? '✓' : '○'}
              </span>
              <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 13, color: resolvedUpdate ? '#1C1917' : '#9C9894', margin: 0, lineHeight: '20px' }}>
                {resolvedUpdate ? `${formatTime(resolvedUpdate.created_at)} ${resolvedUpdate.message}` : 'Pending — not yet resolved'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* I'm Also Affected Button */}
      {complaint.status !== 'resolved' && !loadingJoin && (
        <div style={{ marginTop: 4 }}>
          {hasJoined ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#F0FDF4', color: '#15803D', borderRadius: 10, fontFamily: 'Inter', fontWeight: 500, fontSize: 13, border: '1px solid #86efac' }}>
              <span style={{ fontSize: 14 }}>✓</span> You reported this
            </div>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: '#D97706', color: '#FFFFFF', borderRadius: 10, border: 'none',
                fontFamily: 'Inter', fontWeight: 500, fontSize: 13, cursor: joining ? 'not-allowed' : 'pointer',
                opacity: joining ? 0.7 : 1
              }}
            >
              {joining ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation:'spin 1s linear infinite'}}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : <span style={{ fontSize: 14 }}>✋</span>}
              I'm also affected
            </button>
          )}
        </div>
      )}
    </div>
  );
}
