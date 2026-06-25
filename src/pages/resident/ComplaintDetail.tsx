import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, ArrowLeft, User, Camera, CalendarClock, Star, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ComplaintDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  preferred_slot: string | null;
  assigned_tech_id: string | null;
  technician: { name: string } | null;
  logs: { action: string; created_at: string; note: string }[];
  attachments: { url: string; attachment_type: string }[];
}

export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ComplaintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showRatingScreen, setShowRatingScreen] = useState(false);
  const [selectedStars, setSelectedStars] = useState(0);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      const { data: complaint, error } = await supabase
        .from('complaints')
        .select(`
          id, title, description, status, created_at, preferred_slot, assigned_tech_id,
          technician:assigned_tech_id(user:user_id(name)),
          logs:complaint_logs(action, created_at, note),
          attachments:complaint_attachments(url, attachment_type)
        `)
        .eq('id', id)
        .single();

      if (!error && complaint) {
        const c = complaint as any;
        setData({
          id: c.id,
          title: c.title,
          description: c.description,
          status: c.status,
          created_at: c.created_at,
          preferred_slot: c.preferred_slot,
          assigned_tech_id: c.assigned_tech_id,
          technician: c.technician?.user ? { name: c.technician.user.name } : null,
          logs: (c.logs || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
          attachments: c.attachments || []
        });
      }
      setLoading(false);
    };

    fetchDetail();
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!id || !data) return;
    setUpdating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('complaints').update({ status: newStatus }).eq('id', id);
    await supabase.from('complaint_logs').insert({
      complaint_id: id,
      actor_id: user.id,
      action: newStatus === 'verified' ? 'verified' : 'reopened',
      new_status: newStatus,
      note: newStatus === 'verified' ? 'Resident verified the resolution.' : 'Resident reopened the complaint.',
    });

    setData({ ...data, status: newStatus });
    setUpdating(false);
  };

  const submitRating = async () => {
    if (!id || !data || selectedStars === 0) return;
    setUpdating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (data.assigned_tech_id) {
      await supabase.from('ratings').insert({
        complaint_id: id,
        rated_by: user.id,
        technician_id: data.assigned_tech_id,
        score: selectedStars
      });

      const { data: allRatings } = await supabase
        .from('ratings')
        .select('score')
        .eq('technician_id', data.assigned_tech_id);

      if (allRatings && allRatings.length > 0) {
        const avgScore = allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;
        await supabase.from('technicians').update({ performance_score: avgScore }).eq('id', data.assigned_tech_id);
      }
    }

    await supabase.from('complaints').update({ status: 'closed' }).eq('id', id);

    alert('Thank you for your rating!');
    navigate('/resident');
  };

  const skipRating = async () => {
    if (!id || !data) return;
    setUpdating(true);

    await supabase.from('complaints').update({ status: 'closed' }).eq('id', id);
    navigate('/resident');
  };

  if (loading) {
    return <div className="min-h-full bg-[#F5F3F0] flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-[#1C1917]" /></div>;
  }

  if (!data) {
    return <div className="p-10 bg-[#F5F3F0] text-center text-[#6B6560]">Complaint not found</div>;
  }

  const beforePhotos = data.attachments.filter(a => a.attachment_type === 'general' || a.attachment_type === 'before');
  const afterPhotos = data.attachments.filter(a => a.attachment_type === 'after');

  if (showRatingScreen) {
    return (
      <div className="min-h-full bg-white flex flex-col pt-20 px-6 items-center">
        <h1 className="text-2xl font-display font-bold text-[#1C1917] mb-2">Rate the service</h1>
        <p className="text-[#6B6560] font-sans mb-10 text-center">How was the technician's work?</p>

        <div className="flex gap-4 mb-12">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setSelectedStars(star)}
              className="p-2 -m-2 transition-transform active:scale-90"
            >
              <Star
                className={`w-12 h-12 ${star <= selectedStars
                    ? 'fill-[#D97706] text-[#D97706]'
                    : 'text-[#E0DDD9]'
                  }`}
              />
            </button>
          ))}
        </div>

        <button
          onClick={submitRating}
          disabled={selectedStars === 0 || updating}
          className="w-full max-w-sm bg-[#1C1917] text-white font-sans font-bold py-3.5 rounded-button disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2C2925] transition flex items-center justify-center gap-2 mb-4"
        >
          {updating && <Loader2 className="w-5 h-5 animate-spin" />}
          Submit Rating
        </button>

        <button
          onClick={skipRating}
          disabled={updating}
          className="text-sm font-sans font-semibold text-[#9C9894] hover:text-[#6B6560] py-2"
        >
          Skip
        </button>
      </div>
    );
  }

  // Define steps for progress
  const statusOrder = ['open', 'assigned', 'in_progress', 'resolved', 'closed', 'verified'];
  const currentStatusIndex = statusOrder.indexOf(data.status);

  const getStepStatus = (stepId: string) => {
    const stepIndex = statusOrder.indexOf(stepId);
    if (data.status === 'escalated') return stepIndex === 0 ? 'completed' : 'pending';
    if (currentStatusIndex >= stepIndex) {
      if (currentStatusIndex > stepIndex || data.status === 'closed' || data.status === 'verified') return 'completed';
      return 'current';
    }
    return 'pending';
  };

  const steps = [
    { id: 'open', label: 'Submitted' },
    { id: 'assigned', label: 'Assigned' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'resolved', label: 'Resolved' }
  ];

  return (
    <div className="min-h-full bg-[#F5F3F0] pb-24">
      <header className="bg-white px-4 py-4 border-b border-[#E0DDD9] sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-[#F5F3F0] transition">
          <ArrowLeft className="w-5 h-5 text-[#1C1917]" />
        </button>
        <h1 className="text-lg font-display font-bold text-[#1C1917] truncate flex-1">Complaint Detail</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Info Card */}
        <div className="bg-white rounded-card p-5 shadow-sm border border-[#E0DDD9]">
          <h2 className="text-xl font-display font-bold text-[#1C1917] mb-2">{data.title}</h2>
          <p className="text-sm text-[#6B6560] font-sans leading-relaxed mb-5">{data.description}</p>

          <div className="flex flex-col gap-3 text-sm text-[#6B6560] bg-[#F5F3F0] p-4 rounded-xl font-sans">
            {data.preferred_slot && (
              <div className="flex items-center gap-3">
                <CalendarClock className="w-5 h-5 text-[#9C9894]" />
                <span>Slot: <strong className="text-[#1C1917] font-semibold">{data.preferred_slot}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-[#9C9894]" />
              <span>Assigned: <strong className="text-[#1C1917] font-semibold">{data.technician?.name || 'Pending'}</strong></span>
            </div>
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="bg-white rounded-card p-5 shadow-sm border border-[#E0DDD9]">
          <h3 className="text-sm font-display font-bold text-[#1C1917] mb-4">Status Tracker</h3>
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-[#E0DDD9]">
            {steps.map((step, idx) => {
              const status = getStepStatus(step.id);
              return (
                <div key={idx} className="relative flex items-start gap-4">
                  <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white relative z-10 ${status === 'completed' ? 'border-green-600' :
                      status === 'current' ? 'border-[#D97706]' : 'border-[#E0DDD9]'
                    }`}>
                    {status === 'completed' && <Check className="w-3 h-3 text-green-600" />}
                    {status === 'current' && <div className="w-2 h-2 rounded-full bg-[#D97706]" />}
                  </div>
                  <div className="pt-0.5">
                    <h4 className={`text-sm font-sans font-semibold ${status === 'completed' || status === 'current' ? 'text-[#1C1917]' : 'text-[#9C9894]'
                      }`}>{step.label}</h4>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons if resolved */}
        {data.status === 'resolved' && (
          <div className="bg-[#D97706]/10 border border-[#D97706]/20 rounded-card p-5 shadow-sm">
            <h3 className="text-sm font-display font-bold text-[#1C1917] mb-2">Resolution Action Required</h3>
            <p className="text-xs text-[#1C1917]/80 font-sans mb-4">The technician marked this as resolved. Please verify if the issue is fixed, or reopen it.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRatingScreen(true)}
                disabled={updating}
                className="flex-1 bg-[#1C1917] text-white font-sans font-semibold py-2.5 rounded-button hover:bg-[#2C2925] transition flex items-center justify-center gap-2"
              >
                Verify
              </button>
              <button
                onClick={() => updateStatus('reopened')}
                disabled={updating}
                className="flex-1 bg-white text-[#1C1917] font-sans font-semibold py-2.5 rounded-button border border-[#E0DDD9] hover:bg-[#F5F3F0] transition"
              >
                Reopen
              </button>
            </div>
          </div>
        )}

        {/* Photos */}
        {data.attachments.length > 0 && (
          <div className="bg-white rounded-card p-5 shadow-sm border border-[#E0DDD9]">
            <h3 className="text-sm font-display font-bold text-[#1C1917] mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#9C9894]" /> Photos
            </h3>

            {beforePhotos.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-sans font-semibold text-[#6B6560] mb-2 uppercase tracking-wider">Issue Photos</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                  {beforePhotos.map((p, i) => (
                    <img key={i} src={p.url} alt="Before" className="w-24 h-24 object-cover rounded-[10px] shrink-0 snap-start border border-[#E0DDD9] bg-[#F5F3F0]" />
                  ))}
                </div>
              </div>
            )}

            {afterPhotos.length > 0 && (
              <div>
                <h4 className="text-xs font-sans font-semibold text-[#6B6560] mb-2 uppercase tracking-wider">Resolution Photos</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                  {afterPhotos.map((p, i) => (
                    <img key={i} src={p.url} alt="After" className="w-24 h-24 object-cover rounded-[10px] shrink-0 snap-start border border-green-200 bg-green-50" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-card p-5 shadow-sm border border-[#E0DDD9]">
          <h3 className="text-sm font-display font-bold text-[#1C1917] mb-5">Timeline</h3>
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-[#E0DDD9]">
            {data.logs.map((log, i) => (
              <div key={i} className="relative flex items-start gap-4">
                <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-[#D97706] shrink-0 z-10" />
                <div className="w-full p-3 rounded-xl border border-[#E0DDD9] bg-[#F5F3F0] shadow-sm mt-[-4px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold font-sans text-[#1C1917] text-xs capitalize">{log.action.replace('_', ' ')}</span>
                    <span className="text-[10px] font-sans text-[#9C9894] font-medium">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-xs font-sans text-[#6B6560]">{log.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
