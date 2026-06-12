import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  CheckCircle2,
  Upload,
  X,
  FileImage,
  FileVideo,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Carpentry',
  'HVAC',
  'Civil/Structural',
  'Housekeeping',
  'Lift/Elevator',
  'Common Area',
  'Other',
] as const;

type Priority = 'low' | 'medium' | 'high' | 'critical';

const PRIORITIES: { value: Priority; label: string; color: string; ring: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-[#9C9894]', ring: 'ring-[#9C9894]' },
  { value: 'medium', label: 'Med', color: 'bg-[#D97706]', ring: 'ring-[#D97706]' },
  { value: 'high', label: 'High', color: 'bg-orange-600', ring: 'ring-orange-600' },
  { value: 'critical', label: 'Critical', color: 'bg-red-600', ring: 'ring-red-600' },
];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'video/mp4'];
const MAX_FILES = 5;
const STORAGE_BUCKET = 'complaint-attachments';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttachedFile {
  file: File;
  previewUrl: string;  // object URL for images, empty string for video
  id: string;          // random key for list reconciliation
}

interface FormErrors {
  title?: string;
  category?: string;
  description?: string;
  files?: string;
  submit?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubmitComplaint() {
  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [description, setDescription] = useState('');
  const [preferredSlot, setPreferredSlot] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isDragging, setIsDragging] = useState(false);

  // Submission state
  const [loading, setLoading] = useState(false);
  const [successComplaintId, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File helpers ────────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const valid: AttachedFile[] = [];
    let err = '';

    for (const f of arr) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        err = 'Only JPG, PNG, and MP4 files are accepted.';
        continue;
      }
      if (files.length + valid.length >= MAX_FILES) {
        err = `You can attach at most ${MAX_FILES} files.`;
        break;
      }
      valid.push({
        file: f,
        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
        id: crypto.randomUUID(),
      });
    }

    setFiles((prev) => [...prev, ...valid]);
    setErrors((prev) => ({ ...prev, files: err || undefined }));
  }, [files]);

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!title.trim()) errs.title = 'Title is required.';
    else if (title.trim().length > 100) errs.title = 'Title must be 100 characters or fewer.';
    if (!category) errs.category = 'Please select a category.';
    if (!description.trim()) errs.description = 'Description is required.';
    else if (description.trim().length < 20) errs.description = 'Description must be at least 20 characters.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));

    try {
      // 1. Get current authenticated user
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('You must be logged in to submit a complaint.');

      // Fetch the user's profile to get society_id & sla defaults
      const { data: profile, error: profileErr } = await supabase
        .from('users')
        .select('society_id')
        .eq('id', user.id)
        .single();
      if (profileErr || !profile) throw new Error('Could not load your profile. Please try again.');

      // 2. Upload attachments to Supabase Storage
      const attachmentUrls: { url: string; type: 'before' | 'after' | 'general' }[] = [];

      for (const attached of files) {
        const ext = attached.file.name.split('.').pop() ?? 'bin';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, attached.file, { upsert: false });
        if (uploadErr) throw new Error(`Upload failed for "${attached.file.name}": ${uploadErr.message}`);

        const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        attachmentUrls.push({ url: urlData.publicUrl, type: 'general' });
      }

      // 3. Insert complaint row
      // SLA: 24 h for critical, 48 h for high, 72 h for medium/low (sensible defaults)
      const slaHours: Record<Priority, number> = { critical: 24, high: 48, medium: 72, low: 96 };
      const slaDeadline = new Date(Date.now() + slaHours[priority] * 60 * 60 * 1000).toISOString();

      const { data: complaint, error: insertErr } = await supabase
        .from('complaints')
        .insert({
          society_id: profile.society_id,
          submitted_by: user.id,
          type: 'personal',
          category,
          priority,
          status: 'open',
          title: title.trim(),
          description: description.trim(),
          preferred_slot: preferredSlot || null,
          sla_deadline: slaDeadline,
        })
        .select('id')
        .single();
      if (insertErr) throw new Error(insertErr.message);

      const complaintId: string = complaint.id;

      // 4. Insert complaint_attachments rows (if any)
      if (attachmentUrls.length > 0) {
        const attachRows = attachmentUrls.map((a) => ({
          complaint_id: complaintId,
          url: a.url,
          attachment_type: a.type,
          uploaded_by: user.id,
        }));
        const { error: attachErr } = await supabase.from('complaint_attachments').insert(attachRows);
        if (attachErr) console.warn('Attachment metadata insert failed:', attachErr.message);
      }

      // 5. Insert complaint_log entry
      const { error: logErr } = await supabase.from('complaint_logs').insert({
        complaint_id: complaintId,
        actor_id: user.id,
        action: 'submitted',
        new_status: 'open',
        note: 'Complaint submitted by resident.',
      });
      if (logErr) console.warn('Log insert failed:', logErr.message);

      // 6. Watch for DB auto-assignment trigger → send WhatsApp once, fire-and-forget
      // The DB trigger may assign a technician asynchronously after insert.
      // We subscribe to that specific row's UPDATE events and call the edge function
      // the moment status flips to 'assigned'. The channel cleans itself up after firing.
      const channel = supabase
        .channel(`complaint-assigned-${complaintId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'complaints',
            filter: `id=eq.${complaintId}`,
          },
          async (payload) => {
            const updated = payload.new as Record<string, unknown>;
            if (
              updated.status === 'assigned' &&
              updated.assigned_tech_id
            ) {
              try {
                const { data: tech } = await supabase
                  .from('technicians')
                  .select('user_id, tech_user:users!user_id(name, phone)')
                  .eq('id', updated.assigned_tech_id as string)
                  .single();

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const techUser = (tech as any)?.tech_user;
                if (techUser?.phone) {
                  await supabase.functions.invoke('send-whatsapp', {
                    body: {
                      technicianPhone:      techUser.phone,
                      technicianName:       techUser.name ?? 'Technician',
                      complaintTitle:       updated.title as string,
                      complaintDescription: updated.description as string,
                      flatLocation:         'See app for details',
                      priority:             updated.priority as string,
                      slaDeadline:          new Date(updated.sla_deadline as string)
                        .toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                    },
                  });
                }
              } catch (waErr) {
                // Non-fatal — complaint submission already succeeded
                console.warn('Auto-assign WhatsApp notification failed:', waErr);
              } finally {
                // Clean up: this subscription is single-use
                supabase.removeChannel(channel);
              }
            }
          }
        )
        .subscribe();

      // 7. Show success screen
      setSuccess(complaintId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrors((prev) => ({ ...prev, submit: msg }));
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────

  if (successComplaintId) {
    return (
      <div className="min-h-screen bg-[#F5F3F0] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white border border-[#E0DDD9] rounded-card shadow-xl p-8 text-center animate-[slideUp_0.3s_ease-out]">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
          </div>
          <h1 className="text-2xl font-display font-bold text-[#1C1917] mb-2">Complaint Submitted!</h1>
          <p className="text-sm font-sans text-[#6B6560] mb-8">
            Your complaint has been received and is now being processed.
          </p>

          <div className="bg-[#F5F3F0] border border-[#E0DDD9] rounded-xl px-5 py-4 mb-8 text-left">
            <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#9C9894] mb-1">
              Complaint ID
            </p>
            <p className="text-sm font-mono font-medium text-[#1C1917] break-all">
              {successComplaintId}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to={`/resident/complaints/${successComplaintId}`}
              className="w-full h-14 inline-flex items-center justify-center bg-[#1C1917] hover:bg-[#2C2925] text-white text-sm font-sans font-bold rounded-button transition active:scale-95"
            >
              Track Complaint
            </Link>
            <button
              onClick={() => {
                setSuccess(null);
                setTitle('');
                setCategory('');
                setPriority('medium');
                setDescription('');
                setPreferredSlot('');
                setFiles([]);
                setErrors({});
              }}
              className="w-full h-14 inline-flex items-center justify-center border border-[#E0DDD9] bg-[#F5F3F0] hover:bg-[#E0DDD9] text-[#1C1917] text-sm font-sans font-bold rounded-button transition active:scale-95"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[#F5F3F0] pb-24 relative">
      <header className="bg-white px-4 py-4 border-b border-[#E0DDD9] sticky top-0 z-10">
        <h1 className="text-xl font-display font-bold text-[#1C1917]">Submit Complaint</h1>
        <p className="text-sm font-sans text-[#6B6560] mt-0.5">We'll get it resolved quickly</p>
      </header>

      <div className="px-4 mt-6">
        {/* Card */}
        <div className="bg-white border border-[#E0DDD9] rounded-card shadow-sm p-5 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">

            {/* ── Title ── */}
            <div>
              <label htmlFor="complaint-title" className="block text-sm font-sans font-semibold text-[#1C1917] mb-1.5">
                Title <span className="text-[#D97706]">*</span>
              </label>
              <input
                id="complaint-title"
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Water leak in kitchen sink"
                className={`w-full px-4 py-3.5 text-sm font-sans border rounded-button bg-[#F5F3F0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C1917] transition ${errors.title ? 'border-red-400 focus:ring-red-500 bg-red-50' : 'border-[#E0DDD9]'
                  }`}
              />
              <div className="flex justify-between mt-1">
                {errors.title ? (
                  <FieldError message={errors.title} />
                ) : (
                  <span />
                )}
                <span className={`text-[10px] font-sans font-semibold mt-1 ${title.length > 90 ? 'text-[#D97706]' : 'text-[#9C9894]'}`}>
                  {title.length}/100
                </span>
              </div>
            </div>

            {/* ── Category ── */}
            <div>
              <label htmlFor="complaint-category" className="block text-sm font-sans font-semibold text-[#1C1917] mb-1.5">
                Category <span className="text-[#D97706]">*</span>
              </label>
              <div className="relative">
                <select
                  id="complaint-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`w-full appearance-none px-4 py-3.5 text-sm font-sans border rounded-button bg-[#F5F3F0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C1917] transition pr-10 ${errors.category ? 'border-red-400 focus:ring-red-500 bg-red-50' : 'border-[#E0DDD9]'
                    } ${!category ? 'text-[#9C9894]' : 'text-[#1C1917]'}`}
                >
                  <option value="" disabled>Select a category…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9C9894]" />
              </div>
              {errors.category && <FieldError message={errors.category} />}
            </div>

            {/* ── Priority ── */}
            <div>
              <p className="block text-sm font-sans font-semibold text-[#1C1917] mb-2">Priority</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" role="radiogroup" aria-label="Complaint priority">
                {PRIORITIES.map((p) => {
                  const isSelected = priority === p.value;
                  return (
                    <label
                      key={p.value}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-[10px] border cursor-pointer transition select-none ${isSelected
                          ? `border-[#1C1917] bg-white ring-1 ring-[#1C1917] shadow-sm`
                          : 'border-[#E0DDD9] bg-[#F5F3F0] hover:bg-[#E0DDD9]'
                        }`}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={p.value}
                        checked={isSelected}
                        onChange={() => setPriority(p.value)}
                        className="sr-only"
                      />
                      <span className={`w-3 h-3 rounded-full flex-shrink-0 ${p.color}`} aria-hidden="true" />
                      <span className={`text-sm font-sans font-bold ${isSelected ? 'text-[#1C1917]' : 'text-[#6B6560]'}`}>
                        {p.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* ── Description ── */}
            <div>
              <label htmlFor="complaint-description" className="block text-sm font-sans font-semibold text-[#1C1917] mb-1.5">
                Description <span className="text-[#D97706]">*</span>
              </label>
              <textarea
                id="complaint-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail — location, when it started, how severe it is…"
                className={`w-full px-4 py-3.5 text-sm font-sans border rounded-button bg-[#F5F3F0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C1917] transition resize-none ${errors.description ? 'border-red-400 focus:ring-red-500 bg-red-50' : 'border-[#E0DDD9]'
                  }`}
              />
              <div className="flex justify-between mt-1">
                {errors.description ? (
                  <FieldError message={errors.description} />
                ) : (
                  <span className="text-[10px] font-sans font-semibold text-[#9C9894] mt-1">Minimum 20 characters</span>
                )}
                <span className={`text-[10px] font-sans font-semibold mt-1 ml-auto ${description.length < 20 && description.length > 0 ? 'text-red-500' : 'text-[#9C9894]'}`}>
                  {description.length} chars
                </span>
              </div>
            </div>

            {/* ── Preferred Slot ── */}
            <div>
              <label htmlFor="preferred-slot" className="block text-sm font-sans font-semibold text-[#1C1917] mb-1.5">
                Preferred Time Slot <span className="text-[#9C9894] font-normal">(optional)</span>
              </label>
              <div className="relative">
                <select
                  id="preferred-slot"
                  value={preferredSlot}
                  onChange={(e) => setPreferredSlot(e.target.value)}
                  className={`w-full appearance-none px-4 py-3.5 text-sm font-sans border rounded-button bg-[#F5F3F0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C1917] transition pr-10 border-[#E0DDD9] ${!preferredSlot ? 'text-[#9C9894]' : 'text-[#1C1917]'}`}
                >
                  <option value="" disabled>Select preferred time…</option>
                  <option value="Morning (9 AM - 12 PM)">Morning (9 AM - 12 PM)</option>
                  <option value="Afternoon (12 PM - 4 PM)">Afternoon (12 PM - 4 PM)</option>
                  <option value="Evening (4 PM - 7 PM)">Evening (4 PM - 7 PM)</option>
                  <option value="Anytime">Anytime</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9C9894]" />
              </div>
            </div>

            {/* ── Photo / Video Upload ── */}
            <div>
              <p className="block text-sm font-sans font-semibold text-[#1C1917] mb-1.5">
                Attachments{' '}
                <span className="font-normal text-[#9C9894]">(optional, max {MAX_FILES})</span>
              </p>

              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload files drop zone"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-[14px] py-8 px-4 cursor-pointer transition ${isDragging
                    ? 'border-[#1C1917] bg-[#E0DDD9]'
                    : 'border-[#E0DDD9] bg-[#F5F3F0] hover:border-[#9C9894] hover:bg-[#E0DDD9]'
                  }`}
              >
                <Upload className={`w-7 h-7 ${isDragging ? 'text-[#1C1917]' : 'text-[#9C9894]'}`} />
                <p className="text-sm font-sans font-bold text-[#1C1917]">
                  {isDragging ? 'Drop files here' : 'Click or drag files here'}
                </p>
                <p className="text-xs font-sans text-[#6B6560]">JPG, PNG, MP4</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.mp4"
                  className="hidden"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = ''; // reset so same file can be re-selected
                  }}
                />
              </div>

              {errors.files && <FieldError message={errors.files} />}

              {/* Preview thumbnails */}
              {files.length > 0 && (
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {files.map((attached) => (
                    <div key={attached.id} className="relative group">
                      <div className="w-full aspect-square rounded-[10px] overflow-hidden border border-[#E0DDD9] bg-[#F5F3F0] flex items-center justify-center">
                        {attached.previewUrl ? (
                          <img
                            src={attached.previewUrl}
                            alt={attached.file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : attached.file.type === 'video/mp4' ? (
                          <FileVideo className="w-6 h-6 text-[#9C9894]" />
                        ) : (
                          <FileImage className="w-6 h-6 text-[#9C9894]" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(attached.id)}
                        aria-label={`Remove ${attached.file.name}`}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm focus:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <p className="mt-1.5 text-[10px] font-sans text-[#6B6560] truncate text-center leading-tight">
                        {attached.file.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Submit error ── */}
            {errors.submit && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-sans font-medium text-red-700">{errors.submit}</p>
              </div>
            )}

            {/* ── Submit button ── */}
            <button
              type="submit"
              id="submit-complaint-btn"
              disabled={loading}
              className="w-full h-14 flex items-center justify-center gap-2 bg-[#1C1917] hover:bg-[#2C2925] disabled:bg-[#9C9894] text-white text-sm font-sans font-bold rounded-button transition active:scale-95 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit Complaint'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Small helper component ───────────────────────────────────────────────────

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-1 text-[10px] font-sans font-semibold text-red-600 flex items-center gap-1">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {message}
    </p>
  );
}
