import React, { useState, useEffect } from 'react';
import { NavArrowLeft } from 'iconoir-react';
import { supabase } from '../../lib/supabase';
import { COMMUNITY_ASSETS, STATUS_CONFIG } from '../../constants/communityAssets';
import type { AssetConfig } from '../../constants/communityAssets';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  currentUserId: string;
  societyId: string;
}


export default function ReportCommunityIssue({ isOpen, onClose, onSubmitted, currentUserId, societyId }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 'success'>(1);
  const [selectedAsset, setSelectedAsset] = useState<AssetConfig | null>(null);
  const [description, setDescription] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [existingComplaint, setExistingComplaint] = useState<any | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedAsset(null);
      setDescription('');
      setExistingComplaint(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);


  const handleAssetSelect = (asset: AssetConfig) => {
    setSelectedAsset(asset);
    setStep(2);
  };

  const handleContinueToStep3 = async () => {
    if (!selectedAsset) return;
    
    setLoadingExisting(true);
    setStep(3);
    
    try {
      const { data } = await supabase
        .from('community_complaints')
        .select('*, community_complaint_affected(count)')
        .eq('society_id', societyId)
        .eq('asset_type', selectedAsset.type)
        .is('tower_id', null)
        .neq('status', 'resolved')
        .maybeSingle();

      if (data) {
        setExistingComplaint(data);
      } else {
        setExistingComplaint(null);
      }
    } catch (e) {
      console.error(e);
      setExistingComplaint(null);
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleSubmitNew = async () => {
    if (!selectedAsset) return;
    
    setSubmitting(true);
    try {
      const assetLabel = selectedAsset.label;

      // 1. Insert complaint
      const { data: newComplaint, error: complaintError } = await supabase
        .from('community_complaints')
        .insert({
          society_id: societyId,
          tower_id: null,
          asset_type: selectedAsset.type,
          asset_label: assetLabel,
          title: selectedAsset.defaultTitle,
          description: description.trim() || null,
          status: 'reported',
          reported_by: currentUserId,
        })
        .select()
        .single();
        
      if (complaintError || !newComplaint) throw complaintError || new Error('Failed to create complaint');

      // 2. Insert into affected
      await supabase
        .from('community_complaint_affected')
        .insert({
          complaint_id: newComplaint.id,
          resident_id: currentUserId,
        });

      // 3. Insert first milestone update
      await supabase
        .from('community_complaint_updates')
        .insert({
          complaint_id: newComplaint.id,
          status: 'reported',
          message: 'Issue reported. Technician being assigned.',
          updated_by: currentUserId,
        });

      setStep('success');
      setTimeout(() => {
        onSubmitted();
        onClose();
      }, 2000);

    } catch (e) {
      console.error(e);
      alert('Failed to submit complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinExisting = async () => {
    if (!existingComplaint) return;
    setSubmitting(true);
    try {
      await supabase
        .from('community_complaint_affected')
        .insert({
          complaint_id: existingComplaint.id,
          resident_id: currentUserId,
        });
        
      setStep('success');
      setTimeout(() => {
        onSubmitted();
        onClose();
      }, 2000);
    } catch (e) {
      console.error(e);
      alert('Failed to join complaint. You may have already joined it.');
    } finally {
      setSubmitting(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        background: '#FFFFFF', 
        borderRadius: 16, 
        width: '100%', 
        maxWidth: 480,
        maxHeight: '90vh', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: step !== 'success' ? '1px solid #E0DDD9' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {(step === 2 || step === 3) && (
              <button 
                onClick={() => setStep(step === 2 ? 1 : 2)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: '#1C1917', display: 'flex' }}
              >
                <NavArrowLeft width={20} height={20} strokeWidth={1.5} />
              </button>
            )}
            {step !== 'success' && (
              <h3 style={{ margin: 0, fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 18, color: '#1C1917' }}>
                {step === 1 ? "What's the issue with?" : step === 2 ? "Tell us more" : existingComplaint ? "Already reported!" : "Confirm Report"}
              </h3>
            )}
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: '#9C9894', display: 'flex' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Step Indicators */}
        {step !== 'success' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '16px 24px 0' }}>
            {[1, 2, 3].map(num => (
              <div key={num} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: step === num ? '#D97706' : step > num ? '#D97706' : '#E0DDD9',
                opacity: step === num ? 1 : step > num ? 0.4 : 1
              }} />
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto' }}>
          
          {/* STEP 1 */}
          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {COMMUNITY_ASSETS.map(asset => {
                const isSelected = selectedAsset?.type === asset.type;
                return (
                  <button
                    key={asset.type}
                    onClick={() => handleAssetSelect(asset)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '16px 12px', background: '#FFFFFF',
                      border: `1px solid ${isSelected ? '#D97706' : '#E0DDD9'}`,
                      borderRadius: 10, cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{asset.emoji}</span>
                    <span style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#1C1917', textAlign: 'center' }}>
                      {asset.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1C1917', marginBottom: 8, fontFamily: 'Space Grotesk' }}>Description (optional)</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Anything else we should know? (optional)"
                  style={{ 
                    width: '100%', padding: '10px 14px', border: '1px solid #E0DDD9', 
                    borderRadius: 10, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <button
                onClick={handleContinueToStep3}
                style={{
                  padding: '12px', background: '#1C1917', color: '#FFFFFF',
                  border: 'none', borderRadius: 10, fontFamily: 'Inter', fontWeight: 500, fontSize: 15,
                  cursor: 'pointer',
                  marginTop: 8
                }}
              >
                Continue
              </button>

            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && loadingExisting && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{animation:'spin 1s linear infinite'}}>
                <style>{`@keyframes spin{from{transform:rotate(0deg)} to{transform:rotate(360deg)}}`}</style>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              <span style={{ fontFamily: 'Inter', color: '#6B6560', fontSize: 14 }}>Checking recent reports...</span>
            </div>
          )}

          {step === 3 && !loadingExisting && existingComplaint && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 48 }}>{selectedAsset?.emoji}</span>
                <h4 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#1C1917', margin: '8px 0 4px' }}>
                  {existingComplaint.title}
                </h4>
                <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#D97706', margin: 0, fontWeight: 500 }}>
                  👥 {existingComplaint.community_complaint_affected?.[0]?.count || 1} residents have already reported this
                </p>
              </div>

              {/* Simple progress tracker */}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 16 }}>
                <div style={{ position: 'absolute', top: 6, left: 16, right: 16, height: 2, background: '#E0DDD9', zIndex: 0 }} />
                <div style={{ position: 'absolute', top: 6, left: 16, right: 16, height: 2, background: '#D97706', zIndex: 1, width: existingComplaint.status === 'reported' ? '0%' : existingComplaint.status === 'in_progress' ? '50%' : '100%' }} />

                {[
                  { label: 'Reported', status: 'reported', step: 1 },
                  { label: 'Working', status: 'in_progress', step: 2 },
                  { label: 'Resolved', status: 'resolved', step: 3 },
                ].map((item) => {
                  const currentStep = STATUS_CONFIG[existingComplaint.status as keyof typeof STATUS_CONFIG]?.step || 1;
                  const isCompleted = currentStep >= item.step;
                  
                  return (
                    <div key={item.step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 2, width: 60 }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: isCompleted ? '#D97706' : '#FFFFFF',
                        border: `2px solid ${isCompleted ? '#D97706' : '#E0DDD9'}`,
                      }} />
                      <span style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 11, color: isCompleted ? '#1C1917' : '#9C9894' }}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleJoinExisting}
                disabled={submitting}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px', background: '#D97706', color: '#FFFFFF',
                  border: 'none', borderRadius: 10, fontFamily: 'Inter', fontWeight: 600, fontSize: 15,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation:'spin 1s linear infinite'}}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                ) : '✋'}
                Add me to affected list
              </button>
            </div>
          )}

          {step === 3 && !loadingExisting && !existingComplaint && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              <div style={{ background: '#F5F3F0', padding: 16, borderRadius: 12 }}>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#1C1917', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{selectedAsset?.emoji}</span>
                  {selectedAsset?.label}
                </p>
                <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 14, color: '#6B6560', margin: 0 }}>
                  {description ? `"${description}"` : 'No description provided.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 20 }}>📬</span>
                <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917', margin: 0, lineHeight: 1.5 }}>
                  This will notify the estate manager and auto-assign a technician.
                </p>
              </div>

              <button
                onClick={handleSubmitNew}
                disabled={submitting}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px', background: '#1C1917', color: '#FFFFFF',
                  border: 'none', borderRadius: 10, fontFamily: 'Inter', fontWeight: 600, fontSize: 15,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                  marginTop: 8
                }}
              >
                {submitting ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation:'spin 1s linear infinite'}}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                ) : null}
                Submit complaint
              </button>
            </div>
          )}

          {/* SUCCESS SCREEN */}
          {step === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 24 }}>
                ✓
              </div>
              <h4 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 20, color: '#1C1917', margin: '0 0 12px' }}>
                Reported!
              </h4>
              <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0, lineHeight: 1.5 }}>
                A technician will be assigned shortly. You'll be notified at each update.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
