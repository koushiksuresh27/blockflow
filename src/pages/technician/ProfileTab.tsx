import { useState, useEffect, useCallback } from 'react';
import { Loader2, Star, LogOut, ToggleLeft, ToggleRight, AlertCircle, Award, CheckCircle2, TrendingUp, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useTechProfile } from './TechnicianLayout';
import { useToast } from '../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PerformanceStats {
  avgRating: number | null;
  totalCompleted: number;
  slaCompliance: number | null;
  thisMonth: number;
}

interface Rating {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  complaintTitle: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function Stars({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const sz = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${sz} ${i <= score ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'}`}
        />
      ))}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div className={`rounded-[16px] p-4 ${accent}`}>
      <div className="flex items-start justify-between mb-3">
        <Icon className="w-5 h-5 opacity-80" />
      </div>
      <p className="text-2xl font-black leading-none">{value}</p>
      {sub && <p className="text-[11px] opacity-70 mt-0.5">{sub}</p>}
      <p className="text-xs font-semibold mt-2 opacity-80">{label}</p>
    </div>
  );
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function loadProfileData(techId: string): Promise<{ stats: PerformanceStats; ratings: Rating[] }> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { data: ratingsRaw },
    { count: totalCompleted },
    { count: thisMonth },
  ] = await Promise.all([
    supabase
      .from('ratings')
      .select('id, score, comment, created_at, complaint:complaints!complaint_id(title)')
      .eq('technician_id', techId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_tech_id', techId)
      .in('status', ['resolved', 'verified', 'closed']),
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_tech_id', techId)
      .in('status', ['resolved', 'verified', 'closed'])
      .gte('updated_at', startOfMonth.toISOString()),
  ]);

  // Compute average rating
  const scores = (ratingsRaw ?? []).map((r: { score: number }) => r.score);
  const avgRating = scores.length > 0
    ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ratings: Rating[] = (ratingsRaw ?? []).map((r: any) => ({
    id:             r.id,
    score:          r.score,
    comment:        r.comment,
    created_at:     r.created_at,
    complaintTitle: r.complaint?.title ?? '—',
  }));

  const stats: PerformanceStats = {
    avgRating,
    totalCompleted: totalCompleted ?? 0,
    slaCompliance:  null, // Requires extra query — show N/A if not computed
    thisMonth:      thisMonth ?? 0,
  };

  return { stats, ratings };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfileTab() {
  const navigate = useNavigate();
  const { profile } = useTechProfile();
  const toast = useToast();

  const [stats, setStats]     = useState<PerformanceStats | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [technicianId, setTechnicianId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.techId) return;
    setError('');
    try {
      const data = await loadProfileData(profile.techId);
      setStats(data.stats);
      setRatings(data.ratings);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  }, [profile?.techId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    async function fetchAvailability() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: techData } = await supabase
        .from('technicians')
        .select('is_available, id')
        .eq('user_id', user.id)
        .single();
      
      if (techData) {
        setIsAvailable(techData.is_available);
        setTechnicianId(techData.id);
      }
    }
    fetchAvailability();
  }, []);

  const handleToggleAvailability = async () => {
    if (!technicianId) return;
    
    const newVal = !isAvailable;
    setIsAvailable(newVal); // optimistic update
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: upErr } = await supabase
      .from('technicians')
      .update({ is_available: newVal })
      .eq('user_id', user.id);
    
    if (upErr) {
      console.error('Failed to update availability:', upErr);
      setIsAvailable(!newVal); // revert
      toast('error', 'Failed to update availability', upErr.message);
      return;
    }
    
    console.log('Availability updated:', newVal);
    toast('success', newVal ? 'You are now available' : 'You are now busy', '');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const avgDisplay = stats?.avgRating != null
    ? stats.avgRating.toFixed(1)
    : '—';

  return (
    <div className="min-h-full bg-[#EDEBE6] pb-6 font-inter">
      {/* Header */}
      <div className="bg-[#FFFFFF] border-b border-[#E0DDD9] px-5 pt-8 pb-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className="w-16 h-16 rounded-[16px] bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center shadow-none">
              <span className="text-white text-xl font-black">
                {profile ? getInitials(profile.name) : '?'}
              </span>
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
              isAvailable ? 'bg-green-500' : 'bg-red-400'
            }`} />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-[#1C1917] font-recoleta">{profile?.name ?? 'Loading…'}</h1>
            <p className="text-xs text-[#9C9894] mt-0.5">Technician</p>
            {/* Specializations */}
            {profile && profile.specializations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.specializations.map((spec) => (
                  <span key={spec} className="text-[10px] font-bold px-2 py-0.5 rounded-[6px] bg-[#EFF6FF] text-[#2563EB]">
                    {spec}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Availability toggle */}
        <button
          id="availability-toggle"
          onClick={handleToggleAvailability}
          className={`mt-4 w-full flex items-center justify-between px-4 py-3.5 rounded-[10px] border transition min-h-[48px] ${
            isAvailable
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              isAvailable ? 'bg-green-500' : 'bg-red-400'
            }`} />
            <span className="text-sm font-bold">
              {isAvailable ? 'Available for new tasks' : 'Marked as busy'}
            </span>
          </div>
          {isAvailable ? (
            <ToggleRight className="w-6 h-6" />
          ) : (
            <ToggleLeft className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="px-4 mt-4 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
        ) : (
          <>
            {/* Performance Stats Grid */}
            <div>
              <h2 className="text-sm font-bold text-[#1C1917] font-recoleta mb-3">Performance</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Avg Rating"
                  value={avgDisplay}
                  sub={stats?.avgRating != null ? '/ 5 stars' : 'No ratings yet'}
                  icon={Star}
                  accent="bg-amber-50 text-amber-800"
                />
                <StatCard
                  label="Total Completed"
                  value={String(stats?.totalCompleted ?? 0)}
                  sub="all time"
                  icon={Award}
                  accent="bg-blue-50 text-blue-800"
                />
                <StatCard
                  label="SLA Compliance"
                  value={stats?.slaCompliance != null ? `${stats.slaCompliance}%` : 'N/A'}
                  icon={TrendingUp}
                  accent="bg-green-50 text-green-800"
                />
                <StatCard
                  label="This Month"
                  value={String(stats?.thisMonth ?? 0)}
                  sub="completed"
                  icon={Calendar}
                  accent="bg-purple-50 text-purple-800"
                />
              </div>
            </div>

            {/* Recent Ratings */}
            <div>
              <h2 className="text-sm font-bold text-[#1C1917] font-recoleta mb-3">Recent Ratings</h2>
              {ratings.length === 0 ? (
                <div className="bg-[#FFFFFF] rounded-[16px] border border-[#E0DDD9] p-6 text-center">
                  <Star className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-[#9C9894]">No ratings yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ratings.map((r) => (
                    <div key={r.id} className="bg-[#FFFFFF] rounded-[16px] border border-[#E0DDD9] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#1C1917] font-recoleta truncate">{r.complaintTitle}</p>
                          <p className="text-[10px] text-[#9C9894] mt-0.5">{fmtDate(r.created_at)}</p>
                        </div>
                        <Stars score={r.score} />
                      </div>
                      {r.comment && (
                        <p className="text-xs text-[#6B6560] italic mt-2 pt-2 border-t border-[#E0DDD9]">
                          "{r.comment}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed jobs quick stat */}
            <div className="bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] rounded-[16px] p-5 text-white">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-[#EFF6FF]" strokeWidth={1.5} />
                <div>
                  <p className="text-3xl font-black leading-none">{stats?.totalCompleted ?? 0}</p>
                  <p className="text-[#EFF6FF] text-xs font-medium mt-1">Jobs completed in total</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Logout */}
        <button
          id="logout-btn"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-[12px] px-[20px] text-sm font-bold text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-[10px] hover:bg-[#fee2e2] transition min-h-[48px] mt-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
