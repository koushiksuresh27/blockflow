import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Search, X, Loader2, AlertCircle, Clock, MapPin, Paperclip, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import AssignTechnicianModal from '../../components/AssignTechnicianModal';
import { useToast } from '../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status = 'open'|'triaged'|'assigned'|'accepted'|'in_progress'|'on_hold'|'resolved'|'verified'|'closed'|'escalated'|'reopened';

interface Complaint {
  id: string; title: string; category: string; priority: Priority; status: Status;
  description: string; sla_deadline: string; created_at: string; updated_at: string;
  submitted_by_name: string; assigned_tech_name: string | null; assigned_tech_id: string | null;
  location_apt: string | null; society_id: string;
}
interface LogEntry { id: string; action: string; note: string | null; old_status: string | null; new_status: string | null; created_at: string; actor_name: string; }
interface Attachment { id: string; url: string; attachment_type: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PRIORITY_BADGE: Record<Priority,string> = {
  low:'bg-gray-100 text-gray-600', medium:'bg-yellow-50 text-yellow-700',
  high:'bg-orange-50 text-orange-700', critical:'bg-red-50 text-red-700',
};
const PRIORITY_DOT: Record<Priority,string> = {
  low:'bg-gray-400', medium:'bg-yellow-400', high:'bg-orange-500', critical:'bg-red-600',
};
const STATUS_PILL: Partial<Record<Status,string>> = {
  open:'bg-blue-50 text-blue-700', triaged:'bg-purple-50 text-purple-700',
  assigned:'bg-indigo-50 text-indigo-700', accepted:'bg-cyan-50 text-cyan-700',
  in_progress:'bg-amber-50 text-amber-700', on_hold:'bg-gray-100 text-gray-500',
  resolved:'bg-green-50 text-green-700', verified:'bg-teal-50 text-teal-700',
  closed:'bg-gray-200 text-gray-500', escalated:'bg-rose-50 text-rose-700',
  reopened:'bg-orange-50 text-orange-700',
};
const ALL_STATUSES: Status[] = ['open','triaged','assigned','accepted','in_progress','on_hold','resolved','verified','closed','escalated','reopened'];
const CATEGORIES = ['Plumbing','Electrical','Carpentry','HVAC','Civil/Structural','Housekeeping','Lift/Elevator','Common Area','Other'];
const fmt = (s: string) => s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const fmtDate = (iso:string) => new Date(iso).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});

function slaClass(dl:string, status:Status){
  if(['closed','verified'].includes(status)) return 'text-gray-400';
  const diff = new Date(dl).getTime()-Date.now();
  if(diff<0) return 'text-red-600 font-semibold';
  if(diff<7200000) return 'text-amber-600 font-semibold';
  return 'text-gray-600';
}

// ─── Data ────────────────────────────────────────────────────────────────────
async function fetchAll(): Promise<{ complaints: Complaint[]; societyId: string }> {
  const { data:{user} } = await supabase.auth.getUser();
  if(!user) throw new Error('Not authenticated');
  const { data:profile } = await supabase.from('users').select('society_id').eq('id',user.id).single();
  const societyId = profile?.society_id ?? '';

  let query = supabase.from('complaints').select(`
    id, title, category, priority, status, description, sla_deadline, created_at, updated_at, assigned_tech_id, society_id,
    submitted_user:users!submitted_by(name),
    assigned_tech:technicians!assigned_tech_id(tech_user:users!user_id(name)),
    location_apt:apartments!location_apt_id(flat_number,floor_number,tower:towers!tower_id(name))
  `).order('created_at',{ascending:false}).limit(500);

  if (societyId) {
    query = query.eq('society_id', societyId);
  }

  const { data, error } = await query;

  if(error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { societyId, complaints: (data??[]).map((r:any)=>({
    id:r.id, title:r.title, category:r.category, priority:r.priority, status:r.status,
    description:r.description, sla_deadline:r.sla_deadline, created_at:r.created_at,
    updated_at:r.updated_at, assigned_tech_id:r.assigned_tech_id, society_id:r.society_id,
    submitted_by_name:r.submitted_user?.name??'—',
    assigned_tech_name:r.assigned_tech?.tech_user?.name??null,
    location_apt: r.location_apt ? `${r.location_apt.tower?.name??''} · F${r.location_apt.floor_number} · ${r.location_apt.flat_number}` : null,
  })) };
}

async function fetchDetail(id:string): Promise<{ logs:LogEntry[]; attachments:Attachment[] }>{
  const [{ data:logs }, { data:atts }] = await Promise.all([
    supabase.from('complaint_logs').select('id,action,note,old_status,new_status,created_at,actor:users!actor_id(name)').eq('complaint_id',id).order('created_at',{ascending:true}),
    supabase.from('complaint_attachments').select('id,url,attachment_type').eq('complaint_id',id),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logs:(logs??[]).map((l:any)=>({...l, actor_name:l.actor?.name??'System'})),
    attachments:atts??[],
  };
}

// ─── Detail Panel ────────────────────────────────────────────────────────────
function DetailPanel({ c, societyId, onClose, onRefresh }: { c:Complaint; societyId:string; onClose:()=>void; onRefresh:()=>void }) {
  const toast = useToast();
  const [logs,setLogs] = useState<LogEntry[]>([]);
  const [atts,setAtts] = useState<Attachment[]>([]);
  const [loading,setLoading] = useState(true);
  const [assignOpen,setAssignOpen] = useState(false);
  const [updatingStatus,setUpdatingStatus] = useState(false);
  const [newStatus,setNewStatus] = useState<Status>(c.status);

  useEffect(()=>{ fetchDetail(c.id).then(d=>{setLogs(d.logs);setAtts(d.attachments);}).finally(()=>setLoading(false)); },[c.id]);

  const applyStatus = async () => {
    if(newStatus===c.status) return;
    setUpdatingStatus(true);
    try {
      const {data:{user}} = await supabase.auth.getUser();
      await supabase.from('complaints').update({status:newStatus,updated_at:new Date().toISOString()}).eq('id',c.id);
      await supabase.from('complaint_logs').insert({complaint_id:c.id,actor_id:user!.id,action:'status_update',old_status:c.status,new_status:newStatus,note:`Status changed to ${fmt(newStatus)}.`});
      toast('success','Status updated',`Moved to "${fmt(newStatus)}".`);
      onRefresh();
    } catch(e:unknown){ toast('error','Update failed', e instanceof Error ? e.message:'Error'); }
    finally{ setUpdatingStatus(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={(e)=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col z-10">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 leading-snug truncate">{c.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{c.id.slice(0,18)}…</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"><X className="w-4 h-4 text-gray-500"/></button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_BADGE[c.priority]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[c.priority]}`}/>
              {fmt(c.priority)}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[c.status]??'bg-gray-100 text-gray-600'}`}>{fmt(c.status)}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{c.category}</span>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[['Submitted by',c.submitted_by_name],['Assigned to',c.assigned_tech_name??'Unassigned'],['SLA',fmtDate(c.sla_deadline)],['Created',fmtDate(c.created_at)]].map(([l,v])=>(
              <div key={l}><p className="text-gray-400 mb-0.5">{l}</p><p className={`font-medium ${l==='SLA'?slaClass(c.sla_deadline,c.status):'text-gray-800'}`}>{v}</p></div>
            ))}
            {c.location_apt&&<div className="col-span-2"><p className="text-gray-400 mb-0.5">Location</p><p className="font-medium text-gray-800 flex items-center gap-1"><MapPin className="w-3 h-3"/>{c.location_apt}</p></div>}
          </div>

          {/* Description */}
          <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p><p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.description}</p></div>

          {/* Attachments */}
          {atts.length>0&&<div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Paperclip className="w-3 h-3"/>Attachments ({atts.length})</p>
            <div className="flex flex-wrap gap-2">{atts.map(a=>(
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="relative group">
                <img src={a.url} alt={a.attachment_type} className="w-20 h-20 object-cover rounded-lg border border-gray-200"/>
                <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center py-0.5 rounded-b-lg">{a.attachment_type}</span>
              </a>
            ))}</div>
          </div>}

          {/* Status update + Assign */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select value={newStatus} onChange={e=>setNewStatus(e.target.value as Status)}
                className="w-full appearance-none px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8">
                {ALL_STATUSES.map(s=><option key={s} value={s}>{fmt(s)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            </div>
            <button onClick={applyStatus} disabled={updatingStatus||newStatus===c.status}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition flex items-center gap-1.5">
              {updatingStatus?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:null}Update
            </button>
            <button onClick={()=>setAssignOpen(true)}
              className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition flex items-center gap-1"><User className="w-3.5 h-3.5"/>Assign</button>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1"><Clock className="w-3 h-3"/>Activity ({logs.length})</p>
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500"/> :
            <ol className="relative border-l border-gray-200 space-y-4 ml-2">
              {logs.map(log=>(
                <li key={log.id} className="ml-4">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white"/>
                  <p className="text-xs font-semibold text-gray-800">{fmt(log.action)}
                    {log.new_status&&<span className="ml-1 font-normal text-gray-500">→ {fmt(log.new_status)}</span>}
                  </p>
                  {log.note&&<p className="text-xs text-gray-500 mt-0.5">{log.note}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">{log.actor_name} · {fmtDate(log.created_at)}</p>
                </li>
              ))}
            </ol>}
          </div>
        </div>
      </div>

      {assignOpen&&<AssignTechnicianModal
        complaintId={c.id} complaintCategory={c.category} societyId={societyId}
        onClose={()=>setAssignOpen(false)}
        onAssigned={(name)=>{ toast('success','Assigned',`Assigned to ${name}.`); onRefresh(); setAssignOpen(false); }}
        onError={(msg)=>toast('error','Failed',msg)}
      />}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
function Select({ label, value, options, onChange }: { label:string; value:string; options:string[]; onChange:(v:string)=>void }) {
  return (
    <div className="relative">
      <select value={value} onChange={e=>onChange(e.target.value)}
        className={`appearance-none pl-3 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${value?'border-blue-400 bg-blue-50 text-blue-700':'border-gray-200 bg-white text-gray-600'}`}>
        <option value="">{label}</option>
        {options.map(o=><option key={o} value={o}>{fmt(o)}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [societyId, setSocietyId]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selected, setSelected]     = useState<Complaint|null>(null);

  const load = useCallback(async()=>{
    setError('');
    try { const r=await fetchAll(); setComplaints(r.complaints); setSocietyId(r.societyId); }
    catch(e:unknown){ setError(e instanceof Error?e.message:'Error'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const filtered = complaints.filter(c=>{
    if(filterStatus && c.status!==filterStatus) return false;
    if(filterPriority && c.priority!==filterPriority) return false;
    if(filterCategory && c.category!==filterCategory) return false;
    if(search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hasFilter = filterStatus||filterPriority||filterCategory||search;

  return (
    <AdminLayout>
      <div className="px-8 py-8 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-xl font-bold text-gray-900">Complaints</h1>
            <p className="text-sm text-gray-500 mt-0.5">{filtered.length} complaint{filtered.length!==1?'s':''} {hasFilter?'(filtered)':''}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <Select label="All statuses" value={filterStatus} options={ALL_STATUSES} onChange={setFilterStatus}/>
          <Select label="All priorities" value={filterPriority} options={['low','medium','high','critical']} onChange={setFilterPriority}/>
          <Select label="All categories" value={filterCategory} options={CATEGORIES} onChange={setFilterCategory}/>
          {hasFilter&&<button onClick={()=>{setSearch('');setFilterStatus('');setFilterPriority('');setFilterCategory('');}} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5"/>Clear</button>}
        </div>

        {error&&<div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4"><AlertCircle className="w-4 h-4"/>{error}</div>}

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {loading?<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500"/></div>
          :filtered.length===0?<div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2"><p className="text-sm">No complaints match your filters.</p></div>
          :<div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              {['ID','Title','Category','Priority','Status','Submitted By','Assigned To','SLA Deadline','Created'].map(h=>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c=>(
                <tr key={c.id} onClick={()=>setSelected(c)} className="hover:bg-blue-50/40 cursor-pointer transition-colors">
                  <td className="px-4 py-3.5 font-mono text-xs text-gray-400">{c.id.slice(0,8)}…</td>
                  <td className="px-4 py-3.5 max-w-[160px]"><p className="font-medium text-gray-900 truncate" title={c.title}>{c.title}</p></td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 text-xs">{c.category}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_BADGE[c.priority]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[c.priority]}`}/>{fmt(c.priority)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[c.status]??'bg-gray-100 text-gray-600'}`}>{fmt(c.status)}</span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-gray-700 text-xs">{c.submitted_by_name}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-xs">{c.assigned_tech_name??<span className="text-gray-300">—</span>}</td>
                  <td className={`px-4 py-3.5 whitespace-nowrap text-xs ${slaClass(c.sla_deadline,c.status)}`}>{fmtDate(c.sla_deadline)}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-400">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>}
        </div>
      </div>

      {selected&&<DetailPanel c={selected} societyId={societyId} onClose={()=>setSelected(null)} onRefresh={()=>{load();setSelected(null);}}/>}
    </AdminLayout>
  );
}
