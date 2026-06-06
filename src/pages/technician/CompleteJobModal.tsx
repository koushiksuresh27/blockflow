import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import {
  X, ImagePlus, Loader2, AlertCircle, CheckCircle2, Upload,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoFile {
  file: File;
  preview: string;
}

export interface CompleteJobModalProps {
  complaintId: string;
  complaintTitle: string;
  onClose: () => void;
  onResolved: () => void;
  onError: (msg: string) => void;
}

const BUCKET = 'complaint-attachments';

// ─── Photo Picker ─────────────────────────────────────────────────────────────

function PhotoPicker({
  id, label, value, onChange, error,
}: {
  id: string; label: string; value: PhotoFile | null;
  onChange: (pf: PhotoFile | null) => void; error?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    if (value) URL.revokeObjectURL(value.preview);
    onChange({ file, preview: URL.createObjectURL(file) });
    e.target.value = '';
  };

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">
        {label} <span className="text-red-500">*</span>
      </p>
      {value ? (
        <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-gray-200 group">
          <img src={value.preview} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => { URL.revokeObjectURL(value.preview); onChange(null); }}
            aria-label={`Remove ${label}`}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-80 hover:opacity-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent py-2 px-3">
            <p className="text-xs text-white font-medium">{label} uploaded ✓</p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          id={id}
          onClick={() => ref.current?.click()}
          className={`w-full h-40 flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl transition ${
            error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            error ? 'bg-red-100' : 'bg-gray-200'
          }`}>
            <ImagePlus className={`w-6 h-6 ${error ? 'text-red-400' : 'text-gray-400'}`} />
          </div>
          <div className="text-center">
            <p className={`text-sm font-semibold ${error ? 'text-red-600' : 'text-gray-600'}`}>
              Tap to upload {label}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG or WebP</p>
          </div>
        </button>
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center animate-bounceIn">
          <CheckCircle2 className="w-12 h-12 text-green-500" strokeWidth={1.5} />
        </div>
        <div className="absolute inset-0 rounded-full bg-green-200 animate-ping opacity-30" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Job Complete! 🎉</h2>
      <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
        Your job has been marked as resolved and is waiting for resident verification.
      </p>

      <div className="mt-6 px-6 py-4 bg-green-50 border border-green-100 rounded-2xl w-full max-w-xs">
        <p className="text-xs text-green-600 font-medium text-center">
          Waiting for resident verification
        </p>
      </div>

      <button
        id="back-to-home-btn"
        onClick={onBack}
        className="mt-8 w-full max-w-xs py-4 bg-blue-600 text-white font-bold text-sm rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(37,99,235,0.3)]"
      >
        Back to Home
      </button>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function CompleteJobModal({
  complaintId, complaintTitle, onClose, onResolved, onError,
}: CompleteJobModalProps) {
  const [beforePhoto, setBeforePhoto] = useState<PhotoFile | null>(null);
  const [afterPhoto, setAfterPhoto]   = useState<PhotoFile | null>(null);
  const [notes, setNotes]             = useState('');
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState(false);
  const [success, setSuccess]         = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!beforePhoto) e.before = 'Before photo is required.';
    if (!afterPhoto)  e.after  = 'After photo is required.';
    if (!notes.trim())            e.notes = 'Resolution notes are required.';
    else if (notes.trim().length < 20) e.notes = 'Notes must be at least 20 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const canSubmit = !!beforePhoto && !!afterPhoto && notes.trim().length >= 20;

  const uploadPhoto = async (pf: PhotoFile, type: 'before' | 'after') => {
    const ext  = pf.file.name.split('.').pop() ?? 'jpg';
    const path = `complaints/${complaintId}/${type}_${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, pf.file);
    if (error) throw new Error(`Upload failed (${type}): ${error.message}`);
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated.');

      // Upload both photos in parallel
      const [beforeUrl, afterUrl] = await Promise.all([
        uploadPhoto(beforePhoto!, 'before'),
        uploadPhoto(afterPhoto!, 'after'),
      ]);

      // Insert attachment rows
      await supabase.from('complaint_attachments').insert([
        { complaint_id: complaintId, url: beforeUrl, attachment_type: 'before', uploaded_by: user.id },
        { complaint_id: complaintId, url: afterUrl,  attachment_type: 'after',  uploaded_by: user.id },
      ]);

      // Update complaint status
      const { error: upErr } = await supabase
        .from('complaints')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', complaintId);
      if (upErr) throw new Error(upErr.message);

      // Insert log
      await supabase.from('complaint_logs').insert({
        complaint_id: complaintId,
        actor_id:     user.id,
        action:       'resolved',
        old_status:   'in_progress',
        new_status:   'resolved',
        note:         notes.trim(),
      });

      setSuccess(true);
      onResolved();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Submission failed.');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return <SuccessScreen onBack={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-job-title"
        className="bg-white w-full max-w-[480px] rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h2 id="complete-job-title" className="text-base font-bold text-gray-900">Complete Job</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">{complaintTitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <PhotoPicker
            id="before-photo-btn"
            label="Before Photo"
            value={beforePhoto}
            onChange={setBeforePhoto}
            error={errors.before}
          />
          <PhotoPicker
            id="after-photo-btn"
            label="After Photo"
            value={afterPhoto}
            onChange={setAfterPhoto}
            error={errors.after}
          />

          {/* Resolution notes */}
          <div>
            <label htmlFor="resolution-notes" className="text-sm font-semibold text-gray-700 mb-2 block">
              Resolution Notes <span className="text-red-500">*</span>
              <span className="ml-2 text-xs font-normal text-gray-400">(min 20 characters)</span>
            </label>
            <textarea
              id="resolution-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what you fixed and how the issue was resolved…"
              className={`w-full px-4 py-3 text-sm border rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-gray-50 ${
                errors.notes ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {errors.notes ? (
                <p role="alert" className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.notes}
                </p>
              ) : <span />}
              <p className={`text-xs ml-auto ${notes.length >= 20 ? 'text-green-500' : 'text-gray-400'}`}>
                {notes.length}/20 min
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-3">
          {!canSubmit && (
            <p className="text-xs text-center text-gray-400">
              Upload both photos and add notes to enable submission
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-2xl hover:bg-gray-50 transition min-h-[48px]"
            >
              Cancel
            </button>
            <button
              id="submit-completion-btn"
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 rounded-2xl transition min-h-[48px]"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
              ) : (
                <><Upload className="w-4 h-4" />Submit & Complete</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
