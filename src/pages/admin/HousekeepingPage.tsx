import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Plus, X, Check, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Staff {
  id: string;
  name: string;
  phone: string;
  assigned_area: string;
  shift: 'morning' | 'evening' | 'night';
  status: 'on_duty' | 'off_duty';
}

interface Task {
  id: string;
  task_name: string;
  area: string;
  staff_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  last_completed: string | null;
  next_due: string | null;
  status: 'pending' | 'completed' | 'overdue';
  staff?: { name: string };
}

// ─── Modals ──────────────────────────────────────────────────────────────────
function AddStaffModal({ societyId, onClose, onAdded }: { societyId: string; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [shift, setShift] = useState<'morning'|'evening'|'night'>('morning');
  const [status, setStatus] = useState<'on_duty'|'off_duty'>('on_duty');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !area.trim()) return toast('error', 'Required fields missing');
    setSaving(true);
    try {
      const { error } = await supabase.from('housekeeping_staff').insert({
        society_id: societyId,
        name: name.trim(),
        phone: phone.trim(),
        assigned_area: area.trim(),
        shift,
        status,
      });
      if (error) throw new Error(error.message);
      toast('success', 'Staff added');
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
      <div className="bg-surface-container border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-md animate-slideInRight">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant/20">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Add Housekeeping Staff</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high transition">
            <X className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Assigned Area</label>
            <input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Tower A Lobby" className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Shift</label>
              <select value={shift} onChange={e => setShift(e.target.value as any)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30">
                <option value="morning">Morning (6AM-2PM)</option>
                <option value="evening">Evening (2PM-10PM)</option>
                <option value="night">Night (10PM-6AM)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30">
                <option value="on_duty">On Duty</option>
                <option value="off_duty">Off Duty</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-primary hover:brightness-110 disabled:opacity-60 rounded-xl transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {saving ? 'Adding...' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddTaskModal({ societyId, staffList, onClose, onAdded }: { societyId: string; staffList: Staff[]; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [taskName, setTaskName] = useState('');
  const [area, setArea] = useState('');
  const [staffId, setStaffId] = useState('');
  const [freq, setFreq] = useState<'daily'|'weekly'|'monthly'>('daily');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!taskName.trim() || !area.trim() || !dueDate) return toast('error', 'Required fields missing');
    setSaving(true);
    try {
      const { error } = await supabase.from('housekeeping_tasks').insert({
        society_id: societyId,
        task_name: taskName.trim(),
        area: area.trim(),
        staff_id: staffId || null,
        frequency: freq,
        next_due: new Date(dueDate).toISOString(),
      });
      if (error) throw new Error(error.message);
      toast('success', 'Task added');
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
      <div className="bg-surface-container border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-md animate-slideInRight">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant/20">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Add Housekeeping Task</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high transition">
            <X className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Task Name</label>
            <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="e.g. Mop Lobby" className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Area</label>
            <input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Tower A" className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Assign To</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30">
              <option value="">-- Select Staff --</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.shift})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Frequency</label>
              <select value={freq} onChange={e => setFreq(e.target.value as any)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">Next Due Date</label>
              <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 py-2.5 text-sm border rounded-xl bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-outline-variant/30" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-container-high transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-primary hover:brightness-110 disabled:opacity-60 rounded-xl transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {saving ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function HousekeepingPage() {
  const toast = useToast();
  const [societyId, setSocietyId] = useState('');
  const [activeTab, setActiveTab] = useState<'staff' | 'tasks'>('staff');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user.id).single();
      const sid = profile?.society_id ?? '';
      setSocietyId(sid);

      if (sid) {
        const [staffRes, tasksRes] = await Promise.all([
          supabase.from('housekeeping_staff').select('*').eq('society_id', sid).order('created_at', { ascending: false }),
          supabase.from('housekeeping_tasks').select('*, staff:housekeeping_staff!housekeeping_tasks_staff_id_fkey(name)').eq('society_id', sid).order('next_due', { ascending: true })
        ]);
        if (staffRes.error) throw new Error(staffRes.error.message);
        if (tasksRes.error) throw new Error(tasksRes.error.message);
        setStaff(staffRes.data || []);
        setTasks(tasksRes.data || []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const deleteStaff = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    try {
      const { error } = await supabase.from('housekeeping_staff').delete().eq('id', id);
      if (error) throw new Error(error.message);
      toast('success', 'Staff deleted');
      loadData();
    } catch (e: unknown) {
      toast('error', 'Error', e instanceof Error ? e.message : 'Deletion failed');
    }
  };

  const markTaskComplete = async (task: Task) => {
    try {
      const now = new Date();
      let nextDue = new Date(task.next_due || now);
      if (task.frequency === 'daily') nextDue.setDate(nextDue.getDate() + 1);
      else if (task.frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
      else if (task.frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);

      const { error } = await supabase.from('housekeeping_tasks').update({
        last_completed: now.toISOString(),
        next_due: nextDue.toISOString(),
        status: 'pending' // resets to pending for the next cycle
      }).eq('id', task.id);
      if (error) throw new Error(error.message);
      toast('success', 'Task marked completed', `Next due on ${nextDue.toLocaleDateString()}`);
      loadData();
    } catch (e: unknown) {
      toast('error', 'Error', e instanceof Error ? e.message : 'Failed to update task');
    }
  };

  return (
    <AdminLayout>
      <div className="px-margin-desktop py-10 max-w-screen-xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Housekeeping</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Manage cleaning staff and schedules.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => activeTab === 'staff' ? setShowAddStaff(true) : setShowAddTask(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-primary hover:brightness-110 transition shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              Add {activeTab === 'staff' ? 'Staff' : 'Task'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-outline-variant/30">
          <button
            onClick={() => setActiveTab('staff')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'staff' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            Staff Directory
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'tasks' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            Task Schedules
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-error-container/20 border border-error-container/40 rounded-2xl text-sm text-error">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : activeTab === 'staff' ? (
          <div className="glass-card rounded-2xl overflow-hidden">
            {staff.length === 0 ? (
              <p className="text-center py-16 text-sm text-on-surface-variant/50">No staff found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-container-lowest/80 border-b border-outline-variant/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Area</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Shift</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {staff.map(s => (
                    <tr key={s.id} className="hover:bg-surface-variant/10 transition-colors">
                      <td className="px-6 py-4 font-semibold text-on-surface">{s.name}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{s.phone || '-'}</td>
                      <td className="px-6 py-4 text-on-surface-variant">{s.assigned_area}</td>
                      <td className="px-6 py-4 capitalize text-on-surface">{s.shift}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.status === 'on_duty' ? 'bg-status-available/10 text-status-available' : 'bg-surface-variant/30 text-on-surface-variant'}`}>
                          {s.status === 'on_duty' ? 'On Duty' : 'Off Duty'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => deleteStaff(s.id)} className="p-1.5 rounded-lg text-error hover:bg-error/10 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            {tasks.length === 0 ? (
              <p className="text-center py-16 text-sm text-on-surface-variant/50">No tasks found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-container-lowest/80 border-b border-outline-variant/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Task</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Assigned To</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Frequency</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Next Due</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {tasks.map(t => (
                    <tr key={t.id} className="hover:bg-surface-variant/10 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-on-surface">{t.task_name}</p>
                        <p className="text-xs text-on-surface-variant">{t.area}</p>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">{t.staff?.name || 'Unassigned'}</td>
                      <td className="px-6 py-4 capitalize text-on-surface">{t.frequency}</td>
                      <td className="px-6 py-4 text-on-surface-variant">
                        {t.next_due ? new Date(t.next_due).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => markTaskComplete(t)} className="flex items-center justify-end gap-1.5 ml-auto px-3 py-1.5 rounded-lg text-status-available hover:bg-status-available/10 transition font-medium text-xs">
                          <Check className="w-3.5 h-3.5" /> Complete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showAddStaff && <AddStaffModal societyId={societyId} onClose={() => setShowAddStaff(false)} onAdded={loadData} />}
      {showAddTask && <AddTaskModal societyId={societyId} staffList={staff} onClose={() => setShowAddTask(false)} onAdded={loadData} />}
    </AdminLayout>
  );
}
