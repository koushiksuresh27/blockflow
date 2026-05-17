import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Plus, X, Star, Briefcase, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Technician {
  id: string; name: string; phone: string;
  specializations: string[]; performance_score: number;
  is_available: boolean; open_tasks: number; user_id: string;
}

const SPEC_OPTIONS = ['Plumbing','Electrical','Carpentry','HVAC','Civil/Structural','Housekeeping','Lift/Elevator','General'];

function Stars({ score }: { score: number }) {
  const filled = Math.round((score/100)*5);
  return <span className="flex gap-0.5" aria-label={`${filled} stars`}>
    {Array.from({length:5},(_,i)=>(
      <Star key={i} className={`w-3.5 h-3.5 ${i<filled?'text-amber-400 fill-amber-400':'text-gray-200 fill-gray-200'}`}/>
    ))}
  </span>;
}

// ─── Add Technician Modal ────────────────────────────────────────────────────
function AddTechModal({ societyId, onClose, onAdded }: { societyId:string; onClose:()=>void; onAdded:()=>void }) {
  const toast = useToast();
  const [name,setName]   = useState('');
  const [phone,setPhone] = useState('');
  const [specs,setSpecs] = useState<string[]>([]);
  const [errors,setErrors] = useState<Record<string,string>>({});
  const [saving,setSaving] = useState(false);

  const toggleSpec = (s:string) => setSpecs(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s]);

  const validate = () => {
    const e: Record<string,string> = {};
    if(!name.trim()) e.name='Name is required.';
    setErrors(e); return Object.keys(e).length===0;
  };

  const handleSubmit = async () => {
    if(!validate()) return;
    setSaving(true);
    try {
      const newUserId = crypto.randomUUID();

      // 1. Insert public.users row
      const { error: userErr } = await supabase.from('users').insert({
        id: newUserId,
        name: name.trim(),
        phone: phone.trim() || null,
        role: 'technician',
        ...(societyId && { society_id: societyId }),
      });
      if (userErr) throw new Error(userErr.message);

      // 2. Insert technicians row
      const { error: techErr } = await supabase.from('technicians').insert({
        user_id: newUserId,
        specializations: specs,
        is_available: true,
        performance_score: 0,
        ...(societyId && { society_id: societyId }),
      });
      if (techErr) throw new Error(techErr.message);

      toast('success', 'Technician added', 'Technician added. They can be invited to the app later.');
      onAdded(); onClose();
    } catch(e:unknown){ toast('error','Failed', e instanceof Error?e.message:'Error'); }
    finally{ setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Add Technician</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500"/></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {[{id:'name',label:'Full Name',val:name,set:setName,type:'text',placeholder:'e.g. Ramesh Kumar'},
            {id:'phone',label:'Phone',val:phone,set:setPhone,type:'tel',placeholder:'+91 9876543210'},
          ].map(f=>(
            <div key={f.id}>
              <label htmlFor={f.id} className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input id={f.id} type={f.type} value={f.val} placeholder={f.placeholder}
                onChange={e=>f.set(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${errors[f.id]?'border-red-400':'border-gray-300'}`}/>
              {errors[f.id]&&<p className="mt-1 text-xs text-red-600">{errors[f.id]}</p>}
            </div>
          ))}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Specializations</p>
            <div className="flex flex-wrap gap-2">
              {SPEC_OPTIONS.map(s=>{
                const on = specs.includes(s);
                return <button key={s} type="button" onClick={()=>toggleSpec(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${on?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                  {on&&<Check className="w-3 h-3"/>}{s}
                </button>;
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition">
            {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Plus className="w-4 h-4"/>}
            {saving?'Adding…':'Add Technician'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function TechniciansPage() {
  const toast = useToast();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [societyId, setSocietyId]     = useState('');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showAdd, setShowAdd]         = useState(false);

  const load = useCallback(async()=>{
    setError('');
    try {
      const {data:{user}} = await supabase.auth.getUser();
      if(!user) throw new Error('Not authenticated');
      const {data:profile} = await supabase.from('users').select('society_id').eq('id',user.id).single();
      const sid = profile?.society_id??'';
      setSocietyId(sid);

      let query = supabase.from('technicians').select(`
        id, specializations, performance_score, is_available, user_id,
        tech_user:users!user_id(name, phone),
        open_complaints:complaints!assigned_tech_id(status)
      `);

      if (sid) {
        query = query.eq('society_id', sid);
      }

      const { data, error: e } = await query;
      if(e) throw new Error(e.message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTechnicians((data??[]).map((r:any)=>({
        id:r.id, user_id:r.user_id, name:r.tech_user?.name??'Unknown',
        phone:r.tech_user?.phone??'',
        specializations:r.specializations??[], performance_score:r.performance_score??0,
        is_available:r.is_available, open_tasks:(r.open_complaints??[]).filter((c:{status:string})=>!['closed','verified','resolved'].includes(c.status)).length,
      })));
    } catch(e:unknown){ setError(e instanceof Error?e.message:'Error'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const toggleAvailable = async (t:Technician) => {
    const newVal = !t.is_available;
    setTechnicians(p=>p.map(x=>x.id===t.id?{...x,is_available:newVal}:x));
    const {error:e} = await supabase.from('technicians').update({is_available:newVal}).eq('id',t.id);
    if(e){ setTechnicians(p=>p.map(x=>x.id===t.id?{...x,is_available:t.is_available}:x)); toast('error','Update failed',e.message); }
    else toast('success','Availability updated',`${t.name} marked as ${newVal?'available':'busy'}.`);
  };

  return (
    <AdminLayout>
      <div className="px-8 py-8 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-xl font-bold text-gray-900">Technicians</h1>
            <p className="text-sm text-gray-500 mt-0.5">{technicians.length} technician{technicians.length!==1?'s':''} in your society</p>
          </div>
          <button onClick={()=>setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition">
            <Plus className="w-4 h-4"/>Add Technician
          </button>
        </div>

        {error&&<div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4"><AlertCircle className="w-4 h-4"/>{error}</div>}

        {loading?<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500"/></div>
        :<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {technicians.length===0&&<p className="col-span-3 text-center py-20 text-sm text-gray-400">No technicians added yet.</p>}
          {technicians.map(t=>(
            <div key={t.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.phone || 'No phone'}</p>
                </div>
                {/* Available toggle */}
                <button onClick={()=>toggleAvailable(t)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition ${t.is_available?'bg-green-100 text-green-700 hover:bg-green-200':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {t.is_available?'Available':'Busy'}
                </button>
              </div>

              {/* Specialization tags */}
              {t.specializations.length>0&&<div className="flex flex-wrap gap-1.5">
                {t.specializations.map(s=><span key={s} className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{s}</span>)}
              </div>}

              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <Stars score={t.performance_score}/>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Briefcase className="w-3 h-3"/>{t.open_tasks} open task{t.open_tasks!==1?'s':''}
                </span>
              </div>
            </div>
          ))}
        </div>}
      </div>

      {showAdd&&<AddTechModal societyId={societyId} onClose={()=>setShowAdd(false)} onAdded={load}/>}
    </AdminLayout>
  );
}
