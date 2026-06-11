import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Plus, X, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Schedule {
  id: string;
  task_name: string;
  category: string;
  equipment_id: string | null;
  assigned_tech_id: string | null;
  frequency: 'one_time' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  last_completed: string | null;
  next_due: string;
  status: 'upcoming' | 'due_soon' | 'overdue' | 'completed';
  notes: string | null;
  equipment?: { name: string };
  technician?: { tech_user: { name: string } };
}

interface Equipment {
  id: string;
  name: string;
}

interface Technician {
  id: string;
  tech_user: { name: string };
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function AddScheduleModal({
  societyId, equipmentList, techList, onClose, onAdded
}: {
  societyId: string; equipmentList: Equipment[]; techList: Technician[]; onClose: () => void; onAdded: () => void;
}) {
  const toast = useToast();
  const [taskName, setTaskName] = useState('');
  const [category, setCategory] = useState('Electrical');
  const [equipmentId, setEquipmentId] = useState('');
  const [techId, setTechId] = useState('');
  const [frequency, setFrequency] = useState<'one_time'|'weekly'|'monthly'|'quarterly'|'annually'>('monthly');
  const [nextDue, setNextDue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!taskName.trim() || !nextDue) return toast('error', 'Task name and Next Due Date are required');
    setSaving(true);
    try {
      const { error } = await supabase.from('maintenance_schedules').insert({
        society_id: societyId,
        task_name: taskName.trim(),
        category,
        equipment_id: equipmentId || null,
        assigned_tech_id: techId || null,
        frequency,
        next_due: new Date(nextDue).toISOString(),
        notes: notes.trim() || null,
      });
      if (error) throw new Error(error.message);
      toast('success', 'Schedule added');
      onAdded();
      onClose();
    } catch (e: unknown) {
      toast('error', 'Failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E0DDD9', position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 10 }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 17, color: '#1C1917', margin: 0 }}>Add Maintenance Schedule</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6560', padding: 4 }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Task Name</label>
            <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="e.g. Lift Annual Servicing" style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}>
                {['Electrical', 'Plumbing', 'Civil', 'Mechanical', 'Safety', 'Housekeeping'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as any)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}>
                <option value="one_time">One-time</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Equipment (Optional)</label>
            <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}>
              <option value="">-- None --</option>
              {equipmentList.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Assign to Technician (Optional)</label>
            <select value={techId} onChange={e => setTechId(e.target.value)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}>
              <option value="">-- None --</option>
              {techList.map(t => <option key={t.id} value={t.id}>{t.tech_user?.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Next Due Date</label>
            <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}></textarea>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, padding: '16px 24px 20px', position: 'sticky', bottom: 0, background: '#FFFFFF', borderTop: '1px solid #E0DDD9' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 10, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: '#FFFFFF', background: saving ? '#2C2925' : '#1C1917', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {saving ? 'Saving...' : 'Add Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const toast = useToast();
  const [societyId, setSocietyId] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [techList, setTechList] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user.id).single();
      const sid = profile?.society_id ?? '';
      setSocietyId(sid);

      if (sid) {
        const [schedRes, eqRes, techRes] = await Promise.all([
          supabase.from('maintenance_schedules').select('*, equipment(name), technician:technicians(tech_user:users(name))').eq('society_id', sid).order('next_due', { ascending: true }),
          supabase.from('equipment').select('id, name').eq('society_id', sid),
          supabase.from('technicians').select('id, tech_user:users(name)').eq('society_id', sid)
        ]);

        if (schedRes.error) throw new Error(schedRes.error.message);
        
        // Dynamically calculate status based on due date
        const now = new Date().getTime();
        const updatedSchedules = (schedRes.data || []).map(s => {
          const due = new Date(s.next_due).getTime();
          let calcStatus = 'upcoming';
          if (due < now) calcStatus = 'overdue';
          else if (due - now <= 7 * 24 * 60 * 60 * 1000) calcStatus = 'due_soon';
          return { ...s, status: calcStatus };
        });

        setSchedules(updatedSchedules as Schedule[]);
        setEquipmentList(eqRes.data || []);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTechList(techRes.data as any || []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const markComplete = async (schedule: Schedule) => {
    try {
      const now = new Date();
      let nextDue = new Date(schedule.next_due);
      
      if (schedule.frequency === 'one_time') {
        nextDue = new Date(now.getTime() + 365*24*60*60*1000); // arbitrarily far future if completed
      } else if (schedule.frequency === 'weekly') {
        nextDue.setDate(nextDue.getDate() + 7);
      } else if (schedule.frequency === 'monthly') {
        nextDue.setMonth(nextDue.getMonth() + 1);
      } else if (schedule.frequency === 'quarterly') {
        nextDue.setMonth(nextDue.getMonth() + 3);
      } else if (schedule.frequency === 'annually') {
        nextDue.setFullYear(nextDue.getFullYear() + 1);
      }

      const { error } = await supabase.from('maintenance_schedules').update({
        last_completed: now.toISOString(),
        next_due: nextDue.toISOString(),
      }).eq('id', schedule.id);

      if (error) throw new Error(error.message);

      // Create an audit trail entry
      await supabase.from('complaint_logs').insert({
        action: 'maintenance_completed',
        note: `Completed maintenance: ${schedule.task_name}`,
        // Using actor_id implicitly logic or keeping it generic if actor_id is required
      });

      toast('success', 'Maintenance marked complete', `Next due on ${nextDue.toLocaleDateString()}`);
      loadData();
    } catch (e: unknown) {
      toast('error', 'Error', e instanceof Error ? e.message : 'Failed to update schedule');
    }
  };

  const total = schedules.length;
  const overdue = schedules.filter(s => s.status === 'overdue').length;
  const dueSoon = schedules.filter(s => s.status === 'due_soon').length;
  
  // Calculate completed this month (requires filtering by last_completed)
  const nowMonth = new Date().getMonth();
  const nowYear = new Date().getFullYear();
  const completedThisMonth = schedules.filter(s => {
    if (!s.last_completed) return false;
    const l = new Date(s.last_completed);
    return l.getMonth() === nowMonth && l.getFullYear() === nowYear;
  }).length;

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 0' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 24, color: '#1C1917', margin: '0 0 4px' }}>Preventive Maintenance</h2>
            <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>Schedule and track periodic servicing.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#D97706', color: '#FFFFFF', borderRadius: 10, border: 'none', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            <Plus className="w-4 h-4" /> Schedule Task
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FFF1F2', border: '1px solid #FCA5A5', borderRadius: 12, marginBottom: 24, fontFamily: 'Inter', fontSize: 14, color: '#BE123C' }}>
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
            <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Total Scheduled</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 32, color: '#1C1917', margin: 0 }}>{total}</h3>
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
            <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Due This Week</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 32, color: '#F59E0B', margin: 0 }}>{dueSoon}</h3>
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
            <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Overdue Tasks</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 32, color: '#DC2626', margin: 0 }}>{overdue}</h3>
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
            <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Completed (Month)</p>
            <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 32, color: '#15803D', margin: 0 }}>{completedThisMonth}</h3>
          </div>
        </div>

        {/* Schedule List */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1C1917' }} />
            </div>
          ) : schedules.length === 0 ? (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12, color: '#9C9894' }}>
               <CalendarIcon className="w-10 h-10" />
               <p style={{ fontFamily: 'Inter', fontSize: 14, margin: 0 }}>No maintenance schedules found.</p>
             </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: '#F5F3F0', borderBottom: '1px solid #E0DDD9' }}>
                <tr>
                  <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Task</th>
                  <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Equipment</th>
                  <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned To</th>
                  <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Frequency</th>
                  <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Due</th>
                  <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                  <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map(s => {
                  const statusColors: Record<string, { bg: string, text: string, border: string }> = {
                    upcoming: { bg: '#F5F3F0', text: '#6B6560', border: '#E0DDD9' },
                    due_soon: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
                    overdue: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
                    completed: { bg: '#F0FDF4', text: '#15803D', border: '#DCFCE7' }
                  };
                  const colors = statusColors[s.status] || statusColors.upcoming;

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F5F3F0' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <p style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#1C1917', margin: '0 0 2px' }}>{s.task_name}</p>
                        <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 10, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{s.category}</p>
                      </td>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>{s.equipment?.name || '-'}</td>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>{s.technician?.tech_user?.name || '-'}</td>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontSize: 14, color: '#1C1917', textTransform: 'capitalize' }}>{s.frequency.replace('_', '-')}</td>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>
                        {new Date(s.next_due).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: 6, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button onClick={() => markComplete(s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#F0FDF4', color: '#15803D', border: '1px solid #DCFCE7', borderRadius: 8, fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {showAdd && <AddScheduleModal societyId={societyId} equipmentList={equipmentList} techList={techList} onClose={() => setShowAdd(false)} onAdded={loadData} />}
    </AdminLayout>
  );
}
