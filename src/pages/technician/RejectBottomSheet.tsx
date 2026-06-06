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
      // Return complaint to open, unassign tech
      const { error: upErr } = await supabase
        .from('complaints')
        .update({
          status:           'open',
          assigned_tech_id: null,
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
        new_status:   'open',
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
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl animate-slideUp"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Reject Task</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-500 mb-4">
            Please select a reason for rejecting this task.
          </p>

          {REJECT_REASONS.map((reason) => (
            <label
              key={reason}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selected === reason
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
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
              <span className={`text-sm font-medium ${selected === reason ? 'text-red-700' : 'text-gray-700'}`}>
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
              className="w-full px-4 py-3 text-sm border-2 border-red-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-red-400 bg-red-50 placeholder-red-300 text-gray-700"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-2 flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-2xl hover:bg-gray-50 disabled:opacity-50 transition min-h-[48px]"
          >
            Cancel
          </button>
          <button
            id="confirm-reject-btn"
            onClick={handleConfirm}
            disabled={submitting || !canSubmit}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 rounded-2xl transition min-h-[48px]"
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
