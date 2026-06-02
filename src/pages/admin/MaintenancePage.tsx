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
      <div className="bg-surface-container border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-md animate-slideInRight max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant/20 sticky top-0 bg-surface-container z-10">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Add Maintenance Schedule</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high transition">
            <X className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Task Name</label>
            <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="e.g. Lift Annual Servicing" className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30">
                {['Electrical', 'Plumbing', 'Civil', 'Mechanical', 'Safety', 'Housekeeping'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30">
                <option value="one_time">One-time</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Equipment (Optional)</label>
            <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30">
              <option value="">-- None --</option>
              {equipmentList.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Assign to Technician (Optional)</label>
            <select value={techId} onChange={e => setTechId(e.target.value)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30">
              <option value="">-- None --</option>
              {techList.map(t => <option key={t.id} value={t.id}>{t.tech_user?.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Next Due Date</label>
            <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" rows={3}></textarea>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5 sticky bottom-0 bg-surface-container pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-primary hover:brightness-110 disabled:opacity-60 rounded-xl transition">
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
      <div className="px-margin-desktop py-10 max-w-screen-xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Preventive Maintenance</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Schedule and track periodic servicing.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-primary hover:brightness-110 transition shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Schedule Task
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-error-container/20 border border-error-container/40 rounded-2xl text-sm text-error">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Total Scheduled</p>
            <h3 className="text-2xl font-bold text-on-surface">{total}</h3>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Due This Week</p>
            <h3 className="text-2xl font-bold text-amber-500">{dueSoon}</h3>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-xs font-bold text-status-emergency uppercase tracking-wider mb-1">Overdue Tasks</p>
            <h3 className="text-2xl font-bold text-status-emergency">{overdue}</h3>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-xs font-bold text-status-available uppercase tracking-wider mb-1">Completed (Month)</p>
            <h3 className="text-2xl font-bold text-status-available">{completedThisMonth}</h3>
          </div>
        </div>

        {/* Schedule List */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : schedules.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/50 gap-3">
               <CalendarIcon className="w-10 h-10" />
               <p className="text-sm">No maintenance schedules found.</p>
             </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-container-lowest/80 border-b border-outline-variant/20">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Task</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Equipment</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Assigned To</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Frequency</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Next Due</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {schedules.map(s => {
                  const statusColors = {
                    upcoming: 'bg-primary/10 text-primary border-primary/20',
                    due_soon: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                    overdue: 'bg-status-emergency/10 text-status-emergency border-status-emergency/20',
                    completed: 'bg-status-available/10 text-status-available border-status-available/20'
                  };

                  return (
                    <tr key={s.id} className="hover:bg-surface-variant/10 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-on-surface">{s.task_name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mt-0.5">{s.category}</p>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">{s.equipment?.name || '-'}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{s.technician?.tech_user?.name || '-'}</td>
                      <td className="px-6 py-4 capitalize text-on-surface">{s.frequency.replace('_', '-')}</td>
                      <td className="px-6 py-4 text-on-surface-variant">
                        {new Date(s.next_due).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${statusColors[s.status]}`}>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => markComplete(s)} className="flex items-center justify-end gap-1.5 ml-auto px-3 py-1.5 rounded-lg text-status-available hover:bg-status-available/10 transition font-medium text-xs border border-status-available/20">
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
