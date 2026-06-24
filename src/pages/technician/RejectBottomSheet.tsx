import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RejectBottomSheetProps {
  complaintId: string;
  techId: string;
  userId: string;
  onClose: () => void;
  onRejected: () => void;
  onError: (msg: string) => void;
}

const REJECT_REASONS = [
  'Currently busy',
  'Wrong specialization',
  'Location issue',
  'Other',
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function RejectBottomSheet({
  complaintId, techId, userId, onClose, onRejected, onError,
}: RejectBottomSheetProps) {
  const [selected, setSelected]   = useState<string>('Currently busy');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isOther   = selected === 'Other';
  const finalNote = isOther ? customReason.trim() : selected;
  const canSubmit = !isOther || customReason.trim().length > 0;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Mark as rejected but do NOT set assigned_tech_id to null (violates RLS)
      const { error: upErr } = await supabase
        .from('complaints')
        .update({
          status:           'rejected',
          rejection_reason: finalNote,
          updated_at:       new Date().toISOString(),
        })
        .eq('id', complaintId);
      if (upErr) throw new Error(upErr.message);

      // Insert log — note techId used as actor (user is the auth user)
      await supabase.from('complaint_logs').insert({
        complaint_id: complaintId,
        actor_id:     userId,
        action:       'rejected',
        old_status:   'assigned',
        new_status:   'rejected',
        note:         finalNote || 'Rejected by technician.',
      });

      // Update technician availability (optional: mark temporarily unavailable)
      // We leave availability unchanged — admin can reassign

      onRejected();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Rejection failed.');
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  // Suppress linting warning — techId is in props for future use
  void techId;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reject task"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[480px] bg-[#FFFFFF] rounded-t-[16px] shadow-2xl animate-slideUp font-inter"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#E0DDD9]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E0DDD9]">
          <h2 className="text-base font-bold text-[#1C1917] font-['Space_Grotesk']">Reject Task</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-xl hover:bg-[#F5F3F0] flex items-center justify-center transition"
          >
            <X className="w-5 h-5 text-[#6B6560]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-[#6B6560] mb-4">
            Please select a reason for rejecting this task.
          </p>

          {REJECT_REASONS.map((reason) => (
            <label
              key={reason}
              className={`flex items-center gap-3 p-4 rounded-[10px] border-2 cursor-pointer transition-all ${
                selected === reason
                  ? 'border-red-400 bg-red-50'
                  : 'border-[#E0DDD9] hover:border-[#E0DDD9] hover:bg-[#F5F3F0]'
              }`}
            >
              <input
                type="radio"
                name="reject-reason"
                value={reason}
                checked={selected === reason}
                onChange={() => setSelected(reason)}
                className="accent-red-500 w-4 h-4 shrink-0"
              />
              <span className={`text-sm font-medium ${selected === reason ? 'text-red-700' : 'text-[#1C1917]'}`}>
                {reason}
              </span>
            </label>
          ))}

          {/* Custom reason for "Other" */}
          {isOther && (
            <textarea
              id="reject-custom-reason"
              rows={3}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe the reason for rejection…"
              className="w-full px-4 py-3 text-sm border-2 border-red-200 rounded-[10px] resize-none focus:outline-none focus:ring-2 focus:ring-red-400 bg-red-50 placeholder-red-300 text-[#1C1917]"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-2 flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3.5 text-sm font-semibold text-[#6B6560] border border-[#E0DDD9] rounded-[10px] hover:bg-[#F5F3F0] disabled:opacity-50 transition min-h-[48px]"
          >
            Cancel
          </button>
          <button
            id="confirm-reject-btn"
            onClick={handleConfirm}
            disabled={submitting || !canSubmit}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-[10px] transition min-h-[48px]"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Rejecting…</>
            ) : (
              'Confirm Reject'
            )}
          </button>
        </div>
      </div>
    </>
  );
}
