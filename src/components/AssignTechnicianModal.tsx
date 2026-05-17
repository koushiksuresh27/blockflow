import { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle, X, Star, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Technician {
  id: string;
  name: string;
  specializations: string[];
  performance_score: number;
  is_available: boolean;
  open_task_count: number;
}

export interface AssignTechnicianModalProps {
  complaintId: string;
  complaintCategory: string; // used for specialization match sorting
  societyId: string;
  onClose: () => void;
  /** Called with the technician name so the parent can update its UI row immediately */
  onAssigned: (techName: string) => void;
  onError: (msg: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render 0-5 filled/empty stars for a numeric score (0-100 scale → 0-5) */
function Stars({ score }: { score: number }) {
  // DB stores performance_score as numeric, default 0. Treat it as 0-100 → map to 0-5
  const stars = Math.round((score / 100) * 5);
  return (
    <span className="flex items-center gap-0.5" aria-label={`${stars} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < stars ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`}
        />
      ))}
    </span>
  );
}

// Category → keywords that match technician specializations
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Plumbing:          ['plumbing', 'pipe', 'water'],
  Electrical:        ['electrical', 'electric', 'wiring'],
  Carpentry:         ['carpentry', 'woodwork', 'furniture'],
  HVAC:              ['hvac', 'ac', 'ventilation', 'cooling', 'heating'],
  'Civil/Structural':['civil', 'structural', 'masonry', 'concrete'],
  Housekeeping:      ['housekeeping', 'cleaning', 'sanitation'],
  'Lift/Elevator':   ['lift', 'elevator'],
  'Common Area':     ['common', 'garden', 'corridor'],
  Other:             [],
};

function specializationMatches(tech: Technician, category: string): boolean {
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  if (keywords.length === 0) return false;
  return tech.specializations.some((s) =>
    keywords.some((kw) => s.toLowerCase().includes(kw))
  );
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function loadTechnicians(societyId: string): Promise<Technician[]> {
  // Fetch techs + their open complaint count in one go
  const { data, error } = await supabase
    .from('technicians')
    .select(`
      id,
      specializations,
      performance_score,
      is_available,
      tech_user:users!user_id ( name ),
      open_complaints:complaints!assigned_tech_id ( status )
    `)
    .eq('society_id', societyId);

  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => {
    const openTasks = (row.open_complaints ?? []).filter(
      (c: { status: string }) =>
        !['closed', 'verified', 'resolved'].includes(c.status)
    ).length;

    return {
      id:                row.id,
      name:              row.tech_user?.name ?? 'Unknown',
      specializations:   row.specializations ?? [],
      performance_score: row.performance_score ?? 0,
      is_available:      row.is_available ?? false,
      open_task_count:   openTasks,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssignTechnicianModal({
  complaintId,
  complaintCategory,
  societyId,
  onClose,
  onAssigned,
  onError,
}: AssignTechnicianModalProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchErr, setFetchErr]       = useState('');
  const [selected, setSelected]       = useState<string | null>(null);
  const [confirming, setConfirming]   = useState(false);

  // Load technicians on mount
  useEffect(() => {
    loadTechnicians(societyId)
      .then(setTechnicians)
      .catch((e) => setFetchErr(e.message))
      .finally(() => setLoading(false));
  }, [societyId]);

  // Sort: specialization match first, then performance_score desc
  const sorted = useMemo(() => {
    return [...technicians].sort((a, b) => {
      const aMatch = specializationMatches(a, complaintCategory) ? 1 : 0;
      const bMatch = specializationMatches(b, complaintCategory) ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch;
      return b.performance_score - a.performance_score;
    });
  }, [technicians, complaintCategory]);

  const selectedTech = technicians.find((t) => t.id === selected);

  const handleConfirm = async () => {
    if (!selected || !selectedTech) return;
    setConfirming(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated.');

      const { error: upErr } = await supabase
        .from('complaints')
        .update({
          assigned_tech_id: selected,
          status:           'assigned',
          updated_at:       new Date().toISOString(),
        })
        .eq('id', complaintId);
      if (upErr) throw new Error(upErr.message);

      const { error: logErr } = await supabase.from('complaint_logs').insert({
        complaint_id: complaintId,
        actor_id:     user.id,
        action:       'assigned',
        new_status:   'assigned',
        note:         `Assigned to ${selectedTech.name}.`,
      });
      if (logErr) console.warn('Log insert failed:', logErr.message);

      onAssigned(selectedTech.name);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Assignment failed.';
      onError(msg);
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-modal-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 id="assign-modal-title" className="text-base font-bold text-gray-900">
              Assign Technician
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Category: <span className="font-medium text-gray-600">{complaintCategory}</span>
              {' · '}Sorted by best match
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {fetchErr && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {fetchErr}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 gap-2">
              <Briefcase className="w-8 h-8 text-gray-200" />
              <p className="text-sm">No technicians found for this society.</p>
            </div>
          ) : (
            <ul className="space-y-2" role="listbox" aria-label="Technician list">
              {sorted.map((tech) => {
                const isSelected = selected === tech.id;
                const isMatch = specializationMatches(tech, complaintCategory);

                return (
                  <li key={tech.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => setSelected(tech.id)}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: name + tags */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                              {tech.name}
                            </span>
                            {isMatch && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">
                                Best match
                              </span>
                            )}
                          </div>

                          {/* Specialization tags */}
                          {tech.specializations.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {tech.specializations.map((s) => (
                                <span
                                  key={s}
                                  className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Stars + open tasks */}
                          <div className="flex items-center gap-3 mt-2">
                            <Stars score={tech.performance_score} />
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              {tech.open_task_count} open task{tech.open_task_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Right: availability badge */}
                        <span
                          className={`mt-0.5 flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                            tech.is_available
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {tech.is_available ? 'Available' : 'Busy'}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-assign-btn"
            onClick={handleConfirm}
            disabled={!selected || confirming}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {confirming && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirming ? 'Assigning…' : 'Confirm Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}
