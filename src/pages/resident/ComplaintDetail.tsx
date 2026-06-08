import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, ArrowLeft, User, Camera, CalendarClock, Star } from 'lucide-react';
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
    return <div className="min-h-full flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  if (!data) {
    return <div className="p-10 text-center text-gray-500">Complaint not found</div>;
  }

  const beforePhotos = data.attachments.filter(a => a.attachment_type === 'general' || a.attachment_type === 'before');
  const afterPhotos = data.attachments.filter(a => a.attachment_type === 'after');

  if (showRatingScreen) {
    return (
      <div className="min-h-full bg-white flex flex-col pt-20 px-6 items-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Rate the service</h1>
        <p className="text-gray-500 mb-10 text-center">How was the technician's work?</p>
        
        <div className="flex gap-4 mb-12">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setSelectedStars(star)}
              className="p-2 -m-2 transition-transform active:scale-90"
            >
              <Star 
                className={`w-12 h-12 ${
                  star <= selectedStars 
                    ? 'fill-blue-500 text-blue-500' 
                    : 'text-gray-300'
                }`} 
              />
            </button>
          ))}
        </div>

        <button
          onClick={submitRating}
          disabled={selectedStars === 0 || updating}
          className="w-full max-w-sm bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition flex items-center justify-center gap-2 mb-4"
        >
          {updating && <Loader2 className="w-5 h-5 animate-spin" />}
          Submit Rating
        </button>
        
        <button
          onClick={skipRating}
          disabled={updating}
          className="text-sm font-semibold text-gray-400 hover:text-gray-600 py-2"
        >
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 pb-20">
      <header className="bg-white px-4 py-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 truncate flex-1">Complaint Detail</h1>
      </header>

      <div className="p-5 space-y-6">
        {/* Info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start gap-4 mb-3">
            <h2 className="text-lg font-bold text-gray-900">{data.title}</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full whitespace-nowrap">
              {data.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-4">{data.description}</p>
          
          <div className="flex flex-col gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
            {data.preferred_slot && (
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                <span>Slot: <strong className="text-gray-700">{data.preferred_slot}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Assigned to: <strong className="text-gray-700">{data.technician?.name || 'Pending'}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Buttons if resolved */}
        {data.status === 'resolved' && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-blue-900 mb-2">Resolution Action Required</h3>
            <p className="text-xs text-blue-700 mb-4">The technician marked this as resolved. Please verify if the issue is fixed, or reopen it.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRatingScreen(true)}
                disabled={updating}
                className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                Verify
              </button>
              <button 
                onClick={() => updateStatus('reopened')}
                disabled={updating}
                className="flex-1 bg-white text-gray-700 font-semibold py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
              >
                Reopen
              </button>
            </div>
          </div>
        )}

        {/* Photos */}
        {data.attachments.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4 text-gray-500" /> Photos
            </h3>
            
            {beforePhotos.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Issue Photos</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                  {beforePhotos.map((p, i) => (
                    <img key={i} src={p.url} alt="Before" className="w-24 h-24 object-cover rounded-xl shrink-0 snap-start border border-gray-100 bg-gray-50" />
                  ))}
                </div>
              </div>
            )}
            
            {afterPhotos.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Resolution Photos</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                  {afterPhotos.map((p, i) => (
                    <img key={i} src={p.url} alt="After" className="w-24 h-24 object-cover rounded-xl shrink-0 snap-start border border-green-100 bg-green-50" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-5">Timeline</h3>
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
            {data.logs.map((log, i) => (
              <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-5 h-5 rounded-full border-4 border-white bg-blue-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow" />
                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border border-gray-100 bg-gray-50 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-900 text-xs capitalize">{log.action.replace('_', ' ')}</span>
                    <span className="text-[10px] text-gray-500 font-medium">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">{log.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
