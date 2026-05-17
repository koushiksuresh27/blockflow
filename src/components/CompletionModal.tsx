import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Loader2, Upload, X, AlertCircle, ImagePlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompletionModalProps {
  complaintId: string;
  complaintTitle: string;
  onClose: () => void;
  onResolved: () => void;
  onError: (msg: string) => void;
}

interface PhotoFile {
  file: File;
  preview: string;
}

const BUCKET = 'complaint-attachments';

// ─── Helper ───────────────────────────────────────────────────────────────────

function PhotoPicker({
  label,
  value,
  onChange,
  error,
  id,
}: {
  label: string;
  value: PhotoFile | null;
  onChange: (pf: PhotoFile | null) => void;
  error?: string;
  id: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return;
    const old = value;
    if (old) URL.revokeObjectURL(old.preview);
    onChange({ file, preview: URL.createObjectURL(file) });
    e.target.value = '';
  };

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1.5">
        {label} <span className="text-red-500">*</span>
      </p>
      {value ? (
        <div className="relative w-full h-36 rounded-xl overflow-hidden border border-gray-200 group">
          <img src={value.preview} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => { URL.revokeObjectURL(value.preview); onChange(null); }}
            aria-label={`Remove ${label}`}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          id={id}
          onClick={() => ref.current?.click()}
          className={`w-full h-36 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl transition ${
            error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }`}
        >
          <ImagePlus className="w-6 h-6 text-gray-400" />
          <span className="text-xs text-gray-500">Tap to upload JPG/PNG</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png" className="hidden" onChange={pick} />
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function CompletionModal({
  complaintId,
  complaintTitle,
  onClose,
  onResolved,
  onError,
}: CompletionModalProps) {
  const [beforePhoto, setBeforePhoto] = useState<PhotoFile | null>(null);
  const [afterPhoto, setAfterPhoto]   = useState<PhotoFile | null>(null);
  const [notes, setNotes]             = useState('');
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!beforePhoto) e.before = 'Before photo is required.';
    if (!afterPhoto)  e.after  = 'After photo is required.';
    if (!notes.trim()) e.notes = 'Resolution notes are required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const uploadPhoto = async (pf: PhotoFile, type: 'before' | 'after', userId: string) => {
    const ext  = pf.file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/${complaintId}/${type}_${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, pf.file);
    if (error) throw new Error(`Upload failed (${type}): ${error.message}`);
    return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, type };
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated.');

      // Upload both photos in parallel
      const [before, after] = await Promise.all([
        uploadPhoto(beforePhoto!, 'before', user.id),
        uploadPhoto(afterPhoto!,  'after',  user.id),
      ]);

      // Insert attachment rows
      await supabase.from('complaint_attachments').insert([
        { complaint_id: complaintId, url: before.url, attachment_type: 'before', uploaded_by: user.id },
        { complaint_id: complaintId, url: after.url,  attachment_type: 'after',  uploaded_by: user.id },
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
        new_status:   'resolved',
        note:         notes.trim(),
      });

      onResolved();
      onClose();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Submission failed.');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-modal-title"
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 id="completion-modal-title" className="text-base font-bold text-gray-900">
              Mark as Complete
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">{complaintTitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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

          {/* Notes */}
          <div>
            <label htmlFor="resolution-notes" className="text-sm font-medium text-gray-700 mb-1.5 block">
              Resolution Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              id="resolution-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what was done to fix the issue…"
              className={`w-full px-3.5 py-2.5 text-sm border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                errors.notes ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50'
              }`}
            />
            {errors.notes && (
              <p role="alert" className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.notes}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            id="submit-completion-btn"
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 rounded-xl transition"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</> : <>
              <Upload className="w-4 h-4" />Submit</>}
          </button>
        </div>
      </div>
    </div>
  );
}
