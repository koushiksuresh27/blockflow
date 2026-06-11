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
      <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E0DDD9' }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 17, color: '#1C1917', margin: 0 }}>Add Housekeeping Staff</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6560', padding: 4 }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Assigned Area</label>
            <input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Tower A Lobby" style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Shift</label>
              <select value={shift} onChange={e => setShift(e.target.value as any)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}>
                <option value="morning">Morning (6AM-2PM)</option>
                <option value="evening">Evening (2PM-10PM)</option>
                <option value="night">Night (10PM-6AM)</option>
              </select>
            </div>
            <div>
              <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}>
                <option value="on_duty">On Duty</option>
                <option value="off_duty">Off Duty</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, padding: '0 24px 20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 10, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: '#FFFFFF', background: saving ? '#2C2925' : '#1C1917', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
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
      <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.15)', width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E0DDD9' }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 17, color: '#1C1917', margin: 0 }}>Add Housekeeping Task</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6560', padding: 4 }}><X className="w-4 h-4" /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Task Name</label>
            <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="e.g. Mop Lobby" style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Area</label>
            <input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Tower A" style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Assign To</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}>
              <option value="">-- Select Staff --</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.shift})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Frequency</label>
              <select value={freq} onChange={e => setFreq(e.target.value as any)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Next Due Date</label>
              <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, padding: '0 24px 20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 10, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13, color: '#FFFFFF', background: saving ? '#2C2925' : '#1C1917', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
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
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 0' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 24, color: '#1C1917', margin: '0 0 4px' }}>Housekeeping</h2>
            <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>Manage cleaning staff and schedules.</p>
          </div>
          <button
            onClick={() => activeTab === 'staff' ? setShowAddStaff(true) : setShowAddTask(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#D97706', color: '#FFFFFF', borderRadius: 10, border: 'none', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            <Plus className="w-4 h-4" />
            Add {activeTab === 'staff' ? 'Staff' : 'Task'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #E0DDD9', marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab('staff')}
            style={{
              padding: '0 0 12px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === 'staff' ? '#D97706' : 'transparent'}`,
              fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: activeTab === 'staff' ? '#D97706' : '#6B6560', cursor: 'pointer'
            }}
          >
            Staff Directory
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            style={{
              padding: '0 0 12px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === 'tasks' ? '#D97706' : 'transparent'}`,
              fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: activeTab === 'tasks' ? '#D97706' : '#6B6560', cursor: 'pointer'
            }}
          >
            Task Schedules
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FFF1F2', border: '1px solid #FCA5A5', borderRadius: 12, marginBottom: 24, fontFamily: 'Inter', fontSize: 14, color: '#BE123C' }}>
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1C1917' }} />
          </div>
        ) : activeTab === 'staff' ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, overflow: 'hidden' }}>
            {staff.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '64px 0', fontFamily: 'Inter', fontSize: 14, color: '#9C9894', margin: 0 }}>No staff found.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F5F3F0', borderBottom: '1px solid #E0DDD9' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</th>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Area</th>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shift</th>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F5F3F0' }}>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#1C1917' }}>{s.name}</td>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>{s.phone || '-'}</td>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>{s.assigned_area}</td>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontSize: 14, color: '#1C1917', textTransform: 'capitalize' }}>{s.shift}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          padding: '4px 12px', borderRadius: 20, fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px',
                          background: s.status === 'on_duty' ? '#F0FDF4' : '#F5F3F0',
                          color: s.status === 'on_duty' ? '#15803D' : '#6B6560',
                        }}>
                          {s.status === 'on_duty' ? 'On Duty' : 'Off Duty'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button onClick={() => deleteStaff(s.id)} style={{ padding: 8, background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', borderRadius: 8 }}>
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
          <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, overflow: 'hidden' }}>
            {tasks.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '64px 0', fontFamily: 'Inter', fontSize: 14, color: '#9C9894', margin: 0 }}>No tasks found.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F5F3F0', borderBottom: '1px solid #E0DDD9' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Task</th>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned To</th>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Frequency</th>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Due</th>
                    <th style={{ padding: '16px 24px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #F5F3F0' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <p style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#1C1917', margin: '0 0 2px' }}>{t.task_name}</p>
                        <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: 0 }}>{t.area}</p>
                      </td>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>{t.staff?.name || 'Unassigned'}</td>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontSize: 14, color: '#1C1917', textTransform: 'capitalize' }}>{t.frequency}</td>
                      <td style={{ padding: '16px 24px', fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>
                        {t.next_due ? new Date(t.next_due).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button onClick={() => markTaskComplete(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#F0FDF4', color: '#15803D', border: '1px solid #DCFCE7', borderRadius: 8, fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
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
